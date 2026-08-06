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
import { PermanentDeleteDto } from "../auth/auth.dto";
import { UpdateCustomerDto } from "../experience/experience.dto";
import {
  AdminUpdateBannerDto,
  AdminUpdateOrderDto,
  UpdateOrderContactDto,
  FulfillOrderItemsDto,
  AdminUpdateProductDto,
  CheckoutDto,
  CheckoutQuoteDto,
  CreateBannerDto,
  CreateBrandDto,
  CreateCategoryDto,
  CreateCheckoutMethodDto,
  CreateCourierServiceDto,
  CreateDeliveryRateDto,
  CreateDeliveryZoneDto,
  CreateHomeSectionDto,
  CreatePaymentGatewayDto,
  CreateProductDto,
  CreateTestimonialDto,
  DispatchCourierShipmentDto,
  ProductEligibilityDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateCheckoutMethodDto,
  UpdateCourierServiceDto,
  UpdateCourierShipmentDto,
  UpdateDeliveryRateDto,
  UpdateDeliveryZoneDto,
  UpdateHomeSectionDto,
  UpdateOrderStatusDto,
  UpdatePaymentGatewayDto,
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

  @Get("checkout/delivery-zones")
  deliveryZones() {
    return this.ecommerce.deliveryZones();
  }

  @Post("checkout/quote")
  @UseGuards(OptionalJwtAuthGuard)
  checkoutQuote(@Body() dto: CheckoutQuoteDto) {
    return this.ecommerce.checkoutQuote(dto);
  }

  @Post("checkout/eligibility")
  @UseGuards(OptionalJwtAuthGuard)
  checkoutEligibility(@Body() dto: ProductEligibilityDto) {
    return this.ecommerce.productEligibility(dto);
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

  @Post("admin/combo-deals/:id/permanent-delete")
  @UseGuards(AdminGuard)
  @RequirePermission("combos.permanent_delete")
  permanentlyDeleteComboDeal(
    @Param("id") id: string,
    @Body() dto: PermanentDeleteDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ecommerce.permanentlyDeleteComboDeal(request.user.id, dto.password, id);
  }

  @Delete("admin/products/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("products.delete")
  archiveProduct(@Param("id") id: string) {
    return this.ecommerce.archiveProduct(id);
  }

  @Post("admin/products/:id/permanent-delete")
  @UseGuards(AdminGuard)
  @RequirePermission("products.permanent_delete")
  permanentlyDeleteProduct(
    @Param("id") id: string,
    @Body() dto: PermanentDeleteDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ecommerce.permanentlyDeleteProduct(request.user.id, dto.password, id);
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
    @Query("queue") queue?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.ecommerce.adminOrders({ search, status, paymentStatus, queue, page, limit });
  }

  /** Sizes of the exception queues, for the ops header on the orders screen. */
  @Get("admin/order-queues")
  @UseGuards(AdminGuard)
  @RequirePermission("orders.read")
  adminOrderQueues() {
    return this.ecommerce.adminOrderQueues();
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

  /** Internal history: who did what to this order. */
  @Get("admin/orders/:idOrNumber/activity")
  @UseGuards(AdminGuard)
  @RequirePermission("orders.read")
  adminOrderActivity(@Param("idOrNumber") idOrNumber: string) {
    return this.ecommerce.adminOrderActivity(idOrNumber);
  }

  @Patch("admin/orders/:idOrNumber/contact")
  @UseGuards(AdminGuard)
  @RequirePermission("orders.update")
  adminUpdateOrderContact(
    @Param("idOrNumber") idOrNumber: string,
    @Body() dto: UpdateOrderContactDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ecommerce.adminUpdateOrderContact(idOrNumber, dto, request.user.id);
  }

  @Patch("admin/orders/:idOrNumber/fulfillment")
  @UseGuards(AdminGuard)
  @RequirePermission("orders.update")
  adminFulfillOrderItems(
    @Param("idOrNumber") idOrNumber: string,
    @Body() dto: FulfillOrderItemsDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ecommerce.adminFulfillOrderItems(idOrNumber, dto, request.user.id);
  }

  @Post("admin/orders/:idOrNumber/risk-reviewed")
  @UseGuards(AdminGuard)
  @RequirePermission("orders.update")
  adminReviewOrderRisk(
    @Param("idOrNumber") idOrNumber: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ecommerce.adminReviewOrderRisk(idOrNumber, request.user.id);
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
  adminCancelOrder(
    @Param("idOrNumber") idOrNumber: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ecommerce.adminCancelOrder(idOrNumber, request.user.id);
  }

  @Post("admin/orders/:idOrNumber/permanent-delete")
  @UseGuards(AdminGuard)
  @RequirePermission("orders.permanent_delete")
  permanentlyDeleteOrder(
    @Param("idOrNumber") idOrNumber: string,
    @Body() dto: PermanentDeleteDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ecommerce.permanentlyDeleteOrder(request.user.id, dto.password, idOrNumber);
  }

  @Get("admin/courier-services")
  @UseGuards(AdminGuard)
  @RequirePermission("couriers.read")
  courierServices() {
    return this.ecommerce.adminCourierServices();
  }

  @Post("admin/courier-services")
  @UseGuards(AdminGuard)
  @RequirePermission("couriers.write")
  createCourierService(@Body() dto: CreateCourierServiceDto) {
    return this.ecommerce.createCourierService(dto);
  }

  @Patch("admin/courier-services/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("couriers.write")
  updateCourierService(@Param("id") id: string, @Body() dto: UpdateCourierServiceDto) {
    return this.ecommerce.updateCourierService(id, dto);
  }

  @Delete("admin/courier-services/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("couriers.write")
  deleteCourierService(@Param("id") id: string) {
    return this.ecommerce.deleteCourierService(id);
  }

  @Post("admin/orders/:idOrNumber/courier-shipments")
  @UseGuards(AdminGuard)
  @RequirePermission("couriers.dispatch", "orders.update")
  dispatchCourierShipment(
    @Param("idOrNumber") idOrNumber: string,
    @Body() dto: DispatchCourierShipmentDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ecommerce.dispatchCourierShipment(idOrNumber, dto, request.user.id);
  }

  @Patch("admin/courier-shipments/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("couriers.dispatch", "orders.update")
  updateCourierShipment(@Param("id") id: string, @Body() dto: UpdateCourierShipmentDto) {
    return this.ecommerce.updateCourierShipment(id, dto);
  }

  @Post("admin/courier-shipments/:id/sync")
  @UseGuards(AdminGuard)
  @RequirePermission("couriers.dispatch", "orders.update")
  syncCourierShipment(@Param("id") id: string) {
    return this.ecommerce.syncCourierShipment(id);
  }

  @Get("admin/catalog")
  @UseGuards(AdminGuard)
  @RequirePermission(
    "catalog.read",
    "inventory.read",
    "content.write",
    "checkout.read",
    "checkout.write",
    "payment_methods.read",
    "payment_methods.write",
    "delivery_methods.read",
    "delivery_methods.write",
    "delivery_zones.read",
    "delivery_zones.write"
  )
  adminCatalog() {
    return this.ecommerce.adminCatalog();
  }

  @Patch("admin/site-settings")
  @UseGuards(AdminGuard)
  @RequirePermission("content.write", "checkout_policy.write", "checkout.write")
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
  @RequirePermission("payment_methods.write", "delivery_methods.write", "checkout.write")
  createCheckoutMethod(@Body() dto: CreateCheckoutMethodDto) {
    return this.ecommerce.createCheckoutMethod(dto);
  }

  @Patch("admin/checkout-methods/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("payment_methods.write", "delivery_methods.write", "checkout.write")
  updateCheckoutMethod(@Param("id") id: string, @Body() dto: UpdateCheckoutMethodDto) {
    return this.ecommerce.updateCheckoutMethod(id, dto);
  }

  @Delete("admin/checkout-methods/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("payment_methods.write", "delivery_methods.write", "checkout.write")
  deleteCheckoutMethod(@Param("id") id: string) {
    return this.ecommerce.deleteCheckoutMethod(id);
  }

  @Post("admin/payment-gateways")
  @UseGuards(AdminGuard)
  @RequirePermission("payment_methods.write", "checkout.write")
  createPaymentGateway(@Body() dto: CreatePaymentGatewayDto) {
    return this.ecommerce.createPaymentGateway(dto);
  }

  @Patch("admin/payment-gateways/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("payment_methods.write", "checkout.write")
  updatePaymentGateway(@Param("id") id: string, @Body() dto: UpdatePaymentGatewayDto) {
    return this.ecommerce.updatePaymentGateway(id, dto);
  }

  @Delete("admin/payment-gateways/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("payment_methods.write", "checkout.write")
  deletePaymentGateway(@Param("id") id: string) {
    return this.ecommerce.deletePaymentGateway(id);
  }

  @Post("admin/delivery-zones")
  @UseGuards(AdminGuard)
  @RequirePermission("delivery_zones.write", "checkout.write")
  createDeliveryZone(@Body() dto: CreateDeliveryZoneDto) {
    return this.ecommerce.createDeliveryZone(dto);
  }

  @Patch("admin/delivery-zones/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("delivery_zones.write", "checkout.write")
  updateDeliveryZone(@Param("id") id: string, @Body() dto: UpdateDeliveryZoneDto) {
    return this.ecommerce.updateDeliveryZone(id, dto);
  }

  @Delete("admin/delivery-zones/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("delivery_zones.write", "checkout.write")
  deleteDeliveryZone(@Param("id") id: string) {
    return this.ecommerce.deleteDeliveryZone(id);
  }

  @Post("admin/delivery-rates")
  @UseGuards(AdminGuard)
  @RequirePermission("delivery_zones.write", "checkout.write")
  createDeliveryRate(@Body() dto: CreateDeliveryRateDto) {
    return this.ecommerce.createDeliveryRate(dto);
  }

  @Patch("admin/delivery-rates/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("delivery_zones.write", "checkout.write")
  updateDeliveryRate(@Param("id") id: string, @Body() dto: UpdateDeliveryRateDto) {
    return this.ecommerce.updateDeliveryRate(id, dto);
  }

  @Delete("admin/delivery-rates/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("delivery_zones.write", "checkout.write")
  deleteDeliveryRate(@Param("id") id: string) {
    return this.ecommerce.deleteDeliveryRate(id);
  }

  @Get("admin/customers")
  @UseGuards(AdminGuard)
  @RequirePermission("customers.read")
  adminCustomers(@Query("search") search?: string) {
    return this.ecommerce.adminCustomers(search);
  }

  @Get("admin/customers/:id/intelligence")
  @UseGuards(AdminGuard)
  @RequirePermission("customers.read")
  adminCustomerIntelligence(@Param("id") id: string) {
    return this.ecommerce.adminCustomerIntelligence(id);
  }

  @Get("admin/guest-sessions")
  @UseGuards(AdminGuard)
  @RequirePermission("customers.read")
  adminGuestSessions(@Query("search") search?: string) {
    return this.ecommerce.adminGuestSessions(search);
  }

  @Get("admin/guest-sessions/:sessionKey")
  @UseGuards(AdminGuard)
  @RequirePermission("customers.read")
  adminGuestSessionDetail(@Param("sessionKey") sessionKey: string) {
    return this.ecommerce.adminGuestSessionDetail(sessionKey);
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
  updateOrderStatus(
    @Param("idOrNumber") idOrNumber: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.ecommerce.updateOrderStatus(idOrNumber, dto, false, request.user.id);
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
