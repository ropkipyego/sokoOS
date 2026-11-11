import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HotelService {
  constructor(private readonly prisma: PrismaService) {}

  listRoomTypes(tenantId: string) {
    return this.prisma.roomType.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  }

  createRoomType(
    tenantId: string,
    input: { code: string; name: string; description?: string; baseRateMinor: number; maxOccupancy?: number },
  ) {
    return this.prisma.roomType.create({
      data: {
        tenantId,
        code: input.code.toUpperCase(),
        name: input.name,
        description: input.description,
        baseRateMinor: input.baseRateMinor,
        maxOccupancy: input.maxOccupancy ?? 2,
      },
    });
  }

  listRooms(tenantId: string, branchId?: string) {
    return this.prisma.room.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      include: { roomType: true },
      orderBy: { code: "asc" },
    });
  }

  createRoom(
    tenantId: string,
    input: {
      branchId: string;
      roomTypeId: string;
      code: string;
      floor?: string;
      departmentId?: string;
    },
  ) {
    return this.prisma.room.create({
      data: {
        tenantId,
        branchId: input.branchId,
        roomTypeId: input.roomTypeId,
        code: input.code.toUpperCase(),
        floor: input.floor,
        departmentId: input.departmentId,
        status: "available",
      },
    });
  }

  async setRoomStatus(tenantId: string, id: string, status: string) {
    const allowed = new Set([
      "available",
      "occupied",
      "dirty",
      "cleaning",
      "maintenance",
      "out_of_service",
    ]);
    if (!allowed.has(status)) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "Invalid room status" });
    }
    const room = await this.prisma.room.findFirst({ where: { id, tenantId } });
    if (!room) throw new NotFoundException({ code: "NOT_FOUND", message: "Room not found" });
    return this.prisma.room.update({ where: { id }, data: { status } });
  }

  listReservations(tenantId: string, status?: string) {
    return this.prisma.reservation.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: { stays: true, folio: true },
      orderBy: { checkInDate: "asc" },
      take: 200,
    });
  }

  createReservation(
    tenantId: string,
    input: {
      branchId: string;
      guestName: string;
      guestPhone?: string;
      customerId?: string;
      roomTypeId?: string;
      checkInDate: string;
      checkOutDate: string;
      adults?: number;
      children?: number;
      notes?: string;
    },
  ) {
    const checkIn = new Date(input.checkInDate);
    const checkOut = new Date(input.checkOutDate);
    if (!(checkOut > checkIn)) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "checkOutDate must be after checkInDate",
      });
    }
    return this.prisma.reservation.create({
      data: {
        tenantId,
        branchId: input.branchId,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        customerId: input.customerId,
        roomTypeId: input.roomTypeId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: input.adults ?? 1,
        children: input.children ?? 0,
        notes: input.notes,
        status: "confirmed",
      },
    });
  }

  async checkIn(tenantId: string, reservationId: string, roomId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id: reservationId, tenantId },
      });
      if (!reservation) throw new NotFoundException({ code: "NOT_FOUND", message: "Reservation not found" });
      if (reservation.status === "cancelled") {
        throw new ConflictException({ code: "CONFLICT", message: "Reservation cancelled" });
      }

      const room = await tx.room.findFirst({ where: { id: roomId, tenantId } });
      if (!room) throw new NotFoundException({ code: "NOT_FOUND", message: "Room not found" });
      if (room.status === "occupied" || room.status === "out_of_service") {
        throw new ConflictException({ code: "CONFLICT", message: "Room not available" });
      }

      const active = await tx.stay.findFirst({
        where: { tenantId, roomId, status: "in_house" },
      });
      if (active) {
        throw new ConflictException({ code: "CONFLICT", message: "Room already has an in-house stay" });
      }

      const stay = await tx.stay.create({
        data: {
          tenantId,
          reservationId,
          roomId,
          checkedInAt: new Date(),
          status: "in_house",
        },
      });
      await tx.room.update({ where: { id: roomId }, data: { status: "occupied" } });
      await tx.reservation.update({ where: { id: reservationId }, data: { status: "checked_in" } });

      const folio = await tx.folio.create({
        data: {
          tenantId,
          reservationId,
          stayId: stay.id,
          customerId: reservation.customerId,
          guestName: reservation.guestName,
          status: "open",
          balanceMinor: 0,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: userId,
          action: "hotel.check_in",
          entityType: "stay",
          entityId: stay.id,
          metadata: { reservationId, roomId, folioId: folio.id },
        },
      });

      return { stay, folio, roomId };
    });
  }

  async checkOut(tenantId: string, stayId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const stay = await tx.stay.findFirst({ where: { id: stayId, tenantId } });
      if (!stay) throw new NotFoundException({ code: "NOT_FOUND", message: "Stay not found" });
      if (stay.status !== "in_house") {
        throw new ConflictException({ code: "CONFLICT", message: "Stay is not in-house" });
      }
      const folio = await tx.folio.findFirst({
        where: { tenantId, reservationId: stay.reservationId },
      });
      if (folio && folio.status === "open" && folio.balanceMinor > 0) {
        throw new ConflictException({
          code: "FOLIO_BALANCE",
          message: `Settle folio balance before checkout (${folio.balanceMinor} minor units outstanding)`,
        });
      }
      await tx.stay.update({
        where: { id: stayId },
        data: { status: "checked_out", checkedOutAt: new Date() },
      });
      await tx.room.update({ where: { id: stay.roomId }, data: { status: "dirty" } });
      await tx.reservation.update({
        where: { id: stay.reservationId },
        data: { status: "checked_out" },
      });
      if (folio && folio.status === "open") {
        await tx.folio.update({ where: { id: folio.id }, data: { status: "settled" } });
      }
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: userId,
          action: "hotel.check_out",
          entityType: "stay",
          entityId: stayId,
          metadata: {},
        },
      });
      return { ok: true };
    });
  }

  listFolios(tenantId: string, status?: string) {
    return this.prisma.folio.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: { charges: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /**
   * Post an existing sale onto a folio — never creates a second sale.
   * Unique saleId on FolioCharge prevents duplicates.
   */
  async postSaleToFolio(
    tenantId: string,
    folioId: string,
    saleId: string,
    authorizedById: string,
    description?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const folio = await tx.folio.findFirst({ where: { id: folioId, tenantId } });
      if (!folio) throw new NotFoundException({ code: "NOT_FOUND", message: "Folio not found" });
      if (folio.status !== "open") {
        throw new ConflictException({ code: "CONFLICT", message: "Folio is not open" });
      }
      const sale = await tx.sale.findFirst({ where: { id: saleId, tenantId } });
      if (!sale) throw new NotFoundException({ code: "NOT_FOUND", message: "Sale not found" });

      const existing = await tx.folioCharge.findUnique({ where: { saleId } });
      if (existing) return existing;

      const charge = await tx.folioCharge.create({
        data: {
          tenantId,
          folioId,
          saleId,
          departmentId: sale.departmentId,
          amountMinor: sale.totalMinor,
          description: description ?? `Sale ${sale.receiptNumber}`,
          authorizedById,
        },
      });
      await tx.folio.update({
        where: { id: folioId },
        data: { balanceMinor: { increment: sale.totalMinor } },
      });
      // Mark sale payment as room charge allocation without creating new sale revenue
      await tx.salePayment.create({
        data: {
          tenantId,
          saleId,
          method: "room_charge",
          amountMinor: 0,
          status: "posted_to_folio",
          reference: folioId,
        },
      });
      return charge;
    });
  }

  async settleFolio(
    tenantId: string,
    folioId: string,
    payment: { method: string; amountMinor: number; reference?: string },
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const folio = await tx.folio.findFirst({
        where: { id: folioId, tenantId },
        include: { charges: true },
      });
      if (!folio) throw new NotFoundException({ code: "NOT_FOUND", message: "Folio not found" });
      if (folio.status !== "open") {
        throw new ConflictException({ code: "CONFLICT", message: "Folio already settled" });
      }
      if (payment.amountMinor < folio.balanceMinor) {
        throw new BadRequestException({
          code: "VALIDATION_FAILED",
          message: "Payment does not cover folio balance",
        });
      }
      await tx.folio.update({
        where: { id: folioId },
        data: { status: "settled", balanceMinor: 0 },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: userId,
          action: "hotel.folio.settle",
          entityType: "folio",
          entityId: folioId,
          metadata: payment,
        },
      });
      return { ok: true, paidMinor: payment.amountMinor, method: payment.method };
    });
  }

  async occupancy(tenantId: string, branchId?: string) {
    const rooms = await this.prisma.room.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
    });
    const total = rooms.length;
    const occupied = rooms.filter((r) => r.status === "occupied").length;
    const available = rooms.filter((r) => r.status === "available").length;
    const ooo = rooms.filter((r) => r.status === "out_of_service" || r.status === "maintenance").length;
    return {
      total,
      occupied,
      available,
      outOfService: ooo,
      occupancyRate: total ? occupied / total : 0,
    };
  }
}
