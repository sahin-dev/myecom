import { SetMetadata } from "@nestjs/common";
import { UserRole } from "@prisma/client";

export const ADMIN_PERMISSION_KEY = "admin-permissions";

export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(ADMIN_PERMISSION_KEY, permissions);

export const rolePermissions: Record<UserRole, string[]> = {
  CUSTOMER: [],
  ADMIN: ["*"],
  OWNER: ["*"],
  OPERATIONS: [
    "dashboard.read",
    "orders.read",
    "orders.write",
    "customers.read",
    "customers.write",
    "returns.read",
    "returns.write",
    "suppliers.read",
    "suppliers.write",
    "purchase_orders.read",
    "purchase_orders.write",
    "inventory.read",
    "inventory.write"
  ],
  CATALOG: [
    "dashboard.read",
    "catalog.read",
    "catalog.write",
    "content.write",
    "promotions.read",
    "promotions.write",
    "reviews.read",
    "reviews.write",
    "growth.read",
    "uploads.write"
  ],
  SUPPORT: [
    "dashboard.read",
    "orders.read",
    "orders.write",
    "customers.read",
    "customers.write",
    "returns.read",
    "returns.write",
    "reviews.read",
    "reviews.write"
  ],
  ANALYST: [
    "dashboard.read",
    "orders.read",
    "customers.read",
    "growth.read",
    "inventory.read"
  ]
};
