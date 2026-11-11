import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HardwareService {
  constructor(private readonly prisma: PrismaService) {}

  listSerials(tenantId: string, opts: { productId?: string; status?: string; q?: string } = {}) {
    return this.prisma.productSerial.findMany({
      where: {
        tenantId,
        ...(opts.productId ? { productId: opts.productId } : {}),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.q
          ? { serialNumber: { contains: opts.q, mode: "insensitive" } }
          : {}),
      },
      include: {
        product: { select: { id: true, sku: true, name: true } },
        events: { orderBy: { createdAt: "desc" }, take: 20 },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  }

  async receiveSerial(
    tenantId: string,
    userId: string,
    input: {
      productId: string;
      serialNumber: string;
      warehouseId?: string;
      purchaseId?: string;
      warrantyMonths?: number;
      notes?: string;
    },
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, tenantId },
    });
    if (!product) throw new NotFoundException({ code: "NOT_FOUND", message: "Product not found" });
    const existing = await this.prisma.productSerial.findFirst({
      where: { tenantId, serialNumber: input.serialNumber },
    });
    if (existing) {
      throw new ConflictException({ code: "CONFLICT", message: "Serial already registered" });
    }
    return this.prisma.productSerial.create({
      data: {
        tenantId,
        productId: input.productId,
        serialNumber: input.serialNumber.trim(),
        status: "in_stock",
        warehouseId: input.warehouseId,
        purchaseId: input.purchaseId,
        warrantyMonths: input.warrantyMonths,
        notes: input.notes,
        events: {
          create: {
            tenantId,
            eventType: "received",
            referenceType: input.purchaseId ? "purchase" : null,
            referenceId: input.purchaseId,
            actorUserId: userId,
            note: "Received into inventory",
          },
        },
      },
      include: { events: true, product: true },
    });
  }

  async sellSerial(
    tenantId: string,
    userId: string,
    input: {
      serialNumber: string;
      saleId: string;
      customerId?: string;
      warrantyMonths?: number;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const serial = await tx.productSerial.findFirst({
        where: { tenantId, serialNumber: input.serialNumber },
      });
      if (!serial) throw new NotFoundException({ code: "NOT_FOUND", message: "Serial not found" });
      if (serial.status !== "in_stock") {
        throw new ConflictException({ code: "CONFLICT", message: `Serial is ${serial.status}` });
      }
      const sale = await tx.sale.findFirst({ where: { id: input.saleId, tenantId } });
      if (!sale) throw new NotFoundException({ code: "NOT_FOUND", message: "Sale not found" });

      const months = input.warrantyMonths ?? serial.warrantyMonths ?? 12;
      const starts = new Date();
      const ends = new Date(starts);
      ends.setMonth(ends.getMonth() + months);

      const updated = await tx.productSerial.update({
        where: { id: serial.id },
        data: {
          status: "sold",
          saleId: sale.id,
          customerId: input.customerId ?? sale.customerId,
          warrantyMonths: months,
          warrantyStartsAt: starts,
          warrantyEndsAt: ends,
          warehouseId: null,
        },
      });
      await tx.productSerialEvent.create({
        data: {
          tenantId,
          serialId: serial.id,
          eventType: "sold",
          referenceType: "sale",
          referenceId: sale.id,
          actorUserId: userId,
          note: `Warranty until ${ends.toISOString().slice(0, 10)}`,
        },
      });
      await tx.productSerialEvent.create({
        data: {
          tenantId,
          serialId: serial.id,
          eventType: "warranty_registered",
          referenceType: "sale",
          referenceId: sale.id,
          actorUserId: userId,
        },
      });
      return updated;
    });
  }

  async returnSerial(tenantId: string, userId: string, serialNumber: string, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const serial = await tx.productSerial.findFirst({
        where: { tenantId, serialNumber },
      });
      if (!serial) throw new NotFoundException({ code: "NOT_FOUND", message: "Serial not found" });
      if (serial.status !== "sold" && serial.status !== "repair") {
        throw new ConflictException({ code: "CONFLICT", message: "Serial cannot be returned from current status" });
      }
      const updated = await tx.productSerial.update({
        where: { id: serial.id },
        data: { status: "returned", saleId: serial.saleId },
      });
      await tx.productSerialEvent.create({
        data: {
          tenantId,
          serialId: serial.id,
          eventType: "returned",
          referenceType: "return",
          referenceId: serial.saleId,
          actorUserId: userId,
          note,
        },
      });
      return updated;
    });
  }

  async openRepair(tenantId: string, userId: string, serialNumber: string, note?: string) {
    const serial = await this.prisma.productSerial.findFirst({
      where: { tenantId, serialNumber },
    });
    if (!serial) throw new NotFoundException({ code: "NOT_FOUND", message: "Serial not found" });
    if (serial.status !== "sold" && serial.status !== "returned") {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "Repair only for sold/returned units" });
    }
    const updated = await this.prisma.productSerial.update({
      where: { id: serial.id },
      data: { status: "repair" },
    });
    await this.prisma.productSerialEvent.create({
      data: {
        tenantId,
        serialId: serial.id,
        eventType: "repair_opened",
        actorUserId: userId,
        note,
      },
    });
    return updated;
  }

  async closeRepair(tenantId: string, userId: string, serialNumber: string, restoreStatus: "sold" | "returned" = "sold") {
    const serial = await this.prisma.productSerial.findFirst({
      where: { tenantId, serialNumber },
    });
    if (!serial || serial.status !== "repair") {
      throw new ConflictException({ code: "CONFLICT", message: "Serial is not in repair" });
    }
    const updated = await this.prisma.productSerial.update({
      where: { id: serial.id },
      data: { status: restoreStatus },
    });
    await this.prisma.productSerialEvent.create({
      data: {
        tenantId,
        serialId: serial.id,
        eventType: "repair_closed",
        actorUserId: userId,
        note: `Restored to ${restoreStatus}`,
      },
    });
    return updated;
  }

  async history(tenantId: string, serialNumber: string) {
    const serial = await this.prisma.productSerial.findFirst({
      where: { tenantId, serialNumber },
      include: {
        product: true,
        events: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!serial) throw new NotFoundException({ code: "NOT_FOUND", message: "Serial not found" });
    return serial;
  }
}
