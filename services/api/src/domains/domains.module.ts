import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { DomainsService } from "./domains.service";
import { DomainsController } from "./domains.controller";
import { PublicDomainsController } from "./public-domains.controller";

@Module({
  imports: [PrismaModule],
  controllers: [DomainsController, PublicDomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
