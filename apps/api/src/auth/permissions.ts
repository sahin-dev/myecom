import { SetMetadata } from "@nestjs/common";
import { UserRole } from "@prisma/client";

export const ADMIN_PERMISSION_KEY = "admin-permissions";

export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(ADMIN_PERMISSION_KEY, permissions);

type Permission = { key: string; label: string; description: string; risk?: "high" };
type PermissionGroup = { key: string; label: string; permissions: Permission[] };

const permission = (
  key: string,
  label: string,
  description: string,
  risk?: "high"
): Permission => ({ key, label, description, risk });

export const permissionCatalogue: PermissionGroup[] = [
  {
    key: "workspace",
    label: "Workspace and analytics",
    permissions: [
      permission("dashboard.read", "View dashboard", "View operational summaries and alerts."),
      permission("growth.read", "View growth analytics", "View revenue, acquisition, and retention reports."),
      permission("audit.read", "View audit log", "View sensitive administrative activity."),
      permission("analytics.export", "Export reports", "Download operational and analytics data.")
    ]
  },
  {
    key: "products",
    label: "Products and inventory",
    permissions: [
      permission("catalog.read", "View products", "View products, variants, categories, and brands."),
      permission("products.create", "Add products", "Create products and upload product media."),
      permission("products.update", "Update products", "Edit product details, variants, and media."),
      permission("products.delete", "Archive products", "Remove products from sale.", "high"),
      permission("products.permanent_delete", "Permanently delete products", "Irreversibly erase a product and its images, variants, reviews, and cart/wishlist entries.", "high"),
      permission("inventory.read", "View inventory", "View stock levels and inventory history."),
      permission("inventory.write", "Adjust inventory", "Change stock quantities and record adjustments.", "high"),
      permission("brands.manage", "Manage brands", "Create, update, and remove brands."),
      permission("categories.manage", "Manage categories", "Create, update, and remove categories."),
      permission("combos.manage", "Manage combo deals", "Create and maintain product bundles."),
      permission("combos.permanent_delete", "Permanently delete combo deals", "Irreversibly erase a combo deal and its images and variants.", "high"),
      permission("uploads.write", "Upload files", "Upload images and other store media.")
    ]
  },
  {
    key: "orders",
    label: "Orders and customers",
    permissions: [
      permission("orders.read", "View orders", "View customer, item, and fulfillment details."),
      permission("orders.create", "Create orders", "Create a customer order from the dashboard.", "high"),
      permission("orders.update", "Update orders", "Change fulfillment, payment, courier, and notes.", "high"),
      permission("orders.delete", "Cancel orders", "Cancel eligible orders and release inventory.", "high"),
      permission("orders.permanent_delete", "Permanently delete orders", "Irreversibly erase an order and all of its items, payments, refunds, and shipment records.", "high"),
      permission("orders.export", "Export orders", "Download order records."),
      permission("customers.read", "View customers", "View customer profiles and purchase history."),
      permission("customers.write", "Update customers", "Update customer details and account access.", "high"),
      permission("payments.read", "View payments", "View transaction records, methods, and status for orders."),
      permission("payments.write", "Manage payments", "Re-check gateway status and reconcile payment records.", "high"),
      permission("payments.permanent_delete", "Permanently delete payments", "Irreversibly erase a payment record and its refunds.", "high"),
      permission("couriers.read", "View couriers", "View courier services, shipment records, and parcel status."),
      permission("couriers.write", "Manage couriers", "Create, configure, enable, and disable courier services.", "high"),
      permission("couriers.dispatch", "Dispatch parcels", "Send order parcel requests and update courier delivery status.", "high")
    ]
  },
  {
    key: "service",
    label: "Returns and customer service",
    permissions: [
      permission("returns.read", "View returns", "View return requests and returned items."),
      permission("returns.write", "Manage returns", "Approve, reject, receive, and resolve returns.", "high"),
      permission("refunds.read", "View refunds", "View refund records and status."),
      permission("refunds.write", "Manage refunds", "Process and update refunds.", "high"),
      permission("reviews.read", "View reviews", "View product reviews and testimonials."),
      permission("reviews.write", "Moderate reviews", "Approve, reject, reply to, and feature reviews.")
    ]
  },
  {
    key: "operations",
    label: "Supply operations",
    permissions: [
      permission("suppliers.read", "View suppliers", "View supplier records."),
      permission("suppliers.write", "Manage suppliers", "Create and update suppliers."),
      permission("purchase_orders.read", "View purchase orders", "View replenishment orders."),
      permission("purchase_orders.write", "Manage purchase orders", "Create, receive, and cancel purchase orders.", "high")
    ]
  },
  {
    key: "storefront",
    label: "Marketing and storefront",
    permissions: [
      permission("content.write", "Manage storefront", "Manage banners, homepage sections, testimonials, and site identity."),
      permission("promotions.read", "View promotions", "View coupon performance and configuration."),
      permission("promotions.write", "Manage promotions", "Create, update, and remove coupons.", "high"),
      permission("promotions.permanent_delete", "Permanently delete promotions", "Irreversibly erase a coupon and its redemption history, even if it has been used.", "high"),
      permission("checkout.read", "View checkout settings", "View payment methods, delivery methods, zones, and platform checkout policy."),
      permission("checkout_policy.write", "Manage checkout policy", "Configure platform payment requirements and allowed delivery areas.", "high"),
      permission("payment_methods.read", "View payment methods", "View cash, online payment, and gateway provider setup."),
      permission("payment_methods.write", "Manage payment methods", "Enable, reorder, and configure payment methods and gateway providers.", "high"),
      permission("delivery_methods.read", "View delivery methods", "View delivery service types and timing defaults."),
      permission("delivery_methods.write", "Manage delivery methods", "Create, update, enable, and reorder delivery service types.", "high"),
      permission("delivery_zones.read", "View delivery zones", "View service areas, postal codes, and zone rates."),
      permission("delivery_zones.write", "Manage delivery zones", "Create, update, and remove delivery areas and zone rates.", "high"),
      permission("checkout.write", "Manage all checkout settings", "Legacy all-access permission for checkout methods, zones, rates, and policy.", "high")
    ]
  },
  {
    key: "governance",
    label: "Team and access",
    permissions: [
      permission("staff.read", "View staff", "View staff accounts and assigned roles."),
      permission("staff.create", "Create staff", "Create a new staff login.", "high"),
      permission("staff.update", "Assign staff roles", "Change a staff member's access role.", "high"),
      permission("staff.deactivate", "Deactivate staff", "Block a staff member from signing in.", "high"),
      permission("roles.read", "View access roles", "View permission policies and role usage."),
      permission("roles.create", "Create access roles", "Compose a reusable access role.", "high"),
      permission("roles.update", "Update access roles", "Change permissions for a role.", "high"),
      permission("roles.delete", "Delete access roles", "Delete an unused custom role.", "high")
    ]
  }
];

const allPermissions = permissionCatalogue.flatMap((group) =>
  group.permissions.map((item) => item.key)
);

export const rolePermissions: Record<UserRole, string[]> = {
  CUSTOMER: [],
  OWNER: ["*"],
  ADMIN: allPermissions,
  OPERATIONS: [
    "dashboard.read", "orders.read", "orders.create", "orders.update", "orders.delete",
    "orders.export", "customers.read", "customers.write", "returns.read", "returns.write",
    "refunds.read", "refunds.write", "payments.read", "payments.write", "suppliers.read", "suppliers.write",
    "couriers.read", "couriers.write", "couriers.dispatch",
    "purchase_orders.read", "purchase_orders.write", "inventory.read", "inventory.write",
    "catalog.read", "uploads.write", "checkout.read", "delivery_methods.read",
    "delivery_zones.read"
  ],
  CATALOG: [
    "dashboard.read", "catalog.read", "products.create", "products.update",
    "products.delete", "inventory.read", "brands.manage", "categories.manage",
    "combos.manage", "content.write", "promotions.read", "promotions.write",
    "reviews.read", "reviews.write", "growth.read", "uploads.write", "checkout.read",
    "checkout_policy.write", "payment_methods.read", "payment_methods.write",
    "delivery_methods.read", "delivery_methods.write", "delivery_zones.read",
    "delivery_zones.write", "checkout.write"
  ],
  SUPPORT: [
    "dashboard.read", "orders.read", "orders.update", "customers.read",
    "customers.write", "returns.read", "returns.write", "refunds.read",
    "payments.read", "reviews.read", "reviews.write", "couriers.read",
    "couriers.dispatch"
  ],
  ANALYST: [
    "dashboard.read", "orders.read", "orders.export", "customers.read",
    "growth.read", "inventory.read", "catalog.read", "promotions.read",
    "payments.read", "checkout.read", "payment_methods.read", "delivery_methods.read",
    "delivery_zones.read", "couriers.read"
  ]
};

export const systemAccessRoles = [
  {
    key: "owner",
    name: "Owner",
    description: "Protected unrestricted access for the business owner.",
    permissions: ["*"]
  },
  {
    key: "administrator",
    name: "Administrator",
    description: "Full day-to-day access, including team and access management.",
    permissions: rolePermissions.ADMIN
  },
  {
    key: "order-manager",
    name: "Order manager",
    description: "Orders, customers, returns, refunds, and fulfillment.",
    permissions: rolePermissions.OPERATIONS
  },
  {
    key: "catalog-manager",
    name: "Catalog manager",
    description: "Products, stock visibility, merchandising, and storefront content.",
    permissions: rolePermissions.CATALOG
  },
  {
    key: "customer-support",
    name: "Customer support",
    description: "Customer, order, return, and review support with limited updates.",
    permissions: rolePermissions.SUPPORT
  },
  {
    key: "analyst",
    name: "Analyst",
    description: "Read-only access to performance, customer, order, and inventory data.",
    permissions: rolePermissions.ANALYST
  }
];
