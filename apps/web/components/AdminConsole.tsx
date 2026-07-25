"use client";

import {
  BarChart3,
  Boxes,
  ChevronRight,
  ClipboardList,
  LogOut,
  Megaphone,
  Network,
  ShieldCheck,
  Store,
  TrendingUp,
  UsersRound
} from "lucide-react";
import { useState } from "react";
import { AuthUser } from "../lib/catalog";
import { useAuth } from "./AuthContext";
import { BrandIdentity } from "./PageChrome";
import { useSiteSettings } from "./SiteSettingsContext";
import { AdminContent } from "./admin/AdminContent";
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
  | "growth"
  | "customers"
  | "operations"
  | "content"
  | "team";

const navigation: Array<{
  id: AdminTab;
  label: string;
  description: string;
  icon: typeof BarChart3;
}> = [
  { id: "overview", label: "Overview", description: "Performance and signals", icon: BarChart3 },
  { id: "orders", label: "Orders", description: "Fulfillment workspace", icon: ClipboardList },
  { id: "inventory", label: "Inventory", description: "Products and stock", icon: Boxes },
  { id: "growth", label: "Growth", description: "Demand and conversion", icon: TrendingUp },
  { id: "customers", label: "Customers", description: "Value and retention", icon: UsersRound },
  { id: "operations", label: "Operations", description: "Returns and supply", icon: Network },
  { id: "content", label: "Content", description: "Banners and taxonomy", icon: Megaphone },
  { id: "team", label: "Team", description: "Access and audit", icon: ShieldCheck }
];

export function AdminConsole() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const { user, loading, logout } = useAuth();
  const { settings } = useSiteSettings();

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

  const roleTabs: Record<AuthUser["role"], AdminTab[]> = {
    CUSTOMER: [],
    ADMIN: navigation.map((item) => item.id),
    OWNER: navigation.map((item) => item.id),
    OPERATIONS: ["overview", "orders", "inventory", "customers", "operations"],
    CATALOG: ["overview", "inventory", "growth", "content"],
    SUPPORT: ["overview", "orders", "customers"],
    ANALYST: ["overview", "growth", "customers", "inventory"]
  };
  const visibleNavigation = navigation.filter((item) =>
    roleTabs[user.role].includes(item.id)
  );
  const activeTab = visibleNavigation.some((item) => item.id === tab)
    ? tab
    : visibleNavigation[0]?.id ?? "overview";

  return (
    <main className="admin-app">
      <header className="admin-topbar">
        <BrandIdentity settings={settings} />
        <div className="admin-topbar-context">
          <span>Administration</span>
          <ChevronRight size={14} />
          <strong>{navigation.find((item) => item.id === activeTab)?.label}</strong>
        </div>
        <div className="admin-topbar-actions">
          <a href="/" title="Open storefront">
            <Store size={18} />
            <span>Storefront</span>
          </a>
          <div>
            <strong>{user.name}</strong>
            <span>{user.role.toLowerCase()}</span>
          </div>
          <button type="button" onClick={logout} title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="admin-workspace">
        <aside className="admin-sidebar">
          <nav aria-label="Admin sections">
            {visibleNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={activeTab === item.id ? "active" : ""}
                  onClick={() => setTab(item.id)}
                >
                  <Icon size={18} />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="admin-sidebar-note">
            <strong>Decision workspace</strong>
            <p>Metrics compare the selected period with the immediately preceding period.</p>
          </div>
        </aside>

        <section className="admin-main">
          {activeTab === "overview" ? <AdminOverview onNavigate={setTab} /> : null}
          {activeTab === "orders" ? <AdminOrders /> : null}
          {activeTab === "inventory" ? <AdminInventory /> : null}
          {activeTab === "growth" ? <AdminGrowth /> : null}
          {activeTab === "customers" ? <AdminCustomers /> : null}
          {activeTab === "operations" ? <AdminOperations /> : null}
          {activeTab === "content" ? <AdminContent /> : null}
          {activeTab === "team" ? <AdminTeam /> : null}
        </section>
      </div>
    </main>
  );
}
