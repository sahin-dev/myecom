"use client";

import { ImagePlus, Images, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { uploadAdminImage } from "../../lib/catalog";

export function useAdminToast() {
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"success" | "error">("success");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const notify = useCallback((text: string, nextKind: "success" | "error" = "success") => {
    setMessage(text);
    setKind(nextKind);
    window.clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 4500);
  }, []);

  return { message, kind, notify };
}

export function AdminToast({ message, kind }: { message: string; kind: "success" | "error" }) {
  if (!message) return null;
  return <p className={`admin-message${kind === "error" ? " is-error" : ""}`}>{message}</p>;
}

export function AdminConfirmDialog({
  title,
  body,
  confirmLabel = "Delete",
  onConfirm,
  onCancel
}: {
  title: string;
  body?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="admin-confirm-overlay" role="dialog" aria-modal="true">
      <div className="admin-confirm-card">
        <h3>{title}</h3>
        {body ? <p>{body}</p> : null}
        <div className="admin-confirm-actions">
          <button type="button" className="secondary-action" onClick={onCancel}>Cancel</button>
          <button type="button" className="danger-action" onClick={onConfirm}><Trash2 size={16} /> {confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export const orderStatuses = [
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED"
];

export const paymentStatuses = ["PENDING", "PAID", "FAILED", "PARTIALLY_REFUNDED", "REFUNDED"];

export const formatStatus = (value?: string | null) =>
  (value ?? "PENDING")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export function StatusBadge({
  value,
  kind = "order"
}: {
  value?: string | null;
  kind?: "order" | "payment" | "product";
}) {
  const normalized = value ?? "PENDING";
  return (
    <span className={`admin-status ${kind} status-${normalized.toLowerCase()}`}>
      {formatStatus(normalized)}
    </span>
  );
}

export function AdminPageTitle({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-page-title">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </header>
  );
}

export function AdminSectionHeader({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function AdminUploadField({
  label,
  name = "imageUrl",
  value,
  onChange,
  onMessage,
  recommendedDimensions = "1200 x 1200 px"
}: {
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onMessage: (message: string) => void;
  recommendedDimensions?: string;
}) {
  const [uploading, setUploading] = useState(false);

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadAdminImage(file);
      onChange(uploaded.url);
      onMessage(`${label} uploaded.`);
    } catch (caught) {
      onMessage(caught instanceof Error ? caught.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="admin-upload">
      <input name={name} type="hidden" value={value} />
      <div className="admin-upload-preview">
        {value ? <img src={value} alt={`${label} preview`} /> : <ImagePlus size={26} />}
      </div>
      <div className="admin-upload-main">
        <div className="admin-upload-title">
          <strong>{label}</strong>
          <span>
            {value
              ? `The current ${label.toLowerCase()} is shown on the left.`
              : `No ${label.toLowerCase()} has been uploaded yet.`}
          </span>
        </div>
        <label>
          <UploadCloud size={17} />
          <span>
            {uploading
              ? "Uploading..."
              : value
                ? `Replace ${label.toLowerCase()}`
                : `Upload ${label.toLowerCase()}`}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => void upload(event.target.files?.[0])}
          />
        </label>
      </div>
      <small className="admin-upload-hint">
        Recommended size: {recommendedDimensions}. Accepted formats: JPG, PNG, or WebP, up to 5 MB.
      </small>
      {value ? (
        <button type="button" onClick={() => onChange("")}>
          Remove
        </button>
      ) : null}
    </div>
  );
}

export function AdminMultiUploadField({
  label,
  values,
  onChange,
  onMessage,
  maxFiles = 10,
  recommendedDimensions = "1200 x 1200 px"
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  onMessage: (message: string) => void;
  maxFiles?: number;
  recommendedDimensions?: string;
}) {
  const [uploading, setUploading] = useState(false);

  async function upload(files?: FileList | null) {
    if (!files?.length) return;
    const available = Math.max(maxFiles - values.length, 0);
    const selected = Array.from(files).slice(0, available);
    if (!selected.length) {
      onMessage(`You can upload up to ${maxFiles} product images.`);
      return;
    }
    setUploading(true);
    const uploaded: Awaited<ReturnType<typeof uploadAdminImage>>[] = [];
    try {
      for (const file of selected) {
        uploaded.push(await uploadAdminImage(file));
      }
      onChange([...values, ...uploaded.map((item) => item.url)]);
      onMessage(`${uploaded.length} ${uploaded.length === 1 ? "image" : "images"} uploaded.`);
    } catch (caught) {
      if (uploaded.length) {
        onChange([...values, ...uploaded.map((item) => item.url)]);
      }
      const reason = caught instanceof Error ? caught.message : "Some images could not be uploaded.";
      onMessage(
        uploaded.length
          ? `${uploaded.length} uploaded before an error: ${reason}`
          : reason
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="admin-multi-upload">
      <div className="admin-multi-upload-head">
        <span><Images size={17} /> {label}</span>
        <small>{values.length}/{maxFiles}</small>
      </div>
      {values.length ? (
        <div className="admin-multi-upload-grid">
          {values.map((url, index) => (
            <span key={url}>
              <img src={url} alt={`Product upload ${index + 1}`} />
              <button
                type="button"
                onClick={() => onChange(values.filter((item) => item !== url))}
                aria-label={`Remove image ${index + 1}`}
              >
                <X size={14} />
              </button>
              <small>{index === 0 ? "Primary image" : `Image ${index + 1}`}</small>
            </span>
          ))}
        </div>
      ) : (
        <div className="admin-multi-upload-empty"><ImagePlus size={24} /> No product images selected</div>
      )}
      <label className="secondary-action full">
        <UploadCloud size={17} />
        <span>{uploading ? "Uploading images..." : "Choose multiple images"}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={uploading || values.length >= maxFiles}
          onChange={(event) => {
            void upload(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <p className="form-note">
        Recommended size: {recommendedDimensions}. Use the same aspect ratio for every image.
        The first image is the primary product image and ordering follows the selection order.
      </p>
    </div>
  );
}

export function AdminForm({
  title,
  onSubmit,
  children,
  submitLabel = "Save"
}: {
  title: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  submitLabel?: string;
}) {
  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <div className="admin-form-title">
        <h2>{title}</h2>
      </div>
      {children}
      <button className="primary-action full" type="submit">
        <Plus size={17} />
        {submitLabel}
      </button>
    </form>
  );
}

export function AdminLoading({ label = "Loading business data..." }: { label?: string }) {
  return <div className="admin-loading">{label}</div>;
}

export function AdminError({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="admin-error">
      <strong>Data could not be loaded</strong>
      <p>{message}</p>
      {retry ? <button onClick={retry}>Try again</button> : null}
    </div>
  );
}
