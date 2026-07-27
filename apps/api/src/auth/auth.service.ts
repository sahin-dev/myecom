import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto, RegisterDto, UpdateProfileDto } from "./auth.dto";
import { hashPassword, verifyPassword } from "./password";
import { AccessControlService } from "./access-control.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly access: AccessControlService
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
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user?.isActive || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Email or password is incorrect.");
    }
    return this.session(user);
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
