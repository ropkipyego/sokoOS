import { Module } from "@nestjs/common";
import { IndustryController } from "./industry.controller";
import { IndustryService } from "./industry.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [IndustryController],
  providers: [IndustryService],
  exports: [IndustryService],
})
export class IndustryModule {}
