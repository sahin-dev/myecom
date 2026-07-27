import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth/auth.controller";
import {
  AdminGuard,
  JwtAuthGuard,
  OptionalJwtAuthGuard
} from "./auth/auth.guards";
import { AuthService } from "./auth/auth.service";
import { AccessControlService } from "./auth/access-control.service";
import { EcommerceController } from "./ecommerce/ecommerce.controller";
import { EcommerceService } from "./ecommerce/ecommerce.service";
import { ExperienceController } from "./experience/experience.controller";
import { ExperienceService } from "./experience/experience.service";
import { PrismaService } from "./prisma/prisma.service";
import { UploadsController } from "./uploads/uploads.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [".env", "../../.env"],
      isGlobal: true
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET") ?? "development-only-change-me",
        signOptions: { expiresIn: "7d" }
      })
    })
  ],
  controllers: [AuthController, EcommerceController, ExperienceController, UploadsController],
  providers: [
    AuthService,
    AccessControlService,
    EcommerceService,
    ExperienceService,
    PrismaService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    AdminGuard
  ]
})
export class AppModule {}
