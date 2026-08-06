import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AUTH_COOKIE_NAME, authCookieOptions } from "./auth.cookies";
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

/**
 * Structural, not express.Response — this project has no @types/express
 * dependency (see AuthenticatedRequest in auth.types.ts for the same
 * approach), and cookie/clearCookie is all a route handler needs here.
 */
type CookieResponse = {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options?: Record<string, unknown>): void;
};

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService
  ) {}

  @Post("register")
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: CookieResponse) {
    const { accessToken, user } = await this.auth.register(dto);
    response.cookie(AUTH_COOKIE_NAME, accessToken, authCookieOptions(this.config));
    return { user };
  }

  @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: CookieResponse) {
    const { accessToken, user } = await this.auth.login(dto);
    response.cookie(AUTH_COOKIE_NAME, accessToken, authCookieOptions(this.config));
    return { user };
  }

  /**
   * The cookie is httpOnly, so client JS can't clear it itself the way it
   * used to drop the token from localStorage — logging out has to be a real
   * request the server answers with a Set-Cookie that expires it.
   */
  @Post("logout")
  logout(@Res({ passthrough: true }) response: CookieResponse) {
    response.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
    return { loggedOut: true };
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
