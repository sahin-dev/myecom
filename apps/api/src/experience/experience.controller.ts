import {
  Body,
  Controller,
  Delete,
  Get,
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
  TrackEventDto,
  UpdateAddressDto,
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
import { ExperienceService } from "./experience.service";
import { AccessControlService } from "../auth/access-control.service";

@Controller()
export class ExperienceController {
  constructor(
    private readonly experience: ExperienceService,
    private readonly access: AccessControlService
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
  @UseGuards(JwtAuthGuard)
  cart(@Req() request: AuthenticatedRequest) {
    return this.experience.cart(request.user.id);
  }

  @Put("account/cart")
  @UseGuards(JwtAuthGuard)
  saveCart(@Body() dto: SaveCartDto, @Req() request: AuthenticatedRequest) {
    return this.experience.saveCart(request.user.id, request.user.email, dto);
  }

  @Get("account/wishlist")
  @UseGuards(JwtAuthGuard)
  wishlist(@Req() request: AuthenticatedRequest) {
    return this.experience.wishlist(request.user.id);
  }

  @Post("account/wishlist/:productId")
  @UseGuards(JwtAuthGuard)
  addWishlist(@Param("productId") productId: string, @Req() request: AuthenticatedRequest) {
    return this.experience.addWishlist(request.user.id, productId);
  }

  @Delete("account/wishlist/:productId")
  @UseGuards(JwtAuthGuard)
  removeWishlist(@Param("productId") productId: string, @Req() request: AuthenticatedRequest) {
    return this.experience.removeWishlist(request.user.id, productId);
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
}
