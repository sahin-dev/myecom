import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
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
import {
  AddProductImageDto,
  CreateAccessRoleDto,
  CreateStaffDto,
  CreateAddressDto,
  CreatePromotionDto,
  CreatePurchaseOrderDto,
  CreateReturnDto,
  CreateReviewDto,
  CreateSupplierDto,
  CreateVariantDto,
  InventoryAdjustmentDto,
  ModerateReviewDto,
  SaveCartDto,
  StockAlertDto,
  TrackEventDto,
  UpdateInfoPageDto,
  UpdateAddressDto,
  CreateManualRefundDto,
  IssueRefundDto,
  RecordManualPaymentDto,
  ReconcilePaymentsDto,
  UpdateAccessRoleDto,
  UpdateCustomerDto,
  UpdateProductImageDto,
  UpdatePreferencesDto,
  UpdatePromotionDto,
  UpdatePurchaseOrderDto,
  UpdateRefundDto,
  UpdateReturnDto,
  UpdateSupplierDto,
  UpdateStaffDto,
  UpdateVariantDto,
  ValidatePromotionDto
} from "./experience.dto";
import { CartOwner, ExperienceService } from "./experience.service";
import { PaymentsService } from "../payments/payments.service";
import { ReconciliationService } from "../payments/reconciliation.service";
import { AccessControlService } from "../auth/access-control.service";

function ownerFrom(request: OptionalAuthenticatedRequest, guestSessionKey?: string): CartOwner {
  return request.user
    ? { userId: request.user.id }
    : { sessionKey: guestSessionKey };
}

@Controller()
export class ExperienceController {
  constructor(
    private readonly experience: ExperienceService,
    private readonly access: AccessControlService,
    private readonly paymentsService: PaymentsService,
    private readonly reconciliation: ReconciliationService
  ) {}

  @Get("catalog/search")
  searchCatalog(
    @Query("search") search?: string,
    @Query("category") category?: string,
    @Query("brand") brand?: string,
    @Query("minPrice") minPrice?: string,
    @Query("maxPrice") maxPrice?: string,
    @Query("inStock") inStock?: string,
    @Query("sort") sort?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.experience.searchCatalog({
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      inStock,
      sort,
      page,
      limit
    });
  }

  @Post("analytics/events")
  @UseGuards(OptionalJwtAuthGuard)
  trackEvent(@Body() dto: TrackEventDto, @Req() request: OptionalAuthenticatedRequest) {
    return this.experience.trackEvent(dto, request.user?.id);
  }

  @Get("catalog/info-pages")
  infoPages() {
    return this.experience.infoPages();
  }

  @Patch("admin/info-pages/:slug")
  @UseGuards(AdminGuard)
  @RequirePermission("content.write")
  updateInfoPage(
    @Param("slug") slug: string,
    @Body() dto: UpdateInfoPageDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.updateInfoPage(request.user.id, slug, dto);
  }

  @Get("reviews/products/:productId")
  productReviews(@Param("productId") productId: string) {
    return this.experience.productReviews(productId);
  }

  @Get("reviews/products/:productId/mine")
  @UseGuards(JwtAuthGuard)
  myProductReview(
    @Param("productId") productId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.myProductReview(request.user.id, productId);
  }

  @Post("reviews/products/:productId")
  @UseGuards(JwtAuthGuard)
  submitReview(
    @Param("productId") productId: string,
    @Body() dto: CreateReviewDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.submitReview(request.user.id, request.user.email, productId, dto);
  }

  @Delete("reviews/products/:productId")
  @UseGuards(JwtAuthGuard)
  deleteReview(
    @Param("productId") productId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.deleteReview(request.user.id, productId);
  }

  @Get("products/:productId/stock-alert")
  @UseGuards(JwtAuthGuard)
  stockAlert(
    @Param("productId") productId: string,
    @Query("variantId") variantId: string | undefined,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.stockAlert(request.user.id, productId, variantId);
  }

  @Post("products/:productId/stock-alert")
  @UseGuards(JwtAuthGuard)
  subscribeStockAlert(
    @Param("productId") productId: string,
    @Body() dto: StockAlertDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.subscribeStockAlert(request.user.id, productId, dto.variantId);
  }

  @Post("promotions/validate")
  @UseGuards(OptionalJwtAuthGuard)
  validatePromotion(
    @Body() dto: ValidatePromotionDto,
    @Req() request: OptionalAuthenticatedRequest
  ) {
    return this.experience.validatePromotion(dto, request.user?.email);
  }

  @Get("account/addresses")
  @UseGuards(JwtAuthGuard)
  addresses(@Req() request: AuthenticatedRequest) {
    return this.experience.addresses(request.user.id);
  }

  @Post("account/addresses")
  @UseGuards(JwtAuthGuard)
  createAddress(@Body() dto: CreateAddressDto, @Req() request: AuthenticatedRequest) {
    return this.experience.createAddress(request.user.id, dto);
  }

  @Put("account/addresses/:id")
  @UseGuards(JwtAuthGuard)
  updateAddress(
    @Param("id") id: string,
    @Body() dto: UpdateAddressDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.updateAddress(request.user.id, id, dto);
  }

  @Delete("account/addresses/:id")
  @UseGuards(JwtAuthGuard)
  deleteAddress(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.experience.deleteAddress(request.user.id, id);
  }

  @Get("account/cart")
  @UseGuards(OptionalJwtAuthGuard)
  cart(
    @Req() request: OptionalAuthenticatedRequest,
    @Headers("x-guest-session") guestSessionKey?: string
  ) {
    return this.experience.cart(ownerFrom(request, guestSessionKey));
  }

  @Put("account/cart")
  @UseGuards(OptionalJwtAuthGuard)
  saveCart(
    @Body() dto: SaveCartDto,
    @Req() request: OptionalAuthenticatedRequest,
    @Headers("x-guest-session") guestSessionKey?: string
  ) {
    return this.experience.saveCart(ownerFrom(request, guestSessionKey), request.user?.email, dto);
  }

  @Get("account/wishlist")
  @UseGuards(OptionalJwtAuthGuard)
  wishlist(
    @Req() request: OptionalAuthenticatedRequest,
    @Headers("x-guest-session") guestSessionKey?: string
  ) {
    return this.experience.wishlist(ownerFrom(request, guestSessionKey));
  }

  @Post("account/wishlist/:productId")
  @UseGuards(OptionalJwtAuthGuard)
  addWishlist(
    @Param("productId") productId: string,
    @Req() request: OptionalAuthenticatedRequest,
    @Headers("x-guest-session") guestSessionKey?: string
  ) {
    return this.experience.addWishlist(ownerFrom(request, guestSessionKey), productId);
  }

  @Delete("account/wishlist/:productId")
  @UseGuards(OptionalJwtAuthGuard)
  removeWishlist(
    @Param("productId") productId: string,
    @Req() request: OptionalAuthenticatedRequest,
    @Headers("x-guest-session") guestSessionKey?: string
  ) {
    return this.experience.removeWishlist(ownerFrom(request, guestSessionKey), productId);
  }

  @Get("account/preferences")
  @UseGuards(JwtAuthGuard)
  preferences(@Req() request: AuthenticatedRequest) {
    return this.experience.preferences(request.user.id);
  }

  @Patch("account/preferences")
  @UseGuards(JwtAuthGuard)
  updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.updatePreferences(request.user.id, dto);
  }

  @Get("account/returns")
  @UseGuards(JwtAuthGuard)
  returns(@Req() request: AuthenticatedRequest) {
    return this.experience.returns(request.user.id);
  }

  @Post("account/returns")
  @UseGuards(JwtAuthGuard)
  createReturn(@Body() dto: CreateReturnDto, @Req() request: AuthenticatedRequest) {
    return this.experience.createReturn(request.user.id, request.user.email, dto);
  }

  @Patch("account/returns/:id/cancel")
  @UseGuards(JwtAuthGuard)
  cancelReturn(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.experience.cancelReturn(request.user.id, id);
  }

  @Get("account/recommendations")
  @UseGuards(JwtAuthGuard)
  recommendations(@Req() request: AuthenticatedRequest) {
    return this.experience.recommendations(request.user.id);
  }

  @Get("admin/promotions")
  @UseGuards(AdminGuard)
  @RequirePermission("promotions.read")
  adminPromotions() {
    return this.experience.adminPromotions();
  }

  @Post("admin/promotions")
  @UseGuards(AdminGuard)
  @RequirePermission("promotions.write")
  createPromotion(@Body() dto: CreatePromotionDto, @Req() request: AuthenticatedRequest) {
    return this.experience.createPromotion(request.user.id, dto);
  }

  @Patch("admin/promotions/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("promotions.write")
  updatePromotion(
    @Param("id") id: string,
    @Body() dto: UpdatePromotionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.updatePromotion(request.user.id, id, dto);
  }

  @Delete("admin/promotions/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("promotions.write")
  deletePromotion(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.experience.deletePromotion(request.user.id, id);
  }

  @Post("admin/promotions/:id/permanent-delete")
  @UseGuards(AdminGuard)
  @RequirePermission("promotions.permanent_delete")
  permanentlyDeletePromotion(
    @Param("id") id: string,
    @Body() dto: PermanentDeleteDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.permanentlyDeletePromotion(request.user.id, dto.password, id);
  }

  @Get("admin/reviews")
  @UseGuards(AdminGuard)
  @RequirePermission("reviews.read")
  adminReviews(@Query("status") status?: string) {
    return this.experience.adminReviews(status);
  }

  @Patch("admin/reviews/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("reviews.write")
  moderateReview(
    @Param("id") id: string,
    @Body() dto: ModerateReviewDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.moderateReview(
      request.user.id,
      id,
      dto
    );
  }

  @Get("admin/returns")
  @UseGuards(AdminGuard)
  @RequirePermission("returns.read")
  adminReturns(@Query("status") status?: string) {
    return this.experience.adminReturns(status);
  }

  @Patch("admin/returns/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("returns.write")
  updateReturn(
    @Param("id") id: string,
    @Body() dto: UpdateReturnDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.updateReturn(request.user.id, id, dto);
  }

  @Get("admin/suppliers")
  @UseGuards(AdminGuard)
  @RequirePermission("suppliers.read")
  suppliers() {
    return this.experience.suppliers();
  }

  @Post("admin/suppliers")
  @UseGuards(AdminGuard)
  @RequirePermission("suppliers.write")
  createSupplier(@Body() dto: CreateSupplierDto, @Req() request: AuthenticatedRequest) {
    return this.experience.createSupplier(request.user.id, dto);
  }

  @Patch("admin/suppliers/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("suppliers.write")
  updateSupplier(
    @Param("id") id: string,
    @Body() dto: UpdateSupplierDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.updateSupplier(request.user.id, id, dto);
  }

  @Delete("admin/suppliers/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("suppliers.write")
  deleteSupplier(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.experience.deleteSupplier(request.user.id, id);
  }

  @Get("admin/purchase-orders")
  @UseGuards(AdminGuard)
  @RequirePermission("purchase_orders.read")
  purchaseOrders() {
    return this.experience.purchaseOrders();
  }

  @Post("admin/purchase-orders")
  @UseGuards(AdminGuard)
  @RequirePermission("purchase_orders.write")
  createPurchaseOrder(
    @Body() dto: CreatePurchaseOrderDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.createPurchaseOrder(request.user.id, dto);
  }

  @Patch("admin/purchase-orders/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("purchase_orders.write")
  updatePurchaseOrder(
    @Param("id") id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.updatePurchaseOrder(request.user.id, id, dto);
  }

  @Get("admin/inventory-movements")
  @UseGuards(AdminGuard)
  @RequirePermission("inventory.read")
  inventoryMovements(@Query("productId") productId?: string) {
    return this.experience.inventoryMovements(productId);
  }

  @Post("admin/inventory-adjustments")
  @UseGuards(AdminGuard)
  @RequirePermission("inventory.write")
  adjustInventory(
    @Body() dto: InventoryAdjustmentDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.adjustInventory(request.user.id, dto);
  }

  @Post("admin/products/:id/variants")
  @UseGuards(AdminGuard)
  @RequirePermission("products.update")
  createVariant(
    @Param("id") id: string,
    @Body() dto: CreateVariantDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.createVariant(request.user.id, id, dto);
  }

  @Patch("admin/products/:productId/variants/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("products.update")
  updateVariant(
    @Param("productId") productId: string,
    @Param("id") id: string,
    @Body() dto: UpdateVariantDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.updateVariant(request.user.id, productId, id, dto);
  }

  @Delete("admin/products/:productId/variants/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("products.update")
  deleteVariant(
    @Param("productId") productId: string,
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.deleteVariant(request.user.id, productId, id);
  }

  @Post("admin/products/:id/images")
  @UseGuards(AdminGuard)
  @RequirePermission("products.update")
  addProductImage(
    @Param("id") id: string,
    @Body() dto: AddProductImageDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.addProductImage(request.user.id, id, dto);
  }

  @Patch("admin/products/:productId/images/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("products.update")
  updateProductImage(
    @Param("productId") productId: string,
    @Param("id") id: string,
    @Body() dto: UpdateProductImageDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.updateProductImage(request.user.id, productId, id, dto);
  }

  @Delete("admin/products/:productId/images/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("products.update")
  deleteProductImage(
    @Param("productId") productId: string,
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.deleteProductImage(request.user.id, productId, id);
  }

  @Get("admin/refunds")
  @UseGuards(AdminGuard)
  @RequirePermission("refunds.read")
  refunds() {
    return this.experience.refunds();
  }

  @Post("admin/orders/:id/refunds")
  @UseGuards(AdminGuard)
  @RequirePermission("refunds.write")
  createManualRefund(
    @Param("id") id: string,
    @Body() dto: CreateManualRefundDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.createManualRefund(request.user.id, id, dto);
  }

  @Get("admin/payments")
  @UseGuards(AdminGuard)
  @RequirePermission("payments.read")
  payments(
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("provider") provider?: string
  ) {
    return this.experience.payments({ search, status, provider });
  }

  @Post("admin/payments/:id/recheck")
  @UseGuards(AdminGuard)
  @RequirePermission("payments.write")
  recheckPayment(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.experience.requeryPayment(id, request.user.id);
  }

  /** Append-only history for one payment: transitions, sweeps, refund attempts. */
  @Get("admin/payments/:id/events")
  @UseGuards(AdminGuard)
  @RequirePermission("payments.read")
  paymentEvents(@Param("id") id: string) {
    return this.experience.paymentEvents(id);
  }

  @Post("admin/payments/:id/refund")
  @UseGuards(AdminGuard)
  @RequirePermission("payments.refund")
  refundPayment(
    @Param("id") id: string,
    @Body() dto: IssueRefundDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.paymentsService.issueRefund({
      paymentId: id,
      amount: dto.amount,
      reason: dto.reason,
      manual: dto.manual,
      actorId: request.user.id
    });
  }

  /** Money taken outside a gateway — bank transfer, cash on collection. */
  @Post("admin/payments/manual")
  @UseGuards(AdminGuard)
  @RequirePermission("payments.capture")
  recordManualPayment(
    @Body() dto: RecordManualPaymentDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.paymentsService.recordManualPayment({ ...dto, actorId: request.user.id });
  }

  /** Bulk re-query of stale pending payments; reports every divergence fixed. */
  @Post("admin/payments/reconcile")
  @UseGuards(AdminGuard)
  @RequirePermission("payments.reconcile")
  reconcilePayments(
    @Body() dto: ReconcilePaymentsDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.reconciliation.sweep({
      staleMinutes: dto.staleMinutes,
      actorId: request.user.id
    });
  }

  @Get("admin/payments/export")
  @UseGuards(AdminGuard)
  @RequirePermission("payments.export")
  exportPayments(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("status") status?: string
  ) {
    return this.experience.exportPayments({ from, to, status });
  }

  @Post("admin/payments/:id/permanent-delete")
  @UseGuards(AdminGuard)
  @RequirePermission("payments.permanent_delete")
  permanentlyDeletePayment(
    @Param("id") id: string,
    @Body() dto: PermanentDeleteDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.permanentlyDeletePayment(request.user.id, dto.password, id);
  }

  @Patch("admin/refunds/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("refunds.write")
  updateRefund(
    @Param("id") id: string,
    @Body() dto: UpdateRefundDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.updateRefund(request.user.id, id, dto);
  }

  @Get("admin/growth")
  @UseGuards(AdminGuard)
  @RequirePermission("growth.read")
  growthAnalytics(@Query("days") days?: string) {
    return this.experience.growthAnalytics(days);
  }

  @Get("admin/audit-logs")
  @UseGuards(AdminGuard)
  @RequirePermission("audit.read")
  auditLogs() {
    return this.experience.auditLogs();
  }

  @Get("admin/access/permissions")
  @UseGuards(AdminGuard)
  @RequirePermission("roles.read", "roles.create", "roles.update")
  permissionCatalogue() {
    return this.access.catalogue();
  }

  @Get("admin/access/roles")
  @UseGuards(AdminGuard)
  @RequirePermission("roles.read")
  accessRoles() {
    return this.access.roles();
  }

  @Post("admin/access/roles")
  @UseGuards(AdminGuard)
  @RequirePermission("roles.create")
  createAccessRole(
    @Body() dto: CreateAccessRoleDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.access.createRole(request.user.id, dto);
  }

  @Post("admin/access/roles/:id/duplicate")
  @UseGuards(AdminGuard)
  @RequirePermission("roles.create")
  duplicateAccessRole(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.access.duplicateRole(request.user.id, id);
  }

  @Patch("admin/access/roles/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("roles.update")
  updateAccessRole(
    @Param("id") id: string,
    @Body() dto: UpdateAccessRoleDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.access.updateRole(request.user.id, id, dto);
  }

  @Delete("admin/access/roles/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("roles.delete")
  deleteAccessRole(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.access.deleteRole(request.user.id, id);
  }

  @Get("admin/staff")
  @UseGuards(AdminGuard)
  @RequirePermission("staff.read")
  staff() {
    return this.experience.staff();
  }

  @Post("admin/staff")
  @UseGuards(AdminGuard)
  @RequirePermission("staff.create")
  createStaff(@Body() dto: CreateStaffDto, @Req() request: AuthenticatedRequest) {
    return this.experience.createStaff(request.user.id, dto);
  }

  @Patch("admin/staff/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("staff.update")
  updateStaff(
    @Param("id") id: string,
    @Body() dto: UpdateStaffDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.experience.updateStaff(request.user.id, id, dto);
  }

  @Delete("admin/staff/:id")
  @UseGuards(AdminGuard)
  @RequirePermission("staff.deactivate")
  deactivateStaff(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.experience.deactivateStaff(request.user.id, id);
  }

  @Post("admin/staff/:id/reset-password")
  @UseGuards(AdminGuard)
  @RequirePermission("staff.update")
  sendStaffResetLink(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.experience.sendStaffResetLink(request.user.id, id);
  }
}
