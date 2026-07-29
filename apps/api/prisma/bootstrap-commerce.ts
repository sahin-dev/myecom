import { config } from "dotenv";
import { resolve } from "node:path";
import {
  CheckoutMethodType,
  HomeSectionType,
  Prisma,
  PrismaClient
} from "@prisma/client";

config({ path: resolve(__dirname, "../.env"), override: true });
config({ path: resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();

async function repairLegacyDocuments() {
  const repairs: Array<{ collection: string; fields: Record<string, unknown> }> = [
    {
      collection: "User",
      fields: {
        createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
        updatedAt: { $ifNull: ["$updatedAt", "$$NOW"] },
        isActive: { $ifNull: ["$isActive", true] }
      }
    },
    {
      collection: "Brand",
      fields: {
        createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
        updatedAt: { $ifNull: ["$updatedAt", "$$NOW"] },
        isActive: { $ifNull: ["$isActive", true] }
      }
    },
    {
      collection: "Category",
      fields: {
        createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
        updatedAt: { $ifNull: ["$updatedAt", "$$NOW"] },
        isActive: { $ifNull: ["$isActive", true] }
      }
    },
    {
      collection: "Product",
      fields: {
        createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
        updatedAt: { $ifNull: ["$updatedAt", "$$NOW"] }
      }
    },
    {
      collection: "ProductImage",
      fields: {
        createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
        updatedAt: { $ifNull: ["$updatedAt", "$$NOW"] }
      }
    },
    {
      collection: "Banner",
      fields: {
        createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
        updatedAt: { $ifNull: ["$updatedAt", "$$NOW"] },
        publishedAt: { $ifNull: ["$publishedAt", "$$NOW"] },
        focalX: { $ifNull: ["$focalX", 50] },
        focalY: { $ifNull: ["$focalY", 50] },
        startsAt: { $ifNull: ["$startsAt", null] },
        endsAt: { $ifNull: ["$endsAt", null] },
        isActive: { $ifNull: ["$isActive", true] }
      }
    }
  ];

  for (const repair of repairs) {
    await prisma.$runCommandRaw({
      update: repair.collection,
      updates: [
        {
          q: {},
          u: [{ $set: repair.fields }],
          multi: true
        }
      ]
    } as Prisma.InputJsonObject);
  }
}

const sections: Array<Prisma.HomeSectionCreateInput> = [
  {
    key: "trust",
    type: HomeSectionType.TRUST,
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
    type: HomeSectionType.CATEGORIES,
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
    type: HomeSectionType.PRODUCT_SHELF,
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
    type: HomeSectionType.PROMO,
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
    type: HomeSectionType.PRODUCT_SHELF,
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
    type: HomeSectionType.PRODUCT_SHELF,
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
    type: HomeSectionType.BRANDS,
    eyebrow: "Trusted makers",
    title: "Brands in our pantry",
    subtitle: "Meet the producers behind the products.",
    ctaLabel: "Shop by brand",
    ctaHref: "/shop",
    priority: 50
  },
  {
    key: "testimonials",
    type: HomeSectionType.TESTIMONIALS,
    eyebrow: "From our customers",
    title: "Shopping that feels dependable",
    subtitle: "Real feedback from households using My Ecom.",
    priority: 60
  }
];

const checkoutMethods: Array<Prisma.CheckoutMethodCreateInput> = [
  {
    type: CheckoutMethodType.PAYMENT,
    code: "CASH_ON_DELIVERY",
    name: "Cash on delivery",
    description: "Pay when your order arrives.",
    priority: 1,
    isActive: true
  },
  {
    type: CheckoutMethodType.PAYMENT,
    code: "ONLINE_PAYMENT",
    name: "Online payment",
    description: "Online checkout through the connected gateway.",
    priority: 2,
    metadata: { provider: "bkash" },
    isActive: true
  },
  {
    type: CheckoutMethodType.PAYMENT,
    code: "BKASH",
    name: "bKash",
    description: "Pay securely with bKash.",
    priority: 3,
    metadata: { provider: "bkash" },
    isActive: false
  },
  {
    type: CheckoutMethodType.PAYMENT,
    code: "NAGAD",
    name: "Nagad",
    description: "Nagad gateway can be enabled after credentials are connected.",
    priority: 4,
    metadata: { provider: "nagad" },
    isActive: false
  },
  {
    type: CheckoutMethodType.PAYMENT,
    code: "CARD",
    name: "Card payment",
    description: "Card gateway can be enabled after credentials are connected.",
    priority: 5,
    metadata: { provider: "card" },
    isActive: false
  },
  {
    type: CheckoutMethodType.DELIVERY,
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
    type: CheckoutMethodType.DELIVERY,
    code: "EXPRESS_DHAKA",
    name: "Express delivery",
    description: "Faster delivery for urgent orders.",
    fee: 150,
    minDeliveryDays: 1,
    maxDeliveryDays: 1,
    priority: 2,
    isActive: false
  }
];

const deliveryZones: Array<Prisma.DeliveryZoneCreateInput> = [
  {
    code: "DHAKA",
    name: "Dhaka city",
    city: "Dhaka",
    areas: ["Dhanmondi", "Gulshan", "Banani", "Mirpur", "Uttara", "Mohammadpur", "Bashundhara"],
    postalCodes: ["1205", "1212", "1213", "1216", "1230", "1207", "1229"],
    priority: 1,
    isActive: true
  }
];

const deliveryRates = [
  {
    zoneCode: "DHAKA",
    deliveryMethodCode: "STANDARD_DHAKA",
    baseFee: 80,
    freeThreshold: 3000,
    minDeliveryDays: 1,
    maxDeliveryDays: 2,
    priority: 1,
    isActive: true
  },
  {
    zoneCode: "DHAKA",
    deliveryMethodCode: "EXPRESS_DHAKA",
    baseFee: 150,
    freeThreshold: undefined,
    minDeliveryDays: 0,
    maxDeliveryDays: 1,
    priority: 2,
    isActive: false
  }
];

async function main() {
  await repairLegacyDocuments();
  await prisma.product.updateMany({
    where: {
      name: { in: ["Gawa Ghee 1kg", "Deshi Mustard Oil 5 liter"] },
      isCombo: true
    },
    data: { isCombo: false, showOnHome: false, comboPriority: 0 }
  });
  const seededComboProducts = await prisma.product.findMany({
    where: {
      slug: {
        in: [
          "ghee-honey-combo",
          "spice-starter-combo",
          "gawa-ghee-1kg",
          "sundar-honey-1kg",
          "turmeric-powder-500g",
          "kala-bhuna-masala-500g"
        ]
      }
    },
    select: { id: true, slug: true, comboProductIds: true }
  });
  const seededProductBySlug = new Map(
    seededComboProducts.map((product) => [product.slug, product])
  );
  const comboComposition = [
    {
      combo: "ghee-honey-combo",
      products: ["gawa-ghee-1kg", "sundar-honey-1kg"]
    },
    {
      combo: "spice-starter-combo",
      products: ["turmeric-powder-500g", "kala-bhuna-masala-500g"]
    }
  ];
  for (const entry of comboComposition) {
    const combo = seededProductBySlug.get(entry.combo);
    const productIds = entry.products
      .map((slug) => seededProductBySlug.get(slug)?.id)
      .filter((id): id is string => Boolean(id));
    if (combo && combo.comboProductIds.length === 0 && productIds.length === 2) {
      await prisma.product.update({
        where: { id: combo.id },
        data: { comboProductIds: productIds }
      });
    }
  }
  await prisma.siteSettings.upsert({
    where: { key: "default" },
    create: {
      key: "default",
      title: "My Ecom",
      announcement: "Free delivery over \u09F33,000",
      announcementLinkLabel: "Track your order",
      announcementLinkHref: "/track-order"
    },
    update: {}
  });
  for (const section of sections) {
    await prisma.homeSection.upsert({
      where: { key: section.key },
      create: section,
      update: {}
    });
  }
  await prisma.homeSection.updateMany({
    where: { key: "combo" },
    data: { ctaLabel: "Explore combo deals", ctaHref: "/combo-deals" }
  });
  await prisma.banner.updateMany({
    where: { ctaHref: "#combo-deals" },
    data: { ctaHref: "/combo-deals" }
  });
  for (const method of checkoutMethods) {
    await prisma.checkoutMethod.upsert({
      where: { code: method.code },
      create: method,
      update:
        method.code === "ONLINE_PAYMENT"
          ? {
              name: method.name,
              description: method.description,
              metadata: method.metadata as Prisma.InputJsonValue,
              priority: method.priority
            }
          : {}
    });
  }
  for (const zone of deliveryZones) {
    await prisma.deliveryZone.upsert({
      where: { code: zone.code },
      create: zone,
      update: {
        name: zone.name,
        city: zone.city,
        areas: zone.areas,
        postalCodes: zone.postalCodes,
        priority: zone.priority
      }
    });
  }
  for (const rate of deliveryRates) {
    const [zone, deliveryMethod] = await Promise.all([
      prisma.deliveryZone.findUnique({ where: { code: rate.zoneCode } }),
      prisma.checkoutMethod.findUnique({ where: { code: rate.deliveryMethodCode } })
    ]);
    if (!zone || !deliveryMethod) continue;
    const existing = await prisma.deliveryRate.findFirst({
      where: { zoneId: zone.id, deliveryMethodId: deliveryMethod.id }
    });
    const data = {
      zoneId: zone.id,
      deliveryMethodId: deliveryMethod.id,
      baseFee: rate.baseFee,
      freeThreshold: rate.freeThreshold,
      minDeliveryDays: rate.minDeliveryDays,
      maxDeliveryDays: rate.maxDeliveryDays,
      priority: rate.priority,
      isActive: rate.isActive
    };
    if (existing) {
      await prisma.deliveryRate.update({ where: { id: existing.id }, data });
    } else {
      await prisma.deliveryRate.create({ data });
    }
  }
  if ((await prisma.testimonial.count()) === 0) {
    await prisma.testimonial.createMany({
      data: [
        {
          name: "Shahriar Khan Abir",
          role: "Service holder",
          quote: "Clear product choices, straightforward checkout, and genuinely useful delivery updates.",
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
          quote: "The categories are simple, product details are clear, and tracking works as expected.",
          rating: 5,
          priority: 3
        }
      ]
    });
  }
  const selectedHomeCombo = await prisma.product.findFirst({
    where: { isCombo: true, showOnHome: true, status: "ACTIVE" }
  });
  if (!selectedHomeCombo) {
    const firstCombo = await prisma.product.findFirst({
      where: { isCombo: true, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" }
    });
    if (firstCombo) {
      await prisma.product.update({
        where: { id: firstCombo.id },
        data: { showOnHome: true, comboPriority: 0 }
      });
    }
  }
  console.log("Commerce configuration is ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
