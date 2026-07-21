# SokoOS — UI Design System

| Field | Value |
| --- | --- |
| **Document ID** | SOKO-UI-001 |
| **Version** | 1.0.0 |
| **Status** | Baseline for Implementation |
| **Depends on** | SOKO-SRS-001 (§8), SOKO-API-001 |
| **Package** | `packages/ui` |

---

## 1. Brand

| Attribute | Value |
| --- | --- |
| **Name** | SokoOS |
| **Tagline** | Africa's Offline-First Commerce Platform |
| **Promise** | Sell confidently with or without internet—fast checkout, trustworthy stock, calm admin. |
| **Personality** | Grounded, clear, energetic under pressure; marketplace warmth without carnival clutter. |

**Brand-first rule:** On branded surfaces (login, marketing, empty states), the wordmark **SokoOS** is a hero-level signal. A headline must not overpower the brand. If the first viewport could belong to another product after removing nav chrome, branding is too weak (**SRS §8**).

**Audience cue:** Built for African retail and service counters—intermittent connectivity, mobile money, multi-branch owners, cashiers trained in under 30 minutes (**REQ-NFR-UX-001**, training constraint).

---

## 2. Visual Direction

### 2.1 Direction statement

**Deep forest teal** as the primary operational color; **amber/gold** as a sparse accent for money, success highlights, and focus moments; **stone/sand** surfaces with a subtle woven or grain pattern for atmosphere—not flat white slabs, not neon dashboards.

Commerce should feel like a well-kept open-air market stall at golden hour: solid wood counters, clear prices, shade and light—not a SaaS purple gradient template.

### 2.2 Core palette

| Token | Light | Role |
| --- | --- | --- |
| `--color-brand-primary` | `#0B6E4F` | Primary actions, key chrome, focus rings (teal) |
| `--color-brand-primary-hover` | `#095C42` | Hover/active primary |
| `--color-brand-primary-muted` | `#0B6E4F1A` | Soft fills / selected rows |
| `--color-accent` | `#C4A35A` | Amber/gold accent — **use sparingly** |
| `--color-accent-muted` | `#C4A35A26` | Subtle highlight backgrounds |
| `--color-canvas` | `#F3EFE8` | App canvas (warm stone, **not** `#F4F1EA` cream cliché) |
| `--color-surface` | `#FFFbf7` | Panels / elevated sheets |
| `--color-surface-muted` | `#E8E2D8` | Recessed wells, POS cart rail |
| `--color-ink` | `#1C1917` | Primary text (stone-950) |
| `--color-ink-muted` | `#57534E` | Secondary text |
| `--color-ink-subtle` | `#78716C` | Tertiary / hints |
| `--color-border` | `#D6D0C6` | Hairlines / dividers |
| `--color-success` | `#1B7F4E` | Aligned with brand teal family |
| `--color-warning` | `#B45309` | Caution (not gold-as-warning confusion) |
| `--color-danger` | `#B91C1C` | Destructive / voids |
| `--color-info` | `#0F766E` | Informational |

Terracotta may appear only as an optional **illustration** tint in marketing art—not as a system accent. Prefer `#C4A35A` for interactive accent.

### 2.3 Explicitly avoid

- Purple-on-white or purple→indigo gradient themes  
- Cream `#F4F1EA` + terracotta “AI cliché” pairing as the default system  
- Broadsheet / newspaper layouts (hairline rules everywhere, zero radius, dense columns)  
- Glow stacks, neon glassmorphism, emoji as UI affordances  
- Card-heavy heroes and floating promo badges on imagery  

### 2.4 Atmosphere

- Canvas uses a **subtle sand grain / woven line pattern** (CSS repeating gradient or SVG pattern at ≤4% opacity)—enough to lift flatness, never busy behind product grids.
- POS checkout may reduce pattern intensity for readability under bright shop lighting.
- Photography (when used): real shop counters, produce, mobile-money handoffs, receipt paper—not abstract 3D blobs.

---

## 3. Typography

| Role | Family | Notes |
| --- | --- | --- |
| Display | **Fraunces** | Wordmark lockups, page titles, empty-state headlines |
| UI / body | **Source Sans 3** | All POS and admin chrome, forms, tables, buttons |

**Do not use** Inter, Roboto, Arial, or system-ui as the design-system default stack.

### 3.1 Scale (rem @ 16px root)

| Token | Size | Weight | Use |
| --- | --- | --- | --- |
| `display-lg` | 2.5rem / 40px | Fraunces 600 | Brand hero |
| `display-md` | 2rem / 32px | Fraunces 600 | Section titles |
| `title-lg` | 1.5rem / 24px | Source Sans 600 | Panel titles |
| `title-md` | 1.25rem / 20px | Source Sans 600 | Card/section (interaction containers only) |
| `body-lg` | 1.125rem / 18px | 400 | POS primary readable |
| `body` | 1rem / 16px | 400 | Admin default |
| `body-sm` | 0.875rem / 14px | 400 | Meta, table secondary |
| `label` | 0.75rem / 12px | 600 | Uppercase sparingly; prefer sentence case |
| `numeric` | tabular-nums | 600 | Prices, quantities, totals |

Line-height: display 1.15; body 1.45; dense POS tables 1.3.

---

## 4. Tokens

### 4.1 Spacing (4px base)

| Token | Value |
| --- | --- |
| `space-0` | 0 |
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |

POS uses tighter packing (`space-2`–`space-4`) between product tiles; admin uses airier `space-6` section gaps.

### 4.2 Radius

| Token | Value | Use |
| --- | --- | --- |
| `radius-none` | 0 | Avoid as default |
| `radius-sm` | 4px | Inputs dense |
| `radius-md` | 8px | Buttons, fields |
| `radius-lg` | 12px | Panels, POS cart rail |
| `radius-xl` | 16px | Rare large sheets |
| `radius-full` | 9999px | **Avoid** for chips/pills as decoration; OK for avatar only |

### 4.3 Elevation

Prefer border + slight surface shift over multi-layer shadows.

| Token | Value |
| --- | --- |
| `elevation-0` | none |
| `elevation-1` | `0 1px 2px rgb(28 25 23 / 6%)` |
| `elevation-2` | `0 4px 12px rgb(28 25 23 / 8%)` |
| `elevation-focus` | `0 0 0 3px var(--color-brand-primary-muted)` |

### 4.4 Motion tokens

| Token | Value |
| --- | --- |
| `duration-fast` | 120ms |
| `duration-base` | 200ms |
| `duration-slow` | 320ms |
| `easing-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `easing-emphasized` | `cubic-bezier(0.16, 1, 0.3, 1)` |

### 4.5 Z-index

`base` 0 → `sticky` 10 → `dropdown` 20 → `drawer` 30 → `modal` 40 → `toast` 50 → `spotlight` 60.

---

## 5. Light & Dark Themes

**REQ-NFR-UX-003**, **REQ-ADM-003**

Themes switch via `data-theme="light|dark"` on `documentElement`. Cashier theme toggle must not reset cart or focus (**SRS §8.3**).

### 5.1 Dark mapping (selected)

| Token | Dark |
| --- | --- |
| `--color-canvas` | `#121714` |
| `--color-surface` | `#1A211E` |
| `--color-surface-muted` | `#24302B` |
| `--color-ink` | `#F5F5F4` |
| `--color-ink-muted` | `#A8A29E` |
| `--color-border` | `#2F3D37` |
| `--color-brand-primary` | `#1D9B6F` (lifted for contrast) |
| `--color-accent` | `#D4B56A` |

Maintain WCAG AA contrast for text and interactive controls in both themes. Pattern opacity increases slightly in dark to avoid void-black flatness.

---

## 6. POS — One-Screen Checkout Layout

**REQ-SALES-001**, **REQ-SALES-006…007**, **SRS §8.2**

The sales screen is **one composition**: no nested menus for standard checkout. Everything below stays visible without page navigation.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Brand · Branch · Cashier · Sync pill · Theme · Lock                      │
├───────────────────────────────┬──────────────────────────────────────────┤
│ SEARCH (barcode + name)       │ CART                                     │
│ CATEGORY CHIPS (horizontal)   │  line items (qty steppers)               │
│ PRODUCT GRID (scroll)         │  ──────────────────────────────────────  │
│                               │ TOTALS (subtotal, tax, discount, total) │
│                               │ PAYMENT (tenders + split)                │
│                               │ RECEIPT (print / share)                  │
└───────────────────────────────┴──────────────────────────────────────────┘
```

### 6.1 Region rules

| Region | Rules |
| --- | --- |
| **Search** | Always top-left; autofocus after sale complete; barcode-first; <100ms local feel (**REQ-NFR-PERF-001**) |
| **Categories** | Single horizontal scroller; not a sidebar tree for v1 standard flow |
| **Products** | Large touch tiles (min ~72px height); price prominent; stock badge only if relevant |
| **Cart** | Sticky right rail (~36–40% width on desktop); empty state one sentence + brand quiet |
| **Totals** | Tabular numbers; total is the loudest numeric |
| **Payment** | Tender buttons in-rail; split tender inline—not a maze of modals |
| **Receipt** | Primary post-pay action; print without waiting for cloud (**REQ-SALES-002**) |

### 6.2 Interaction density

- Prefer **inline** quantity and discount edits over modals  
- Destructive void/return: confirm sheet, permission-gated  
- Keyboard shortcuts discoverable (e.g. `F2` search, `F4` pay, `Esc` clear focus)—document in UI  
- Min touch target **44×44px**; cashier primary actions larger  

### 6.3 Cards on POS

**Default: no cards.** Product tiles may use light surface + border for hit area, but avoid shadow stacks. Cart is a rail, not a floating card deck. Hero overlays / promo stickers never sit on the product grid.

### 6.4 Sync affordance

A small status pill (synced / syncing / offline / conflict) lives in the top bar—informational only; cashiers never required to tap “sync” (**REQ-SYNC-002**, **REQ-SYNC-006**).

---

## 7. Admin Dashboard Patterns

**REQ-ADM-001…003**, **REQ-NFR-UX-004**

### 7.1 Shell

```text
┌────────┬─────────────────────────────────────────────┐
│ Side   │ Top: breadcrumb · branch switcher · user    │
│ nav    ├─────────────────────────────────────────────┤
│        │ Page title (Fraunces or title-lg)           │
│        │ One supporting sentence                     │
│        │ Primary action (right)                      │
│        │ Content: table / form / report — one job    │
└────────┴─────────────────────────────────────────────┘
```

- **One job per section:** one headline, one short supporting line, then the working surface.  
- No stat-strip clutter in the first viewport of every page; overview home may show **one** summary row below the title—not a widget festival.  
- Branch switcher always visible for multi-branch users.  
- Responsive: side nav collapses to drawer <1024px.

### 7.2 Data UI

- Tables: sticky header, tabular numbers, row action menus  
- Filters: left-aligned toolbar; avoid pill clouds  
- Forms: single column preferred; group by task; React Hook Form + Zod patterns  
- Empty states: brand-quiet illustration optional; one CTA  

### 7.3 Cards

Allowed when they **contain an interaction** (KPI that drills in, selectable plan, report tile that opens). If removing border/shadow/radius doesn’t hurt understanding, don’t use a card.

---

## 8. Motion Guidelines

Ship **2–3 intentional motions**—presence and hierarchy, not decoration.

1. **Cart line enter/exit (POS)** — 200ms slide+fade when adding/removing lines; reinforces “item accepted” under speed pressure.  
2. **Pay success pulse** — brief accent underline or total numeral settle (320ms emphasized easing) before receipt focus; no confetti.  
3. **Admin route content fade** — 120–200ms opacity/translate-y on main content swap; keeps shell stable.

**Respect `prefers-reduced-motion`:** replace with instant state changes; keep focus management.

Avoid: parallax, continuous ambient loops, staggered cascades on product grids, glow pulses on sync.

---

## 9. Accessibility

**REQ-NFR-UX-002**

| Area | Requirement |
| --- | --- |
| Keyboard | All primary POS and admin flows operable; visible focus rings (`elevation-focus`) |
| Contrast | Text and icons AA against canvas/surface in light and dark |
| Touch | 44px minimum targets; spacing between tenders |
| Semantics | Landmarks (`banner`, `main`, `complementary` for cart); label all inputs |
| Status | Sync/errors via text + icon, not color alone; `aria-live` for pay result |
| Modals | Focus trap; restore focus on close; Esc closes non-destructive |

Cashier training constraint: accessibility must not add nested complexity—shortcuts and large controls serve both speed and a11y.

---

## 10. Component Inventory (`packages/ui`)

Shared library consumed by `desktop-pos` and `admin-dashboard`. Prefer composition over variants explosion. Tailwind + CSS variables from this token set.

### 10.1 Foundations

| Component | Purpose |
| --- | --- |
| `ThemeProvider` | Light/dark + token CSS variables |
| `BrandMark` / `Wordmark` | SokoOS lockup (Fraunces) |
| `AppPattern` | Optional sand-grain background layer |
| `FocusRing` | Shared focus utility |

### 10.2 Primitives

| Component | Notes |
| --- | --- |
| `Button` | solid / outline / ghost / danger; sizes sm/md/lg (lg for POS) |
| `IconButton` | |
| `Input`, `Textarea`, `Select`, `Combobox` | |
| `Checkbox`, `Radio`, `Switch` | |
| `Badge`, `StatusPill` | Sync, stock, sale status |
| `Spinner`, `Skeleton` | |
| `Separator` | |
| `Tooltip`, `Popover` | |
| `Dialog`, `Sheet` | Prefer Sheet for POS confirmations |
| `Toast` | Non-blocking; never required for sale success path |
| `Tabs` | Admin; sparingly on POS |

### 10.3 Data display

| Component | Notes |
| --- | --- |
| `Table`, `DataToolbar` | Admin lists |
| `EmptyState` | One job messaging |
| `Stat` | Single metric; not for POS hero |
| `Money` | Minor-units → formatted currency |
| `DateTime` | Tenant timezone aware |

### 10.4 POS-specific

| Component | Notes |
| --- | --- |
| `PosShell` | Top bar + two-pane layout |
| `ProductSearch` | Barcode + name |
| `CategoryScroller` | |
| `ProductGrid` / `ProductTile` | |
| `CartRail`, `CartLine` | |
| `TotalsBlock` | |
| `TenderPad` | Cash / mobile money / card / split |
| `ReceiptActions` | |
| `SyncStatusPill` | |

### 10.5 Admin-specific

| Component | Notes |
| --- | --- |
| `AdminShell` | Nav + top bar |
| `PageHeader` | Title + one sentence + primary action |
| `BranchSwitcher` | |
| `PermissionGate` | Hide/disable by `domain.action` |
| `ReportFrame` | Filters + export slot |

### 10.6 Form helpers

`FormField`, `FormMessage`, `FormSection` — align with React Hook Form + Zod (**REQ-NFR-SEC-003**).

---

## 11. Implementation Notes

- Tokens live as CSS variables; Tailwind maps to tokens (no raw hex in feature code).  
- Load Fraunces + Source Sans 3 via self-hosted or approved CDN; subset Latin + needed African locale glyphs over time (**REQ-NFR-I18N-002**).  
- Icons: one set (e.g. Lucide) with 1.5–2px stroke; no multicolor icon packs.  
- Plugins may register menu items and routes but **must reuse** `packages/ui` tokens—no parallel palettes.

---

## 12. Phase Gate

Auth and Tenant UI may begin when:

- Tokens and `ThemeProvider` land in `packages/ui`  
- `PosShell` wireframe matches §6  
- Admin `PageHeader` + `AdminShell` match §7  

---

## Document Control

| Version | Date | Notes |
| --- | --- | --- |
| 1.0.0 | 2026-07-21 | Initial UI design system baseline |
