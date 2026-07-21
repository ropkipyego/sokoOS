import { Module } from "@nestjs/common";
import { SyncService } from "./sync.service";
import { SyncController } from "./sync.controller";
import { SyncGateway } from "./sync.gateway";
import { SyncFanoutPublisher } from "./sync-fanout.publisher";
import { SalesModule } from "../sales/sales.module";
import { CatalogModule } from "../catalog/catalog.module";
import { InventoryModule } from "../inventory/inventory.module";
import { RolesModule } from "../roles/roles.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    SalesModule,
    CatalogModule,
    InventoryModule,
    RolesModule,
    AuthModule,
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncGateway, SyncFanoutPublisher],
  exports: [SyncService, SyncGateway],
})
export class SyncModule {}
