"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  MapPinned,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Truck
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminCatalog,
  CheckoutMethod,
  DeliveryRate,
  DeliveryZone,
  PaymentGateway,
  createAdminResource,
  deleteAdminResource,
  fetchAdminCatalog,
  updateAdminResource,
  updateSiteSettings
} from "../../lib/catalog";
import { useSiteSettings } from "../SiteSettingsContext";
import {
  AdminConfirmDialog,
  AdminError,
  AdminLoading,
  AdminPageTitle,
  AdminSectionHeader,
  AdminToast,
  AdminUploadField,
  StatusBadge,
  useAdminToast
} from "./AdminShared";

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function cleanMethodCode(input?: string | null) {
  return (input ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function methodMetadata(method?: CheckoutMethod | null) {
  return method?.metadata && typeof method.metadata === "object" ? method.metadata : {};
}

function paymentKindValue(method?: CheckoutMethod | null) {
  const metadata = methodMetadata(method);
  const kind = String(metadata.paymentKind ?? "").trim();
  if (kind) return kind;
  const code = cleanMethodCode(method?.code);
  if (code.includes("CASH") || code.includes("COD")) return "cash";
  if (code === "ONLINE_PAYMENT") return "online_group";
  return "gateway";
}

function paymentProviderValue(method?: CheckoutMethod | null) {
  const metadata = methodMetadata(method);
  const provider = String(metadata.provider ?? "").trim().toLowerCase();
  const code = cleanMethodCode(method?.code);
  const name = cleanMethodCode(method?.name);
  if (provider) return provider;
  if (code.includes("BKASH") || name.includes("BKASH")) return "bkash";
  if (code.includes("NAGAD") || name.includes("NAGAD")) return "nagad";
  if (code.includes("CARD") || name.includes("CARD")) return "card";
  if (code.includes("ONLINE_PAYMENT")) return "online";
  if (code.includes("CASH") || code.includes("COD")) return "cash";
  return "other";
}

function paymentLogoUrl(method?: CheckoutMethod | null) {
  return String(methodMetadata(method).logoUrl ?? "").trim();
}

function scrollToCheckoutEditor(id: string) {
  window.requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

export function AdminCheckout() {
  const { setSettings } = useSiteSettings();
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [image, setImage] = useState("");
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<CheckoutMethod | null>(null);
  const [editingPaymentGateway, setEditingPaymentGateway] = useState<PaymentGateway | null>(null);
  const [editingDeliveryMethod, setEditingDeliveryMethod] = useState<CheckoutMethod | null>(null);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [editingRate, setEditingRate] = useState<DeliveryRate | null>(null);
  const [policyPaymentCodes, setPolicyPaymentCodes] = useState<string[]>([]);
  const [policyZoneCodes, setPolicyZoneCodes] = useState<string[]>([]);
  const [policyAdvancePercent, setPolicyAdvancePercent] = useState(0);
  const [policyRequireArea, setPolicyRequireArea] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ path: string; id: string; label: string } | null>(null);
  const { message, kind, notify } = useAdminToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCatalog(await fetchAdminCatalog());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout settings are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!catalog) return;
    const policy = catalog.siteSettings.checkoutPolicy;
    setPolicyPaymentCodes(policy?.allowedPaymentCodes ?? []);
    setPolicyZoneCodes(policy?.deliverableZoneCodes ?? []);
    setPolicyAdvancePercent(policy?.requiredPaymentPercent ?? 0);
    setPolicyRequireArea(Boolean(policy?.requireKnownDeliveryArea));
  }, [catalog]);

  const paymentMethods = useMemo(
    () => catalog?.checkoutMethods.filter((method) => method.type === "PAYMENT") ?? [],
    [catalog]
  );
  const deliveryMethods = useMemo(
    () => catalog?.checkoutMethods.filter((method) => method.type === "DELIVERY") ?? [],
    [catalog]
  );
  const paymentGateways = useMemo(() => catalog?.paymentGateways ?? [], [catalog]);
  const activePaymentCount = paymentMethods.filter((method) => method.isActive).length;
  const activeDeliveryCount = deliveryMethods.filter((method) => method.isActive).length;
  const activeZoneCount = catalog?.deliveryZones.filter((zone) => zone.isActive).length ?? 0;
  const gatewayCount = paymentMethods.filter((method) => paymentKindValue(method) === "gateway").length;
  const activeGatewayCount = paymentGateways.filter((gateway) => gateway.isActive).length;
  const activePaymentCodes = paymentMethods.filter((method) => method.isActive).map((method) => method.code);
  const activeZoneCodes = catalog?.deliveryZones.filter((zone) => zone.isActive).map((zone) => zone.code) ?? [];

  const notifyUpload = useCallback(
    (text: string) => notify(text, /could not|failed|unavailable/i.test(text) ? "error" : "success"),
    [notify]
  );

  function remove(path: string, id: string, label: string) {
    setConfirmTarget({ path, id, label });
  }

  async function performRemove() {
    if (!confirmTarget) return;
    try {
      await deleteAdminResource(confirmTarget.path, confirmTarget.id);
      setEditingPaymentMethod(null);
      setEditingPaymentGateway(null);
      setEditingDeliveryMethod(null);
      setEditingZone(null);
      setEditingRate(null);
      notify(`${confirmTarget.label} was removed.`);
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : `${confirmTarget.label} could not be removed.`, "error");
    } finally {
      setConfirmTarget(null);
    }
  }

  async function toggle(path: string, item: { id: string; name?: string; isActive?: boolean }) {
    try {
      await updateAdminResource(path, item.id, { isActive: !(item.isActive ?? true) });
      notify(`${item.name ?? "Item"} updated.`);
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Status could not be changed.", "error");
    }
  }

  async function move(path: string, items: Array<{ id: string; priority: number }>, index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const current = items[index];
    const target = items[targetIndex];
    try {
      await Promise.all([
        updateAdminResource(path, current.id, { priority: target.priority }),
        updateAdminResource(path, target.id, { priority: current.priority })
      ]);
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Could not reorder.", "error");
    }
  }

  function editPaymentMethod(method: CheckoutMethod) {
    setEditingPaymentMethod(method);
    setImage(paymentLogoUrl(method));
    scrollToCheckoutEditor("checkout-payment-editor");
  }

  function editPaymentGateway(gateway: PaymentGateway) {
    setEditingPaymentGateway(gateway);
    scrollToCheckoutEditor("checkout-gateway-editor");
  }

  function editDeliveryMethod(method: CheckoutMethod) {
    setEditingDeliveryMethod(method);
    scrollToCheckoutEditor("checkout-delivery-method-editor");
  }

  function editDeliveryZone(zone: DeliveryZone) {
    setEditingZone(zone);
    scrollToCheckoutEditor("checkout-zone-editor");
  }

  function editDeliveryRate(rate: DeliveryRate) {
    setEditingRate(rate);
    scrollToCheckoutEditor("checkout-zone-editor");
  }

  async function savePlatformPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalog) return;
    const form = new FormData(event.currentTarget);
    try {
      const updated = await updateSiteSettings({
        checkoutPolicy: {
          allowedPaymentCodes: form.getAll("allowedPaymentCodes").map(String),
          requiredPaymentPercent: Number(form.get("requiredPaymentPercent") || 0),
          deliverableZoneCodes: form.getAll("deliverableZoneCodes").map(String),
          requireKnownDeliveryArea: form.get("requireKnownDeliveryArea") === "on"
        }
      });
      setSettings(updated);
      setCatalog({ ...catalog, siteSettings: updated });
      notify("Checkout policy saved.");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Checkout policy could not be saved.", "error");
    }
  }

  function togglePolicyPayment(code: string) {
    setPolicyPaymentCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    );
  }

  function togglePolicyZone(code: string) {
    setPolicyZoneCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    );
  }

  async function savePaymentMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const paymentKind = value(form, "paymentKind");
    const provider = value(form, "provider");
    const payload = {
      type: "PAYMENT",
      code: cleanMethodCode(value(form, "code")),
      name: value(form, "name"),
      description: value(form, "description"),
      fee: 0,
      priority: Number(form.get("priority") || 0),
      isActive: form.get("isActive") === "on",
      metadata: {
        paymentKind,
        provider,
        logoUrl: image || undefined,
        settlement: paymentKind === "cash" ? "collect_on_delivery" : "gateway"
      },
      paymentGatewayId: paymentKind === "gateway" ? value(form, "paymentGatewayId") || undefined : undefined
    };
    try {
      if (editingPaymentMethod) await updateAdminResource("checkout-methods", editingPaymentMethod.id, payload);
      else await createAdminResource("checkout-methods", payload);
      notify(editingPaymentMethod ? "Payment method updated." : "Payment method saved.");
      setEditingPaymentMethod(null);
      setImage("");
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Payment method could not be saved.", "error");
    }
  }

  async function savePaymentGateway(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      provider: value(form, "provider"),
      mode: value(form, "mode") || "sandbox",
      code: cleanMethodCode(value(form, "code")),
      name: value(form, "name"),
      description: value(form, "description"),
      apiBaseUrl: value(form, "apiBaseUrl"),
      appKey: value(form, "appKey"),
      appSecret: value(form, "appSecret"),
      username: value(form, "username"),
      password: value(form, "password"),
      callbackUrl: value(form, "callbackUrl"),
      webhookUrl: value(form, "webhookUrl"),
      merchantId: value(form, "merchantId"),
      storeId: value(form, "storeId"),
      priority: Number(form.get("priority") || 0),
      isActive: form.get("isActive") === "on"
    };
    try {
      if (editingPaymentGateway) await updateAdminResource("payment-gateways", editingPaymentGateway.id, payload);
      else await createAdminResource("payment-gateways", payload);
      notify(editingPaymentGateway ? "Payment gateway updated." : "Payment gateway saved.");
      setEditingPaymentGateway(null);
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Payment gateway could not be saved.", "error");
    }
  }

  async function saveDeliveryMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      type: "DELIVERY",
      code: cleanMethodCode(value(form, "code")),
      name: value(form, "name"),
      description: value(form, "description"),
      fee: Number(form.get("fee") || 0),
      freeThreshold: Number(form.get("freeThreshold") || 0) || undefined,
      minDeliveryDays: Number(form.get("minDeliveryDays") || 0) || undefined,
      maxDeliveryDays: Number(form.get("maxDeliveryDays") || 0) || undefined,
      priority: Number(form.get("priority") || 0),
      isActive: form.get("isActive") === "on",
      metadata: { deliveryKind: "local_delivery" }
    };
    try {
      if (editingDeliveryMethod) await updateAdminResource("checkout-methods", editingDeliveryMethod.id, payload);
      else await createAdminResource("checkout-methods", payload);
      notify(editingDeliveryMethod ? "Delivery method updated." : "Delivery method saved.");
      setEditingDeliveryMethod(null);
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Delivery method could not be saved.", "error");
    }
  }

  async function saveDeliveryZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: value(form, "name"),
      code: value(form, "code"),
      city: value(form, "city"),
      areas: value(form, "areas").split("\n").map((item) => item.trim()).filter(Boolean),
      postalCodes: value(form, "postalCodes").split("\n").map((item) => item.trim()).filter(Boolean),
      priority: Number(form.get("priority") || 0),
      isActive: form.get("isActive") === "on"
    };
    try {
      if (editingZone) await updateAdminResource("delivery-zones", editingZone.id, payload);
      else await createAdminResource("delivery-zones", payload);
      notify(editingZone ? "Delivery zone updated." : "Delivery zone saved.");
      setEditingZone(null);
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Delivery zone could not be saved.", "error");
    }
  }

  async function saveDeliveryRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      zoneId: value(form, "zoneId"),
      deliveryMethodId: value(form, "deliveryMethodId"),
      baseFee: Number(form.get("baseFee") || 0),
      freeThreshold: Number(form.get("freeThreshold") || 0) || undefined,
      minOrder: Number(form.get("minOrder") || 0),
      maxOrder: Number(form.get("maxOrder") || 0) || undefined,
      minDeliveryDays: Number(form.get("minDeliveryDays") || 0) || undefined,
      maxDeliveryDays: Number(form.get("maxDeliveryDays") || 0) || undefined,
      priority: Number(form.get("priority") || 0),
      isActive: form.get("isActive") === "on"
    };
    try {
      if (editingRate) await updateAdminResource("delivery-rates", editingRate.id, payload);
      else await createAdminResource("delivery-rates", payload);
      notify(editingRate ? "Delivery rate updated." : "Delivery rate saved.");
      setEditingRate(null);
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Delivery rate could not be saved.", "error");
    }
  }

  if (loading && !catalog) return <AdminLoading label="Loading checkout settings..." />;
  if (error && !catalog) return <AdminError message={error} retry={() => void load()} />;
  if (!catalog) return null;

  return (
    <div className="admin-page">
      <AdminPageTitle
        eyebrow="Checkout operations"
        title="Checkout"
        description="Control payment rules, payment methods, delivery services, service areas, and zone fees."
        actions={<button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh checkout"><RefreshCw size={17} /></button>}
      />
      <AdminToast message={message} kind={kind} />

      {confirmTarget ? (
        <AdminConfirmDialog
          title={`Remove ${confirmTarget.label}?`}
          body="This may affect checkout availability. Existing orders remain unchanged."
          confirmLabel="Remove"
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => void performRemove()}
        />
      ) : null}

      <div className="checkout-admin-summary">
        <article><CreditCard size={18} /><span>Active payments</span><strong>{activePaymentCount}</strong></article>
        <article><ShieldCheck size={18} /><span>Gateway methods</span><strong>{gatewayCount}</strong></article>
        <article><ShieldCheck size={18} /><span>Gateway connections</span><strong>{activeGatewayCount}</strong></article>
        <article><Truck size={18} /><span>Delivery methods</span><strong>{activeDeliveryCount}</strong></article>
        <article><MapPinned size={18} /><span>Active zones</span><strong>{activeZoneCount}</strong></article>
      </div>

      <nav className="admin-subnav checkout-admin-subnav" aria-label="Checkout sections">
        <a href="#checkout-policy">Policy</a>
        <a href="#checkout-payments">Payments</a>
        <a href="#checkout-delivery-methods">Delivery methods</a>
        <a href="#checkout-zones">Zones and fees</a>
      </nav>

      <section className="admin-data-panel checkout-policy-panel" id="checkout-policy">
        <AdminSectionHeader
          title="Platform checkout policy"
          description="Set the defaults inherited by products unless product-specific checkout rules override them."
        />
        <form className="checkout-policy-form" onSubmit={savePlatformPolicy}>
          <div className="policy-control-card">
            <div className="policy-control-heading">
              <div>
                <span>Payment availability</span>
                <strong>Allowed payment methods</strong>
                <p>Only selected methods are offered by default at checkout.</p>
              </div>
              <div className="policy-mini-actions">
                <button type="button" onClick={() => setPolicyPaymentCodes(activePaymentCodes)}>All active</button>
                <button type="button" onClick={() => setPolicyPaymentCodes([])}>Clear</button>
              </div>
            </div>
            <div className="policy-choice-grid">
              {paymentMethods.map((method) => {
                const selected = policyPaymentCodes.includes(method.code);
                return (
                  <label className={`policy-choice${selected ? " is-selected" : ""}${method.isActive ? "" : " is-muted"}`} key={method.id}>
                    <input
                      name="allowedPaymentCodes"
                      type="checkbox"
                      value={method.code}
                      checked={selected}
                      onChange={() => togglePolicyPayment(method.code)}
                    />
                    <span>
                      <strong>{method.name}</strong>
                      <small>{method.isActive ? method.code : `${method.code} · inactive`}</small>
                    </span>
                    {selected ? <CheckCircle2 size={18} /> : null}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="policy-two-column">
            <div className="policy-control-card">
              <div className="policy-control-heading">
                <div>
                  <span>Advance collection</span>
                  <strong>Required upfront payment</strong>
                  <p>Set the minimum payment customers must pay before order confirmation.</p>
                </div>
              </div>
              <div className="policy-segment-group" role="radiogroup" aria-label="Required upfront payment">
                {[0, 20, 50, 100].map((percent) => (
                  <label className={policyAdvancePercent === percent ? "is-selected" : ""} key={percent}>
                    <input
                      name="requiredPaymentPercent"
                      type="radio"
                      value={percent}
                      checked={policyAdvancePercent === percent}
                      onChange={() => setPolicyAdvancePercent(percent)}
                    />
                    <strong>{percent === 0 ? "None" : `${percent}%`}</strong>
                    <small>{percent === 0 ? "No advance" : "Pay before order"}</small>
                  </label>
                ))}
              </div>
            </div>

            <label className={`policy-switch-card${policyRequireArea ? " is-selected" : ""}`}>
              <input
                name="requireKnownDeliveryArea"
                type="checkbox"
                checked={policyRequireArea}
                onChange={(event) => setPolicyRequireArea(event.target.checked)}
              />
              <span>
                <strong>Require delivery area</strong>
                <small>Customers must choose a service area before placing an order.</small>
              </span>
              <span className="policy-switch-knob" aria-hidden="true" />
            </label>
          </div>

          <div className="policy-control-card">
            <div className="policy-control-heading">
              <div>
                <span>Service coverage</span>
                <strong>Platform deliverable zones</strong>
                <p>Orders are accepted only inside selected zones when any zone is selected.</p>
              </div>
              <div className="policy-mini-actions">
                <button type="button" onClick={() => setPolicyZoneCodes(activeZoneCodes)}>All active</button>
                <button type="button" onClick={() => setPolicyZoneCodes([])}>Clear</button>
              </div>
            </div>
            <div className="policy-zone-grid">
              {catalog.deliveryZones.map((zone) => {
                const selected = policyZoneCodes.includes(zone.code);
                return (
                  <label className={`policy-zone-choice${selected ? " is-selected" : ""}${zone.isActive ? "" : " is-muted"}`} key={zone.id}>
                    <input
                      name="deliverableZoneCodes"
                      type="checkbox"
                      value={zone.code}
                      checked={selected}
                      onChange={() => togglePolicyZone(zone.code)}
                    />
                    <MapPinned size={17} />
                    <span>
                      <strong>{zone.name}</strong>
                      <small>{zone.city || zone.code}{zone.isActive ? "" : " · inactive"}</small>
                    </span>
                    {selected ? <CheckCircle2 size={17} /> : null}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="policy-save-row">
            <span>{policyPaymentCodes.length} payment methods · {policyZoneCodes.length || "All"} zones</span>
            <button className="primary-action" type="submit">Save platform rules</button>
          </div>
        </form>
      </section>

      <section className="admin-data-panel checkout-method-panel" id="checkout-payments">
        <AdminSectionHeader
          title="Payment methods"
          description="Keep the online payment group separate from gateway providers such as bKash, Nagad, and card."
        />
        <div className="checkout-admin-workspace payment-gateway-workspace">
          <form className="admin-editor-form checkout-editor-card" id="checkout-gateway-editor" onSubmit={savePaymentGateway} key={editingPaymentGateway?.id ?? "new-payment-gateway"}>
            <h3>{editingPaymentGateway ? `Edit ${editingPaymentGateway.name}` : "Add gateway connection"}</h3>
            <div className="form-grid">
              <label>Provider
                <select name="provider" defaultValue={editingPaymentGateway?.provider ?? "BKASH"}>
                  <option value="BKASH">bKash</option>
                  <option value="NAGAD">Nagad</option>
                  <option value="CARD">Card gateway</option>
                  <option value="OTHER">Other gateway</option>
                </select>
              </label>
              <label>Mode
                <select name="mode" defaultValue={editingPaymentGateway?.mode ?? "sandbox"}>
                  <option value="sandbox">Sandbox</option>
                  <option value="live">Live</option>
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>Code<input name="code" placeholder="BKASH_SANDBOX" defaultValue={editingPaymentGateway?.code ?? ""} required /></label>
              <label>Name<input name="name" placeholder="bKash sandbox" defaultValue={editingPaymentGateway?.name ?? ""} required /></label>
            </div>
            <label>Description<textarea name="description" placeholder="Used for tokenized checkout payments." defaultValue={editingPaymentGateway?.description ?? ""} /></label>
            <label>API base URL<input name="apiBaseUrl" placeholder="https://tokenized.sandbox.bka.sh/v1.2.0-beta" defaultValue={editingPaymentGateway?.apiBaseUrl ?? ""} /></label>
            <div className="form-grid">
              <label>App key<input name="appKey" placeholder={editingPaymentGateway?.appKey ? "Configured - leave blank to keep" : "Gateway app key"} /></label>
              <label>App secret<input name="appSecret" placeholder={editingPaymentGateway?.appSecret ? "Configured - leave blank to keep" : "Gateway app secret"} /></label>
            </div>
            <div className="form-grid">
              <label>Username<input name="username" placeholder={editingPaymentGateway?.username ? "Configured - leave blank to keep" : "Gateway username"} /></label>
              <label>Password<input name="password" type="password" placeholder={editingPaymentGateway?.password ? "Configured - leave blank to keep" : "Gateway password"} /></label>
            </div>
            <div className="form-grid">
              <label>Callback URL<input name="callbackUrl" placeholder="Frontend return URL" defaultValue={editingPaymentGateway?.callbackUrl ?? ""} /></label>
              <label>Webhook/IPN URL<input name="webhookUrl" placeholder="Backend webhook URL" defaultValue={editingPaymentGateway?.webhookUrl ?? ""} /></label>
            </div>
            <div className="form-grid">
              <label>Merchant ID<input name="merchantId" placeholder="Optional" defaultValue={editingPaymentGateway?.merchantId ?? ""} /></label>
              <label>Store ID<input name="storeId" placeholder="Optional" defaultValue={editingPaymentGateway?.storeId ?? ""} /></label>
            </div>
            <div className="form-grid">
              <label>Priority<input name="priority" type="number" defaultValue={editingPaymentGateway?.priority ?? 0} /></label>
              <label className="admin-check-row"><input name="isActive" type="checkbox" defaultChecked={editingPaymentGateway?.isActive ?? true} /> Available for payments</label>
            </div>
            <div className="admin-inline-actions">
              {editingPaymentGateway ? <button className="secondary-action" type="button" onClick={() => setEditingPaymentGateway(null)}>Cancel edit</button> : null}
              <button className="primary-action" type="submit">{editingPaymentGateway ? "Update gateway" : "Save gateway"}</button>
            </div>
          </form>

          <div className="checkout-method-list">
            {paymentGateways.length ? paymentGateways.map((gateway, index) => (
              <article key={gateway.id} className="checkout-method-card payment-gateway-card">
                <div className="admin-content-image payment-method-logo-frame"><ShieldCheck size={20} /></div>
                <div>
                  <strong>{gateway.name}</strong>
                  <p>{gateway.description || `${gateway.provider} ${gateway.mode} connection`}</p>
                  <small>
                    {gateway.provider} / {gateway.mode} / {gateway.credentialsConfigured ? "Credentials ready" : "Credentials missing"}
                    {gateway.envConfigured ? " / env fallback available" : ""}
                  </small>
                </div>
                <StatusBadge value={gateway.isActive ? "Active" : "Archived"} />
                <div className="admin-inline-actions">
                  <button type="button" onClick={() => editPaymentGateway(gateway)} title={`Edit ${gateway.name}`}><Pencil size={15} /></button>
                  <button type="button" onClick={() => void toggle("payment-gateways", gateway)}>{gateway.isActive ? "Disable" : "Enable"}</button>
                  <button type="button" onClick={() => void move("payment-gateways", paymentGateways, index, -1)} disabled={index === 0} title="Move up"><ChevronUp size={15} /></button>
                  <button type="button" onClick={() => void move("payment-gateways", paymentGateways, index, 1)} disabled={index === paymentGateways.length - 1} title="Move down"><ChevronDown size={15} /></button>
                  <button type="button" onClick={() => remove("payment-gateways", gateway.id, gateway.name)} title={`Delete ${gateway.name}`}><Trash2 size={15} /></button>
                </div>
              </article>
            )) : (
              <div className="empty-state compact">No gateway connection has been saved yet. bKash can still use the configured env credentials.</div>
            )}
          </div>
        </div>

        <div className="checkout-admin-workspace">
          <form className="admin-editor-form checkout-editor-card" id="checkout-payment-editor" onSubmit={savePaymentMethod} key={editingPaymentMethod?.id ?? "new-payment-method"}>
            <h3>{editingPaymentMethod ? `Edit ${editingPaymentMethod.name}` : "Add payment method"}</h3>
            <div className="form-grid">
              <label>Payment role
                <select name="paymentKind" defaultValue={paymentKindValue(editingPaymentMethod)}>
                  <option value="cash">Cash on delivery</option>
                  <option value="online_group">Online payment group</option>
                  <option value="gateway">Gateway provider</option>
                </select>
              </label>
              <label>Provider
                <select name="provider" defaultValue={paymentProviderValue(editingPaymentMethod)}>
                  <option value="cash">Cash / manual collection</option>
                  <option value="online">Online payment</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="card">Card</option>
                  <option value="other">Other gateway</option>
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>Code<input name="code" placeholder="BKASH" defaultValue={editingPaymentMethod?.code ?? ""} required /></label>
              <label>Display name<input name="name" placeholder="bKash" defaultValue={editingPaymentMethod?.name ?? ""} required /></label>
            </div>
            <label>Gateway connection
              <select name="paymentGatewayId" defaultValue={editingPaymentMethod?.paymentGatewayId ?? ""}>
                <option value="">Use provider/env default</option>
                {paymentGateways.map((gateway) => (
                  <option key={gateway.id} value={gateway.id}>{gateway.name} ({gateway.provider})</option>
                ))}
              </select>
            </label>
            <AdminUploadField label="Payment logo" value={image} onChange={setImage} onMessage={notifyUpload} recommendedDimensions="Transparent PNG or WebP, around 320 x 120 px" />
            <label>Customer note<textarea name="description" placeholder="Pay securely after order confirmation." defaultValue={editingPaymentMethod?.description ?? ""} /></label>
            <div className="form-grid">
              <label>Priority<input name="priority" type="number" defaultValue={editingPaymentMethod?.priority ?? 0} /></label>
              <label className="check-row"><input name="isActive" type="checkbox" defaultChecked={editingPaymentMethod?.isActive ?? true} /> Available at checkout</label>
            </div>
            <div className="admin-inline-actions">
              {editingPaymentMethod ? <button className="secondary-action" type="button" onClick={() => { setEditingPaymentMethod(null); setImage(""); }}>Cancel edit</button> : null}
              <button className="primary-action" type="submit">{editingPaymentMethod ? "Update payment method" : "Save payment method"}</button>
            </div>
          </form>

          <div className="checkout-method-list">
            {paymentMethods.map((method, index) => (
              <article key={method.id} className="checkout-method-card">
                <div className="admin-content-image payment-method-logo-frame">
                  {paymentLogoUrl(method) ? <img src={paymentLogoUrl(method)} alt="" /> : <CreditCard size={20} />}
                </div>
                <div>
                  <strong>{method.name}</strong>
                  <p>{method.description || method.code}</p>
                  <small>
                    {paymentKindValue(method).replace("_", " ")} / {paymentProviderValue(method)} / Priority {method.priority}
                    {method.paymentGateway ? ` / ${method.paymentGateway.name}` : ""}
                  </small>
                </div>
                <StatusBadge value={method.isActive ? "Active" : "Archived"} />
                <div className="admin-inline-actions">
                  <button type="button" onClick={() => editPaymentMethod(method)} title={`Edit ${method.name}`}><Pencil size={15} /></button>
                  <button type="button" onClick={() => void toggle("checkout-methods", method)}>{method.isActive ? "Disable" : "Enable"}</button>
                  <button type="button" onClick={() => void move("checkout-methods", paymentMethods, index, -1)} disabled={index === 0} title="Move up"><ChevronUp size={15} /></button>
                  <button type="button" onClick={() => void move("checkout-methods", paymentMethods, index, 1)} disabled={index === paymentMethods.length - 1} title="Move down"><ChevronDown size={15} /></button>
                  <button type="button" onClick={() => remove("checkout-methods", method.id, method.name)} title={`Delete ${method.name}`}><Trash2 size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-data-panel checkout-method-panel" id="checkout-delivery-methods">
        <AdminSectionHeader
          title="Delivery methods"
          description="Define service types, timings, and defaults. Area coverage and zone fees are managed below."
        />
        <div className="checkout-admin-workspace">
          <form className="admin-editor-form checkout-editor-card" id="checkout-delivery-method-editor" onSubmit={saveDeliveryMethod} key={editingDeliveryMethod?.id ?? "new-delivery-method"}>
            <h3>{editingDeliveryMethod ? `Edit ${editingDeliveryMethod.name}` : "Add delivery method"}</h3>
            <div className="form-grid">
              <label>Code<input name="code" placeholder="INSIDE_DHAKA" defaultValue={editingDeliveryMethod?.code ?? ""} required /></label>
              <label>Name<input name="name" placeholder="Inside Dhaka city" defaultValue={editingDeliveryMethod?.name ?? ""} required /></label>
            </div>
            <label>Description<textarea name="description" placeholder="Delivered by our local courier team." defaultValue={editingDeliveryMethod?.description ?? ""} /></label>
            <div className="form-grid">
              <label>Base fee<input name="fee" type="number" min="0" step="0.01" defaultValue={editingDeliveryMethod?.fee ?? 0} /></label>
              <label>Free above<input name="freeThreshold" type="number" min="0" step="0.01" defaultValue={editingDeliveryMethod?.freeThreshold ?? ""} /></label>
            </div>
            <div className="form-grid">
              <label>Min days<input name="minDeliveryDays" type="number" min="0" defaultValue={editingDeliveryMethod?.minDeliveryDays ?? ""} /></label>
              <label>Max days<input name="maxDeliveryDays" type="number" min="0" defaultValue={editingDeliveryMethod?.maxDeliveryDays ?? ""} /></label>
            </div>
            <div className="form-grid">
              <label>Priority<input name="priority" type="number" defaultValue={editingDeliveryMethod?.priority ?? 0} /></label>
              <label className="check-row"><input name="isActive" type="checkbox" defaultChecked={editingDeliveryMethod?.isActive ?? true} /> Available for delivery zones</label>
            </div>
            <div className="admin-inline-actions">
              {editingDeliveryMethod ? <button className="secondary-action" type="button" onClick={() => setEditingDeliveryMethod(null)}>Cancel edit</button> : null}
              <button className="primary-action" type="submit">{editingDeliveryMethod ? "Update delivery method" : "Save delivery method"}</button>
            </div>
          </form>

          <div className="checkout-method-list">
            {deliveryMethods.map((method, index) => (
              <article key={method.id} className="checkout-method-card">
                <div className="admin-content-image"><Truck size={20} /></div>
                <div>
                  <strong>{method.name}</strong>
                  <p>{method.description || method.code}</p>
                  <small>Base fee {method.fee} / Free above {method.freeThreshold ?? "none"} / Priority {method.priority}</small>
                </div>
                <StatusBadge value={method.isActive ? "Active" : "Archived"} />
                <div className="admin-inline-actions">
                  <button type="button" onClick={() => editDeliveryMethod(method)} title={`Edit ${method.name}`}><Pencil size={15} /></button>
                  <button type="button" onClick={() => void toggle("checkout-methods", method)}>{method.isActive ? "Disable" : "Enable"}</button>
                  <button type="button" onClick={() => void move("checkout-methods", deliveryMethods, index, -1)} disabled={index === 0} title="Move up"><ChevronUp size={15} /></button>
                  <button type="button" onClick={() => void move("checkout-methods", deliveryMethods, index, 1)} disabled={index === deliveryMethods.length - 1} title="Move down"><ChevronDown size={15} /></button>
                  <button type="button" onClick={() => remove("checkout-methods", method.id, method.name)} title={`Delete ${method.name}`}><Trash2 size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-data-panel checkout-zone-panel" id="checkout-zones">
        <AdminSectionHeader
          title="Delivery zones and fees"
          description="Create service areas, then attach delivery-method pricing to each zone."
        />
        <div className="delivery-zone-admin-grid" id="checkout-zone-editor">
          <form className="admin-editor-form checkout-editor-card" onSubmit={saveDeliveryZone} key={editingZone?.id ?? "new-zone"}>
            <h3>{editingZone ? `Edit ${editingZone.name}` : "Add delivery zone"}</h3>
            <label>Zone name<input name="name" placeholder="Dhaka city" defaultValue={editingZone?.name ?? ""} required /></label>
            <div className="form-grid">
              <label>Code<input name="code" placeholder="DHAKA" defaultValue={editingZone?.code ?? ""} required /></label>
              <label>City<input name="city" placeholder="Dhaka" defaultValue={editingZone?.city ?? ""} /></label>
            </div>
            <label>Areas<textarea name="areas" placeholder={"Dhanmondi\nGulshan\nBanani"} defaultValue={editingZone?.areas.join("\n") ?? ""} /></label>
            <label>Postal codes<textarea name="postalCodes" placeholder={"1209\n1212"} defaultValue={editingZone?.postalCodes.join("\n") ?? ""} /></label>
            <div className="form-grid">
              <label>Priority<input name="priority" type="number" defaultValue={editingZone?.priority ?? 0} /></label>
              <label className="check-row"><input name="isActive" type="checkbox" defaultChecked={editingZone?.isActive ?? true} /> Active</label>
            </div>
            <div className="admin-inline-actions">
              {editingZone ? <button className="secondary-action" type="button" onClick={() => setEditingZone(null)}>Cancel edit</button> : null}
              <button className="primary-action" type="submit">{editingZone ? "Update zone" : "Save zone"}</button>
            </div>
          </form>

          <form className="admin-editor-form checkout-editor-card" onSubmit={saveDeliveryRate} key={editingRate?.id ?? "new-rate"}>
            <h3>{editingRate ? "Edit zone rate" : "Add zone rate"}</h3>
            <label>Zone<select name="zoneId" required defaultValue={editingRate?.zoneId ?? catalog.deliveryZones[0]?.id ?? ""}>{catalog.deliveryZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
            <label>Delivery method<select name="deliveryMethodId" required defaultValue={editingRate?.deliveryMethodId ?? ""}>{deliveryMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label>
            <div className="form-grid">
              <label>Fee<input name="baseFee" type="number" min="0" step="0.01" defaultValue={editingRate?.baseFee ?? 80} /></label>
              <label>Free above<input name="freeThreshold" type="number" min="0" step="0.01" defaultValue={editingRate?.freeThreshold ?? ""} /></label>
            </div>
            <div className="form-grid">
              <label>Min days<input name="minDeliveryDays" type="number" min="0" defaultValue={editingRate?.minDeliveryDays ?? ""} /></label>
              <label>Max days<input name="maxDeliveryDays" type="number" min="0" defaultValue={editingRate?.maxDeliveryDays ?? ""} /></label>
            </div>
            <div className="form-grid">
              <label>Priority<input name="priority" type="number" defaultValue={editingRate?.priority ?? 0} /></label>
              <label className="check-row"><input name="isActive" type="checkbox" defaultChecked={editingRate?.isActive ?? true} /> Active</label>
            </div>
            <div className="admin-inline-actions">
              {editingRate ? <button className="secondary-action" type="button" onClick={() => setEditingRate(null)}>Cancel edit</button> : null}
              <button className="primary-action" type="submit">{editingRate ? "Update rate" : "Save rate"}</button>
            </div>
          </form>
        </div>
        <div className="delivery-zone-list">
          {catalog.deliveryZones.map((zone) => {
            const zoneRates = catalog.deliveryRates.filter((rate) => rate.zoneId === zone.id);
            return (
              <article key={zone.id} className="delivery-zone-card">
                <header>
                  <div className="admin-content-image"><Truck size={20} /></div>
                  <div>
                    <strong>{zone.name}</strong>
                    <p>{zone.city || zone.code} / {zone.areas.length} areas / {zoneRates.length} rates</p>
                    <small>{zone.code} / Priority {zone.priority}</small>
                  </div>
                  <StatusBadge value={zone.isActive ? "Active" : "Archived"} />
                  <div className="admin-inline-actions">
                    <button type="button" onClick={() => editDeliveryZone(zone)} title={`Edit ${zone.name}`}><Pencil size={15} /></button>
                    <button type="button" onClick={() => void toggle("delivery-zones", zone)}>{zone.isActive ? "Disable" : "Enable"}</button>
                    <button type="button" onClick={() => remove("delivery-zones", zone.id, zone.name)} title={`Delete ${zone.name}`}><Trash2 size={15} /></button>
                  </div>
                </header>
                <div className="delivery-zone-meta">
                  <span><strong>Areas</strong>{zone.areas.length ? zone.areas.join(", ") : "No areas listed"}</span>
                  <span><strong>Postal codes</strong>{zone.postalCodes.length ? zone.postalCodes.join(", ") : "No postal codes listed"}</span>
                </div>
                <div className="delivery-rate-list">
                  {zoneRates.length ? zoneRates.map((rate) => (
                    <div key={rate.id}>
                      <span>
                        <strong>{rate.deliveryMethod?.name ?? "Delivery method"}</strong>
                        <small>Fee {rate.baseFee} / Free above {rate.freeThreshold ?? "none"} / {rate.minDeliveryDays ?? 0}-{rate.maxDeliveryDays ?? rate.minDeliveryDays ?? 0} days</small>
                      </span>
                      <StatusBadge value={rate.isActive ? "Active" : "Archived"} />
                      <button type="button" onClick={() => editDeliveryRate(rate)} title="Edit rate"><Pencil size={14} /></button>
                      <button type="button" onClick={() => void toggle("delivery-rates", rate)}>{rate.isActive ? "Disable" : "Enable"}</button>
                      <button type="button" onClick={() => remove("delivery-rates", rate.id, `${zone.name} rate`)} title="Delete rate"><Trash2 size={14} /></button>
                    </div>
                  )) : <p className="muted-copy">No rates configured for this zone yet.</p>}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
