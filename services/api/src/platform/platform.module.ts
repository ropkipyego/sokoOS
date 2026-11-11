import { Module } from "@nestjs/common";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";
import { PlatformConsoleService } from "./platform-console.service";
import { PrismaModule } from "../prisma/prisma.module";
import { RolesModule } from "../roles/roles.module";
import { HealthModule } from "../health/health.module";

@Module({
  imports: [PrismaModule, RolesModule, HealthModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformConsoleService],
  exports: [PlatformService, PlatformConsoleService],
})
export class PlatformModule {}
