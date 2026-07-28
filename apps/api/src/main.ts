import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { resolve } from "node:path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>("PORT") ?? 4000;
  const allowedOrigins = (
    config.get<string>("WEB_ORIGINS") ??
    "http://localhost:3000,http://127.0.0.1:3000,https://hqwwvtcz-3000.inc1.devtunnels.ms"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const uploadDir = resolve(process.cwd(), config.get<string>("UPLOAD_DIR") ?? "uploads");

  app.enableCors({
    origin: allowedOrigins,
    credentials: true
  });
  app.setGlobalPrefix("api");
  app.useStaticAssets(uploadDir, {
    prefix: "/uploads/"
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );

  await app.listen(port);

  let isClosing = false;
  const shutdown = async () => {
    if (isClosing) return;
    isClosing = true;

    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

bootstrap();
