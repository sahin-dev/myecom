"use client";

import {
  Bell,
  Check,
  ChevronDown,
  KeyRound,
  LogOut,
  MapPin,
  PackageCheck,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck
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
  updateAddress,
  updatePreferences
} from "../lib/catalog";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { OrderReceipt } from "./OrderReceipt";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { QuickVariantAdd } from "./QuickVariantAdd";
import { useSiteSettings } from "./SiteSettingsContext";

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

const standardReturnStages = ["REQUESTED", "APPROVED", "RECEIVED", "RESOLVED"];
const refundReturnStages = ["REQUESTED", "APPROVED", "RECEIVED", "REFUND_PENDING", "REFUNDED"];

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
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
        const deliveredAt =
          order.trackingEvents.find((event) => event.status === "DELIVERED")?.createdAt ??
          order.updatedAt;
        return (
          order.status === "DELIVERED" &&
          Date.now() - new Date(deliveredAt).getTime() <= 48 * 60 * 60 * 1000 &&
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
    if (!window.confirm(`Cancel order ${order.orderNumber}? This can't be undone.`)) return;
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
    if (!window.confirm("Deactivate your account? You will be signed out immediately.")) return;
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
      const created = await createReturnRequest({
        orderId: order.id,
        reason: String(data.get("reason")),
        details: String(data.get("details") || ""),
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

  return (
    <main>
      <PageHeader categories={fallbackCatalog.categories} />
      <section className="account-hero">
        <div>
          <p className="eyebrow">Your account</p>
          <h1>Hello, {user.name.split(" ")[0]}</h1>
          <p>{user.email}</p>
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

      <section className="account-dashboard">
        <div className="account-panel">
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

        <div className="account-panel order-history">
          <div className="panel-heading">
            <PackageCheck size={20} />
            <div>
              <p className="eyebrow">Purchases</p>
              <h2>Order history</h2>
            </div>
          </div>
          {orders.length ? (
            <div className="account-orders">
              {orders.map((order) => {
                const expanded = expandedOrderId === order.id;
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
                        <span>{order.status.replace(/_/g, " ")}</span>
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
                              </span>
                              <strong>{formatMoney(item.quantity * item.unitPrice)}</strong>
                            </div>
                          ))}
                        </div>
                        <div className="account-order-meta">
                          <p><MapPin size={14} /> {order.shippingAddress}</p>
                          {order.deliveryMethodName ? <p><Truck size={14} /> {order.deliveryMethodName}</p> : null}
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
                          <div><dt>Total</dt><dd>{formatMoney(order.total)}</dd></div>
                        </dl>
                        <button type="button" className="text-link" onClick={() => setReceiptOrder(order)}>
                          Download receipt
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
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

      <section className="account-wide-panel">
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
        <div className="account-panel">
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

        <div className="account-panel">
          <div className="panel-heading">
            <RotateCcw size={20} />
            <div>
              <p className="eyebrow">Help after purchase</p>
              <h2>Returns</h2>
            </div>
          </div>
          {eligibleOrders.length ? (
            <form className="account-form" onSubmit={requestReturn}>
              <label>
                <span>Delivered order</span>
                <select
                  name="orderId"
                  value={returnOrderId}
                  onChange={(event) => {
                    setReturnOrderId(event.target.value);
                    setReturnQuantities({});
                    setReturnMessage("");
                  }}
                  required
                >
                  <option value="" disabled>Select an order</option>
                  {eligibleOrders.map((order) => (
                    <option value={order.id} key={order.id}>
                      {order.orderNumber} - {new Date(order.createdAt).toLocaleDateString("en-BD")}
                    </option>
                  ))}
                </select>
              </label>
              {returnOrder ? (
                <ReturnItemPicker
                  order={returnOrder}
                  returnedQuantities={activeReturnedQuantities}
                  quantities={returnQuantities}
                  onChange={setReturnQuantities}
                />
              ) : null}
              {returnOrder ? (
                <>
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
                    <span>Additional details</span>
                    <textarea name="details" placeholder="Describe the issue to help us review it faster" />
                  </label>
                  <button
                    className="secondary-action"
                    type="submit"
                    disabled={!Object.values(returnQuantities).some((quantity) => quantity > 0)}
                  >
                    Submit return request
                  </button>
                </>
              ) : null}
            </form>
          ) : <p className="muted-copy">Orders delivered within the 48-hour return window will appear here.</p>}
          {returnMessage ? <p className="detail-notice">{returnMessage}</p> : null}
          <div className="return-list">
            {returns.map((item) => {
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
          <strong>Choose products</strong>
          <small>Select only the items you want to send back.</small>
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
              <span>
                <strong>{item.productName}</strong>
                <small>
                  {item.variantName ? `${item.variantName} / ` : ""}
                  {remaining} of {item.quantity} available to return
                </small>
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

function AccountRecommendationCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const price = selectedVariant?.price ?? product.price;
  const compareAt = selectedVariant ? selectedVariant.compareAt : product.compareAt;

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
