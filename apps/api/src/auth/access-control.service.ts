import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  permissionCatalogue,
  rolePermissions,
  systemAccessRoles
} from "./permissions";

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  catalogue() {
    return permissionCatalogue;
  }

  async ensureSystemRoles() {
    const roles = await Promise.all(
      systemAccessRoles.map((role) =>
        this.prisma.accessRole.upsert({
          where: { key: role.key },
          update: {
            name: role.name,
            description: role.description,
            permissions: role.permissions,
            isSystem: true,
            isActive: true
          },
          create: { ...role, isSystem: true }
        })
      )
    );
    const roleByKey = new Map(roles.map((role) => [role.key, role.id]));
    const legacyAssignments: Array<[UserRole, string]> = [
      [UserRole.OWNER, "owner"],
      [UserRole.ADMIN, "administrator"],
      [UserRole.OPERATIONS, "order-manager"],
      [UserRole.CATALOG, "catalog-manager"],
      [UserRole.SUPPORT, "customer-support"],
      [UserRole.ANALYST, "analyst"]
    ];
    await Promise.all(
      legacyAssignments.map(([legacyRole, key]) =>
        this.prisma.user.updateMany({
          where: {
            role: legacyRole,
            OR: [
              { accessRoleId: null },
              { accessRoleId: { isSet: false } }
            ]
          },
          data: { accessRoleId: roleByKey.get(key) }
        })
      )
    );
  }

  async roles() {
    await this.ensureSystemRoles();
    return this.prisma.accessRole.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }]
    });
  }

  async createRole(
    actorId: string,
    input: { name: string; description?: string; permissions: string[] }
  ) {
    const permissions = this.validatePermissions(input.permissions);
    const key = slugify(input.name);
    if (!key) throw new BadRequestException("Role name is required.");
    const role = await this.prisma.accessRole.create({
      data: {
        key,
        name: input.name.trim(),
        description: input.description?.trim(),
        permissions
      },
      include: { _count: { select: { users: true } } }
    });
    await this.audit(actorId, "access_role.created", role.id, {
      name: role.name,
      permissions
    });
    return role;
  }

  async updateRole(
    actorId: string,
    id: string,
    input: { name?: string; description?: string; permissions?: string[]; isActive?: boolean }
  ) {
    const current = await this.prisma.accessRole.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Access role not found.");
    if (current.isSystem) {
      throw new ConflictException("Preset roles are protected. Duplicate one to customize it.");
    }
    const role = await this.prisma.accessRole.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        description: input.description?.trim(),
        permissions: input.permissions
          ? this.validatePermissions(input.permissions)
          : undefined,
        isActive: input.isActive
      },
      include: { _count: { select: { users: true } } }
    });
    await this.audit(actorId, "access_role.updated", role.id, {
      name: role.name,
      permissions: role.permissions
    });
    return role;
  }

  async duplicateRole(actorId: string, id: string) {
    const current = await this.prisma.accessRole.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Access role not found.");
    let suffix = 1;
    let key = `${current.key}-copy`;
    while (await this.prisma.accessRole.findUnique({ where: { key } })) {
      suffix += 1;
      key = `${current.key}-copy-${suffix}`;
    }
    const role = await this.prisma.accessRole.create({
      data: {
        key,
        name: `${current.name} copy`,
        description: current.description,
        permissions: current.permissions
      },
      include: { _count: { select: { users: true } } }
    });
    await this.audit(actorId, "access_role.duplicated", role.id, { sourceId: id });
    return role;
  }

  async deleteRole(actorId: string, id: string) {
    const role = await this.prisma.accessRole.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } }
    });
    if (!role) throw new NotFoundException("Access role not found.");
    if (role.isSystem) {
      throw new ConflictException("Preset roles cannot be deleted. Duplicate one to customize it.");
    }
    if (role._count.users) {
      throw new ConflictException("Reassign staff members before deleting this role.");
    }
    await this.prisma.accessRole.delete({ where: { id } });
    await this.audit(actorId, "access_role.deleted", id, { name: role.name });
    return { deleted: true };
  }

  async effectivePermissions(
    userId: string,
    baseRole?: UserRole
  ): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        accessRole: { select: { name: true, isActive: true, permissions: true } },
        permissions: { select: { permission: true } }
      }
    });
    const role = user?.role ?? baseRole ?? UserRole.CUSTOMER;
    if (role === UserRole.OWNER) return ["*"];
    const assigned =
      user?.accessRole?.isActive === true ? user.accessRole.permissions : null;
    const permissions = new Set([
      ...(assigned ?? rolePermissions[role]),
      ...(user?.permissions.map((item) => item.permission) ?? [])
    ]);
    return [...permissions];
  }

  async userAccess(userId: string, baseRole: UserRole) {
    if (baseRole !== UserRole.CUSTOMER) {
      await this.ensureSystemRoles();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        accessRole: { select: { id: true, key: true, name: true } }
      }
    });
    return {
      accessRole: user?.accessRole ?? null,
      permissions: await this.effectivePermissions(userId, baseRole)
    };
  }

  can(available: string[], required: string[]) {
    if (available.includes("*")) return true;
    const compatibility: Record<string, string[]> = {
      "catalog.write": ["products.create", "products.update", "products.delete", "combos.manage"],
      "orders.write": ["orders.update", "orders.delete"],
      "content.write": ["content.write", "brands.manage", "categories.manage"],
      "checkout.read": ["checkout.write", "checkout_policy.write", "payment_methods.read", "payment_methods.write", "delivery_methods.read", "delivery_methods.write", "delivery_zones.read", "delivery_zones.write"],
      "checkout_policy.write": ["checkout.write"],
      "payment_methods.read": ["checkout.write", "payment_methods.write"],
      "payment_methods.write": ["checkout.write"],
      "delivery_methods.read": ["checkout.write", "delivery_methods.write"],
      "delivery_methods.write": ["checkout.write"],
      "delivery_zones.read": ["checkout.write", "delivery_zones.write"],
      "delivery_zones.write": ["checkout.write"]
    };
    return required.some((permission) =>
      available.includes(permission) ||
      (compatibility[permission] ?? []).some((candidate) => available.includes(candidate))
    );
  }

  validatePermissions(input: string[]) {
    const known = new Set(permissionCatalogue.flatMap((group) => group.permissions.map((item) => item.key)));
    const permissions = [...new Set(input)];
    const invalid = permissions.filter((permission) => !known.has(permission));
    if (invalid.length) {
      throw new BadRequestException(`Unknown permissions: ${invalid.join(", ")}`);
    }
    return permissions;
  }

  private audit(
    actorId: string,
    action: string,
    entityId: string,
    metadata?: Record<string, unknown>
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity: "AccessRole",
        entityId,
        metadata: metadata as Prisma.InputJsonValue | undefined
      }
    });
  }
}
