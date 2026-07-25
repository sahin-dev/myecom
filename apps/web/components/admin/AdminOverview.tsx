"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Sparkles,
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

  const trendMax = useMemo(
    () => Math.max(1, ...(dashboard?.salesTrend.map((point) => point.revenue) ?? [1])),
    [dashboard]
  );

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

      <section className="admin-kpi-grid" aria-label="Key performance indicators">
        <KpiCard
          label="Net sales"
          metric={dashboard.kpis.revenue}
          icon={<CircleDollarSign size={19} />}
          format={formatMoney}
        />
        <KpiCard
          label="Orders"
          metric={dashboard.kpis.orders}
          icon={<ShoppingBag size={19} />}
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

      <section className="admin-analytics-grid">
        <div className="admin-chart-section">
          <AdminSectionHeader
            title="Sales trend"
            description={`${dashboard.period.days}-day net sales, grouped into ${dashboard.salesTrend.length} intervals`}
          />
          <div className="admin-bar-chart" aria-label="Sales trend chart">
            {dashboard.salesTrend.map((point) => (
              <div
                className="admin-bar-column"
                key={point.date}
                title={`${new Date(point.date).toLocaleDateString("en-BD")}: ${formatMoney(point.revenue)}, ${point.orders} orders`}
              >
                <span style={{ height: `${Math.max(3, (point.revenue / trendMax) * 100)}%` }} />
              </div>
            ))}
          </div>
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

      <section className="admin-operations-row">
        <OperationMetric
          icon={<PackageCheck size={18} />}
          label="Unfulfilled"
          value={dashboard.operations.unfulfilled}
          action="Open orders"
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
          onClick={() => onNavigate("orders")}
        />
        <OperationMetric
          icon={<Boxes size={18} />}
          label="Low stock"
          value={dashboard.lowStock.length}
          action="Plan replenishment"
          onClick={() => onNavigate("inventory")}
        />
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

function KpiCard({
  label,
  metric,
  icon,
  format = (value) => new Intl.NumberFormat("en-BD").format(value)
}: {
  label: string;
  metric: AdminMetric;
  icon: React.ReactNode;
  format?: (value: number) => string;
}) {
  const positive = metric.change >= 0;
  return (
    <article className="admin-kpi">
      <div><span>{icon}</span><small>{label}</small></div>
      <strong>{format(metric.value)}</strong>
      <p className={positive ? "positive" : "negative"}>
        {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {Math.abs(metric.change)}% <span>vs previous period</span>
      </p>
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
