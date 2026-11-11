import { Module } from "@nestjs/common";
import { DiningController, DiningTablesLegacyController } from "./dining.controller";
import { DiningService } from "./dining.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [DiningController, DiningTablesLegacyController],
  providers: [DiningService],
  exports: [DiningService],
})
export class DiningModule {}
