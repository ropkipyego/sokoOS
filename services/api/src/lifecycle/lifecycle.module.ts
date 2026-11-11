import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailModule } from "../email/email.module";
import { RegistrationService } from "./registration.service";
import { ProvisioningService } from "./provisioning.service";
import { LifecycleService } from "./lifecycle.service";
import { LifecycleController } from "./lifecycle.controller";

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [LifecycleController],
  providers: [RegistrationService, ProvisioningService, LifecycleService],
  exports: [RegistrationService, ProvisioningService, LifecycleService],
})
export class LifecycleModule {}
