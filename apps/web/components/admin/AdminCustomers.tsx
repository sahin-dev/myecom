"use client";

import { Download, Mail, RefreshCw, Search, UserRoundCheck, UsersRound } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AdminCustomer, fetchAdminCustomers, formatMoney, updateAdminCustomer } from "../../lib/catalog";
import {
  AdminError,
  AdminLoading,
  AdminPageTitle,
  AdminSectionHeader
} from "./AdminShared";

export function AdminCustomers() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCustomers(await fetchAdminCustomers(search));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Customers are unavailable.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const buyers = customers.filter((customer) => customer.orders > 0);
    const repeat = customers.filter((customer) => customer.orders > 1);
    const spend = customers.reduce((sum, customer) => sum + customer.lifetimeSpend, 0);
    return {
      registered: customers.length,
      buyers: buyers.length,
      repeat: repeat.length,
      repeatRate: buyers.length ? (repeat.length / buyers.length) * 100 : 0,
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
      ["Name", "Email", "Phone", "Joined", "Orders", "Lifetime spend", "Last order"],
      ...customers.map((customer) => [
        customer.name,
        customer.email,
        customer.phone ?? "",
        customer.createdAt,
        customer.orders,
        customer.lifetimeSpend,
        customer.lastOrderAt ?? ""
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Customer access could not be changed.");
    }
  }

  if (loading && !customers.length) return <AdminLoading label="Loading customer records..." />;
  if (error && !customers.length) return <AdminError message={error} retry={() => void load()} />;

  return (
    <div className="admin-page">
      <AdminPageTitle
        eyebrow="Customer intelligence"
        title="Customers"
        description="Understand value, purchase frequency, and retention opportunities."
        actions={
          <>
            <button className="secondary-action" type="button" onClick={exportCustomers}><Download size={17} /> Export</button>
            <button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh customers"><RefreshCw size={17} /></button>
          </>
        }
      />

      <section className="admin-summary-strip customers">
        <div><small>Registered</small><strong>{summary.registered}</strong></div>
        <div><small>Customers with orders</small><strong>{summary.buyers}</strong></div>
        <div><small>Repeat buyers</small><strong>{summary.repeat}</strong></div>
        <div><small>Repeat rate</small><strong>{summary.repeatRate.toFixed(1)}%</strong></div>
        <div><small>Average lifetime value</small><strong>{formatMoney(summary.averageValue)}</strong></div>
      </section>

      <form className="admin-filterbar customer-search" onSubmit={applySearch}>
        <label className="admin-search"><Search size={17} /><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search name, email, or phone" /></label>
        <button className="primary-action" type="submit">Search</button>
      </form>

      <section>
        <AdminSectionHeader
          title={`${customers.length} customer records`}
          description="Lifetime values exclude cancelled orders"
        />
        <div className="admin-table-wrap">
          <table className="admin-table admin-customers-table">
            <thead><tr><th>Customer</th><th>Joined</th><th>Orders</th><th>Lifetime value</th><th>Last order</th><th>Segment</th><th /></tr></thead>
            <tbody>
              {customers.map((customer) => {
                const segment =
                  customer.orders > 2 ? "Loyal" :
                  customer.orders > 1 ? "Returning" :
                  customer.orders === 1 ? "First-time" : "Registered";
                return (
                  <tr key={customer.id}>
                    <td>
                      <div className="admin-customer-cell">
                        <span>{customer.name.slice(0, 1).toUpperCase()}</span>
                        <div><strong>{customer.name}</strong><small>{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}</small></div>
                      </div>
                    </td>
                    <td>{new Date(customer.createdAt).toLocaleDateString("en-BD")}</td>
                    <td>{customer.orders}</td>
                    <td><strong>{formatMoney(customer.lifetimeSpend)}</strong></td>
                    <td>{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString("en-BD") : "No order"}</td>
                    <td><span className={`admin-customer-segment ${segment.toLowerCase()}`}>{segment}</span></td>
                    <td>
                      <a href={`mailto:${customer.email}`} title={`Email ${customer.name}`}><Mail size={16} /></a>
                      <button type="button" onClick={() => void toggleCustomer(customer)}>{customer.isActive ? "Deactivate" : "Reactivate"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!customers.length ? (
            <div className="admin-empty"><UsersRound size={30} /><strong>No customers found</strong><p>Try a different search.</p></div>
          ) : null}
        </div>
      </section>

      <section className="admin-retention-note">
        <UserRoundCheck size={22} />
        <div>
          <strong>Retention is a growth lever</strong>
          <p>Use first-time and registered segments for onboarding, and reward returning customers with relevant bundles rather than broad discounts.</p>
        </div>
      </section>
    </div>
  );
}
