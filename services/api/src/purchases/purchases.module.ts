import { Module } from "@nestjs/common";
import { PurchasesService } from "./purchases.service";
import { PurchasesController } from "./purchases.controller";
import { InventoryModule } from "../inventory/inventory.module";
import { TenantsModule } from "../tenants/tenants.module";

@Module({
  imports: [InventoryModule, TenantsModule],
  controllers: [PurchasesController],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
