"use client";

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Images,
  Plus,
  ShieldAlert,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { FormEvent, ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { uploadAdminImage } from "../../lib/catalog";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

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
  // Same public API as before; the shell is now the shared Modal, so this
  // dialog gains the focus trap, Escape handling and focus restoration the
  // hand-rolled overlay never had.
  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      description={body}
      size="sm"
      icon={
        <span className="ui-modal__icon-glyph is-danger">
          <AlertTriangle size={19} />
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} leadingIcon={<Trash2 size={16} />}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

export function AdminPasswordConfirmDialog({
  title,
  body,
  confirmLabel = "Permanently delete",
  onConfirm,
  onCancel
}: {
  title: string;
  body?: string;
  confirmLabel?: string;
  onConfirm: (password: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const formId = useId();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onConfirm(password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!submitting) onCancel();
      }}
      title={title}
      description={body}
      size="sm"
      icon={
        <span className="ui-modal__icon-glyph is-danger">
          <ShieldAlert size={19} />
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          {/* Lives outside the <form>, so it submits via the form attribute. */}
          <Button
            type="submit"
            form={formId}
            variant="danger"
            disabled={!password}
            loading={submitting}
            leadingIcon={<Trash2 size={16} />}
          >
            {submitting ? "Deleting..." : confirmLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => void handleSubmit(event)}>
        <p className="admin-confirm-warning">
          <ShieldAlert size={15} /> This action is permanent and cannot be undone.
        </p>
        <label className="admin-confirm-password-field">
          <span>Confirm your password to continue</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your account password"
          />
        </label>
        {error ? <p className="admin-confirm-error">{error}</p> : null}
      </form>
    </Modal>
  );
}

export const orderStatuses = [
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERY_FAILED",
  "DELIVERED",
  "CANCELLED"
];

export const paymentStatuses = ["PENDING", "PARTIALLY_PAID", "PAID", "FAILED", "PARTIALLY_REFUNDED", "REFUNDED"];

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
  action,
  icon
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="admin-section-header">
      <div className={icon ? "admin-section-header-text" : undefined}>
        {icon ? <span className="admin-section-icon">{icon}</span> : null}
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
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
        {/* The stored value is just a string, so a CDN link works exactly as an
            uploaded file does — this only exposes what the model already had. */}
        <div className="admin-upload-url">
          <span>or paste a link</span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://cdn.example.com/image.jpg"
            value={value.startsWith("/uploads/") ? "" : value}
            onChange={(event) => onChange(event.target.value.trim())}
          />
        </div>
      </div>
      <small className="admin-upload-hint">
        Recommended size: {recommendedDimensions}. Upload JPG, PNG, or WebP up to 5 MB, or paste an
        https link to an image already hosted on your CDN.
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
      <AdminUrlAdder
        placeholder="https://cdn.example.com/product.jpg"
        buttonLabel="Add link"
        disabled={values.length >= maxFiles}
        onAdd={(url) => {
          if (values.includes(url)) {
            onMessage("That image link is already in the list.");
            return;
          }
          onChange([...values, url]);
        }}
      />
      <p className="form-note">
        Recommended size: {recommendedDimensions}. Use the same aspect ratio for every image.
        The first image is the primary product image and ordering follows the selection order.
        You can upload files or add images already hosted on your CDN by link.
      </p>
    </div>
  );
}

/**
 * Small paired input + button for appending a media URL to a list. Kept
 * separate from the upload fields because both of them need it and the
 * "type then commit" interaction has its own local state.
 */
function AdminUrlAdder({
  placeholder,
  buttonLabel,
  disabled,
  onAdd
}: {
  placeholder: string;
  buttonLabel: string;
  disabled?: boolean;
  onAdd: (url: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();

  function commit() {
    if (!trimmed) return;
    onAdd(trimmed);
    setDraft("");
  }

  return (
    <div className="admin-upload-url">
      <input
        type="url"
        inputMode="url"
        placeholder={placeholder}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // Enter would otherwise submit the surrounding product form.
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
      />
      <button type="button" className="secondary-action" disabled={disabled || !trimmed} onClick={commit}>
        {buttonLabel}
      </button>
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

export function AdminPagination({
  page,
  pages,
  total,
  pageSize,
  onPageChange
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const safePages = Math.max(1, pages);
  const safePage = Math.min(Math.max(1, page), safePages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  return (
    <div className="admin-pagination" aria-label="Pagination">
      <span>Showing {start}-{end} of {total}</span>
      <div>
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <span>Page {safePage} of {safePages}</span>
        <button
          type="button"
          disabled={safePage >= safePages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
          title="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
