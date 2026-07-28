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
      permission("inventory.read", "View inventory", "View stock levels and inventory history."),
      permission("inventory.write", "Adjust inventory", "Change stock quantities and record adjustments.", "high"),
      permission("brands.manage", "Manage brands", "Create, update, and remove brands."),
      permission("categories.manage", "Manage categories", "Create, update, and remove categories."),
      permission("combos.manage", "Manage combo deals", "Create and maintain product bundles."),
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
      permission("orders.export", "Export orders", "Download order records."),
      permission("customers.read", "View customers", "View customer profiles and purchase history."),
      permission("customers.write", "Update customers", "Update customer details and account access.", "high"),
      permission("payments.read", "View payments", "View transaction records, methods, and status for orders."),
      permission("payments.write", "Manage payments", "Re-check gateway status and reconcile payment records.", "high")
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
      permission("checkout.write", "Manage checkout methods", "Enable and configure payment and delivery methods.", "high")
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
    "purchase_orders.read", "purchase_orders.write", "inventory.read", "inventory.write",
    "catalog.read", "uploads.write"
  ],
  CATALOG: [
    "dashboard.read", "catalog.read", "products.create", "products.update",
    "products.delete", "inventory.read", "brands.manage", "categories.manage",
    "combos.manage", "content.write", "promotions.read", "promotions.write",
    "reviews.read", "reviews.write", "growth.read", "uploads.write"
  ],
  SUPPORT: [
    "dashboard.read", "orders.read", "orders.update", "customers.read",
    "customers.write", "returns.read", "returns.write", "refunds.read",
    "payments.read", "reviews.read", "reviews.write"
  ],
  ANALYST: [
    "dashboard.read", "orders.read", "orders.export", "customers.read",
    "growth.read", "inventory.read", "catalog.read", "promotions.read", "payments.read"
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
