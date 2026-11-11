import { Controller, Get, Param, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { MediaService } from "./media.service";
import { Public } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Controller("media")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Public()
  @Get(":tenantId/:kind/:filename")
  serve(
    @Param("tenantId") tenantId: string,
    @Param("kind") kind: string,
    @Param("filename") filename: string,
    @Res() res: Response,
  ) {
    const relative = path.join(tenantId, kind, filename);
    const full = this.media.abs(relative);
    if (!full.startsWith(this.media.root) || !existsSync(full)) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Media not found" },
      });
    }
    return res.sendFile(full);
  }
}
