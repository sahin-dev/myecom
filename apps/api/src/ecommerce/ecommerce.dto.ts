import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested
} from "class-validator";
import {
  CheckoutMethodType,
  CourierProvider,
  CourierShipmentStatus,
  HomeSectionType,
  OrderStatus,
  PaymentGatewayProvider,
  PaymentStatus,
  ProductStatus
} from "@prisma/client";

export class AddressInfoDto {
  @IsString()
  recipient!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value ? String(value).trim().toLowerCase() : undefined)
  email?: string;

  @IsString()
  line1!: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CheckoutPolicyDto {
  @IsOptional()
  @IsBoolean()
  inheritPayment?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedPaymentCodes?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  requiredPaymentPercent?: number;

  @IsOptional()
  @IsBoolean()
  onlineOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  inheritDelivery?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedZoneCodes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedZoneCodes?: string[];
}

export class PlatformCheckoutPolicyDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedPaymentCodes?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  requiredPaymentPercent?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliverableZoneCodes?: string[];

  @IsOptional()
  @IsBoolean()
  requireKnownDeliveryArea?: boolean;
}

export class CreateBrandDto {
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  story?: string;
}

export class UpdateBrandDto {
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  story?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCategoryDto {
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateBannerDto {
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  eyebrow?: string;

  @IsString()
  title!: string;

  @IsString()
  subtitle!: string;

  @IsString()
  ctaLabel!: string;

  @IsString()
  ctaHref!: string;

  @IsString()
  @IsNotEmpty()
  imageUrl!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  focalX?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  focalY?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Promotional clips are referenced, never uploaded, so the URL has to be
 * trustworthy on its own: https only, and an extension the browser can
 * actually decode in a <video> element.
 *
 * .mov is deliberately excluded. The uploads pipeline accepts video/quicktime
 * for return proofs, but most browsers cannot play it — accepting one here
 * would store a URL that silently fails on the storefront.
 */
/*
 * Requiring a .mp4/.webm suffix turned out to be too strict: direct-file URLs
 * from Dropbox, R2 and Cloudflare Stream frequently carry no extension at all.
 * So the rule is inverted — allow any https URL, but reject the two forms that
 * are known not to play:
 *
 *   .mov          most browsers cannot decode QuickTime
 *   drive.google  Drive has no dependable direct video stream; its share link
 *                 is an HTML page and `uc?export` hits an interstitial. It is
 *                 fine for images (see normalizeMediaUrl) but not for video.
 */
export const PROMO_VIDEO_URL_PATTERN =
  /^https:\/\/(?!(?:drive|docs)\.google\.com\/)(?![^\s]*\.mov(?:[?#]|$))[^\s]+$/i;
export const PROMO_VIDEO_URL_MESSAGE =
  "Use a direct https link to the video file (.mp4 or .webm content). QuickTime (.mov) will not " +
  "play in most browsers, and Google Drive cannot serve video directly — upload the clip to " +
  "Dropbox, R2, or another host that returns the file itself.";

export class ProductDetailDto {
  @IsString()
  type!: string;

  @IsString()
  title!: string;

  @IsString()
  content!: string;
}

export class CreateProductDto {
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  compareAt?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  inventory?: number;

  @IsOptional()
  @IsBoolean()
  baseOptionEnabled?: boolean;

  @IsOptional()
  @IsString()
  baseOptionLabel?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  @ValidateIf((o: { videoUrl?: string }) => o.videoUrl !== "")
  @Matches(PROMO_VIDEO_URL_PATTERN, { message: PROMO_VIDEO_URL_MESSAGE })
  videoUrl?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @IsOptional()
  @IsBoolean()
  isTrending?: boolean;

  @IsOptional()
  @IsBoolean()
  isBestSelling?: boolean;

  @IsOptional()
  @IsBoolean()
  isCombo?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  comboProductIds?: string[];

  @IsOptional()
  @IsBoolean()
  showOnHome?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  comboPriority?: number;

  @IsOptional()
  @IsBoolean()
  isCertified?: boolean;

  @IsOptional()
  @IsString()
  badge?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductDetailDto)
  details?: ProductDetailDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CheckoutPolicyDto)
  checkoutPolicy?: CheckoutPolicyDto;
}

export class CheckoutItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CheckoutDto {
  @IsOptional()
  @IsIn(["en", "bn"])
  locale?: string;

  @IsString()
  customerName!: string;

  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email!: string;

  @IsString()
  phone!: string;

  @IsString()
  shippingAddress!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressInfoDto)
  shippingInfo?: AddressInfoDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressInfoDto)
  billingInfo?: AddressInfoDto;

  @IsOptional()
  @IsBoolean()
  billingSameAsShipping?: boolean;

  @IsOptional()
  @IsString()
  addressId?: string;

  @IsOptional()
  @IsString()
  promotionCode?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => value === undefined || value === "" ? undefined : Number(value))
  payNowAmount?: number;

  @IsOptional()
  @IsString()
  deliveryMethodCode?: string;

  @IsOptional()
  @IsString()
  deliveryZoneCode?: string;

  @IsOptional()
  @IsString()
  sessionKey?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  checkoutSource?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];
}

export class CheckoutQuoteDto {
  @IsOptional()
  @IsString()
  promotionCode?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  deliveryMethodCode?: string;

  @IsOptional()
  @IsString()
  deliveryZoneCode?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressInfoDto)
  shippingInfo?: AddressInfoDto;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value ? String(value).trim().toLowerCase() : undefined)
  email?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];
}

export class ProductEligibilityDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  deliveryZoneCode?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressInfoDto)
  shippingInfo?: AddressInfoDto;
}

export class UpdateOrderStatusDto {
  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class AdminUpdateOrderDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  trackingCode?: string;

  @IsOptional()
  @IsString()
  courierName?: string;

  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateCourierServiceDto {
  @IsEnum(CourierProvider)
  provider!: CourierProvider;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  apiBaseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  apiSecret?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  clientSecret?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  defaultPickupAddress?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class UpdateCourierServiceDto {
  @IsOptional()
  @IsEnum(CourierProvider)
  provider?: CourierProvider;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  apiBaseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  apiSecret?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  clientSecret?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  defaultPickupAddress?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class DispatchCourierShipmentDto {
  @IsString()
  courierServiceId!: string;

  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @IsOptional()
  @IsString()
  parcelType?: string;

  @IsOptional()
  @IsString()
  specialInstruction?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cashCollectionAmount?: number;

  @IsOptional()
  @IsString()
  trackingCode?: string;

  @IsOptional()
  @IsString()
  providerOrderId?: string;

  @IsOptional()
  @IsString()
  consignmentId?: string;
}

export class UpdateCourierShipmentDto {
  @IsEnum(CourierShipmentStatus)
  status!: CourierShipmentStatus;

  @IsOptional()
  @IsString()
  trackingCode?: string;

  @IsOptional()
  @IsString()
  providerOrderId?: string;

  @IsOptional()
  @IsString()
  consignmentId?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  deliveryFailedReason?: string;

  @IsOptional()
  @IsBoolean()
  paymentCollected?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  collectedAmount?: number;
}

export class AdminUpdateProductDto {
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAt?: number;

  @IsOptional()
  @IsBoolean()
  baseOptionEnabled?: boolean;

  @IsOptional()
  @IsString()
  baseOptionLabel?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  @ValidateIf((o: { videoUrl?: string }) => o.videoUrl !== "")
  @Matches(PROMO_VIDEO_URL_PATTERN, { message: PROMO_VIDEO_URL_MESSAGE })
  videoUrl?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsBoolean()
  isTrending?: boolean;

  @IsOptional()
  @IsBoolean()
  isBestSelling?: boolean;

  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @IsOptional()
  @IsBoolean()
  isCombo?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  comboProductIds?: string[];

  @IsOptional()
  @IsBoolean()
  showOnHome?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  comboPriority?: number;

  @IsOptional()
  @IsBoolean()
  isCertified?: boolean;

  @IsOptional()
  @IsString()
  badge?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductDetailDto)
  details?: ProductDetailDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CheckoutPolicyDto)
  checkoutPolicy?: CheckoutPolicyDto;
}

export class AdminUpdateBannerDto {
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  eyebrow?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @IsOptional()
  @IsString()
  ctaHref?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  focalX?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  focalY?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateSiteSettingsDto {
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  announcement?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  announcementLinkLabel?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  announcementLinkHref?: string;

  @IsOptional()
  @IsString()
  facebookUrl?: string;

  @IsOptional()
  @IsString()
  instagramUrl?: string;

  @IsOptional()
  @IsString()
  youtubeUrl?: string;

  @IsOptional()
  @IsString()
  whatsappUrl?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PlatformCheckoutPolicyDto)
  checkoutPolicy?: PlatformCheckoutPolicyDto;
}

export class CreateHomeSectionDto {
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @IsString()
  key!: string;

  @IsEnum(HomeSectionType)
  type!: HomeSectionType;

  @IsOptional()
  @IsString()
  eyebrow?: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @IsOptional()
  @IsString()
  ctaHref?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  collection?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  productLimit?: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateHomeSectionDto {
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsEnum(HomeSectionType)
  type?: HomeSectionType;

  @IsOptional()
  @IsString()
  eyebrow?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @IsOptional()
  @IsString()
  ctaHref?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  collection?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  productLimit?: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateTestimonialDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsString()
  quote!: string;

  @IsInt()
  @Min(1)
  rating!: number;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateTestimonialDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  quote?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  rating?: number;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateDeliveryZoneDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  areas?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  postalCodes?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class UpdateDeliveryZoneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  areas?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  postalCodes?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class CreateDeliveryRateDto {
  @IsString()
  zoneId!: string;

  @IsString()
  deliveryMethodId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freeThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrder?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minDeliveryDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDeliveryDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class UpdateDeliveryRateDto {
  @IsOptional()
  @IsString()
  zoneId?: string;

  @IsOptional()
  @IsString()
  deliveryMethodId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freeThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrder?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minDeliveryDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDeliveryDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class CreateCheckoutMethodDto {
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @IsEnum(CheckoutMethodType)
  type!: CheckoutMethodType;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freeThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minDeliveryDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDeliveryDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  paymentGatewayId?: string;
}

export class UpdateCheckoutMethodDto {
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(CheckoutMethodType)
  type?: CheckoutMethodType;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freeThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minDeliveryDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDeliveryDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  paymentGatewayId?: string;
}

export class CreatePaymentGatewayDto {
  @IsEnum(PaymentGatewayProvider)
  provider!: PaymentGatewayProvider;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsString()
  apiBaseUrl?: string;

  @IsOptional()
  @IsString()
  appKey?: string;

  @IsOptional()
  @IsString()
  appSecret?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class UpdatePaymentGatewayDto {
  @IsOptional()
  @IsEnum(PaymentGatewayProvider)
  provider?: PaymentGatewayProvider;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsString()
  apiBaseUrl?: string;

  @IsOptional()
  @IsString()
  appKey?: string;

  @IsOptional()
  @IsString()
  appSecret?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}
