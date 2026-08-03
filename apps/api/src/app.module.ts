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
import { CourierAdapterResolver } from "./ecommerce/courier-adapter.service";
import { EcommerceService } from "./ecommerce/ecommerce.service";
import { CourierAdminService } from "./ecommerce/courier-admin.service";
import { DeliverySettingsService } from "./ecommerce/delivery-settings.service";
import { PaymentSettingsService } from "./ecommerce/payment-settings.service";
import { ExperienceController } from "./experience/experience.controller";
import { ExperienceService } from "./experience/experience.service";
import { PrismaService } from "./prisma/prisma.service";
import { UploadsController } from "./uploads/uploads.controller";
import { PaymentsController } from "./payments/payments.controller";
import { BkashService } from "./payments/bkash.service";
import { PaymentStrategyResolver } from "./payments/payment-strategy.service";
import { MailService } from "./mail/mail.service";

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
  controllers: [
    AuthController,
    EcommerceController,
    ExperienceController,
    UploadsController,
    PaymentsController
  ],
  providers: [
    AuthService,
    AccessControlService,
    EcommerceService,
    CourierAdapterResolver,
    CourierAdminService,
    DeliverySettingsService,
    PaymentSettingsService,
    ExperienceService,
    PrismaService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    AdminGuard,
    BkashService,
    PaymentStrategyResolver,
    MailService
  ]
})
export class AppModule {}
