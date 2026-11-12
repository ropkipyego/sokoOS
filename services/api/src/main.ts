import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger, RequestMethod } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const config = app.get(ConfigService);
  const corsOrigins = config
    .get<string>("CORS_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return cb(null, true);
      if (corsOrigins.includes(origin)) return cb(null, true);
      if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      // Cloudflare quick tunnels for remote demos
      if (/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)) {
        return cb(null, true);
      }
      // Vercel preview + production demo frontends
      if (/^https:\/\/[a-z0-9-]+([.][a-z0-9-]+)*\.vercel\.app$/.test(origin)) {
        return cb(null, true);
      }
      // Vercel preview + production frontends for client demos
      if (/^https:\/\/[a-z0-9-]+(-[a-z0-9-]+)*\.vercel\.app$/.test(origin)) {
        return cb(null, true);
      }
      // Managed / custom tenant hosts (production + local *.localhost)
      const baseDomain = (config.get<string>("SOKOOS_BASE_DOMAIN") ?? "sokoos.com").replace(
        /\./g,
        "\\.",
      );
      if (
        new RegExp(`^https?:\\/\\/([a-z0-9-]+\\.)?${baseDomain}(:\\d+)?$`, "i").test(origin) ||
        /^https?:\/\/[a-z0-9-]+\.localhost(:\d+)?$/i.test(origin)
      ) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    credentials: true,
  });

  // Global /v1 prefix except health endpoints
  app.setGlobalPrefix("v1", {
    exclude: [
      { path: "health", method: RequestMethod.ALL },
      { path: "health/(.*)", method: RequestMethod.ALL },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const host = config.get<string>("API_HOST", "0.0.0.0");
  // Vercel containers route to PORT (default 80). Prefer platform PORT, then API_PORT, then local 3000.
  const onVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const port = Number(
    process.env.PORT ?? (onVercel ? 80 : undefined) ?? config.get("API_PORT") ?? 3000,
  );

  await app.listen(port, host);
  Logger.log(`SokoOS API listening on http://${host}:${port}`, "Bootstrap");
  Logger.log(`REST under /v1 — health at /health/live|/health/ready`, "Bootstrap");
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
