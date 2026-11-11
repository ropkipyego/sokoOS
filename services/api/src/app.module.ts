import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { RequestIdInterceptor } from "./common/interceptors/request-id.interceptor";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { TenantContext } from "./common/tenant-context";
import { TenantsModule } from "./tenants/tenants.module";
import { BranchesModule } from "./branches/branches.module";
import { UsersModule } from "./users/users.module";
import { RolesModule } from "./roles/roles.module";
import { CatalogModule } from "./catalog/catalog.module";
import { InventoryModule } from "./inventory/inventory.module";
import { SalesModule } from "./sales/sales.module";
import { ReturnsModule } from "./returns/returns.module";
import { CustomersModule } from "./customers/customers.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { PurchasesModule } from "./purchases/purchases.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { SyncModule } from "./sync/sync.module";
import { ReportsModule } from "./reports/reports.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AuditModule } from "./audit/audit.module";
import { HealthModule } from "./health/health.module";
import { RedisModule } from "./redis/redis.module";
import { QueuesModule } from "./queues/queues.module";
import { MediaModule } from "./media/media.module";
import { DeliveriesModule } from "./deliveries/deliveries.module";
import { MessagesModule } from "./messages/messages.module";
import { DiningModule } from "./dining/dining.module";
import { PlatformModule } from "./platform/platform.module";
import { DepartmentsModule } from "./departments/departments.module";
import { RestaurantModule } from "./restaurant/restaurant.module";
import { HotelModule } from "./hotel/hotel.module";
import { IndustryModule } from "./industry/industry.module";
import { TenantConfigModule } from "./config/tenant-config.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { HardwareModule } from "./hardware/hardware.module";
import { ShiftsModule } from "./shifts/shifts.module";
import { DomainsModule } from "./domains/domains.module";
import { LifecycleModule } from "./lifecycle/lifecycle.module";
import { EmailModule } from "./email/email.module";
import { BillingModule } from "./billing/billing.module";
import { SupportModule } from "./support/support.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get("THROTTLE_TTL_MS", 60_000)),
          limit: Number(config.get("THROTTLE_LIMIT", 600)),
        },
      ],
    }),
    PrismaModule,
    RedisModule,
    QueuesModule.forRoot(),
    AuthModule,
    TenantsModule,
    BranchesModule,
    UsersModule,
    RolesModule,
    CatalogModule,
    InventoryModule,
    SalesModule,
    ReturnsModule,
    CustomersModule,
    SuppliersModule,
    PurchasesModule,
    ExpensesModule,
    SyncModule,
    ReportsModule,
    NotificationsModule,
    AuditModule,
    HealthModule,
    MediaModule,
    DeliveriesModule,
    MessagesModule,
    DiningModule,
    PlatformModule,
    DepartmentsModule,
    RestaurantModule,
    HotelModule,
    IndustryModule,
    TenantConfigModule,
    IntegrationsModule,
    HardwareModule,
    ShiftsModule,
    DomainsModule,
    LifecycleModule,
    EmailModule,
    BillingModule,
    SupportModule,
  ],
  providers: [
    TenantContext,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
