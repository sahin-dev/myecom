export type Brand = {
  id: string;
  name: string;
  logoUrl?: string | null;
  story?: string | null;
  isActive?: boolean;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  imageUrl?: string | null;
  priority: number;
  isActive?: boolean;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  costPrice?: number | null;
  compareAt?: number | null;
  inventory: number;
  baseOptionEnabled?: boolean | null;
  baseOptionLabel?: string | null;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  imageUrl?: string | null;
  isNew: boolean;
  isTrending: boolean;
  isBestSelling?: boolean;
  isCombo?: boolean;
  comboProductIds?: string[];
  comboProducts?: Array<{
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
    price: number;
  }>;
  showOnHome?: boolean;
  comboPriority?: number;
  isCertified?: boolean;
  badge?: string | null;
  brandId?: string | null;
  brand?: Brand | null;
  categoryId?: string | null;
  category?: Category | null;
  tags: string[];
  details?: ProductDetailSection[] | null;
  checkoutPolicy?: CheckoutPolicy | null;
  images?: ProductImage[];
  variants?: ProductVariant[];
  reviews?: Review[];
  rating?: number;
  reviewCount?: number;
};

export type ProductImage = {
  id: string;
  url: string;
  alt?: string | null;
  position: number;
};

export type UnitType = "kg" | "g" | "l" | "ml" | "ft" | "in" | "m" | "pcs" | "dozen" | "pack";

export const unitTypeLabels: Record<UnitType, string> = {
  kg: "kg",
  g: "g",
  l: "L",
  ml: "ml",
  ft: "ft",
  in: "in",
  m: "m",
  pcs: "pcs",
  dozen: "dozen",
  pack: "pack"
};

export type ProductVariant = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  costPrice?: number | null;
  compareAt?: number | null;
  inventory: number;
  unitType?: UnitType | null;
  unitValue?: number | null;
  attributes?: Record<string, string> | null;
  isActive: boolean;
};

export function isBaseProductEnabled(product: Pick<Product, "baseOptionEnabled">) {
  return product.baseOptionEnabled !== false;
}

export function baseProductOptionLabel(
  product: Pick<Product, "name" | "baseOptionLabel">
) {
  return product.baseOptionLabel?.trim() || product.name;
}

export function selectableProductInventory(
  product: Pick<Product, "inventory" | "variants" | "baseOptionEnabled">
) {
  const activeVariants = product.variants?.filter((variant) => variant.isActive) ?? [];
  if (!activeVariants.length) return product.inventory;
  return activeVariants.reduce((sum, variant) => sum + variant.inventory, 0)
    + (isBaseProductEnabled(product) ? product.inventory : 0);
}

export type Review = {
  id: string;
  rating: number;
  title?: string | null;
  comment: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  isVerified: boolean;
  showOnHome: boolean;
  homePriority: number;
  adminReply?: string | null;
  createdAt: string;
  updatedAt?: string;
  user?: { name: string; email?: string; avatarUrl?: string | null };
  product?: { name: string; slug: string; imageUrl?: string | null };
};

export type Banner = {
  id: string;
  eyebrow?: string | null;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl?: string | null;
  focalX?: number;
  focalY?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  priority: number;
};

export type SiteSettings = {
  id?: string;
  key?: string;
  title: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  announcement: string;
  announcementLinkLabel: string;
  announcementLinkHref: string;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  whatsappUrl?: string | null;
  checkoutPolicy?: PlatformCheckoutPolicy | null;
};

export type CheckoutPolicy = {
  inheritPayment?: boolean;
  allowedPaymentCodes?: string[];
  requiredPaymentPercent?: number;
  onlineOnly?: boolean;
  inheritDelivery?: boolean;
  allowedZoneCodes?: string[];
  blockedZoneCodes?: string[];
};

export type PlatformCheckoutPolicy = {
  allowedPaymentCodes?: string[];
  requiredPaymentPercent?: number;
  deliverableZoneCodes?: string[];
  requireKnownDeliveryArea?: boolean;
};

function clampPercent(value?: number) {
  return Math.min(100, Math.max(0, Number(value ?? 0) || 0));
}

export function productAdvancePaymentPercent(
  product: Pick<Product, "checkoutPolicy">,
  platformPolicy?: PlatformCheckoutPolicy | null
) {
  const policy = product.checkoutPolicy;
  const platformPercent = clampPercent(platformPolicy?.requiredPaymentPercent);
  const productPercent =
    policy?.onlineOnly && policy.requiredPaymentPercent === undefined
      ? 100
      : clampPercent(policy?.requiredPaymentPercent);
  return Math.max(platformPercent, productPercent);
}

export function productAdvancePaymentLabel(
  product: Pick<Product, "checkoutPolicy">,
  platformPolicy?: PlatformCheckoutPolicy | null
) {
  const percent = productAdvancePaymentPercent(product, platformPolicy);
  return percent > 0 ? `${percent}% advance payment required` : "";
}

export type HomeSection = {
  id: string;
  key: string;
  type: "TRUST" | "CATEGORIES" | "PRODUCT_SHELF" | "PROMO" | "BRANDS" | "TESTIMONIALS";
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  imageUrl?: string | null;
  collection?: string | null;
  productLimit: number;
  priority: number;
  isActive: boolean;
  metadata?: {
    announcement?: string;
    items?: Array<{ title: string; detail: string }>;
  } | null;
};

export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  role?: string | null;
  rating: number;
  avatarUrl?: string | null;
  isActive: boolean;
  priority: number;
};

export type CheckoutMethod = {
  id: string;
  type: "PAYMENT" | "DELIVERY";
  code: string;
  name: string;
  description?: string | null;
  fee: number;
  freeThreshold?: number | null;
  minDeliveryDays?: number | null;
  maxDeliveryDays?: number | null;
  metadata?: Record<string, unknown> | null;
  paymentGatewayId?: string | null;
  paymentGateway?: PaymentGateway | null;
  isActive: boolean;
  priority: number;
};

export type PaymentGateway = {
  id: string;
  provider: "BKASH" | "NAGAD" | "CARD" | "OTHER";
  name: string;
  code: string;
  description?: string | null;
  mode: string;
  apiBaseUrl?: string | null;
  appKey?: string | null;
  appSecret?: string | null;
  username?: string | null;
  password?: string | null;
  callbackUrl?: string | null;
  webhookUrl?: string | null;
  merchantId?: string | null;
  storeId?: string | null;
  settings?: Record<string, unknown> | null;
  credentialsConfigured?: boolean;
  envConfigured?: boolean;
  apiConfigured?: boolean;
  isActive: boolean;
  priority: number;
  _count?: { checkoutMethods: number };
};

export type DeliveryZone = {
  id: string;
  name: string;
  code: string;
  city?: string | null;
  areas: string[];
  postalCodes: string[];
  isActive: boolean;
  priority: number;
  rates?: DeliveryRate[];
};

export type DeliveryRate = {
  id: string;
  zoneId: string;
  deliveryMethodId: string;
  baseFee: number;
  freeThreshold?: number | null;
  minOrder: number;
  maxOrder?: number | null;
  minDeliveryDays?: number | null;
  maxDeliveryDays?: number | null;
  isActive: boolean;
  priority: number;
  zone?: DeliveryZone;
  deliveryMethod?: CheckoutMethod;
};

export type CourierProvider = "MANUAL" | "PATHAO" | "STEADFAST" | "SUNDARBAN" | "CUSTOM";
export type CourierShipmentStatus =
  | "DRAFT"
  | "CREATED"
  | "PICKUP_REQUESTED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "DELIVERY_FAILED"
  | "RETURNED"
  | "CANCELLED"
  | "UNKNOWN";

export type CourierService = {
  id: string;
  provider: CourierProvider;
  name: string;
  code: string;
  description?: string | null;
  apiBaseUrl?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  storeId?: string | null;
  defaultPickupAddress?: string | null;
  settings?: Record<string, unknown> | null;
  isActive: boolean;
  priority: number;
  apiConfigured?: boolean;
  credentialsConfigured?: boolean;
  _count?: { shipments: number };
  createdAt: string;
  updatedAt: string;
};

export type CourierShipment = {
  id: string;
  orderId: string;
  courierServiceId: string;
  provider: CourierProvider;
  status: CourierShipmentStatus;
  trackingCode?: string | null;
  providerOrderId?: string | null;
  consignmentId?: string | null;
  deliveryFailedReason?: string | null;
  cashCollectionAmount?: number;
  collectedAmount?: number;
  paymentCollectedAt?: string | null;
  lastSyncedAt?: string | null;
  errorMessage?: string | null;
  courierService?: CourierService;
  events?: Array<{
    id: string;
    providerStatus?: string | null;
    normalizedStatus: CourierShipmentStatus;
    message: string;
    location?: string | null;
    deliveryFailedReason?: string | null;
    happenedAt: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export function effectiveCourierShipmentStatus(shipment?: CourierShipment | null): CourierShipmentStatus | null {
  if (!shipment) return null;
  if (shipment.status !== "UNKNOWN") return shipment.status;
  const latestKnownEvent = [...(shipment.events ?? [])]
    .reverse()
    .find((event) => event.normalizedStatus !== "UNKNOWN");
  return latestKnownEvent?.normalizedStatus ?? shipment.status;
}

export type AddressInfo = {
  recipient: string;
  phone: string;
  email?: string;
  line1: string;
  line2?: string;
  area?: string;
  city: string;
  postalCode?: string;
  note?: string;
};

export type InfoPageContent = {
  id?: string;
  slug: string;
  eyebrow: string;
  title: string;
  intro: string;
  points: Array<{ title: string; detail: string }>;
  updatedAt?: string;
};

export type Catalog = {
  banners: Banner[];
  brands: Brand[];
  categories: Category[];
  siteSettings: SiteSettings;
  newlyLaunched: Product[];
  trendingProducts: Product[];
  topSellingProducts: Product[];
  comboDeals: Product[];
  certifiedProducts: Product[];
  justForYou: Product[];
  categoryShowcase: Array<{
    category: Category;
    totalProducts: number;
    products: Product[];
  }>;
  featuredReviews: Review[];
  homeSections: HomeSection[];
  testimonials: Testimonial[];
  checkoutMethods: CheckoutMethod[];
  deliveryZones: DeliveryZone[];
};

export type CartLine = {
  product: Product;
  variant?: ProductVariant | null;
  quantity: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  shippingInfo?: AddressInfo | null;
  billingInfo?: AddressInfo | null;
  billingSameAsShipping?: boolean;
  status: string;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  deliveryMethodCode?: string | null;
  deliveryMethodName?: string | null;
  deliveryZoneCode?: string | null;
  deliveryZoneName?: string | null;
  trackingCode?: string | null;
  courierName?: string | null;
  courierShipments?: CourierShipment[];
  adminNote?: string | null;
  subtotal: number;
  shippingFee: number;
  total: number;
  amountDueNow?: number;
  amountDueOnDelivery?: number;
  requiredPaymentPercent?: number;
  discount?: number;
  promotion?: { code: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    variantId?: string | null;
    variantName?: string | null;
    quantity: number;
    unitPrice: number;
    unitCost?: number | null;
    advancePaymentPercent?: number;
    advancePaymentAmount?: number;
  }>;
  payments?: Array<{
    id: string;
    provider: string;
    method: string;
    amount: number;
    status: string;
    gatewayReference?: string | null;
    providerPayload?: Record<string, unknown> | null;
  }>;
  trackingEvents: Array<{
    id: string;
    status: string;
    location: string;
    note: string;
    createdAt: string;
  }>;
};

export type AdminDashboard = {
  period: {
    days: number;
    start: string;
    end: string;
    comparisonStart: string;
  };
  kpis: {
    revenue: AdminMetric;
    orders: AdminMetric;
    averageOrderValue: AdminMetric;
    customers: AdminMetric;
    unitsSold: AdminMetric;
    grossProfit: {
      value: number;
      margin: number;
      coverage: number;
    };
  };
  forecast: {
    projected30DayRevenue: number;
    dailyRunRate: number;
    basis: string;
  };
  traffic: {
    newOrdersToday: number;
    newOrderQueue: number;
    visitorsToday: number;
    activeVisitors: number;
    lifetimeVisitors: number;
    periodVisitors: number;
    activeWindowMinutes: number;
  };
  salesTrend: Array<{ date: string; revenue: number; orders: number }>;
  statusBreakdown: Array<{ status: string; count: number; value: number }>;
  topProducts: Array<{
    productId: string;
    name: string;
    units: number;
    revenue: number;
    orders: number;
    inventory: number;
  }>;
  categoryPerformance: Array<{ name: string; units: number; revenue: number }>;
  lowStock: Array<{
    id: string;
    name: string;
    inventory: number;
    soldUnits: number;
    stockValue: number;
    reorderSuggested: number;
  }>;
  customerInsights: {
    newCustomers: number;
    returningCustomers: number;
    repeatRate: number;
    topCustomers: Array<{
      email: string;
      name: string;
      orders: number;
      spend: number;
      lastOrderAt: string;
    }>;
  };
  operations: {
    unfulfilled: number;
    awaitingPayment: number;
    ageingOrders: number;
    cancelledRate: number;
    averageFulfillmentHours: number | null;
  };
  recentOrders: Order[];
  insights: Array<{
    severity: "attention" | "opportunity" | "positive";
    title: string;
    detail: string;
    action: string;
  }>;
};

export type AdminMetric = {
  value: number;
  change: number;
};

export type AdminOrdersResponse = {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export type AdminCatalog = {
  products: Product[];
  brands: Brand[];
  categories: Category[];
  banners: Array<Banner & { isActive: boolean; publishedAt: string }>;
  homeSections: HomeSection[];
  testimonials: Testimonial[];
  checkoutMethods: CheckoutMethod[];
  paymentGateways: PaymentGateway[];
  deliveryZones: DeliveryZone[];
  deliveryRates: DeliveryRate[];
  siteSettings: SiteSettings;
};

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
  orders: number;
  lifetimeSpend: number;
  lastOrderAt?: string | null;
};

export type AdminGuestSession = {
  sessionKey: string;
  email?: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  cartItemCount: number;
  cartValue: number;
  wishlistCount: number;
};

export type AdminGuestSessionDetail = {
  session: AdminGuestSession;
  cart: { id: string | null; items: Array<{ id: string; product: Product; variant?: ProductVariant | null; quantity: number; unitPrice: number }> };
  wishlist: Array<{ id: string; product: Product }>;
  orders: Array<{ id: string; orderNumber: string; status: string; total: number; createdAt: string }>;
};

export type ProductDetailType =
  | "usage"
  | "storage"
  | "nutrition"
  | "side_effects"
  | "ingredients"
  | "warnings"
  | "custom";

export type ProductDetailSection = {
  type: ProductDetailType | string;
  title: string;
  content: string;
};

export type AdminCustomerIntelligence = {
  customer: Pick<AdminCustomer, "id" | "name" | "email" | "phone" | "isActive" | "createdAt"> & {
    updatedAt: string;
  };
  summary: {
    orders: number;
    recognizedOrders: number;
    lifetimeSpend: number;
    averageOrderValue: number;
    cartItems: number;
    cartSubtotal: number;
    wishlistItems: number;
    reviews: number;
    returns: number;
    productViews: number;
    lastOrderAt?: string | null;
    lastSeenAt?: string | null;
  };
  segments: string[];
  preferences?: NotificationPreferences | null;
  addresses: Address[];
  cart?: {
    id: string;
    updatedAt: string;
    items: Array<{
      id: string;
      product: Product;
      variant?: ProductVariant | null;
      quantity: number;
      unitPrice: number;
      createdAt: string;
    }>;
  } | null;
  wishlist: Array<{ product: Product; createdAt: string }>;
  viewedProducts: Array<{
    product: Product;
    views: number;
    carts: number;
    purchased: boolean;
    lastViewedAt: string;
  }>;
  viewedNotPurchased: Array<{
    product: Product;
    views: number;
    carts: number;
    purchased: boolean;
    lastViewedAt: string;
  }>;
  orders: Order[];
  reviews: Review[];
  returns: ReturnRequest[];
  stockAlerts: Array<{
    id: string;
    product: Pick<Product, "id" | "name" | "slug" | "imageUrl">;
    variantId?: string | null;
    notifiedAt?: string | null;
    createdAt: string;
  }>;
  topInterests: Array<{ label: string; count: number }>;
  recentActivity: Array<{
    id: string;
    type: string;
    productId?: string | null;
    product?: Product | null;
    query?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt: string;
  }>;
  acquisition: Array<{
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    landingPage?: string | null;
    createdAt: string;
    lastSeenAt: string;
  }>;
  recommendations: Array<{
    title: string;
    detail: string;
    action: string;
  }>;
};

export type Promotion = {
  id: string;
  name: string;
  code: string;
  type: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
  scope: "ORDER" | "CATEGORY" | "BRAND" | "PRODUCT" | "COMBO";
  targetIds: string[];
  value: number;
  minimumOrder: number;
  maximumDiscount?: number | null;
  usageLimit?: number | null;
  perCustomerLimit: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  _count?: { redemptions: number; orders: number };
  redemptions?: Array<{ discount: number; email: string; createdAt: string }>;
  orders?: Array<{ total: number; status: string }>;
};

export type Supplier = {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  leadTimeDays: number;
  isActive: boolean;
  _count?: { products: number; purchaseOrders: number };
};

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  expectedAt?: string | null;
  notes?: string | null;
  totalCost: number;
  supplier: Supplier;
  items: Array<{
    id: string;
    productId: string;
    variantId?: string | null;
    quantity: number;
    received: number;
    unitCost: number;
    product: Product;
    variant?: ProductVariant | null;
  }>;
  createdAt: string;
};

export type InventoryMovement = {
  id: string;
  type: string;
  quantity: number;
  reason: string;
  reference?: string | null;
  product: { name: string };
  variant?: { name: string; sku: string } | null;
  createdAt: string;
};

export type GrowthAnalytics = {
  periodDays: number;
  funnel: Array<{ stage: string; value: number; conversion: number }>;
  topSearches: Array<{ query: string; count: number }>;
  sources: Array<{
    source: string;
    sessions: number;
    orders: number;
    revenue: number;
    conversion: number;
  }>;
  productSignals: Array<{
    productId: string;
    name: string;
    views: number;
    carts: number;
    units: number;
    revenue: number;
    viewToCart: number;
  }>;
  cohorts: Array<{
    cohort: string;
    customers: number;
    repeatCustomers: number;
    repeatRate: number;
  }>;
  demandForecast: Array<{
    productId: string;
    name: string;
    inventory: number;
    unitsSold: number;
    dailyDemand: number;
    daysOfCover: number | null;
    reorderPoint: number;
    recommendedOrder: number;
    supplier?: string | null;
  }>;
};

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: AuthUser["role"];
  createdAt: string;
  isActive: boolean;
  permissions: Array<{ id: string; permission: string }>;
  accessRole?: Pick<AccessRole, "id" | "key" | "name" | "description"> | null;
};

export type AccessRole = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { users: number };
};

export type PermissionGroup = {
  key: string;
  label: string;
  permissions: Array<{
    key: string;
    label: string;
    description: string;
    risk?: "high";
  }>;
};

export type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  actor?: { name: string; email: string; role: string } | null;
  createdAt: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN" | "OWNER" | "OPERATIONS" | "CATALOG" | "SUPPORT" | "ANALYST";
  phone?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  isActive?: boolean;
  permissions: string[];
  accessRole?: Pick<AccessRole, "id" | "key" | "name"> | null;
};

export type Address = {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  line2?: string | null;
  area?: string | null;
  city: string;
  postalCode?: string | null;
  isDefault: boolean;
};

export type NotificationPreferences = {
  id: string;
  orderEmail: boolean;
  marketingEmail: boolean;
  backInStock: boolean;
  priceDrop: boolean;
};

export type StockAlertSubscription = {
  subscribed: boolean;
  alert?: {
    id: string;
    userId: string;
    productId: string;
    variantId?: string | null;
    notifiedAt?: string | null;
    createdAt: string;
  } | null;
};

export type CustomerNotification = {
  id: string;
  orderId?: string | null;
  email: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type ReturnRequest = {
  id: string;
  returnNumber: string;
  orderId: string;
  reason: string;
  details?: string | null;
  proofUrls?: string[];
  resolution?: string | null;
  resolutionType?: "REFUND" | "REPLACEMENT" | "STORE_CREDIT" | "NO_ACTION" | null;
  status: string;
  items: Array<{
    id: string;
    orderItemId: string;
    quantity: number;
    disposition?: "RESTOCK" | "DAMAGED" | "DISPOSE" | "INSPECTION" | null;
    orderItem?: Order["items"][number];
  }>;
  refund?: {
    id: string;
    amount: number;
    status: Refund["status"];
    reason: string;
    createdAt: string;
    updatedAt?: string;
  } | null;
  order?: { orderNumber: string; total: number } | Order;
  user?: { name: string; email: string };
  createdAt: string;
};

export type Refund = {
  id: string;
  orderId: string;
  paymentId?: string | null;
  amount: number;
  reason: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  order: { id?: string; orderNumber: string; customerName: string; email: string; total: number };
  payment?: { provider: string; method: string; transactionId?: string | null } | null;
  returnRequest?: { id: string; returnNumber: string; status: string } | null;
  createdAt: string;
  updatedAt?: string;
};

export type Payment = {
  id: string;
  orderId: string;
  provider: string;
  method: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PARTIALLY_PAID" | "PAID" | "FAILED" | "PARTIALLY_REFUNDED" | "REFUNDED";
  transactionId?: string | null;
  gatewayReference?: string | null;
  order: { orderNumber: string; customerName: string; email: string; userId?: string | null; total: number };
  createdAt: string;
  updatedAt?: string;
};

export type PromotionValidation = {
  id: string;
  name: string;
  code: string;
  type: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
  scope: Promotion["scope"];
  minimumOrder: number;
  eligibleSubtotal: number;
  discount: number;
  freeShipping: boolean;
};

export type CatalogSearchResult = {
  products: Product[];
  facets: { brands: Brand[]; categories: Category[] };
  pagination: { page: number; limit: number; total: number; pages: number };
};

export type AuthSession = {
  accessToken: string;
  user: AuthUser;
};

export const formatMoney = (value: number) =>
  `\u09F3${new Intl.NumberFormat("en-BD").format(value)}`;

const brands: Brand[] = [
  { id: "brand-naturamart", name: "NaturaMart", story: "Everyday pantry essentials." },
  { id: "brand-harvest", name: "Harvest & Co", story: "Small-batch honey, dates, and nuts." },
  { id: "brand-pureleaf", name: "PureLeaf", story: "Certified organic staples." },
  { id: "brand-bluejar", name: "BlueJar", story: "Premium packed foods." }
];

const categories: Category[] = [
  { id: "cat-honey", name: "Honey", slug: "honey", icon: "Honey", priority: 1 },
  { id: "cat-dates", name: "Dates", slug: "dates", icon: "Dates", priority: 2 },
  { id: "cat-spices", name: "Spices", slug: "spices", icon: "Spice", priority: 3 },
  { id: "cat-nuts", name: "Nuts & Seeds", slug: "nuts-seeds", icon: "Nuts", priority: 4 },
  { id: "cat-oil", name: "Oil & Ghee", slug: "oil-ghee", icon: "Oil", priority: 5 },
  { id: "cat-rice", name: "Rice", slug: "rice", icon: "Rice", priority: 6 },
  { id: "cat-flour", name: "Flours & Lentils", slug: "flours-lentils", icon: "Flour", priority: 7 },
  { id: "cat-certified", name: "Certified", slug: "certified", icon: "Cert", priority: 8 }
];

const productSeeds: Omit<Product, "brand" | "category">[] = [
  {
    id: "product-sundar-honey",
    name: "Sundar Honey 1kg",
    slug: "sundar-honey-1kg",
    description: "Rich floral honey packed for family use.",
    price: 2500,
    compareAt: 2750,
    inventory: 38,
    isNew: false,
    isTrending: true,
    isBestSelling: true,
    isCombo: false,
    isCertified: false,
    badge: "Best selling",
    brandId: "brand-harvest",
    categoryId: "cat-honey",
    tags: ["honey", "family"]
  },
  {
    id: "product-black-honey",
    name: "Black Seed Honey 500g",
    slug: "black-seed-honey-500g",
    description: "Deep, aromatic honey with a bold natural finish.",
    price: 1100,
    compareAt: 1250,
    inventory: 54,
    isNew: true,
    isTrending: true,
    isBestSelling: false,
    isCombo: false,
    isCertified: false,
    badge: "Save 12%",
    brandId: "brand-harvest",
    categoryId: "cat-honey",
    tags: ["honey", "black seed"]
  },
  {
    id: "product-lychee-honey",
    name: "Lychee Flower Honey 500g",
    slug: "lychee-flower-honey-500g",
    description: "Bright honey with a soft lychee blossom note.",
    price: 550,
    compareAt: 600,
    inventory: 72,
    isNew: false,
    isTrending: true,
    isBestSelling: false,
    isCombo: false,
    isCertified: false,
    brandId: "brand-bluejar",
    categoryId: "cat-honey",
    tags: ["honey", "lychee"]
  },
  {
    id: "product-ajwa",
    name: "Premium Ajwa Dates 1kg",
    slug: "premium-ajwa-dates-1kg",
    description: "Soft premium dates selected for gifting and daily nutrition.",
    price: 2250,
    compareAt: 2500,
    inventory: 22,
    isNew: true,
    isTrending: true,
    isBestSelling: false,
    isCombo: false,
    isCertified: false,
    badge: "Save 10%",
    brandId: "brand-harvest",
    categoryId: "cat-dates",
    tags: ["dates", "premium"]
  },
  {
    id: "product-medjool",
    name: "Medjool Dates 1kg",
    slug: "medjool-dates-1kg",
    description: "Large, tender dates with caramel sweetness.",
    price: 2700,
    inventory: 16,
    isNew: false,
    isTrending: true,
    isBestSelling: false,
    isCombo: false,
    isCertified: false,
    brandId: "brand-harvest",
    categoryId: "cat-dates",
    tags: ["dates", "medjool"]
  },
  {
    id: "product-ghee",
    name: "Gawa Ghee 1kg",
    slug: "gawa-ghee-1kg",
    description: "Slow-cooked aromatic ghee for cooking and sweets.",
    price: 1800,
    inventory: 31,
    isNew: false,
    isTrending: false,
    isBestSelling: true,
    isCombo: false,
    isCertified: false,
    badge: "Best selling",
    brandId: "brand-naturamart",
    categoryId: "cat-oil",
    tags: ["ghee", "cooking"]
  },
  {
    id: "product-mustard",
    name: "Deshi Mustard Oil 5 liter",
    slug: "deshi-mustard-oil-5-liter",
    description: "Cold-pressed mustard oil for traditional cooking.",
    price: 1700,
    inventory: 44,
    isNew: false,
    isTrending: true,
    isBestSelling: true,
    isCombo: false,
    isCertified: false,
    brandId: "brand-naturamart",
    categoryId: "cat-oil",
    tags: ["mustard oil", "cooking"]
  },
  {
    id: "product-turmeric",
    name: "Turmeric Powder 500g",
    slug: "turmeric-powder-500g",
    description: "Fine-ground turmeric with warm color and aroma.",
    price: 295,
    inventory: 96,
    isNew: false,
    isTrending: true,
    isBestSelling: false,
    isCombo: false,
    isCertified: true,
    brandId: "brand-pureleaf",
    categoryId: "cat-spices",
    tags: ["spices", "turmeric"]
  },
  {
    id: "product-masala",
    name: "Kala Bhuna Masala 500g",
    slug: "kala-bhuna-masala-500g",
    description: "Ready spice blend for deep savory curries.",
    price: 1350,
    compareAt: 1500,
    inventory: 25,
    isNew: true,
    isTrending: false,
    isBestSelling: false,
    isCombo: false,
    isCertified: true,
    badge: "Offered item",
    brandId: "brand-bluejar",
    categoryId: "cat-spices",
    tags: ["spices", "masala"]
  },
  {
    id: "product-rice-flour",
    name: "Rice Flour 2kg",
    slug: "rice-flour-2kg",
    description: "Finely milled rice flour for baking and snacks.",
    price: 200,
    inventory: 80,
    isNew: false,
    isTrending: false,
    isBestSelling: false,
    isCombo: false,
    isCertified: true,
    brandId: "brand-naturamart",
    categoryId: "cat-flour",
    tags: ["flour", "rice"]
  },
  {
    id: "product-spirulina",
    name: "Organic Spirulina Powder 250g",
    slug: "organic-spirulina-powder-250g",
    description: "Certified green superfood powder for smoothies.",
    price: 1140,
    compareAt: 1200,
    inventory: 17,
    isNew: true,
    isTrending: false,
    isBestSelling: false,
    isCombo: false,
    isCertified: true,
    badge: "Certified",
    brandId: "brand-pureleaf",
    categoryId: "cat-certified",
    tags: ["organic", "superfood"]
  },
  {
    id: "product-coconut",
    name: "Organic Coconut Milk 400ml",
    slug: "organic-coconut-milk-400ml",
    description: "Creamy certified coconut milk for curry and desserts.",
    price: 350,
    inventory: 65,
    isNew: false,
    isTrending: false,
    isBestSelling: false,
    isCombo: false,
    isCertified: true,
    brandId: "brand-pureleaf",
    categoryId: "cat-certified",
    tags: ["organic", "coconut"]
  },
  {
    id: "product-cashew",
    name: "Cashew Nuts Medium 1kg",
    slug: "cashew-nuts-medium-1kg",
    description: "Whole cashews for snacks, cooking, and baking.",
    price: 2000,
    inventory: 28,
    isNew: false,
    isTrending: true,
    isBestSelling: false,
    isCombo: false,
    isCertified: false,
    brandId: "brand-harvest",
    categoryId: "cat-nuts",
    tags: ["nuts", "cashew"]
  },
  {
    id: "product-honey-nuts",
    name: "Honey Nuts 800g",
    slug: "honey-nuts-800g",
    description: "Mixed nuts soaked in natural honey.",
    price: 1700,
    inventory: 18,
    isNew: false,
    isTrending: false,
    isBestSelling: true,
    isCombo: false,
    isCertified: false,
    brandId: "brand-bluejar",
    categoryId: "cat-nuts",
    tags: ["nuts", "honey"]
  },
  {
    id: "product-ghee-honey-combo",
    name: "Ghee & Honey Combo",
    slug: "ghee-honey-combo",
    description: "A family combo with ghee and flower honey.",
    price: 3000,
    compareAt: 3400,
    inventory: 20,
    isNew: false,
    isTrending: true,
    isBestSelling: false,
    isCombo: true,
    comboProductIds: ["product-ghee", "product-honey"],
    showOnHome: false,
    comboPriority: 10,
    isCertified: false,
    badge: "Combo deal",
    brandId: "brand-naturamart",
    categoryId: "cat-oil",
    tags: ["combo", "honey", "ghee"]
  },
  {
    id: "product-spice-combo",
    name: "Spice Starter Combo",
    slug: "spice-starter-combo",
    description: "Core cooking spices selected for daily meals.",
    price: 1500,
    compareAt: 1740,
    inventory: 15,
    isNew: true,
    isTrending: false,
    isBestSelling: false,
    isCombo: true,
    comboProductIds: ["product-turmeric", "product-masala"],
    showOnHome: true,
    comboPriority: 0,
    isCertified: false,
    badge: "Combo deal",
    brandId: "brand-bluejar",
    categoryId: "cat-spices",
    tags: ["combo", "spices"]
  }
];

const products: Product[] = productSeeds.map((product) => ({
  ...product,
  brand: brands.find((brand) => brand.id === product.brandId) ?? null,
  category: categories.find((category) => category.id === product.categoryId) ?? null
}));

for (const product of products) {
  if (!product.isCombo || !product.comboProductIds?.length) continue;
  product.comboProducts = product.comboProductIds
    .map((id) => products.find((item) => item.id === id))
    .filter((item): item is Product => Boolean(item))
    .map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      imageUrl: item.imageUrl,
      price: item.price
    }));
}

export const fallbackProducts = products;

export const fallbackComboDeals = products.filter((product) => product.isCombo);

export const fallbackCatalog: Catalog = {
  siteSettings: {
    title: "Roshira",
    logoUrl: null,
    announcement: "Free delivery over \u09F33,000",
    announcementLinkLabel: "Track your order",
    announcementLinkHref: "/track-order",
    facebookUrl: null,
    instagramUrl: null,
    youtubeUrl: null,
    whatsappUrl: null
  },
  banners: [
    {
      id: "banner-pantry",
      eyebrow: "Everyday pantry market",
      title: "Pantry Staples, Delivered Fresh",
      subtitle: "Honey, dates, spices, grains, oils, and certified goods for everyday cooking.",
      ctaLabel: "Shop groceries",
      ctaHref: "#top-selling",
      imageUrl: "/images/grocery-hero.png",
      priority: 1
    },
    {
      id: "banner-combo",
      eyebrow: "Bundle and save",
      title: "Combos Built For Family Kitchens",
      subtitle: "Bundle regular essentials and keep your cart simple.",
      ctaLabel: "View combos",
      ctaHref: "/combo-deals",
      imageUrl: "/images/packing-story.png",
      priority: 2
    }
  ],
  brands,
  categories,
  newlyLaunched: products.filter((product) => product.isNew),
  trendingProducts: products.filter((product) => product.isTrending),
  topSellingProducts: products.filter((product) => product.isBestSelling),
  comboDeals: fallbackComboDeals.filter((product) => product.showOnHome),
  certifiedProducts: products.filter((product) => product.isCertified),
  justForYou: products,
  categoryShowcase: categories.map((category) => {
    const categoryProducts = products.filter((product) => product.categoryId === category.id);
    return {
      category,
      totalProducts: categoryProducts.length,
      products: categoryProducts.slice(0, 4)
    };
  }),
  featuredReviews: [],
  homeSections: [
    {
      id: "home-trust",
      key: "trust",
      type: "TRUST",
      eyebrow: "A calmer way to stock the pantry",
      title: "Every order comes with clear support",
      subtitle: "Thoughtful sourcing, flexible delivery, and updates you can follow.",
      productLimit: 0,
      priority: 5,
      isActive: true,
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
      id: "home-categories",
      key: "categories",
      type: "CATEGORIES",
      eyebrow: "Browse the pantry",
      title: "Shop by category",
      subtitle: "Straight to the essentials you refill most.",
      ctaLabel: "View all",
      ctaHref: "/shop",
      productLimit: 6,
      priority: 10,
      isActive: true
    },
    {
      id: "home-popular",
      key: "popular",
      type: "PRODUCT_SHELF",
      eyebrow: "Customer favorites",
      title: "Popular right now",
      subtitle: "Reliable staples customers return to.",
      ctaLabel: "Shop all",
      ctaHref: "/shop",
      collection: "topSellingProducts",
      productLimit: 4,
      priority: 20,
      isActive: true
    },
    {
      id: "home-combo",
      key: "combo",
      type: "PROMO",
      eyebrow: "Better together",
      title: "Refill the pantry with fewer decisions.",
      subtitle: "Practical combinations of products that already belong together.",
      ctaLabel: "Explore combo deals",
      ctaHref: "/combo-deals",
      collection: "comboDeals",
      productLimit: 1,
      priority: 30,
      isActive: true
    },
    {
      id: "home-discover",
      key: "discover",
      type: "PRODUCT_SHELF",
      eyebrow: "Fresh choices",
      title: "New and trending",
      subtitle: "A focused selection, refreshed as the catalog changes.",
      ctaLabel: "Browse catalog",
      ctaHref: "/shop",
      collection: "newlyLaunched",
      productLimit: 8,
      priority: 40,
      isActive: true
    },
    {
      id: "home-category-showcase",
      key: "category-showcase",
      type: "PRODUCT_SHELF",
      eyebrow: "A look through every aisle",
      title: "Explore the whole pantry",
      subtitle: "See representative products from every category before you start your full shop.",
      ctaLabel: "Browse all products",
      ctaHref: "/shop",
      collection: "categoryShowcase",
      productLimit: 4,
      priority: 45,
      isActive: true
    },
    {
      id: "home-brands",
      key: "brands",
      type: "BRANDS",
      eyebrow: "Trusted makers",
      title: "Shop by brand",
      subtitle: "Go directly to the names you already know.",
      productLimit: 0,
      priority: 50,
      isActive: true
    },
    {
      id: "home-testimonials",
      key: "testimonials",
      type: "TESTIMONIALS",
      eyebrow: "From our customers",
      title: "Shopping that feels dependable",
      subtitle: "Real feedback from households using My Ecom.",
      productLimit: 0,
      priority: 60,
      isActive: true
    }
  ],
  testimonials: [],
  checkoutMethods: [
    {
      id: "payment-cod",
      type: "PAYMENT",
      code: "CASH_ON_DELIVERY",
      name: "Cash on delivery",
      description: "Pay when your order arrives.",
      fee: 0,
      isActive: true,
      priority: 1
    },
    {
      id: "delivery-standard",
      type: "DELIVERY",
      code: "STANDARD_DHAKA",
      name: "Standard delivery",
      description: "Delivery across Dhaka in 1-2 business days.",
      fee: 80,
      freeThreshold: 3000,
      minDeliveryDays: 1,
      maxDeliveryDays: 2,
      isActive: true,
      priority: 1
    }
  ],
  deliveryZones: [
    {
      id: "zone-dhaka",
      name: "Dhaka city",
      code: "DHAKA",
      city: "Dhaka",
      areas: ["Dhanmondi", "Gulshan", "Banani", "Mirpur", "Uttara"],
      postalCodes: [],
      isActive: true,
      priority: 1
    }
  ]
};

export const testimonials: Testimonial[] = [
  {
    id: "review-1",
    quote: "The checkout was quick and the order tracking made the delivery feel very clear.",
    name: "Shahriar Khan",
    role: "Service holder",
    rating: 5,
    isActive: true,
    priority: 1
  },
  {
    id: "review-2",
    quote: "I ordered pantry staples for the week. The product sections made it easy to compare items.",
    name: "Fariha Akter",
    role: "Entrepreneur",
    rating: 5,
    isActive: true,
    priority: 2
  },
  {
    id: "review-3",
    quote: "The combo section is exactly what a household grocery site needs.",
    name: "Ayesha Khan",
    role: "Banker",
    rating: 5,
    isActive: true,
    priority: 3
  }
];

const configuredApiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const authStorageKey = "my-ecom-access-token";
const guestSessionStorageKey = "my-ecom-guest-session";

export function guestSessionKey() {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(guestSessionStorageKey);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(guestSessionStorageKey, created);
  return created;
}

function normalizedConfiguredApiBase() {
  return configuredApiBase.replace(/\/$/, "");
}

function isLocalApiHost(hostname: string) {
  return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname);
}

function apiBase() {
  if (typeof window === "undefined") return normalizedConfiguredApiBase();
  try {
    const url = new URL(configuredApiBase);
    if (isLocalApiHost(url.hostname)) return "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return normalizedConfiguredApiBase();
  }
}

export function resolveMediaUrl(value?: string | null) {
  const source = value?.trim();
  if (!source) return "";
  if (source.startsWith("/uploads/")) return source;
  try {
    const url = new URL(source);
    if (isLocalApiHost(url.hostname) && url.pathname.startsWith("/uploads/")) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return source;
  }
  return source;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window === "undefined" ? null : window.localStorage.getItem(authStorageKey);
  const response = await fetch(`${apiBase()}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : { "X-Guest-Session": guestSessionKey() }),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(" ")
      : body?.message;
    throw new Error(message ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchCatalog() {
  return request<Catalog>("/catalog/home");
}

export async function searchCatalog(input?: {
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  Object.entries(input ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== false) query.set(key, String(value));
  });
  return request<CatalogSearchResult>(`/catalog/search?${query.toString()}`);
}

export async function fetchProduct(slug: string) {
  return request<Product>(`/products/${encodeURIComponent(slug)}`);
}

export async function fetchComboDeals() {
  return request<Product[]>("/combo-deals");
}

export async function createCheckout(input: {
  customerName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  shippingInfo?: AddressInfo;
  billingInfo?: AddressInfo;
  billingSameAsShipping?: boolean;
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
  addressId?: string;
  promotionCode?: string;
  paymentMethod?: string;
  payNowAmount?: number;
  deliveryMethodCode?: string;
  deliveryZoneCode?: string;
  sessionKey?: string;
  idempotencyKey?: string;
  checkoutSource?: "cart" | "buy-now";
}) {
  return request<Order>("/checkout", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function analyticsSessionKey() {
  if (typeof window === "undefined") return "";
  const key = "my-ecom-analytics-session";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

export async function trackAnalyticsEvent(input: {
  type:
    | "SESSION_STARTED"
    | "PRODUCT_VIEWED"
    | "SEARCHED"
    | "ADDED_TO_CART"
    | "REMOVED_FROM_CART"
    | "CHECKOUT_STARTED"
    | "CHECKOUT_COMPLETED"
    | "WISHLIST_ADDED"
    | "REVIEW_SUBMITTED"
    | "COUPON_APPLIED";
  productId?: string;
  orderId?: string;
  query?: string;
  metadata?: Record<string, unknown>;
}) {
  const params = new URLSearchParams(window.location.search);
  if (input.type === "PRODUCT_VIEWED" && input.productId) {
    const key = `my-ecom-product-viewed:${input.productId}`;
    const now = Date.now();
    const previous = Number(window.sessionStorage.getItem(key) ?? 0);
    if (previous && now - previous < 60 * 1000) {
      return { skipped: true };
    }
    window.sessionStorage.setItem(key, String(now));
  }
  return request("/analytics/events", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      sessionKey: analyticsSessionKey(),
      source: params.get("utm_source") ?? undefined,
      medium: params.get("utm_medium") ?? undefined,
      campaign: params.get("utm_campaign") ?? undefined,
      landingPage: window.location.pathname
    })
  });
}

export async function fetchProductReviews(productId: string) {
  return request<Review[]>(`/reviews/products/${encodeURIComponent(productId)}`);
}

export async function fetchMyProductReview(productId: string) {
  return request<Review | null>(`/reviews/products/${encodeURIComponent(productId)}/mine`);
}

export async function submitProductReview(
  productId: string,
  input: { rating: number; title?: string; comment: string; orderId?: string }
) {
  return request<Review>(`/reviews/products/${encodeURIComponent(productId)}`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function validatePromotion(
  code: string,
  subtotal: number,
  items?: Array<{ productId: string; variantId?: string; quantity: number }>
) {
  return request<PromotionValidation>("/promotions/validate", {
    method: "POST",
    body: JSON.stringify({ code, subtotal, items })
  });
}

export async function fetchAddresses() {
  return request<Address[]>("/account/addresses");
}

export async function createAddress(input: Omit<Address, "id">) {
  return request<Address>("/account/addresses", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateAddress(id: string, input: Omit<Address, "id">) {
  return request<Address>(`/account/addresses/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function deleteAddress(id: string) {
  return request<{ deleted: boolean }>(`/account/addresses/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export async function fetchAccountCart() {
  return request<{
    id?: string | null;
    items: Array<{ product: Product; variant?: ProductVariant | null; quantity: number }>;
  }>("/account/cart");
}

export async function saveAccountCart(items: Array<{
  productId: string;
  variantId?: string;
  quantity: number;
}>) {
  return request("/account/cart", {
    method: "PUT",
    body: JSON.stringify({ items })
  });
}

export async function fetchAccountWishlist() {
  return request<Array<{ product: Product }>>("/account/wishlist");
}

export async function addAccountWishlist(productId: string) {
  return request(`/account/wishlist/${encodeURIComponent(productId)}`, { method: "POST" });
}

export async function removeAccountWishlist(productId: string) {
  return request(`/account/wishlist/${encodeURIComponent(productId)}`, { method: "DELETE" });
}

export async function fetchPreferences() {
  return request<NotificationPreferences>("/account/preferences");
}

export async function fetchNotifications() {
  return request<CustomerNotification[]>("/notifications");
}

export async function markNotificationRead(id: string) {
  return request<CustomerNotification>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH"
  });
}

export async function markAllNotificationsRead() {
  return request<{ updated: number }>("/notifications/read-all", { method: "PATCH" });
}

export async function deleteNotification(id: string) {
  return request<{ deleted: boolean }>(`/notifications/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export async function updatePreferences(input: Partial<NotificationPreferences>) {
  return request<NotificationPreferences>("/account/preferences", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function fetchReturns() {
  return request<ReturnRequest[]>("/account/returns");
}

export async function createReturnRequest(input: {
  orderId: string;
  reason: string;
  details?: string;
  proofUrls?: string[];
  items: Array<{ orderItemId: string; quantity: number }>;
}) {
  return request<ReturnRequest>("/account/returns", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function uploadReturnProof(file: File) {
  const token =
    typeof window === "undefined" ? null : window.localStorage.getItem(authStorageKey);
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${apiBase()}/api/account/return-proofs`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Proof upload failed.");
  }
  return response.json() as Promise<{ filename: string; url: string }>;
}

export async function cancelReturnRequest(id: string) {
  return request<ReturnRequest>(`/account/returns/${encodeURIComponent(id)}/cancel`, {
    method: "PATCH"
  });
}

export async function deleteProductReview(productId: string) {
  return request<{ deleted: boolean }>(`/reviews/products/${encodeURIComponent(productId)}`, {
    method: "DELETE"
  });
}

export async function fetchRecommendations() {
  return request<Product[]>("/account/recommendations");
}

export async function fetchOrder(idOrNumber: string, email?: string) {
  const query = email ? `?email=${encodeURIComponent(email)}` : "";
  return request<Order>(`/orders/${encodeURIComponent(idOrNumber)}${query}`);
}

export async function cancelOrder(idOrNumber: string) {
  return request<Order>(`/orders/${encodeURIComponent(idOrNumber)}/cancel`, { method: "PATCH" });
}

export async function subscribeStockAlert(productId: string, variantId?: string) {
  return request<{ id: string }>(`/products/${encodeURIComponent(productId)}/stock-alert`, {
    method: "POST",
    body: JSON.stringify({ variantId })
  });
}

export type CheckoutQuote = {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  requiredPaymentPercent: number;
  amountDueNow: number;
  amountDueOnDelivery: number;
  advancePaymentSubtotal?: number;
  advancePaymentItems?: Array<{
    productId: string;
    variantId?: string;
    productName: string;
    quantity: number;
    lineTotal: number;
    discountedLineTotal: number;
    advancePaymentPercent: number;
    advancePaymentAmount: number;
  }>;
  invalidItems: Array<{ productId: string; variantId?: string; reason: string }>;
  deliveryZone?: { id: string; code: string; name: string; city?: string | null } | null;
  paymentMethods: CheckoutMethod[];
  deliveryMethods: Array<CheckoutMethod & {
    baseFee?: number;
    rateId?: string;
  }>;
  selectedPaymentMethod?: CheckoutMethod | null;
  selectedDeliveryMethod?: CheckoutMethod | null;
  promotion?: { id: string; code: string; name: string; type: string } | null;
};

export async function fetchCheckoutQuote(input: {
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
  email?: string;
  promotionCode?: string;
  paymentMethod?: string;
  deliveryMethodCode?: string;
  deliveryZoneCode?: string;
  shippingInfo?: AddressInfo;
}) {
  return request<CheckoutQuote>("/checkout/quote", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchProductEligibility(input: {
  productId: string;
  variantId?: string;
  quantity?: number;
  deliveryZoneCode?: string;
  shippingInfo?: AddressInfo;
}) {
  return request<{
    canAddToCart: boolean;
    reason?: string | null;
    deliveryZone?: { id: string; code: string; name: string; city?: string | null } | null;
    paymentMethods: CheckoutMethod[];
    deliveryMethods: CheckoutMethod[];
    requiredPaymentPercent: number;
    amountDueNow: number;
  }>("/checkout/eligibility", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchStockAlertSubscription(productId: string, variantId?: string) {
  const query = variantId ? `?variantId=${encodeURIComponent(variantId)}` : "";
  return request<StockAlertSubscription>(
    `/products/${encodeURIComponent(productId)}/stock-alert${query}`
  );
}

export async function createAdminResource<T>(
  path:
    | "brands"
    | "banners"
    | "categories"
    | "products"
    | "home-sections"
    | "testimonials"
    | "checkout-methods"
    | "payment-gateways"
    | "delivery-zones"
    | "delivery-rates"
    | "courier-services",
  input: unknown
) {
  return request<T>(`/admin/${path}`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateAdminResource<T>(path: string, id: string, input: unknown) {
  return request<T>(`/admin/${path}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function deleteAdminResource(path: string, id: string) {
  return request<{ deleted?: boolean; archived?: boolean }>(
    `/admin/${path}/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function permanentlyDeleteAdminResource(path: string, id: string, password: string) {
  return request<{ deleted: boolean }>(
    `/admin/${path}/${encodeURIComponent(id)}/permanent-delete`,
    { method: "POST", body: JSON.stringify({ password }) }
  );
}

export async function fetchAdminDashboard(days = 30) {
  return request<AdminDashboard>(`/admin/dashboard?days=${days}`);
}

export async function fetchAdminOrders(input?: {
  search?: string;
  status?: string;
  paymentStatus?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (input?.search) query.set("search", input.search);
  if (input?.status) query.set("status", input.status);
  if (input?.paymentStatus) query.set("paymentStatus", input.paymentStatus);
  query.set("page", String(input?.page ?? 1));
  query.set("limit", String(input?.limit ?? 25));
  return request<AdminOrdersResponse>(`/admin/orders?${query.toString()}`);
}

export async function fetchAdminOrder(idOrNumber: string) {
  return request<Order>(`/admin/orders/${encodeURIComponent(idOrNumber)}`);
}

export async function fetchCourierServices() {
  return request<CourierService[]>("/admin/courier-services");
}

export async function createCourierService(input: {
  provider: CourierProvider;
  name: string;
  code?: string;
  description?: string;
  apiBaseUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  clientId?: string;
  clientSecret?: string;
  storeId?: string;
  defaultPickupAddress?: string;
  settings?: Record<string, unknown>;
  isActive?: boolean;
  priority?: number;
}) {
  return request<CourierService>("/admin/courier-services", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateCourierService(id: string, input: Partial<CourierService>) {
  return request<CourierService>(`/admin/courier-services/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function deleteCourierService(id: string) {
  return request<{ deleted?: boolean; archived?: boolean; service?: CourierService }>(
    `/admin/courier-services/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function dispatchCourierShipment(idOrNumber: string, input: {
  courierServiceId: string;
  pickupAddress?: string;
  parcelType?: string;
  specialInstruction?: string;
  cashCollectionAmount?: number;
  trackingCode?: string;
  providerOrderId?: string;
  consignmentId?: string;
}) {
  return request<Order>(`/admin/orders/${encodeURIComponent(idOrNumber)}/courier-shipments`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateCourierShipment(id: string, input: {
  status: CourierShipmentStatus;
  trackingCode?: string;
  providerOrderId?: string;
  consignmentId?: string;
  location?: string;
  message?: string;
  deliveryFailedReason?: string;
  paymentCollected?: boolean;
  collectedAmount?: number;
}) {
  return request<Order>(`/admin/courier-shipments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function syncCourierShipment(id: string) {
  return request<Order>(`/admin/courier-shipments/${encodeURIComponent(id)}/sync`, {
    method: "POST"
  });
}

export async function updateAdminOrder(idOrNumber: string, input: {
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  trackingCode?: string;
  courierName?: string;
  adminNote?: string;
  location?: string;
  note?: string;
}) {
  return request<Order>(`/admin/orders/${encodeURIComponent(idOrNumber)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function createAdminOrder(input: {
  customerName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  paymentMethod?: string;
  deliveryMethodCode?: string;
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
}) {
  return request<Order>("/admin/orders", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function cancelAdminOrder(idOrNumber: string) {
  return request<Order>(`/admin/orders/${encodeURIComponent(idOrNumber)}`, {
    method: "DELETE"
  });
}

export async function fetchAdminCatalog() {
  return request<AdminCatalog>("/admin/catalog");
}

export async function updateSiteSettings(input: Partial<SiteSettings>) {
  return request<SiteSettings>("/admin/site-settings", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function updateAdminProduct(id: string, input: {
  name?: string;
  description?: string;
  inventory?: number;
  price?: number;
  costPrice?: number;
  compareAt?: number;
  baseOptionEnabled?: boolean;
  baseOptionLabel?: string;
  imageUrl?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isNew?: boolean;
  isTrending?: boolean;
  isBestSelling?: boolean;
  isCombo?: boolean;
  comboProductIds?: string[];
  showOnHome?: boolean;
  comboPriority?: number;
  isCertified?: boolean;
  badge?: string;
  brandId?: string;
  categoryId?: string;
  tags?: string[];
  details?: ProductDetailSection[];
  checkoutPolicy?: CheckoutPolicy;
}) {
  return request<Product>(`/admin/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export type ComboDealInput = {
  name: string;
  description: string;
  price: number;
  costPrice?: number;
  compareAt?: number;
  inventory?: number;
  imageUrl?: string;
  imageUrls?: string[];
  comboProductIds: string[];
  showOnHome?: boolean;
  comboPriority?: number;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  badge?: string;
  tags?: string[];
  details?: ProductDetailSection[];
};

export async function createAdminComboDeal(input: ComboDealInput) {
  return request<Product>("/admin/combo-deals", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateAdminComboDeal(id: string, input: Partial<ComboDealInput>) {
  return request<Product>(`/admin/combo-deals/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function archiveAdminComboDeal(id: string) {
  return request<{ archived: boolean; combo: Product }>(
    `/admin/combo-deals/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function updateAdminBanner(
  id: string,
  input: Partial<Omit<AdminCatalog["banners"][number], "id" | "publishedAt">>
) {
  return request<AdminCatalog["banners"][number]>(
    `/admin/banners/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input)
    }
  );
}

export async function updateAdminCustomer(
  id: string,
  input: { name?: string; phone?: string; isActive?: boolean }
) {
  return request<AdminCustomer>(`/admin/customers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function fetchAdminCustomerIntelligence(id: string) {
  return request<AdminCustomerIntelligence>(
    `/admin/customers/${encodeURIComponent(id)}/intelligence`
  );
}

export async function fetchAdminGuestSessions(search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<AdminGuestSession[]>(`/admin/guest-sessions${query}`);
}

export async function fetchAdminGuestSessionDetail(sessionKey: string) {
  return request<AdminGuestSessionDetail>(`/admin/guest-sessions/${encodeURIComponent(sessionKey)}`);
}

export async function fetchAdminCustomers(search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<AdminCustomer[]>(`/admin/customers${query}`);
}

export async function fetchAdminPromotions() {
  return request<Promotion[]>("/admin/promotions");
}

export async function createAdminPromotion(input: {
  name: string;
  code: string;
  type: Promotion["type"];
  scope?: Promotion["scope"];
  targetIds?: string[];
  value: number;
  minimumOrder?: number;
  maximumDiscount?: number;
  usageLimit?: number;
  perCustomerLimit?: number;
  startsAt: string;
  endsAt: string;
  isActive?: boolean;
}) {
  return request<Promotion>("/admin/promotions", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function toggleAdminPromotion(id: string, isActive: boolean) {
  return request<Promotion>(`/admin/promotions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive })
  });
}

export async function updateAdminPromotion(id: string, input: Partial<Promotion>) {
  return request<Promotion>(`/admin/promotions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function deleteAdminPromotion(id: string) {
  return deleteAdminResource("promotions", id);
}

export async function fetchAdminReviews(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<Review[]>(`/admin/reviews${query}`);
}

export async function moderateAdminReview(
  id: string,
  input: {
    status?: Review["status"];
    adminReply?: string;
    showOnHome?: boolean;
    homePriority?: number;
  }
) {
  return request<Review>(`/admin/reviews/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function fetchAdminReturns(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<ReturnRequest[]>(`/admin/returns${query}`);
}

export async function updateAdminReturn(
  id: string,
  input: {
    status: string;
    resolution?: string;
    resolutionType?: ReturnRequest["resolutionType"];
    items?: Array<{
      returnItemId: string;
      disposition: NonNullable<ReturnRequest["items"][number]["disposition"]>;
    }>;
  }
) {
  return request<ReturnRequest>(`/admin/returns/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function fetchSuppliers() {
  return request<Supplier[]>("/admin/suppliers");
}

export async function fetchAdminRefunds() {
  return request<Refund[]>("/admin/refunds");
}

export async function updateAdminRefund(id: string, input: { status: Refund["status"]; reason?: string }) {
  return request<Refund>(`/admin/refunds/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function createManualRefund(orderId: string, input: { amount: number; reason: string }) {
  return request<Refund>(`/admin/orders/${encodeURIComponent(orderId)}/refunds`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchAdminPayments(params?: { search?: string; status?: string; provider?: string }) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  if (params?.provider) query.set("provider", params.provider);
  const suffix = query.toString();
  return request<Payment[]>(`/admin/payments${suffix ? `?${suffix}` : ""}`);
}

export async function recheckAdminPayment(id: string) {
  return request<Payment>(`/admin/payments/${encodeURIComponent(id)}/recheck`, { method: "POST" });
}

export async function initiateBkashPayment(orderId: string) {
  return request<{ bkashURL: string; paymentID: string }>("/checkout/bkash/initiate", {
    method: "POST",
    body: JSON.stringify({ orderId })
  });
}

export async function executeBkashPayment(paymentID: string) {
  return request<Order>("/checkout/bkash/execute", {
    method: "POST",
    body: JSON.stringify({ paymentID })
  });
}

export async function markBkashPaymentFailed(paymentID: string) {
  return request<Order>("/checkout/bkash/failed", {
    method: "POST",
    body: JSON.stringify({ paymentID })
  });
}

export async function fetchInfoPages() {
  return request<InfoPageContent[]>("/catalog/info-pages");
}

export async function updateInfoPage(
  slug: string,
  input: { eyebrow?: string; title?: string; intro?: string; points?: Array<{ title: string; detail: string }> }
) {
  return request<InfoPageContent>(`/admin/info-pages/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function createSupplier(input: {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  leadTimeDays?: number;
}) {
  return request<Supplier>("/admin/suppliers", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateSupplier(id: string, input: Partial<Supplier>) {
  return request<Supplier>(`/admin/suppliers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function deleteSupplier(id: string) {
  return deleteAdminResource("suppliers", id);
}

export async function fetchPurchaseOrders() {
  return request<PurchaseOrder[]>("/admin/purchase-orders");
}

export async function createPurchaseOrder(input: {
  supplierId: string;
  expectedAt?: string;
  notes?: string;
  items: Array<{ productId: string; variantId?: string; quantity: number; unitCost: number }>;
}) {
  return request<PurchaseOrder>("/admin/purchase-orders", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updatePurchaseOrder(
  id: string,
  input: { status?: string; receiveAll?: boolean; expectedAt?: string; notes?: string }
) {
  return request<PurchaseOrder>(`/admin/purchase-orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function fetchInventoryMovements(productId?: string) {
  const query = productId ? `?productId=${encodeURIComponent(productId)}` : "";
  return request<InventoryMovement[]>(`/admin/inventory-movements${query}`);
}

export async function adjustInventory(input: {
  productId: string;
  variantId?: string;
  quantity: number;
  reason: string;
}) {
  return request<InventoryMovement>("/admin/inventory-adjustments", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function createProductVariant(
  productId: string,
  input: {
    name: string;
    sku: string;
    price: number;
    costPrice?: number;
    compareAt?: number;
    inventory: number;
    unitType?: UnitType;
    unitValue?: number;
    attributes?: Record<string, unknown>;
  }
) {
  return request<ProductVariant>(`/admin/products/${encodeURIComponent(productId)}/variants`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function addProductImage(
  productId: string,
  input: { url: string; alt?: string; position?: number }
) {
  return request<ProductImage>(`/admin/products/${encodeURIComponent(productId)}/images`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateProductImage(
  productId: string,
  id: string,
  input: { url?: string; alt?: string; position?: number }
) {
  return request<ProductImage>(
    `/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

export async function deleteProductImage(productId: string, id: string) {
  return request<{ deleted?: boolean; archived?: boolean }>(
    `/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function updateProductVariant(
  productId: string,
  id: string,
  input: Partial<Omit<ProductVariant, "id" | "productId">>
) {
  return request<ProductVariant>(
    `/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

export async function deleteProductVariant(productId: string, id: string) {
  return request<{ deleted?: boolean; archived?: boolean }>(
    `/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function fetchGrowthAnalytics(days = 30) {
  return request<GrowthAnalytics>(`/admin/growth?days=${days}`);
}

export async function fetchAuditLogs() {
  return request<AuditLog[]>("/admin/audit-logs");
}

export async function fetchStaff() {
  return request<StaffMember[]>("/admin/staff");
}

export async function fetchPermissionCatalogue() {
  return request<PermissionGroup[]>("/admin/access/permissions");
}

export async function fetchAccessRoles() {
  return request<AccessRole[]>("/admin/access/roles");
}

export async function createAccessRole(input: {
  name: string;
  description?: string;
  permissions: string[];
}) {
  return request<AccessRole>("/admin/access/roles", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateAccessRole(
  id: string,
  input: {
    name?: string;
    description?: string;
    permissions?: string[];
    isActive?: boolean;
  }
) {
  return request<AccessRole>(`/admin/access/roles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function duplicateAccessRole(id: string) {
  return request<AccessRole>(
    `/admin/access/roles/${encodeURIComponent(id)}/duplicate`,
    { method: "POST" }
  );
}

export async function deleteAccessRole(id: string) {
  return request<{ deleted: boolean }>(
    `/admin/access/roles/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function updateStaff(
  id: string,
  input: { accessRoleId?: string; isActive?: boolean }
) {
  return request<StaffMember>(`/admin/staff/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function createStaff(input: {
  name: string;
  email: string;
  password: string;
  accessRoleId: string;
}) {
  return request<StaffMember>("/admin/staff", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function deactivateStaff(id: string) {
  return request<StaffMember>(`/admin/staff/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export async function loginUser(input: { email: string; password: string }) {
  return request<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ ...input, sessionKey: guestSessionKey() })
  });
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) {
  return request<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ ...input, sessionKey: guestSessionKey() })
  });
}

export async function fetchMe() {
  return request<AuthUser>("/auth/me");
}

export async function updateMe(input: {
  name?: string;
  phone?: string;
  avatarUrl?: string;
}) {
  return request<AuthUser>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  return request<{ changed: boolean }>("/auth/password", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function deleteAccount() {
  return request<{ deleted: boolean }>("/auth/me", { method: "DELETE" });
}

export async function requestPasswordReset(email: string) {
  return request<{ requested: boolean }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export async function resetPassword(token: string, newPassword: string) {
  return request<{ reset: boolean }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword })
  });
}

export async function sendStaffResetLink(id: string) {
  return request<{ sent: boolean }>(`/admin/staff/${encodeURIComponent(id)}/reset-password`, {
    method: "POST"
  });
}

export async function fetchAccountOrders() {
  return request<Order[]>("/auth/orders");
}

export async function uploadAdminImage(file: File) {
  const token =
    typeof window === "undefined" ? null : window.localStorage.getItem(authStorageKey);
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${apiBase()}/api/admin/uploads`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Image upload failed.");
  }
  return response.json() as Promise<{ filename: string; url: string }>;
}
