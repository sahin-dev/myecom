import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  AdminGuard,
  JwtAuthGuard,
  OptionalJwtAuthGuard
} from "../auth/auth.guards";
import type {
  AuthenticatedRequest,
  OptionalAuthenticatedRequest
} from "../auth/auth.types";
import { RequirePermission } from "../auth/permissions";
import { UpdateCustomerDto } from "../experience/experience.dto";
import {
  AdminUpdateBannerDto,
  AdminUpdateOrderDto,
  AdminUpdateProductDto,
  CheckoutDto,
  CreateBannerDto,
  CreateBrandDto,
  CreateCategoryDto,
  CreateCheckoutMethodDto,
  CreateHomeSectionDto,
  CreateProductDto,
  CreateTestimonialDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateCheckoutMethodDto,
  UpdateHomeSectionDto,
  UpdateOrderStatusDto,
  UpdateSiteSettingsDto,
  UpdateTestimonialDto
} from "./ecommerce.dto";
import { EcommerceService } from "./ecommerce.service";

@Controller()
export class EcommerceController {
  constructor(private readonly ecommerce: EcommerceService) {}

  @Get("health")
  health() {
    return { status: "ok" };
  }

  @Get("catalog/home")
  home() {
    return this.ecommerce.home();
  }

  @Get("products")
  products(@Query("search") search?: string) {
    return this.ecommerce.products(search);
  }

  @Get("products/:slug")
  product(@Param("slug") slug: string) {
    return this.ecommerce.product(slug);
  }

  @Get("combo-deals")
  comboDeals() {
    return this.ecommerce.comboDeals();
  }

  @Get("checkout/methods")
  checkoutMethods() {
    return this.ecommerce.checkoutMethods();
  }

  @Post("admin/brands")
  @UseGuards(AdminGuard)
  @RequirePermission("brands.manage")
  createBrand(@Body() dto: CreateBrandDto) {
    return this.ecommerce.createBrand(dto);
  }

  @Patch("admin/brands/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("brands.manage")
  updateBrand(@Param("id") id: string, @Body() dto: UpdateBrandDto) {
    return this.ecommerce.updateBrand(id, dto);
  }

  @Delete("admin/brands/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("brands.manage")
  deleteBrand(@Param("id") id: string) {
    return this.ecommerce.deleteBrand(id);
  }

  @Post("admin/categories")
  @UseGuards(AdminGuard)
  @RequirePermission("categories.manage")
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.ecommerce.createCategory(dto);
  }

  @Patch("admin/categories/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("categories.manage")
  updateCategory(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.ecommerce.updateCategory(id, dto);
  }

  @Delete("admin/categories/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("categories.manage")
  deleteCategory(@Param("id") id: string) {
    return this.ecommerce.deleteCategory(id);
  }

  @Post("admin/banners")
  @UseGuards(AdminGuard)
  @RequirePermission("content.write")
  createBanner(@Body() dto: CreateBannerDto) {
    return this.ecommerce.createBanner(dto);
  }

  @Post("admin/products")
  @UseGuards(AdminGuard)
  @RequirePermission("products.create")
  createProduct(@Body() dto: CreateProductDto) {
    return this.ecommerce.createProduct(dto);
  }

  @Post("admin/combo-deals")
  @UseGuards(AdminGuard)
  @RequirePermission("combos.manage")
  createComboDeal(@Body() dto: CreateProductDto) {
    return this.ecommerce.createComboDeal(dto);
  }

  @Patch("admin/combo-deals/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("combos.manage")
  updateComboDeal(@Param("id") id: string, @Body() dto: AdminUpdateProductDto) {
    return this.ecommerce.updateComboDeal(id, dto);
  }

  @Delete("admin/combo-deals/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("combos.manage")
  archiveComboDeal(@Param("id") id: string) {
    return this.ecommerce.archiveComboDeal(id);
  }

  @Delete("admin/products/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("products.delete")
  archiveProduct(@Param("id") id: string) {
    return this.ecommerce.archiveProduct(id);
  }

  @Get("admin/dashboard")
  @UseGuards(AdminGuard)
  @RequirePermission("dashboard.read")
  adminDashboard(@Query("days") days?: string) {
    return this.ecommerce.adminDashboard(days);
  }

  @Get("admin/orders")
  @UseGuards(AdminGuard)
  @RequirePermission("orders.read")
  adminOrders(
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("paymentStatus") paymentStatus?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.ecommerce.adminOrders({ search, status, paymentStatus, page, limit });
  }

  @Post("admin/orders")
  @UseGuards(AdminGuard)
  @RequirePermission("orders.create")
  adminCreateOrder(
    @Body() dto: CheckoutDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ecommerce.adminCreateOrder(dto, request.user.id);
  }

  @Get("admin/orders/:idOrNumber")
  @UseGuards(AdminGuard)
  @RequirePermission("orders.read")
  adminOrder(@Param("idOrNumber") idOrNumber: string) {
    return this.ecommerce.adminOrder(idOrNumber);
  }

  @Patch("admin/orders/:idOrNumber")
  @UseGuards(AdminGuard)
  @RequirePermission("orders.update")
  adminUpdateOrder(
    @Param("idOrNumber") idOrNumber: string,
    @Body() dto: AdminUpdateOrderDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ecommerce.adminUpdateOrder(idOrNumber, dto, request.user.id);
  }

  @Delete("admin/orders/:idOrNumber")
  @UseGuards(AdminGuard)
  @RequirePermission("orders.delete")
  adminCancelOrder(@Param("idOrNumber") idOrNumber: string) {
    return this.ecommerce.adminCancelOrder(idOrNumber);
  }

  @Get("admin/catalog")
  @UseGuards(AdminGuard)
  @RequirePermission("catalog.read", "inventory.read")
  adminCatalog() {
    return this.ecommerce.adminCatalog();
  }

  @Patch("admin/site-settings")
  @UseGuards(AdminGuard)
  @RequirePermission("content.write")
  updateSiteSettings(@Body() dto: UpdateSiteSettingsDto) {
    return this.ecommerce.updateSiteSettings(dto);
  }

  @Patch("admin/products/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("products.update")
  adminUpdateProduct(@Param("id") id: string, @Body() dto: AdminUpdateProductDto) {
    return this.ecommerce.adminUpdateProduct(id, dto);
  }

  @Patch("admin/banners/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("content.write")
  adminUpdateBanner(@Param("id") id: string, @Body() dto: AdminUpdateBannerDto) {
    return this.ecommerce.adminUpdateBanner(id, dto);
  }

  @Delete("admin/banners/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("content.write")
  adminDeleteBanner(@Param("id") id: string) {
    return this.ecommerce.adminDeleteBanner(id);
  }

  @Post("admin/home-sections")
  @UseGuards(AdminGuard)
  @RequirePermission("content.write")
  createHomeSection(@Body() dto: CreateHomeSectionDto) {
    return this.ecommerce.createHomeSection(dto);
  }

  @Patch("admin/home-sections/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("content.write")
  updateHomeSection(@Param("id") id: string, @Body() dto: UpdateHomeSectionDto) {
    return this.ecommerce.updateHomeSection(id, dto);
  }

  @Delete("admin/home-sections/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("content.write")
  deleteHomeSection(@Param("id") id: string) {
    return this.ecommerce.deleteHomeSection(id);
  }

  @Post("admin/testimonials")
  @UseGuards(AdminGuard)
  @RequirePermission("content.write")
  createTestimonial(@Body() dto: CreateTestimonialDto) {
    return this.ecommerce.createTestimonial(dto);
  }

  @Patch("admin/testimonials/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("content.write")
  updateTestimonial(@Param("id") id: string, @Body() dto: UpdateTestimonialDto) {
    return this.ecommerce.updateTestimonial(id, dto);
  }

  @Delete("admin/testimonials/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("content.write")
  deleteTestimonial(@Param("id") id: string) {
    return this.ecommerce.deleteTestimonial(id);
  }

  @Post("admin/checkout-methods")
  @UseGuards(AdminGuard)
  @RequirePermission("checkout.write")
  createCheckoutMethod(@Body() dto: CreateCheckoutMethodDto) {
    return this.ecommerce.createCheckoutMethod(dto);
  }

  @Patch("admin/checkout-methods/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("checkout.write")
  updateCheckoutMethod(@Param("id") id: string, @Body() dto: UpdateCheckoutMethodDto) {
    return this.ecommerce.updateCheckoutMethod(id, dto);
  }

  @Delete("admin/checkout-methods/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("checkout.write")
  deleteCheckoutMethod(@Param("id") id: string) {
    return this.ecommerce.deleteCheckoutMethod(id);
  }

  @Get("admin/customers")
  @UseGuards(AdminGuard)
  @RequirePermission("customers.read")
  adminCustomers(@Query("search") search?: string) {
    return this.ecommerce.adminCustomers(search);
  }

  @Patch("admin/customers/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("customers.write")
  adminUpdateCustomer(@Param("id") id: string, @Body() dto: UpdateCustomerDto) {
    return this.ecommerce.adminUpdateCustomer(id, dto);
  }

  @Post("checkout")
  @UseGuards(OptionalJwtAuthGuard)
  checkout(@Body() dto: CheckoutDto, @Req() request: OptionalAuthenticatedRequest) {
    return this.ecommerce.checkout(dto, request.user);
  }

  @Get("orders/:idOrNumber")
  @UseGuards(OptionalJwtAuthGuard)
  order(
    @Param("idOrNumber") idOrNumber: string,
    @Query("email") email: string | undefined,
    @Req() request: OptionalAuthenticatedRequest
  ) {
    return this.ecommerce.order(idOrNumber, request.user?.email ?? email);
  }

  @Patch("orders/:idOrNumber/status")
  @UseGuards(AdminGuard)
  @RequirePermission("orders.update")
  updateOrderStatus(@Param("idOrNumber") idOrNumber: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ecommerce.updateOrderStatus(idOrNumber, dto);
  }

  @Patch("orders/:idOrNumber/cancel")
  @UseGuards(JwtAuthGuard)
  cancelOwnOrder(@Param("idOrNumber") idOrNumber: string, @Req() request: AuthenticatedRequest) {
    return this.ecommerce.customerCancelOrder(idOrNumber, request.user);
  }

  @Get("notifications")
  @UseGuards(JwtAuthGuard)
  notifications(@Req() request: AuthenticatedRequest) {
    return this.ecommerce.notifications(request.user.email);
  }

  @Patch("notifications/read-all")
  @UseGuards(JwtAuthGuard)
  markAllNotificationsRead(@Req() request: AuthenticatedRequest) {
    return this.ecommerce.markAllNotificationsRead(request.user.email);
  }

  @Patch("notifications/:id/read")
  @UseGuards(JwtAuthGuard)
  markNotificationRead(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.ecommerce.markNotificationRead(id, request.user.email);
  }

  @Delete("notifications/:id")
  @UseGuards(JwtAuthGuard)
  deleteNotification(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.ecommerce.deleteNotification(id, request.user.email);
  }
}
