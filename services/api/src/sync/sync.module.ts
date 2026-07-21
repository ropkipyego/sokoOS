import { Module } from "@nestjs/common";
import { SyncService } from "./sync.service";
import { SyncController } from "./sync.controller";
import { SalesModule } from "../sales/sales.module";
import { CatalogModule } from "../catalog/catalog.module";
import { InventoryModule } from "../inventory/inventory.module";
import { RolesModule } from "../roles/roles.module";

@Module({
  imports: [SalesModule, CatalogModule, InventoryModule, RolesModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
