"use client";

import {
  BarChart3,
  Boxes,
  ChevronRight,
  ClipboardList,
  Gift,
  LogOut,
  Menu,
  Megaphone,
  Network,
  Search,
  ShieldCheck,
  Store,
  TrendingUp,
  UsersRound,
  X
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { BrandIdentity } from "./PageChrome";
import { useSiteSettings } from "./SiteSettingsContext";
import { AdminContent } from "./admin/AdminContent";
import { AdminCombos } from "./admin/AdminCombos";
import { AdminCustomers } from "./admin/AdminCustomers";
import { AdminGrowth } from "./admin/AdminGrowth";
import { AdminInventory } from "./admin/AdminInventory";
import { AdminOperations } from "./admin/AdminOperations";
import { AdminOrders } from "./admin/AdminOrders";
import { AdminOverview } from "./admin/AdminOverview";
import { AdminTeam } from "./admin/AdminTeam";

export type AdminTab =
  | "overview"
  | "orders"
  | "inventory"
  | "combos"
  | "growth"
  | "customers"
  | "operations"
  | "content"
  | "team";

const navigation: Array<{
  id: AdminTab;
  label: string;
  description: string;
  group: "Workspace" | "Commerce" | "Engagement" | "Administration";
  icon: typeof BarChart3;
  permissions: string[];
}> = [
  { id: "overview", label: "Overview", description: "Priorities and performance", group: "Workspace", icon: BarChart3, permissions: ["dashboard.read"] },
  { id: "orders", label: "Orders", description: "Fulfillment workspace", group: "Commerce", icon: ClipboardList, permissions: ["orders.read", "orders.create"] },
  { id: "inventory", label: "Products", description: "Catalog, media, and stock", group: "Commerce", icon: Boxes, permissions: ["catalog.read", "products.create", "products.update", "inventory.read"] },
  { id: "combos", label: "Combo deals", description: "Bundles and placement", group: "Commerce", icon: Gift, permissions: ["combos.manage"] },
  { id: "customers", label: "Customers", description: "Value and retention", group: "Engagement", icon: UsersRound, permissions: ["customers.read"] },
  { id: "growth", label: "Marketing", description: "Analytics, offers, reviews", group: "Engagement", icon: TrendingUp, permissions: ["growth.read", "promotions.read", "reviews.read"] },
  { id: "content", label: "Storefront", description: "Homepage and checkout", group: "Engagement", icon: Megaphone, permissions: ["content.write", "checkout.write"] },
  { id: "operations", label: "Operations", description: "Returns, refunds, supply", group: "Administration", icon: Network, permissions: ["returns.read", "refunds.read", "suppliers.read", "purchase_orders.read"] },
  { id: "team", label: "Team and access", description: "Roles, staff, and audit", group: "Administration", icon: ShieldCheck, permissions: ["staff.read", "roles.read", "audit.read"] }
];

export function AdminConsole() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const { user, loading, logout } = useAuth();
  const { settings } = useSiteSettings();

  useEffect(() => {
    const applyLocation = () => {
      const requested = new URLSearchParams(window.location.search).get("tab") as AdminTab | null;
      if (requested && navigation.some((item) => item.id === requested)) setTab(requested);
    };
    applyLocation();
    window.addEventListener("popstate", applyLocation);
    return () => window.removeEventListener("popstate", applyLocation);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setMobileNavigationOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigate = useCallback((next: AdminTab) => {
    setTab(next);
    setCommandOpen(false);
    setCommandQuery("");
    setMobileNavigationOpen(false);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  if (loading) return <div className="route-loading">Checking administrator access...</div>;

  if (!user) {
    return (
      <main className="access-page">
        <ClipboardList size={44} />
        <h1>Admin sign in required</h1>
        <p>Sign in with an administrator account to manage the store.</p>
        <a className="primary-action" href="/login?next=/admin">Sign in</a>
      </main>
    );
  }

  if (user.role === "CUSTOMER") {
    return (
      <main className="access-page">
        <ClipboardList size={44} />
        <h1>Administrator access only</h1>
        <p>Your account does not have permission to open this area.</p>
        <a className="primary-action" href="/account">Return to account</a>
      </main>
    );
  }

  const can = (...permissions: string[]) =>
    user.permissions.includes("*") ||
    permissions.some((permission) => user.permissions.includes(permission));
  const visibleNavigation = navigation.filter((item) =>
    can(...item.permissions)
  );
  const navigationGroups = ["Workspace", "Commerce", "Engagement", "Administration"] as const;
  const activeTab = visibleNavigation.some((item) => item.id === tab)
    ? tab
    : visibleNavigation[0]?.id ?? "overview";
  const commandResults = (() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return visibleNavigation;
    return visibleNavigation.filter((item) =>
      `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(query)
    );
  })();

  return (
    <main className="admin-app">
      <header className="admin-topbar">
        <button
          className="admin-mobile-menu"
          type="button"
          onClick={() => setMobileNavigationOpen((current) => !current)}
          aria-label={mobileNavigationOpen ? "Close admin navigation" : "Open admin navigation"}
          aria-expanded={mobileNavigationOpen}
        >
          {mobileNavigationOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
        <BrandIdentity settings={settings} />
        <div className="admin-topbar-context">
          <span>Administration</span>
          <ChevronRight size={14} />
          <strong>{navigation.find((item) => item.id === activeTab)?.label}</strong>
        </div>
        <div className="admin-topbar-actions">
          <button className="admin-command-open" type="button" onClick={() => setCommandOpen(true)} title="Quick navigation">
            <Search size={17} />
            <span>Quick jump</span>
            <kbd>Ctrl K</kbd>
          </button>
          <a href="/" title="Open storefront">
            <Store size={18} />
            <span>Storefront</span>
          </a>
          <div>
            <strong>{user.name}</strong>
            <span>{user.accessRole?.name ?? user.role.toLowerCase()}</span>
          </div>
          <button type="button" onClick={logout} title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="admin-workspace">
        {mobileNavigationOpen ? <button className="admin-sidebar-scrim" type="button" onClick={() => setMobileNavigationOpen(false)} aria-label="Close navigation" /> : null}
        <aside className={`admin-sidebar ${mobileNavigationOpen ? "open" : ""}`}>
          <div className="admin-sidebar-mobile-head">
            <strong>Administration</strong>
            <button type="button" onClick={() => setMobileNavigationOpen(false)} aria-label="Close navigation"><X size={18} /></button>
          </div>
          <nav aria-label="Admin sections">
            {navigationGroups.map((group) => {
              const items = visibleNavigation.filter((item) => item.group === group);
              if (!items.length) return null;
              return (
                <section className="admin-nav-group" key={group}>
                  <p>{group}</p>
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className={activeTab === item.id ? "active" : ""}
                        onClick={() => navigate(item.id)}
                        aria-current={activeTab === item.id ? "page" : undefined}
                      >
                        <Icon size={18} />
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                      </button>
                    );
                  })}
                </section>
              );
            })}
          </nav>
          <div className="admin-sidebar-note">
            <strong>Decision workspace</strong>
            <p>Metrics compare the selected period with the immediately preceding period.</p>
          </div>
        </aside>

        <section className="admin-main">
          {activeTab === "overview" ? <AdminOverview onNavigate={navigate} /> : null}
          {activeTab === "orders" ? <AdminOrders /> : null}
          {activeTab === "inventory" ? <AdminInventory /> : null}
          {activeTab === "combos" ? <AdminCombos /> : null}
          {activeTab === "growth" ? <AdminGrowth /> : null}
          {activeTab === "customers" ? <AdminCustomers /> : null}
          {activeTab === "operations" ? <AdminOperations /> : null}
          {activeTab === "content" ? <AdminContent /> : null}
          {activeTab === "team" ? <AdminTeam /> : null}
        </section>
      </div>
      {commandOpen ? (
        <div className="admin-command-backdrop" role="presentation" onMouseDown={() => setCommandOpen(false)}>
          <section
            className="admin-command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Quick navigation"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <Search size={18} />
              <input
                autoFocus
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Jump to orders, products, reviews..."
                aria-label="Search admin sections"
              />
              <button type="button" onClick={() => setCommandOpen(false)} aria-label="Close quick navigation"><X size={17} /></button>
            </header>
            <div>
              {commandResults.map((item) => {
                const Icon = item.icon;
                return (
                  <button type="button" key={item.id} onClick={() => navigate(item.id)}>
                    <Icon size={18} />
                    <span><strong>{item.label}</strong><small>{item.group} · {item.description}</small></span>
                    <ChevronRight size={16} />
                  </button>
                );
              })}
              {!commandResults.length ? <p>No admin section matches “{commandQuery}”.</p> : null}
            </div>
            <footer><span>Navigate with search</span><kbd>Esc</kbd><span>to close</span></footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
