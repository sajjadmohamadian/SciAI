import React from "react";

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  let bg = "bg-slate-100 text-slate-700 border-slate-200";

  if (normalized === "completed" || normalized === "available" || normalized === "ready") {
    bg = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (normalized === "running" || normalized === "processing") {
    bg = "bg-sky-50 text-sky-700 border-sky-200 animate-pulse";
  } else if (normalized === "failed" || normalized === "error") {
    bg = "bg-rose-50 text-rose-700 border-rose-200";
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${bg}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

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
    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
      <div className="mx-auto max-w-sm">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">{description}</p>
        {action && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-4 inline-flex items-center rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition"
          >
            {action}
          </button>
        )}
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  description,
  loading = false,
  icon,
}: {
  label: string;
  value: string | number;
  description: string;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-slate-300">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </div>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className="mt-3 text-2xl font-black text-slate-900 tracking-tight">
        {loading ? (
          <div className="h-8 w-20 animate-pulse rounded bg-slate-100" />
        ) : (
          value
        )}
      </div>
      <div className="mt-1 text-xs text-slate-500 truncate">{description}</div>
    </div>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
