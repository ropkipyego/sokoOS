import { Module } from "@nestjs/common";
import { SalesService } from "./sales.service";
import { SalesController } from "./sales.controller";
import { InventoryModule } from "../inventory/inventory.module";
import { TenantsModule } from "../tenants/tenants.module";

@Module({
  imports: [InventoryModule, TenantsModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
