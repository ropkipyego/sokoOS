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
    origin: corsOrigins,
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
  const port = Number(config.get("API_PORT", 3000));

  await app.listen(port, host);
  Logger.log(`SokoOS API listening on http://${host}:${port}`, "Bootstrap");
  Logger.log(`REST under /v1 — health at /health/live|/health/ready`, "Bootstrap");
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
