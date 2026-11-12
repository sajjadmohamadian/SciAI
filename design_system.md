# SciAI UI Design System Specification

> **Purpose:** Unify visual tokens, scientific typography, shared React primitives, and page layout patterns across all 26+ studios of **SciAI**.  
> **Language Policy:** Per `AGENTS.md`, all UI labels, component props, and user-facing copy remain in English.

---

## 1. Color Architecture

SciAI uses a calm, high-contrast **Scientific Editorial** palette anchored by Steel Petrol Blue (`#315C7C`) and Warm Alabaster (`#F7F8F6`) instead of generic `slate-*` grays.

| Token (`@theme`) | Hex | Usage |
| :--- | :--- | :--- |
| `brand-500` | `#315C7C` | Primary CTA buttons, active sidebar items, active tabs, focus rings |
| `brand-600` | `#284C67` | Primary button hover state |
| `surface-canvas` | `#FFFFFF` | App shell, data cards, table rows, modals |
| `surface-subtle` | `#F7F8F6` | Studio containers (`sciai-studio-shell`), empty states, sidebar footer |
| `surface-dark` | `#0B1117` | Authentication & Password Gate backdrop |
| `border-default` | `#D8DDD8` | Canonical 1px dividers, card borders, vertical split rules |
| `ink-primary` | `#101820` | Headings, KPI figures, primary table values |
| `ink-secondary` | `#27313C` | Body copy, navigation labels, form labels |
| `ink-muted` | `#5A6570` | Helper descriptions, subtitles, secondary metadata |

### Semantic Status & Data Visualization
- **Success (`completed`, `ready`, `verified`):** `#ECFDF5` bg / `#047857` text / `#A7F3D0` border
- **Info (`running`, `processing`):** `#F0F9FF` bg / `#0369A1` text / `#BAE6FD` border
- **Warning (`partial`, `stale`):** `#FFFBEB` bg / `#B45309` text / `#FDE68A` border
- **Danger (`failed`, `error`):** `#FFF1F2` bg / `#BE123C` text / `#FECDD3` border
- **D3 / Recharts Categorical Sequence (6-hue):** `['#315C7C', '#0D9488', '#D97706', '#6366F1', '#E11D48', '#64748B']`

---

## 2. Typography & Scientific Readability

- **UI Font (`--font-sans`):** `Inter` (loaded in `index.html` or system fallback) for crisp multi-column density.
- **Monospace (`--font-mono`):** `JetBrains Mono` for DOIs, dataset IDs, API routes, and SQLite/audit hashes.
- **Tabular Numerals:** `font-variant-numeric: tabular-nums` is applied globally to `table td`, `table th`, and `.tabular-metrics` so citation counts, h-index, and p-values align vertically.

| Role | Class Pattern |
| :--- | :--- |
| Studio / Page Title | `text-xl font-black tracking-tight text-ink-primary` |
| Section Header | `text-base font-bold tracking-tight text-ink-primary` |
| Micro Kicker / KPI Label | `sciai-kicker` (`11px`, `700`, `uppercase`, `tracking-[0.06em]`) |
| Body / Table Cell | `text-xs leading-relaxed text-ink-secondary` or `text-sm` for forms |

---

## 3. Standard Layout Patterns

1. **Workspace Shell (`App.tsx`):**
   - Fixed `w-72` left `Sidebar` (`bg-white border-r border-border-default`) + sticky `Header` + scrollable main canvas (`p-6 lg:p-8`, max container `space-y-8`).
2. **Two-Column Analysis Studio (`<StudioSplitLayout />`):**
   - Used in `OverviewView`, `ThematicEvolutionStudio`, `FrontierDetectionStudio`, and `NetworkStudio`.
   - Main visualization/results on the left (`1fr`), `1px` vertical divider (`border-default`), and `360px` configuration/provenance inspector on the right.
3. **Workbench Grid (KPIs + Data Table):**
   - Top row: `grid gap-4 sm:grid-cols-2 lg:grid-cols-4` of `<MetricCard />`.
   - Filter bar: `<Tabs />` + `<Input />` / `<Select />`.
   - Primary table/chart inside `<Card />`.
4. **Auth & Gate Shell (`LoginView`, `PasswordChangeGate`):**
   - Centered `max-w-md` `<Card>` (`rounded-3xl p-8`) over `bg-surface-dark`.

---

## 4. Migration Checklist for Existing Studios

1. Replace `src/index.css` with the new `@theme` token file.
2. Replace `src/components/CommonUI.tsx` with the expanded component library (100% backward-compatible with existing imports).
3. Gradually replace hardcoded `bg-[#315C7C]`, `text-[#101820]`, `border-[#D8DDD8]`, and `bg-slate-900` buttons across `Sidebar.tsx`, `LoginView.tsx`, `AdminUsersView.tsx`, and the 26 studios with `bg-brand-500`, `text-ink-primary`, `border-border-default`, and `<Button />` / `<Input />` / `<AlertBanner />`.
