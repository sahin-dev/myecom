import { Injectable } from "@nestjs/common";
import {
  CreateDeliveryRateDto,
  CreateDeliveryZoneDto,
  UpdateDeliveryRateDto,
  UpdateDeliveryZoneDto
} from "./ecommerce.dto";
import { PrismaService } from "../prisma/prisma.service";

const cleanCode = (value?: string | null) =>
  (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

const compactStrings = (values?: string[]) =>
  Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));

@Injectable()
export class DeliverySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createDeliveryZone(dto: CreateDeliveryZoneDto) {
    return this.prisma.deliveryZone.create({
      data: {
        name: dto.name.trim(),
        code: cleanCode(dto.code || dto.name),
        city: dto.city?.trim() || null,
        areas: compactStrings(dto.areas),
        postalCodes: compactStrings(dto.postalCodes),
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true
      },
      include: { rates: { include: { deliveryMethod: true } } }
    });
  }

  async updateDeliveryZone(id: string, dto: UpdateDeliveryZoneDto) {
    return this.prisma.deliveryZone.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code === undefined ? undefined : cleanCode(dto.code),
        city: dto.city === undefined ? undefined : dto.city.trim() || null,
        areas: dto.areas === undefined ? undefined : compactStrings(dto.areas),
        postalCodes: dto.postalCodes === undefined ? undefined : compactStrings(dto.postalCodes),
        isActive: dto.isActive,
        priority: dto.priority
      },
      include: { rates: { include: { deliveryMethod: true } } }
    });
  }

  async deleteDeliveryZone(id: string) {
    await this.prisma.deliveryRate.deleteMany({ where: { zoneId: id } });
    await this.prisma.deliveryZone.delete({ where: { id } });
    return { deleted: true };
  }

  async createDeliveryRate(dto: CreateDeliveryRateDto) {
    return this.prisma.deliveryRate.create({
      data: {
        zoneId: dto.zoneId,
        deliveryMethodId: dto.deliveryMethodId,
        baseFee: dto.baseFee ?? 0,
        freeThreshold: dto.freeThreshold,
        minOrder: dto.minOrder ?? 0,
        maxOrder: dto.maxOrder,
        minDeliveryDays: dto.minDeliveryDays,
        maxDeliveryDays: dto.maxDeliveryDays,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true
      },
      include: { zone: true, deliveryMethod: true }
    });
  }

  async updateDeliveryRate(id: string, dto: UpdateDeliveryRateDto) {
    return this.prisma.deliveryRate.update({
      where: { id },
      data: {
        zoneId: dto.zoneId,
        deliveryMethodId: dto.deliveryMethodId,
        baseFee: dto.baseFee,
        freeThreshold: dto.freeThreshold,
        minOrder: dto.minOrder,
        maxOrder: dto.maxOrder,
        minDeliveryDays: dto.minDeliveryDays,
        maxDeliveryDays: dto.maxDeliveryDays,
        priority: dto.priority,
        isActive: dto.isActive
      },
      include: { zone: true, deliveryMethod: true }
    });
  }

  async deleteDeliveryRate(id: string) {
    await this.prisma.deliveryRate.delete({ where: { id } });
    return { deleted: true };
  }
}
