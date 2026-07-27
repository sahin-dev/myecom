"use client";

import {
  AlertTriangle,
  Boxes,
  PackagePlus,
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
  addProductImage,
  adjustInventory,
  createAdminResource,
  createProductVariant,
  deleteAdminResource,
  deleteProductImage,
  deleteProductVariant,
  fetchAdminCatalog,
  formatMoney,
  updateProductImage,
  updateProductVariant,
  updateAdminProduct
} from "../../lib/catalog";
import { useAuth } from "../AuthContext";
import {
  AdminError,
  AdminLoading,
  AdminMultiUploadField,
  AdminPageTitle,
  AdminSectionHeader,
  AdminUploadField,
  StatusBadge
} from "./AdminShared";

export function AdminInventory() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [editorSection, setEditorSection] = useState<"general" | "stock" | "options" | "media">("general");
  const [productImages, setProductImages] = useState<string[]>([]);
  const [galleryImage, setGalleryImage] = useState("");
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const hasPermission = (permission: string) =>
    user?.permissions.includes("*") || user?.permissions.includes(permission);
  const canManageCatalog =
    hasPermission("products.create") || hasPermission("products.update");
  const canAdjustInventory = hasPermission("inventory.write");

  function openProduct(product: Product) {
    setSelected(product);
    setCreating(false);
    setEditorSection(canManageCatalog ? "general" : canAdjustInventory ? "stock" : "general");
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCatalog(await fetchAdminCatalog());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Inventory is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const products = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (catalog?.products ?? []).filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.brand?.name.toLowerCase().includes(query) ||
        product.category?.name.toLowerCase().includes(query);
      const matchesStock =
        !stockFilter ||
        (stockFilter === "low" && product.inventory > 0 && product.inventory <= 20) ||
        (stockFilter === "out" && product.inventory === 0) ||
        (stockFilter === "healthy" && product.inventory > 20) ||
        (stockFilter === "archived" && product.status === "ARCHIVED");
      return matchesSearch && matchesStock;
    });
  }, [catalog, search, stockFilter]);

  const summary = useMemo(() => {
    const all = catalog?.products ?? [];
    return {
      active: all.filter((product) => (product.status ?? "ACTIVE") === "ACTIVE").length,
      low: all.filter((product) => product.inventory > 0 && product.inventory <= 20).length,
      out: all.filter((product) => product.inventory === 0).length,
      missingCost: all.filter((product) => product.costPrice == null).length,
      retailValue: all.reduce((sum, product) => sum + product.price * product.inventory, 0)
    };
  }, [catalog]);

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const costPrice = String(form.get("costPrice") || "");
    try {
      const updated = await updateAdminProduct(selected.id, {
        name: String(form.get("name")),
        description: String(form.get("description")),
        price: Number(form.get("price")),
        costPrice: costPrice ? Number(costPrice) : undefined,
        compareAt: Number(form.get("compareAt") || 0) || undefined,
        badge: String(form.get("badge") || ""),
        brandId: String(form.get("brandId") || ""),
        categoryId: String(form.get("categoryId") || ""),
        tags: String(form.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
        status: String(form.get("status")) as "DRAFT" | "ACTIVE" | "ARCHIVED",
        isNew: form.get("isNew") === "on",
        isTrending: form.get("isTrending") === "on",
        isBestSelling: form.get("isBestSelling") === "on",
        isCertified: form.get("isCertified") === "on"
      });
      setCatalog((current) =>
        current
          ? { ...current, products: current.products.map((item) => item.id === updated.id ? updated : item) }
          : current
      );
      setSelected(updated);
      setMessage(`${updated.name} was updated.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Product update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBaseOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      const updated = await updateAdminProduct(selected.id, {
        baseOptionEnabled: form.get("baseOptionEnabled") === "on",
        baseOptionLabel: String(form.get("baseOptionLabel") || "")
      });
      setCatalog((current) =>
        current
          ? { ...current, products: current.products.map((item) => item.id === updated.id ? updated : item) }
          : current
      );
      setSelected(updated);
      setMessage("Original product option updated.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Original product option could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const brandId = String(form.get("brandId") || "");
    const categoryId = String(form.get("categoryId") || "");
    try {
      const product = await createAdminResource<Product>("products", {
        name: String(form.get("name")),
        description: String(form.get("description")),
        price: Number(form.get("price")),
        costPrice: Number(form.get("costPrice") || 0) || undefined,
        compareAt: Number(form.get("compareAt") || 0) || undefined,
        inventory: Number(form.get("inventory") || 0),
        baseOptionEnabled: form.get("baseOptionEnabled") === "on",
        baseOptionLabel: String(form.get("baseOptionLabel") || "") || undefined,
        imageUrl: productImages[0],
        imageUrls: productImages,
        isNew: form.get("isNew") === "on",
        isTrending: form.get("isTrending") === "on",
        isBestSelling: form.get("isBestSelling") === "on",
        isCertified: form.get("isCertified") === "on",
        badge: String(form.get("badge") || ""),
        brandId: brandId || undefined,
        categoryId: categoryId || undefined,
        tags: String(form.get("tags") || "").split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean)
      });
      setCatalog((current) => current ? { ...current, products: [product, ...current.products] } : current);
      setMessage(`${product.name} was created.`);
      setProductImages([]);
      setCreating(false);
      formElement.reset();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Product could not be created.");
    }
  }

  async function addVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const cost = String(data.get("costPrice") || "");
      const created = await createProductVariant(selected.id, {
        name: String(data.get("name")),
        sku: String(data.get("sku")),
        price: Number(data.get("price")),
        costPrice: cost ? Number(cost) : undefined,
        inventory: Number(data.get("inventory") || 0)
      });
      const updated = { ...selected, variants: [...(selected.variants ?? []), created] };
      setSelected(updated);
      setCatalog((current) => current ? {
        ...current,
        products: current.products.map((item) => item.id === updated.id ? updated : item)
      } : current);
      form.reset();
      setMessage(`${created.name} option added.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Product option could not be added.");
    }
  }

  async function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const target = String(data.get("target") || "base");
    try {
      await adjustInventory({
        productId: selected.id,
        variantId: target === "base" ? undefined : target,
        quantity: Number(data.get("quantity")),
        reason: String(data.get("reason"))
      });
      const nextCatalog = await fetchAdminCatalog();
      setCatalog(nextCatalog);
      setSelected(nextCatalog.products.find((item) => item.id === selected.id) ?? null);
      form.reset();
      setMessage("Inventory adjustment posted to the ledger.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Inventory could not be adjusted.");
    }
  }

  async function addGalleryImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !galleryImage) {
      setMessage("Upload an image before adding it to the gallery.");
      return;
    }
    const data = new FormData(event.currentTarget);
    try {
      const created = await addProductImage(selected.id, {
        url: galleryImage,
        alt: String(data.get("alt") || selected.name),
        position: selected.images?.length ?? 0
      });
      const updated = { ...selected, images: [...(selected.images ?? []), created] };
      setSelected(updated);
      setCatalog((current) => current ? {
        ...current,
        products: current.products.map((item) => item.id === updated.id ? updated : item)
      } : current);
      setGalleryImage("");
      setMessage("Gallery image added.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Gallery image could not be added.");
    }
  }

  async function removeGalleryImage(id: string) {
    if (!selected) return;
    try {
      await deleteProductImage(selected.id, id);
      const updated = { ...selected, images: (selected.images ?? []).filter((item) => item.id !== id) };
      setSelected(updated);
      setCatalog((current) => current ? {
        ...current,
        products: current.products.map((item) => item.id === updated.id ? updated : item)
      } : current);
      setMessage("Gallery image removed.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Gallery image could not be removed.");
    }
  }

  async function editGalleryImage(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    try {
      const updatedImage = await updateProductImage(selected.id, id, {
        alt: String(data.get("alt") || ""),
        position: Number(data.get("position") || 0)
      });
      const updated = {
        ...selected,
        images: (selected.images ?? [])
          .map((item) => item.id === id ? updatedImage : item)
          .sort((a, b) => a.position - b.position)
      };
      setSelected(updated);
      setMessage("Gallery details updated.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Gallery details could not be updated.");
    }
  }

  async function editVariant(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    try {
      const updatedVariant = await updateProductVariant(selected.id, id, {
        name: String(data.get("name")),
        sku: String(data.get("sku")),
        price: Number(data.get("price")),
        costPrice: Number(data.get("costPrice") || 0),
        compareAt: Number(data.get("compareAt") || 0),
        isActive: data.get("isActive") === "on"
      });
      const updated = {
        ...selected,
        variants: (selected.variants ?? []).map((item) => item.id === id ? updatedVariant : item)
      };
      setSelected(updated);
      setMessage(`${updatedVariant.name} updated.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Product option could not be updated.");
    }
  }

  async function removeVariant(id: string) {
    if (!selected) return;
    try {
      await deleteProductVariant(selected.id, id);
      await load();
      setSelected((current) => current ? {
        ...current,
        variants: (current.variants ?? []).map((item) => item.id === id ? { ...item, isActive: false } : item)
      } : current);
      setMessage("Product option removed or archived.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Product option could not be removed.");
    }
  }

  async function archiveProduct() {
    if (!selected || !window.confirm(`Archive ${selected.name}?`)) return;
    try {
      await deleteAdminResource("products", selected.id);
      await load();
      setSelected(null);
      setMessage("Product archived.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Product could not be archived.");
    }
  }

  if (loading && !catalog) return <AdminLoading label="Loading products and stock..." />;
  if (error && !catalog) return <AdminError message={error} retry={() => void load()} />;
  if (!catalog) return null;

  return (
    <div className="admin-page">
      <AdminPageTitle
        eyebrow="Catalog operations"
        title="Products and inventory"
        description="Create products, maintain pricing and media, and protect stock availability."
        actions={
          <>
            {canManageCatalog ? (
              <button className="primary-action" type="button" onClick={() => { setCreating(true); setSelected(null); }}>
                <Plus size={17} /> Add product
              </button>
            ) : null}
            <button className="admin-icon-button" type="button" onClick={() => void load()} title="Refresh inventory">
              <RefreshCw size={17} />
            </button>
          </>
        }
      />

      <section className="admin-summary-strip">
        <div><small>Active products</small><strong>{summary.active}</strong></div>
        <div><small>Low stock</small><strong>{summary.low}</strong></div>
        <div><small>Out of stock</small><strong>{summary.out}</strong></div>
        <div><small>Missing costs</small><strong>{summary.missingCost}</strong></div>
        <div><small>Retail stock value</small><strong>{formatMoney(summary.retailValue)}</strong></div>
      </section>

      {message ? <p className="admin-message">{message}</p> : null}

      <div className={`admin-inventory-workspace ${selected || creating ? "has-detail" : ""}`}>
        <section>
          <div className="admin-filterbar compact">
            <label className="admin-search">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" />
            </label>
            <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
              <option value="">All inventory</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
              <option value="healthy">Healthy stock</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <AdminSectionHeader title={`${products.length} products`} description="Select a product to update stock, cost, visibility, or merchandising." />
          <div className="admin-table-wrap">
            <table className="admin-table admin-products-table">
              <thead><tr><th>Product</th><th>Status</th><th>Price</th><th>Cost</th><th>Stock</th><th /></tr></thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className={selected?.id === product.id ? "selected" : ""}
                    onClick={() => openProduct(product)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openProduct(product);
                      }
                    }}
                  >
                    <td>
                      <div className="admin-product-cell">
                        <span>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <Boxes size={19} />}</span>
                        <div><strong>{product.name}</strong><small>{product.category?.name ?? "Uncategorized"} · {product.brand?.name ?? "No brand"}</small></div>
                      </div>
                    </td>
                    <td><StatusBadge value={product.status ?? "ACTIVE"} kind="product" /></td>
                    <td>{formatMoney(product.price)}</td>
                    <td>{product.costPrice == null ? <span className="admin-cell-alert">Missing</span> : formatMoney(product.costPrice)}</td>
                    <td className={product.inventory <= 20 ? "admin-cell-alert" : ""}>{product.inventory}</td>
                    <td><button type="button" title={`Edit ${product.name}`} onClick={(event) => { event.stopPropagation(); openProduct(product); }}><Pencil size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {selected ? (
          <aside className="admin-product-editor">
            <div className="admin-detail-head">
              <div><span>Edit product</span><h2>{selected.name}</h2></div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close product editor"><X size={18} /></button>
            </div>
            <nav className="admin-editor-nav" aria-label="Product editor sections">
              {canManageCatalog ? <button type="button" className={editorSection === "general" ? "active" : ""} onClick={() => setEditorSection("general")}>General</button> : null}
              {canAdjustInventory ? <button type="button" className={editorSection === "stock" ? "active" : ""} onClick={() => setEditorSection("stock")}>Stock</button> : null}
              {canManageCatalog ? <button type="button" className={editorSection === "options" ? "active" : ""} onClick={() => setEditorSection("options")}>Options</button> : null}
              {canManageCatalog ? <button type="button" className={editorSection === "media" ? "active" : ""} onClick={() => setEditorSection("media")}>Media</button> : null}
            </nav>
            {selected.inventory <= 20 ? (
              <p className="admin-stock-warning"><AlertTriangle size={16} /> This product is at or below the low-stock threshold.</p>
            ) : null}
            {canManageCatalog && editorSection === "general" ? <form className="admin-editor-form admin-product-core-form" id="product-editor-general" onSubmit={saveProduct} key={`${selected.id}-${selected.costPrice}`}>
              <label>Product name<input name="name" defaultValue={selected.name} required /></label>
              <label>Description<textarea name="description" defaultValue={selected.description} required /></label>
              <div className="form-grid">
                <label>Selling price<input type="number" name="price" min="1" step="0.01" defaultValue={selected.price} required /></label>
                <label>Unit cost<input type="number" name="costPrice" min="0" step="0.01" defaultValue={selected.costPrice ?? ""} placeholder="Required for margin" /></label>
              </div>
              <div className="form-grid">
                <label>Compare price<input type="number" name="compareAt" min="0" step="0.01" defaultValue={selected.compareAt ?? ""} /></label>
                <label>Badge<input name="badge" defaultValue={selected.badge ?? ""} /></label>
              </div>
              <div className="form-grid">
                <label>Brand<select name="brandId" defaultValue={selected.brandId ?? ""}><option value="">No brand</option>{catalog.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
                <label>Category<select name="categoryId" defaultValue={selected.categoryId ?? ""}><option value="">No category</option>{catalog.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              </div>
              <label>Tags<input name="tags" defaultValue={selected.tags.join(", ")} /></label>
              <label>Visibility
                <select name="status" defaultValue={selected.status ?? "ACTIVE"}>
                  <option value="ACTIVE">Active</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
              <div className="check-row two">
                <label><input type="checkbox" name="isNew" defaultChecked={selected.isNew} /> Newly launched</label>
                <label><input type="checkbox" name="isTrending" defaultChecked={selected.isTrending} /> Trending</label>
                <label><input type="checkbox" name="isBestSelling" defaultChecked={selected.isBestSelling} /> Best selling</label>
                <label><input type="checkbox" name="isCertified" defaultChecked={selected.isCertified} /> Certified</label>
              </div>
              <div className="admin-editor-sticky-actions">
                <button className="secondary-action" type="button" onClick={() => void archiveProduct()}><Trash2 size={16} /> Archive</button>
                <button className="primary-action" type="submit" disabled={saving}>{saving ? "Saving..." : "Save product"}</button>
              </div>
            </form> : null}

            {canAdjustInventory && editorSection === "stock" ? <><div className="admin-editor-divider" id="product-editor-stock">
              <span>Inventory adjustment</span>
            </div>
            <form className="admin-editor-form" onSubmit={submitAdjustment}>
              <label>Stock target
                <select name="target" defaultValue="base">
                  <option value="base">Base product ({selected.inventory})</option>
                  {(selected.variants ?? []).map((variant) => (
                    <option value={variant.id} key={variant.id}>
                      {variant.name} ({variant.inventory})
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>Change<input name="quantity" type="number" placeholder="+10 or -2" required /></label>
                <label>Reason<input name="reason" placeholder="Stock count correction" required /></label>
              </div>
              <button className="secondary-action full" type="submit">Post adjustment</button>
            </form></> : null}

            {canManageCatalog && editorSection === "options" ? <><div className="admin-editor-divider" id="product-editor-options">
              <span>Product options</span>
            </div>
            <form
              className="admin-editor-form admin-base-option-form"
              onSubmit={saveBaseOption}
              key={`${selected.id}-${selected.baseOptionEnabled}-${selected.baseOptionLabel}`}
            >
              <label className="check-row">
                <input
                  name="baseOptionEnabled"
                  type="checkbox"
                  defaultChecked={selected.baseOptionEnabled !== false}
                />
                Sell the original product alongside its options
              </label>
              <label>
                Original option label
                <input
                  name="baseOptionLabel"
                  defaultValue={selected.baseOptionLabel ?? ""}
                  placeholder={selected.name}
                />
                <small>Shown in the option chooser. Leave blank to use the product name.</small>
              </label>
              <p className="muted-copy">
                Turn this off only when customers must choose one of the options below.
              </p>
              <button className="secondary-action full" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save original option"}
              </button>
            </form>
            {(selected.variants ?? []).length ? (
              <div className="admin-option-list">
                {selected.variants?.map((variant) => (
                  <form key={variant.id} onSubmit={(event) => void editVariant(event, variant.id)}>
                    <div className="form-grid">
                      <label>Option name<input name="name" defaultValue={variant.name} required /></label>
                      <label>SKU<input name="sku" defaultValue={variant.sku} required /></label>
                    </div>
                    <div className="form-grid">
                      <label>Selling price<input name="price" type="number" min="0" step="0.01" defaultValue={variant.price} required /></label>
                      <label>Unit cost<input name="costPrice" type="number" min="0" step="0.01" defaultValue={variant.costPrice ?? ""} /></label>
                    </div>
                    <label>Compare price<input name="compareAt" type="number" min="0" step="0.01" defaultValue={variant.compareAt ?? ""} /></label>
                    <label className="check-row"><input name="isActive" type="checkbox" defaultChecked={variant.isActive} /> Active · {variant.inventory} in stock</label>
                    <button type="submit">Save option</button>
                    <button type="button" onClick={() => void removeVariant(variant.id)} title={`Remove ${variant.name}`}><Trash2 size={15} /></button>
                  </form>
                ))}
              </div>
            ) : <p className="muted-copy">No size or pack options yet.</p>}
            <form className="admin-editor-form" onSubmit={addVariant}>
              <div className="form-grid">
                <label>Option name<input name="name" placeholder="500 g" required /></label>
                <label>SKU<input name="sku" placeholder="HONEY-500" required /></label>
              </div>
              <div className="form-grid">
                <label>Price<input name="price" type="number" min="0" step="0.01" required /></label>
                <label>Unit cost<input name="costPrice" type="number" min="0" step="0.01" /></label>
              </div>
              <label>Opening stock<input name="inventory" type="number" min="0" defaultValue="0" /></label>
              <button className="secondary-action full" type="submit">Add option</button>
            </form></> : null}

            {canManageCatalog && editorSection === "media" ? <>
            <div className="admin-editor-divider" id="product-editor-gallery">
              <span>Product gallery</span>
            </div>
            {(selected.images ?? []).length ? (
              <div className="admin-gallery-preview">
                {selected.images?.map((image) => (
                  <span key={image.id}>
                    <img src={image.url} alt={image.alt ?? ""} />
                    <button type="button" onClick={() => void removeGalleryImage(image.id)} aria-label={`Remove ${image.alt ?? "gallery image"}`}><Trash2 size={14} /></button>
                    <form onSubmit={(event) => void editGalleryImage(event, image.id)}>
                      <label>Image description<input name="alt" defaultValue={image.alt ?? ""} placeholder="Describe what this image shows" /></label>
                      <label>Display order<input name="position" type="number" min="0" defaultValue={image.position} /></label>
                      <button type="submit">Save</button>
                    </form>
                  </span>
                ))}
              </div>
            ) : null}
            <form className="admin-editor-form" onSubmit={addGalleryImage}>
              <AdminUploadField label="Gallery image" value={galleryImage} onChange={setGalleryImage} onMessage={setMessage} recommendedDimensions="1200 x 1200 px" />
              <label>Alternative text<input name="alt" placeholder={selected.name} /></label>
              <button className="secondary-action full" type="submit">Add to gallery</button>
            </form></> : null}
          </aside>
        ) : null}

        {creating ? (
          <aside className="admin-create-product">
            <div className="admin-detail-head">
              <div><span>Catalog</span><h2>New product</h2></div>
              <button type="button" onClick={() => { setCreating(false); setProductImages([]); }} aria-label="Close new product form"><X size={18} /></button>
            </div>
            <form className="admin-editor-form" onSubmit={createProduct}>
              <label>Product name<input name="name" required /></label>
              <label>Description<textarea name="description" required /></label>
              <div className="form-grid">
                <label>Price<input name="price" type="number" step="0.01" min="1" required /></label>
                <label>Unit cost<input name="costPrice" type="number" step="0.01" min="0" /></label>
              </div>
              <div className="form-grid">
                <label>Compare price<input name="compareAt" type="number" step="0.01" min="1" /></label>
                <label>Opening stock<input name="inventory" type="number" min="0" defaultValue="0" /></label>
              </div>
              <label className="check-row">
                <input name="baseOptionEnabled" type="checkbox" defaultChecked />
                Keep this original product available if options are added later
              </label>
              <label>
                Original option label
                <input name="baseOptionLabel" placeholder="Defaults to the product name" />
                <small>For example: Standard pack, 1 kg tin, or Original.</small>
              </label>
              <label>Brand<select name="brandId" defaultValue=""><option value="">No brand</option>{catalog.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
              <label>Category<select name="categoryId" defaultValue=""><option value="">No category</option>{catalog.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <AdminMultiUploadField label="Product images" values={productImages} onChange={setProductImages} onMessage={setMessage} recommendedDimensions="1200 x 1200 px" />
              <label>Badge<input name="badge" /></label>
              <label>Tags<input name="tags" placeholder="honey, organic, gift" /></label>
              <div className="check-row two">
                <label><input name="isNew" type="checkbox" defaultChecked /> Newly launched</label>
                <label><input name="isTrending" type="checkbox" /> Trending</label>
                <label><input name="isBestSelling" type="checkbox" /> Best selling</label>
                <label><input name="isCertified" type="checkbox" /> Certified</label>
              </div>
              <div className="admin-editor-sticky-actions">
                <button className="secondary-action" type="button" onClick={() => { setCreating(false); setProductImages([]); }}>Cancel</button>
                <button className="primary-action" type="submit"><PackagePlus size={17} /> Create product</button>
              </div>
            </form>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
