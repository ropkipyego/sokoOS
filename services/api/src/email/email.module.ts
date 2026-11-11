import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailService } from "./email.service";
import { InvitationsService } from "./invitations.service";
import { EmailController } from "./email.controller";

@Module({
  imports: [PrismaModule],
  controllers: [EmailController],
  providers: [EmailService, InvitationsService],
  exports: [EmailService, InvitationsService],
})
export class EmailModule {}
