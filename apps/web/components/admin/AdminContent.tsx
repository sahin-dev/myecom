"use client";

import {
  CreditCard,
  ImagePlus,
  Layers3,
  LayoutTemplate,
  PanelTop,
  Pencil,
  RefreshCw,
  Star,
  Store,
  Trash2
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  { id: "testimonials", label: "Customer stories", icon: <Star size={17} /> },
  { id: "checkout", label: "Checkout methods", icon: <CreditCard size={17} /> }
];

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export function AdminContent() {
  const { setSettings } = useSiteSettings();
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [mode, setMode] = useState<ContentMode>("identity");
  const [editing, setEditing] = useState<Editable | null>(null);
  const [image, setImage] = useState("");
  const [siteLogo, setSiteLogo] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextCatalog = await fetchAdminCatalog();
      setCatalog(nextCatalog);
      setSiteLogo(nextCatalog.siteSettings.logoUrl ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Store content is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setEditing(null);
    setImage("");
  }, [mode]);

  const selected = useMemo(() => editing, [editing]);

  function startEdit(item: Editable) {
    setEditing(item);
    setImage(
      "imageUrl" in item ? item.imageUrl ?? "" :
      "logoUrl" in item ? item.logoUrl ?? "" :
      "avatarUrl" in item ? item.avatarUrl ?? "" : ""
    );
  }

  async function remove(path: string, id: string, label: string) {
    if (!window.confirm(`Delete ${label}? Items already in use may be archived instead.`)) return;
    try {
      await deleteAdminResource(path, id);
      setEditing(null);
      setMessage(`${label} was removed.`);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : `${label} could not be removed.`);
    }
  }

  async function toggle(path: string, item: Editable & { isActive?: boolean }) {
    try {
      await updateAdminResource(path, item.id, { isActive: !(item.isActive ?? true) });
      setMessage(`${"name" in item ? item.name : "title" in item ? item.title : "Item"} updated.`);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Visibility could not be changed.");
    }
  }

  async function save(path: Parameters<typeof createAdminResource>[0], payload: unknown) {
    if (editing) {
      await updateAdminResource(path, editing.id, payload);
    } else {
      await createAdminResource(path, payload);
    }
    setEditing(null);
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
      setMessage("Homepage section saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Homepage section could not be saved.");
    }
  }

  async function saveBanner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!image) return setMessage("Upload a campaign image first.");
    try {
      await save("banners", {
        eyebrow: value(form, "eyebrow"),
        title: value(form, "title"),
        subtitle: value(form, "subtitle"),
        ctaLabel: value(form, "ctaLabel"),
        ctaHref: value(form, "ctaHref"),
        imageUrl: image,
        priority: Number(form.get("priority") || 0),
        isActive: form.get("isActive") === "on"
      });
      setMessage("Banner saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Banner could not be saved.");
    }
  }

  async function saveIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const settings = await updateSiteSettings({
        title: value(form, "title"),
        logoUrl: siteLogo,
        announcement: value(form, "announcement"),
        announcementLinkLabel: value(form, "announcementLinkLabel"),
        announcementLinkHref: value(form, "announcementLinkHref")
      });
      setSettings(settings);
      setCatalog((current) => current ? { ...current, siteSettings: settings } : current);
      setMessage("Website identity and topbar updated.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Website identity could not be saved.");
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
      setMessage("Brand saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Brand could not be saved.");
    }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await save("categories", {
        name: value(form, "name"),
        icon: value(form, "icon"),
        priority: Number(form.get("priority") || 0),
        isActive: form.get("isActive") === "on"
      });
      setMessage("Category saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Category could not be saved.");
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
      setMessage("Customer story saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Customer story could not be saved.");
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
      setMessage("Checkout method saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Checkout method could not be saved.");
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
        title="Content studio"
        description="Publish, order, and pause every customer-facing homepage and checkout option."
        actions={<button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh content"><RefreshCw size={17} /></button>}
      />
      <div className="admin-content-tabs" role="tablist" aria-label="Content types">
        {modes.map((item) => (
          <button key={item.id} type="button" className={mode === item.id ? "active" : ""} onClick={() => setMode(item.id)}>
            {item.icon} {item.label} <span>{countFor(item.id)}</span>
          </button>
        ))}
      </div>
      {message ? <p className="admin-message">{message}</p> : null}

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
            <AdminUploadField label="Website logo" value={siteLogo} onChange={setSiteLogo} onMessage={setMessage} />
            <label>Topbar announcement<input name="announcement" defaultValue={catalog.siteSettings.announcement} required /></label>
            <div className="form-grid">
              <label>Topbar link label<input name="announcementLinkLabel" defaultValue={catalog.siteSettings.announcementLinkLabel} required /></label>
              <label>Topbar link destination<input name="announcementLinkHref" defaultValue={catalog.siteSettings.announcementLinkHref} required /></label>
            </div>
          </AdminForm>
        </div>
      ) : null}

      {mode === "homepage" ? (
        <ContentLayout
          title="Homepage sections"
          description="Lower priority values appear first. Hidden sections remain editable."
          items={catalog.homeSections}
          render={(section) => (
            <>
              <div><strong>{section.title}</strong><p>{section.type.replace(/_/g, " ")} · {section.key}</p><small>Priority {section.priority} · Limit {section.productLimit}</small></div>
              <ContentActions item={section} edit={() => startEdit(section)} toggle={() => void toggle("home-sections", section)} remove={() => void remove("home-sections", section.id, section.title)} />
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
              <AdminUploadField label="Section image" value={image} onChange={setImage} onMessage={setMessage} />
              {editing ? <button type="button" className="secondary-action full" onClick={() => { setEditing(null); setImage(""); }}>Cancel editing</button> : null}
            </AdminForm>
          }
        />
      ) : null}

      {mode === "banners" ? (
        <ContentLayout title="Campaign banners" description="Active banners rotate in the homepage hero." items={catalog.banners} render={(banner) => (
          <><div className="admin-content-image">{banner.imageUrl ? <img src={banner.imageUrl} alt="" /> : <ImagePlus size={22} />}</div><div><strong>{banner.title}</strong><p>{banner.subtitle}</p><small>Priority {banner.priority} · {banner.ctaLabel}</small></div><ContentActions item={banner} edit={() => startEdit(banner)} toggle={() => void toggle("banners", banner)} remove={() => void remove("banners", banner.id, banner.title)} /></>
        )} form={
          <AdminForm key={editing?.id ?? "new-banner"} title={editing ? "Edit banner" : "Create banner"} onSubmit={saveBanner} submitLabel="Save banner">
            <label>Eyebrow<input name="eyebrow" defaultValue={selected && "eyebrow" in selected ? selected.eyebrow ?? "" : ""} placeholder="Everyday pantry market" /></label>
            <label>Title<input name="title" defaultValue={selected && "title" in selected ? selected.title : ""} required /></label><label>Supporting copy<textarea name="subtitle" defaultValue={selected && "subtitle" in selected ? selected.subtitle ?? "" : ""} required /></label>
            <div className="form-grid"><label>Button label<input name="ctaLabel" defaultValue={selected && "ctaLabel" in selected ? selected.ctaLabel ?? "" : ""} required /></label><label>Button link<input name="ctaHref" defaultValue={selected && "ctaHref" in selected ? selected.ctaHref ?? "" : "/shop"} required /></label></div>
            <label>Priority<input name="priority" type="number" defaultValue={selected && "priority" in selected ? selected.priority : 0} /></label><label className="check-row"><input name="isActive" type="checkbox" defaultChecked={selected && "isActive" in selected ? selected.isActive : true} /> Published</label>
            <AdminUploadField label="Banner image" value={image} onChange={setImage} onMessage={setMessage} />
          </AdminForm>
        } />
      ) : null}

      {mode === "brands" ? (
        <ContentLayout title="Brands" description="Products can be assigned to a brand or remain independent." items={catalog.brands} render={(brand) => (
          <><div className="admin-content-image">{brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : <Store size={21} />}</div><div><strong>{brand.name}</strong><p>{brand.story || "No brand story."}</p></div><ContentActions item={brand} edit={() => startEdit(brand)} toggle={() => void toggle("brands", brand)} remove={() => void remove("brands", brand.id, brand.name)} /></>
        )} form={
          <AdminForm key={editing?.id ?? "new-brand"} title={editing ? "Edit brand" : "Create brand"} onSubmit={saveBrand} submitLabel="Save brand"><label>Brand name<input name="name" defaultValue={selected && "name" in selected ? selected.name : ""} required /></label><AdminUploadField label="Brand logo" value={image} onChange={setImage} onMessage={setMessage} /><label>Brand story<textarea name="story" defaultValue={selected && "story" in selected ? selected.story ?? "" : ""} /></label><label className="check-row"><input name="isActive" type="checkbox" defaultChecked={selected && "isActive" in selected ? selected.isActive ?? true : true} /> Active</label></AdminForm>
        } />
      ) : null}

      {mode === "categories" ? (
        <ContentLayout title="Categories" description="Priority controls navigation and homepage order." items={catalog.categories} render={(category) => (
          <><div><strong>{category.name}</strong><p>/{category.slug}</p><small>{category.icon || "No icon label"} · Priority {category.priority}</small></div><ContentActions item={category} edit={() => startEdit(category)} toggle={() => void toggle("categories", category)} remove={() => void remove("categories", category.id, category.name)} /></>
        )} form={
          <AdminForm key={editing?.id ?? "new-category"} title={editing ? "Edit category" : "Create category"} onSubmit={saveCategory} submitLabel="Save category"><label>Category name<input name="name" defaultValue={selected && "name" in selected ? selected.name : ""} required /></label><label>Short icon label<input name="icon" defaultValue={selected && "icon" in selected ? selected.icon ?? "" : ""} /></label><label>Priority<input name="priority" type="number" defaultValue={selected && "priority" in selected ? selected.priority : 0} /></label><label className="check-row"><input name="isActive" type="checkbox" defaultChecked={selected && "isActive" in selected ? selected.isActive ?? true : true} /> Active</label></AdminForm>
        } />
      ) : null}

      {mode === "testimonials" ? (
        <ContentLayout title="Customer stories" description="Add as many curated customer stories as the homepage needs." items={catalog.testimonials} render={(item) => (
          <><div className="admin-content-image">{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : <Star size={20} />}</div><div><strong>{item.name}</strong><p>{item.quote}</p><small>{item.rating}/5 · Priority {item.priority}</small></div><ContentActions item={item} edit={() => startEdit(item)} toggle={() => void toggle("testimonials", item)} remove={() => void remove("testimonials", item.id, item.name)} /></>
        )} form={
          <AdminForm key={editing?.id ?? "new-testimonial"} title={editing ? "Edit customer story" : "Add customer story"} onSubmit={saveTestimonial} submitLabel="Save story"><div className="form-grid"><label>Name<input name="name" defaultValue={selected && "name" in selected ? selected.name : ""} required /></label><label>Role<input name="role" defaultValue={selected && "role" in selected ? selected.role ?? "" : ""} /></label></div><label>Review<textarea name="quote" defaultValue={selected && "quote" in selected ? selected.quote : ""} required /></label><div className="form-grid"><label>Rating<input name="rating" type="number" min="1" max="5" defaultValue={selected && "rating" in selected ? selected.rating : 5} /></label><label>Priority<input name="priority" type="number" defaultValue={selected && "priority" in selected ? selected.priority : 0} /></label></div><AdminUploadField label="Customer photo" value={image} onChange={setImage} onMessage={setMessage} /><label className="check-row"><input name="isActive" type="checkbox" defaultChecked={selected && "isActive" in selected ? selected.isActive : true} /> Published</label></AdminForm>
        } />
      ) : null}

      {mode === "checkout" ? (
        <ContentLayout title="Payment and delivery methods" description="Disabled methods disappear from checkout immediately. Online payment stays disabled until a gateway is connected." items={catalog.checkoutMethods} render={(item) => (
          <><div><strong>{item.name}</strong><p>{item.description || item.code}</p><small>{item.type} · Fee {item.fee} · Priority {item.priority}</small></div><ContentActions item={item} edit={() => startEdit(item)} toggle={() => void toggle("checkout-methods", item)} remove={() => void remove("checkout-methods", item.id, item.name)} /></>
        )} form={
          <AdminForm key={editing?.id ?? "new-method"} title={editing ? "Edit checkout method" : "Add checkout method"} onSubmit={saveCheckoutMethod} submitLabel="Save method"><div className="form-grid"><label>Type<select name="type" defaultValue={selected && "type" in selected ? selected.type : "DELIVERY"}><option>DELIVERY</option><option>PAYMENT</option></select></label><label>Code<input name="code" defaultValue={selected && "code" in selected ? selected.code : ""} required /></label></div><label>Name<input name="name" defaultValue={selected && "name" in selected ? selected.name : ""} required /></label><label>Description<textarea name="description" defaultValue={selected && "description" in selected ? selected.description ?? "" : ""} /></label><div className="form-grid"><label>Fee<input name="fee" type="number" min="0" step="0.01" defaultValue={selected && "fee" in selected ? selected.fee : 0} /></label><label>Free above<input name="freeThreshold" type="number" min="0" step="0.01" defaultValue={selected && "freeThreshold" in selected ? selected.freeThreshold ?? "" : ""} /></label></div><div className="form-grid"><label>Minimum days<input name="minDeliveryDays" type="number" min="0" defaultValue={selected && "minDeliveryDays" in selected ? selected.minDeliveryDays ?? "" : ""} /></label><label>Maximum days<input name="maxDeliveryDays" type="number" min="0" defaultValue={selected && "maxDeliveryDays" in selected ? selected.maxDeliveryDays ?? "" : ""} /></label></div><label>Priority<input name="priority" type="number" defaultValue={selected && "priority" in selected ? selected.priority : 0} /></label><label className="check-row"><input name="isActive" type="checkbox" defaultChecked={selected && "isActive" in selected ? selected.isActive : true} /> Enabled at checkout</label></AdminForm>
        } />
      ) : null}
    </div>
  );
}

function ContentLayout<T extends { id: string }>({
  title,
  description,
  items,
  render,
  form
}: {
  title: string;
  description: string;
  items: T[];
  render: (item: T) => React.ReactNode;
  form: React.ReactNode;
}) {
  return (
    <div className="admin-content-grid">
      <section>
        <AdminSectionHeader title={title} description={description} />
        <div className="admin-content-list">
          {items.map((item) => <article key={item.id}>{render(item)}</article>)}
          {!items.length ? <p className="muted-copy">Nothing has been added yet.</p> : null}
        </div>
      </section>
      {form}
    </div>
  );
}

function ContentActions({
  item,
  edit,
  toggle,
  remove
}: {
  item: { isActive?: boolean };
  edit: () => void;
  toggle: () => void;
  remove: () => void;
}) {
  return (
    <div className="admin-row-actions">
      <StatusBadge value={item.isActive === false ? "ARCHIVED" : "ACTIVE"} kind="product" />
      <button type="button" onClick={edit} title="Edit"><Pencil size={16} /></button>
      <button type="button" onClick={toggle}>{item.isActive === false ? "Enable" : "Disable"}</button>
      <button type="button" onClick={remove} title="Delete"><Trash2 size={16} /></button>
    </div>
  );
}
