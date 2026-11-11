import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { createPrismaClient, type PrismaClient } from "@sokoos/database";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClient = createPrismaClient(
    process.env.DATABASE_URL,
  );

  // Proxy Prisma model accessors for ergonomic usage
  get tenant() {
    return this.client.tenant;
  }
  get branch() {
    return this.client.branch;
  }
  get device() {
    return this.client.device;
  }
  get user() {
    return this.client.user;
  }
  get role() {
    return this.client.role;
  }
  get permission() {
    return this.client.permission;
  }
  get rolePermission() {
    return this.client.rolePermission;
  }
  get userRole() {
    return this.client.userRole;
  }
  get refreshToken() {
    return this.client.refreshToken;
  }
  get authzVersion() {
    return this.client.authzVersion;
  }
  get category() {
    return this.client.category;
  }
  get brand() {
    return this.client.brand;
  }
  get unit() {
    return this.client.unit;
  }
  get product() {
    return this.client.product;
  }
  get warehouse() {
    return this.client.warehouse;
  }
  get stockMovement() {
    return this.client.stockMovement;
  }
  get stockBalance() {
    return this.client.stockBalance;
  }
  get customer() {
    return this.client.customer;
  }
  get sale() {
    return this.client.sale;
  }
  get saleItem() {
    return this.client.saleItem;
  }
  get salePayment() {
    return this.client.salePayment;
  }
  get return() {
    return this.client.return;
  }
  get returnItem() {
    return this.client.returnItem;
  }
  get supplier() {
    return this.client.supplier;
  }
  get purchase() {
    return this.client.purchase;
  }
  get purchaseItem() {
    return this.client.purchaseItem;
  }
  get expense() {
    return this.client.expense;
  }
  get syncChange() {
    return this.client.syncChange;
  }
  get syncConflict() {
    return this.client.syncConflict;
  }
  get auditLog() {
    return this.client.auditLog;
  }
  get notification() {
    return this.client.notification;
  }
  get delivery() {
    return this.client.delivery;
  }
  get deliveryEvent() {
    return this.client.deliveryEvent;
  }
  get announcement() {
    return this.client.announcement;
  }
  get announcementRead() {
    return this.client.announcementRead;
  }
  get diningTable() {
    return this.client.diningTable;
  }
  get department() {
    return this.client.department;
  }
  get departmentMember() {
    return this.client.departmentMember;
  }
  get departmentDevice() {
    return this.client.departmentDevice;
  }
  get onboardingDraft() {
    return this.client.onboardingDraft;
  }
  get departmentProduct() {
    return this.client.departmentProduct;
  }
  get productRecipeLine() {
    return this.client.productRecipeLine;
  }
  get productModifierGroup() {
    return this.client.productModifierGroup;
  }
  get productModifier() {
    return this.client.productModifier;
  }
  get kitchenTicket() {
    return this.client.kitchenTicket;
  }
  get kitchenTicketItem() {
    return this.client.kitchenTicketItem;
  }
  get roomType() {
    return this.client.roomType;
  }
  get room() {
    return this.client.room;
  }
  get reservation() {
    return this.client.reservation;
  }
  get stay() {
    return this.client.stay;
  }
  get folio() {
    return this.client.folio;
  }
  get folioCharge() {
    return this.client.folioCharge;
  }
  get productBatch() {
    return this.client.productBatch;
  }
  get prescription() {
    return this.client.prescription;
  }
  get prescriptionItem() {
    return this.client.prescriptionItem;
  }
  get priceList() {
    return this.client.priceList;
  }
  get priceListItem() {
    return this.client.priceListItem;
  }
  get serviceJob() {
    return this.client.serviceJob;
  }
  get configSetting() {
    return this.client.configSetting;
  }
  get cashierShift() {
    return this.client.cashierShift;
  }
  get productSerial() {
    return this.client.productSerial;
  }
  get productSerialEvent() {
    return this.client.productSerialEvent;
  }
  get tenantDomain() {
    return this.client.tenantDomain;
  }
  get tenantDomainEvent() {
    return this.client.tenantDomainEvent;
  }
  get registrationRequest() {
    return this.client.registrationRequest;
  }
  get tenantInvitation() {
    return this.client.tenantInvitation;
  }
  get emailMessage() {
    return this.client.emailMessage;
  }
  get passwordResetToken() {
    return this.client.passwordResetToken;
  }
  get plan() {
    return this.client.plan;
  }
  get subscription() {
    return this.client.subscription;
  }
  get subscriptionInvoice() {
    return this.client.subscriptionInvoice;
  }
  get subscriptionPayment() {
    return this.client.subscriptionPayment;
  }
  get supportTicket() {
    return this.client.supportTicket;
  }
  get supportMessage() {
    return this.client.supportMessage;
  }
  get platformSetting() {
    return this.client.platformSetting;
  }

  get $transaction() {
    return this.client.$transaction.bind(this.client);
  }

  get $queryRaw() {
    return this.client.$queryRaw.bind(this.client);
  }

  get $executeRaw() {
    return this.client.$executeRaw.bind(this.client);
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log("Prisma connected");
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  /** Expose underlying client for advanced use (transactions with typed tx). */
  get raw(): PrismaClient {
    return this.client;
  }
}
