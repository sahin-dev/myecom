"use client";

import {
  Gift,
  Home,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminCatalog,
  Product,
  archiveAdminComboDeal,
  createAdminComboDeal,
  fetchAdminCatalog,
  formatMoney,
  updateAdminComboDeal
} from "../../lib/catalog";
import {
  AdminConfirmDialog,
  AdminError,
  AdminLoading,
  AdminMultiUploadField,
  AdminPagination,
  AdminPageTitle,
  AdminSectionHeader,
  AdminToast,
  StatusBadge,
  useAdminToast
} from "./AdminShared";

const comboPageSize = 10;

function imageUrls(product: Product) {
  const urls = product.images?.map((image) => image.url) ?? [];
  if (!urls.length && product.imageUrl) urls.push(product.imageUrl);
  return Array.from(new Set(urls));
}

export function AdminCombos() {
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [componentIds, setComponentIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [componentSearch, setComponentSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { message, kind, notify } = useAdminToast();
  const [error, setError] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCatalog(await fetchAdminCatalog());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Combo deals are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const combos = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (catalog?.products ?? []).filter(
      (product) =>
        product.isCombo &&
        (!query ||
          product.name.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query))
    );
  }, [catalog, search]);
  const comboPages = Math.max(1, Math.ceil(combos.length / comboPageSize));
  const pagedCombos = combos.slice((page - 1) * comboPageSize, page * comboPageSize);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > comboPages) setPage(comboPages);
  }, [comboPages, page]);

  const availableProducts = useMemo(() => {
    const query = componentSearch.trim().toLowerCase();
    return (catalog?.products ?? [])
      .filter(
        (product) =>
          !product.isCombo &&
          product.status !== "ARCHIVED" &&
          (!query ||
            product.name.toLowerCase().includes(query) ||
            product.category?.name.toLowerCase().includes(query))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, componentSearch]);

  const summary = useMemo(() => {
    const active = combos.filter((combo) => combo.status === "ACTIVE");
    const savings = active
      .filter((combo) => combo.compareAt && combo.compareAt > combo.price)
      .map((combo) => ((combo.compareAt! - combo.price) / combo.compareAt!) * 100);
    return {
      total: combos.length,
      active: active.length,
      featured: combos.filter((combo) => combo.showOnHome).length,
      lowStock: active.filter((combo) => combo.inventory <= 10).length,
      averageSaving: savings.length
        ? Math.round(savings.reduce((sum, value) => sum + value, 0) / savings.length)
        : 0
    };
  }, [combos]);

  function openEditor(combo: Product) {
    setSelected(combo);
    setCreating(false);
    setImages(imageUrls(combo));
    setComponentIds(combo.comboProductIds ?? []);
    setComponentSearch("");
  }

  function openCreator() {
    setSelected(null);
    setCreating(true);
    setImages([]);
    setComponentIds([]);
    setComponentSearch("");
  }

  function closeEditor() {
    setSelected(null);
    setCreating(false);
    setImages([]);
    setComponentIds([]);
  }

  function toggleComponent(id: string) {
    setComponentIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function mergeCombo(updated: Product) {
    setCatalog((current) =>
      current
        ? {
            ...current,
            products: current.products.map((product) => {
              if (product.id === updated.id) return updated;
              if (updated.showOnHome && product.isCombo) {
                return { ...product, showOnHome: false };
              }
              return product;
            })
          }
        : current
    );
  }

  function formInput(form: FormData) {
    return {
      name: String(form.get("name")),
      description: String(form.get("description")),
      price: Number(form.get("price")),
      costPrice: Number(form.get("costPrice") || 0) || undefined,
      compareAt: Number(form.get("compareAt") || 0) || undefined,
      inventory: Number(form.get("inventory") || 0),
      imageUrl: images[0],
      imageUrls: images,
      comboProductIds: componentIds,
      showOnHome: form.get("showOnHome") === "on",
      comboPriority: Number(form.get("comboPriority") || 0),
      status: String(form.get("status") || "ACTIVE") as "DRAFT" | "ACTIVE" | "ARCHIVED",
      badge: String(form.get("badge") || "Combo deal"),
      tags: String(form.get("tags") || "")
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    };
  }

  async function createCombo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (componentIds.length < 2) {
      notify("Select at least two products for this combo.", "error");
      return;
    }
    setSaving(true);
    try {
      const combo = await createAdminComboDeal(formInput(new FormData(event.currentTarget)));
      setCatalog((current) =>
        current
          ? {
              ...current,
              products: [
                combo,
                ...current.products.map((product) =>
                  combo.showOnHome && product.isCombo
                    ? { ...product, showOnHome: false }
                    : product
                )
              ]
            }
          : current
      );
      notify(`${combo.name} was created.`);
      closeEditor();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Combo deal could not be created.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveCombo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (componentIds.length < 2) {
      notify("Select at least two products for this combo.", "error");
      return;
    }
    setSaving(true);
    try {
      const combo = await updateAdminComboDeal(
        selected.id,
        formInput(new FormData(event.currentTarget))
      );
      mergeCombo(combo);
      setSelected(combo);
      setImages(imageUrls(combo));
      notify(`${combo.name} was updated.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Combo deal could not be updated.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function archiveCombo() {
    if (!selected) return;
    try {
      const result = await archiveAdminComboDeal(selected.id);
      mergeCombo(result.combo);
      notify(`${selected.name} was archived.`);
      closeEditor();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Combo deal could not be archived.", "error");
    } finally {
      setArchiveTarget(null);
    }
  }

  if (loading && !catalog) return <AdminLoading label="Loading combo deals..." />;
  if (error && !catalog) return <AdminError message={error} retry={() => void load()} />;
  if (!catalog) return null;

  const editorProduct = selected;
  const formKey = editorProduct?.id ?? "new-combo";

  return (
    <div className="admin-page">
      <AdminPageTitle
        eyebrow="Catalog merchandising"
        title="Combo deals"
        description="Bundle products, control savings, and choose the single deal featured on the homepage."
        actions={
          <>
            <button className="primary-action" type="button" onClick={openCreator}>
              <Plus size={17} /> Create combo
            </button>
            <button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh combo deals">
              <RefreshCw size={17} />
            </button>
          </>
        }
      />

      <section className="admin-summary-strip">
        <div><small>Total combos</small><strong>{summary.total}</strong></div>
        <div><small>Active</small><strong>{summary.active}</strong></div>
        <div><small>Homepage feature</small><strong>{summary.featured}</strong></div>
        <div><small>Low stock</small><strong>{summary.lowStock}</strong></div>
        <div><small>Average saving</small><strong>{summary.averageSaving}%</strong></div>
      </section>

      <AdminToast message={message} kind={kind} />

      {archiveTarget ? (
        <AdminConfirmDialog
          title={`Archive ${archiveTarget.name}?`}
          body="It will disappear from the storefront."
          confirmLabel="Archive"
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() => void archiveCombo()}
        />
      ) : null}

      <div className={`admin-inventory-workspace admin-combo-workspace ${selected || creating ? "has-detail" : ""}`}>
        <section>
          <div className="admin-filterbar compact">
            <label className="admin-search">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search combo deals" />
            </label>
          </div>
          <AdminSectionHeader
            title={`${combos.length} combo deals`}
            description="Select a combo to update its products, pricing, imagery, or storefront visibility."
          />
          <div className="admin-table-wrap">
            <table className="admin-table admin-products-table">
              <thead>
                <tr><th>Combo</th><th>Status</th><th>Products</th><th>Price</th><th>Homepage</th><th /></tr>
              </thead>
              <tbody>
                {pagedCombos.map((combo) => (
                  <tr
                    key={combo.id}
                    className={selected?.id === combo.id ? "selected" : ""}
                    onClick={() => openEditor(combo)}
                  >
                    <td>
                      <div className="admin-product-cell">
                        <span>{combo.imageUrl ? <img src={combo.imageUrl} alt="" /> : <Gift size={19} />}</span>
                        <div><strong>{combo.name}</strong><small>{combo.inventory} bundles available</small></div>
                      </div>
                    </td>
                    <td><StatusBadge value={combo.status ?? "ACTIVE"} kind="product" /></td>
                    <td>{combo.comboProductIds?.length ?? 0}</td>
                    <td>{formatMoney(combo.price)}</td>
                    <td>{combo.showOnHome ? <span className="admin-home-feature"><Home size={13} /> Featured</span> : "No"}</td>
                    <td>
                      <button
                        type="button"
                        title={`Edit ${combo.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditor(combo);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination
            page={page}
            pages={comboPages}
            total={combos.length}
            pageSize={comboPageSize}
            onPageChange={setPage}
          />
        </section>

        {selected || creating ? (
          <aside className={selected ? "admin-product-editor" : "admin-create-product"}>
            <div className="admin-detail-head">
              <div>
                <span>{selected ? "Edit combo" : "New bundle"}</span>
                <h2>{selected?.name ?? "Create combo deal"}</h2>
              </div>
              <button type="button" onClick={closeEditor} aria-label="Close combo editor"><X size={18} /></button>
            </div>
            <form
              className="admin-editor-form"
              key={formKey}
              onSubmit={selected ? saveCombo : createCombo}
            >
              <label>Combo name<input name="name" defaultValue={selected?.name ?? ""} required /></label>
              <label>Description<textarea name="description" defaultValue={selected?.description ?? ""} required /></label>
              <div className="form-grid">
                <label>Selling price<input name="price" type="number" min="1" step="0.01" defaultValue={selected?.price ?? ""} required /></label>
                <label>Compare price<input name="compareAt" type="number" min="0" step="0.01" defaultValue={selected?.compareAt ?? ""} /></label>
              </div>
              <div className="form-grid">
                <label>Bundle cost<input name="costPrice" type="number" min="0" step="0.01" defaultValue={selected?.costPrice ?? ""} /></label>
                <label>Available bundles<input name="inventory" type="number" min="0" defaultValue={selected?.inventory ?? 0} /></label>
              </div>
              <AdminMultiUploadField
                label="Combo images"
                values={images}
                onChange={setImages}
                onMessage={notify}
                maxFiles={6}
                recommendedDimensions="1200 x 900 px"
              />
              <div className="form-grid">
                <label>Badge<input name="badge" defaultValue={selected?.badge ?? "Combo deal"} /></label>
                <label>Display priority<input name="comboPriority" type="number" min="0" defaultValue={selected?.comboPriority ?? 0} /></label>
              </div>
              <label>Tags<input name="tags" defaultValue={selected?.tags.join(", ") ?? "combo"} placeholder="combo, family, weekly" /></label>
              <label>Visibility
                <select name="status" defaultValue={selected?.status ?? "ACTIVE"}>
                  <option value="ACTIVE">Active</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
              <label className="check-row">
                <input name="showOnHome" type="checkbox" defaultChecked={selected?.showOnHome ?? false} />
                Feature this combo on the homepage
              </label>
              <p className="form-note">Selecting this automatically removes the previous homepage combo.</p>

              <div className="admin-editor-divider"><span>Included products</span></div>
              <label className="admin-search admin-combo-product-search">
                <Search size={16} />
                <input
                  value={componentSearch}
                  onChange={(event) => setComponentSearch(event.target.value)}
                  placeholder="Find products to include"
                />
              </label>
              <div className="admin-combo-product-picker">
                {availableProducts.map((product) => (
                  <label key={product.id}>
                    <input
                      type="checkbox"
                      checked={componentIds.includes(product.id)}
                      onChange={() => toggleComponent(product.id)}
                    />
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.category?.name ?? "Uncategorized"} | {formatMoney(product.price)}</small>
                    </span>
                  </label>
                ))}
              </div>
              <p className="form-note">{componentIds.length} selected. A combo requires at least two products.</p>

              <div className="admin-editor-sticky-actions">
                {selected ? (
                  <button className="secondary-action" type="button" onClick={() => setArchiveTarget(selected)}>
                    <Trash2 size={16} /> Archive
                  </button>
                ) : <button className="secondary-action" type="button" onClick={closeEditor}>Cancel</button>}
                <button className="primary-action" type="submit" disabled={saving}>
                  {saving ? "Saving..." : selected ? "Save combo" : "Create combo"}
                </button>
              </div>
            </form>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
