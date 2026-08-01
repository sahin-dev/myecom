"use client";

import {
  Activity,
  ArrowRight,
  Bell,
  Download,
  Eye,
  Heart,
  Mail,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  UsersRound
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminCustomer,
  AdminCustomerIntelligence,
  AdminGuestSession,
  AdminGuestSessionDetail,
  fetchAdminCustomerIntelligence,
  fetchAdminCustomers,
  fetchAdminGuestSessionDetail,
  fetchAdminGuestSessions,
  formatMoney,
  updateAdminCustomer
} from "../../lib/catalog";
import {
  AdminError,
  AdminLoading,
  AdminPagination,
  AdminPageTitle,
  AdminSectionHeader,
  StatusBadge,
  formatStatus
} from "./AdminShared";

type CustomerSegment = "all" | "high-value" | "loyal" | "returning" | "first-time" | "registered";

const segmentFilters: Array<{ id: CustomerSegment; label: string }> = [
  { id: "all", label: "All customers" },
  { id: "high-value", label: "High value" },
  { id: "loyal", label: "Loyal" },
  { id: "returning", label: "Returning" },
  { id: "first-time", label: "First-time" },
  { id: "registered", label: "No order yet" }
];
const customerPageSize = 12;

const dateFormatter = new Intl.DateTimeFormat("en-BD", {
  month: "short",
  day: "numeric",
  year: "numeric"
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-BD", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

function formatDate(value?: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not yet" : dateFormatter.format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not yet" : dateTimeFormatter.format(date);
}

function segmentFor(customer: AdminCustomer) {
  if (customer.orders > 3) return "Loyal";
  if (customer.orders > 1) return "Returning";
  if (customer.orders === 1) return "First-time";
  return "Registered";
}

function matchesSegment(customer: AdminCustomer, segment: CustomerSegment) {
  if (segment === "all") return true;
  if (segment === "high-value") return customer.lifetimeSpend >= 10000;
  if (segment === "loyal") return customer.orders > 3;
  if (segment === "returning") return customer.orders > 1 && customer.orders <= 3;
  if (segment === "first-time") return customer.orders === 1;
  return customer.orders === 0;
}

function productImage(product: { imageUrl?: string | null; images?: Array<{ url: string }> }) {
  return product.imageUrl || product.images?.[0]?.url || "";
}

function productInitial(name: string) {
  return name.slice(0, 1).toUpperCase();
}

export function AdminCustomers() {
  const [view, setView] = useState<"customers" | "guests">("customers");
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminCustomerIntelligence | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<CustomerSegment>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextCustomers = await fetchAdminCustomers(search);
      setCustomers(nextCustomers);
      setSelectedCustomerId((current) =>
        current && nextCustomers.some((customer) => customer.id === current)
          ? current
          : nextCustomers[0]?.id ?? null
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Customers are unavailable.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError("");
    try {
      setDetail(await fetchAdminCustomerIntelligence(id));
    } catch (caught) {
      setDetailError(caught instanceof Error ? caught.message : "Customer profile is unavailable.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedCustomerId);
  }, [loadDetail, selectedCustomerId]);

  const filteredCustomers = useMemo(
    () => customers.filter((customer) => matchesSegment(customer, segment)),
    [customers, segment]
  );
  const customerPages = Math.max(1, Math.ceil(filteredCustomers.length / customerPageSize));
  const pagedCustomers = filteredCustomers.slice((page - 1) * customerPageSize, page * customerPageSize);

  useEffect(() => {
    setPage(1);
  }, [search, segment]);

  useEffect(() => {
    if (page > customerPages) setPage(customerPages);
  }, [customerPages, page]);

  const summary = useMemo(() => {
    const buyers = customers.filter((customer) => customer.orders > 0);
    const repeat = customers.filter((customer) => customer.orders > 1);
    const highValue = customers.filter((customer) => customer.lifetimeSpend >= 10000);
    const spend = customers.reduce((sum, customer) => sum + customer.lifetimeSpend, 0);
    return {
      registered: customers.length,
      buyers: buyers.length,
      repeat: repeat.length,
      highValue: highValue.length,
      averageValue: buyers.length ? spend / buyers.length : 0
    };
  }, [customers]);

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setSearch(searchDraft.trim());
  }

  function exportCustomers() {
    if (!customers.length) return;
    const rows = [
      ["Name", "Email", "Phone", "Joined", "Orders", "Lifetime spend", "Last order", "Segment"],
      ...customers.map((customer) => [
        customer.name,
        customer.email,
        customer.phone ?? "",
        customer.createdAt,
        customer.orders,
        customer.lifetimeSpend,
        customer.lastOrderAt ?? "",
        segmentFor(customer)
      ])
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function toggleCustomer(customer: AdminCustomer) {
    try {
      const updated = await updateAdminCustomer(customer.id, { isActive: !customer.isActive });
      setCustomers((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      if (detail?.customer.id === customer.id) void loadDetail(customer.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Customer access could not be changed.");
    }
  }

  return (
    <div className="admin-page admin-customer-workspace">
      <AdminPageTitle
        eyebrow="Customer intelligence"
        title="Customers"
        description="Understand account value, intent signals, cart contents, product views, and marketing opportunities."
        actions={
          <>
            <div className="customer-view-toggle" role="tablist" aria-label="Customer view">
              <button type="button" className={view === "customers" ? "active" : ""} onClick={() => setView("customers")}>Customers</button>
              <button type="button" className={view === "guests" ? "active" : ""} onClick={() => setView("guests")}>Guests</button>
            </div>
            {view === "customers" ? (
              <>
                <button className="secondary-action" type="button" onClick={exportCustomers}><Download size={17} /> Export</button>
                <button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh customers"><RefreshCw size={17} /></button>
              </>
            ) : null}
          </>
        }
      />

      {view === "guests" ? <GuestSessionsPanel /> : loading && !customers.length ? (
        <AdminLoading label="Loading customer records..." />
      ) : error && !customers.length ? (
        <AdminError message={error} retry={() => void load()} />
      ) : (
        <>
      <section className="admin-summary-strip customers">
        <div><small>Registered</small><strong>{summary.registered}</strong></div>
        <div><small>Customers with orders</small><strong>{summary.buyers}</strong></div>
        <div><small>Repeat buyers</small><strong>{summary.repeat}</strong></div>
        <div><small>High value</small><strong>{summary.highValue}</strong></div>
        <div><small>Average lifetime value</small><strong>{formatMoney(summary.averageValue)}</strong></div>
      </section>

      <div className="customer-intelligence-layout">
        <section className="customer-directory-panel">
          <AdminSectionHeader
            title="Customer directory"
            description="Search, segment, and open a customer profile."
          />

          <form className="admin-filterbar customer-search" onSubmit={applySearch}>
            <label className="admin-search"><Search size={17} /><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search name, email, or phone" /></label>
            <button className="primary-action" type="submit">Search</button>
          </form>

          <div className="customer-segment-tabs" role="tablist" aria-label="Customer segments">
            {segmentFilters.map((item) => (
              <button
                type="button"
                key={item.id}
                className={segment === item.id ? "active" : ""}
                onClick={() => setSegment(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="customer-record-list">
            {pagedCustomers.map((customer) => {
              const customerSegment = segmentFor(customer);
              return (
                <button
                  type="button"
                  key={customer.id}
                  className={selectedCustomerId === customer.id ? "active" : ""}
                  onClick={() => setSelectedCustomerId(customer.id)}
                >
                  <span className="customer-avatar">{customer.name.slice(0, 1).toUpperCase()}</span>
                  <span>
                    <strong>{customer.name}</strong>
                    <small>{customer.email}</small>
                  </span>
                  <b className={`admin-customer-segment ${customerSegment.toLowerCase()}`}>{customerSegment}</b>
                  <span className="customer-record-metrics">
                    <small>{customer.orders} orders</small>
                    <strong>{formatMoney(customer.lifetimeSpend)}</strong>
                  </span>
                  <ArrowRight size={16} />
                </button>
              );
            })}
            {!filteredCustomers.length ? (
              <div className="admin-empty"><UsersRound size={30} /><strong>No customers found</strong><p>Try a different search or segment.</p></div>
            ) : null}
          </div>
          <AdminPagination
            page={page}
            pages={customerPages}
            total={filteredCustomers.length}
            pageSize={customerPageSize}
            onPageChange={setPage}
          />
        </section>

        <CustomerIntelligencePanel
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onRefresh={() => selectedCustomerId ? void loadDetail(selectedCustomerId) : undefined}
          onToggle={() => {
            const customer = customers.find((item) => item.id === selectedCustomerId);
            if (customer) void toggleCustomer(customer);
          }}
        />
      </div>

      {error ? <p className="admin-message is-error">{error}</p> : null}
        </>
      )}
    </div>
  );
}

function GuestSessionsPanel() {
  const [sessions, setSessions] = useState<AdminGuestSession[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminGuestSessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageSize = 12;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await fetchAdminGuestSessions(search);
      setSessions(next);
      setSelectedKey((current) =>
        current && next.some((session) => session.sessionKey === current)
          ? current
          : next[0]?.sessionKey ?? null
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Guest sessions are unavailable.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadDetail = useCallback(async (sessionKey: string) => {
    setDetailLoading(true);
    setDetailError("");
    try {
      setDetail(await fetchAdminGuestSessionDetail(sessionKey));
    } catch (caught) {
      setDetailError(caught instanceof Error ? caught.message : "Guest session is unavailable.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedKey) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedKey);
  }, [loadDetail, selectedKey]);

  const pages = Math.max(1, Math.ceil(sessions.length / pageSize));
  const paged = sessions.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [pages, page]);

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setSearch(searchDraft.trim());
  }

  if (loading && !sessions.length) return <AdminLoading label="Loading guest sessions..." />;
  if (error && !sessions.length) return <AdminError message={error} retry={() => void load()} />;

  return (
    <div className="customer-intelligence-layout">
      <section className="customer-directory-panel">
        <AdminSectionHeader
          title="Guest sessions"
          description="Shoppers browsing without an account, identified by a device session."
        />

        <form className="admin-filterbar customer-search" onSubmit={applySearch}>
          <label className="admin-search"><Search size={17} /><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search session or email" /></label>
          <button className="primary-action" type="submit">Search</button>
        </form>

        <div className="customer-record-list">
          {paged.map((session) => (
            <button
              type="button"
              key={session.sessionKey}
              className={selectedKey === session.sessionKey ? "active" : ""}
              onClick={() => setSelectedKey(session.sessionKey)}
            >
              <span className="customer-avatar">{(session.email ?? session.sessionKey).slice(0, 1).toUpperCase()}</span>
              <span>
                <strong>{session.email ?? `Guest ${session.sessionKey.slice(0, 8)}`}</strong>
                <small>Last active {formatDateTime(session.lastSeenAt)}</small>
              </span>
              <span className="customer-record-metrics">
                <small>{session.cartItemCount} in cart / {session.wishlistCount} saved</small>
                <strong>{formatMoney(session.cartValue)}</strong>
              </span>
              <ArrowRight size={16} />
            </button>
          ))}
          {!sessions.length ? (
            <div className="admin-empty"><UsersRound size={30} /><strong>No guest activity yet</strong><p>Guest carts and wishlists will show up here.</p></div>
          ) : null}
        </div>
        <AdminPagination
          page={page}
          pages={pages}
          total={sessions.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </section>

      <GuestSessionDetailPanel
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onRefresh={() => selectedKey ? void loadDetail(selectedKey) : undefined}
      />
    </div>
  );
}

function GuestSessionDetailPanel({
  detail,
  loading,
  error,
  onRefresh
}: {
  detail: AdminGuestSessionDetail | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  if (loading && !detail) return <AdminLoading label="Loading guest session..." />;
  if (error && !detail) return <AdminError message={error} retry={onRefresh} />;
  if (!detail) {
    return (
      <section className="customer-intelligence-panel empty">
        <UsersRound size={34} />
        <strong>Select a guest session</strong>
        <p>Open a session to see its cart, wishlist, and any orders placed under the same email.</p>
      </section>
    );
  }

  const { session, cart, wishlist, orders } = detail;

  return (
    <section className="customer-intelligence-panel">
      <header className="customer-profile-head">
        <div>
          <span className="customer-avatar large">{(session.email ?? session.sessionKey).slice(0, 1).toUpperCase()}</span>
          <div>
            <p className="eyebrow">Guest session</p>
            <h2>{session.email ?? `Guest ${session.sessionKey.slice(0, 8)}`}</h2>
            <small>First seen {formatDate(session.firstSeenAt)} / Last active {formatDateTime(session.lastSeenAt)}</small>
          </div>
        </div>
        <div>
          <button className="admin-icon-button" type="button" onClick={onRefresh} title="Refresh session"><RefreshCw size={16} /></button>
        </div>
      </header>

      <div className="customer-signal-grid">
        <SignalCard icon={ShoppingBag} label="Current cart" value={formatMoney(session.cartValue)} helper={`${session.cartItemCount} item${session.cartItemCount === 1 ? "" : "s"}`} />
        <SignalCard icon={Heart} label="Wishlist" value={String(session.wishlistCount)} />
        <SignalCard icon={PackageCheck} label="Orders under this email" value={String(orders.length)} />
      </div>

      <div className="customer-intel-columns">
        <CustomerProductList
          title="Products in cart"
          icon={ShoppingBag}
          empty="No active cart."
          items={cart.items.map((item) => ({
            id: item.id,
            product: item.product,
            meta: `${item.quantity} x ${formatMoney(item.unitPrice)}${item.variant ? ` / ${item.variant.name}` : ""}`,
            stat: formatMoney(item.quantity * item.unitPrice)
          }))}
        />
        <CustomerProductList
          title="Wishlist"
          icon={Heart}
          empty="No wishlist items."
          items={wishlist.map((item) => ({
            id: item.id,
            product: item.product,
            meta: item.product.category?.name ?? "Saved product",
            stat: formatMoney(item.product.price)
          }))}
        />
      </div>

      <section className="customer-intel-block">
        <h3><PackageCheck size={16} /> Orders under this email</h3>
        <div className="customer-order-mini-list">
          {orders.map((order) => (
            <article key={order.id}>
              <span>
                <strong>{order.orderNumber}</strong>
                <small>{formatDate(order.createdAt)}</small>
              </span>
              <span>
                <StatusBadge value={order.status} />
                <b>{formatMoney(order.total)}</b>
              </span>
            </article>
          ))}
          {!orders.length ? (
            <p className="customer-intel-empty">
              {session.email ? "No orders yet under this email." : "No email captured yet - orders can't be matched until this guest checks out."}
            </p>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function CustomerIntelligencePanel({
  detail,
  loading,
  error,
  onRefresh,
  onToggle
}: {
  detail: AdminCustomerIntelligence | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onToggle: () => void;
}) {
  if (loading && !detail) return <AdminLoading label="Loading customer profile..." />;
  if (error && !detail) return <AdminError message={error} retry={onRefresh} />;
  if (!detail) {
    return (
      <section className="customer-intelligence-panel empty">
        <UsersRound size={34} />
        <strong>Select a customer</strong>
        <p>Open a profile to see cart items, product views, wishlist intent, orders, and marketing suggestions.</p>
      </section>
    );
  }

  const { customer, summary } = detail;

  return (
    <section className="customer-intelligence-panel">
      <header className="customer-profile-head">
        <div>
          <span className="customer-avatar large">{customer.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <p className="eyebrow">Customer profile</p>
            <h2>{customer.name}</h2>
            <small>{customer.email}{customer.phone ? ` / ${customer.phone}` : ""}</small>
          </div>
        </div>
        <div>
          <a className="secondary-action" href={`mailto:${customer.email}`}><Mail size={16} /> Email</a>
          <button className="secondary-action" type="button" onClick={onToggle}>{customer.isActive ? "Deactivate" : "Reactivate"}</button>
          <button className="admin-icon-button" type="button" onClick={onRefresh} title="Refresh profile"><RefreshCw size={16} /></button>
        </div>
      </header>

      <div className="customer-signal-grid">
        <SignalCard icon={PackageCheck} label="Lifetime spend" value={formatMoney(summary.lifetimeSpend)} />
        <SignalCard icon={ShoppingBag} label="Current cart" value={formatMoney(summary.cartSubtotal)} helper={`${summary.cartItems} item${summary.cartItems === 1 ? "" : "s"}`} />
        <SignalCard icon={Eye} label="Product views" value={String(summary.productViews)} helper={`Last seen ${formatDate(summary.lastSeenAt)}`} />
        <SignalCard icon={Heart} label="Wishlist" value={String(summary.wishlistItems)} />
        <SignalCard icon={Star} label="Reviews" value={String(summary.reviews)} />
        <SignalCard icon={Activity} label="AOV" value={formatMoney(summary.averageOrderValue)} helper={`${summary.recognizedOrders} paid/delivered`} />
      </div>

      <div className="customer-intel-block">
        <h3><Target size={16} /> Marketing segments</h3>
        <div className="customer-intel-chips">
          {detail.segments.map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>

      {detail.recommendations.length ? (
        <div className="customer-intel-block">
          <h3><Sparkles size={16} /> Recommended actions</h3>
          <div className="customer-recommendation-list">
            {detail.recommendations.map((item) => (
              <article key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <small>{item.action}</small>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="customer-intel-columns">
        <CustomerProductList
          title="Products in cart"
          icon={ShoppingBag}
          empty="No active account cart."
          items={(detail.cart?.items ?? []).map((item) => ({
            id: item.id,
            product: item.product,
            meta: `${item.quantity} x ${formatMoney(item.unitPrice)}${item.variant ? ` / ${item.variant.name}` : ""}`,
            stat: formatMoney(item.quantity * item.unitPrice)
          }))}
        />
        <CustomerProductList
          title="Viewed, not bought"
          icon={Eye}
          empty="No viewed product gap yet."
          items={detail.viewedNotPurchased.map((item) => ({
            id: item.product.id,
            product: item.product,
            meta: `${item.views} view${item.views === 1 ? "" : "s"} / last ${formatDate(item.lastViewedAt)}`,
            stat: item.carts ? `${item.carts} cart` : "No cart"
          }))}
        />
      </div>

      <div className="customer-intel-columns">
        <CustomerProductList
          title="Wishlist"
          icon={Heart}
          empty="No wishlist items."
          items={detail.wishlist.map((item) => ({
            id: item.product.id,
            product: item.product,
            meta: item.product.category?.name ?? "Saved product",
            stat: formatMoney(item.product.price)
          }))}
        />
        <CustomerProductList
          title="Back-in-stock leads"
          icon={Bell}
          empty="No stock alert requests."
          items={detail.stockAlerts.map((item) => ({
            id: item.id,
            product: item.product,
            meta: item.notifiedAt ? `Notified ${formatDate(item.notifiedAt)}` : `Requested ${formatDate(item.createdAt)}`,
            stat: item.notifiedAt ? "Sent" : "Waiting"
          }))}
        />
      </div>

      <div className="customer-intel-columns">
        <section className="customer-intel-block">
          <h3><PackageCheck size={16} /> Recent orders</h3>
          <div className="customer-order-mini-list">
            {detail.orders.slice(0, 6).map((order) => (
              <article key={order.id}>
                <span>
                  <strong>{order.orderNumber}</strong>
                  <small>{formatDate(order.createdAt)} / {order.items.length} item{order.items.length === 1 ? "" : "s"}</small>
                </span>
                <span>
                  <StatusBadge value={order.status} />
                  <b>{formatMoney(order.total)}</b>
                </span>
              </article>
            ))}
            {!detail.orders.length ? <p className="customer-intel-empty">No orders yet.</p> : null}
          </div>
        </section>

        <section className="customer-intel-block">
          <h3><MapPin size={16} /> Profile context</h3>
          <dl className="customer-context-list">
            <div><dt>Joined</dt><dd>{formatDate(customer.createdAt)}</dd></div>
            <div><dt>Last order</dt><dd>{formatDate(summary.lastOrderAt)}</dd></div>
            <div><dt>Marketing email</dt><dd>{detail.preferences?.marketingEmail ? "Opted in" : "Not opted in"}</dd></div>
            <div><dt>Default city</dt><dd>{detail.addresses[0]?.city ?? "Not saved"}</dd></div>
          </dl>
          {detail.topInterests.length ? (
            <div className="customer-interest-list">
              {detail.topInterests.map((item) => <span key={item.label}>{item.label}</span>)}
            </div>
          ) : null}
        </section>
      </div>

      <section className="customer-intel-block">
        <h3><Activity size={16} /> Recent activity</h3>
        <div className="customer-activity-list">
          {detail.recentActivity.slice(0, 10).map((activity) => (
            <article key={activity.id}>
              <span>{formatStatus(activity.type)}</span>
              <strong>{activity.product?.name ?? activity.query ?? "Store activity"}</strong>
              <small>{formatDateTime(activity.createdAt)}</small>
            </article>
          ))}
          {!detail.recentActivity.length ? <p className="customer-intel-empty">No tracked activity for this account yet.</p> : null}
        </div>
      </section>
    </section>
  );
}

function SignalCard({
  icon: Icon,
  label,
  value,
  helper
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <article className="customer-signal-card">
      <Icon size={17} />
      <small>{label}</small>
      <strong>{value}</strong>
      {helper ? <span>{helper}</span> : null}
    </article>
  );
}

function CustomerProductList({
  title,
  icon: Icon,
  empty,
  items
}: {
  title: string;
  icon: typeof ShoppingBag;
  empty: string;
  items: Array<{
    id: string;
    product: { name: string; slug?: string; imageUrl?: string | null; images?: Array<{ url: string }> };
    meta: string;
    stat: string;
  }>;
}) {
  return (
    <section className="customer-intel-block">
      <h3><Icon size={16} /> {title}</h3>
      <div className="customer-product-signal-list">
        {items.slice(0, 6).map((item) => (
          <article key={item.id}>
            <span>
              {productImage(item.product) ? (
                <img src={productImage(item.product)} alt="" />
              ) : (
                productInitial(item.product.name)
              )}
            </span>
            <div>
              {item.product.slug ? <a href={`/products/${item.product.slug}`}>{item.product.name}</a> : <strong>{item.product.name}</strong>}
              <small>{item.meta}</small>
            </div>
            <b>{item.stat}</b>
          </article>
        ))}
        {!items.length ? <p className="customer-intel-empty">{empty}</p> : null}
      </div>
    </section>
  );
}
