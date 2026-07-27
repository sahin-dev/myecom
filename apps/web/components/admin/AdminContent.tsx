"use client";

import {
  ChevronDown,
  ChevronUp,
  CreditCard,
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
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AdminCatalog,
  Banner,
  Brand,
  Category,
  CheckoutMethod,
  HomeSection,
  Testimonial,
  createAdminResource,
  deleteAdminResource,
  fetchAdminCatalog,
  updateAdminResource,
  updateSiteSettings
} from "../../lib/catalog";
import { useSiteSettings } from "../SiteSettingsContext";
import {
  AdminError,
  AdminForm,
  AdminLoading,
  AdminPageTitle,
  AdminSectionHeader,
  AdminUploadField,
  StatusBadge
} from "./AdminShared";

type ContentMode = "identity" | "homepage" | "banners" | "brands" | "categories" | "testimonials" | "checkout";
type Editable = HomeSection | (Banner & { isActive: boolean }) | Brand | Category | Testimonial | CheckoutMethod;

const modes: Array<{ id: ContentMode; label: string; icon: React.ReactNode }> = [
  { id: "identity", label: "Site identity", icon: <PanelTop size={17} /> },
  { id: "homepage", label: "Homepage", icon: <LayoutTemplate size={17} /> },
  { id: "banners", label: "Banners", icon: <ImagePlus size={17} /> },
  { id: "brands", label: "Brands", icon: <Store size={17} /> },
  { id: "categories", label: "Categories", icon: <Layers3 size={17} /> },
  { id: "testimonials", label: "Homepage reviews", icon: <Star size={17} /> },
  { id: "checkout", label: "Checkout methods", icon: <CreditCard size={17} /> }
];

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

export function AdminContent() {
  const { setSettings } = useSiteSettings();
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [mode, setMode] = useState<ContentMode>("identity");
  const [editing, setEditing] = useState<Editable | null>(null);
  const [creating, setCreating] = useState(false);
  const [image, setImage] = useState("");
  const [siteLogo, setSiteLogo] = useState("");
  const [siteFavicon, setSiteFavicon] = useState("");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const [confirmTarget, setConfirmTarget] = useState<{ path: string; id: string; label: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextCatalog = await fetchAdminCatalog();
      setCatalog(nextCatalog);
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
  }, [mode]);

  useEffect(() => {
    if (!editing && !creating) return;
    document.getElementById("admin-content-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editing, creating]);

  const messageTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => window.clearTimeout(messageTimer.current), []);

  const notify = useCallback((text: string, kind: "success" | "error" = "success") => {
    setMessage(text);
    setMessageKind(kind);
    window.clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(""), 4500);
  }, []);

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

  async function saveCheckoutMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await save("checkout-methods", {
        type: value(form, "type"),
        code: value(form, "code").toUpperCase().replace(/\s+/g, "_"),
        name: value(form, "name"),
        description: value(form, "description"),
        fee: Number(form.get("fee") || 0),
        freeThreshold: Number(form.get("freeThreshold") || 0) || undefined,
        minDeliveryDays: Number(form.get("minDeliveryDays") || 0) || undefined,
        maxDeliveryDays: Number(form.get("maxDeliveryDays") || 0) || undefined,
        priority: Number(form.get("priority") || 0),
        isActive: form.get("isActive") === "on"
      });
      notify("Checkout method saved.");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Checkout method could not be saved.", "error");
    }
  }

  if (loading && !catalog) return <AdminLoading label="Loading storefront content..." />;
  if (error && !catalog) return <AdminError message={error} retry={() => void load()} />;
  if (!catalog) return null;

  const countFor = (id: ContentMode) =>
    id === "identity" ? 1 :
    id === "homepage" ? catalog.homeSections.length :
    id === "banners" ? catalog.banners.length :
    id === "brands" ? catalog.brands.length :
    id === "categories" ? catalog.categories.length :
    id === "testimonials" ? catalog.testimonials.length :
    catalog.checkoutMethods.length;

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
      {message ? <p className={`admin-message${messageKind === "error" ? " is-error" : ""}`}>{message}</p> : null}

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
              <label>Announcement<input name="announcement" defaultValue={selected && "metadata" in selected ? selected.metadata?.announcement ?? "" : ""} /></label>
              <label>Trust benefits<textarea name="benefits" placeholder={"Carefully selected | Trusted suppliers\nFlexible delivery | Choose what fits your day"} defaultValue={selected && "metadata" in selected ? selected.metadata?.items?.map((item) => `${item.title} | ${item.detail}`).join("\n") ?? "" : ""} /></label>
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
        <ContentLayout title="Payment and delivery methods" description="Disabled methods disappear from checkout immediately. Online payment stays disabled until a gateway is connected." items={catalog.checkoutMethods} editorOpen={creating || Boolean(editing)} createLabel="Add method" onCreate={startCreate} onClose={closeEditor} render={(item, index) => (
          <><div className="admin-content-image">{item.type === "PAYMENT" ? <CreditCard size={20} /> : <Truck size={20} />}</div><div><strong>{item.name}</strong><p>{item.description || item.code}</p><small>{item.type} · Fee {item.fee} · Priority {item.priority}</small></div><ContentActions item={item} edit={() => startEdit(item)} toggle={() => void toggle("checkout-methods", item)} remove={() => void remove("checkout-methods", item.id, item.name)} moveUp={index > 0 ? () => void move("checkout-methods", catalog.checkoutMethods, index, -1) : undefined} moveDown={index < catalog.checkoutMethods.length - 1 ? () => void move("checkout-methods", catalog.checkoutMethods, index, 1) : undefined} /></>
        )} form={
          <AdminForm key={editing?.id ?? "new-method"} title={editing ? "Edit checkout method" : "Add checkout method"} onSubmit={saveCheckoutMethod} submitLabel="Save method"><div className="form-grid"><label>Type<select name="type" defaultValue={selected && "type" in selected ? selected.type : "DELIVERY"}><option>DELIVERY</option><option>PAYMENT</option></select></label><label>Code<input name="code" defaultValue={selected && "code" in selected ? selected.code : ""} required /></label></div><label>Name<input name="name" defaultValue={selected && "name" in selected ? selected.name : ""} required /></label><label>Description<textarea name="description" defaultValue={selected && "description" in selected ? selected.description ?? "" : ""} /></label><div className="form-grid"><label>Fee<input name="fee" type="number" min="0" step="0.01" defaultValue={selected && "fee" in selected ? selected.fee : 0} /></label><label>Free above<input name="freeThreshold" type="number" min="0" step="0.01" defaultValue={selected && "freeThreshold" in selected ? selected.freeThreshold ?? "" : ""} /></label></div><div className="form-grid"><label>Minimum days<input name="minDeliveryDays" type="number" min="0" defaultValue={selected && "minDeliveryDays" in selected ? selected.minDeliveryDays ?? "" : ""} /></label><label>Maximum days<input name="maxDeliveryDays" type="number" min="0" defaultValue={selected && "maxDeliveryDays" in selected ? selected.maxDeliveryDays ?? "" : ""} /></label></div><label>Priority<input name="priority" type="number" defaultValue={selected && "priority" in selected ? selected.priority : 0} /></label><label className="check-row"><input name="isActive" type="checkbox" defaultChecked={selected && "isActive" in selected ? selected.isActive : true} /> Enabled at checkout</label></AdminForm>
        } />
      ) : null}

      {confirmTarget ? (
        <div className="admin-confirm-overlay" role="dialog" aria-modal="true">
          <div className="admin-confirm-card">
            <h3>Delete {confirmTarget.label}?</h3>
            <p>Items already in use may be archived instead of removed. This can&apos;t be undone.</p>
            <div className="admin-confirm-actions">
              <button type="button" className="secondary-action" onClick={() => setConfirmTarget(null)}>Cancel</button>
              <button type="button" className="danger-action" onClick={() => void performRemove()}><Trash2 size={16} /> Delete</button>
            </div>
          </div>
        </div>
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
          {items.map((item, index) => <article key={item.id}>{render(item, index)}</article>)}
          {!items.length ? <p className="muted-copy">Nothing has been added yet.</p> : null}
        </div>
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
