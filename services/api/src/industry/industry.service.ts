import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class IndustryService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Pharmacy batches ----
  listBatches(tenantId: string, productId?: string, expiringWithinDays?: number) {
    const expiryBefore =
      expiringWithinDays != null
        ? new Date(Date.now() + expiringWithinDays * 86400000)
        : undefined;
    return this.prisma.productBatch.findMany({
      where: {
        tenantId,
        ...(productId ? { productId } : {}),
        ...(expiryBefore
          ? { expiryDate: { lte: expiryBefore }, status: "active" }
          : {}),
      },
      include: { product: { select: { id: true, sku: true, name: true } } },
      orderBy: [{ expiryDate: "asc" }, { batchNumber: "asc" }],
      take: 500,
    });
  }

  createBatch(
    tenantId: string,
    input: {
      productId: string;
      batchNumber: string;
      expiryDate?: string;
      manufacturedAt?: string;
      quantityOnHand?: number;
      notes?: string;
    },
  ) {
    return this.prisma.productBatch.create({
      data: {
        tenantId,
        productId: input.productId,
        batchNumber: input.batchNumber.trim(),
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        manufacturedAt: input.manufacturedAt ? new Date(input.manufacturedAt) : null,
        quantityOnHand: input.quantityOnHand ?? 0,
        notes: input.notes,
      },
    });
  }

  async adjustBatchQty(tenantId: string, id: string, delta: number) {
    const batch = await this.prisma.productBatch.findFirst({ where: { id, tenantId } });
    if (!batch) throw new NotFoundException({ code: "NOT_FOUND", message: "Batch not found" });
    const next = batch.quantityOnHand + delta;
    if (next < 0) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "Insufficient batch quantity" });
    }
    return this.prisma.productBatch.update({
      where: { id },
      data: {
        quantityOnHand: next,
        status: next === 0 ? "depleted" : batch.status === "depleted" ? "active" : batch.status,
      },
    });
  }

  // ---- Prescriptions ----
  listPrescriptions(tenantId: string, status?: string) {
    return this.prisma.prescription.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: { items: { include: { product: { select: { sku: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async createPrescription(
    tenantId: string,
    userId: string,
    input: {
      patientName: string;
      patientPhone?: string;
      customerId?: string;
      prescriber?: string;
      rxNumber?: string;
      notes?: string;
      items: Array<{ productId: string; quantity: number; dosage?: string; instructions?: string }>;
    },
  ) {
    if (!input.items?.length) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "Prescription needs items" });
    }
    for (const item of input.items) {
      const p = await this.prisma.product.findFirst({ where: { id: item.productId, tenantId } });
      if (!p) throw new NotFoundException({ code: "NOT_FOUND", message: `Product ${item.productId} not found` });
    }
    return this.prisma.prescription.create({
      data: {
        tenantId,
        patientName: input.patientName,
        patientPhone: input.patientPhone,
        customerId: input.customerId,
        prescriber: input.prescriber,
        rxNumber: input.rxNumber,
        notes: input.notes,
        createdBy: userId,
        items: {
          create: input.items.map((i) => ({
            tenantId,
            productId: i.productId,
            quantity: i.quantity,
            dosage: i.dosage,
            instructions: i.instructions,
          })),
        },
      },
      include: { items: true },
    });
  }

  async dispensePrescription(tenantId: string, id: string, saleId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const rx = await tx.prescription.findFirst({
        where: { id, tenantId },
        include: { items: true },
      });
      if (!rx) throw new NotFoundException({ code: "NOT_FOUND", message: "Prescription not found" });
      if (rx.status !== "open") {
        throw new ConflictException({ code: "CONFLICT", message: "Prescription not open" });
      }
      // FEFO: allocate earliest-expiry active batch per line when available
      for (const item of rx.items) {
        const batch = await tx.productBatch.findFirst({
          where: {
            tenantId,
            productId: item.productId,
            status: "active",
            quantityOnHand: { gte: item.quantity },
          },
          orderBy: [{ expiryDate: "asc" }],
        });
        if (batch) {
          const next = batch.quantityOnHand - item.quantity;
          await tx.productBatch.update({
            where: { id: batch.id },
            data: { quantityOnHand: next, status: next === 0 ? "depleted" : "active" },
          });
          await tx.prescriptionItem.update({
            where: { id: item.id },
            data: { batchId: batch.id },
          });
        }
      }
      return tx.prescription.update({
        where: { id },
        data: { status: "dispensed", saleId: saleId ?? rx.saleId },
        include: { items: true },
      });
    });
  }

  // ---- Wholesale price lists ----
  listPriceLists(tenantId: string) {
    return this.prisma.priceList.findMany({
      where: { tenantId },
      include: { _count: { select: { items: true, customers: true } } },
      orderBy: { name: "asc" },
    });
  }

  createPriceList(tenantId: string, input: { code: string; name: string }) {
    return this.prisma.priceList.create({
      data: { tenantId, code: input.code.toUpperCase(), name: input.name },
    });
  }

  async upsertPriceListItem(
    tenantId: string,
    priceListId: string,
    input: { productId: string; priceMinor: number; minQuantity?: number },
  ) {
    const list = await this.prisma.priceList.findFirst({ where: { id: priceListId, tenantId } });
    if (!list) throw new NotFoundException({ code: "NOT_FOUND", message: "Price list not found" });
    const minQuantity = input.minQuantity ?? 1;
    return this.prisma.priceListItem.upsert({
      where: {
        priceListId_productId_minQuantity: {
          priceListId,
          productId: input.productId,
          minQuantity,
        },
      },
      create: {
        tenantId,
        priceListId,
        productId: input.productId,
        priceMinor: input.priceMinor,
        minQuantity,
      },
      update: { priceMinor: input.priceMinor },
    });
  }

  listPriceListItems(tenantId: string, priceListId: string) {
    return this.prisma.priceListItem.findMany({
      where: { tenantId, priceListId },
      include: { product: { select: { sku: true, name: true, priceMinor: true } } },
      orderBy: { minQuantity: "asc" },
    });
  }

  async assignCustomerPriceList(tenantId: string, customerId: string, priceListId: string | null) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) throw new NotFoundException({ code: "NOT_FOUND", message: "Customer not found" });
    if (priceListId) {
      const list = await this.prisma.priceList.findFirst({ where: { id: priceListId, tenantId } });
      if (!list) throw new NotFoundException({ code: "NOT_FOUND", message: "Price list not found" });
    }
    return this.prisma.customer.update({
      where: { id: customerId },
      data: { priceListId },
    });
  }

  async resolveCustomerPrice(tenantId: string, customerId: string | undefined, productId: string, qty: number) {
    if (!customerId) return null;
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { priceListId: true },
    });
    if (!customer?.priceListId) return null;
    const tiers = await this.prisma.priceListItem.findMany({
      where: { tenantId, priceListId: customer.priceListId, productId, minQuantity: { lte: qty } },
      orderBy: { minQuantity: "desc" },
      take: 1,
    });
    return tiers[0]?.priceMinor ?? null;
  }

  // ---- Service jobs ----
  listServiceJobs(tenantId: string, status?: string) {
    return this.prisma.serviceJob.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
  }

  createServiceJob(
    tenantId: string,
    userId: string,
    input: {
      branchId: string;
      title: string;
      description?: string;
      customerId?: string;
      priority?: number;
      dueAt?: string;
    },
  ) {
    return this.prisma.serviceJob.create({
      data: {
        tenantId,
        branchId: input.branchId,
        title: input.title,
        description: input.description,
        customerId: input.customerId,
        priority: input.priority ?? 0,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        createdBy: userId,
      },
    });
  }

  async updateServiceJobStatus(tenantId: string, id: string, status: string) {
    const allowed = new Set([
      "open",
      "in_progress",
      "waiting_parts",
      "done",
      "cancelled",
      "invoiced",
    ]);
    if (!allowed.has(status)) {
      throw new BadRequestException({ code: "VALIDATION_FAILED", message: "Invalid job status" });
    }
    const job = await this.prisma.serviceJob.findFirst({ where: { id, tenantId } });
    if (!job) throw new NotFoundException({ code: "NOT_FOUND", message: "Job not found" });
    return this.prisma.serviceJob.update({
      where: { id },
      data: {
        status,
        completedAt: status === "done" || status === "invoiced" ? new Date() : job.completedAt,
      },
    });
  }
}
