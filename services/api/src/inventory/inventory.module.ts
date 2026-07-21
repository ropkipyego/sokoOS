import { Module } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { InventoryController } from "./inventory.controller";
import { TenantsModule } from "../tenants/tenants.module";

@Module({
  imports: [TenantsModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
