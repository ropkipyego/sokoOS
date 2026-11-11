import { Module } from "@nestjs/common";
import { SalesService } from "./sales.service";
import { SalesController } from "./sales.controller";
import { InventoryModule } from "../inventory/inventory.module";
import { TenantsModule } from "../tenants/tenants.module";
import { DiningModule } from "../dining/dining.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [InventoryModule, TenantsModule, DiningModule, BillingModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
