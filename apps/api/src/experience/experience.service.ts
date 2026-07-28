import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AnalyticsEventType,
  InventoryMovementType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  Promotion,
  PromotionType,
  PurchaseOrderStatus,
  RefundStatus,
  ReturnDisposition,
  ReturnResolutionType,
  ReturnStatus,
  UserRole
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password";
import {
  AddProductImageDto,
  CreateAddressDto,
  CreatePromotionDto,
  CreatePurchaseOrderDto,
  CreateReturnDto,
  CreateManualRefundDto,
  CreateReviewDto,
  CreateStaffDto,
  CreateSupplierDto,
  CreateVariantDto,
  InventoryAdjustmentDto,
  ModerateReviewDto,
  SaveCartDto,
  TrackEventDto,
  UpdateAddressDto,
  UpdateProductImageDto,
  UpdatePreferencesDto,
  UpdatePromotionDto,
  UpdatePurchaseOrderDto,
  UpdateRefundDto,
  UpdateReturnDto,
  UpdateSupplierDto,
  UpdateInfoPageDto,
  UpdateStaffDto,
  UpdateVariantDto,
  ValidatePromotionDto
} from "./experience.dto";
import { BkashService } from "../payments/bkash.service";
import { AuthService } from "../auth/auth.service";

const DEFAULT_INFO_PAGES: Record<string, { eyebrow: string; title: string; intro: string; points: { title: string; detail: string }[] }> = {
  about: {
    eyebrow: "Our story",
    title: "A more thoughtful pantry shop",
    intro: "My Ecom brings useful groceries, clear product information, and dependable delivery into one calm shopping experience.",
    points: [
      { title: "Carefully selected", detail: "We prioritize useful products, transparent details, and reliable availability." },
      { title: "Built for real routines", detail: "The store is organized around how households actually refill a pantry." },
      { title: "Clear from cart to door", detail: "Checkout, notifications, and tracking stay understandable throughout." }
    ]
  },
  contact: {
    eyebrow: "Talk to us",
    title: "Help is close by",
    intro: "Questions about an order, product, or delivery? Reach our support team and include your order number when available.",
    points: [
      { title: "Email", detail: "support@myecom.local" },
      { title: "Phone", detail: "+880 1700 000 000" },
      { title: "Hours", detail: "Saturday-Thursday, 9:00 AM-8:00 PM" }
    ]
  },
  delivery: {
    eyebrow: "Delivery",
    title: "From our pantry to yours",
    intro: "Orders are checked, packed, and handed to delivery partners with status updates at every major step.",
    points: [
      { title: "Dhaka delivery", detail: "Most orders arrive within 1-2 business days." },
      { title: "Delivery fee", detail: "Free over ৳3,000; otherwise ৳80." },
      { title: "Tracking", detail: "Use your order number and checkout email on the tracking page." }
    ]
  },
  returns: {
    eyebrow: "Returns",
    title: "Simple help when something is wrong",
    intro: "If an item arrives damaged, incorrect, or unusable, contact us promptly so we can review it.",
    points: [
      { title: "Report quickly", detail: "Contact support within 48 hours of delivery." },
      { title: "Keep the packaging", detail: "Photos of the item and original package help us resolve issues." },
      { title: "Resolution", detail: "Eligible cases receive a replacement, store credit, or refund." }
    ]
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Your information stays purposeful",
    intro: "We collect only the account, order, and delivery information required to operate the store.",
    points: [
      { title: "Account security", detail: "Passwords are hashed and authentication uses time-limited signed tokens." },
      { title: "Order information", detail: "Delivery details are used to fulfil and support your purchase." },
      { title: "Your control", detail: "You may request account corrections or deletion through support." }
    ]
  },
  terms: {
    eyebrow: "Terms",
    title: "Clear expectations for every order",
    intro: "Using My Ecom means providing accurate checkout information and following the store policies listed here.",
    points: [
      { title: "Availability", detail: "Inventory and delivery estimates may change before an order is confirmed." },
      { title: "Pricing", detail: "The checkout total shown when an order is placed is the applicable amount." },
      { title: "Responsible use", detail: "Accounts and admin tools must not be accessed without permission." }
    ]
  }
};

const money = (value: number) => Number(value.toFixed(2));
const monthKey = (date: Date) => date.toISOString().slice(0, 7);

@Injectable()
export class ExperienceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bkash: BkashService,
    private readonly auth: AuthService
  ) {}

  async searchCatalog(query: {
    search?: string;
    category?: string;
    brand?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    sort?: string;
    page?: string;
    limit?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(48, Math.max(8, Number(query.limit) || 16));
    const where: Prisma.ProductWhereInput = {
      status: "ACTIVE",
      ...(query.search?.trim()
        ? {
            OR: [
              { name: { contains: query.search.trim(), mode: "insensitive" } },
              { description: { contains: query.search.trim(), mode: "insensitive" } },
              {
                brand: {
                  is: {
                    name: { contains: query.search.trim(), mode: "insensitive" }
                  }
                }
              },
              {
                category: {
                  is: {
                    name: { contains: query.search.trim(), mode: "insensitive" }
                  }
                }
              },
              { tags: { has: query.search.trim().toLowerCase() } }
            ]
          }
        : {}),
      ...(query.category ? { category: { is: { slug: query.category } } } : {}),
      ...(query.brand ? { brandId: query.brand } : {}),
      ...(query.inStock === "true" ? { inventory: { gt: 0 } } : {}),
      ...(query.minPrice || query.maxPrice
        ? {
            price: {
              ...(query.minPrice ? { gte: Number(query.minPrice) } : {}),
              ...(query.maxPrice ? { lte: Number(query.maxPrice) } : {})
            }
          }
        : {})
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      query.sort === "price-asc"
        ? { price: "asc" }
        : query.sort === "price-desc"
          ? { price: "desc" }
          : query.sort === "newest"
            ? { createdAt: "desc" }
            : { isBestSelling: "desc" };

    const [products, total, brands, categories] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          brand: true,
          category: true,
          images: { orderBy: { position: "asc" } },
          variants: { where: { isActive: true }, orderBy: { price: "asc" } },
          reviews: { where: { status: "APPROVED" }, select: { rating: true } }
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.product.count({ where }),
      this.prisma.brand.findMany({ orderBy: { name: "asc" } }),
      this.prisma.category.findMany({ orderBy: [{ priority: "asc" }, { name: "asc" }] })
    ]);

    return {
      products: products.map(({ reviews, ...product }) => ({
        ...product,
        rating: reviews.length
          ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1))
          : 0,
        reviewCount: reviews.length
      })),
      facets: { brands, categories },
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
    };
  }

  async trackEvent(dto: TrackEventDto, userId?: string) {
    const session = await this.prisma.analyticsSession.upsert({
      where: { sessionKey: dto.sessionKey },
      update: {
        userId: userId ?? undefined,
        source: dto.source ?? undefined,
        medium: dto.medium ?? undefined,
        campaign: dto.campaign ?? undefined
      },
      create: {
        sessionKey: dto.sessionKey,
        userId,
        source: dto.source,
        medium: dto.medium,
        campaign: dto.campaign,
        landingPage: dto.landingPage
      }
    });
    return this.prisma.analyticsEvent.create({
      data: {
        type: dto.type,
        sessionId: session.id,
        userId,
        productId: dto.productId,
        orderId: dto.orderId,
        query: dto.query,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined
      }
    });
  }

  addresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (transaction) => {
      const count = await transaction.address.count({ where: { userId } });
      const isDefault = dto.isDefault || count === 0;
      if (isDefault) {
        await transaction.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return transaction.address.create({ data: { ...dto, userId, isDefault } });
    });
  }

  async updateAddress(userId: string, id: string, dto: UpdateAddressDto) {
    const address = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw new NotFoundException("Address not found.");
    return this.prisma.$transaction(async (transaction) => {
      if (dto.isDefault) {
        await transaction.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return transaction.address.update({ where: { id }, data: dto });
    });
  }

  async deleteAddress(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw new NotFoundException("Address not found.");
    await this.prisma.address.delete({ where: { id } });
    if (address.isDefault) {
      const next = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" }
      });
      if (next) await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { deleted: true };
  }

  async cart(userId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            product: { include: { brand: true, category: true } },
            variant: true
          }
        }
      }
    });
    return cart ?? { id: null, userId, items: [] };
  }

  async saveCart(userId: string, email: string, dto: SaveCartDto) {
    const productIds = dto.items.map((item) => item.productId);
    const [products, variants] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds }, status: "ACTIVE" },
        include: {
          variants: {
            where: { isActive: true },
            select: { id: true }
          }
        }
      }),
      this.prisma.productVariant.findMany({
        where: { id: { in: dto.items.flatMap((item) => item.variantId ? [item.variantId] : []) } }
      })
    ]);
    const productMap = new Map(products.map((product) => [product.id, product]));
    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    for (const item of dto.items) {
      const product = productMap.get(item.productId);
      const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
      if (!product || (item.variantId && !variant)) throw new BadRequestException("A cart item is unavailable.");
      if (variant && variant.productId !== item.productId) {
        throw new BadRequestException("A selected product option is invalid.");
      }
      if (product.variants.length && product.baseOptionEnabled === false && !item.variantId) {
        throw new BadRequestException(`${product.name} requires an option selection.`);
      }
      if ((variant?.inventory ?? product.inventory) < item.quantity) {
        throw new BadRequestException(`${product.name} does not have enough stock.`);
      }
    }

    return this.prisma.$transaction(async (transaction) => {
      let cart = await transaction.cart.findFirst({ where: { userId } });
      cart = cart
        ? await transaction.cart.update({ where: { id: cart.id }, data: { email } })
        : await transaction.cart.create({ data: { userId, email } });
      await transaction.cartItem.deleteMany({ where: { cartId: cart.id } });
      if (dto.items.length) {
        await transaction.cartItem.createMany({
          data: dto.items.map((item) => ({
            cartId: cart!.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.variantId
              ? variantMap.get(item.variantId)!.price
              : productMap.get(item.productId)!.price
          }))
        });
      }
      return this.cart(userId);
    });
  }

  async wishlist(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            brand: true,
            category: true,
            images: { orderBy: { position: "asc" } },
            variants: { where: { isActive: true }, orderBy: { createdAt: "asc" } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async addWishlist(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, status: "ACTIVE" } });
    if (!product) throw new NotFoundException("Product not found.");
    return this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
      include: {
        product: {
          include: {
            brand: true,
            category: true,
            images: { orderBy: { position: "asc" } },
            variants: { where: { isActive: true }, orderBy: { createdAt: "asc" } }
          }
        }
      }
    });
  }

  async removeWishlist(userId: string, productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return { deleted: true };
  }

  productReviews(productId: string) {
    return this.prisma.review.findMany({
      where: { productId, status: "APPROVED" },
      include: { user: { select: { name: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  myProductReview(userId: string, productId: string) {
    return this.prisma.review.findUnique({
      where: { userId_productId: { userId, productId } },
      include: {
        product: { select: { name: true, slug: true } }
      }
    });
  }

  async submitReview(userId: string, email: string, productId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException("Product not found.");
    const verifiedOrder = await this.prisma.order.findFirst({
      where: {
        email,
        status: "DELIVERED",
        items: { some: { productId } },
        ...(dto.orderId ? { id: dto.orderId } : {})
      }
    });
    const review = await this.prisma.review.upsert({
      where: { userId_productId: { userId, productId } },
      update: {
        rating: dto.rating,
        title: dto.title,
        comment: dto.comment,
        orderId: verifiedOrder?.id,
        isVerified: Boolean(verifiedOrder),
        status: "PENDING",
        showOnHome: false
      },
      create: {
        userId,
        productId,
        rating: dto.rating,
        title: dto.title,
        comment: dto.comment,
        orderId: verifiedOrder?.id,
        isVerified: Boolean(verifiedOrder)
      }
    });
    return review;
  }

  async deleteReview(userId: string, productId: string) {
    await this.prisma.review.deleteMany({ where: { userId, productId } });
    return { deleted: true };
  }

  async validatePromotion(dto: ValidatePromotionDto, email?: string) {
    const promotion = await this.findValidPromotion(dto.code, dto.subtotal, email);
    return {
      id: promotion.id,
      name: promotion.name,
      code: promotion.code,
      type: promotion.type,
      discount: this.promotionDiscount(promotion, dto.subtotal),
      freeShipping: promotion.type === "FREE_SHIPPING"
    };
  }

  async findValidPromotion(code: string, subtotal: number, email?: string) {
    const now = new Date();
    const promotion = await this.prisma.promotion.findFirst({
      where: {
        code: code.trim().toUpperCase(),
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now }
      },
      include: { redemptions: true }
    });
    if (!promotion) throw new NotFoundException("Promotion code is invalid or expired.");
    if (subtotal < promotion.minimumOrder) {
      throw new BadRequestException(`This promotion requires a minimum order of ${promotion.minimumOrder}.`);
    }
    if (promotion.usageLimit && promotion.redemptions.length >= promotion.usageLimit) {
      throw new BadRequestException("This promotion has reached its usage limit.");
    }
    if (email) {
      const customerUses = promotion.redemptions.filter(
        (redemption) => redemption.email.toLowerCase() === email.toLowerCase()
      ).length;
      if (customerUses >= promotion.perCustomerLimit) {
        throw new BadRequestException("This promotion has already been used on this account.");
      }
    }
    return promotion;
  }

  promotionDiscount(promotion: Promotion, subtotal: number) {
    if (promotion.type === PromotionType.FREE_SHIPPING) return 0;
    const raw =
      promotion.type === PromotionType.PERCENTAGE
        ? subtotal * (promotion.value / 100)
        : promotion.value;
    return money(Math.min(raw, promotion.maximumDiscount ?? raw, subtotal));
  }

  async preferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: { userId }
    });
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto }
    });
  }

  async returns(userId: string) {
    return this.prisma.returnRequest.findMany({
      where: { userId },
      include: {
        order: { select: { orderNumber: true, total: true } },
        items: { include: { orderItem: true } },
        refund: true
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async createReturn(userId: string, email: string, dto: CreateReturnDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, email, status: "DELIVERED" },
      include: {
        items: true,
        trackingEvents: {
          where: { status: OrderStatus.DELIVERED },
          orderBy: { createdAt: "desc" },
          take: 1
        },
        returnRequests: {
          where: { status: { notIn: [ReturnStatus.REJECTED, ReturnStatus.CANCELLED] } },
          include: { items: true }
        }
      }
    });
    if (!order) throw new BadRequestException("Only delivered orders can be returned.");
    const deliveredAt = order.trackingEvents[0]?.createdAt ?? order.updatedAt;
    if (Date.now() - deliveredAt.getTime() > 48 * 60 * 60 * 1000) {
      throw new BadRequestException("The 48-hour return request window has closed.");
    }
    const requestedIds = new Set<string>();
    for (const requested of dto.items) {
      if (requestedIds.has(requested.orderItemId)) {
        throw new BadRequestException("Each order item can appear only once in a return.");
      }
      requestedIds.add(requested.orderItemId);
      const item = order.items.find((orderItem) => orderItem.id === requested.orderItemId);
      const alreadyRequested = order.returnRequests
        .flatMap((returnRequest) => returnRequest.items)
        .filter((returnItem) => returnItem.orderItemId === requested.orderItemId)
        .reduce((sum, returnItem) => sum + returnItem.quantity, 0);
      if (!item || requested.quantity + alreadyRequested > item.quantity) {
        throw new BadRequestException("A requested return quantity is invalid.");
      }
    }
    return this.prisma.returnRequest.create({
      data: {
        returnNumber: `RET-${Date.now().toString().slice(-8)}`,
        orderId: order.id,
        userId,
        reason: dto.reason,
        details: dto.details,
        items: { create: dto.items }
      },
      include: {
        items: { include: { orderItem: true } },
        order: { select: { orderNumber: true, total: true } },
        refund: true
      }
    });
  }

  async cancelReturn(userId: string, id: string) {
    const item = await this.prisma.returnRequest.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException("Return request not found.");
    if (item.status !== ReturnStatus.REQUESTED) {
      throw new BadRequestException("Only a newly requested return can be cancelled.");
    }
    return this.prisma.returnRequest.update({
      where: { id },
      data: { status: ReturnStatus.CANCELLED },
      include: {
        items: { include: { orderItem: true } },
        order: { select: { orderNumber: true, total: true } },
        refund: true
      }
    });
  }

  async recommendations(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("Customer not found.");
    const orders = await this.prisma.order.findMany({
      where: { email: user.email, status: { not: "CANCELLED" } },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    const purchasedIds = new Set(orders.flatMap((order) => order.items.map((item) => item.productId)));
    const purchasedProducts = await this.prisma.product.findMany({
      where: { id: { in: [...purchasedIds] } }
    });
    const tags = [...new Set(purchasedProducts.flatMap((product) => product.tags))];
    const products = await this.prisma.product.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { inventory: { gt: 0 } },
          { variants: { some: { isActive: true, inventory: { gt: 0 } } } }
        ],
        id: { notIn: [...purchasedIds] },
        ...(tags.length ? { tags: { hasSome: tags } } : {})
      },
      include: {
        brand: true,
        category: true,
        images: { orderBy: { position: "asc" } },
        variants: { where: { isActive: true }, orderBy: { createdAt: "asc" } }
      },
      orderBy: [{ isBestSelling: "desc" }, { isTrending: "desc" }],
      take: 8
    });
    return products.length
      ? products
      : this.prisma.product.findMany({
          where: {
            status: "ACTIVE",
            OR: [
              { inventory: { gt: 0 } },
              { variants: { some: { isActive: true, inventory: { gt: 0 } } } }
            ]
          },
          include: {
            brand: true,
            category: true,
            images: { orderBy: { position: "asc" } },
            variants: { where: { isActive: true }, orderBy: { createdAt: "asc" } }
          },
          orderBy: { isBestSelling: "desc" },
          take: 8
        });
  }

  adminPromotions() {
    return this.prisma.promotion.findMany({
      include: {
        _count: { select: { redemptions: true, orders: true } },
        redemptions: { select: { discount: true, email: true, createdAt: true } },
        orders: { select: { total: true, status: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  private validatePromotionValue(type: PromotionType, value: number) {
    if (type === PromotionType.PERCENTAGE && (value <= 0 || value > 100)) {
      throw new BadRequestException("Percentage promotions must be between 1 and 100.");
    }
    if (type === PromotionType.FIXED && value <= 0) {
      throw new BadRequestException("Fixed promotions require an amount greater than zero.");
    }
    if (type === PromotionType.FREE_SHIPPING && value !== 0) {
      throw new BadRequestException("Free shipping promotions must use a value of zero.");
    }
  }

  async createPromotion(actorId: string, dto: CreatePromotionDto) {
    if (new Date(dto.endsAt) <= new Date(dto.startsAt)) {
      throw new BadRequestException("Promotion end date must be after its start date.");
    }
    this.validatePromotionValue(dto.type, dto.value);
    const promotion = await this.prisma.promotion.create({
      data: {
        ...dto,
        code: dto.code.trim().toUpperCase(),
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        minimumOrder: dto.minimumOrder ?? 0,
        perCustomerLimit: dto.perCustomerLimit ?? 1,
        isActive: dto.isActive ?? true
      },
      include: {
        _count: { select: { redemptions: true, orders: true } },
        redemptions: { select: { discount: true, email: true, createdAt: true } },
        orders: { select: { total: true, status: true } }
      }
    });
    await this.audit(actorId, "promotion.created", "Promotion", promotion.id, { code: promotion.code });
    return promotion;
  }

  async updatePromotion(actorId: string, id: string, dto: UpdatePromotionDto) {
    const current = await this.prisma.promotion.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Promotion not found.");
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : current.endsAt;
    if (endsAt <= startsAt) {
      throw new BadRequestException("Promotion end date must be after its start date.");
    }
    this.validatePromotionValue(dto.type ?? current.type, dto.value ?? current.value);
    const promotion = await this.prisma.promotion.update({
      where: { id },
      data: {
        ...dto,
        code: dto.code?.trim().toUpperCase(),
        startsAt: dto.startsAt ? startsAt : undefined,
        endsAt: dto.endsAt ? endsAt : undefined
      },
      include: {
        _count: { select: { redemptions: true, orders: true } },
        redemptions: { select: { discount: true, email: true, createdAt: true } },
        orders: { select: { total: true, status: true } }
      }
    });
    await this.audit(actorId, "promotion.updated", "Promotion", id, { ...dto });
    return promotion;
  }

  async deletePromotion(actorId: string, id: string) {
    const [usage, linkedOrders] = await Promise.all([
      this.prisma.couponRedemption.count({ where: { promotionId: id } }),
      this.prisma.order.count({ where: { promotionId: id } })
    ]);
    if (usage || linkedOrders) {
      const promotion = await this.prisma.promotion.update({
        where: { id },
        data: { isActive: false }
      });
      await this.audit(actorId, "promotion.archived", "Promotion", id);
      return { deleted: false, archived: true, promotion };
    }
    await this.prisma.promotion.delete({ where: { id } });
    await this.audit(actorId, "promotion.deleted", "Promotion", id);
    return { deleted: true };
  }

  adminReviews(status?: string) {
    return this.prisma.review.findMany({
      where: status && ["PENDING", "APPROVED", "REJECTED"].includes(status)
        ? { status: status as "PENDING" | "APPROVED" | "REJECTED" }
        : {},
      include: {
        user: { select: { name: true, email: true, avatarUrl: true } },
        product: { select: { name: true, slug: true, imageUrl: true } }
      },
      orderBy: [{ showOnHome: "desc" }, { homePriority: "asc" }, { createdAt: "desc" }],
      take: 200
    });
  }

  async moderateReview(
    actorId: string,
    id: string,
    dto: ModerateReviewDto
  ) {
    const current = await this.prisma.review.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Review not found.");
    const status = dto.status ?? current.status;
    const showOnHome = status === "APPROVED"
      ? dto.showOnHome ?? current.showOnHome
      : false;
    if (dto.showOnHome && status !== "APPROVED") {
      throw new BadRequestException("Approve the review before showcasing it on the homepage.");
    }
    const review = await this.prisma.review.update({
      where: { id },
      data: {
        status,
        adminReply: dto.adminReply,
        showOnHome,
        homePriority: dto.homePriority
      },
      include: {
        user: { select: { name: true, email: true, avatarUrl: true } },
        product: { select: { name: true, slug: true, imageUrl: true } }
      }
    });
    await this.audit(actorId, "review.moderated", "Review", id, {
      status,
      showOnHome,
      homePriority: review.homePriority
    });
    return review;
  }

  adminReturns(status?: string) {
    return this.prisma.returnRequest.findMany({
      where: status && Object.values(ReturnStatus).includes(status as ReturnStatus)
        ? { status: status as ReturnStatus }
        : {},
      include: {
        user: { select: { name: true, email: true } },
        order: { include: { items: true, payments: true, refunds: true } },
        items: { include: { orderItem: true } },
        refund: true
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async updateReturn(actorId: string, id: string, dto: UpdateReturnDto) {
    const current = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        items: { include: { orderItem: true } },
        order: { include: { payments: true, refunds: true } },
        refund: true
      }
    });
    if (!current) throw new NotFoundException("Return request not found.");
    const transitions: Record<ReturnStatus, ReturnStatus[]> = {
      REQUESTED: [ReturnStatus.APPROVED, ReturnStatus.REJECTED, ReturnStatus.CANCELLED],
      APPROVED: [ReturnStatus.RECEIVED, ReturnStatus.CANCELLED],
      RECEIVED: [ReturnStatus.REFUND_PENDING, ReturnStatus.RESOLVED],
      REFUND_PENDING: [],
      REFUNDED: [],
      RESOLVED: [],
      REJECTED: [],
      CANCELLED: []
    };
    if (
      dto.status !== current.status &&
      !transitions[current.status].includes(dto.status)
    ) {
      throw new BadRequestException(
        `Return cannot move from ${current.status} to ${dto.status}.`
      );
    }
    if (dto.status === ReturnStatus.REJECTED && !dto.resolution?.trim()) {
      throw new BadRequestException("Add a clear reason before rejecting this return.");
    }
    if (dto.status === ReturnStatus.RECEIVED) {
      const dispositions = new Map(
        (dto.items ?? []).map((item) => [item.returnItemId, item.disposition])
      );
      if (current.items.some((item) => !dispositions.has(item.id))) {
        throw new BadRequestException("Choose a disposition for every received item.");
      }
    }
    if (
      dto.status === ReturnStatus.REFUND_PENDING &&
      dto.resolutionType !== ReturnResolutionType.REFUND
    ) {
      throw new BadRequestException("Refund resolution is required before creating a refund.");
    }
    if (
      dto.status === ReturnStatus.RESOLVED &&
      (!dto.resolutionType || dto.resolutionType === ReturnResolutionType.REFUND)
    ) {
      throw new BadRequestException("Choose replacement, store credit, or no action to resolve without a refund.");
    }
    const updated = await this.prisma.$transaction(async (transaction) => {
      if (dto.status === ReturnStatus.RECEIVED && current.status !== ReturnStatus.RECEIVED) {
        const dispositions = new Map(
          (dto.items ?? []).map((item) => [item.returnItemId, item.disposition])
        );
        for (const item of current.items) {
          const disposition = dispositions.get(item.id)!;
          await transaction.returnItem.update({
            where: { id: item.id },
            data: { disposition }
          });
          if (disposition === ReturnDisposition.RESTOCK) {
            if (item.orderItem.variantId) {
              await transaction.productVariant.update({
                where: { id: item.orderItem.variantId },
                data: { inventory: { increment: item.quantity } }
              });
            } else {
              await transaction.product.update({
                where: { id: item.orderItem.productId },
                data: { inventory: { increment: item.quantity } }
              });
            }
          }
          await transaction.inventoryMovement.create({
            data: {
              productId: item.orderItem.productId,
              variantId: item.orderItem.variantId,
              type:
                disposition === ReturnDisposition.RESTOCK
                  ? InventoryMovementType.RETURN
                  : InventoryMovementType.DAMAGE,
              quantity: disposition === ReturnDisposition.RESTOCK ? item.quantity : 0,
              reason: `${item.quantity} received as ${disposition.toLowerCase()} for ${current.returnNumber}`,
              reference: current.returnNumber,
              createdById: actorId
            }
          });
        }
      }
      if (
        dto.status === ReturnStatus.REFUND_PENDING &&
        current.status === ReturnStatus.RECEIVED &&
        !current.refund
      ) {
        const grossReturned = current.items.reduce(
          (sum, item) => sum + item.orderItem.unitPrice * item.quantity,
          0
        );
        const allocatedDiscount =
          current.order.subtotal > 0
            ? current.order.discount * (grossReturned / current.order.subtotal)
            : 0;
        const completedRefunds = current.order.refunds
          .filter((refund) => refund.status === RefundStatus.COMPLETED)
          .reduce((sum, refund) => sum + refund.amount, 0);
        const amount = money(
          Math.max(0, Math.min(grossReturned - allocatedDiscount, current.order.total - completedRefunds))
        );
        if (amount <= 0) {
          throw new BadRequestException("This return has no refundable balance.");
        }
        const payment = current.order.payments.find(
          (item) =>
            item.status === PaymentStatus.PAID ||
            item.status === PaymentStatus.PARTIALLY_REFUNDED
        );
        await transaction.refund.create({
          data: {
            orderId: current.orderId,
            paymentId: payment?.id,
            returnRequestId: current.id,
            amount,
            reason: `Approved return ${current.returnNumber}`,
            status: RefundStatus.PENDING
          }
        });
      }
      if (dto.status !== current.status) {
        await transaction.notification.create({
          data: {
            orderId: current.orderId,
            email: current.order.email,
            title: "Return update",
            message: `${current.returnNumber} is now ${dto.status.toLowerCase().replace(/_/g, " ")}.`
          }
        });
      }
      return transaction.returnRequest.update({
        where: { id },
        data: {
          status: dto.status,
          resolution: dto.resolution,
          resolutionType: dto.resolutionType
        },
        include: {
          user: { select: { name: true, email: true } },
          order: { include: { items: true, payments: true, refunds: true } },
          items: { include: { orderItem: true } },
          refund: true
        }
      });
    });
    await this.audit(actorId, "return.updated", "ReturnRequest", id, { status: dto.status });
    return updated;
  }

  suppliers() {
    return this.prisma.supplier.findMany({
      include: { _count: { select: { products: true, purchaseOrders: true } } },
      orderBy: { name: "asc" }
    });
  }

  async createSupplier(actorId: string, dto: CreateSupplierDto) {
    const supplier = await this.prisma.supplier.create({
      data: { ...dto, leadTimeDays: dto.leadTimeDays ?? 7 }
    });
    await this.audit(actorId, "supplier.created", "Supplier", supplier.id);
    return supplier;
  }

  async updateSupplier(actorId: string, id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.update({ where: { id }, data: dto });
    await this.audit(actorId, "supplier.updated", "Supplier", id, { ...dto });
    return supplier;
  }

  async deleteSupplier(actorId: string, id: string) {
    const usage = await this.prisma.purchaseOrder.count({ where: { supplierId: id } });
    if (usage) {
      const supplier = await this.prisma.supplier.update({
        where: { id },
        data: { isActive: false }
      });
      await this.audit(actorId, "supplier.archived", "Supplier", id);
      return { deleted: false, archived: true, supplier };
    }
    await this.prisma.supplier.delete({ where: { id } });
    await this.audit(actorId, "supplier.deleted", "Supplier", id);
    return { deleted: true };
  }

  purchaseOrders() {
    return this.prisma.purchaseOrder.findMany({
      include: { supplier: true, items: { include: { product: true, variant: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  async createPurchaseOrder(actorId: string, dto: CreatePurchaseOrderDto) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier || !supplier.isActive) throw new NotFoundException("Supplier not found.");
    const [products, variants] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: [...new Set(dto.items.map((item) => item.productId))] } },
        select: { id: true }
      }),
      this.prisma.productVariant.findMany({
        where: {
          id: {
            in: dto.items.flatMap((item) => item.variantId ? [item.variantId] : [])
          }
        },
        select: { id: true, productId: true }
      })
    ]);
    const productIds = new Set(products.map((product) => product.id));
    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    for (const item of dto.items) {
      const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
      if (!productIds.has(item.productId) || (item.variantId && !variant)) {
        throw new BadRequestException("A purchase-order item is invalid.");
      }
      if (variant && variant.productId !== item.productId) {
        throw new BadRequestException("A purchase-order option does not belong to its product.");
      }
    }
    const totalCost = dto.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const purchaseOrder = await this.prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-${Date.now().toString().slice(-8)}`,
        supplierId: dto.supplierId,
        expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : undefined,
        notes: dto.notes,
        totalCost,
        items: { create: dto.items }
      },
      include: { supplier: true, items: { include: { product: true } } }
    });
    await this.audit(actorId, "purchase_order.created", "PurchaseOrder", purchaseOrder.id);
    return purchaseOrder;
  }

  async updatePurchaseOrder(actorId: string, id: string, dto: UpdatePurchaseOrderDto) {
    const current = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!current) throw new NotFoundException("Purchase order not found.");
    const shouldReceive =
      dto.receiveAll &&
      current.status !== PurchaseOrderStatus.RECEIVED &&
      current.status !== PurchaseOrderStatus.CANCELLED;
    const updated = await this.prisma.$transaction(async (transaction) => {
      if (shouldReceive) {
        for (const item of current.items) {
          const outstanding = item.quantity - item.received;
          if (outstanding <= 0) continue;
          if (item.variantId) {
            await transaction.productVariant.update({
              where: { id: item.variantId },
              data: { inventory: { increment: outstanding }, costPrice: item.unitCost }
            });
          } else {
            await transaction.product.update({
              where: { id: item.productId },
              data: { inventory: { increment: outstanding }, costPrice: item.unitCost }
            });
          }
          await transaction.purchaseOrderItem.update({
            where: { id: item.id },
            data: { received: item.quantity }
          });
          await transaction.inventoryMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId,
              type: InventoryMovementType.PURCHASE,
              quantity: outstanding,
              reason: `Received ${current.poNumber}`,
              reference: current.poNumber,
              createdById: actorId
            }
          });
        }
      }
      return transaction.purchaseOrder.update({
        where: { id },
        data: { status: shouldReceive ? PurchaseOrderStatus.RECEIVED : dto.status },
        include: { supplier: true, items: { include: { product: true, variant: true } } }
      });
    });
    await this.audit(actorId, "purchase_order.updated", "PurchaseOrder", id, {
      status: updated.status
    });
    return updated;
  }

  inventoryMovements(productId?: string) {
    return this.prisma.inventoryMovement.findMany({
      where: productId ? { productId } : {},
      include: { product: { select: { name: true } }, variant: { select: { name: true, sku: true } } },
      orderBy: { createdAt: "desc" },
      take: 300
    });
  }

  async adjustInventory(actorId: string, dto: InventoryAdjustmentDto) {
    if (!dto.quantity) throw new BadRequestException("Adjustment quantity cannot be zero.");
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException("Product not found.");
    const variant = dto.variantId
      ? await this.prisma.productVariant.findUnique({ where: { id: dto.variantId } })
      : null;
    if (variant && variant.productId !== dto.productId) {
      throw new BadRequestException("The selected option does not belong to this product.");
    }
    const currentInventory = dto.variantId ? variant?.inventory : product.inventory;
    if (currentInventory == null || currentInventory + dto.quantity < 0) {
      throw new BadRequestException("Adjustment would make inventory negative.");
    }
    const result = await this.prisma.$transaction(async (transaction) => {
      if (dto.variantId) {
        await transaction.productVariant.update({
          where: { id: dto.variantId },
          data: { inventory: { increment: dto.quantity } }
        });
      } else {
        await transaction.product.update({
          where: { id: dto.productId },
          data: { inventory: { increment: dto.quantity } }
        });
      }
      return transaction.inventoryMovement.create({
        data: {
          productId: dto.productId,
          variantId: dto.variantId,
          type: InventoryMovementType.ADJUSTMENT,
          quantity: dto.quantity,
          reason: dto.reason,
          createdById: actorId
        }
      });
    });
    await this.audit(actorId, "inventory.adjusted", "Product", dto.productId, {
      quantity: dto.quantity,
      reason: dto.reason
    });
    if ((currentInventory ?? 0) <= 0 && (currentInventory ?? 0) + dto.quantity > 0) {
      await this.notifyStockAlerts(dto.productId, dto.variantId, product.name);
    }
    return result;
  }

  async subscribeStockAlert(userId: string, productId: string, variantId?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException("Product not found.");
    return this.prisma.stockAlert.upsert({
      where: {
        userId_productId_variantId: {
          userId,
          productId,
          variantId: (variantId ?? null) as string
        }
      },
      create: { userId, productId, variantId },
      update: {}
    });
  }

  private async notifyStockAlerts(productId: string, variantId: string | undefined, productName: string) {
    const subscribers = await this.prisma.stockAlert.findMany({
      where: { productId, variantId: variantId ?? null, notifiedAt: null },
      include: { user: { select: { email: true } } }
    });
    if (!subscribers.length) return;
    await this.prisma.notification.createMany({
      data: subscribers.map((subscriber) => ({
        email: subscriber.user.email,
        title: "Back in stock",
        message: `${productName} is back in stock. Order it before it sells out again.`
      }))
    });
    await this.prisma.stockAlert.updateMany({
      where: { id: { in: subscribers.map((subscriber) => subscriber.id) } },
      data: { notifiedAt: new Date() }
    });
  }

  async createVariant(actorId: string, productId: string, dto: CreateVariantDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException("Product not found.");
    const variant = await this.prisma.productVariant.create({
      data: {
        ...dto,
        productId,
        sku: dto.sku.trim().toUpperCase(),
        attributes: dto.attributes as Prisma.InputJsonValue | undefined
      }
    });
    if (dto.inventory) {
      await this.prisma.inventoryMovement.create({
        data: {
          productId,
          variantId: variant.id,
          type: InventoryMovementType.ADJUSTMENT,
          quantity: dto.inventory,
          reason: "Opening variant inventory",
          createdById: actorId
        }
      });
    }
    await this.audit(actorId, "variant.created", "ProductVariant", variant.id, { productId });
    return variant;
  }

  async updateVariant(
    actorId: string,
    productId: string,
    id: string,
    dto: UpdateVariantDto
  ) {
    const variant = await this.prisma.productVariant.findFirst({ where: { id, productId } });
    if (!variant) throw new NotFoundException("Product option not found.");
    const updated = await this.prisma.productVariant.update({
      where: { id },
      data: {
        ...dto,
        sku: dto.sku?.trim().toUpperCase(),
        attributes: dto.attributes as Prisma.InputJsonValue | undefined
      }
    });
    await this.audit(actorId, "variant.updated", "ProductVariant", id, { productId });
    return updated;
  }

  async deleteVariant(actorId: string, productId: string, id: string) {
    const variant = await this.prisma.productVariant.findFirst({ where: { id, productId } });
    if (!variant) throw new NotFoundException("Product option not found.");
    const usage = await this.prisma.orderItem.count({ where: { variantId: id } });
    if (usage) {
      const archived = await this.prisma.productVariant.update({
        where: { id },
        data: { isActive: false }
      });
      await this.audit(actorId, "variant.archived", "ProductVariant", id, { productId });
      return { deleted: false, archived: true, variant: archived };
    }
    await this.prisma.productVariant.delete({ where: { id } });
    await this.audit(actorId, "variant.deleted", "ProductVariant", id, { productId });
    return { deleted: true };
  }

  async addProductImage(actorId: string, productId: string, dto: AddProductImageDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException("Product not found.");
    const image = await this.prisma.productImage.create({
      data: { ...dto, productId, position: dto.position ?? 0 }
    });
    await this.audit(actorId, "product_image.created", "ProductImage", image.id, { productId });
    return image;
  }

  async updateProductImage(
    actorId: string,
    productId: string,
    id: string,
    dto: UpdateProductImageDto
  ) {
    const image = await this.prisma.productImage.findFirst({ where: { id, productId } });
    if (!image) throw new NotFoundException("Product image not found.");
    const updated = await this.prisma.productImage.update({ where: { id }, data: dto });
    await this.audit(actorId, "product_image.updated", "ProductImage", id, { productId });
    return updated;
  }

  async deleteProductImage(actorId: string, productId: string, id: string) {
    const image = await this.prisma.productImage.findFirst({ where: { id, productId } });
    if (!image) throw new NotFoundException("Product image not found.");
    await this.prisma.productImage.delete({ where: { id } });
    await this.audit(actorId, "product_image.deleted", "ProductImage", id, { productId });
    return { deleted: true };
  }

  refunds() {
    return this.prisma.refund.findMany({
      include: {
        order: { select: { orderNumber: true, customerName: true, email: true, total: true } },
        payment: { select: { provider: true, method: true, transactionId: true } },
        returnRequest: { select: { id: true, returnNumber: true, status: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async createManualRefund(actorId: string, orderId: string, dto: CreateManualRefundDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true, refunds: true }
    });
    if (!order) throw new NotFoundException("Order not found.");
    const paidPayment = order.payments.find((payment) => payment.status === PaymentStatus.PAID);
    if (!paidPayment) {
      throw new BadRequestException("This order has no paid payment to refund against.");
    }
    const alreadyRefunded = order.refunds
      .filter((refund) => refund.status !== RefundStatus.FAILED)
      .reduce((sum, refund) => sum + refund.amount, 0);
    if (dto.amount > order.total - alreadyRefunded) {
      throw new BadRequestException("Refund amount exceeds the order's refundable balance.");
    }
    const refund = await this.prisma.refund.create({
      data: {
        orderId: order.id,
        paymentId: paidPayment.id,
        amount: dto.amount,
        reason: dto.reason,
        status: RefundStatus.PENDING
      },
      include: {
        order: { select: { orderNumber: true, customerName: true, email: true, total: true } },
        payment: { select: { provider: true, method: true, transactionId: true } },
        returnRequest: { select: { id: true, returnNumber: true, status: true } }
      }
    });
    await this.audit(actorId, "refund.created", "Refund", refund.id, {
      orderNumber: order.orderNumber,
      amount: dto.amount,
      reason: dto.reason
    });
    return refund;
  }

  payments(query: { search?: string; status?: string; provider?: string }) {
    const search = query.search?.trim();
    return this.prisma.payment.findMany({
      where: {
        status: query.status ? (query.status as PaymentStatus) : undefined,
        provider: query.provider || undefined,
        ...(search
          ? {
              OR: [
                { transactionId: { contains: search, mode: "insensitive" } },
                { gatewayReference: { contains: search, mode: "insensitive" } },
                { order: { orderNumber: { contains: search, mode: "insensitive" } } }
              ]
            }
          : {})
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            customerName: true,
            email: true,
            userId: true,
            total: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  async requeryPayment(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException("Payment not found.");
    if (payment.provider !== "bkash" || !payment.gatewayReference) {
      throw new BadRequestException("Only bKash payments with a gateway reference can be re-checked.");
    }
    const result = await this.bkash.queryPayment(payment.gatewayReference);
    const transactionStatus = result.transactionStatus as string | undefined;
    const status: PaymentStatus =
      transactionStatus === "Completed"
        ? PaymentStatus.PAID
        : transactionStatus === "Initiated"
          ? PaymentStatus.PENDING
          : PaymentStatus.FAILED;
    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status,
        transactionId: (result.trxID as string | undefined) ?? payment.transactionId,
        providerPayload: result as unknown as Prisma.InputJsonValue
      }
    });
    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: status }
    });
    return updated;
  }

  async infoPages() {
    const existing = await this.prisma.infoPage.findMany();
    const existingSlugs = new Set(existing.map((page) => page.slug));
    const missing = Object.keys(DEFAULT_INFO_PAGES).filter((slug) => !existingSlugs.has(slug));
    if (missing.length) {
      await this.prisma.infoPage.createMany({
        data: missing.map((slug) => ({
          slug,
          ...DEFAULT_INFO_PAGES[slug],
          points: DEFAULT_INFO_PAGES[slug].points as unknown as Prisma.InputJsonValue
        }))
      });
      return this.prisma.infoPage.findMany();
    }
    return existing;
  }

  async updateInfoPage(actorId: string, slug: string, dto: UpdateInfoPageDto) {
    if (!DEFAULT_INFO_PAGES[slug]) throw new NotFoundException("Unknown info page.");
    await this.infoPages();
    const updated = await this.prisma.infoPage.update({
      where: { slug },
      data: {
        eyebrow: dto.eyebrow,
        title: dto.title,
        intro: dto.intro,
        points: dto.points as unknown as Prisma.InputJsonValue | undefined
      }
    });
    await this.audit(actorId, "info_page.updated", "InfoPage", updated.id, { slug });
    return updated;
  }

  async updateRefund(actorId: string, id: string, dto: UpdateRefundDto) {
    const current = await this.prisma.refund.findUnique({
      where: { id },
      include: {
        order: { include: { refunds: true } },
        payment: true,
        returnRequest: true
      }
    });
    if (!current) throw new NotFoundException("Refund not found.");
    const transitions: Record<RefundStatus, RefundStatus[]> = {
      PENDING: [RefundStatus.PROCESSING, RefundStatus.FAILED],
      PROCESSING: [RefundStatus.COMPLETED, RefundStatus.FAILED],
      FAILED: [RefundStatus.PENDING],
      COMPLETED: []
    };
    if (
      dto.status !== current.status &&
      !transitions[current.status].includes(dto.status)
    ) {
      throw new BadRequestException(
        `Refund cannot move from ${current.status} to ${dto.status}.`
      );
    }
    const refund = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.refund.update({
        where: { id },
        data: dto
      });
      if (dto.status === RefundStatus.COMPLETED && current.status !== RefundStatus.COMPLETED) {
        const previouslyCompleted = current.order.refunds
          .filter((item) => item.id !== current.id && item.status === RefundStatus.COMPLETED)
          .reduce((sum, item) => sum + item.amount, 0);
        const paymentStatus =
          previouslyCompleted + current.amount >= current.order.total
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PARTIALLY_REFUNDED;
        await transaction.order.update({
          where: { id: current.orderId },
          data: { paymentStatus }
        });
        if (current.paymentId) {
          await transaction.payment.update({
            where: { id: current.paymentId },
            data: { status: paymentStatus }
          });
        }
        if (current.returnRequestId) {
          await transaction.returnRequest.update({
            where: { id: current.returnRequestId },
            data: { status: ReturnStatus.REFUNDED }
          });
        }
      }
      if (dto.status !== current.status) {
        await transaction.notification.create({
          data: {
            orderId: current.orderId,
            email: current.order.email,
            title: "Refund update",
            message: `Your refund for ${current.order.orderNumber} is now ${dto.status.toLowerCase()}.`
          }
        });
      }
      return transaction.refund.findUniqueOrThrow({
        where: { id },
        include: {
          order: { select: { orderNumber: true, customerName: true, email: true, total: true } },
          payment: { select: { provider: true, method: true, transactionId: true } },
          returnRequest: { select: { id: true, returnNumber: true, status: true } }
        }
      });
    });
    await this.audit(actorId, "refund.updated", "Refund", id, { status: dto.status });
    return refund;
  }

  async growthAnalytics(daysInput?: string) {
    const days = Math.min(180, Math.max(7, Number(daysInput) || 30));
    const start = new Date();
    start.setDate(start.getDate() - days);
    const [events, sessions, orders, products] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: start } },
        include: { product: { select: { name: true } }, session: true }
      }),
      this.prisma.analyticsSession.findMany({ where: { createdAt: { gte: start } } }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: start }, status: { not: "CANCELLED" } },
        include: { items: true, attribution: true }
      }),
      this.prisma.product.findMany({
        where: { status: "ACTIVE" },
        include: { supplier: true }
      })
    ]);
    const uniqueFor = (type: AnalyticsEventType) =>
      new Set(events.filter((event) => event.type === type).map((event) => event.sessionId)).size;
    const funnel = [
      { stage: "Sessions", value: sessions.length },
      { stage: "Product views", value: uniqueFor(AnalyticsEventType.PRODUCT_VIEWED) },
      { stage: "Added to cart", value: uniqueFor(AnalyticsEventType.ADDED_TO_CART) },
      { stage: "Checkout", value: uniqueFor(AnalyticsEventType.CHECKOUT_STARTED) },
      { stage: "Purchase", value: orders.length }
    ];
    const recognizedOrders = orders.filter(
      (order) =>
        order.paymentStatus === PaymentStatus.PAID ||
        order.status === OrderStatus.DELIVERED
    );
    const searches = new Map<string, number>();
    for (const event of events.filter((item) => item.type === AnalyticsEventType.SEARCHED)) {
      if (event.query) searches.set(event.query, (searches.get(event.query) ?? 0) + 1);
    }
    const sources = new Map<string, { source: string; sessions: number; orders: number; revenue: number }>();
    for (const session of sessions) {
      const source = session.source || "Direct";
      const item = sources.get(source) ?? { source, sessions: 0, orders: 0, revenue: 0 };
      item.sessions += 1;
      sources.set(source, item);
    }
    for (const order of orders) {
      const source = order.attribution?.source || "Direct";
      const item = sources.get(source) ?? { source, sessions: 0, orders: 0, revenue: 0 };
      item.orders += 1;
      if (
        order.paymentStatus === PaymentStatus.PAID ||
        order.status === OrderStatus.DELIVERED
      ) {
        item.revenue += order.total;
      }
      sources.set(source, item);
    }
    const productSignals = new Map<string, { productId: string; name: string; views: number; carts: number; units: number; revenue: number }>();
    for (const event of events.filter((item) => item.productId)) {
      const signal = productSignals.get(event.productId!) ?? {
        productId: event.productId!,
        name: event.product?.name ?? "Product",
        views: 0,
        carts: 0,
        units: 0,
        revenue: 0
      };
      if (event.type === AnalyticsEventType.PRODUCT_VIEWED) signal.views += 1;
      if (event.type === AnalyticsEventType.ADDED_TO_CART) signal.carts += 1;
      productSignals.set(event.productId!, signal);
    }
    for (const order of recognizedOrders) {
      for (const item of order.items) {
        const product = products.find((entry) => entry.id === item.productId);
        const signal = productSignals.get(item.productId) ?? {
          productId: item.productId,
          name: item.productName,
          views: 0,
          carts: 0,
          units: 0,
          revenue: 0
        };
        signal.units += item.quantity;
        signal.revenue += item.quantity * item.unitPrice;
        productSignals.set(item.productId, signal);
      }
    }

    const orderHistory = await this.prisma.order.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { email: true, createdAt: true }
    });
    const firstOrderByEmail = new Map<string, Date>();
    for (const order of orderHistory) {
      const existing = firstOrderByEmail.get(order.email);
      if (!existing || order.createdAt < existing) firstOrderByEmail.set(order.email, order.createdAt);
    }
    const cohorts = new Map<string, { cohort: string; customers: Set<string>; repeatCustomers: Set<string> }>();
    for (const [email, firstOrder] of firstOrderByEmail) {
      const key = monthKey(firstOrder);
      const cohort = cohorts.get(key) ?? { cohort: key, customers: new Set(), repeatCustomers: new Set() };
      cohort.customers.add(email);
      if (orderHistory.filter((order) => order.email === email).length > 1) cohort.repeatCustomers.add(email);
      cohorts.set(key, cohort);
    }

    const demandForecast = products.map((product) => {
      const units = orders
        .flatMap((order) => order.items)
        .filter((item) => item.productId === product.id)
        .reduce((sum, item) => sum + item.quantity, 0);
      const dailyDemand = units / days;
      const leadTime = product.supplier?.leadTimeDays ?? 7;
      const reorderPoint = Math.ceil(dailyDemand * leadTime * 1.3);
      return {
        productId: product.id,
        name: product.name,
        inventory: product.inventory,
        unitsSold: units,
        dailyDemand: Number(dailyDemand.toFixed(2)),
        daysOfCover: dailyDemand ? Number((product.inventory / dailyDemand).toFixed(1)) : null,
        reorderPoint,
        recommendedOrder: Math.max(0, Math.ceil(dailyDemand * (leadTime + 21) - product.inventory)),
        supplier: product.supplier?.name ?? null
      };
    }).sort((a, b) => b.recommendedOrder - a.recommendedOrder);

    return {
      periodDays: days,
      funnel: funnel.map((stage, index) => ({
        ...stage,
        conversion: index && funnel[index - 1].value
          ? Number(((stage.value / funnel[index - 1].value) * 100).toFixed(1))
          : index ? 0 : 100
      })),
      topSearches: [...searches.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([query, count]) => ({ query, count })),
      sources: [...sources.values()]
        .map((source) => ({
          ...source,
          revenue: money(source.revenue),
          conversion: source.sessions ? Number(((source.orders / source.sessions) * 100).toFixed(1)) : 0
        }))
        .sort((a, b) => b.revenue - a.revenue),
      productSignals: [...productSignals.values()]
        .map((signal) => ({
          ...signal,
          revenue: money(signal.revenue),
          viewToCart: signal.views ? Number(((signal.carts / signal.views) * 100).toFixed(1)) : 0
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20),
      cohorts: [...cohorts.values()]
        .map((cohort) => ({
          cohort: cohort.cohort,
          customers: cohort.customers.size,
          repeatCustomers: cohort.repeatCustomers.size,
          repeatRate: cohort.customers.size
            ? Number(((cohort.repeatCustomers.size / cohort.customers.size) * 100).toFixed(1))
            : 0
        }))
        .sort((a, b) => b.cohort.localeCompare(a.cohort))
        .slice(0, 12),
      demandForecast
    };
  }

  auditLogs() {
    return this.prisma.auditLog.findMany({
      include: { actor: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 300
    });
  }

  staff() {
    return this.prisma.user.findMany({
      where: { role: { not: UserRole.CUSTOMER } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        permissions: true,
        accessRole: {
          select: { id: true, key: true, name: true, description: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });
  }

  async createStaff(actorId: string, dto: CreateStaffDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() }
    });
    if (exists) throw new ConflictException("An account already exists for this email.");
    if (!dto.accessRoleId) {
      throw new BadRequestException("An access role is required for every staff account.");
    }
    const accessRole = dto.accessRoleId
      ? await this.prisma.accessRole.findFirst({
          where: { id: dto.accessRoleId, isActive: true }
        })
      : null;
    if (dto.accessRoleId && !accessRole) {
      throw new BadRequestException("Select an active access role.");
    }
    if (accessRole?.key === "owner") {
      throw new ConflictException("Owner access cannot be assigned through staff creation.");
    }
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        passwordHash: await hashPassword(dto.password),
        role: UserRole.ADMIN,
        accessRoleId: accessRole?.id,
        permissions: dto.permissions?.length
          ? { create: dto.permissions.map((permission) => ({ permission })) }
          : undefined
      },
      include: { permissions: true, accessRole: true }
    });
    await this.audit(actorId, "staff.created", "User", user.id, {
      role: user.role,
      accessRoleId: user.accessRoleId
    });
    return user;
  }

  async updateStaff(actorId: string, id: string, dto: UpdateStaffDto) {
    if (id === actorId && dto.role === UserRole.CUSTOMER) {
      throw new ConflictException("You cannot remove your own administrator access.");
    }
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Staff member not found.");
    if (current.role === UserRole.OWNER) {
      throw new ConflictException("The owner account is protected.");
    }
    const accessRole = dto.accessRoleId
      ? await this.prisma.accessRole.findFirst({
          where: { id: dto.accessRoleId, isActive: true }
        })
      : null;
    if (dto.accessRoleId && !accessRole) {
      throw new BadRequestException("Select an active access role.");
    }
    if (accessRole?.key === "owner" || dto.role === UserRole.OWNER) {
      throw new ConflictException("Owner access cannot be assigned through staff management.");
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        role: dto.role,
        accessRoleId: dto.accessRoleId,
        isActive: dto.isActive
      },
      include: { permissions: true, accessRole: true }
    });
    if (dto.permissions) {
      await this.prisma.staffPermission.deleteMany({ where: { userId: id } });
      if (dto.permissions.length) {
        await this.prisma.staffPermission.createMany({
          data: dto.permissions.map((permission) => ({ userId: id, permission }))
        });
      }
    }
    await this.audit(actorId, "staff.updated", "User", id, {
      role: user.role,
      accessRoleId: user.accessRoleId
    });
    return user;
  }

  async deactivateStaff(actorId: string, id: string) {
    if (id === actorId) {
      throw new ConflictException("You cannot deactivate your own account.");
    }
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Staff member not found.");
    if (current.role === UserRole.OWNER) {
      throw new ConflictException("The owner account cannot be deactivated.");
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      include: { permissions: true, accessRole: true }
    });
    await this.audit(actorId, "staff.deactivated", "User", id);
    return user;
  }

  async sendStaffResetLink(actorId: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("Staff member not found.");
    await this.auth.issueResetToken(user);
    await this.audit(actorId, "staff.reset_link_sent", "User", id);
    return { sent: true };
  }

  private async audit(
    actorId: string | undefined,
    action: string,
    entity: string,
    entityId?: string,
    metadata?: Record<string, unknown>
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        metadata: metadata as Prisma.InputJsonValue | undefined
      }
    });
  }
}
