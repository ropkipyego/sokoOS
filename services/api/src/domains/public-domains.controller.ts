import { Controller, Get, Headers, Query, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { DomainsService } from "./domains.service";

@Controller("public")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PublicDomainsController {
  constructor(private readonly domains: DomainsService) {}

  /**
   * Resolve a hostname to a tenant candidate.
   * Query `host` preferred; else `X-SokoOS-Host`; else request Host.
   * Never grants access — UX / login binding only.
   */
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get("resolve-host")
  async resolve(
    @Query("host") hostQuery: string | undefined,
    @Headers("x-sokoos-host") sokoHost: string | undefined,
    @Headers("host") httpHost: string | undefined,
    @Req() req: Request,
  ) {
    const host =
      hostQuery?.trim() ||
      sokoHost?.trim() ||
      (typeof req.headers.host === "string" ? req.headers.host : undefined) ||
      httpHost;
    const data = await this.domains.resolveHost(host);
    return { data };
  }
}
