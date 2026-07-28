import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CheckoutMethodType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductStatus
} from "@prisma/client";
import {
  AdminUpdateBannerDto,
  AdminUpdateOrderDto,
  AdminUpdateProductDto,
  CheckoutDto,
  CreateBannerDto,
  CreateBrandDto,
  CreateCategoryDto,
  CreateCheckoutMethodDto,
  CreateHomeSectionDto,
  CreateProductDto,
  CreateTestimonialDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateCheckoutMethodDto,
  UpdateHomeSectionDto,
  UpdateOrderStatusDto,
  UpdateSiteSettingsDto,
  UpdateTestimonialDto
} from "./ecommerce.dto";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/auth.types";
import { ExperienceService } from "../experience/experience.service";
import { UpdateCustomerDto } from "../experience/experience.dto";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const percentageChange = (current: number, previous: number) => {
  if (!previous) return current ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const roundMoney = (value: number) => Number(value.toFixed(2));
const isRecognizedSale = (order: { paymentStatus?: PaymentStatus | null; status: OrderStatus }) =>
  order.paymentStatus === PaymentStatus.PAID || order.status === OrderStatus.DELIVERED;
const orderTransitions: Record<OrderStatus, OrderStatus[]> = {
  PLACED: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  PACKED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.OUT_FOR_DELIVERY],
  OUT_FOR_DELIVERY: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: []
};

@Injectable()
export class EcommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly experience: ExperienceService
  ) {}

  async home() {
    const now = new Date();
    const [
      banners,
      brands,
      categories,
      siteSettings,
      newlyLaunched,
      trendingProducts,
      topSellingProducts,
      comboDeals,
      certifiedProducts,
      justForYou,
      categoryProducts,
      featuredReviews,
      homeSections,
      testimonials,
      checkoutMethods
    ] = await Promise.all([
      this.prisma.banner.findMany({
        where: {
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
          ]
        },
        orderBy: [{ priority: "asc" }, { publishedAt: "desc" }]
      }),
      this.prisma.brand.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } }),
      this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }]
      }),
      this.siteSettings(),
      this.prisma.product.findMany({
        where: { status: "ACTIVE", isNew: true },
        include: { brand: true, category: true, images: true, variants: true },
        orderBy: { createdAt: "desc" },
        take: 10
      }),
      this.prisma.product.findMany({
        where: { status: "ACTIVE", isTrending: true },
        include: { brand: true, category: true, images: true, variants: true },
        orderBy: { updatedAt: "desc" },
        take: 10
      }),
      this.prisma.product.findMany({
        where: { status: "ACTIVE", isBestSelling: true },
        include: { brand: true, category: true, images: true, variants: true },
        orderBy: { updatedAt: "desc" },
        take: 4
      }),
      this.prisma.product.findMany({
        where: { status: "ACTIVE", isCombo: true, showOnHome: true },
        include: { brand: true, category: true, images: true, variants: true },
        orderBy: [{ comboPriority: "asc" }, { updatedAt: "desc" }],
        take: 1
      }),
      this.prisma.product.findMany({
        where: { status: "ACTIVE", isCertified: true },
        include: { brand: true, category: true, images: true, variants: true },
        orderBy: { updatedAt: "desc" },
        take: 10
      }),
      this.prisma.product.findMany({
        where: { status: "ACTIVE" },
        include: { brand: true, category: true, images: true, variants: true },
        orderBy: { createdAt: "desc" },
        take: 12
      }),
      this.prisma.product.findMany({
        where: { status: "ACTIVE", categoryId: { not: null } },
        include: { brand: true, category: true, images: true, variants: true },
        orderBy: [
          { isBestSelling: "desc" },
          { isNew: "desc" },
          { createdAt: "desc" }
        ],
        take: 250
      }),
      this.prisma.review.findMany({
        where: { status: "APPROVED", showOnHome: true },
        include: {
          user: { select: { name: true, avatarUrl: true } },
          product: { select: { name: true, slug: true } }
        },
        orderBy: [{ homePriority: "asc" }, { createdAt: "desc" }],
        take: 12
      }),
      this.prisma.homeSection.findMany({
        where: { isActive: true },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
      }),
      this.prisma.testimonial.findMany({
        where: { isActive: true },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }]
      }),
      this.checkoutMethods()
    ]);

    return {
      banners,
      brands,
      categories,
      siteSettings,
      newlyLaunched,
      trendingProducts,
      topSellingProducts,
      comboDeals,
      certifiedProducts,
      justForYou,
      categoryShowcase: categories.map((category) => {
        const products = categoryProducts.filter(
          (product) => product.categoryId === category.id
        );
        return {
          category,
          totalProducts: products.length,
          products: products.slice(0, 12)
        };
      }),
      featuredReviews,
      homeSections,
      testimonials,
      checkoutMethods
    };
  }

  async products(search?: string) {
    const where: Prisma.ProductWhereInput = {
      status: "ACTIVE",
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { tags: { has: search.toLowerCase() } }
            ]
          }
        : {})
    };

    return this.prisma.product.findMany({
      where,
      include: { brand: true, category: true, images: true, variants: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async comboDeals() {
    const combos = await this.prisma.product.findMany({
      where: { status: "ACTIVE", isCombo: true },
      include: {
        brand: true,
        category: true,
        images: { orderBy: { position: "asc" } },
        variants: { orderBy: { createdAt: "asc" } }
      },
      orderBy: [{ comboPriority: "asc" }, { updatedAt: "desc" }]
    });
    const componentIds = Array.from(
      new Set(combos.flatMap((combo) => combo.comboProductIds))
    );
    const components = componentIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: componentIds }, status: "ACTIVE" },
          select: { id: true, name: true, slug: true, imageUrl: true, price: true }
        })
      : [];
    const byId = new Map(components.map((product) => [product.id, product]));
    return combos.map((combo) => ({
      ...combo,
      comboProducts: combo.comboProductIds
        .map((id) => byId.get(id))
        .filter(Boolean)
    }));
  }

  async product(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        brand: true,
        category: true,
        images: { orderBy: { position: "asc" } },
        variants: { where: { isActive: true }, orderBy: { price: "asc" } },
        reviews: {
          where: { status: "APPROVED" },
          include: { user: { select: { name: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!product || product.status !== "ACTIVE") {
      throw new NotFoundException("Product not found.");
    }

    const comboProducts =
      product.isCombo && product.comboProductIds.length
        ? await this.prisma.product.findMany({
            where: { id: { in: product.comboProductIds }, status: "ACTIVE" },
            select: { id: true, name: true, slug: true, imageUrl: true, price: true }
          })
        : [];

    return { ...product, comboProducts };
  }

  checkoutMethods() {
    return this.prisma.checkoutMethod.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { priority: "asc" }, { name: "asc" }]
    });
  }

  async createBrand(dto: CreateBrandDto) {
    return this.prisma.brand.create({ data: dto });
  }

  async updateBrand(id: string, dto: UpdateBrandDto) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException("Brand not found.");
    return this.prisma.brand.update({
      where: { id },
      data: {
        ...dto,
        name: dto.name?.trim(),
        logoUrl: dto.logoUrl === undefined ? undefined : dto.logoUrl?.trim() || null,
        story: dto.story === undefined ? undefined : dto.story.trim() || null
      }
    });
  }

  async deleteBrand(id: string) {
    const products = await this.prisma.product.count({ where: { brandId: id } });
    if (products) {
      throw new BadRequestException("Reassign or archive this brand's products before deleting it.");
    }
    await this.prisma.brand.delete({ where: { id } });
    return { deleted: true };
  }

  async createCategory(dto: CreateCategoryDto) {
    const slugBase = slugify(dto.name);
    const count = await this.prisma.category.count({
      where: { slug: { startsWith: slugBase } }
    });

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug: count ? `${slugBase}-${count + 1}` : slugBase,
        icon: dto.icon,
        imageUrl: dto.imageUrl,
        priority: dto.priority ?? 0
      }
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("Category not found.");
    const nextName = dto.name?.trim();
    const nextSlug = nextName && nextName !== category.name ? slugify(nextName) : undefined;
    if (nextSlug) {
      const duplicate = await this.prisma.category.findFirst({
        where: { slug: nextSlug, id: { not: id } }
      });
      if (duplicate) throw new BadRequestException("A category with this name already exists.");
    }
    return this.prisma.category.update({
      where: { id },
      data: {
        ...dto,
        name: nextName,
        slug: nextSlug,
        icon: dto.icon === undefined ? undefined : dto.icon.trim() || null,
        imageUrl: dto.imageUrl === undefined ? undefined : dto.imageUrl.trim() || null
      }
    });
  }

  async deleteCategory(id: string) {
    const products = await this.prisma.product.count({ where: { categoryId: id } });
    if (products) {
      throw new BadRequestException("Reassign or archive this category's products before deleting it.");
    }
    await this.prisma.category.delete({ where: { id } });
    return { deleted: true };
  }

  async createBanner(dto: CreateBannerDto) {
    return this.prisma.banner.create({
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        focalX: dto.focalX ?? 50,
        focalY: dto.focalY ?? 50,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true
      }
    });
  }

  async siteSettings() {
    return this.prisma.siteSettings.upsert({
      where: { key: "default" },
      update: {},
      create: { key: "default" }
    });
  }

  async updateSiteSettings(dto: UpdateSiteSettingsDto) {
    return this.prisma.siteSettings.upsert({
      where: { key: "default" },
      update: {
        title: dto.title?.trim(),
        logoUrl: dto.logoUrl === undefined ? undefined : dto.logoUrl?.trim() || null,
        faviconUrl:
          dto.faviconUrl === undefined ? undefined : dto.faviconUrl?.trim() || null,
        announcement: dto.announcement?.trim(),
        announcementLinkLabel: dto.announcementLinkLabel?.trim(),
        announcementLinkHref: dto.announcementLinkHref?.trim(),
        facebookUrl:
          dto.facebookUrl === undefined ? undefined : dto.facebookUrl.trim() || null,
        instagramUrl:
          dto.instagramUrl === undefined ? undefined : dto.instagramUrl.trim() || null,
        youtubeUrl:
          dto.youtubeUrl === undefined ? undefined : dto.youtubeUrl.trim() || null,
        whatsappUrl:
          dto.whatsappUrl === undefined ? undefined : dto.whatsappUrl.trim() || null
      },
      create: {
        key: "default",
        title: dto.title?.trim() || "My Ecom",
        logoUrl: dto.logoUrl?.trim() || null,
        faviconUrl: dto.faviconUrl?.trim() || null,
        announcement: dto.announcement?.trim() || "Free delivery over \u09F33,000",
        announcementLinkLabel: dto.announcementLinkLabel?.trim() || "Track your order",
        announcementLinkHref: dto.announcementLinkHref?.trim() || "/track-order",
        facebookUrl: dto.facebookUrl?.trim() || null,
        instagramUrl: dto.instagramUrl?.trim() || null,
        youtubeUrl: dto.youtubeUrl?.trim() || null,
        whatsappUrl: dto.whatsappUrl?.trim() || null
      }
    });
  }

  async createProduct(dto: CreateProductDto) {
    if (dto.isCombo) await this.validateComboProducts(dto.comboProductIds ?? []);
    if (
      dto.isCombo &&
      dto.showOnHome &&
      (dto.status ?? ProductStatus.ACTIVE) === ProductStatus.ACTIVE
    ) {
      await this.prisma.product.updateMany({
        where: { isCombo: true, showOnHome: true },
        data: { showOnHome: false }
      });
    }
    const slugBase = slugify(dto.name);
    const count = await this.prisma.product.count({
      where: { slug: { startsWith: slugBase } }
    });

    const imageUrls = Array.from(
      new Set([dto.imageUrl, ...(dto.imageUrls ?? [])].filter(Boolean) as string[])
    );

    return this.prisma.product.create({
      data: {
        name: dto.name,
        slug: count ? `${slugBase}-${count + 1}` : slugBase,
        description: dto.description,
        price: dto.price,
        costPrice: dto.costPrice,
        compareAt: dto.compareAt,
        inventory: dto.inventory ?? 0,
        baseOptionEnabled: dto.baseOptionEnabled ?? true,
        baseOptionLabel: dto.baseOptionLabel?.trim() || null,
        imageUrl: imageUrls[0],
        isNew: dto.isNew ?? false,
        isTrending: dto.isTrending ?? false,
        isBestSelling: dto.isBestSelling ?? false,
        isCombo: dto.isCombo ?? false,
        comboProductIds: dto.isCombo ? Array.from(new Set(dto.comboProductIds ?? [])) : [],
        showOnHome:
          dto.isCombo && (dto.status ?? ProductStatus.ACTIVE) === ProductStatus.ACTIVE
            ? dto.showOnHome ?? false
            : false,
        comboPriority: dto.isCombo ? dto.comboPriority ?? 0 : 0,
        isCertified: dto.isCertified ?? false,
        badge: dto.badge,
        brandId: dto.brandId || undefined,
        categoryId: dto.categoryId || undefined,
        tags: dto.tags ?? [],
        status: dto.status ?? ProductStatus.ACTIVE,
        images: imageUrls.length
          ? {
              create: imageUrls.map((url, position) => ({
                url,
                alt: dto.name,
                position
              }))
            }
          : undefined
      },
      include: { brand: true, category: true, images: true, variants: true }
    });
  }

  async archiveProduct(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException("Product not found.");
    return this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED },
      include: { brand: true, category: true, images: true, variants: true }
    });
  }

  async createComboDeal(dto: CreateProductDto) {
    return this.createProduct({
      ...dto,
      isCombo: true,
      badge: dto.badge?.trim() || "Combo deal",
      tags: Array.from(new Set(["combo", ...(dto.tags ?? [])]))
    });
  }

  async updateComboDeal(id: string, dto: AdminUpdateProductDto) {
    const combo = await this.prisma.product.findUnique({ where: { id } });
    if (!combo || !combo.isCombo) throw new NotFoundException("Combo deal not found.");
    return this.adminUpdateProduct(id, { ...dto, isCombo: true });
  }

  async archiveComboDeal(id: string) {
    const combo = await this.prisma.product.findUnique({ where: { id } });
    if (!combo || !combo.isCombo) throw new NotFoundException("Combo deal not found.");
    const archived = await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED, showOnHome: false },
      include: { brand: true, category: true, images: true, variants: true }
    });
    return { archived: true, combo: archived };
  }

  private async validateComboProducts(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length < 2) {
      throw new BadRequestException("A combo deal must contain at least two products.");
    }
    const count = await this.prisma.product.count({
      where: { id: { in: uniqueIds }, isCombo: false, status: { not: ProductStatus.ARCHIVED } }
    });
    if (count !== uniqueIds.length) {
      throw new BadRequestException("One or more selected combo products are unavailable.");
    }
  }

  async createHomeSection(dto: CreateHomeSectionDto) {
    return this.prisma.homeSection.create({
      data: {
        ...dto,
        key: slugify(dto.key),
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        productLimit: dto.productLimit ?? 8,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true
      }
    });
  }

  async updateHomeSection(id: string, dto: UpdateHomeSectionDto) {
    return this.prisma.homeSection.update({
      where: { id },
      data: {
        ...dto,
        key: dto.key ? slugify(dto.key) : undefined,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined
      }
    });
  }

  async deleteHomeSection(id: string) {
    await this.prisma.homeSection.delete({ where: { id } });
    return { deleted: true };
  }

  async createTestimonial(dto: CreateTestimonialDto) {
    return this.prisma.testimonial.create({
      data: { ...dto, isActive: dto.isActive ?? true, priority: dto.priority ?? 0 }
    });
  }

  async updateTestimonial(id: string, dto: UpdateTestimonialDto) {
    return this.prisma.testimonial.update({ where: { id }, data: dto });
  }

  async deleteTestimonial(id: string) {
    await this.prisma.testimonial.delete({ where: { id } });
    return { deleted: true };
  }

  async createCheckoutMethod(dto: CreateCheckoutMethodDto) {
    return this.prisma.checkoutMethod.create({
      data: {
        ...dto,
        code: dto.code.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
        fee: dto.fee ?? 0,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true
      }
    });
  }

  async updateCheckoutMethod(id: string, dto: UpdateCheckoutMethodDto) {
    return this.prisma.checkoutMethod.update({
      where: { id },
      data: {
        ...dto,
        code: dto.code
          ? dto.code.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_")
          : undefined
      }
    });
  }

  async deleteCheckoutMethod(id: string) {
    await this.prisma.checkoutMethod.delete({ where: { id } });
    return { deleted: true };
  }

  async checkout(dto: CheckoutDto, authUser?: AuthUser) {
    if (!dto.items.length) {
      throw new BadRequestException("Checkout requires at least one item.");
    }

    if (dto.idempotencyKey) {
      const existing = await this.prisma.checkoutRequest.findUnique({
        where: { key: dto.idempotencyKey },
        include: {
          order: {
            include: {
              items: true,
              payments: true,
              promotion: { select: { code: true, name: true } },
              trackingEvents: { orderBy: { createdAt: "asc" } },
              notifications: true
            }
          }
        }
      });
      if (existing) return existing.order;
      const legacyOrder = await this.prisma.order.findFirst({
        where: { idempotencyKey: dto.idempotencyKey },
        include: {
          items: true,
          payments: true,
          promotion: { select: { code: true, name: true } },
          trackingEvents: { orderBy: { createdAt: "asc" } },
          notifications: true
        }
      });
      if (legacyOrder) return legacyOrder;
    }

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const variantIds = dto.items.flatMap((item) => item.variantId ? [item.variantId] : []);
    const [products, variants, session] = await Promise.all([
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
        where: { id: { in: variantIds }, isActive: true }
      }),
      dto.sessionKey
        ? this.prisma.analyticsSession.findUnique({ where: { sessionKey: dto.sessionKey } })
        : null
    ]);

    if (products.length !== productIds.length || variants.length !== variantIds.length) {
      throw new BadRequestException("Some checkout products are unavailable.");
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    const subtotal = dto.items.reduce((total, item) => {
      const product = productMap.get(item.productId);
      const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
      if (variant && variant.productId !== item.productId) {
        throw new BadRequestException("A selected product option is invalid.");
      }
      if (product?.variants.length && product.baseOptionEnabled === false && !item.variantId) {
        throw new BadRequestException(`${product.name} requires an option selection.`);
      }
      const available = variant?.inventory ?? product?.inventory ?? 0;
      if (!product || available < item.quantity) {
        throw new BadRequestException(`${product?.name ?? "A product"} does not have enough stock.`);
      }
      return total + (variant?.price ?? product.price) * item.quantity;
    }, 0);
    const promotion = dto.promotionCode
      ? await this.experience.findValidPromotion(dto.promotionCode, subtotal, dto.email)
      : null;
    const discount = promotion
      ? this.experience.promotionDiscount(promotion, subtotal)
      : 0;
    const configuredMethods = await this.checkoutMethods();
    const paymentMethods = configuredMethods.filter(
      (method) => method.type === CheckoutMethodType.PAYMENT
    );
    const deliveryMethods = configuredMethods.filter(
      (method) => method.type === CheckoutMethodType.DELIVERY
    );
    const requestedPayment = dto.paymentMethod?.trim();
    const paymentConfig = requestedPayment
      ? paymentMethods.find(
          (method) =>
            method.code === requestedPayment.toUpperCase() ||
            method.name.toLowerCase() === requestedPayment.toLowerCase()
        )
      : paymentMethods[0];
    const deliveryConfig = dto.deliveryMethodCode
      ? deliveryMethods.find(
          (method) => method.code === dto.deliveryMethodCode?.trim().toUpperCase()
        )
      : deliveryMethods[0];
    if (paymentMethods.length && !paymentConfig) {
      throw new BadRequestException("The selected payment method is unavailable.");
    }
    if (deliveryMethods.length && !deliveryConfig) {
      throw new BadRequestException("The selected delivery method is unavailable.");
    }
    const deliveryFee = deliveryConfig?.fee ?? 80;
    const deliveryFreeThreshold = deliveryConfig?.freeThreshold ?? 3000;
    const shippingFee =
      promotion?.type === "FREE_SHIPPING" ||
      (deliveryFreeThreshold > 0 && subtotal - discount >= deliveryFreeThreshold)
        ? 0
        : deliveryFee;
    const orderNumber = `ME-${Date.now().toString().slice(-8)}`;
    const paymentMethod = paymentConfig?.name ?? requestedPayment ?? "Cash on delivery";

    try {
      return await this.prisma.$transaction(async (transaction) => {
      for (const item of dto.items) {
        const updated = item.variantId
          ? await transaction.productVariant.updateMany({
              where: {
                id: item.variantId,
                isActive: true,
                inventory: { gte: item.quantity }
              },
              data: { inventory: { decrement: item.quantity } }
            })
          : await transaction.product.updateMany({
              where: {
                id: item.productId,
                status: "ACTIVE",
                inventory: { gte: item.quantity }
              },
              data: { inventory: { decrement: item.quantity } }
            });
        if (updated.count !== 1) {
          throw new BadRequestException("Product inventory changed. Review your cart and try again.");
        }
        await transaction.inventoryMovement.create({
          data: {
            productId: item.productId,
            variantId: item.variantId,
            type: "SALE",
            quantity: -item.quantity,
            reason: `Sold in ${orderNumber}`,
            reference: orderNumber
          }
        });
      }

      const order = await transaction.order.create({
        data: {
          orderNumber,
          idempotencyKey: dto.idempotencyKey,
          userId: authUser?.id,
          customerName: dto.customerName,
          email: dto.email,
          phone: dto.phone,
          shippingAddress: dto.shippingAddress,
          paymentStatus: "PENDING",
          paymentMethod,
          deliveryMethodCode: deliveryConfig?.code,
          deliveryMethodName: deliveryConfig?.name,
          promotionId: promotion?.id,
          subtotal,
          discount,
          shippingFee,
          total: subtotal - discount + shippingFee,
          items: {
            create: dto.items.map((item) => {
              const product = productMap.get(item.productId)!;
              const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
              return {
                productId: item.productId,
                productName: product.name,
                variantId: variant?.id,
                variantName: variant?.name,
                quantity: item.quantity,
                unitPrice: variant?.price ?? product.price,
                unitCost: variant?.costPrice ?? product.costPrice
              };
            })
          },
          trackingEvents: {
            create: {
              status: "PLACED",
              location: "Online checkout",
              note: "Order placed successfully."
            }
          },
          notifications: {
            create: {
              email: dto.email,
              title: "Order placed",
              message: `Your order ${orderNumber} has been received.`
            }
          },
          payments: {
            create: {
              provider:
                paymentConfig?.code === "BKASH"
                  ? "bkash"
                  : paymentMethod === "Cash on delivery"
                    ? "cash"
                    : "pending-gateway",
              method: paymentMethod,
              amount: subtotal - discount + shippingFee,
              status: "PENDING"
            }
          },
          ...(promotion
            ? {
                couponRedemptions: {
                  create: {
                    promotionId: promotion.id,
                    email: dto.email,
                    discount
                  }
                }
              }
            : {}),
          ...(session
            ? {
                attribution: {
                  create: {
                    sessionId: session.id,
                    source: session.source,
                    medium: session.medium,
                    campaign: session.campaign
                  }
                }
              }
            : {})
        },
        include: {
          items: true,
          payments: true,
          promotion: { select: { code: true, name: true } },
          trackingEvents: { orderBy: { createdAt: "asc" } },
          notifications: true
        }
      });

      if (session) {
        await transaction.analyticsEvent.create({
          data: {
            type: "CHECKOUT_COMPLETED",
            sessionId: session.id,
            userId: authUser?.id,
            orderId: order.id,
            metadata: { total: order.total, discount }
          }
        });
      }
      if (authUser?.id) {
        const cart = await transaction.cart.findFirst({ where: { userId: authUser.id } });
        if (cart) await transaction.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
      if (dto.idempotencyKey) {
        await transaction.checkoutRequest.create({
          data: { key: dto.idempotencyKey, orderId: order.id }
        });
      }
      return order;
      });
    } catch (error) {
      if (
        dto.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.prisma.checkoutRequest.findUnique({
          where: { key: dto.idempotencyKey },
          include: {
            order: {
              include: {
                items: true,
                payments: true,
                promotion: { select: { code: true, name: true } },
                trackingEvents: { orderBy: { createdAt: "asc" } },
                notifications: true
              }
            }
          }
        });
        if (existing) return existing.order;
      }
      throw error;
    }
  }

  async adminCreateOrder(dto: CheckoutDto, actorId: string) {
    const order = await this.checkout(
      {
        ...dto,
        idempotencyKey:
          dto.idempotencyKey ?? `admin-${actorId}-${Date.now()}`
      },
      undefined
    );
    await this.prisma.$transaction([
      this.prisma.trackingEvent.updateMany({
        where: { orderId: order.id, status: OrderStatus.PLACED },
        data: {
          location: "Admin dashboard",
          note: "Order created by store staff."
        }
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: "order.created",
          entity: "Order",
          entityId: order.id,
          metadata: { orderNumber: order.orderNumber, total: order.total }
        }
      })
    ]);
    return this.adminOrder(order.id);
  }

  async order(idOrNumber: string, email?: string) {
    if (!email) {
      throw new BadRequestException("Order email is required.");
    }

    const identifiers: Prisma.OrderWhereInput[] = [{ orderNumber: idOrNumber }];
    if (/^[a-f\d]{24}$/i.test(idOrNumber)) identifiers.push({ id: idOrNumber });

    const order = await this.prisma.order.findFirst({
      where: {
        email: email.toLowerCase(),
        OR: identifiers
      },
      include: {
        items: true,
        promotion: { select: { code: true, name: true } },
        trackingEvents: { orderBy: { createdAt: "asc" } },
        notifications: { orderBy: { createdAt: "desc" } }
      }
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    return order;
  }

  async updateOrderStatus(
    idOrNumber: string,
    dto: UpdateOrderStatusDto,
    allowCancellation = false
  ) {
    if (!Object.values(OrderStatus).includes(dto.status as OrderStatus)) {
      throw new BadRequestException("Invalid order status.");
    }

    const identifiers: Prisma.OrderWhereInput[] = [{ orderNumber: idOrNumber }];
    if (/^[a-f\d]{24}$/i.test(idOrNumber)) identifiers.push({ id: idOrNumber });

    const current = await this.prisma.order.findFirst({
      where: { OR: identifiers },
      include: { items: true, payments: true }
    });
    if (!current) throw new NotFoundException("Order not found.");
    const nextStatus = dto.status as OrderStatus;
    if (nextStatus === OrderStatus.CANCELLED && !allowCancellation) {
      throw new BadRequestException("Use the cancel-order action to cancel an order.");
    }
    if (nextStatus === current.status) return this.adminOrder(current.id);
    if (!orderTransitions[current.status].includes(nextStatus)) {
      throw new BadRequestException(
        `Order cannot move from ${current.status} to ${nextStatus}.`
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      if (nextStatus === OrderStatus.CANCELLED) {
        for (const item of current.items) {
          if (item.variantId) {
            await transaction.productVariant.update({
              where: { id: item.variantId },
              data: { inventory: { increment: item.quantity } }
            });
          } else {
            await transaction.product.update({
              where: { id: item.productId },
              data: { inventory: { increment: item.quantity } }
            });
          }
          await transaction.inventoryMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId,
              type: "RELEASE",
              quantity: item.quantity,
              reason: `Cancelled ${current.orderNumber}`,
              reference: current.orderNumber
            }
          });
        }
        await transaction.payment.updateMany({
          where: { orderId: current.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.FAILED }
        });
        await transaction.couponRedemption.deleteMany({
          where: { orderId: current.id }
        });
        const paidPayment = current.payments.find(
          (payment) => payment.status === PaymentStatus.PAID
        );
        if (paidPayment) {
          await transaction.refund.create({
            data: {
              orderId: current.id,
              paymentId: paidPayment.id,
              amount: current.total,
              reason: "Order cancelled",
              status: "PENDING"
            }
          });
        }
      }

      return transaction.order.update({
        where: { id: current.id },
        data: {
          status: nextStatus,
          paymentStatus:
            nextStatus === OrderStatus.CANCELLED &&
            current.paymentStatus === PaymentStatus.PENDING
              ? PaymentStatus.FAILED
              : undefined,
          trackingEvents: {
            create: {
              status: nextStatus,
              location: dto.location ?? "Fulfillment center",
              note:
                dto.note ??
                `Order moved to ${nextStatus.toLowerCase().replace(/_/g, " ")}.`
            }
          },
          notifications: {
            create: {
              email: current.email,
              title: "Order update",
              message: `${current.orderNumber} is now ${nextStatus.toLowerCase().replace(/_/g, " ")}.`
            }
          }
        },
        include: {
          items: true,
          payments: true,
          promotion: { select: { code: true, name: true } },
          trackingEvents: { orderBy: { createdAt: "asc" } },
          notifications: { orderBy: { createdAt: "desc" } }
        }
      });
    });
  }

  async adminDashboard(daysInput?: string) {
    const days = Math.min(365, Math.max(7, Number(daysInput) || 30));
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    const comparisonStart = new Date(start);
    comparisonStart.setDate(comparisonStart.getDate() - days);
    const todayStart = new Date(end);
    todayStart.setHours(0, 0, 0, 0);
    const activeCutoff = new Date(end.getTime() - 15 * 60 * 1000);

    const [
      currentOrders,
      previousOrders,
      allOrders,
      products,
      newCustomers,
      periodVisitors,
      visitorsToday,
      activeVisitors,
      lifetimeVisitors
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: {
          items: true,
          trackingEvents: { orderBy: { createdAt: "asc" } }
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: comparisonStart, lt: start } },
        include: { items: true }
      }),
      this.prisma.order.findMany({
        select: {
          id: true,
          email: true,
          customerName: true,
          total: true,
          status: true,
          paymentStatus: true,
          createdAt: true
        }
      }),
      this.prisma.product.findMany({
        include: { category: true, brand: true },
        orderBy: { inventory: "asc" }
      }),
      this.prisma.user.count({
        where: { role: "CUSTOMER", createdAt: { gte: start, lte: end } }
      }),
      this.prisma.analyticsSession.count({ where: { createdAt: { gte: start, lte: end } } }),
      this.prisma.analyticsSession.count({ where: { createdAt: { gte: todayStart, lte: end } } }),
      this.prisma.analyticsSession.count({ where: { lastSeenAt: { gte: activeCutoff, lte: end } } }),
      this.prisma.analyticsSession.count()
    ]);

    const validCurrent = currentOrders.filter((order) => order.status !== "CANCELLED");
    const validPrevious = previousOrders.filter((order) => order.status !== "CANCELLED");
    const recognizedCurrent = validCurrent.filter(isRecognizedSale);
    const recognizedPrevious = validPrevious.filter(isRecognizedSale);
    const revenue = recognizedCurrent.reduce((sum, order) => sum + order.total, 0);
    const previousRevenue = recognizedPrevious.reduce((sum, order) => sum + order.total, 0);
    const unitsSold = recognizedCurrent.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );
    const previousUnits = recognizedPrevious.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );
    const uniqueCustomers = new Set(validCurrent.map((order) => order.email.toLowerCase())).size;
    const previousCustomers = new Set(validPrevious.map((order) => order.email.toLowerCase())).size;
    const averageOrderValue = recognizedCurrent.length ? revenue / recognizedCurrent.length : 0;
    const previousAverage = recognizedPrevious.length ? previousRevenue / recognizedPrevious.length : 0;

    let knownRevenue = 0;
    let knownCost = 0;
    let totalRevenueForCoverage = 0;
    for (const order of recognizedCurrent) {
      for (const item of order.items) {
        const lineRevenue = item.unitPrice * item.quantity;
        totalRevenueForCoverage += lineRevenue;
        if (item.unitCost != null) {
          knownRevenue += lineRevenue;
          knownCost += item.unitCost * item.quantity;
        }
      }
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const productPerformance = new Map<
      string,
      { productId: string; name: string; units: number; revenue: number; orders: Set<string> }
    >();
    const categoryPerformance = new Map<string, { name: string; units: number; revenue: number }>();

    for (const order of recognizedCurrent) {
      for (const item of order.items) {
        const performance = productPerformance.get(item.productId) ?? {
          productId: item.productId,
          name: item.productName,
          units: 0,
          revenue: 0,
          orders: new Set<string>()
        };
        performance.units += item.quantity;
        performance.revenue += item.unitPrice * item.quantity;
        performance.orders.add(order.id);
        productPerformance.set(item.productId, performance);

        const categoryName = productById.get(item.productId)?.category?.name ?? "Uncategorized";
        const category = categoryPerformance.get(categoryName) ?? {
          name: categoryName,
          units: 0,
          revenue: 0
        };
        category.units += item.quantity;
        category.revenue += item.unitPrice * item.quantity;
        categoryPerformance.set(categoryName, category);
      }
    }

    const topProducts = [...productPerformance.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
      .map((item) => ({
        productId: item.productId,
        name: item.name,
        units: item.units,
        revenue: roundMoney(item.revenue),
        orders: item.orders.size,
        inventory: productById.get(item.productId)?.inventory ?? 0
      }));

    const lowStock = products
      .filter((product) => product.status === "ACTIVE" && product.inventory <= 20)
      .slice(0, 10)
      .map((product) => {
        const soldUnits = productPerformance.get(product.id)?.units ?? 0;
        return {
          id: product.id,
          name: product.name,
          inventory: product.inventory,
          soldUnits,
          stockValue: roundMoney(product.inventory * (product.costPrice ?? product.price)),
          reorderSuggested: Math.max(0, soldUnits * 2 - product.inventory)
        };
      });

    const customerOrderCounts = new Map<string, number>();
    const customerTotals = new Map<
      string,
      { email: string; name: string; orders: number; spend: number; lastOrderAt: Date }
    >();
    for (const order of allOrders.filter((item) => item.status !== "CANCELLED")) {
      const email = order.email.toLowerCase();
      customerOrderCounts.set(email, (customerOrderCounts.get(email) ?? 0) + 1);
      const customer = customerTotals.get(email) ?? {
        email,
        name: order.customerName,
        orders: 0,
        spend: 0,
        lastOrderAt: order.createdAt
      };
      customer.orders += 1;
      if (isRecognizedSale(order)) customer.spend += order.total;
      if (order.createdAt > customer.lastOrderAt) customer.lastOrderAt = order.createdAt;
      customerTotals.set(email, customer);
    }
    const returningCustomers = [...new Set(validCurrent.map((order) => order.email.toLowerCase()))]
      .filter((email) => (customerOrderCounts.get(email) ?? 0) > 1).length;

    const statusBreakdown = Object.values(OrderStatus).map((status) => {
      const orders = currentOrders.filter((order) => order.status === status);
      return {
        status,
        count: orders.length,
        value: roundMoney(orders.reduce((sum, order) => sum + order.total, 0))
      };
    });

    const bucketCount = Math.min(days, 30);
    const bucketDays = Math.ceil(days / bucketCount);
    const salesTrend = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = new Date(start);
      bucketStart.setDate(bucketStart.getDate() + index * bucketDays);
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setDate(bucketEnd.getDate() + bucketDays);
      const bucketOrders = validCurrent.filter(
        (order) => order.createdAt >= bucketStart && order.createdAt < bucketEnd
      );
      const recognizedBucketOrders = bucketOrders.filter(isRecognizedSale);
      return {
        date: bucketStart.toISOString(),
        revenue: roundMoney(recognizedBucketOrders.reduce((sum, order) => sum + order.total, 0)),
        orders: bucketOrders.length
      };
    }).filter((bucket) => new Date(bucket.date) <= end);

    const unfulfilled = currentOrders.filter(
      (order) => !["DELIVERED", "CANCELLED"].includes(order.status)
    );
    const ageingOrders = unfulfilled.filter(
      (order) => end.getTime() - order.createdAt.getTime() > 48 * 60 * 60 * 1000
    ).length;
    const deliveredHours = currentOrders
      .filter((order) => order.status === "DELIVERED")
      .map((order) => {
        const delivered = order.trackingEvents.find((event) => event.status === "DELIVERED");
        return delivered
          ? (delivered.createdAt.getTime() - order.createdAt.getTime()) / (60 * 60 * 1000)
          : null;
      })
      .filter((hours): hours is number => hours != null);
    const cancelledCount = currentOrders.filter((order) => order.status === "CANCELLED").length;
    const cancelledRate = currentOrders.length ? (cancelledCount / currentOrders.length) * 100 : 0;
    const repeatRate = uniqueCustomers ? (returningCustomers / uniqueCustomers) * 100 : 0;
    const topProductShare = revenue && topProducts[0] ? (topProducts[0].revenue / revenue) * 100 : 0;
    const costCoverage = totalRevenueForCoverage
      ? (knownRevenue / totalRevenueForCoverage) * 100
      : 0;
    const projected30DayRevenue = (revenue / days) * 30;

    const insights: Array<{
      severity: "attention" | "opportunity" | "positive";
      title: string;
      detail: string;
      action: string;
    }> = [];
    if (ageingOrders) {
      insights.push({
        severity: "attention",
        title: `${ageingOrders} order${ageingOrders === 1 ? "" : "s"} need attention`,
        detail: "These unfulfilled orders have been open for more than 48 hours.",
        action: "Review the order queue and update fulfillment."
      });
    }
    if (lowStock.length) {
      insights.push({
        severity: "attention",
        title: `${lowStock.length} active products are low on stock`,
        detail: "Inventory at or below 20 units can interrupt sales.",
        action: "Review replenishment in Inventory."
      });
    }
    if (repeatRate < 20 && uniqueCustomers) {
      insights.push({
        severity: "opportunity",
        title: "Repeat purchase rate has room to grow",
        detail: `${repeatRate.toFixed(1)}% of active customers have ordered more than once.`,
        action: "Plan a reorder campaign for recent buyers."
      });
    }
    if (topProductShare > 40 && topProducts[0]) {
      insights.push({
        severity: "opportunity",
        title: "Sales are concentrated in one product",
        detail: `${topProducts[0].name} contributes ${topProductShare.toFixed(1)}% of period sales.`,
        action: "Promote complementary products and bundles."
      });
    }
    if (costCoverage < 80 && totalRevenueForCoverage) {
      insights.push({
        severity: "opportunity",
        title: "Margin reporting needs more cost data",
        detail: `${costCoverage.toFixed(0)}% of product revenue has a recorded cost basis.`,
        action: "Add cost prices in Inventory for reliable profit decisions."
      });
    }
    if (percentageChange(revenue, previousRevenue) > 0) {
      insights.push({
        severity: "positive",
        title: "Sales momentum is positive",
        detail: `Net sales are ${percentageChange(revenue, previousRevenue).toFixed(1)}% above the previous period.`,
        action: "Protect availability for the products driving growth."
      });
    }

    return {
      period: {
        days,
        start: start.toISOString(),
        end: end.toISOString(),
        comparisonStart: comparisonStart.toISOString()
      },
      kpis: {
        revenue: { value: roundMoney(revenue), change: percentageChange(revenue, previousRevenue) },
        orders: {
          value: validCurrent.length,
          change: percentageChange(validCurrent.length, validPrevious.length)
        },
        averageOrderValue: {
          value: roundMoney(averageOrderValue),
          change: percentageChange(averageOrderValue, previousAverage)
        },
        customers: {
          value: uniqueCustomers,
          change: percentageChange(uniqueCustomers, previousCustomers)
        },
        unitsSold: { value: unitsSold, change: percentageChange(unitsSold, previousUnits) },
        grossProfit: {
          value: roundMoney(knownRevenue - knownCost),
          margin: knownRevenue ? Number((((knownRevenue - knownCost) / knownRevenue) * 100).toFixed(1)) : 0,
          coverage: Number(costCoverage.toFixed(1))
        }
      },
      forecast: {
        projected30DayRevenue: roundMoney(projected30DayRevenue),
        dailyRunRate: roundMoney(revenue / days),
        basis: `${days}-day run rate`
      },
      traffic: {
        newOrdersToday: currentOrders.filter((order) => order.createdAt >= todayStart).length,
        newOrderQueue: allOrders.filter((order) => order.status === OrderStatus.PLACED).length,
        visitorsToday,
        activeVisitors,
        lifetimeVisitors,
        periodVisitors,
        activeWindowMinutes: 15
      },
      salesTrend,
      statusBreakdown,
      topProducts,
      categoryPerformance: [...categoryPerformance.values()]
        .sort((a, b) => b.revenue - a.revenue)
        .map((category) => ({ ...category, revenue: roundMoney(category.revenue) })),
      lowStock,
      customerInsights: {
        newCustomers,
        returningCustomers,
        repeatRate: Number(repeatRate.toFixed(1)),
        topCustomers: [...customerTotals.values()]
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 8)
          .map((customer) => ({ ...customer, spend: roundMoney(customer.spend) }))
      },
      operations: {
        unfulfilled: unfulfilled.length,
        awaitingPayment: currentOrders.filter(
          (order) => (order.paymentStatus ?? "PENDING") === "PENDING" && order.status !== "CANCELLED"
        ).length,
        ageingOrders,
        cancelledRate: Number(cancelledRate.toFixed(1)),
        averageFulfillmentHours: deliveredHours.length
          ? Number((deliveredHours.reduce((sum, hours) => sum + hours, 0) / deliveredHours.length).toFixed(1))
          : null
      },
      recentOrders: currentOrders.slice(0, 8),
      insights
    };
  }

  async adminOrders(query: {
    search?: string;
    status?: string;
    paymentStatus?: string;
    page?: string;
    limit?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(query.limit) || 25));
    const where: Prisma.OrderWhereInput = {};

    if (query.status && Object.values(OrderStatus).includes(query.status as OrderStatus)) {
      where.status = query.status as OrderStatus;
    }
    if (
      query.paymentStatus &&
      Object.values(PaymentStatus).includes(query.paymentStatus as PaymentStatus)
    ) {
      where.paymentStatus = query.paymentStatus as PaymentStatus;
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } }
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          promotion: { select: { code: true, name: true } },
          trackingEvents: { orderBy: { createdAt: "asc" } }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.order.count({ where })
    ]);

    return {
      orders,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
    };
  }

  async adminOrder(idOrNumber: string) {
    const identifiers: Prisma.OrderWhereInput[] = [{ orderNumber: idOrNumber }];
    if (/^[a-f\d]{24}$/i.test(idOrNumber)) identifiers.push({ id: idOrNumber });
    const order = await this.prisma.order.findFirst({
      where: { OR: identifiers },
      include: {
        items: true,
        promotion: { select: { code: true, name: true } },
        trackingEvents: { orderBy: { createdAt: "asc" } },
        notifications: { orderBy: { createdAt: "desc" } }
      }
    });
    if (!order) throw new NotFoundException("Order not found.");
    return order;
  }

  async adminUpdateOrder(idOrNumber: string, dto: AdminUpdateOrderDto, actorId: string) {
    if (dto.status === OrderStatus.CANCELLED) {
      throw new BadRequestException("Use the cancel-order action to cancel an order.");
    }
    let current = await this.adminOrder(idOrNumber);
    const before = {
      status: current.status,
      paymentStatus: current.paymentStatus,
      paymentMethod: current.paymentMethod,
      trackingCode: current.trackingCode,
      courierName: current.courierName
    };
    const statusChanged = dto.status && dto.status !== current.status;
    if (
      (dto.status ?? current.status) === OrderStatus.CANCELLED &&
      dto.paymentStatus === PaymentStatus.PAID
    ) {
      throw new BadRequestException("A cancelled order cannot be marked paid.");
    }
    if (statusChanged) {
      current = await this.updateOrderStatus(current.id, {
        status: dto.status!,
        location: dto.location,
        note: dto.note
      });
    }
    const updated = await this.prisma.order.update({
      where: { id: current.id },
      data: {
        status: undefined,
        paymentStatus:
          current.status === OrderStatus.CANCELLED &&
          dto.paymentStatus === PaymentStatus.PENDING
            ? undefined
            : dto.paymentStatus,
        paymentMethod: dto.paymentMethod === undefined ? undefined : dto.paymentMethod.trim() || null,
        trackingCode: dto.trackingCode === undefined ? undefined : dto.trackingCode.trim() || null,
        courierName: dto.courierName === undefined ? undefined : dto.courierName.trim() || null,
        adminNote: dto.adminNote === undefined ? undefined : dto.adminNote.trim() || null
      },
      include: {
        items: true,
        promotion: { select: { code: true, name: true } },
        trackingEvents: { orderBy: { createdAt: "asc" } },
        notifications: { orderBy: { createdAt: "desc" } }
      }
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: "order.updated",
        entity: "Order",
        entityId: updated.id,
        metadata: {
          orderNumber: updated.orderNumber,
          before,
          after: {
            status: updated.status,
            paymentStatus: updated.paymentStatus,
            paymentMethod: updated.paymentMethod,
            trackingCode: updated.trackingCode,
            courierName: updated.courierName
          }
        }
      }
    });
    return updated;
  }

  async adminCancelOrder(idOrNumber: string) {
    return this.updateOrderStatus(idOrNumber, {
      status: OrderStatus.CANCELLED,
      location: "Admin dashboard",
      note: "Order cancelled by store staff."
    }, true);
  }

  async customerCancelOrder(idOrNumber: string, authUser: AuthUser) {
    const identifiers: Prisma.OrderWhereInput[] = [{ orderNumber: idOrNumber }];
    if (/^[a-f\d]{24}$/i.test(idOrNumber)) identifiers.push({ id: idOrNumber });
    const current = await this.prisma.order.findFirst({ where: { OR: identifiers } });
    if (!current) throw new NotFoundException("Order not found.");
    if (current.userId !== authUser.id) {
      throw new BadRequestException("This order does not belong to your account.");
    }
    if (!["PLACED", "CONFIRMED"].includes(current.status)) {
      throw new BadRequestException(
        "This order is already being prepared for delivery and can no longer be cancelled here — start a return instead once it arrives."
      );
    }
    return this.updateOrderStatus(idOrNumber, {
      status: OrderStatus.CANCELLED,
      location: "Customer",
      note: "Order cancelled by the customer before shipment."
    }, true);
  }

  async adminCatalog() {
    const [products, brands, categories, banners, homeSections, testimonials, checkoutMethods, siteSettings] =
      await Promise.all([
      this.prisma.product.findMany({
        include: {
          brand: true,
          category: true,
          images: { orderBy: { position: "asc" } },
          variants: { orderBy: { createdAt: "asc" } }
        },
        orderBy: { updatedAt: "desc" }
      }),
      this.prisma.brand.findMany({ orderBy: { createdAt: "desc" } }),
      this.prisma.category.findMany({ orderBy: [{ priority: "asc" }, { name: "asc" }] }),
      this.prisma.banner.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "desc" }] }),
      this.prisma.homeSection.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "asc" }] }),
      this.prisma.testimonial.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "desc" }] }),
      this.prisma.checkoutMethod.findMany({
        orderBy: [{ type: "asc" }, { priority: "asc" }, { name: "asc" }]
      }),
      this.siteSettings()
    ]);
    return {
      products,
      brands,
      categories,
      banners,
      homeSections,
      testimonials,
      checkoutMethods,
      siteSettings
    };
  }

  async adminUpdateProduct(id: string, dto: AdminUpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException("Product not found.");
    const { imageUrls, ...productUpdate } = dto;
    const willBeCombo = dto.isCombo ?? product.isCombo;
    const comboProductIds = dto.comboProductIds ?? product.comboProductIds;
    if (willBeCombo && dto.comboProductIds) {
      await this.validateComboProducts(dto.comboProductIds);
    }
    if (
      willBeCombo &&
      dto.showOnHome &&
      (dto.status ?? product.status) === ProductStatus.ACTIVE
    ) {
      await this.prisma.product.updateMany({
        where: { id: { not: id }, isCombo: true, showOnHome: true },
        data: { showOnHome: false }
      });
    }
    return this.prisma.product.update({
      where: { id },
      data: {
        ...productUpdate,
        comboProductIds: willBeCombo ? Array.from(new Set(comboProductIds)) : [],
        showOnHome:
          willBeCombo && (dto.status ?? product.status) === ProductStatus.ACTIVE
            ? dto.showOnHome
            : false,
        comboPriority: willBeCombo ? dto.comboPriority : 0,
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        baseOptionLabel:
          dto.baseOptionLabel === undefined ? undefined : dto.baseOptionLabel.trim() || null,
        imageUrl:
          imageUrls === undefined
            ? dto.imageUrl === undefined
              ? undefined
              : dto.imageUrl.trim() || null
            : imageUrls[0]?.trim() || null,
        badge: dto.badge === undefined ? undefined : dto.badge.trim() || null,
        brandId: dto.brandId === undefined ? undefined : dto.brandId || null,
        categoryId: dto.categoryId === undefined ? undefined : dto.categoryId || null,
        images:
          imageUrls === undefined
            ? undefined
            : {
                deleteMany: {},
                create: Array.from(new Set(imageUrls.filter(Boolean))).map((url, position) => ({
                  url,
                  alt: dto.name?.trim() || product.name,
                  position
                }))
              }
      },
      include: {
        brand: true,
        category: true,
        images: { orderBy: { position: "asc" } },
        variants: { orderBy: { createdAt: "asc" } }
      }
    });
  }

  async adminUpdateBanner(id: string, dto: AdminUpdateBannerDto) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException("Banner not found.");
    if ((dto.isActive ?? banner.isActive) && !(dto.imageUrl ?? banner.imageUrl)) {
      throw new BadRequestException("Upload a campaign image before publishing this banner.");
    }
    return this.prisma.banner.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt === undefined ? undefined : dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt === undefined ? undefined : dto.endsAt ? new Date(dto.endsAt) : null
      }
    });
  }

  async adminDeleteBanner(id: string) {
    await this.prisma.banner.delete({ where: { id } });
    return { deleted: true };
  }

  async adminCustomers(search?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        role: "CUSTOMER",
        ...(search?.trim()
          ? {
              OR: [
                { name: { contains: search.trim(), mode: "insensitive" } },
                { email: { contains: search.trim(), mode: "insensitive" } },
                { phone: { contains: search.trim(), mode: "insensitive" } }
              ]
            }
          : {})
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    const emails = users.map((user) => user.email);
    const orders = await this.prisma.order.findMany({
      where: { email: { in: emails }, status: { not: "CANCELLED" } },
      select: {
        email: true,
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true
      }
    });
    return users.map((user) => {
      const customerOrders = orders.filter(
        (order) => order.email.toLowerCase() === user.email.toLowerCase()
      );
      return {
        ...user,
        orders: customerOrders.length,
        lifetimeSpend: roundMoney(
          customerOrders
            .filter(isRecognizedSale)
            .reduce((sum, order) => sum + order.total, 0)
        ),
        lastOrderAt: customerOrders.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )[0]?.createdAt ?? null
      };
    });
  }

  async adminUpdateCustomer(id: string, dto: UpdateCustomerDto) {
    const customer = await this.prisma.user.findFirst({
      where: { id, role: "CUSTOMER" }
    });
    if (!customer) throw new NotFoundException("Customer not found.");
    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone === undefined ? undefined : dto.phone.trim() || null,
        isActive: dto.isActive
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true
      }
    });
  }

  async notifications(email: string) {
    return this.prisma.notification.findMany({
      where: { email },
      orderBy: { createdAt: "desc" }
    });
  }

  async markNotificationRead(id: string, email: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, email }
    });
    if (!notification) throw new NotFoundException("Notification not found.");

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: true }
    });
  }

  async markAllNotificationsRead(email: string) {
    const result = await this.prisma.notification.updateMany({
      where: { email, isRead: false },
      data: { isRead: true }
    });
    return { updated: result.count };
  }

  async deleteNotification(id: string, email: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, email } });
    if (!notification) throw new NotFoundException("Notification not found.");
    await this.prisma.notification.delete({ where: { id } });
    return { deleted: true };
  }
}
