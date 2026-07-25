"use client";

import {
  Bell,
  Check,
  KeyRound,
  LogOut,
  MapPin,
  PackageCheck,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Address,
  CustomerNotification,
  NotificationPreferences,
  Order,
  Product,
  ReturnRequest,
  createAddress,
  createReturnRequest,
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
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { QuickVariantAdd } from "./QuickVariantAdd";

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

export function AccountPage() {
  const { user, loading, logout, updateProfile } = useAuth();
  const { addItem } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [returnOrderId, setReturnOrderId] = useState("");
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

  const eligibleOrders = useMemo(
    () => orders.filter((order) => order.status === "DELIVERED"),
    [orders]
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
        quantity: Number(data.get(`returnQuantity-${item.id}`) || 0)
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
            <input name="currentPassword" type="password" placeholder="Current password" autoComplete="current-password" required />
            <input name="newPassword" type="password" minLength={8} placeholder="New password" autoComplete="new-password" required />
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
              {orders.map((order) => (
                <article key={order.id}>
                  <div>
                    <strong>{order.orderNumber}</strong>
                    <span>{order.status.replace(/_/g, " ")}</span>
                  </div>
                  <strong>{formatMoney(order.total)}</strong>
                  <a href={`/track-order?order=${order.orderNumber}&email=${encodeURIComponent(user.email)}`}>
                    Track
                  </a>
                </article>
              ))}
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
              <input name="label" placeholder="Label, e.g. Home" defaultValue={editingAddress?.label ?? ""} required />
              <input name="recipient" placeholder="Recipient name" defaultValue={editingAddress?.recipient ?? user.name} required />
            </div>
            <div className="form-grid">
              <input name="phone" placeholder="Phone" defaultValue={editingAddress?.phone ?? user.phone ?? ""} required />
              <input name="city" placeholder="City" defaultValue={editingAddress?.city ?? "Dhaka"} required />
            </div>
            <input name="line1" placeholder="Street and house" defaultValue={editingAddress?.line1 ?? ""} required />
            <input name="line2" placeholder="Apartment, floor, or landmark" defaultValue={editingAddress?.line2 ?? ""} />
            <div className="form-grid">
              <input name="area" placeholder="Area" defaultValue={editingAddress?.area ?? ""} />
              <input name="postalCode" placeholder="Postal code" defaultValue={editingAddress?.postalCode ?? ""} />
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
              <select
                name="orderId"
                value={returnOrderId}
                onChange={(event) => setReturnOrderId(event.target.value)}
                required
              >
                <option value="" disabled>Select a delivered order</option>
                {eligibleOrders.map((order) => (
                  <option value={order.id} key={order.id}>{order.orderNumber}</option>
                ))}
              </select>
              {returnOrder ? (
                <div className="return-item-picker">
                  <p>Select the quantities you want to return</p>
                  {returnOrder.items.map((item) => (
                    <label key={item.id}>
                      <span>
                        <strong>{item.productName}</strong>
                        <small>
                          {item.variantName ? `${item.variantName} · ` : ""}
                          Ordered: {item.quantity}
                        </small>
                      </span>
                      <input
                        name={`returnQuantity-${item.id}`}
                        type="number"
                        min="0"
                        max={item.quantity}
                        defaultValue="0"
                        aria-label={`Return quantity for ${item.productName}`}
                      />
                    </label>
                  ))}
                </div>
              ) : null}
              <select name="reason" defaultValue="" required>
                <option value="" disabled>Reason for return</option>
                <option>Damaged item</option>
                <option>Incorrect item</option>
                <option>Quality concern</option>
                <option>Changed my mind</option>
              </select>
              <textarea name="details" placeholder="Tell us what happened" />
              <button className="secondary-action" type="submit">Request return</button>
            </form>
          ) : <p className="muted-copy">Delivered orders eligible for return will appear here.</p>}
          {returnMessage ? <p className="detail-notice">{returnMessage}</p> : null}
          <div className="return-list">
            {returns.map((item) => (
              <div key={item.id}>
                <strong>{item.returnNumber}</strong>
                <span>{item.status.replace(/_/g, " ")}</span>
                {item.status === "REQUESTED" || item.status === "APPROVED" ? (
                  <button type="button" onClick={() => void cancelReturn(item.id)}>Cancel</button>
                ) : null}
              </div>
            ))}
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
              <article className="product-card" key={product.id}>
                <a href={`/products/${product.slug}`}><ProductArt product={product} /></a>
                <div className="product-meta">
                  <h3><a href={`/products/${product.slug}`}>{product.name}</a></h3>
                  <strong>{formatMoney(product.price)}</strong>
                </div>
                {product.variants?.length ? (
                  <QuickVariantAdd product={product} className="secondary-action full" />
                ) : (
                  <button className="secondary-action full" onClick={() => addItem(product, 1)} type="button">
                    Add to cart
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <PageFooter categories={fallbackCatalog.categories} />
    </main>
  );
}
