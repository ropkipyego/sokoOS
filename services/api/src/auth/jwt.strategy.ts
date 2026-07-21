import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "../common/tenant-context";
import { PrismaService } from "../prisma/prisma.service";

export type JwtPayload = {
  sub: string;
  tenant_id: string | null;
  session_id: string;
  authz_version: number;
  device_id?: string;
  typ: "access";
  email: string;
  name: string;
  permissions: string[];
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>(
        "JWT_ACCESS_SECRET",
        "change-me-access-secret-min-32-chars",
      ),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.typ !== "access") {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Invalid token type",
      });
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, status: "active" },
    });
    if (!user) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "User not found or inactive",
      });
    }

    if (payload.tenant_id) {
      const authz = await this.prisma.authzVersion.findUnique({
        where: { tenantId: payload.tenant_id },
      });
      if (authz && authz.version !== payload.authz_version) {
        // Soft signal — still allow but client should refresh permissions
      }
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      tenantId: payload.tenant_id,
      sessionId: payload.session_id,
      authzVersion: payload.authz_version,
      deviceId: payload.device_id,
      permissions: payload.permissions ?? [],
    };
  }
}
