import React from "react";
import { X } from "lucide-react";

/* ==========================================================================
   SciAI Design System — Shared UI Primitives
   Target: src/components/CommonUI.tsx
   Backward-compatible with existing exports (StatusBadge, SectionHeader,
   EmptyState, MetricCard, Modal) + standardized Button, Input, Select,
   Card, AlertBanner, Tabs, DataTable, and StudioSplitLayout.
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. Button
   -------------------------------------------------------------------------- */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-500 text-white border border-brand-600/20 hover:bg-brand-600 active:bg-brand-700 shadow-xs",
  secondary:
    "bg-white text-ink-primary border border-border-default hover:bg-surface-subtle active:bg-surface-muted shadow-xs",
  ghost:
    "bg-transparent text-ink-secondary border border-transparent hover:bg-surface-muted hover:text-ink-primary",
  danger:
    "bg-status-danger-text text-white border border-transparent hover:opacity-90 shadow-xs",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-9.5 px-4 text-xs rounded-xl gap-2",
  lg: "h-11 px-5 text-sm rounded-xl gap-2",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

/* --------------------------------------------------------------------------
   2. Form Controls (Input & Select)
   -------------------------------------------------------------------------- */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, className = "", id, ...rest }: InputProps) {
  const inputEl = (
    <input
      id={id}
      className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink-primary placeholder:text-ink-subtle transition-colors focus:border-brand-500 focus:outline-none ${
        error ? "border-status-danger-text" : "border-border-default hover:border-border-strong"
      } ${className}`}
      {...rest}
    />
  );

  if (!label && !hint && !error) return inputEl;

  return (
    <label className="block space-y-1.5">
      {label && <span className="block text-xs font-bold text-ink-secondary">{label}</span>}
      {inputEl}
      {error ? (
        <span className="block text-xs text-status-danger-text">{error}</span>
      ) : (
        hint && <span className="block text-xs text-ink-muted">{hint}</span>
      )}
    </label>
  );
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
}

export function Select({ label, hint, className = "", children, ...rest }: SelectProps) {
  const selectEl = (
    <select
      className={`w-full rounded-xl border border-border-default bg-white px-3.5 py-2.5 text-sm text-ink-primary transition-colors hover:border-border-strong focus:border-brand-500 focus:outline-none ${className}`}
      {...rest}
    >
      {children}
    </select>
  );

  if (!label && !hint) return selectEl;

  return (
    <label className="block space-y-1.5">
      {label && <span className="block text-xs font-bold text-ink-secondary">{label}</span>}
      {selectEl}
      {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

/* --------------------------------------------------------------------------
   3. StatusBadge (Backward-compatible)
   -------------------------------------------------------------------------- */
export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  let tone = "bg-surface-muted text-ink-secondary border-border-default";

  if (["completed", "available", "ready", "active", "verified"].includes(normalized)) {
    tone = "bg-status-success-bg text-status-success-text border-status-success-border";
  } else if (["running", "processing", "pending"].includes(normalized)) {
    tone = "bg-status-info-bg text-status-info-text border-status-info-border animate-pulse";
  } else if (["warning", "partial", "stale"].includes(normalized)) {
    tone = "bg-status-warning-bg text-status-warning-text border-status-warning-border";
  } else if (["failed", "error", "disabled", "revoked"].includes(normalized)) {
    tone = "bg-status-danger-bg text-status-danger-text border-status-danger-border";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

/* --------------------------------------------------------------------------
   4. SectionHeader (Backward-compatible)
   -------------------------------------------------------------------------- */
export function SectionHeader({
  title,
  description,
  kicker,
  action,
}: {
  title: string;
  description?: string;
  kicker?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {kicker && <p className="sciai-kicker mb-1">{kicker}</p>}
        <h2 className="text-base font-bold tracking-tight text-ink-primary">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* --------------------------------------------------------------------------
   5. Card & StudioSplitLayout
   -------------------------------------------------------------------------- */
export function Card({
  children,
  className = "",
  padding = "md",
}: {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}) {
  const pad = { none: "", sm: "p-4", md: "p-5", lg: "p-6" }[padding];
  return <div className={`sciai-card ${pad} ${className}`}>{children}</div>;
}

export function StudioSplitLayout({
  main,
  inspector,
  className = "",
}: {
  main: React.ReactNode;
  inspector: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`sciai-studio-shell ${className}`}>
      <div className="grid gap-0 lg:grid-cols-[1fr_auto_360px]">
        <div className="p-6">{main}</div>
        <div className="hidden w-px bg-border-default lg:block" />
        <aside className="border-t border-border-default bg-white/60 p-6 lg:border-t-0">{inspector}</aside>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   6. MetricCard (Backward-compatible + tabular-metrics)
   -------------------------------------------------------------------------- */
export function MetricCard({
  label,
  value,
  description,
  loading = false,
  icon,
}: {
  label: string;
  value?: string | number;
  description?: string;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="sciai-card p-5 transition-colors hover:border-border-strong">
      <div className="flex items-center justify-between gap-2">
        <span className="sciai-kicker">{label}</span>
        {icon && <span className="text-ink-subtle">{icon}</span>}
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-20 animate-pulse rounded-lg bg-surface-muted" />
      ) : (
        <div className="tabular-metrics mt-3 text-2xl font-black tracking-tight text-ink-primary">{value}</div>
      )}
      {description && <p className="mt-1 truncate text-xs text-ink-muted">{description}</p>}
    </div>
  );
}

/* --------------------------------------------------------------------------
   7. EmptyState (Backward-compatible)
   -------------------------------------------------------------------------- */
export function EmptyState({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-border-default bg-surface-subtle p-8 text-center">
      <div className="mx-auto max-w-sm">
        <h3 className="text-sm font-bold text-ink-primary">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>
        {action && onAction && (
          <Button variant="primary" size="sm" onClick={onAction} className="mt-4">
            {action}
          </Button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   8. AlertBanner
   -------------------------------------------------------------------------- */
export function AlertBanner({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-status-info-bg text-status-info-text border-status-info-border",
    success: "bg-status-success-bg text-status-success-text border-status-success-border",
    warning: "bg-status-warning-bg text-status-warning-text border-status-warning-border",
    danger: "bg-status-danger-bg text-status-danger-text border-status-danger-border",
  }[tone];

  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-xl border px-3.5 py-2.5 text-xs ${styles}`}>
      {title && <p className="mb-0.5 font-bold">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   9. Tabs
   -------------------------------------------------------------------------- */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-xl border border-border-default bg-surface-subtle p-1">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              active
                ? "bg-brand-500 text-white shadow-xs"
                : "text-ink-secondary hover:bg-white hover:text-ink-primary"
            }`}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" && (
              <span
                className={`tabular-metrics rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  active ? "bg-white/20 text-white" : "bg-surface-muted text-ink-muted"
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------------
   10. Modal (Backward-compatible)
   -------------------------------------------------------------------------- */
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dark/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border-default bg-white p-6 shadow-elevated">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <h3 className="text-base font-bold text-ink-primary">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1 text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink-primary cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}