"use client";

import {
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  ImagePlus,
  Layers3,
  LayoutTemplate,
  ExternalLink,
  Eye,
  Monitor,
  PanelTop,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Store,
  Smartphone,
  Trash2,
  Truck
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminCatalog,
  Banner,
  Brand,
  Category,
  CheckoutMethod,
  DeliveryRate,
  DeliveryZone,
  HomeSection,
  InfoPageContent,
  Testimonial,
  createAdminResource,
  deleteAdminResource,
  fetchAdminCatalog,
  fetchInfoPages,
  updateAdminResource,
  updateInfoPage,
  updateSiteSettings
} from "../../lib/catalog";
import { useSiteSettings } from "../SiteSettingsContext";
import {
  AdminConfirmDialog,
  AdminError,
  AdminForm,
  AdminLoading,
  AdminPagination,
  AdminPageTitle,
  AdminSectionHeader,
  AdminToast,
  AdminUploadField,
  StatusBadge,
  useAdminToast
} from "./AdminShared";

type ContentMode = "identity" | "homepage" | "banners" | "brands" | "categories" | "testimonials" | "checkout" | "pages";
type Editable = HomeSection | (Banner & { isActive: boolean }) | Brand | Category | Testimonial | CheckoutMethod;
const contentPageSize = 8;

const modes: Array<{ id: ContentMode; label: string; icon: React.ReactNode }> = [
  { id: "identity", label: "Site identity", icon: <PanelTop size={17} /> },
  { id: "homepage", label: "Homepage", icon: <LayoutTemplate size={17} /> },
  { id: "banners", label: "Banners", icon: <ImagePlus size={17} /> },
  { id: "brands", label: "Brands", icon: <Store size={17} /> },
  { id: "categories", label: "Categories", icon: <Layers3 size={17} /> },
  { id: "testimonials", label: "Homepage reviews", icon: <Star size={17} /> },
  { id: "checkout", label: "Checkout methods", icon: <CreditCard size={17} /> },
  { id: "pages", label: "Info pages", icon: <FileText size={17} /> }
];

const infoPageTitles: Record<string, string> = {
  about: "About us",
  contact: "Contact us",
  delivery: "Delivery information",
  returns: "Returns and refunds",
  privacy: "Privacy policy",
  terms: "Terms and conditions"
};

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function isoDate(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function localDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function cleanMethodCode(value?: string | null) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function checkoutMethodMetadata(method?: CheckoutMethod | null) {
  return method?.metadata && typeof method.metadata === "object" ? method.metadata : {};
}

function paymentProviderValue(method?: CheckoutMethod | null) {
  const metadata = checkoutMethodMetadata(method);
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

function paymentKindValue(method?: CheckoutMethod | null) {
  const metadata = checkoutMethodMetadata(method);
  const kind = String(metadata.paymentKind ?? "").trim();
  if (kind) return kind;
  const code = cleanMethodCode(method?.code);
  if (code.includes("CASH") || code.includes("COD")) return "cash";
  if (code === "ONLINE_PAYMENT") return "online_group";
  return "gateway";
}

function scrollToAdminEditor(id: string) {
  window.requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

export function AdminContent() {
  const { setSettings } = useSiteSettings();
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [mode, setMode] = useState<ContentMode>("identity");
  const [editing, setEditing] = useState<Editable | null>(null);
  const [creating, setCreating] = useState(false);
  const [image, setImage] = useState("");
  const [siteLogo, setSiteLogo] = useState("");
  const [siteFavicon, setSiteFavicon] = useState("");
  const { message, kind: messageKind, notify } = useAdminToast();
  const [confirmTarget, setConfirmTarget] = useState<{ path: string; id: string; label: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [infoPages, setInfoPages] = useState<InfoPageContent[]>([]);
  const [editingPage, setEditingPage] = useState<InfoPageContent | null>(null);
  const [savingPage, setSavingPage] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [editingRate, setEditingRate] = useState<DeliveryRate | null>(null);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<CheckoutMethod | null>(null);
  const [editingDeliveryMethod, setEditingDeliveryMethod] = useState<CheckoutMethod | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextCatalog, nextInfoPages] = await Promise.all([fetchAdminCatalog(), fetchInfoPages()]);
      setCatalog(nextCatalog);
      setInfoPages(nextInfoPages);
      setSiteLogo(nextCatalog.siteSettings.logoUrl ?? "");
      setSiteFavicon(
        nextCatalog.siteSettings.faviconUrl ?? nextCatalog.siteSettings.logoUrl ?? ""
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Store content is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const applyLocation = () => {
      const requested = new URLSearchParams(window.location.search).get("content") as ContentMode | null;
      if (requested && modes.some((item) => item.id === requested)) setMode(requested);
    };
    applyLocation();
    window.addEventListener("popstate", applyLocation);
    return () => window.removeEventListener("popstate", applyLocation);
  }, [load]);
  useEffect(() => {
    setEditing(null);
    setCreating(false);
    setImage("");
    setEditingPage(null);
    setEditingZone(null);
    setEditingRate(null);
    setEditingPaymentMethod(null);
    setEditingDeliveryMethod(null);
  }, [mode]);

  const notifyUpload = useCallback(
    (text: string) => notify(text, /could not|failed|unavailable/i.test(text) ? "error" : "success"),
    [notify]
  );

  const selected = useMemo(() => editing, [editing]);

  function startEdit(item: Editable) {
    setEditing(item);
    setCreating(false);
    setImage(
      "imageUrl" in item ? item.imageUrl ?? "" :
      "logoUrl" in item ? item.logoUrl ?? "" :
      "avatarUrl" in item ? item.avatarUrl ?? "" : ""
    );
    scrollToAdminEditor("admin-content-editor");
  }

  function changeMode(next: ContentMode) {
    setMode(next);
    const url = new URL(window.location.href);
    if (next === "identity") url.searchParams.delete("content");
    else url.searchParams.set("content", next);
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setImage("");
    scrollToAdminEditor("admin-content-editor");
  }

  function editDeliveryZone(zone: DeliveryZone) {
    setEditingZone(zone);
    scrollToAdminEditor("admin-delivery-zone-editor");
  }

  function editDeliveryRate(rate: DeliveryRate) {
    setEditingRate(rate);
    scrollToAdminEditor("admin-delivery-zone-editor");
  }

  function editPaymentMethod(method: CheckoutMethod) {
    setEditingPaymentMethod(method);
    scrollToAdminEditor("admin-payment-method-editor");
  }

  function editDeliveryMethod(method: CheckoutMethod) {
    setEditingDeliveryMethod(method);
    scrollToAdminEditor("admin-delivery-method-editor");
  }

  function closeEditor() {
    setEditing(null);
    setCreating(false);
    setImage("");
  }

  function remove(path: string, id: string, label: string) {
    setConfirmTarget({ path, id, label });
  }

  async function performRemove() {
    if (!confirmTarget) return;
    const { path, id, label } = confirmTarget;
    try {
      await deleteAdminResource(path, id);
      setEditing(null);
      setEditingPaymentMethod(null);
      setEditingDeliveryMethod(null);
      setEditingZone(null);
      setEditingRate(null);
      notify(`${label} was removed.`);
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : `${label} could not be removed.`, "error");
    } finally {
      setConfirmTarget(null);
    }
  }

  async function toggle(path: string, item: Editable & { isActive?: boolean }) {
    try {
      await updateAdminResource(path, item.id, { isActive: !(item.isActive ?? true) });
      notify(`${"name" in item ? item.name : "title" in item ? item.title : "Item"} updated.`);
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Visibility could not be changed.", "error");
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

  async function save(path: Parameters<typeof createAdminResource>[0], payload: unknown) {
    if (editing) {
      await updateAdminResource(path, editing.id, payload);
    } else {
      await createAdminResource(path, payload);
    }
    setEditing(null);
    setCreating(false);
    setImage("");
    await load();
  }

  async function saveSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const items = value(form, "benefits")
      .split("\n")
      .map((line) => line.split("|").map((part) => part.trim()))
      .filter(([title, detail]) => title && detail)
      .map(([title, detail]) => ({ title, detail }));
    try {
      await save("home-sections", {
        key: value(form, "key"),
        type: value(form, "type"),
        eyebrow: value(form, "eyebrow"),
        title: value(form, "title"),
        subtitle: value(form, "subtitle"),
        ctaLabel: value(form, "ctaLabel"),
        ctaHref: value(form, "ctaHref"),
        imageUrl: image,
        collection: value(form, "collection"),
        productLimit: Number(form.get("productLimit") || 8),
        priority: Number(form.get("priority") || 0),
        isActive: form.get("isActive") === "on",
        metadata: {
          ...(selected && "metadata" in selected ? selected.metadata ?? {} : {}),
          announcement: value(form, "announcement"),
          items
        }
      });
      notify("Homepage section saved.");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Homepage section could not be saved.", "error");
    }
  }

  async function saveBanner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!image) return notify("Upload a campaign image first.", "error");
    try {
      await save("banners", {
        eyebrow: value(form, "eyebrow"),
        title: value(form, "title"),
        subtitle: value(form, "subtitle"),
        ctaLabel: value(form, "ctaLabel"),
        ctaHref: value(form, "ctaHref"),
        imageUrl: image,
        focalX: Number(form.get("focalX") || 50),
        focalY: Number(form.get("focalY") || 50),
        startsAt: isoDate(value(form, "startsAt")),
        endsAt: isoDate(value(form, "endsAt")),
        priority: Number(form.get("priority") || 0),
        isActive: form.get("isActive") === "on"
      });
      notify("Banner saved.");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Banner could not be saved.", "error");
    }
  }

  async function saveIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const settings = await updateSiteSettings({
        title: value(form, "title"),
        logoUrl: siteLogo,
        faviconUrl: siteFavicon,
        announcement: value(form, "announcement"),
        announcementLinkLabel: value(form, "announcementLinkLabel"),
        announcementLinkHref: value(form, "announcementLinkHref"),
        facebookUrl: value(form, "facebookUrl"),
        instagramUrl: value(form, "instagramUrl"),
        youtubeUrl: value(form, "youtubeUrl"),
        whatsappUrl: value(form, "whatsappUrl")
      });
      setSettings(settings);
      setCatalog((current) => current ? { ...current, siteSettings: settings } : current);
      notify("Website identity and topbar updated.");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Website identity could not be saved.", "error");
    }
  }

  async function saveBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await save("brands", {
        name: value(form, "name"),
        story: value(form, "story"),
        logoUrl: image,
        isActive: form.get("isActive") === "on"
      });
      notify("Brand saved.");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Brand could not be saved.", "error");
    }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await save("categories", {
        name: value(form, "name"),
        icon: value(form, "icon"),
        imageUrl: image,
        priority: Number(form.get("priority") || 0),
        isActive: form.get("isActive") === "on"
      });
      notify("Category saved.");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Category could not be saved.", "error");
    }
  }

  async function saveTestimonial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await save("testimonials", {
        name: value(form, "name"),
        role: value(form, "role"),
        quote: value(form, "quote"),
        rating: Number(form.get("rating") || 5),
        avatarUrl: image,
        priority: Number(form.get("priority") || 0),
        isActive: form.get("isActive") === "on"
      });
      notify("Customer story saved.");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Customer story could not be saved.", "error");
    }
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
      freeThreshold: undefined,
      minDeliveryDays: undefined,
      maxDeliveryDays: undefined,
      priority: Number(form.get("priority") || 0),
      isActive: form.get("isActive") === "on",
      metadata: {
        paymentKind,
        provider,
        settlement: paymentKind === "cash" ? "collect_on_delivery" : "gateway"
      }
    };
    try {
      if (editingPaymentMethod) await updateAdminResource("checkout-methods", editingPaymentMethod.id, payload);
      else await createAdminResource("checkout-methods", payload);
      notify(editingPaymentMethod ? "Payment method updated." : "Payment method saved.");
      setEditingPaymentMethod(null);
      await load();
      event.currentTarget.reset();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Payment method could not be saved.", "error");
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
      metadata: {
        deliveryKind: value(form, "deliveryKind") || "local_delivery"
      }
    };
    try {
      if (editingDeliveryMethod) await updateAdminResource("checkout-methods", editingDeliveryMethod.id, payload);
      else await createAdminResource("checkout-methods", payload);
      notify(editingDeliveryMethod ? "Delivery method updated." : "Delivery method saved.");
      setEditingDeliveryMethod(null);
      await load();
      event.currentTarget.reset();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Delivery method could not be saved.", "error");
    }
  }

  async function savePlatformCheckoutPolicy(event: FormEvent<HTMLFormElement>) {
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
      setCatalog({ ...catalog, siteSettings: updated });
      notify("Platform checkout policy saved.");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Platform checkout policy could not be saved.", "error");
    }
  }

  async function saveDeliveryZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalog) return;
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
      event.currentTarget.reset();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Delivery zone could not be saved.", "error");
    }
  }

  async function saveDeliveryRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalog) return;
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
      event.currentTarget.reset();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Delivery rate could not be saved.", "error");
    }
  }

  async function toggleDeliveryZone(zone: DeliveryZone) {
    try {
      await updateAdminResource("delivery-zones", zone.id, { isActive: !zone.isActive });
      notify(`${zone.name} updated.`);
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Delivery zone could not be updated.", "error");
    }
  }

  async function toggleDeliveryRate(rate: DeliveryRate) {
    try {
      await updateAdminResource("delivery-rates", rate.id, { isActive: !rate.isActive });
      notify("Delivery rate updated.");
      await load();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Delivery rate could not be updated.", "error");
    }
  }

  async function savePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPage) return;
    const form = new FormData(event.currentTarget);
    const points = value(form, "points")
      .split("\n")
      .map((line) => line.split("|").map((part) => part.trim()))
      .filter(([title, detail]) => title && detail)
      .map(([title, detail]) => ({ title, detail }));
    setSavingPage(true);
    try {
      const updated = await updateInfoPage(editingPage.slug, {
        eyebrow: value(form, "eyebrow"),
        title: value(form, "title"),
        intro: value(form, "intro"),
        points
      });
      setInfoPages((current) => current.map((page) => page.slug === updated.slug ? updated : page));
      setEditingPage(null);
      notify(`${infoPageTitles[updated.slug] ?? updated.slug} updated.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Page could not be saved.", "error");
    } finally {
      setSavingPage(false);
    }
  }

  if (loading && !catalog) return <AdminLoading label="Loading storefront content..." />;
  if (error && !catalog) return <AdminError message={error} retry={() => void load()} />;
  if (!catalog) return null;

  const paymentCheckoutMethods = catalog.checkoutMethods.filter((method) => method.type === "PAYMENT");
  const deliveryCheckoutMethods = catalog.checkoutMethods.filter((method) => method.type === "DELIVERY");
  const paymentProviderRows = paymentCheckoutMethods.filter((method) => paymentKindValue(method) !== "online_group");
  const onlineGatewayRows = paymentProviderRows.filter((method) => paymentKindValue(method) === "gateway");
  const cashRows = paymentProviderRows.filter((method) => paymentKindValue(method) === "cash");

  const countFor = (id: ContentMode) =>
    id === "identity" ? 1 :
    id === "homepage" ? catalog.homeSections.length :
    id === "banners" ? catalog.banners.length :
    id === "brands" ? catalog.brands.length :
    id === "categories" ? catalog.categories.length :
    id === "testimonials" ? catalog.testimonials.length :
    id === "pages" ? infoPages.length :
    paymentCheckoutMethods.length + deliveryCheckoutMethods.length + catalog.deliveryZones.length;

  return (
    <div className="admin-page">
      <AdminPageTitle
        eyebrow="Storefront management"
        title="Storefront"
        description="Manage identity, homepage content, taxonomy, reviews, and checkout options."
        actions={
          <>
            <button className="admin-icon-button" type="button" onClick={() => setPreviewOpen((current) => !current)} title="Preview storefront"><Eye size={17} /></button>
            <button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh content"><RefreshCw size={17} /></button>
          </>
        }
      />
      <div className="admin-content-tabs" role="tablist" aria-label="Content types">
        {modes.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            className={mode === item.id ? "active" : ""}
            onClick={() => changeMode(item.id)}
          >
            {item.icon} {item.label} <span>{countFor(item.id)}</span>
          </button>
        ))}
      </div>
      <AdminToast message={message} kind={messageKind} />

      {previewOpen ? (
        <section className="admin-storefront-preview">
          <header>
            <div>
              <strong>Live storefront preview</strong>
              <span>Changes appear after they are saved.</span>
            </div>
            <div className="admin-preview-controls">
              <button type="button" className={previewViewport === "desktop" ? "active" : ""} onClick={() => setPreviewViewport("desktop")} title="Desktop preview"><Monitor size={16} /></button>
              <button type="button" className={previewViewport === "mobile" ? "active" : ""} onClick={() => setPreviewViewport("mobile")} title="Mobile preview"><Smartphone size={16} /></button>
              <button type="button" onClick={() => setPreviewKey((current) => current + 1)} title="Reload preview"><RefreshCw size={16} /></button>
              <a href="/" target="_blank" rel="noreferrer" title="Open storefront"><ExternalLink size={16} /></a>
            </div>
          </header>
          <div className={`admin-preview-frame ${previewViewport}`}>
            <iframe key={previewKey} src="/" title="Storefront preview" />
          </div>
        </section>
      ) : null}

      {mode === "identity" ? (
        <div className="admin-content-grid identity-content-grid">
          <section>
            <AdminSectionHeader
              title="Website identity"
              description="These details are shared by the storefront header, topbar, footer, and browser title."
            />
            <div className="admin-identity-preview">
              {siteLogo ? <img src={siteLogo} alt="" /> : <span>{catalog.siteSettings.title.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>}
              <div>
                <strong>{catalog.siteSettings.title}</strong>
                <p>{catalog.siteSettings.announcement}</p>
                <small>{catalog.siteSettings.announcementLinkLabel}</small>
              </div>
            </div>
          </section>
          <AdminForm title="Edit website identity" onSubmit={saveIdentity} submitLabel="Save identity">
            <label>Website title<input name="title" defaultValue={catalog.siteSettings.title} required /></label>
            <AdminUploadField label="Website logo" value={siteLogo} onChange={setSiteLogo} onMessage={notifyUpload} recommendedDimensions="600 x 240 px, transparent background" />
            <AdminUploadField label="Browser favicon" value={siteFavicon} onChange={setSiteFavicon} onMessage={notifyUpload} recommendedDimensions="512 x 512 px, square transparent PNG or WebP" />
            <label>Topbar announcement<input name="announcement" defaultValue={catalog.siteSettings.announcement} required /></label>
            <div className="form-grid">
              <label>Topbar link label<input name="announcementLinkLabel" defaultValue={catalog.siteSettings.announcementLinkLabel} required /></label>
              <label>Topbar link destination<input name="announcementLinkHref" defaultValue={catalog.siteSettings.announcementLinkHref} required /></label>
            </div>
            <fieldset className="admin-social-fields">
              <legend>Social media links</legend>
              <p>Add the full public URL for each account. Leave a channel empty to hide it from the footer.</p>
              <div className="form-grid">
                <label>Facebook URL<input name="facebookUrl" type="url" defaultValue={catalog.siteSettings.facebookUrl ?? ""} placeholder="https://facebook.com/your-page" /></label>
                <label>Instagram URL<input name="instagramUrl" type="url" defaultValue={catalog.siteSettings.instagramUrl ?? ""} placeholder="https://instagram.com/your-account" /></label>
                <label>YouTube URL<input name="youtubeUrl" type="url" defaultValue={catalog.siteSettings.youtubeUrl ?? ""} placeholder="https://youtube.com/@your-channel" /></label>
                <label>WhatsApp URL<input name="whatsappUrl" type="url" defaultValue={catalog.siteSettings.whatsappUrl ?? ""} placeholder="https://wa.me/8801XXXXXXXXX" /></label>
              </div>
            </fieldset>
          </AdminForm>
        </div>
      ) : null}

      {mode === "homepage" ? (
        <ContentLayout
          title="Homepage sections"
          description="Lower priority values appear first. Hidden sections remain editable."
          items={catalog.homeSections}
          editorOpen={creating || Boolean(editing)}
          createLabel="Add section"
          onCreate={startCreate}
          onClose={closeEditor}
          render={(section, index) => (
            <>
              <div className="admin-content-image"><LayoutTemplate size={20} /></div>
              <div><strong>{section.title}</strong><p>{section.type.replace(/_/g, " ")} · {section.key}</p><small>Priority {section.priority} · Limit {section.productLimit}</small></div>
              <ContentActions
                item={section}
                edit={() => startEdit(section)}
                toggle={() => void toggle("home-sections", section)}
                remove={() => void remove("home-sections", section.id, section.title)}
                moveUp={index > 0 ? () => void move("home-sections", catalog.homeSections, index, -1) : undefined}
                moveDown={index < catalog.homeSections.length - 1 ? () => void move("home-sections", catalog.homeSections, index, 1) : undefined}
              />
            </>
          )}
          form={
            <AdminForm key={editing?.id ?? "new-section"} title={editing ? "Edit section" : "Create section"} onSubmit={saveSection} submitLabel="Save section">
              <div className="form-grid"><label>Key<input name="key" defaultValue={selected && "key" in selected ? selected.key : ""} required /></label><label>Type<select name="type" defaultValue={selected && "type" in selected ? selected.type : "PRODUCT_SHELF"}><option>TRUST</option><option>CATEGORIES</option><option>PRODUCT_SHELF</option><option>PROMO</option><option>BRANDS</option><option>TESTIMONIALS</option></select></label></div>
              <label>Eyebrow<input name="eyebrow" defaultValue={selected && "eyebrow" in selected ? selected.eyebrow ?? "" : ""} /></label>
              <label>Title<input name="title" defaultValue={selected && "title" in selected ? selected.title : ""} required /></label>
              <label>Supporting copy<textarea name="subtitle" defaultValue={selected && "subtitle" in selected ? selected.subtitle ?? "" : ""} /></label>
              <div className="form-grid"><label>Button label<input name="ctaLabel" defaultValue={selected && "ctaLabel" in selected ? selected.ctaLabel ?? "" : ""} /></label><label>Button link<input name="ctaHref" defaultValue={selected && "ctaHref" in selected ? selected.ctaHref ?? "" : ""} /></label></div>
              <div className="form-grid"><label>Collection<select name="collection" defaultValue={selected && "collection" in selected ? selected.collection ?? "" : ""}><option value="">None</option><option>topSellingProducts</option><option>newlyLaunched</option><option>trendingProducts</option><option>comboDeals</option><option>certifiedProducts</option><option>justForYou</option><option>categoryShowcase</option></select></label><label>Product limit<input name="productLimit" type="number" min="0" defaultValue={selected && "productLimit" in selected ? selected.productLimit : 8} /></label></div>
              <div className="form-grid"><label>Priority<input name="priority" type="number" defaultValue={selected && "priority" in selected ? selected.priority : 0} /></label><label className="check-row"><input name="isActive" type="checkbox" defaultChecked={selected && "isActive" in selected ? selected.isActive : true} /> Published</label></div>
              <label>Announcement<input name="announcement" defaultValue={selected && "metadata" in selected ? (selected as HomeSection).metadata?.announcement ?? "" : ""} /></label>
              <label>Trust benefits<textarea name="benefits" placeholder={"Carefully selected | Trusted suppliers\nFlexible delivery | Choose what fits your day"} defaultValue={selected && "metadata" in selected ? (selected as HomeSection).metadata?.items?.map((item) => `${item.title} | ${item.detail}`).join("\n") ?? "" : ""} /></label>
              <AdminUploadField label="Section image" value={image} onChange={setImage} onMessage={notifyUpload} recommendedDimensions="1600 x 700 px" />
            </AdminForm>
          }
        />
      ) : null}

      {mode === "banners" ? (
        <ContentLayout title="Campaign banners" description="Active banners rotate in the homepage hero." items={catalog.banners} editorOpen={creating || Boolean(editing)} createLabel="Add banner" onCreate={startCreate} onClose={closeEditor} render={(banner, index) => (
          <><div className="admin-content-image">{banner.imageUrl ? <img src={banner.imageUrl} alt="" /> : <ImagePlus size={22} />}</div><div><strong>{banner.title}</strong><p>{banner.subtitle}</p><small>Priority {banner.priority} · {banner.ctaLabel}</small></div><ContentActions item={banner} edit={() => startEdit(banner)} toggle={() => void toggle("banners", banner)} remove={() => void remove("banners", banner.id, banner.title)} moveUp={index > 0 ? () => void move("banners", catalog.banners, index, -1) : undefined} moveDown={index < catalog.banners.length - 1 ? () => void move("banners", catalog.banners, index, 1) : undefined} /></>
        )} form={
          <AdminForm key={editing?.id ?? "new-banner"} title={editing ? "Edit banner" : "Create banner"} onSubmit={saveBanner} submitLabel="Save banner">
            <label>Eyebrow<input name="eyebrow" defaultValue={selected && "eyebrow" in selected ? selected.eyebrow ?? "" : ""} placeholder="Everyday pantry market" /></label>
            <label>Title<input name="title" defaultValue={selected && "title" in selected ? selected.title : ""} required /></label><label>Supporting copy<textarea name="subtitle" defaultValue={selected && "subtitle" in selected ? selected.subtitle ?? "" : ""} required /></label>
            <div className="form-grid"><label>Button label<input name="ctaLabel" defaultValue={selected && "ctaLabel" in selected ? selected.ctaLabel ?? "" : ""} required /></label><label>Button link<input name="ctaHref" defaultValue={selected && "ctaHref" in selected ? selected.ctaHref ?? "" : "/shop"} required /></label></div>
            <div className="form-grid"><label>Start publishing<input name="startsAt" type="datetime-local" defaultValue={selected && "startsAt" in selected ? localDate(selected.startsAt) : ""} /></label><label>Stop publishing<input name="endsAt" type="datetime-local" defaultValue={selected && "endsAt" in selected ? localDate(selected.endsAt) : ""} /></label></div>
            <div className="form-grid"><label>Horizontal focal point (%)<input name="focalX" type="number" min="0" max="100" defaultValue={selected && "focalX" in selected ? selected.focalX ?? 50 : 50} /></label><label>Vertical focal point (%)<input name="focalY" type="number" min="0" max="100" defaultValue={selected && "focalY" in selected ? selected.focalY ?? 50 : 50} /></label></div>
            <label>Priority<input name="priority" type="number" defaultValue={selected && "priority" in selected ? selected.priority : 0} /></label><label className="check-row"><input name="isActive" type="checkbox" defaultChecked={selected && "isActive" in selected ? selected.isActive : true} /> Published</label>
            <AdminUploadField label="Banner image" value={image} onChange={setImage} onMessage={notifyUpload} recommendedDimensions="1920 x 720 px" />
          </AdminForm>
        } />
      ) : null}

      {mode === "brands" ? (
        <ContentLayout title="Brands" description="Products can be assigned to a brand or remain independent." items={catalog.brands} editorOpen={creating || Boolean(editing)} createLabel="Add brand" onCreate={startCreate} onClose={closeEditor} render={(brand) => (
          <><div className="admin-content-image">{brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : <Store size={21} />}</div><div><strong>{brand.name}</strong><p>{brand.story || "No brand story."}</p></div><ContentActions item={brand} edit={() => startEdit(brand)} toggle={() => void toggle("brands", brand)} remove={() => void remove("brands", brand.id, brand.name)} /></>
        )} form={
          <AdminForm key={editing?.id ?? "new-brand"} title={editing ? "Edit brand" : "Create brand"} onSubmit={saveBrand} submitLabel="Save brand"><label>Brand name<input name="name" defaultValue={selected && "name" in selected ? selected.name : ""} required /></label><AdminUploadField label="Brand logo" value={image} onChange={setImage} onMessage={notifyUpload} recommendedDimensions="600 x 300 px, transparent background" /><label>Brand story<textarea name="story" defaultValue={selected && "story" in selected ? selected.story ?? "" : ""} /></label><label className="check-row"><input name="isActive" type="checkbox" defaultChecked={selected && "isActive" in selected ? selected.isActive ?? true : true} /> Active</label></AdminForm>
        } />
      ) : null}

      {mode === "categories" ? (
        <ContentLayout title="Categories" description="Priority controls navigation and homepage order." items={catalog.categories} editorOpen={creating || Boolean(editing)} createLabel="Add category" onCreate={startCreate} onClose={closeEditor} render={(category, index) => (
          <><div className="admin-content-image">{category.imageUrl ? <img src={category.imageUrl} alt="" /> : <Layers3 size={20} />}</div><div><strong>{category.name}</strong><p>/{category.slug}</p><small>{category.icon || "No icon label"} · Priority {category.priority}</small></div><ContentActions item={category} edit={() => startEdit(category)} toggle={() => void toggle("categories", category)} remove={() => void remove("categories", category.id, category.name)} moveUp={index > 0 ? () => void move("categories", catalog.categories, index, -1) : undefined} moveDown={index < catalog.categories.length - 1 ? () => void move("categories", catalog.categories, index, 1) : undefined} /></>
        )} form={
          <AdminForm key={editing?.id ?? "new-category"} title={editing ? "Edit category" : "Create category"} onSubmit={saveCategory} submitLabel="Save category"><label>Category name<input name="name" defaultValue={selected && "name" in selected ? selected.name : ""} required /></label><AdminUploadField label="Category image" value={image} onChange={setImage} onMessage={notifyUpload} recommendedDimensions="600 x 600 px, clean centered subject" /><label>Fallback icon label<input name="icon" defaultValue={selected && "icon" in selected ? selected.icon ?? "" : ""} /></label><label>Priority<input name="priority" type="number" defaultValue={selected && "priority" in selected ? selected.priority : 0} /></label><label className="check-row"><input name="isActive" type="checkbox" defaultChecked={selected && "isActive" in selected ? selected.isActive ?? true : true} /> Active</label></AdminForm>
        } />
      ) : null}

      {mode === "testimonials" ? (
        <ContentLayout title="Homepage reviews" description="Add admin-curated reviews here. Approved customer product reviews can be showcased from Growth." items={catalog.testimonials} editorOpen={creating || Boolean(editing)} createLabel="Add review" onCreate={startCreate} onClose={closeEditor} render={(item, index) => (
          <><div className="admin-content-image">{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : <Star size={20} />}</div><div><strong>{item.name}</strong><p>{item.quote}</p><small>{item.rating}/5 · Priority {item.priority}</small></div><ContentActions item={item} edit={() => startEdit(item)} toggle={() => void toggle("testimonials", item)} remove={() => void remove("testimonials", item.id, item.name)} moveUp={index > 0 ? () => void move("testimonials", catalog.testimonials, index, -1) : undefined} moveDown={index < catalog.testimonials.length - 1 ? () => void move("testimonials", catalog.testimonials, index, 1) : undefined} /></>
        )} form={
          <AdminForm key={editing?.id ?? "new-testimonial"} title={editing ? "Edit curated review" : "Add curated review"} onSubmit={saveTestimonial} submitLabel="Save review"><div className="form-grid"><label>Customer name<input name="name" defaultValue={selected && "name" in selected ? selected.name : ""} required /></label><label>Customer role or location<input name="role" defaultValue={selected && "role" in selected ? selected.role ?? "" : ""} /></label></div><label>Review<textarea name="quote" defaultValue={selected && "quote" in selected ? selected.quote : ""} required /></label><div className="form-grid"><label>Rating<input name="rating" type="number" min="1" max="5" defaultValue={selected && "rating" in selected ? selected.rating : 5} /></label><label>Homepage order<input name="priority" type="number" defaultValue={selected && "priority" in selected ? selected.priority : 0} /></label></div><AdminUploadField label="Customer photo" value={image} onChange={setImage} onMessage={notifyUpload} recommendedDimensions="600 x 600 px" /><label className="check-row"><input name="isActive" type="checkbox" defaultChecked={selected && "isActive" in selected ? selected.isActive : true} /> Show on homepage</label></AdminForm>
        } />
      ) : null}

      {mode === "checkout" ? (
        <>
          <section className="admin-data-panel checkout-policy-panel">
            <AdminSectionHeader title="Platform checkout policy" description="Defaults inherited by every product unless a product has its own checkout rules." />
            <form className="admin-editor-form" onSubmit={savePlatformCheckoutPolicy}>
              <label>Allowed payment methods
                <select name="allowedPaymentCodes" multiple defaultValue={catalog.siteSettings.checkoutPolicy?.allowedPaymentCodes ?? []}>
                  {catalog.checkoutMethods.filter((method) => method.type === "PAYMENT").map((method) => <option key={method.id} value={method.code}>{method.name}</option>)}
                </select>
              </label>
              <div className="form-grid">
                <label>Required upfront payment
                  <select name="requiredPaymentPercent" defaultValue={catalog.siteSettings.checkoutPolicy?.requiredPaymentPercent ?? 0}>
                    <option value="0">No upfront payment</option>
                    <option value="20">20% upfront</option>
                    <option value="50">50% upfront</option>
                    <option value="100">100% upfront</option>
                  </select>
                </label>
                <label className="check-row"><input name="requireKnownDeliveryArea" type="checkbox" defaultChecked={Boolean(catalog.siteSettings.checkoutPolicy?.requireKnownDeliveryArea)} /> Require delivery area before checkout</label>
              </div>
              <label>Platform deliverable zones
                <select name="deliverableZoneCodes" multiple defaultValue={catalog.siteSettings.checkoutPolicy?.deliverableZoneCodes ?? []}>
                  {catalog.deliveryZones.map((zone) => <option key={zone.id} value={zone.code}>{zone.name}</option>)}
                </select>
              </label>
              <button className="primary-action" type="submit">Save platform rules</button>
            </form>
          </section>

          <section className="admin-data-panel checkout-zone-panel" id="admin-delivery-zone-editor">
            <AdminSectionHeader
              title="Delivery zones and fees"
              description="Manage service areas, delivery coverage, and zone-specific pricing without creating duplicate rows."
            />
            <div className="delivery-zone-admin-grid">
              <form className="admin-editor-form" onSubmit={saveDeliveryZone} key={editingZone?.id ?? "new-zone"}>
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
              <form className="admin-editor-form" onSubmit={saveDeliveryRate} key={editingRate?.id ?? "new-rate"}>
                <h3>{editingRate ? "Edit zone rate" : "Add zone rate"}</h3>
                <label>Zone<select name="zoneId" required defaultValue={editingRate?.zoneId ?? catalog.deliveryZones[0]?.id ?? ""}>{catalog.deliveryZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
                <label>Delivery method<select name="deliveryMethodId" required defaultValue={editingRate?.deliveryMethodId ?? ""}>{catalog.checkoutMethods.filter((method) => method.type === "DELIVERY").map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label>
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
                        <p>{zone.city || zone.code} / {zone.areas.length} areas / {zone.postalCodes.length} postal codes</p>
                        <small>{zone.code} / Priority {zone.priority}</small>
                      </div>
                      <StatusBadge value={zone.isActive ? "Active" : "Archived"} />
                      <div className="admin-inline-actions">
                        <button type="button" onClick={() => editDeliveryZone(zone)} title={`Edit ${zone.name}`}><Pencil size={15} /></button>
                        <button type="button" onClick={() => void toggleDeliveryZone(zone)}>{zone.isActive ? "Disable" : "Enable"}</button>
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
                            <small>
                              Fee {rate.baseFee} / Free above {rate.freeThreshold ?? "none"} / {rate.minDeliveryDays ?? 0}-{rate.maxDeliveryDays ?? rate.minDeliveryDays ?? 0} days
                            </small>
                          </span>
                          <StatusBadge value={rate.isActive ? "Active" : "Archived"} />
                          <button type="button" onClick={() => editDeliveryRate(rate)} title="Edit rate"><Pencil size={14} /></button>
                          <button type="button" onClick={() => void toggleDeliveryRate(rate)}>{rate.isActive ? "Disable" : "Enable"}</button>
                          <button type="button" onClick={() => remove("delivery-rates", rate.id, `${zone.name} rate`)} title="Delete rate"><Trash2 size={14} /></button>
                        </div>
                      )) : <p className="muted-copy">No rates configured for this zone yet.</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="admin-data-panel checkout-method-panel" id="admin-payment-method-editor">
            <AdminSectionHeader
              title="Payment methods"
              description="Manage cash collection, the online payment group, and gateway providers separately."
            />
            <div className="checkout-method-admin-grid">
              <form className="admin-editor-form" onSubmit={savePaymentMethod} key={editingPaymentMethod?.id ?? "new-payment-method"}>
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
                <label>Customer note<textarea name="description" placeholder="Pay securely after order confirmation." defaultValue={editingPaymentMethod?.description ?? ""} /></label>
                <div className="form-grid">
                  <label>Priority<input name="priority" type="number" defaultValue={editingPaymentMethod?.priority ?? 0} /></label>
                  <label className="check-row"><input name="isActive" type="checkbox" defaultChecked={editingPaymentMethod?.isActive ?? true} /> Available at checkout</label>
                </div>
                <div className="admin-inline-actions">
                  {editingPaymentMethod ? <button className="secondary-action" type="button" onClick={() => setEditingPaymentMethod(null)}>Cancel edit</button> : null}
                  <button className="primary-action" type="submit">{editingPaymentMethod ? "Update payment method" : "Save payment method"}</button>
                </div>
              </form>
              <div className="checkout-method-list">
                <div className="checkout-method-summary">
                  <article><strong>{cashRows.length}</strong><span>Cash methods</span></article>
                  <article><strong>{onlineGatewayRows.length}</strong><span>Online gateways</span></article>
                  <article><strong>{paymentCheckoutMethods.filter((method) => method.isActive).length}</strong><span>Active payments</span></article>
                </div>
                {paymentCheckoutMethods.map((method, index) => (
                  <article key={method.id} className="checkout-method-card">
                    <div className="admin-content-image"><CreditCard size={20} /></div>
                    <div>
                      <strong>{method.name}</strong>
                      <p>{method.description || method.code}</p>
                      <small>{paymentKindValue(method).replace("_", " ")} / {paymentProviderValue(method)} / Priority {method.priority}</small>
                    </div>
                    <StatusBadge value={method.isActive ? "Active" : "Archived"} />
                    <div className="admin-inline-actions">
                      <button type="button" onClick={() => editPaymentMethod(method)} title={`Edit ${method.name}`}><Pencil size={15} /></button>
                      <button type="button" onClick={() => void toggle("checkout-methods", method)}>{method.isActive ? "Disable" : "Enable"}</button>
                      <button type="button" onClick={() => void move("checkout-methods", paymentCheckoutMethods, index, -1)} disabled={index === 0} title="Move up"><ChevronUp size={15} /></button>
                      <button type="button" onClick={() => void move("checkout-methods", paymentCheckoutMethods, index, 1)} disabled={index === paymentCheckoutMethods.length - 1} title="Move down"><ChevronDown size={15} /></button>
                      <button type="button" onClick={() => remove("checkout-methods", method.id, method.name)} title={`Delete ${method.name}`}><Trash2 size={15} /></button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="admin-data-panel checkout-method-panel" id="admin-delivery-method-editor">
            <AdminSectionHeader
              title="Delivery methods"
              description="Define delivery service types here. Zone fees and area coverage stay in Delivery zones and fees."
            />
            <div className="checkout-method-admin-grid">
              <form className="admin-editor-form" onSubmit={saveDeliveryMethod} key={editingDeliveryMethod?.id ?? "new-delivery-method"}>
                <h3>{editingDeliveryMethod ? `Edit ${editingDeliveryMethod.name}` : "Add delivery method"}</h3>
                <div className="form-grid">
                  <label>Code<input name="code" placeholder="INSIDE_DHAKA" defaultValue={editingDeliveryMethod?.code ?? ""} required /></label>
                  <label>Name<input name="name" placeholder="Inside Dhaka city" defaultValue={editingDeliveryMethod?.name ?? ""} required /></label>
                </div>
                <label>Description<textarea name="description" placeholder="Delivered by our local courier team." defaultValue={editingDeliveryMethod?.description ?? ""} /></label>
                <input type="hidden" name="deliveryKind" value="local_delivery" />
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
                {deliveryCheckoutMethods.map((method, index) => (
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
                      <button type="button" onClick={() => void move("checkout-methods", deliveryCheckoutMethods, index, -1)} disabled={index === 0} title="Move up"><ChevronUp size={15} /></button>
                      <button type="button" onClick={() => void move("checkout-methods", deliveryCheckoutMethods, index, 1)} disabled={index === deliveryCheckoutMethods.length - 1} title="Move down"><ChevronDown size={15} /></button>
                      <button type="button" onClick={() => remove("checkout-methods", method.id, method.name)} title={`Delete ${method.name}`}><Trash2 size={15} /></button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        {null}
        {/*
          <><div className="admin-content-image">{item.type === "PAYMENT" ? <CreditCard size={20} /> : <Truck size={20} />}</div><div><strong>{item.name}</strong><p>{item.description || item.code}</p><small>{item.type} · Fee {item.fee} · Priority {item.priority}</small></div><ContentActions item={item} edit={() => startEdit(item)} toggle={() => void toggle("checkout-methods", item)} remove={() => void remove("checkout-methods", item.id, item.name)} moveUp={index > 0 ? () => void move("checkout-methods", catalog.checkoutMethods, index, -1) : undefined} moveDown={index < catalog.checkoutMethods.length - 1 ? () => void move("checkout-methods", catalog.checkoutMethods, index, 1) : undefined} /></>
        )} form={
          <AdminForm key={editing?.id ?? "new-method"} title={editing ? "Edit checkout method" : "Add checkout method"} onSubmit={saveCheckoutMethod} submitLabel="Save method"><div className="form-grid"><label>Type<select name="type" defaultValue={selected && "type" in selected ? selected.type : "DELIVERY"}><option>DELIVERY</option><option>PAYMENT</option></select></label><label>Code<input name="code" defaultValue={selected && "code" in selected ? selected.code : ""} required /></label></div><label>Name<input name="name" defaultValue={selected && "name" in selected ? selected.name : ""} required /></label><label>Description<textarea name="description" defaultValue={selected && "description" in selected ? selected.description ?? "" : ""} /></label><div className="form-grid"><label>Fee<input name="fee" type="number" min="0" step="0.01" defaultValue={selected && "fee" in selected ? selected.fee : 0} /></label><label>Free above<input name="freeThreshold" type="number" min="0" step="0.01" defaultValue={selected && "freeThreshold" in selected ? selected.freeThreshold ?? "" : ""} /></label></div><div className="form-grid"><label>Minimum days<input name="minDeliveryDays" type="number" min="0" defaultValue={selected && "minDeliveryDays" in selected ? selected.minDeliveryDays ?? "" : ""} /></label><label>Maximum days<input name="maxDeliveryDays" type="number" min="0" defaultValue={selected && "maxDeliveryDays" in selected ? selected.maxDeliveryDays ?? "" : ""} /></label></div><label>Priority<input name="priority" type="number" defaultValue={selected && "priority" in selected ? selected.priority : 0} /></label><label className="check-row"><input name="isActive" type="checkbox" defaultChecked={selected && "isActive" in selected ? selected.isActive : true} /> Enabled at checkout</label></AdminForm>
        } /> : null}
        */}
        </>
      ) : null}

      {mode === "pages" ? (
        <div className={`admin-content-grid ${editingPage ? "editor-open" : "editor-closed"}`}>
          <section>
            <AdminSectionHeader
              title="Info pages"
              description="About, contact, delivery, returns, privacy, and terms — shown to every visitor at the bottom of the site."
            />
            <div className="admin-content-list">
              {infoPages.map((page) => (
                <article key={page.slug}>
                  <div className="admin-content-image"><FileText size={20} /></div>
                  <div>
                    <strong>{infoPageTitles[page.slug] ?? page.slug}</strong>
                    <p>{page.intro}</p>
                    <small>{page.points.length} points</small>
                  </div>
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => setEditingPage(page)} title="Edit"><Pencil size={16} /></button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          {editingPage ? (
            <aside className="admin-content-editor" id="admin-content-editor">
              <button type="button" onClick={() => setEditingPage(null)}>Close editor</button>
              <AdminForm
                key={editingPage.slug}
                title={`Edit ${infoPageTitles[editingPage.slug] ?? editingPage.slug}`}
                onSubmit={savePage}
                submitLabel={savingPage ? "Saving..." : "Save page"}
              >
                <label>Eyebrow<input name="eyebrow" defaultValue={editingPage.eyebrow} required /></label>
                <label>Title<input name="title" defaultValue={editingPage.title} required /></label>
                <label>Intro<textarea name="intro" defaultValue={editingPage.intro} required /></label>
                <label>Points
                  <textarea
                    name="points"
                    placeholder={"Email | support@myecom.local\nPhone | +880 1700 000 000"}
                    defaultValue={editingPage.points.map((point) => `${point.title} | ${point.detail}`).join("\n")}
                    required
                  />
                  <small>One per line, as Title | Detail.</small>
                </label>
              </AdminForm>
            </aside>
          ) : null}
        </div>
      ) : null}

      {confirmTarget ? (
        <AdminConfirmDialog
          title={`Delete ${confirmTarget.label}?`}
          body="Items already in use may be archived instead of removed. This can't be undone."
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => void performRemove()}
        />
      ) : null}
    </div>
  );
}

function ContentLayout<T extends { id: string }>({
  title,
  description,
  items,
  render,
  form,
  editorOpen,
  createLabel,
  onCreate,
  onClose
}: {
  title: string;
  description: string;
  items: T[];
  render: (item: T, index: number) => React.ReactNode;
  form: React.ReactNode;
  editorOpen: boolean;
  createLabel: string;
  onCreate: () => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / contentPageSize));
  const pagedItems = items.slice((page - 1) * contentPageSize, page * contentPageSize);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  return (
    <div className={`admin-content-grid ${editorOpen ? "editor-open" : "editor-closed"}`}>
      <section>
        <AdminSectionHeader
          title={title}
          description={description}
          action={
            <button className="primary-action" type="button" onClick={onCreate}>
              <Plus size={16} /> {createLabel}
            </button>
          }
        />
        <div className="admin-content-list">
          {pagedItems.map((item, index) => (
            <article key={item.id}>{render(item, (page - 1) * contentPageSize + index)}</article>
          ))}
          {!items.length ? <p className="muted-copy">Nothing has been added yet.</p> : null}
        </div>
        <AdminPagination
          page={page}
          pages={pages}
          total={items.length}
          pageSize={contentPageSize}
          onPageChange={setPage}
        />
      </section>
      {editorOpen ? (
        <aside className="admin-content-editor" id="admin-content-editor">
          <button type="button" onClick={onClose}>Close editor</button>
          {form}
        </aside>
      ) : null}
    </div>
  );
}

function ContentActions({
  item,
  edit,
  toggle,
  remove,
  moveUp,
  moveDown
}: {
  item: { isActive?: boolean };
  edit: () => void;
  toggle: () => void;
  remove: () => void;
  moveUp?: () => void;
  moveDown?: () => void;
}) {
  return (
    <div className="admin-row-actions">
      <StatusBadge value={item.isActive === false ? "ARCHIVED" : "ACTIVE"} kind="product" />
      {moveUp || moveDown ? (
        <>
          <button type="button" onClick={moveUp} disabled={!moveUp} title="Move up"><ChevronUp size={16} /></button>
          <button type="button" onClick={moveDown} disabled={!moveDown} title="Move down"><ChevronDown size={16} /></button>
        </>
      ) : null}
      <button type="button" onClick={edit} title="Edit"><Pencil size={16} /></button>
      <button type="button" onClick={toggle}>{item.isActive === false ? "Enable" : "Disable"}</button>
      <button type="button" onClick={remove} title="Delete"><Trash2 size={16} /></button>
    </div>
  );
}
