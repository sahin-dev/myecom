import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateProfileDto
} from "./auth.dto";
import { JwtAuthGuard } from "./auth.guards";
import type { AuthenticatedRequest } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.profile(request.user.id);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  update(@Req() request: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(request.user.id, dto);
  }

  @Patch("password")
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto
  ) {
    return this.auth.changePassword(request.user.id, dto.currentPassword, dto.newPassword);
  }

  @Delete("me")
  @UseGuards(JwtAuthGuard)
  deleteAccount(@Req() request: AuthenticatedRequest) {
    return this.auth.deleteAccount(request.user.id);
  }

  @Get("orders")
  @UseGuards(JwtAuthGuard)
  orders(@Req() request: AuthenticatedRequest) {
    return this.auth.orders(request.user.email);
  }
}
