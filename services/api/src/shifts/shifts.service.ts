import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, status?: string) {
    return this.prisma.cashierShift.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { openedAt: "desc" },
      take: 100,
    });
  }

  async open(
    tenantId: string,
    userId: string,
    input: { branchId: string; deviceId?: string; openingFloatMinor?: number },
  ) {
    const open = await this.prisma.cashierShift.findFirst({
      where: { tenantId, cashierUserId: userId, status: "open" },
    });
    if (open) {
      throw new ConflictException({ code: "CONFLICT", message: "Cashier already has an open shift" });
    }
    return this.prisma.cashierShift.create({
      data: {
        tenantId,
        branchId: input.branchId,
        deviceId: input.deviceId,
        cashierUserId: userId,
        openingFloatMinor: input.openingFloatMinor ?? 0,
        status: "open",
      },
    });
  }

  async close(
    tenantId: string,
    shiftId: string,
    userId: string,
    input: { closingCountedMinor: number; notes?: string },
  ) {
    const shift = await this.prisma.cashierShift.findFirst({
      where: { id: shiftId, tenantId },
    });
    if (!shift) throw new NotFoundException({ code: "NOT_FOUND", message: "Shift not found" });
    if (shift.status !== "open") {
      throw new ConflictException({ code: "CONFLICT", message: "Shift already closed" });
    }
    if (shift.cashierUserId !== userId) {
      // Managers with settings can close others — still allow if same tenant
    }
    if (input.closingCountedMinor < 0) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "Invalid counted cash" });
    }

    const payments = await this.prisma.salePayment.findMany({
      where: {
        tenantId,
        status: "completed",
        method: "cash",
        createdAt: { gte: shift.openedAt },
        sale: { cashierUserId: shift.cashierUserId, branchId: shift.branchId, status: "completed" },
      },
    });
    const cashSales = payments.reduce((s, p) => s + p.amountMinor, 0);
    const expected = shift.openingFloatMinor + cashSales;
    const variance = input.closingCountedMinor - expected;

    return this.prisma.cashierShift.update({
      where: { id: shiftId },
      data: {
        status: "closed",
        closedAt: new Date(),
        closingCountedMinor: input.closingCountedMinor,
        expectedCashMinor: expected,
        varianceMinor: variance,
        notes: input.notes,
      },
    });
  }

  async current(tenantId: string, userId: string) {
    return this.prisma.cashierShift.findFirst({
      where: { tenantId, cashierUserId: userId, status: "open" },
    });
  }
}
