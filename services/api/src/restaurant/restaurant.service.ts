import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RestaurantService {
  constructor(private readonly prisma: PrismaService) {}

  listRecipes(tenantId: string, productId: string) {
    return this.prisma.productRecipeLine.findMany({
      where: { tenantId, parentProductId: productId },
      include: {
        ingredient: { select: { id: true, sku: true, name: true, unitId: true } },
      },
    });
  }

  async setRecipe(
    tenantId: string,
    parentProductId: string,
    lines: Array<{ ingredientProductId: string; quantity: number; unitLabel?: string }>,
  ) {
    const parent = await this.prisma.product.findFirst({ where: { id: parentProductId, tenantId } });
    if (!parent) throw new NotFoundException({ code: "NOT_FOUND", message: "Product not found" });
    if (parent.itemType !== "prepared" && parent.itemType !== "composite") {
      await this.prisma.product.update({
        where: { id: parentProductId },
        data: { itemType: "prepared", trackInventory: false },
      });
    }
    await this.prisma.productRecipeLine.deleteMany({ where: { tenantId, parentProductId } });
    if (!lines.length) return [];
    await this.prisma.productRecipeLine.createMany({
      data: lines.map((l) => ({
        tenantId,
        parentProductId,
        ingredientProductId: l.ingredientProductId,
        quantity: l.quantity,
        unitLabel: l.unitLabel,
      })),
    });
    return this.listRecipes(tenantId, parentProductId);
  }

  listModifierGroups(tenantId: string, productId: string) {
    return this.prisma.productModifierGroup.findMany({
      where: { tenantId, productId },
      include: { modifiers: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });
  }

  async upsertModifierGroup(
    tenantId: string,
    productId: string,
    input: {
      id?: string;
      name: string;
      minSelect?: number;
      maxSelect?: number;
      required?: boolean;
      sortOrder?: number;
      modifiers?: Array<{ id?: string; name: string; priceMinor?: number; sortOrder?: number }>;
    },
  ) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundException({ code: "NOT_FOUND", message: "Product not found" });

    const group = input.id
      ? await this.prisma.productModifierGroup.update({
          where: { id: input.id },
          data: {
            name: input.name,
            minSelect: input.minSelect ?? 0,
            maxSelect: input.maxSelect ?? 1,
            required: input.required ?? false,
            sortOrder: input.sortOrder ?? 0,
          },
        })
      : await this.prisma.productModifierGroup.create({
          data: {
            tenantId,
            productId,
            name: input.name,
            minSelect: input.minSelect ?? 0,
            maxSelect: input.maxSelect ?? 1,
            required: input.required ?? false,
            sortOrder: input.sortOrder ?? 0,
          },
        });

    if (input.modifiers) {
      await this.prisma.productModifier.deleteMany({ where: { groupId: group.id, tenantId } });
      if (input.modifiers.length) {
        await this.prisma.productModifier.createMany({
          data: input.modifiers.map((m, i) => ({
            tenantId,
            groupId: group.id,
            name: m.name,
            priceMinor: m.priceMinor ?? 0,
            sortOrder: m.sortOrder ?? i,
          })),
        });
      }
    }
    return this.listModifierGroups(tenantId, productId);
  }

  listKitchenTickets(
    tenantId: string,
    opts: { branchId?: string; status?: string; departmentId?: string } = {},
  ) {
    const statuses = opts.status
      ? opts.status.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    return this.prisma.kitchenTicket.findMany({
      where: {
        tenantId,
        ...(opts.branchId ? { branchId: opts.branchId } : {}),
        ...(statuses.length === 1
          ? { status: statuses[0] }
          : statuses.length > 1
            ? { status: { in: statuses } }
            : {}),
        ...(opts.departmentId ? { departmentId: opts.departmentId } : {}),
      },
      include: {
        items: true,
        sale: { select: { id: true, receiptNumber: true, orderType: true, tableCode: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 100,
    });
  }

  async updateTicketStatus(tenantId: string, id: string, status: string) {
    const allowed = new Set(["queued", "preparing", "ready", "served", "cancelled"]);
    if (!allowed.has(status)) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "Invalid ticket status" });
    }
    const ticket = await this.prisma.kitchenTicket.findFirst({ where: { id, tenantId } });
    if (!ticket) throw new NotFoundException({ code: "NOT_FOUND", message: "Ticket not found" });
    return this.prisma.kitchenTicket.update({
      where: { id },
      data: { status },
      include: { items: true },
    });
  }

  async updateTicketItemStatus(tenantId: string, ticketId: string, itemId: string, status: string) {
    const item = await this.prisma.kitchenTicketItem.findFirst({
      where: { id: itemId, ticketId, tenantId },
    });
    if (!item) throw new NotFoundException({ code: "NOT_FOUND", message: "Ticket item not found" });
    return this.prisma.kitchenTicketItem.update({
      where: { id: itemId },
      data: { status },
    });
  }
}
