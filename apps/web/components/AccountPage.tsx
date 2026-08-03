"use client";

import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MapPin,
  PackageCheck,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  UserRound
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Address,
  CustomerNotification,
  NotificationPreferences,
  Order,
  Product,
  ProductVariant,
  ReturnRequest,
  createAddress,
  createReturnRequest,
  cancelOrder,
  cancelReturnRequest,
  changePassword,
  deleteAddress,
  deleteAccount,
  deleteNotification,
  fallbackCatalog,
  fetchAccountOrders,
  fetchAddresses,
  fetchNotifications,
  fetchPreferences,
  fetchRecommendations,
  fetchReturns,
  formatMoney,
  markNotificationRead,
  markAllNotificationsRead,
  productAdvancePaymentLabel,
  resolveMediaUrl,
  uploadReturnProof,
  updateAddress,
  updatePreferences
} from "../lib/catalog";
import { orderPaymentBreakdown } from "../lib/orderPayments";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { OrderReceipt } from "./OrderReceipt";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { QuickVariantAdd } from "./QuickVariantAdd";
import { useSiteSettings } from "./SiteSettingsContext";
import { useConfirm } from "./ui/ConfirmDialog";

const defaultPreferences: NotificationPreferences = {
  id: "",
  orderEmail: true,
  marketingEmail: false,
  backInStock: true,
  priceDrop: true
};

function addressText(address: Address) {
  return [address.line1, address.line2, address.area, address.city, address.postalCode]
    .filter(Boolean)
    .join(", ");
}

function deliveredAtForOrder(order: Order) {
  return order.trackingEvents.find((event) => event.status === "DELIVERED")?.createdAt ?? order.updatedAt;
}

const standardReturnStages = ["REQUESTED", "APPROVED", "RECEIVED", "RESOLVED"];
const refundReturnStages = ["REQUESTED", "APPROVED", "RECEIVED", "REFUND_PENDING", "REFUNDED"];
const accountOrderPageSize = 5;
const accountReturnPageSize = 4;
const returnWindowMs = 3 * 24 * 60 * 60 * 1000;

const returnStatusCopy: Record<string, string> = {
  REQUESTED: "Waiting for our team to review your request.",
  APPROVED: "Approved. Follow the return instructions from our team.",
  RECEIVED: "Your items were received and are being checked.",
  REFUND_PENDING: "Your refund was created and is waiting to be processed.",
  REFUNDED: "Your refund has been completed.",
  RESOLVED: "This return has been completed.",
  REJECTED: "This request could not be approved. Review the note below.",
  CANCELLED: "You cancelled this return request."
};

export function AccountPage() {
  const { user, loading, logout, updateProfile } = useAuth();
  const { settings } = useSiteSettings();
  const confirm = useConfirm();
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderPage, setOrderPage] = useState(1);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [returnPage, setReturnPage] = useState(1);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [returnOrderId, setReturnOrderId] = useState("");
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [message, setMessage] = useState("");
  const [returnMessage, setReturnMessage] = useState("");
  const [savingPreferences, setSavingPreferences] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetchAccountOrders().then(setOrders),
      fetchAddresses().then(setAddresses),
      fetchReturns().then(setReturns),
      fetchRecommendations().then(setRecommendations),
      fetchPreferences().then(setPreferences),
      fetchNotifications().then(setNotifications)
    ]).catch(() => setMessage("Some account information is temporarily unavailable."));
  }, [user]);

  const activeReturnedQuantities = useMemo(() => {
    const totals = new Map<string, number>();
    returns
      .filter((item) => item.status !== "REJECTED" && item.status !== "CANCELLED")
      .flatMap((item) => item.items)
      .forEach((item) => totals.set(
        item.orderItemId,
        (totals.get(item.orderItemId) ?? 0) + item.quantity
      ));
    return totals;
  }, [returns]);
  const eligibleOrders = useMemo(
    () => orders.filter(
      (order) => {
        const deliveredAt = deliveredAtForOrder(order);
        return (
          order.status === "DELIVERED" &&
          Date.now() - new Date(deliveredAt).getTime() <= returnWindowMs &&
          order.items.some(
            (item) => item.quantity > (activeReturnedQuantities.get(item.id) ?? 0)
          )
        );
      }
    ),
    [activeReturnedQuantities, orders]
  );
  const returnOrder = useMemo(
    () => eligibleOrders.find((order) => order.id === returnOrderId),
    [eligibleOrders, returnOrderId]
  );
  const orderPages = Math.max(1, Math.ceil(orders.length / accountOrderPageSize));
  const pagedOrders = orders.slice((orderPage - 1) * accountOrderPageSize, orderPage * accountOrderPageSize);
  const returnPages = Math.max(1, Math.ceil(returns.length / accountReturnPageSize));
  const pagedReturns = returns.slice((returnPage - 1) * accountReturnPageSize, returnPage * accountReturnPageSize);
  const unreadNotificationCount = notifications.filter((item) => !item.isRead).length;
  const activeReturnCount = returns.filter(
    (item) => !["RESOLVED", "REFUNDED", "REJECTED", "CANCELLED"].includes(item.status)
  ).length;

  useEffect(() => {
    if (orderPage > orderPages) setOrderPage(orderPages);
  }, [orderPage, orderPages]);

  useEffect(() => {
    if (returnPage > returnPages) setReturnPage(returnPages);
  }, [returnPage, returnPages]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await updateProfile({
        name: String(form.get("name")),
        phone: String(form.get("phone") || "")
      });
      setMessage("Profile updated.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not update profile.");
    }
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const input = {
        label: String(data.get("label")),
        recipient: String(data.get("recipient")),
        phone: String(data.get("phone")),
        line1: String(data.get("line1")),
        line2: String(data.get("line2") || ""),
        area: String(data.get("area") || ""),
        city: String(data.get("city")),
        postalCode: String(data.get("postalCode") || ""),
        isDefault: addresses.length === 0 || data.get("isDefault") === "on"
      };
      const saved = editingAddress
        ? await updateAddress(editingAddress.id, input)
        : await createAddress(input);
      setAddresses((current) => {
        const normalized = saved.isDefault
          ? current.map((address) => ({ ...address, isDefault: false }))
          : current;
        return editingAddress
          ? normalized.map((address) => address.id === saved.id ? saved : address)
          : [...normalized, saved];
      });
      form.reset();
      setEditingAddress(null);
      setMessage("Delivery address saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not save address.");
    }
  }

  async function readAllNotifications() {
    try {
      await markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not update notifications.");
    }
  }

  async function removeNotification(id: string) {
    try {
      await deleteNotification(id);
      setNotifications((current) => current.filter((item) => item.id !== id));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not remove notification.");
    }
  }

  async function cancelReturn(id: string) {
    try {
      const updated = await cancelReturnRequest(id);
      setReturns((current) => current.map((item) => item.id === id ? updated : item));
      setReturnMessage(`${updated.returnNumber} was cancelled.`);
    } catch (caught) {
      setReturnMessage(caught instanceof Error ? caught.message : "Return could not be cancelled.");
    }
  }

  async function cancelOwnOrder(order: Order) {
    const confirmed = await confirm({
      title: `Cancel order ${order.orderNumber}?`,
      description: "Any reserved stock is released back to the store. This can't be undone.",
      confirmLabel: "Cancel order",
      cancelLabel: "Keep order",
      tone: "danger"
    });
    if (!confirmed) return;
    try {
      const updated = await cancelOrder(order.orderNumber);
      setOrders((current) => current.map((item) => item.id === order.id ? updated : item));
      setMessage(`${order.orderNumber} was cancelled.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Order could not be cancelled.");
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await changePassword({
        currentPassword: String(data.get("currentPassword")),
        newPassword: String(data.get("newPassword"))
      });
      form.reset();
      setMessage("Password changed.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Password could not be changed.");
    }
  }

  async function deactivateAccount() {
    const confirmed = await confirm({
      title: "Deactivate your account?",
      description: "You'll be signed out immediately and won't be able to place orders until the account is restored.",
      confirmLabel: "Deactivate account",
      cancelLabel: "Stay signed in",
      tone: "danger"
    });
    if (!confirmed) return;
    try {
      await deleteAccount();
      logout();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Account could not be deactivated.");
    }
  }

  async function removeAddress(id: string) {
    try {
      await deleteAddress(id);
      setAddresses((current) => current.filter((address) => address.id !== id));
      setMessage("Address removed.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not remove address.");
    }
  }

  async function requestReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const order = orders.find((item) => item.id === String(data.get("orderId")));
    if (!order) return;
    const items = order.items
      .map((item) => ({
        orderItemId: item.id,
        quantity: returnQuantities[item.id] ?? 0
      }))
      .filter((item) => item.quantity > 0);
    if (!items.length) {
      setReturnMessage("Select at least one item and quantity to return.");
      return;
    }

    try {
      const proofFiles = data.getAll("proofs").filter((item): item is File =>
        item instanceof File && item.size > 0
      );
      if (proofFiles.length > 4) {
        setReturnMessage("Attach up to 4 proof files.");
        return;
      }
      setReturnMessage(proofFiles.length ? "Uploading proof files..." : "");
      const proofUrls = await Promise.all(proofFiles.map((file) => uploadReturnProof(file)));
      const created = await createReturnRequest({
        orderId: order.id,
        reason: String(data.get("reason")),
        details: String(data.get("details") || ""),
        proofUrls: proofUrls.map((file) => file.url),
        items
      });
      setReturns((current) => [created, ...current]);
      setReturnMessage(`Return ${created.returnNumber} was submitted.`);
      form.reset();
      setReturnOrderId("");
      setReturnQuantities({});
    } catch (caught) {
      setReturnMessage(caught instanceof Error ? caught.message : "Could not submit return.");
    }
  }

  function startReturnForOrder(order: Order) {
    setReturnOrderId(order.id);
    setReturnQuantities({});
    setReturnMessage("");
    window.setTimeout(() => {
      document.getElementById("account-returns")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function isOrderReturnable(order: Order) {
    const deliveredAt = deliveredAtForOrder(order);
    return (
      order.status === "DELIVERED" &&
      Date.now() - new Date(deliveredAt).getTime() <= returnWindowMs &&
      order.items.some((item) => item.quantity > (activeReturnedQuantities.get(item.id) ?? 0))
    );
  }

  async function readNotification(id: string) {
    try {
      const updated = await markNotificationRead(id);
      setNotifications((current) =>
        current.map((item) => item.id === updated.id ? updated : item)
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not update notification.");
    }
  }

  async function changePreferences(next: NotificationPreferences) {
    setPreferences(next);
    setSavingPreferences(true);
    try {
      const saved = await updatePreferences({
        orderEmail: next.orderEmail,
        marketingEmail: next.marketingEmail,
        backInStock: next.backInStock,
        priceDrop: next.priceDrop
      });
      setPreferences(saved);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not update notifications.");
    } finally {
      setSavingPreferences(false);
    }
  }

  if (loading) return <div className="route-loading">Loading your account...</div>;
  if (!user) {
    return (
      <main className="access-page">
        <ShieldCheck size={42} />
        <h1>Sign in to continue</h1>
        <p>Your orders and account settings are protected.</p>
        <a className="primary-action" href="/login?next=/account">Sign in</a>
      </main>
    );
  }

  const accountInitials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const memberSince = new Date(user.createdAt).toLocaleDateString("en-BD", {
    month: "short",
    year: "numeric"
  });

  return (
    <main>
      <PageHeader categories={fallbackCatalog.categories} />
      <section className="account-hero">
        <div className="account-identity">
          <span className="account-avatar" aria-hidden="true">{accountInitials}</span>
          <div>
            <p className="eyebrow">Your account</p>
            <h1>Hello, {user.name.split(" ")[0]}</h1>
            <div className="account-identity-meta">
              <span>{user.email}</span>
              <span>Member since {memberSince}</span>
            </div>
          </div>
        </div>
        <div className="account-actions">
          {user.role !== "CUSTOMER" ? (
            <a className="secondary-action" href="/admin">Admin console</a>
          ) : null}
          <button className="secondary-action" type="button" onClick={logout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </section>

      {message ? <p className="account-global-notice">{message}</p> : null}

      <section className="account-summary" aria-label="Account overview">
        <a href="#account-orders">
          <span><PackageCheck size={19} /></span>
          <strong>{orders.length}</strong>
          <small>{orders.length === 1 ? "Order" : "Orders"}</small>
        </a>
        <a href="#account-addresses">
          <span><MapPin size={19} /></span>
          <strong>{addresses.length}</strong>
          <small>Saved addresses</small>
        </a>
        <a href="#account-notifications">
          <span><Bell size={19} /></span>
          <strong>{unreadNotificationCount}</strong>
          <small>Unread updates</small>
        </a>
        <a href="#account-returns">
          <span><RotateCcw size={19} /></span>
          <strong>{activeReturnCount}</strong>
          <small>Active returns</small>
        </a>
      </section>

      <div className="account-shell">
        <aside className="account-section-nav" aria-label="Account sections">
          <div>
            <LayoutDashboard size={18} />
            <strong>Manage account</strong>
          </div>
          <nav>
            <a href="#account-profile"><UserRound size={17} /><span>Profile & security</span></a>
            <a href="#account-orders">
              <PackageCheck size={17} />
              <span>Orders</span>
              {orders.length ? <b>{orders.length}</b> : null}
            </a>
            <a href="#account-addresses">
              <MapPin size={17} />
              <span>Addresses</span>
              {addresses.length ? <b>{addresses.length}</b> : null}
            </a>
            <a href="#account-notifications">
              <Bell size={17} />
              <span>Notifications</span>
              {unreadNotificationCount ? <b>{unreadNotificationCount}</b> : null}
            </a>
            <a href="#account-returns">
              <RotateCcw size={17} />
              <span>Returns</span>
              {activeReturnCount ? <b>{activeReturnCount}</b> : null}
            </a>
          </nav>
        </aside>

        <div className="account-content">
      <section className="account-dashboard">
        <div className="account-panel" id="account-profile">
          <div className="panel-heading">
            <Settings size={20} />
            <div>
              <p className="eyebrow">Profile</p>
              <h2>Account details</h2>
            </div>
          </div>
          <form className="account-form" onSubmit={saveProfile}>
            <label>
              <span>Name</span>
              <input name="name" defaultValue={user.name} required />
            </label>
            <label>
              <span>Email</span>
              <input value={user.email} disabled />
            </label>
            <label>
              <span>Phone</span>
              <input name="phone" defaultValue={user.phone ?? ""} />
            </label>
            <button className="primary-action" type="submit">
              <Save size={17} />
              Save profile
            </button>
          </form>
          <form className="account-form account-security-form" onSubmit={updatePassword}>
            <div className="panel-heading compact">
              <KeyRound size={18} />
              <h3>Change password</h3>
            </div>
            <label><span>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
            <label><span>New password</span><input name="newPassword" type="password" minLength={8} placeholder="At least 8 characters" autoComplete="new-password" required /></label>
            <button className="secondary-action" type="submit">Update password</button>
            <button className="text-link danger" type="button" onClick={() => void deactivateAccount()}>Deactivate account</button>
          </form>
        </div>

        <div className="account-panel order-history" id="account-orders">
          <div className="panel-heading">
            <PackageCheck size={20} />
            <div>
              <p className="eyebrow">Purchases</p>
              <h2>Order history</h2>
            </div>
          </div>
          {orders.length ? (
            <div className="account-orders">
              {pagedOrders.map((order) => {
                const expanded = expandedOrderId === order.id;
                const paymentBreakdown = orderPaymentBreakdown(order);
                const latestShipment = order.courierShipments?.[0];
                return (
                  <article key={order.id} className={expanded ? "expanded" : ""}>
                    <button
                      type="button"
                      className="account-order-toggle"
                      onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                      aria-expanded={expanded}
                    >
                      <ChevronDown size={15} className={expanded ? "flip" : ""} />
                      <span>
                        <strong>{order.orderNumber}</strong>
                        <span className={`order-status-pill status-${order.status.toLowerCase()}`}>
                          {order.status.replace(/_/g, " ")}
                        </span>
                      </span>
                    </button>
                    <strong>{formatMoney(order.total)}</strong>
                    <a href={`/track-order?order=${order.orderNumber}&email=${encodeURIComponent(user.email)}`}>
                      Track
                    </a>
                    {["PLACED", "CONFIRMED"].includes(order.status) ? (
                      <button className="text-link danger" type="button" onClick={() => void cancelOwnOrder(order)}>
                        Cancel order
                      </button>
                    ) : null}
                    {expanded ? (
                      <div className="account-order-detail">
                        <div className="account-order-items">
                          {order.items.map((item) => (
                            <div key={item.id}>
                              <span>
                                <strong>{item.productName}</strong>
                                {item.variantName ? <small>{item.variantName}</small> : null}
                                <small>{item.quantity} x {formatMoney(item.unitPrice)}</small>
                                {item.advancePaymentAmount ? (
                                  <small>Advance {item.advancePaymentPercent ?? 0}%: {formatMoney(item.advancePaymentAmount)}</small>
                                ) : null}
                              </span>
                              <strong>{formatMoney(item.quantity * item.unitPrice)}</strong>
                            </div>
                          ))}
                        </div>
                        <div className="account-order-meta">
                          <span><MapPin size={13} /> {order.shippingAddress}</span>
                          {order.deliveryMethodName ? <span><Truck size={13} /> {order.deliveryMethodName}</span> : null}
                          {latestShipment ? (
                            <span>
                              <Truck size={13} />
                              {latestShipment.courierService?.name ?? order.courierName ?? "Courier"} / {latestShipment.status.replace(/_/g, " ")}
                              {latestShipment.deliveryFailedReason ? ` / Reason: ${latestShipment.deliveryFailedReason}` : ""}
                            </span>
                          ) : null}
                          <span><CreditCard size={13} /> {order.paymentMethod ?? "Cash on delivery"} · {order.paymentStatus ?? "PENDING"}</span>
                        </div>
                        <dl className="account-order-summary">
                          <div><dt>Subtotal</dt><dd>{formatMoney(order.subtotal)}</dd></div>
                          {order.discount ? (
                            <div>
                              <dt>Discount{order.promotion ? ` (${order.promotion.code})` : ""}</dt>
                              <dd>-{formatMoney(order.discount)}</dd>
                            </div>
                          ) : null}
                          <div><dt>Delivery</dt><dd>{formatMoney(order.shippingFee)}</dd></div>
                          <div className="account-order-grand-total"><dt>Total</dt><dd>{formatMoney(order.total)}</dd></div>
                          {paymentBreakdown.shouldShowPaymentPlan ? (
                            <div className={`account-order-advance ${paymentBreakdown.hasFailedPayment ? "is-failed" : ""}`}>
                              {paymentBreakdown.hasFailedPayment ? (
                                <div><dt>Payment failed</dt><dd>{formatMoney(paymentBreakdown.failedAmount)}</dd></div>
                              ) : paymentBreakdown.paidAmount > 0 ? (
                                <div><dt>Paid online</dt><dd>{formatMoney(paymentBreakdown.paidAmount)}</dd></div>
                              ) : (
                                <div><dt>Advance required</dt><dd>{formatMoney(paymentBreakdown.scheduledNow)}</dd></div>
                              )}
                              <div>
                                <dt>{paymentBreakdown.paidAmount > 0 ? "Due on delivery" : "Outstanding balance"}</dt>
                                <dd>{formatMoney(paymentBreakdown.outstandingAmount || paymentBreakdown.scheduledOnDelivery)}</dd>
                              </div>
                            </div>
                          ) : null}
                        </dl>
                        <div className="account-order-detail-footer">
                          {isOrderReturnable(order) ? (
                            <button type="button" className="secondary-action compact" onClick={() => startReturnForOrder(order)}>
                              <RotateCcw size={14} /> Return items
                            </button>
                          ) : null}
                          <button type="button" className="text-link" onClick={() => setReceiptOrder(order)}>
                            <Download size={14} /> Download receipt
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              <AccountPagination
                page={orderPage}
                pages={orderPages}
                total={orders.length}
                pageSize={accountOrderPageSize}
                onPageChange={setOrderPage}
              />
            </div>
          ) : (
            <div className="account-empty">
              <PackageCheck size={34} strokeWidth={1.4} />
              <strong>No orders yet</strong>
              <p>Your completed checkouts will appear here.</p>
              <a href="/shop">Start shopping</a>
            </div>
          )}
        </div>
      </section>

      <section className="account-wide-panel" id="account-addresses">
        <div className="panel-heading">
          <MapPin size={20} />
          <div>
            <p className="eyebrow">Delivery</p>
            <h2>Saved addresses</h2>
          </div>
        </div>
        <div className="address-workspace">
          <div className="saved-addresses">
            {addresses.length ? addresses.map((address) => (
              <article key={address.id}>
                <div>
                  <strong>{address.label}</strong>
                  {address.isDefault ? <span>Default</span> : null}
                </div>
                <p>{address.recipient} · {address.phone}</p>
                <p>{addressText(address)}</p>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => removeAddress(address.id)}
                  aria-label={`Remove ${address.label} address`}
                >
                  <Trash2 size={17} />
                </button>
                <button className="secondary-action" type="button" onClick={() => setEditingAddress(address)}>Edit</button>
              </article>
            )) : <p className="muted-copy">Save an address to make checkout faster.</p>}
          </div>
          <form className="address-form" onSubmit={saveAddress} key={editingAddress?.id ?? "new-address"}>
            <div className="form-grid">
              <label className="field-label">Address label<input name="label" placeholder="For example, Home" defaultValue={editingAddress?.label ?? ""} required /></label>
              <label className="field-label">Recipient name<input name="recipient" placeholder="Person receiving the order" defaultValue={editingAddress?.recipient ?? user.name} required /></label>
            </div>
            <div className="form-grid">
              <label className="field-label">Phone number<input name="phone" placeholder="Delivery contact number" defaultValue={editingAddress?.phone ?? user.phone ?? ""} required /></label>
              <label className="field-label">City<input name="city" placeholder="Delivery city" defaultValue={editingAddress?.city ?? "Dhaka"} required /></label>
            </div>
            <label className="field-label">Street and house<input name="line1" placeholder="House, road, and street" defaultValue={editingAddress?.line1 ?? ""} required /></label>
            <label className="field-label">Additional address details<input name="line2" placeholder="Apartment, floor, or landmark" defaultValue={editingAddress?.line2 ?? ""} /></label>
            <div className="form-grid">
              <label className="field-label">Area<input name="area" placeholder="Neighborhood or area" defaultValue={editingAddress?.area ?? ""} /></label>
              <label className="field-label">Postal code<input name="postalCode" placeholder="Postal code" defaultValue={editingAddress?.postalCode ?? ""} /></label>
            </div>
            <label className="check-row">
              <input name="isDefault" type="checkbox" defaultChecked={editingAddress?.isDefault ?? false} />
              Use as default address
            </label>
            <button className="primary-action" type="submit">
              <MapPin size={17} />
              {editingAddress ? "Update address" : "Save address"}
            </button>
            {editingAddress ? <button className="secondary-action" type="button" onClick={() => setEditingAddress(null)}>Cancel editing</button> : null}
          </form>
        </div>
      </section>

      <section className="account-dashboard">
        <div className="account-panel" id="account-notifications">
          <div className="panel-heading">
            <Bell size={20} />
            <div>
              <p className="eyebrow">Preferences</p>
              <h2>Notifications</h2>
            </div>
          </div>
          <div className="preference-list">
            {[
              ["orderEmail", "Order updates", "Receipts and delivery progress"],
              ["marketingEmail", "Offers and news", "Relevant launches and promotions"],
              ["backInStock", "Back in stock", "Saved products that return"],
              ["priceDrop", "Price drops", "Discounts on saved products"]
            ].map(([key, title, description]) => (
              <label key={key}>
                <span><strong>{title}</strong><small>{description}</small></span>
                <input
                  type="checkbox"
                  checked={Boolean(preferences[key as keyof NotificationPreferences])}
                  onChange={(event) =>
                    changePreferences({ ...preferences, [key]: event.target.checked })
                  }
                />
              </label>
            ))}
          </div>
          {savingPreferences ? <p className="form-note">Saving preferences...</p> : null}
          <div className="notification-inbox">
            <div className="panel-heading compact">
              <h3>Recent updates</h3>
              {notifications.some((item) => !item.isRead) ? <button type="button" onClick={() => void readAllNotifications()}>Mark all read</button> : null}
            </div>
            {notifications.length ? notifications.slice(0, 6).map((notification) => (
              <article className={notification.isRead ? "is-read" : ""} key={notification.id}>
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  <small>{new Date(notification.createdAt).toLocaleString("en-BD")}</small>
                </div>
                {!notification.isRead ? (
                  <button
                    className="icon-button"
                    type="button"
                    title="Mark as read"
                    onClick={() => void readNotification(notification.id)}
                  >
                    <Check size={16} />
                  </button>
                ) : null}
                <button className="icon-button" type="button" title="Delete notification" onClick={() => void removeNotification(notification.id)}><Trash2 size={16} /></button>
              </article>
            )) : <p className="muted-copy">Order updates will appear here.</p>}
          </div>
        </div>

        <div className="account-panel" id="account-returns">
          <div className="panel-heading">
            <RotateCcw size={20} />
            <div>
              <p className="eyebrow">Help after purchase</p>
              <h2>Returns</h2>
            </div>
          </div>
          {eligibleOrders.length ? (
            <div className="return-request-workspace">
              {!returnOrder ? (
                <div className="return-order-starter">
                  <div>
                    <strong>Start a return from an order</strong>
                    <p>Delivered orders stay eligible for 3 days. You can also open an order in purchase history and choose return items there.</p>
                  </div>
                  <div className="return-order-options">
                    {eligibleOrders.map((order) => (
                      <button type="button" key={order.id} onClick={() => startReturnForOrder(order)}>
                        <span>
                          <strong>{order.orderNumber}</strong>
                          <small>Delivered {new Date(deliveredAtForOrder(order)).toLocaleDateString("en-BD")}</small>
                        </span>
                        <b>{order.items.length} items</b>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <form className="account-form return-request-form" onSubmit={requestReturn}>
                  <input type="hidden" name="orderId" value={returnOrder.id} />
                  <div className="return-selected-order">
                    <span>
                      <strong>{returnOrder.orderNumber}</strong>
                      <small>Delivered {new Date(deliveredAtForOrder(returnOrder)).toLocaleDateString("en-BD")} / {formatMoney(returnOrder.total)}</small>
                    </span>
                    <button type="button" className="text-link" onClick={() => {
                      setReturnOrderId("");
                      setReturnQuantities({});
                      setReturnMessage("");
                    }}>
                      Change order
                    </button>
                  </div>
                  <ReturnItemPicker
                    order={returnOrder}
                    returnedQuantities={activeReturnedQuantities}
                    quantities={returnQuantities}
                    onChange={setReturnQuantities}
                  />
                  <div className="return-form-grid">
                    <label>
                      <span>Reason</span>
                      <select name="reason" defaultValue="" required>
                        <option value="" disabled>Select a reason</option>
                        <option>Damaged item</option>
                        <option>Incorrect item</option>
                        <option>Quality concern</option>
                        <option>Changed my mind</option>
                      </select>
                    </label>
                    <label>
                      <span>Proof photos or videos</span>
                      <input
                        name="proofs"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                        multiple
                      />
                      <small>Up to 4 files. JPG, PNG, WebP, MP4, MOV, or WebM.</small>
                    </label>
                  </div>
                  <label>
                    <span>Additional details</span>
                    <textarea name="details" placeholder="Describe the issue, product condition, and what you prefer next." />
                  </label>
                  <div className="return-submit-row">
                    <small>Our team will review your request and proof before approving pickup or drop-off instructions.</small>
                    <button
                      className="primary-action"
                      type="submit"
                      disabled={!Object.values(returnQuantities).some((quantity) => quantity > 0)}
                    >
                      Submit return request
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : <p className="muted-copy">Orders delivered within the 3-day return window will appear here.</p>}
          {returnMessage ? <p className="detail-notice">{returnMessage}</p> : null}
          <div className="return-list">
            {pagedReturns.map((item) => {
              const returnStages =
                item.resolutionType === "REFUND" ||
                item.status === "REFUND_PENDING" ||
                item.status === "REFUNDED"
                  ? refundReturnStages
                  : standardReturnStages;
              const currentStage = returnStages.indexOf(item.status);
              return (
                <article className="customer-return-card" key={item.id}>
                  <header>
                    <div>
                      <strong>{item.returnNumber}</strong>
                      <small>
                        {item.order?.orderNumber ?? "Order"} / {new Date(item.createdAt).toLocaleDateString("en-BD")}
                      </small>
                    </div>
                    <span className={`return-status return-status-${item.status.toLowerCase()}`}>
                      {item.status.replace(/_/g, " ")}
                    </span>
                  </header>
                  {currentStage >= 0 ? (
                    <div className="return-progress" aria-label={`Return status: ${item.status}`}>
                      {returnStages.map((stage, index) => (
                        <span className={index <= currentStage ? "is-complete" : ""} key={stage}>
                          {stage === "REQUESTED" ? "Submitted" : stage.charAt(0) + stage.slice(1).toLowerCase()}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p>{returnStatusCopy[item.status] ?? "Our team is reviewing this return."}</p>
                  {item.proofUrls?.length ? (
                    <div className="return-proof-list">
                      {item.proofUrls.map((url) => {
                        const mediaUrl = resolveMediaUrl(url) ?? url;
                        const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(mediaUrl);
                        return (
                          <a href={mediaUrl} target="_blank" rel="noreferrer" key={url}>
                            {isVideo ? "Video proof" : "Photo proof"}
                          </a>
                        );
                      })}
                    </div>
                  ) : null}
                  <ul>
                    {item.items.map((returnItem) => (
                      <li key={returnItem.id}>
                        <span>
                          {returnItem.orderItem?.productName ?? "Ordered product"}
                          {returnItem.orderItem?.variantName ? ` / ${returnItem.orderItem.variantName}` : ""}
                        </span>
                        <strong>x{returnItem.quantity}</strong>
                        {returnItem.disposition ? (
                          <small>{returnItem.disposition.toLowerCase().replace(/_/g, " ")}</small>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {item.refund ? (
                    <div className="return-refund-summary">
                      <span>
                        <strong>Refund</strong>
                        <small>{item.refund.status.toLowerCase()}</small>
                      </span>
                      <strong>{formatMoney(item.refund.amount)}</strong>
                    </div>
                  ) : null}
                  {item.resolution ? (
                    <div className="return-resolution">
                      <strong>Team note</strong>
                      <p>{item.resolution}</p>
                    </div>
                  ) : null}
                  {item.status === "REQUESTED" ? (
                    <button type="button" onClick={() => void cancelReturn(item.id)}>Cancel request</button>
                  ) : null}
                </article>
              );
            })}
            <AccountPagination
              page={returnPage}
              pages={returnPages}
              total={returns.length}
              pageSize={accountReturnPageSize}
              onPageChange={setReturnPage}
            />
          </div>
        </div>
      </section>

      {recommendations.length ? (
        <section className="account-recommendations">
          <div className="section-title">
            <div>
              <p className="eyebrow">Picked from your history</p>
              <h2><Sparkles size={20} /> Buy again and discover</h2>
            </div>
            <a href="/shop">View shop</a>
          </div>
          <div className="product-grid">
            {recommendations.slice(0, 4).map((product) => (
              <AccountRecommendationCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}
        </div>
      </div>

      <PageFooter categories={fallbackCatalog.categories} />
      {receiptOrder ? (
        <OrderReceipt order={receiptOrder} settings={settings} onClose={() => setReceiptOrder(null)} />
      ) : null}
    </main>
  );
}

function ReturnItemPicker({
  order,
  returnedQuantities,
  quantities,
  onChange
}: {
  order: Order;
  returnedQuantities: Map<string, number>;
  quantities: Record<string, number>;
  onChange: (update: (current: Record<string, number>) => Record<string, number>) => void;
}) {
  const returnableItems = order.items.filter(
    (item) => item.quantity > (returnedQuantities.get(item.id) ?? 0)
  );

  return (
    <div className="return-item-picker">
      <div className="return-picker-heading">
        <div>
          <strong>Select items to return</strong>
          <small>Choose the products and quantity you want to send back.</small>
        </div>
        <span>{returnableItems.length} items</span>
      </div>
      {returnableItems.map((item) => {
        const remaining = item.quantity - (returnedQuantities.get(item.id) ?? 0);
        const selected = quantities[item.id] ?? 0;
        return (
          <div className={`return-product-row ${selected ? "is-selected" : ""}`} key={item.id}>
            <label className="return-product-check">
              <input
                type="checkbox"
                checked={selected > 0}
                onChange={(event) => onChange((current) => ({
                  ...current,
                  [item.id]: event.target.checked ? 1 : 0
                }))}
              />
              <span className="return-product-icon"><PackageCheck size={17} /></span>
              <span className="return-product-copy">
                <strong>{item.productName}</strong>
                <small>
                  {item.variantName ? `${item.variantName} / ` : ""}
                  {remaining} of {item.quantity} available to return
                </small>
                <small>{formatMoney(item.unitPrice)} each</small>
              </span>
            </label>
            <label className="return-quantity-control">
              <span>Quantity</span>
              <select
                value={selected || 1}
                disabled={!selected}
                aria-label={`Return quantity for ${item.productName}`}
                onChange={(event) => onChange((current) => ({
                  ...current,
                  [item.id]: Number(event.target.value)
                }))}
              >
                {Array.from({ length: remaining }, (_, index) => index + 1).map((quantity) => (
                  <option value={quantity} key={quantity}>{quantity}</option>
                ))}
              </select>
            </label>
          </div>
        );
      })}
    </div>
  );
}

function AccountPagination({
  page,
  pages,
  total,
  pageSize,
  onPageChange
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const safePage = Math.min(Math.max(1, page), pages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  return (
    <div className="account-pagination">
      <span>Showing {start}-{end} of {total}</span>
      <div>
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <small>Page {safePage} of {pages}</small>
        <button
          type="button"
          disabled={safePage >= pages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function AccountRecommendationCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { settings } = useSiteSettings();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const price = selectedVariant?.price ?? product.price;
  const compareAt = selectedVariant ? selectedVariant.compareAt : product.compareAt;
  const advanceLabel = productAdvancePaymentLabel(product, settings.checkoutPolicy);

  return (
    <article className="product-card">
      <a href={`/products/${product.slug}`}><ProductArt product={product} /></a>
      <div className="product-meta">
        <h3><a href={`/products/${product.slug}`}>{product.name}</a></h3>
        <div className="price-row">
          <strong>{formatMoney(price)}</strong>
          {compareAt && compareAt > price ? <small>{formatMoney(compareAt)}</small> : null}
        </div>
      </div>
      {advanceLabel ? (
        <span className="advance-payment-badge" title={advanceLabel} aria-label={advanceLabel}>
          <CreditCard size={14} />
        </span>
      ) : null}
      {product.variants?.length ? (
        <QuickVariantAdd
          product={product}
          className="secondary-action full"
          onSelect={setSelectedVariant}
        />
      ) : (
        <button className="secondary-action full" onClick={() => addItem(product, 1)} type="button">
          Add to cart
        </button>
      )}
    </article>
  );
}
