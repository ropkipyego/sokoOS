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
