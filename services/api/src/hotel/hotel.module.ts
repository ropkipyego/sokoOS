import { Module } from "@nestjs/common";
import { HotelController } from "./hotel.controller";
import { HotelService } from "./hotel.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [HotelController],
  providers: [HotelService],
  exports: [HotelService],
})
export class HotelModule {}
