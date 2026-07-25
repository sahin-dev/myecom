import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import {
  AnalyticsEventType,
  PromotionType,
  PurchaseOrderStatus,
  RefundStatus,
  ReturnStatus,
  ReviewStatus,
  UserRole
} from "@prisma/client";

export class TrackEventDto {
  @IsString()
  sessionKey!: string;

  @IsEnum(AnalyticsEventType)
  type!: AnalyticsEventType;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  medium?: string;

  @IsOptional()
  @IsString()
  campaign?: string;

  @IsOptional()
  @IsString()
  landingPage?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateAddressDto {
  @IsString()
  label!: string;

  @IsString()
  recipient!: string;

  @IsString()
  phone!: string;

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
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends CreateAddressDto {}

export class CartItemInputDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class SaveCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemInputDto)
  items!: CartItemInputDto[];
}

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  comment!: string;

  @IsOptional()
  @IsString()
  orderId?: string;
}

export class ValidatePromotionDto {
  @IsString()
  code!: string;

  @IsNumber()
  @Min(0)
  subtotal!: number;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  orderEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  backInStock?: boolean;

  @IsOptional()
  @IsBoolean()
  priceDrop?: boolean;
}

export class ReturnItemInputDto {
  @IsString()
  orderItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateReturnDto {
  @IsString()
  orderId!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInputDto)
  items!: ReturnItemInputDto[];
}

export class CreatePromotionDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsEnum(PromotionType)
  type!: PromotionType;

  @IsNumber()
  @IsPositive()
  value!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrder?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maximumDiscount?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  perCustomerLimit?: number;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePromotionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEnum(PromotionType)
  type?: PromotionType;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  value?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrder?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maximumDiscount?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  perCustomerLimit?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ModerateReviewDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;

  @IsOptional()
  @IsString()
  adminReply?: string;
}

export class UpdateReturnDto {
  @IsEnum(ReturnStatus)
  status!: ReturnStatus;

  @IsOptional()
  @IsString()
  resolution?: string;
}

export class CreateSupplierDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  leadTimeDays?: number;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  leadTimeDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PurchaseOrderItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @IsPositive()
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @IsString()
  supplierId!: string;

  @IsOptional()
  @IsDateString()
  expectedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @IsOptional()
  @IsBoolean()
  receiveAll?: boolean;

  @IsOptional()
  @IsDateString()
  expectedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class InventoryAdjustmentDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsInt()
  quantity!: number;

  @IsString()
  reason!: string;
}

export class UpdateStaffDto {
  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class CreateStaffDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateVariantDto {
  @IsString()
  name!: string;

  @IsString()
  sku!: string;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  compareAt?: number;

  @IsInt()
  @Min(0)
  inventory!: number;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sku?: string;

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
  @IsPositive()
  compareAt?: number;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddProductImageDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  alt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdateProductImageDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  alt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdateRefundDto {
  @IsEnum(RefundStatus)
  status!: RefundStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
