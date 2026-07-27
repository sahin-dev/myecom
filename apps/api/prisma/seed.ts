import { config } from "dotenv";
import { resolve } from "node:path";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import {
  AnalyticsEventType,
  InventoryMovementType,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  Product,
  PromotionType,
  PurchaseOrderStatus,
  ReviewStatus,
  UserRole
} from "@prisma/client";

config({ path: resolve(__dirname, "../.env"), override: true });
config({ path: resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function main() {
  await prisma.notification.deleteMany();
  await prisma.trackingEvent.deleteMany();
  await prisma.returnItem.deleteMany();
  await prisma.returnRequest.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.couponRedemption.deleteMany();
  await prisma.checkoutRequest.deleteMany();
  await prisma.attribution.deleteMany();
  await prisma.analyticsEvent.deleteMany();
  await prisma.analyticsSession.deleteMany();
  await prisma.review.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.homeSection.deleteMany();
  await prisma.testimonial.deleteMany();
  await prisma.checkoutMethod.deleteMany();
  await prisma.siteSettings.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.address.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.staffPermission.deleteMany();
  await prisma.auditLog.deleteMany();

  const brands = await Promise.all(
    [
      { name: "NaturaMart", story: "Everyday pantry essentials with careful sourcing." },
      { name: "Harvest & Co", story: "Small-batch honey, dates, nuts, and grains." },
      { name: "PureLeaf", story: "Certified organic staples for modern kitchens." },
      { name: "BlueJar", story: "Premium packed foods with fast home delivery." }
    ].map((brand) => prisma.brand.create({ data: brand }))
  );

  const categories = await Promise.all(
    [
      { name: "Honey", icon: "Honey", priority: 1 },
      { name: "Dates", icon: "Dates", priority: 2 },
      { name: "Spices", icon: "Spice", priority: 3 },
      { name: "Nuts & Seeds", icon: "Nuts", priority: 4 },
      { name: "Oil & Ghee", icon: "Oil", priority: 5 },
      { name: "Rice", icon: "Rice", priority: 6 },
      { name: "Flours & Lentils", icon: "Flour", priority: 7 },
      { name: "Certified", icon: "Cert", priority: 8 }
    ].map((category) =>
      prisma.category.create({
        data: {
          ...category,
          slug: slugify(category.name)
        }
      })
    )
  );

  const categoryByName = new Map(categories.map((category) => [category.name, category]));
  const brandByName = new Map(brands.map((brand) => [brand.name, brand]));

  await prisma.siteSettings.create({
    data: {
      key: "default",
      title: "My Ecom",
      announcement: "Free delivery over \u09F33,000",
      announcementLinkLabel: "Track your order",
      announcementLinkHref: "/track-order"
    }
  });

  await prisma.banner.createMany({
    data: [
      {
        eyebrow: "Everyday pantry market",
        title: "Pantry Staples, Delivered Fresh",
        subtitle: "Honey, dates, spices, grains, oils, and certified goods for everyday cooking.",
        ctaLabel: "Shop groceries",
        ctaHref: "#top-selling",
        imageUrl: "/images/grocery-hero.png",
        priority: 1
      },
      {
        eyebrow: "Bundle and save",
        title: "Combos Built For Family Kitchens",
        subtitle: "Bundle your regular essentials and keep your cart simple.",
        ctaLabel: "View combos",
        ctaHref: "/combo-deals",
        imageUrl: "/images/packing-story.png",
        priority: 2
      },
      {
        eyebrow: "Clear from cart to door",
        title: "Certified Picks With Clear Tracking",
        subtitle: "Order trusted products and follow every step until delivery.",
        ctaLabel: "Track order",
        ctaHref: "/track-order",
        imageUrl: "/images/auth-pantry.png",
        priority: 3
      }
    ]
  });

  await prisma.homeSection.createMany({
    data: [
      {
        key: "trust",
        type: "TRUST",
        eyebrow: "A calmer way to stock the pantry",
        title: "Every order comes with clear support",
        subtitle: "Thoughtful sourcing, flexible delivery, and updates you can follow.",
        priority: 5,
        metadata: {
          announcement: "Fresh pantry essentials, delivered across Dhaka",
          items: [
            { title: "Carefully selected", detail: "Everyday products from trusted suppliers" },
            { title: "Flexible delivery", detail: "Choose the method that fits your day" },
            { title: "Order visibility", detail: "Follow each step from packing to arrival" }
          ]
        }
      },
      {
        key: "categories",
        type: "CATEGORIES",
        eyebrow: "Browse the pantry",
        title: "Shop by category",
        subtitle: "Find dependable essentials organized around everyday household routines.",
        ctaLabel: "View all products",
        ctaHref: "/shop",
        priority: 10,
        productLimit: 6
      },
      {
        key: "popular",
        type: "PRODUCT_SHELF",
        eyebrow: "Customer favorites",
        title: "Popular right now",
        subtitle: "Well-loved pantry products with reliable availability.",
        ctaLabel: "Shop all",
        ctaHref: "/shop?sort=featured",
        collection: "topSellingProducts",
        priority: 20,
        productLimit: 4
      },
      {
        key: "combo",
        type: "PROMO",
        eyebrow: "Better together",
        title: "Build a simpler weekly shop",
        subtitle: "Useful combinations for family kitchens, packed into one practical order.",
        ctaLabel: "Explore combo deals",
        ctaHref: "/combo-deals",
        collection: "comboDeals",
        priority: 30,
        productLimit: 1
      },
      {
        key: "discover",
        type: "PRODUCT_SHELF",
        eyebrow: "Fresh choices",
        title: "New and trending",
        subtitle: "Recently launched products and the essentials shoppers are choosing now.",
        ctaLabel: "Browse catalog",
        ctaHref: "/shop",
        collection: "newlyLaunched",
        priority: 40,
        productLimit: 8
      },
      {
        key: "category-showcase",
        type: "PRODUCT_SHELF",
        eyebrow: "A look through every aisle",
        title: "Explore the whole pantry",
        subtitle: "See representative products from every category before you start your full shop.",
        ctaLabel: "Browse all products",
        ctaHref: "/shop",
        collection: "categoryShowcase",
        priority: 45,
        productLimit: 4
      },
      {
        key: "brands",
        type: "BRANDS",
        eyebrow: "Trusted makers",
        title: "Brands in our pantry",
        subtitle: "Meet the producers behind the products.",
        ctaLabel: "Shop by brand",
        ctaHref: "/shop",
        priority: 50
      },
      {
        key: "testimonials",
        type: "TESTIMONIALS",
        eyebrow: "From our customers",
        title: "Shopping that feels dependable",
        subtitle: "Real feedback from households using My Ecom.",
        priority: 60
      }
    ]
  });

  await prisma.testimonial.createMany({
    data: [
      {
        name: "Shahriar Khan Abir",
        role: "Service holder",
        quote: "Clear product choices, straightforward checkout, and the delivery updates were genuinely useful.",
        rating: 5,
        priority: 1
      },
      {
        name: "Fariha Akter Tumpa",
        role: "Entrepreneur",
        quote: "I can find regular pantry products quickly and reorder without rebuilding everything.",
        rating: 5,
        priority: 2
      },
      {
        name: "Ayesha Khan",
        role: "Banker",
        quote: "The categories are simple, the product details are clear, and tracking works exactly as expected.",
        rating: 5,
        priority: 3
      }
    ]
  });

  await prisma.checkoutMethod.createMany({
    data: [
      {
        type: "PAYMENT",
        code: "CASH_ON_DELIVERY",
        name: "Cash on delivery",
        description: "Pay when your order arrives.",
        priority: 1,
        isActive: true
      },
      {
        type: "PAYMENT",
        code: "ONLINE_PAYMENT",
        name: "Online payment",
        description: "Gateway connection is planned; keep disabled until it is ready.",
        priority: 2,
        isActive: false
      },
      {
        type: "DELIVERY",
        code: "STANDARD_DHAKA",
        name: "Standard delivery",
        description: "Reliable delivery across Dhaka in 1-2 business days.",
        fee: 80,
        freeThreshold: 3000,
        minDeliveryDays: 1,
        maxDeliveryDays: 2,
        priority: 1,
        isActive: true
      },
      {
        type: "DELIVERY",
        code: "EXPRESS_DHAKA",
        name: "Express delivery",
        description: "Priority delivery in selected Dhaka areas.",
        fee: 150,
        minDeliveryDays: 0,
        maxDeliveryDays: 1,
        priority: 2,
        isActive: false
      }
    ]
  });

  const products = [
    {
      name: "Sundar Honey 1kg",
      description: "Rich floral honey packed for family use.",
      price: 2500,
      compareAt: 2750,
      inventory: 38,
      category: "Honey",
      brand: "Harvest & Co",
      isBestSelling: true,
      isTrending: true,
      badge: "Best selling",
      tags: ["honey", "family"]
    },
    {
      name: "Black Seed Honey 500g",
      description: "Deep, aromatic honey with a bold natural finish.",
      price: 1100,
      compareAt: 1250,
      inventory: 54,
      category: "Honey",
      brand: "Harvest & Co",
      isNew: true,
      isTrending: true,
      badge: "Save 12%",
      tags: ["honey", "black seed"]
    },
    {
      name: "Lychee Flower Honey 500g",
      description: "Bright honey with a soft lychee blossom note.",
      price: 550,
      compareAt: 600,
      inventory: 72,
      category: "Honey",
      brand: "BlueJar",
      isTrending: true,
      tags: ["honey", "lychee"]
    },
    {
      name: "Premium Ajwa Dates 1kg",
      description: "Soft premium dates selected for gifting and daily nutrition.",
      price: 2250,
      compareAt: 2500,
      inventory: 22,
      category: "Dates",
      brand: "Harvest & Co",
      isNew: true,
      isTrending: true,
      badge: "Save 10%",
      tags: ["dates", "premium"]
    },
    {
      name: "Medjool Dates 1kg",
      description: "Large, tender dates with caramel sweetness.",
      price: 2700,
      inventory: 16,
      category: "Dates",
      brand: "Harvest & Co",
      isTrending: true,
      tags: ["dates", "medjool"]
    },
    {
      name: "Gawa Ghee 1kg",
      description: "Slow-cooked aromatic ghee for cooking and sweets.",
      price: 1800,
      inventory: 31,
      category: "Oil & Ghee",
      brand: "NaturaMart",
      isBestSelling: true,
      badge: "Best selling",
      tags: ["ghee", "cooking"]
    },
    {
      name: "Deshi Mustard Oil 5 liter",
      description: "Cold-pressed mustard oil for traditional cooking.",
      price: 1700,
      inventory: 44,
      category: "Oil & Ghee",
      brand: "NaturaMart",
      isBestSelling: true,
      isTrending: true,
      tags: ["mustard oil", "cooking"]
    },
    {
      name: "Turmeric Powder 500g",
      description: "Fine-ground turmeric with warm color and aroma.",
      price: 295,
      inventory: 96,
      category: "Spices",
      brand: "PureLeaf",
      isCertified: true,
      isTrending: true,
      tags: ["spices", "turmeric"]
    },
    {
      name: "Kala Bhuna Masala 500g",
      description: "Ready spice blend for deep savory curries.",
      price: 1350,
      compareAt: 1500,
      inventory: 25,
      category: "Spices",
      brand: "BlueJar",
      isNew: true,
      isCertified: true,
      badge: "Offered item",
      tags: ["spices", "masala"]
    },
    {
      name: "Rice Flour 2kg",
      description: "Finely milled rice flour for baking and snacks.",
      price: 200,
      inventory: 80,
      category: "Flours & Lentils",
      brand: "NaturaMart",
      isCertified: true,
      tags: ["flour", "rice"]
    },
    {
      name: "Organic Spirulina Powder 250g",
      description: "Certified green superfood powder for smoothies.",
      price: 1140,
      compareAt: 1200,
      inventory: 17,
      category: "Certified",
      brand: "PureLeaf",
      isNew: true,
      isCertified: true,
      badge: "Certified",
      tags: ["organic", "superfood"]
    },
    {
      name: "Organic Coconut Milk 400ml",
      description: "Creamy certified coconut milk for curry and desserts.",
      price: 350,
      inventory: 65,
      category: "Certified",
      brand: "PureLeaf",
      isCertified: true,
      tags: ["organic", "coconut"]
    },
    {
      name: "Cashew Nuts Medium 1kg",
      description: "Whole cashews for snacks, cooking, and baking.",
      price: 2000,
      inventory: 28,
      category: "Nuts & Seeds",
      brand: "Harvest & Co",
      isTrending: true,
      tags: ["nuts", "cashew"]
    },
    {
      name: "Honey Nuts 800g",
      description: "Mixed nuts soaked in natural honey.",
      price: 1700,
      inventory: 18,
      category: "Nuts & Seeds",
      brand: "BlueJar",
      isBestSelling: true,
      tags: ["nuts", "honey"]
    },
    {
      name: "Ghee & Honey Combo",
      description: "A family combo with ghee and flower honey.",
      price: 3000,
      compareAt: 3400,
      inventory: 20,
      category: "Oil & Ghee",
      brand: "NaturaMart",
      isCombo: true,
      showOnHome: true,
      comboPriority: 0,
      isTrending: true,
      badge: "Combo deal",
      tags: ["combo", "honey", "ghee"]
    },
    {
      name: "Spice Starter Combo",
      description: "Core cooking spices selected for daily meals.",
      price: 1500,
      compareAt: 1740,
      inventory: 15,
      category: "Spices",
      brand: "BlueJar",
      isCombo: true,
      showOnHome: false,
      comboPriority: 10,
      isNew: true,
      badge: "Combo deal",
      tags: ["combo", "spices"]
    }
  ];

  const createdProducts: Product[] = [];
  for (const product of products) {
    const { brand, category, ...data } = product;
    const created = await prisma.product.create({
      data: {
        ...data,
        costPrice: Math.round(product.price * 0.62),
        slug: slugify(product.name),
        status: "ACTIVE",
        brandId: brandByName.get(brand)?.id,
        categoryId: categoryByName.get(category)?.id
      }
    });
    createdProducts.push(created);
  }
  const seededBySlug = new Map(createdProducts.map((product) => [product.slug, product.id]));
  await Promise.all([
    prisma.product.update({
      where: { slug: "ghee-honey-combo" },
      data: {
        comboProductIds: [
          seededBySlug.get("gawa-ghee-1kg")!,
          seededBySlug.get("sundar-honey-1kg")!
        ]
      }
    }),
    prisma.product.update({
      where: { slug: "spice-starter-combo" },
      data: {
        comboProductIds: [
          seededBySlug.get("turmeric-powder-500g")!,
          seededBySlug.get("kala-bhuna-masala-500g")!
        ]
      }
    })
  ]);

  const [admin, customer] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@myecom.local" },
      update: { name: "Store Administrator", role: UserRole.ADMIN },
      create: {
        name: "Store Administrator",
        email: "admin@myecom.local",
        passwordHash: await hashPassword("Admin123!"),
        role: UserRole.ADMIN,
        phone: "+8801700000001"
      }
    }),
    prisma.user.upsert({
      where: { email: "customer@myecom.local" },
      update: { name: "Demo Customer", role: UserRole.CUSTOMER },
      create: {
        name: "Demo Customer",
        email: "customer@myecom.local",
        passwordHash: await hashPassword("Customer123!"),
        role: UserRole.CUSTOMER,
        phone: "+8801700000002"
      }
    })
  ]);

  await prisma.address.create({
    data: {
      userId: customer.id,
      label: "Home",
      recipient: customer.name,
      phone: customer.phone ?? "+8801700000002",
      line1: "House 12, Road 7",
      area: "Dhanmondi",
      city: "Dhaka",
      postalCode: "1209",
      isDefault: true
    }
  });
  await prisma.notificationPreference.create({
    data: { userId: customer.id, orderEmail: true, backInStock: true, priceDrop: true }
  });

  const supplier = await prisma.supplier.create({
    data: {
      name: "Bengal Pantry Supply",
      contactName: "Rafiq Hasan",
      email: "buying@bengalpantry.local",
      phone: "+8801800000000",
      leadTimeDays: 6
    }
  });
  await prisma.product.updateMany({
    where: { id: { in: createdProducts.slice(0, 8).map((product) => product.id) } },
    data: { supplierId: supplier.id }
  });

  const honey = createdProducts.find((product) => product.slug === "sundar-honey-1kg")!;
  const dates = createdProducts.find((product) => product.slug === "premium-ajwa-dates-1kg")!;
  const ghee = createdProducts.find((product) => product.slug === "gawa-ghee-1kg")!;
  await prisma.productVariant.createMany({
    data: [
      {
        productId: honey.id,
        name: "500g jar",
        sku: "HNY-SUN-500",
        price: 1350,
        costPrice: 820,
        compareAt: 1450,
        inventory: 28,
        attributes: { size: "500g" }
      },
      {
        productId: honey.id,
        name: "1kg family jar",
        sku: "HNY-SUN-1000",
        price: 2500,
        costPrice: 1550,
        compareAt: 2750,
        inventory: 38,
        attributes: { size: "1kg" }
      }
    ]
  });

  const now = new Date();
  const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  await prisma.promotion.createMany({
    data: [
      {
        name: "Welcome 10",
        code: "WELCOME10",
        type: PromotionType.PERCENTAGE,
        value: 10,
        minimumOrder: 1000,
        maximumDiscount: 500,
        usageLimit: 1000,
        perCustomerLimit: 1,
        startsAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        endsAt: ninetyDays
      },
      {
        name: "Delivery on us",
        code: "SHIPFREE",
        type: PromotionType.FREE_SHIPPING,
        value: 0,
        minimumOrder: 1500,
        usageLimit: 500,
        perCustomerLimit: 3,
        startsAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        endsAt: ninetyDays
      }
    ]
  });

  const deliveredOrder = await prisma.order.create({
    data: {
      orderNumber: "ME-DEMO-1001",
      userId: customer.id,
      customerName: customer.name,
      email: customer.email,
      phone: customer.phone ?? "+8801700000002",
      shippingAddress: "House 12, Road 7, Dhanmondi, Dhaka 1209",
      status: OrderStatus.DELIVERED,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: "Cash on delivery",
      trackingCode: "DEMO-TRACK-1001",
      courierName: "Pathao Courier",
      subtotal: 4300,
      discount: 0,
      shippingFee: 0,
      total: 4300,
      createdAt: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          {
            productId: honey.id,
            productName: honey.name,
            quantity: 1,
            unitPrice: 2500,
            unitCost: honey.costPrice
          },
          {
            productId: ghee.id,
            productName: ghee.name,
            quantity: 1,
            unitPrice: 1800,
            unitCost: ghee.costPrice
          }
        ]
      },
      trackingEvents: {
        create: [
          { status: OrderStatus.PLACED, location: "Online", note: "Order received." },
          { status: OrderStatus.CONFIRMED, location: "Dhaka", note: "Order confirmed." },
          { status: OrderStatus.DELIVERED, location: "Dhanmondi", note: "Delivered to customer." }
        ]
      },
      payments: {
        create: {
          provider: "cash",
          method: "Cash on delivery",
          amount: 4300,
          status: PaymentStatus.PAID,
          transactionId: "DEMO-COD-1001"
        }
      }
    },
    include: { items: true }
  });

  await prisma.review.create({
    data: {
      userId: customer.id,
      productId: honey.id,
      orderId: deliveredOrder.id,
      rating: 5,
      title: "Clean taste and secure packing",
      comment: "The jar arrived well packed and the honey has a rich floral taste.",
      status: ReviewStatus.APPROVED,
      isVerified: true,
      adminReply: "Thank you for sharing your experience."
    }
  });

  const sessions = await Promise.all(
    [
      ["seed-direct-1", "direct", null, null],
      ["seed-facebook-1", "facebook", "social", "summer-pantry"],
      ["seed-google-1", "google", "organic", null],
      ["seed-instagram-1", "instagram", "social", "honey-launch"]
    ].map(([sessionKey, source, medium, campaign]) =>
      prisma.analyticsSession.create({
        data: {
          sessionKey: String(sessionKey),
          source: String(source),
          medium: medium ? String(medium) : undefined,
          campaign: campaign ? String(campaign) : undefined,
          landingPage: "/"
        }
      })
    )
  );

  for (let index = 0; index < 36; index += 1) {
    const session = sessions[index % sessions.length];
    const product = createdProducts[index % 8];
    const createdAt = new Date(now.getTime() - (index % 27) * 24 * 60 * 60 * 1000);
    await prisma.analyticsEvent.create({
      data: {
        type: AnalyticsEventType.PRODUCT_VIEWED,
        sessionId: session.id,
        productId: product.id,
        createdAt
      }
    });
    if (index % 3 === 0) {
      await prisma.analyticsEvent.create({
        data: {
          type: AnalyticsEventType.ADDED_TO_CART,
          sessionId: session.id,
          productId: product.id,
          createdAt
        }
      });
    }
    if (index % 5 === 0) {
      await prisma.analyticsEvent.create({
        data: {
          type: AnalyticsEventType.SEARCHED,
          sessionId: session.id,
          query: ["honey", "dates", "organic", "ghee"][index % 4],
          createdAt
        }
      });
    }
  }

  await prisma.attribution.create({
    data: {
      orderId: deliveredOrder.id,
      sessionId: sessions[1].id,
      source: "facebook",
      medium: "social",
      campaign: "summer-pantry"
    }
  });
  await prisma.analyticsEvent.create({
    data: {
      type: AnalyticsEventType.CHECKOUT_COMPLETED,
      sessionId: sessions[1].id,
      userId: customer.id,
      orderId: deliveredOrder.id,
      createdAt: deliveredOrder.createdAt
    }
  });

  await prisma.purchaseOrder.create({
    data: {
      poNumber: "PO-DEMO-1001",
      supplierId: supplier.id,
      status: PurchaseOrderStatus.ORDERED,
      expectedAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      notes: "Replenish fast-moving pantry essentials.",
      totalCost: 46500,
      items: {
        create: [
          { productId: honey.id, quantity: 20, unitCost: honey.costPrice ?? 1550 },
          { productId: dates.id, quantity: 10, unitCost: dates.costPrice ?? 1400 }
        ]
      }
    }
  });

  await prisma.inventoryMovement.createMany({
    data: createdProducts.slice(0, 5).map((product) => ({
      productId: product.id,
      type: InventoryMovementType.ADJUSTMENT,
      quantity: product.inventory,
      reason: "Seed opening balance",
      reference: "SEED",
      createdById: admin.id
    }))
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "SEED_WORKSPACE",
      entity: "Store",
      metadata: { products: createdProducts.length, source: "development seed" }
    }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
