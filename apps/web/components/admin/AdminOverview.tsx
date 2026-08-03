"use client";

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Eye,
  GitBranch,
  Layers,
  PieChart,
  Radio,
  RefreshCw,
  Repeat2,
  ShoppingBag,
  Sparkles,
  Star,
  Timer,
  UsersRound
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminDashboard, AdminMetric, fetchAdminDashboard, formatMoney } from "../../lib/catalog";
import type { AdminTab } from "../AdminConsole";
import {
  AdminError,
  AdminLoading,
  AdminPageTitle,
  AdminSectionHeader,
  StatusBadge
} from "./AdminShared";
import { CategoryBarChart, SalesTrendChart, Sparkline } from "./AdminOverviewCharts";

export function AdminOverview({ onNavigate }: { onNavigate: (tab: AdminTab) => void }) {
  const [days, setDays] = useState(30);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDashboard(await fetchAdminDashboard(days));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Dashboard data is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const openIssues = dashboard
    ? dashboard.traffic.newOrderQueue +
      dashboard.operations.ageingOrders +
      dashboard.operations.awaitingPayment +
      dashboard.lowStock.length
    : 0;

  const pipelineMax = useMemo(
    () => Math.max(1, ...(dashboard?.statusBreakdown.map((item) => item.count) ?? [1])),
    [dashboard]
  );

  const customerMixTotal = dashboard
    ? Math.max(1, dashboard.customerInsights.newCustomers + dashboard.customerInsights.returningCustomers)
    : 1;

  if (loading && !dashboard) return <AdminLoading />;
  if (error && !dashboard) return <AdminError message={error} retry={() => void load()} />;
  if (!dashboard) return null;

  return (
    <div className="admin-page">
      <AdminPageTitle
        eyebrow="Business overview"
        title="Performance"
        description="A decision-ready view of sales, demand, customers, and fulfillment."
        actions={
          <>
            <span className={`admin-status-pill${openIssues ? " attention" : ""}`}>
              {openIssues ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
              {openIssues
                ? `${openIssues} item${openIssues === 1 ? "" : "s"} need attention`
                : "All systems normal"}
            </span>
            <div className="admin-period-control" aria-label="Reporting period">
              {[7, 30, 90].map((period) => (
                <button
                  type="button"
                  className={days === period ? "active" : ""}
                  onClick={() => setDays(period)}
                  key={period}
                >
                  {period}d
                </button>
              ))}
            </div>
            <button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh metrics">
              <RefreshCw size={17} />
            </button>
          </>
        }
      />

      <section className="admin-priority-section" aria-label="Action required">
        <AdminSectionHeader
          title="Action required"
          description="Operational queues that can affect customers or revenue"
        />
        <div className="admin-operations-row priority">
          <OperationMetric
            icon={<ShoppingBag size={18} />}
            label="Awaiting confirmation"
            value={dashboard.traffic.newOrderQueue}
            action="Review new orders"
            onClick={() => onNavigate("orders")}
          />
          <OperationMetric
            icon={<Clock3 size={18} />}
            label="Over 48 hours"
            value={dashboard.operations.ageingOrders}
            action="Resolve delays"
            onClick={() => onNavigate("orders")}
          />
          <OperationMetric
            icon={<Banknote size={18} />}
            label="Awaiting payment"
            value={dashboard.operations.awaitingPayment}
            action="Review payments"
            onClick={() => onNavigate("payments")}
          />
          <OperationMetric
            icon={<Boxes size={18} />}
            label="Low stock"
            value={dashboard.lowStock.length}
            action="Plan replenishment"
            onClick={() => onNavigate("inventory")}
          />
        </div>
      </section>

      <section className="admin-pulse-section" aria-label="Store activity today">
        <header>
          <div><span className="admin-live-dot" /> Store pulse</div>
          <small>Active visitors are sessions seen in the last {dashboard.traffic.activeWindowMinutes} minutes.</small>
        </header>
        <div className="admin-pulse-grid">
          <PulseMetric
            icon={<UsersRound size={18} />}
            label="Visitors today"
            value={dashboard.traffic.visitorsToday}
            detail={`${dashboard.traffic.periodVisitors} in this reporting period`}
            onClick={() => onNavigate("growth")}
          />
          <PulseMetric
            icon={<Radio size={18} />}
            label="Active now"
            value={dashboard.traffic.activeVisitors}
            detail="Recent active sessions"
            onClick={() => onNavigate("growth")}
          />
          <PulseMetric
            icon={<Eye size={18} />}
            label="Lifetime visitors"
            value={dashboard.traffic.lifetimeVisitors}
            detail="Tracked browser sessions"
            onClick={() => onNavigate("growth")}
          />
        </div>
      </section>

      <section className="admin-kpi-grid" aria-label="Key performance indicators">
        <KpiCard
          label="Net sales"
          metric={dashboard.kpis.revenue}
          icon={<CircleDollarSign size={19} />}
          format={formatMoney}
          trend={dashboard.salesTrend.map((point) => point.revenue)}
        />
        <KpiCard
          label="Orders"
          metric={dashboard.kpis.orders}
          icon={<ShoppingBag size={19} />}
          trend={dashboard.salesTrend.map((point) => point.orders)}
        />
        <KpiCard
          label="Average order"
          metric={dashboard.kpis.averageOrderValue}
          icon={<Banknote size={19} />}
          format={formatMoney}
        />
        <KpiCard
          label="Customers"
          metric={dashboard.kpis.customers}
          icon={<UsersRound size={19} />}
        />
        <KpiCard
          label="Units sold"
          metric={dashboard.kpis.unitsSold}
          icon={<Boxes size={19} />}
        />
      </section>

      <section className="admin-status-grid" aria-label="System status">
        <div className="admin-status-card">
          <AdminSectionHeader
            title="Order pipeline"
            description="Where every order in the system currently sits"
            icon={<GitBranch size={16} />}
          />
          {dashboard.statusBreakdown.some((item) => item.count > 0) ? (
            <div className="admin-pipeline-list">
              {dashboard.statusBreakdown
                .filter((item) => item.count > 0)
                .map((item) => (
                  <div className="admin-pipeline-row" key={item.status}>
                    <StatusBadge value={item.status} />
                    <div className="admin-pipeline-track">
                      <span style={{ width: `${Math.max(4, (item.count / pipelineMax) * 100)}%` }} />
                    </div>
                    <div className="admin-pipeline-figures">
                      <strong>{item.count}</strong>
                      <small>{formatMoney(item.value)}</small>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="admin-muted">No orders placed in this period yet.</p>
          )}
        </div>

        <div className="admin-status-card">
          <AdminSectionHeader
            title="Fulfillment health"
            description="How reliably orders are moving through operations"
            icon={<Activity size={16} />}
          />
          <div className="admin-fulfillment-stats">
            <div>
              <span><Timer size={16} /></span>
              <div>
                <small>Average fulfillment time</small>
                <strong>{formatFulfillmentTime(dashboard.operations.averageFulfillmentHours)}</strong>
              </div>
            </div>
            <div>
              <span><Layers size={16} /></span>
              <div>
                <small>Unfulfilled orders</small>
                <strong>{dashboard.operations.unfulfilled}</strong>
              </div>
            </div>
            <div>
              <span><AlertTriangle size={16} /></span>
              <div>
                <small>Cancellation rate</small>
                <strong>{dashboard.operations.cancelledRate}%</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-status-card">
          <AdminSectionHeader
            title="Customer mix"
            description={`${dashboard.customerInsights.repeatRate}% of orders came from returning customers`}
            icon={<Repeat2 size={16} />}
          />
          <div className="admin-mix-bar">
            <span
              className="new"
              style={{ width: `${(dashboard.customerInsights.newCustomers / customerMixTotal) * 100}%` }}
            />
            <span
              className="returning"
              style={{ width: `${(dashboard.customerInsights.returningCustomers / customerMixTotal) * 100}%` }}
            />
          </div>
          <div className="admin-mix-legend">
            <span><i className="new" />New<strong>{dashboard.customerInsights.newCustomers}</strong></span>
            <span><i className="returning" />Returning<strong>{dashboard.customerInsights.returningCustomers}</strong></span>
          </div>
        </div>
      </section>

      <section className="admin-analytics-grid">
        <div className="admin-chart-section">
          <AdminSectionHeader
            title="Sales trend"
            description={`${dashboard.period.days}-day net sales, grouped into ${dashboard.salesTrend.length} intervals`}
          />
          <SalesTrendChart points={dashboard.salesTrend} formatValue={formatMoney} />
          <div className="admin-chart-footer">
            <span>{new Date(dashboard.period.start).toLocaleDateString("en-BD")}</span>
            <strong>{formatMoney(dashboard.kpis.revenue.value)}</strong>
            <span>{new Date(dashboard.period.end).toLocaleDateString("en-BD")}</span>
          </div>
        </div>

        <div className="admin-forecast">
          <AdminSectionHeader
            title="30-day run-rate"
            description="A directional projection, not a guaranteed forecast"
          />
          <strong>{formatMoney(dashboard.forecast.projected30DayRevenue)}</strong>
          <p>
            At the current pace of {formatMoney(dashboard.forecast.dailyRunRate)} per day.
          </p>
          <dl>
            <div>
              <dt>Gross profit tracked</dt>
              <dd>{formatMoney(dashboard.kpis.grossProfit.value)}</dd>
            </div>
            <div>
              <dt>Estimated margin</dt>
              <dd>{dashboard.kpis.grossProfit.margin}%</dd>
            </div>
            <div>
              <dt>Cost-data coverage</dt>
              <dd>{dashboard.kpis.grossProfit.coverage}%</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="admin-two-column">
        <div>
          <AdminSectionHeader
            title="Category performance"
            description="Revenue by product category this period"
            icon={<PieChart size={16} />}
            action={<button className="admin-text-button" onClick={() => onNavigate("inventory")}>Catalog <ArrowRight size={15} /></button>}
          />
          <CategoryBarChart items={dashboard.categoryPerformance} formatValue={formatMoney} />
        </div>

        <div>
          <AdminSectionHeader
            title="Top customers"
            description="Ranked by spend this period"
            icon={<Star size={16} />}
            action={<button className="admin-text-button" onClick={() => onNavigate("customers")}>All customers <ArrowRight size={15} /></button>}
          />
          {dashboard.customerInsights.topCustomers.length ? (
            <div className="admin-customer-compact">
              {dashboard.customerInsights.topCustomers.map((customer, index) => (
                <button key={customer.email} type="button" onClick={() => onNavigate("customers")}>
                  <span className="admin-customer-rank">{index + 1}</span>
                  <span>
                    <strong>{customer.name || customer.email}</strong>
                    <small>{customer.orders} order{customer.orders === 1 ? "" : "s"} · {new Date(customer.lastOrderAt).toLocaleDateString("en-BD")}</small>
                  </span>
                  <strong>{formatMoney(customer.spend)}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p className="admin-muted">No customer purchases recorded in this period yet.</p>
          )}
        </div>
      </section>

      <section className="admin-insights-section">
        <AdminSectionHeader
          title="Decision center"
          description="Signals derived from current sales and operating data"
        />
        <div className="admin-insight-list">
          {dashboard.insights.length ? dashboard.insights.map((insight) => (
            <article className={`admin-insight ${insight.severity}`} key={insight.title}>
              <Sparkles size={18} />
              <div>
                <strong>{insight.title}</strong>
                <p>{insight.detail}</p>
                <span>{insight.action}</span>
              </div>
            </article>
          )) : (
            <p className="admin-muted">More activity is needed before decision signals can be generated.</p>
          )}
        </div>
      </section>

      <section className="admin-two-column">
        <div>
          <AdminSectionHeader
            title="Top products"
            description="Products ranked by period revenue"
            action={<button className="admin-text-button" onClick={() => onNavigate("inventory")}>Inventory <ArrowRight size={15} /></button>}
          />
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Product</th><th>Units</th><th>Orders</th><th>Sales</th><th>Stock</th></tr>
              </thead>
              <tbody>
                {dashboard.topProducts.map((product) => (
                  <tr key={product.productId}>
                    <td><strong>{product.name}</strong></td>
                    <td>{product.units}</td>
                    <td>{product.orders}</td>
                    <td>{formatMoney(product.revenue)}</td>
                    <td className={product.inventory <= 20 ? "admin-cell-alert" : ""}>{product.inventory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <AdminSectionHeader
            title="Recent orders"
            description="Latest activity in the selected period"
            action={<button className="admin-text-button" onClick={() => onNavigate("orders")}>All orders <ArrowRight size={15} /></button>}
          />
          <div className="admin-order-compact">
            {dashboard.recentOrders.map((order) => (
              <button key={order.id} type="button" onClick={() => onNavigate("orders")}>
                <span>
                  <strong>{order.orderNumber}</strong>
                  <small>{order.customerName}</small>
                </span>
                <span>
                  <strong>{formatMoney(order.total)}</strong>
                  <StatusBadge value={order.status} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function formatFulfillmentTime(hours: number | null) {
  if (hours === null) return "Not enough data yet";
  if (hours >= 24) return `${(hours / 24).toFixed(1)} days`;
  return `${hours.toFixed(1)} hrs`;
}

function PulseMetric({
  icon,
  label,
  value,
  detail,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button className="admin-pulse-metric" type="button" onClick={onClick}>
      <span>{icon}</span>
      <div><small>{label}</small><strong>{new Intl.NumberFormat("en-BD").format(value)}</strong></div>
      <em>{detail}<ArrowRight size={13} /></em>
    </button>
  );
}

function KpiCard({
  label,
  metric,
  icon,
  format = (value) => new Intl.NumberFormat("en-BD").format(value),
  trend
}: {
  label: string;
  metric: AdminMetric;
  icon: React.ReactNode;
  format?: (value: number) => string;
  trend?: number[];
}) {
  const positive = metric.change >= 0;
  return (
    <article className="admin-kpi">
      <div><span>{icon}</span><small>{label}</small></div>
      <strong>{format(metric.value)}</strong>
      <div className="admin-kpi-foot">
        <p className={positive ? "positive" : "negative"}>
          {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(metric.change)}% <span>vs previous period</span>
        </p>
        {trend && trend.length > 1 ? <Sparkline values={trend} /> : null}
      </div>
    </article>
  );
}

function OperationMetric({
  icon,
  label,
  value,
  action,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  action: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="admin-operation" onClick={onClick}>
      <span>{icon}</span>
      <div><small>{label}</small><strong>{value}</strong></div>
      <em>{action}<ArrowRight size={14} /></em>
    </button>
  );
}
