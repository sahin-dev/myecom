"use client";

import {
  Edit3,
  PackageCheck,
  Plus,
  RefreshCw,
  Trash2,
  Truck
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CourierProvider,
  CourierService,
  createCourierService,
  deleteCourierService,
  fetchCourierServices,
  updateCourierService
} from "../../lib/catalog";
import { useAuth } from "../AuthContext";
import {
  AdminConfirmDialog,
  AdminError,
  AdminLoading,
  AdminPageTitle,
  AdminSectionHeader,
  AdminToast,
  StatusBadge,
  useAdminToast
} from "./AdminShared";

const providers: Array<{ value: CourierProvider; label: string; detail: string }> = [
  { value: "MANUAL", label: "Manual courier", detail: "Keep existing manual tracking without API calls." },
  { value: "PATHAO", label: "Pathao", detail: "Use a configured Pathao merchant API endpoint." },
  { value: "STEADFAST", label: "Steadfast", detail: "Use Steadfast parcel create/status endpoints." },
  { value: "SUNDARBAN", label: "Sundarban", detail: "Use Sundarban credentials when API access is available." },
  { value: "CUSTOM", label: "Custom API", detail: "Connect any provider with dispatch/status URLs." }
];

const providerLabel = (value: CourierProvider) =>
  providers.find((provider) => provider.value === value)?.label ?? value;

function settingsFrom(form: FormData) {
  return {
    dispatchPath: String(form.get("dispatchPath") || "").trim(),
    statusPath: String(form.get("statusPath") || "").trim(),
    dispatchMethod: String(form.get("dispatchMethod") || "POST"),
    statusMethod: String(form.get("statusMethod") || "GET")
  };
}

export function AdminCouriers() {
  const { user } = useAuth();
  const canWrite = Boolean(
    user?.permissions.includes("*") || user?.permissions.includes("couriers.write")
  );
  const [services, setServices] = useState<CourierService[]>([]);
  const [editing, setEditing] = useState<CourierService | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removeTarget, setRemoveTarget] = useState<CourierService | null>(null);
  const { message, kind, notify } = useAdminToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setServices(await fetchCourierServices());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Courier services are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const secretFields = {
      apiKey: String(data.get("apiKey") || "").trim(),
      apiSecret: String(data.get("apiSecret") || "").trim(),
      clientSecret: String(data.get("clientSecret") || "").trim()
    };
    const input = {
      provider: String(data.get("provider")) as CourierProvider,
      name: String(data.get("name") || "").trim(),
      code: String(data.get("code") || "").trim(),
      description: String(data.get("description") || "").trim(),
      apiBaseUrl: String(data.get("apiBaseUrl") || "").trim(),
      clientId: String(data.get("clientId") || "").trim(),
      storeId: String(data.get("storeId") || "").trim(),
      defaultPickupAddress: String(data.get("defaultPickupAddress") || "").trim(),
      settings: settingsFrom(data),
      isActive: data.get("isActive") === "on",
      priority: Number(data.get("priority") || 0),
      ...(secretFields.apiKey ? { apiKey: secretFields.apiKey } : {}),
      ...(secretFields.apiSecret ? { apiSecret: secretFields.apiSecret } : {}),
      ...(secretFields.clientSecret ? { clientSecret: secretFields.clientSecret } : {})
    };
    setSaving(true);
    try {
      const saved = editing
        ? await updateCourierService(editing.id, input)
        : await createCourierService(input);
      setServices((current) =>
        editing
          ? current.map((service) => service.id === saved.id ? saved : service)
          : [saved, ...current]
      );
      setEditing(null);
      form.reset();
      notify(`${saved.name} was saved.`);
      void load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Courier service could not be saved.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(service: CourierService) {
    try {
      const updated = await updateCourierService(service.id, { isActive: !service.isActive });
      setServices((current) => current.map((item) => item.id === updated.id ? updated : item));
      notify(`${updated.name} is now ${updated.isActive ? "active" : "disabled"}.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Courier service could not be updated.", "error");
    }
  }

  async function remove(service: CourierService) {
    try {
      await deleteCourierService(service.id);
      setRemoveTarget(null);
      if (editing?.id === service.id) setEditing(null);
      await load();
      notify(`${service.name} was removed or disabled.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Courier service could not be removed.", "error");
    }
  }

  if (loading && !services.length) return <AdminLoading label="Loading courier services..." />;
  if (error && !services.length) return <AdminError message={error} retry={() => void load()} />;

  return (
    <div className="admin-page">
      <AdminPageTitle
        eyebrow="Parcel operations"
        title="Couriers"
        description="Connect courier providers, keep manual fallback, and control which services can receive parcels."
        actions={<button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh couriers"><RefreshCw size={17} /></button>}
      />
      <AdminToast message={message} kind={kind} />

      {removeTarget ? (
        <AdminConfirmDialog
          title={`Remove ${removeTarget.name}?`}
          body="Services with shipment history are disabled instead of deleted so previous orders remain auditable."
          confirmLabel="Remove service"
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => void remove(removeTarget)}
        />
      ) : null}

      <div className="admin-courier-layout">
        <section className="admin-data-panel admin-courier-services">
          <AdminSectionHeader
            title="Courier services"
            description="Active services are available when dispatching confirmed orders."
          />
          <div className="admin-courier-list">
            {services.map((service) => (
              <article key={service.id} className={editing?.id === service.id ? "is-selected" : ""}>
                <div className="admin-courier-logo"><Truck size={21} /></div>
                <div>
                  <strong>{service.name}</strong>
                  <span>{providerLabel(service.provider)} / {service.code}</span>
                  <small>
                    {service.apiConfigured ? "API endpoint set" : "Manual or endpoint missing"}
                    {service._count?.shipments ? ` / ${service._count.shipments} shipments` : ""}
                  </small>
                </div>
                <StatusBadge value={service.isActive ? "ACTIVE" : "DISABLED"} />
                {canWrite ? (
                  <div className="admin-courier-actions">
                    <button type="button" onClick={() => setEditing(service)} title={`Edit ${service.name}`}><Edit3 size={15} /></button>
                    <button type="button" onClick={() => void toggle(service)}>{service.isActive ? "Disable" : "Enable"}</button>
                    <button type="button" onClick={() => setRemoveTarget(service)} title={`Remove ${service.name}`}><Trash2 size={15} /></button>
                  </div>
                ) : null}
              </article>
            ))}
            {!services.length ? (
              <div className="admin-empty">
                <PackageCheck size={30} />
                <strong>No courier services yet</strong>
                <p>Add manual delivery first, then connect courier APIs as credentials become available.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="admin-data-panel">
          <AdminSectionHeader
            title={editing ? `Edit ${editing.name}` : "Add courier service"}
            description="Credentials are saved on the server and shown as configured, not exposed back to the browser."
            action={editing ? <button type="button" className="secondary-action" onClick={() => setEditing(null)}>New service</button> : null}
          />
          <form className="admin-courier-form" onSubmit={save} key={editing?.id ?? "new-courier"}>
            <div className="form-grid">
              <label>Provider
                <select name="provider" defaultValue={editing?.provider ?? "MANUAL"}>
                  {providers.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}
                </select>
              </label>
              <label>Priority<input name="priority" type="number" defaultValue={editing?.priority ?? 0} /></label>
            </div>
            <div className="form-grid">
              <label>Display name<input name="name" placeholder="Pathao courier" defaultValue={editing?.name ?? ""} required /></label>
              <label>Code<input name="code" placeholder="PATHAO" defaultValue={editing?.code ?? ""} /></label>
            </div>
            <label>Description<textarea name="description" placeholder="Same-day city parcel service." defaultValue={editing?.description ?? ""} /></label>

            <div className="admin-courier-form-section">
              <strong>API connection</strong>
              <div className="form-grid">
                <label>API base URL<input name="apiBaseUrl" placeholder="https://provider.example.com" defaultValue={editing?.apiBaseUrl ?? ""} /></label>
                <label>Store / merchant ID<input name="storeId" placeholder="Provider store ID" defaultValue={editing?.storeId ?? ""} /></label>
              </div>
              <div className="form-grid">
                <label>Dispatch path<input name="dispatchPath" placeholder="orders/create" defaultValue={String(editing?.settings?.dispatchPath ?? "")} /></label>
                <label>Status path<input name="statusPath" placeholder="orders/:trackingCode/status" defaultValue={String(editing?.settings?.statusPath ?? "")} /></label>
              </div>
              <div className="form-grid">
                <label>Dispatch method<select name="dispatchMethod" defaultValue={String(editing?.settings?.dispatchMethod ?? "POST")}><option>POST</option><option>PUT</option></select></label>
                <label>Status method<select name="statusMethod" defaultValue={String(editing?.settings?.statusMethod ?? "GET")}><option>GET</option><option>POST</option></select></label>
              </div>
            </div>

            <div className="admin-courier-form-section">
              <strong>Credentials</strong>
              <div className="form-grid">
                <label>API key<input name="apiKey" placeholder={editing?.apiKey ? "Configured - leave blank to keep" : "Provider API key"} /></label>
                <label>API secret<input name="apiSecret" placeholder={editing?.apiSecret ? "Configured - leave blank to keep" : "Provider API secret"} /></label>
              </div>
              <div className="form-grid">
                <label>Client ID<input name="clientId" placeholder="OAuth client ID" defaultValue={editing?.clientId ?? ""} /></label>
                <label>Client secret<input name="clientSecret" placeholder={editing?.clientSecret ? "Configured - leave blank to keep" : "OAuth client secret"} /></label>
              </div>
            </div>

            <label>Default pickup address<textarea name="defaultPickupAddress" placeholder="Warehouse or store pickup point" defaultValue={editing?.defaultPickupAddress ?? ""} /></label>
            <label className="admin-check-row">
              <input name="isActive" type="checkbox" defaultChecked={editing?.isActive ?? true} />
              <span>Available for order dispatch</span>
            </label>
            <button className="primary-action full" type="submit" disabled={!canWrite || saving}>
              <Plus size={16} /> {saving ? "Saving..." : editing ? "Update courier service" : "Add courier service"}
            </button>
          </form>
        </section>
      </div>

      <section className="admin-data-panel admin-courier-guide">
        <AdminSectionHeader title="How dispatch works" description="Keep setup and daily parcel work separated." />
        <div>
          {providers.map((provider) => (
            <article key={provider.value}>
              <strong>{provider.label}</strong>
              <p>{provider.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
