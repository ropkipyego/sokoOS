import { Controller, Get, Res, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../common/decorators/permissions.decorator";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get("live")
  live() {
    return this.health.live();
  }

  @Public()
  @Get("ready")
  async ready(@Res() res: Response) {
    const body = await this.health.ready();
    const status =
      body.status === "ok" ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(status).json(body);
  }
}
