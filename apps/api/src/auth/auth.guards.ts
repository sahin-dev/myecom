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
import { AccessControlService } from "./access-control.service";
import { AUTH_COOKIE_NAME } from "./auth.cookies";
import {
  AuthUser,
  AuthenticatedRequest,
  OptionalAuthenticatedRequest
} from "./auth.types";
import { ADMIN_PERMISSION_KEY } from "./permissions";

/**
 * The cookie is how the browser authenticates itself; the Authorization
 * header stays supported alongside it so a non-browser client (a script, a
 * future mobile app) can still call the API with a bearer token directly.
 */
function extractToken(request: AuthenticatedRequest | OptionalAuthenticatedRequest) {
  const cookieToken = request.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const [type, token] = request.headers.authorization?.split(" ") ?? [];
  return type === "Bearer" ? token : undefined;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    protected readonly jwt: JwtService,
    protected readonly prisma: PrismaService,
    protected readonly access: AccessControlService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractToken(request);
    if (!token) throw new UnauthorizedException("Authentication required.");

    try {
      const claims = await this.jwt.verifyAsync<AuthUser>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: claims.id },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          accessRole: { select: { id: true, key: true, name: true } }
        }
      });
      if (!user?.isActive) throw new Error("Inactive account");
      request.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        accessRole: user.accessRole,
        permissions: await this.access.effectivePermissions(user.id, user.role)
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
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<OptionalAuthenticatedRequest>();
    const token = extractToken(request);
    if (!token) return true;

    try {
      const claims = await this.jwt.verifyAsync<AuthUser>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: claims.id },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          accessRole: { select: { id: true, key: true, name: true } }
        }
      });
      request.user = user?.isActive
        ? {
            id: user.id,
            email: user.email,
            role: user.role,
            accessRole: user.accessRole,
            permissions: await this.access.effectivePermissions(user.id, user.role)
          }
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
    prisma: PrismaService,
    access: AccessControlService
  ) {
    super(jwt, prisma, access);
  }

  async canActivate(context: ExecutionContext) {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user.role === UserRole.CUSTOMER) {
      throw new ForbiddenException("Administrator access required.");
    }
    const required =
      this.reflector.getAllAndOverride<string[]>(ADMIN_PERMISSION_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];
    if (!required.length) {
      throw new ForbiddenException("This administrative action is restricted.");
    }
    if (!this.access.can(request.user.permissions, required)) {
      throw new ForbiddenException("You do not have permission for this action.");
    }
    return true;
  }
}
