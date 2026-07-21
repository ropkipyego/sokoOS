import {
  Injectable,
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  SyncEnvelopeSchema,
  type SyncChange,
  type SyncEnvelope,
} from "@sokoos/types";
import {
  ConflictCode,
  isSupportedProtocolVersion,
  type SyncPushAck,
} from "@sokoos/sync-protocol";
import { PrismaService } from "../prisma/prisma.service";
import { SalesService } from "../sales/sales.service";
import { CatalogService } from "../catalog/catalog.service";
import { InventoryService } from "../inventory/inventory.service";
import { RolesService } from "../roles/roles.service";

export type IdempotentPushResult = {
  accepted: boolean;
  replayed: boolean;
  conflict?: {
    changeId: string;
    entityType: string;
    entityId: string;
    code: ConflictCode;
    message?: string;
  };
};

/**
 * Pure idempotency decision for a sync change against an existing SyncChange row.
 * Extracted for unit testing.
 */
export function decideSyncIdempotency(
  existing: { payloadHash: string | null } | null | undefined,
  incomingPayloadHash: string,
): "accept_new" | "replay" | "hash_mismatch" {
  if (!existing) return "accept_new";
  if (
    existing.payloadHash &&
    existing.payloadHash !== incomingPayloadHash
  ) {
    return "hash_mismatch";
  }
  return "replay";
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload ?? null))
    .digest("hex");
}

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sales: SalesService,
    private readonly catalog: CatalogService,
    private readonly inventory: InventoryService,
    private readonly roles: RolesService,
  ) {}

  async push(
    tenantId: string,
    userId: string,
    rawEnvelope: unknown,
  ): Promise<SyncPushAck & { authzVersion: number }> {
    const parsed = SyncEnvelopeSchema.safeParse(rawEnvelope);
    if (!parsed.success) {
      throw new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Invalid SyncEnvelope",
        details: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
          code: i.code,
        })),
      });
    }

    const envelope: SyncEnvelope = parsed.data;

    if (envelope.tenantId !== tenantId) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Envelope tenant does not match session",
      });
    }

    if (!isSupportedProtocolVersion(envelope.protocolVersion)) {
      throw new UnprocessableEntityException({
        code: "SYNC_CONFLICT",
        message: "Unsupported protocol version",
      });
    }

    const device = await this.prisma.device.findFirst({
      where: { id: envelope.deviceId, tenantId },
    });
    if (!device) {
      throw new ForbiddenException({
        code: "DEVICE_DISABLED",
        message: "Device not registered",
      });
    }
    if (device.status === "disabled") {
      throw new ForbiddenException({
        code: "DEVICE_DISABLED",
        message: "Device is disabled",
      });
    }

    const acceptedChangeIds: string[] = [];
    const conflicts: SyncPushAck["conflicts"] = [];

    for (const change of envelope.changes) {
      const result = await this.applyChangeIdempotent(
        tenantId,
        envelope.deviceId,
        userId,
        change,
      );
      if (result.accepted || result.replayed) {
        acceptedChangeIds.push(change.changeId);
      } else if (result.conflict) {
        conflicts.push(result.conflict);
      }
    }

    await this.prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    const serverSeq = await this.prisma.syncChange.count({
      where: { tenantId },
    });
    const authzVersion = await this.roles.getAuthzVersion(tenantId);

    return {
      acceptedChangeIds,
      conflicts,
      serverSeq,
      authzVersion,
    };
  }

  /**
   * Idempotent apply: unique on changeId via SyncChange table.
   */
  async applyChangeIdempotent(
    tenantId: string,
    deviceId: string,
    userId: string,
    change: SyncChange,
  ): Promise<IdempotentPushResult> {
    const payloadHash = hashPayload(change.payload);
    const existing = await this.prisma.syncChange.findUnique({
      where: { changeId: change.changeId },
    });

    const decision = decideSyncIdempotency(existing, payloadHash);

    if (decision === "replay") {
      return { accepted: true, replayed: true };
    }

    if (decision === "hash_mismatch") {
      return {
        accepted: false,
        replayed: false,
        conflict: {
          changeId: change.changeId,
          entityType: change.entityType,
          entityId: change.entityId,
          code: ConflictCode.PayloadHashMismatch,
          message: "changeId reused with different payload",
        },
      };
    }

    try {
      await this.applyEntityChange(tenantId, userId, deviceId, change);

      await this.prisma.syncChange.create({
        data: {
          changeId: change.changeId,
          tenantId,
          deviceId,
          entityType: change.entityType,
          entityId: change.entityId,
          version: change.version,
          payloadHash,
        },
      });

      return { accepted: true, replayed: false };
    } catch (err) {
      // Race on unique changeId
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        const again = await this.prisma.syncChange.findUnique({
          where: { changeId: change.changeId },
        });
        const d2 = decideSyncIdempotency(again, payloadHash);
        if (d2 === "replay") {
          return { accepted: true, replayed: true };
        }
        return {
          accepted: false,
          replayed: false,
          conflict: {
            changeId: change.changeId,
            entityType: change.entityType,
            entityId: change.entityId,
            code: ConflictCode.PayloadHashMismatch,
          },
        };
      }

      const message = err instanceof Error ? err.message : "Apply failed";
      await this.prisma.syncConflict.create({
        data: {
          tenantId,
          deviceId,
          entityType: change.entityType,
          entityId: change.entityId,
          reason: ConflictCode.ValidationFailed,
          payload: change as unknown as object,
        },
      });

      return {
        accepted: false,
        replayed: false,
        conflict: {
          changeId: change.changeId,
          entityType: change.entityType,
          entityId: change.entityId,
          code: ConflictCode.ValidationFailed,
          message,
        },
      };
    }
  }

  private async applyEntityChange(
    tenantId: string,
    userId: string,
    deviceId: string,
    change: SyncChange,
  ): Promise<void> {
    const payload = (change.payload ?? {}) as Record<string, unknown>;

    switch (change.entityType) {
      case "sale": {
        await this.sales.create(tenantId, userId, {
          id: change.entityId,
          branchId: String(payload.branchId),
          warehouseId: payload.warehouseId
            ? String(payload.warehouseId)
            : undefined,
          deviceId,
          customerId: payload.customerId
            ? String(payload.customerId)
            : undefined,
          receiptNumber: payload.receiptNumber
            ? String(payload.receiptNumber)
            : undefined,
          occurredAt: change.occurredAt,
          discountMinor:
            typeof payload.discountMinor === "number"
              ? payload.discountMinor
              : undefined,
          currency: payload.currency ? String(payload.currency) : undefined,
          items: (payload.items as never) ?? [],
          payments: (payload.payments as never) ?? [],
        });
        break;
      }
      case "product": {
        if (change.op === "upsert") {
          const existing = await this.prisma.product.findFirst({
            where: { id: change.entityId, tenantId },
          });
          if (existing) {
            await this.catalog.updateProduct(
              tenantId,
              change.entityId,
              {
                name: payload.name as string | undefined,
                priceMinor: payload.priceMinor as number | undefined,
                barcode: payload.barcode as string | null | undefined,
                status: payload.status as string | undefined,
                version: change.baseVersion,
              },
              userId,
            );
          } else {
            await this.catalog.createProduct(
              tenantId,
              {
                id: change.entityId,
                sku: String(payload.sku),
                name: String(payload.name),
                barcode: payload.barcode
                  ? String(payload.barcode)
                  : undefined,
                priceMinor: Number(payload.priceMinor ?? 0),
                costMinor:
                  typeof payload.costMinor === "number"
                    ? payload.costMinor
                    : undefined,
                taxRateBps:
                  typeof payload.taxRateBps === "number"
                    ? payload.taxRateBps
                    : undefined,
                categoryId: payload.categoryId
                  ? String(payload.categoryId)
                  : undefined,
                brandId: payload.brandId
                  ? String(payload.brandId)
                  : undefined,
                unitId: payload.unitId ? String(payload.unitId) : undefined,
              },
              userId,
            );
          }
        }
        break;
      }
      case "stock_movement": {
        await this.inventory.createMovement(
          tenantId,
          {
            id: change.entityId,
            warehouseId: String(payload.warehouseId),
            productId: String(payload.productId),
            branchId: String(payload.branchId),
            type: String(payload.type ?? "adjustment"),
            quantityDelta: Number(payload.quantityDelta),
            reason: payload.reason ? String(payload.reason) : undefined,
            deviceId,
            referenceType: payload.referenceType
              ? String(payload.referenceType)
              : undefined,
            referenceId: payload.referenceId
              ? String(payload.referenceId)
              : undefined,
          },
          userId,
        );
        break;
      }
      default:
        // Acknowledge unknown entity types as accepted storage-only markers
        // so devices can progress; mark conflict for visibility
        throw new Error(`Unknown entity type: ${change.entityType}`);
    }
  }

  async pull(
    tenantId: string,
    deviceId: string,
    input: { serverSeq: number; limit?: number; entityTypes?: string[] },
  ) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, tenantId },
    });
    if (!device || device.status === "disabled") {
      throw new ForbiddenException({
        code: "DEVICE_DISABLED",
        message: "Device disabled or missing",
      });
    }

    const limit = Math.min(input.limit ?? 200, 500);

    // Cursor = acceptedAt order approximated via sync_changes count offset
    // Using created acceptedAt + skip by serverSeq count
    const rows = await this.prisma.syncChange.findMany({
      where: {
        tenantId,
        ...(input.entityTypes?.length
          ? { entityType: { in: input.entityTypes } }
          : {}),
      },
      orderBy: { acceptedAt: "asc" },
      skip: Math.max(0, input.serverSeq),
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const serverSeq = input.serverSeq + slice.length;

    const changes = slice.map((row) => ({
      changeId: row.changeId,
      entityType: row.entityType,
      entityId: row.entityId,
      op: "upsert" as const,
      version: row.version,
      payload: {},
      occurredAt: row.acceptedAt.toISOString(),
      actorUserId: "00000000-0000-0000-0000-000000000000",
    }));

    await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        lastSeenAt: new Date(),
        syncCursor: { serverSeq },
      },
    });

    return { changes, serverSeq, hasMore };
  }

  async status(tenantId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, tenantId },
    });
    if (!device) {
      throw new ForbiddenException({
        code: "NOT_FOUND",
        message: "Device not found",
      });
    }

    const [acceptedCount, openConflicts] = await Promise.all([
      this.prisma.syncChange.count({ where: { tenantId, deviceId } }),
      this.prisma.syncConflict.count({
        where: { tenantId, deviceId, resolvedAt: null },
      }),
    ]);

    return {
      deviceId: device.id,
      status: device.status,
      lastSeenAt: device.lastSeenAt,
      syncCursor: device.syncCursor,
      acceptedCount,
      openConflicts,
    };
  }
}
