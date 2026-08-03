"use client";

import { HTMLAttributes, ReactNode } from "react";

/* ------------------------------------------------------------------ Card -- */

export function Card({
  raised,
  flush,
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { raised?: boolean; flush?: boolean }) {
  const classes = [
    "ui-card",
    raised ? "ui-card--raised" : "",
    flush ? "ui-card--flush" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-card__header">
      <div>
        <h3 className="ui-card__title">{title}</h3>
        {description ? <p className="ui-card__description">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------------- Badge -- */

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "solid";

export function Badge({
  tone = "neutral",
  icon,
  className = "",
  children
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const classes = ["ui-badge", tone !== "neutral" ? `ui-badge--${tone}` : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes}>
      {icon}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------ EmptyState -- */

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      {icon ? <span className="ui-empty__icon">{icon}</span> : null}
      <h3 className="ui-empty__title">{title}</h3>
      {description ? <p className="ui-empty__description">{description}</p> : null}
      {action}
    </div>
  );
}

/* -------------------------------------------------------------- Skeleton -- */

export function Skeleton({
  width,
  height = 14,
  radius,
  className = ""
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
}) {
  return (
    <span
      className={`ui-skeleton ${className}`.trim()}
      aria-hidden="true"
      style={{
        display: "block",
        width: width ?? "100%",
        height,
        borderRadius: radius
      }}
    />
  );
}

/* ------------------------------------------------------- VisuallyHidden -- */

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="ui-visually-hidden">{children}</span>;
}
