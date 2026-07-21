import { Module } from "@nestjs/common";
import { ReturnsService } from "./returns.service";
import { ReturnsController } from "./returns.controller";
import { InventoryModule } from "../inventory/inventory.module";
import { TenantsModule } from "../tenants/tenants.module";

@Module({
  imports: [InventoryModule, TenantsModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
