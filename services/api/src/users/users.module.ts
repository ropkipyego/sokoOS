import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { RolesModule } from "../roles/roles.module";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [RolesModule, EmailModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
