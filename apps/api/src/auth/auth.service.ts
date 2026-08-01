import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { LoginDto, RegisterDto, UpdateProfileDto } from "./auth.dto";
import { generateResetToken, hashPassword, hashResetToken, verifyPassword } from "./password";
import { AccessControlService } from "./access-control.service";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly access: AccessControlService,
    private readonly mail: MailService,
    private readonly config: ConfigService
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException("An account already exists for this email.");

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email,
        passwordHash: await hashPassword(dto.password),
        phone: dto.phone?.trim()
      }
    });
    await this.claimGuestSession(user.id, dto.sessionKey);
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user?.isActive || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Email or password is incorrect.");
    }
    await this.claimGuestSession(user.id, dto.sessionKey);
    return this.session(user);
  }

  private async claimGuestSession(userId: string, sessionKey?: string) {
    if (!sessionKey) return;

    const guestCart = await this.prisma.cart.findFirst({
      where: { sessionKey },
      include: { items: true }
    });
    if (guestCart) {
      const accountCart = await this.prisma.cart.findFirst({ where: { userId } });
      if (accountCart) {
        for (const item of guestCart.items) {
          const existing = await this.prisma.cartItem.findFirst({
            where: {
              cartId: accountCart.id,
              productId: item.productId,
              variantId: item.variantId ?? null
            }
          });
          if (existing) {
            await this.prisma.cartItem.update({
              where: { id: existing.id },
              data: { quantity: existing.quantity + item.quantity }
            });
          } else {
            await this.prisma.cartItem.create({
              data: {
                cartId: accountCart.id,
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
                unitPrice: item.unitPrice
              }
            });
          }
        }
        await this.prisma.cartItem.deleteMany({ where: { cartId: guestCart.id } });
        await this.prisma.cart.delete({ where: { id: guestCart.id } });
      } else {
        await this.prisma.cart.update({
          where: { id: guestCart.id },
          data: { userId, sessionKey: null }
        });
      }
    }

    const guestWishlist = await this.prisma.wishlistItem.findMany({ where: { sessionKey } });
    for (const item of guestWishlist) {
      const existing = await this.prisma.wishlistItem.findFirst({
        where: { userId, productId: item.productId }
      });
      if (!existing) {
        await this.prisma.wishlistItem.create({ data: { userId, productId: item.productId } });
      }
    }
    if (guestWishlist.length) {
      await this.prisma.wishlistItem.deleteMany({ where: { sessionKey } });
    }

    await this.prisma.guestSession.deleteMany({ where: { sessionKey } });
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.publicUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone?.trim(),
        avatarUrl: dto.avatarUrl
      }
    });
    return this.publicUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException("Current password is incorrect.");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) }
    });
    return { updated: true };
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    });
    return { deleted: true };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always respond the same way whether or not the account exists, to avoid leaking which emails are registered.
    if (user?.isActive) {
      await this.issueResetToken(user);
    }
    return { requested: true };
  }

  async issueResetToken(user: Pick<User, "id" | "name" | "email">) {
    const { token, tokenHash } = generateResetToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS)
      }
    });
    const webOrigin = this.config.get<string>("WEB_ORIGINS")?.split(",")[0]?.trim() ?? "http://localhost:3000";
    const resetUrl = `${webOrigin}/reset-password?token=${token}`;
    await this.mail.send({
      to: user.email,
      subject: "Reset your password",
      text: `Hi ${user.name}, reset your password using this link (valid for 1 hour): ${resetUrl}`,
      html: `<p>Hi ${user.name},</p><p>Reset your password using the link below. It's valid for 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
    });
    return { resetUrl };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = hashResetToken(token);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException("This reset link is invalid or has expired.");
    }
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(newPassword) }
    });
    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() }
    });
    return { reset: true };
  }

  async orders(email: string) {
    return this.prisma.order.findMany({
      where: { email },
      include: {
        items: true,
        trackingEvents: { orderBy: { createdAt: "asc" } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  private async session(user: User) {
    const accessToken = await this.jwt.signAsync({
      id: user.id,
      sub: user.id,
      email: user.email,
      role: user.role
    });
    return { accessToken, user: await this.publicUser(user) };
  }

  private async publicUser(user: User) {
    const access = await this.access.userAccess(user.id, user.role);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      ...access
    };
  }
}
