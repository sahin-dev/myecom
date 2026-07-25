import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";
import {
  AuthUser,
  AuthenticatedRequest,
  OptionalAuthenticatedRequest
} from "./auth.types";
import { ADMIN_PERMISSION_KEY, rolePermissions } from "./permissions";

function bearerToken(header?: string) {
  const [type, token] = header?.split(" ") ?? [];
  return type === "Bearer" ? token : undefined;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    protected readonly jwt: JwtService,
    protected readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException("Authentication required.");

    try {
      const claims = await this.jwt.verifyAsync<AuthUser>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: claims.id },
        select: { id: true, email: true, role: true, isActive: true }
      });
      if (!user?.isActive) throw new Error("Inactive account");
      request.user = {
        id: user.id,
        email: user.email,
        role: user.role
      };
      return true;
    } catch {
      throw new UnauthorizedException("Your session is invalid or expired.");
    }
  }
}

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<OptionalAuthenticatedRequest>();
    const token = bearerToken(request.headers.authorization);
    if (!token) return true;

    try {
      const claims = await this.jwt.verifyAsync<AuthUser>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: claims.id },
        select: { id: true, email: true, role: true, isActive: true }
      });
      request.user = user?.isActive
        ? { id: user.id, email: user.email, role: user.role }
        : undefined;
    } catch {
      request.user = undefined;
    }
    return true;
  }
}

@Injectable()
export class AdminGuard extends JwtAuthGuard {
  constructor(
    jwt: JwtService,
    private readonly reflector: Reflector,
    prisma: PrismaService
  ) {
    super(jwt, prisma);
  }

  async canActivate(context: ExecutionContext) {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user.role === UserRole.CUSTOMER) {
      throw new ForbiddenException("Administrator access required.");
    }
    if (
      request.user.role === UserRole.ADMIN ||
      request.user.role === UserRole.OWNER
    ) {
      return true;
    }

    const required =
      this.reflector.getAllAndOverride<string[]>(ADMIN_PERMISSION_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];
    if (!required.length) {
      throw new ForbiddenException("This administrative action is restricted.");
    }
    const custom = await this.prisma.staffPermission.findMany({
      where: { userId: request.user.id },
      select: { permission: true }
    });
    const available = new Set([
      ...rolePermissions[request.user.role],
      ...custom.map((item) => item.permission)
    ]);
    if (!required.some((permission) => available.has(permission))) {
      throw new ForbiddenException("You do not have permission for this action.");
    }
    return true;
  }
}

@Injectable()
export class OwnerGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext) {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (
      request.user.role !== UserRole.ADMIN &&
      request.user.role !== UserRole.OWNER
    ) {
      throw new ForbiddenException("Owner or administrator access required.");
    }
    return true;
  }
}
