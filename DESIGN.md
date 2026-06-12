---
name: QR Studio
description: Professional dynamic QR code management for teams
colors:
  paper: "1 0 0"
  ink: "0.145 0 0"
  card: "1 0 0"
  card-ink: "0.145 0 0"
  surface-dim: "0.97 0 0"
  surface-ink: "0.556 0 0"
  brand: "0.205 0 0"
  brand-ink: "0.985 0 0"
  accent: "0.97 0 0"
  accent-ink: "0.205 0 0"
  boundary: "0.922 0 0"
  input-stroke: "0.922 0 0"
  focus-ring: "0.708 0 0"
  danger: "0.577 0.245 27.325"
  danger-ink: "0.985 0 0"
  sidebar: "0.985 0 0"
  sidebar-ink: "0.145 0 0"
  sidebar-accent: "0.97 0 0"
  sidebar-accent-ink: "0.985 0 0"
  sidebar-border: "1 0 0 / 10%"
  sidebar-ring: "0.708 0 0"
  chart-1: "0.87 0 0"
  chart-2: "0.556 0 0"
  chart-3: "0.439 0 0"
  chart-4: "0.371 0 0"
  chart-5: "0.269 0 0"
typography:
  display:
    fontFamily: "var(--font-inter), system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "var(--font-inter), system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "var(--font-inter), system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-inter), system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.25
  caption:
    fontFamily: "var(--font-inter), system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "0.02em"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.75rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  2xl: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-primary-hover:
    backgroundColor: "oklch(0.145 0 0 / 0.8)"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.xl}"
    padding: "1rem 1rem"
---

# Design System: QR Studio

## 1. Overview

**Creative North Star: "The Workshop"**

A place where tools hang on the wall, each in its place — sharp, organised, ready. No decoration, just readiness. The workshop doesn't need to announce itself; its purpose is obvious from the arrangement of its surfaces and instruments.

QR Studio is a sober, productive interface for professionals who manage QR codes at scale. It takes after Linear, Raycast, and Vercel: surfaces are flat, content is dense, typography is compact, and colour is reserved almost entirely for functional communication (states, data, interactivity). The interface earns trust through precision — tight alignment, exact spacing, predictable interactions — never through ornament.

This system explicitly rejects: generic blue/white B2B SaaS conventions, decorative gradients, giant hero metrics, glassmorphism, side-stripe borders, and anything that reads as "consumer QR code maker." If an element can be removed without losing information, it must be.

**Key Characteristics:**

- Flat surfaces with thin ring borders for depth
- Grayscale-dominant with a near-black primary and a single reserved red for destructive actions
- Compact information density (8px base grid)
- Typography-driven hierarchy (Inter throughout, weight and size do the work)
- Motion only for state transitions (hover, focus, open/close)

## 2. Colors

**The Workshop Palette.** A restrained, high-contrast neutral system where colour is scarce and therefore meaningful. Chroma is near-zero everywhere except the single red destructive role. The palette reads as monochrome with surgical precision — colour doesn't decorate, it signals.

### Primary / Brand

- **Ink** (`oklch(0.205 0 0)`): The brand anchor. Near-black used for solid primary backgrounds, active nav items, and high-emphasis text. Maps to `--primary`.
- **Paper** (`oklch(1 0 0)`): Base background and card backgrounds in light mode. Pure white at chroma 0. Maps to `--background` and `--card`.

### Neutral

- **Surface Dim** (`oklch(0.97 0 0)`): Secondary and muted background surfaces. Hover states, subtle container fills, alternate rows. Maps to `--secondary` and `--muted`.
- **Surface Ink** (`oklch(0.556 0 0)`): Muted/secondary text, placeholders, non-critical labels. At 55.6% lightness on paper, this hits ~4.6:1 contrast — just above the AA threshold for body text. Maps to `--muted-foreground`.
- **Boundary** (`oklch(0.922 0 0)`): Structural borders, dividers, input strokes at rest. Thin and unobtrusive. Maps to `--border` and `--input`.
- **Focus Ring** (`oklch(0.708 0 0)`): Keyboard focus indicators. Mid-tone gray that's visible on any surface. Maps to `--ring`.

### Semantic

- **Danger** (`oklch(0.577 0.245 27.325)`): Destructive actions, error states, deletion. The only saturated color in the palette — its rarity is the point. Maps to `--destructive`.

### Dark Mode

The dark mode inverts the architecture: Paper becomes near-black (`oklch(0.145 0 0)`), Ink becomes near-white (`oklch(0.985 0 0)`), and Surface Dim becomes a slightly lighter dark (`oklch(0.269 0 0)`). Boundaries shift to `oklch(1 0 0 / 10%)` — white at 10% opacity. The same restraint applies: nowhere does chroma enter the picture except Danger.

### Named Rules

**The Monochrome Discipline.** Colour is for signalling, not decorating. If you're adding a hue that isn't Danger (red for errors), you have a functional justification or you're breaking the system. Charts are the only exception — they use five grayscale steps that respect the same flat restraint.

**The Rarity Rule.** The Danger red appears on ≤2% of any screen. Its saturation makes it findable precisely because everything else is neutral. If danger feels invisible, the answer is better layout and iconography, not more red.

## 3. Typography

**Font Stack:** Inter (via `next/font`) across all roles. No pairing — one family at multiple weights does the work. Inter's compact x-height and open aperture suit the dense, productivity-oriented layout.

**Character:** Technical without being cold. The single-family approach eliminates pairing anxiety and keeps the rhythm consistent from display to caption. Weight distinguishes hierarchy; there is no italic, no condensed, no alternate.

### Hierarchy

- **Display** (Semi-Bold 600, `clamp(1.5rem, 4vw, 2.5rem)`, 1.2): Page titles, section headings. `text-wrap: balance` for even line lengths. Ceiling capped at 2.5rem (40px) — this system doesn't shout.
- **Title** (Semi-Bold 600, `1rem`, 1.4): Card titles, dialog headings, list item titles.
- **Body** (Regular 400, `0.875rem`, 1.5): Long-form content, table cells, descriptions. Max line length 65–75ch. `text-wrap: pretty` to reduce orphans.
- **Label** (Medium 500, `0.8125rem`, 1.25): Button text, form labels, tab labels, small UI copy.
- **Caption** (Regular 400, `0.75rem`, 1.25, tracking 0.02em): Metadata, timestamps, helper text, data table footnotes.

### Named Rules

**The Single-Family Rule.** No font pairing. Inter at every size and weight. Pairing on a contrast axis (serif + sans, geometric + humanist) is an accepted design practice — this system deliberately rejects it. Consistency is the signal.

**The Density Rule.** Body text is 14px, not 16px. Labels are 13px. Captions are 12px. This is intentional: the interface packs more information per viewport, matching the "precise tooling" principle. If a screen feels sparse, the answer is better information architecture, not larger type.

## 4. Elevation

QR Studio is flat by default. Surface-level containers (cards, sidebars, page panels) use thin solid ring borders (`ring-1 ring-foreground/10`) and tonal background shifts (`bg-muted`, `bg-secondary`, `bg-card`) for depth — no shadows. The `ring` approach creates a crisp, precise separation that matches the workshop metaphor: tools are organised on a pegboard, not floating in space.

**Overlay exceptions.** Floating elements that sit above the page (dropdowns, select popups, sheets, toasts) use a measured shadow vocabulary to establish depth against the backdrop. These are the only surfaces that cast shadows — they are temporary overlays, not permanent fixtures.

- **`shadow-md`** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1)`): Dropdown menus, select popups. Medium-depth overlays with a clear anchor point.
- **`shadow-lg`** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1)`): Sheets (slide-in panels). Deep overlays that cover most of the viewport edge.
- **`shadow-sm`** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): Tab active indicators (the raised tab in the default variant).

**In dark mode**, rings use `oklch(1 0 0 / 10%)` — white at 10% opacity — which reads as a subtle glow on the dark surface. Shadows remain but are partially absorbed by the dark backdrop; the ring becomes the more visible depth cue.

### Named Rules

**The Flat-By-Default Rule.** No shadows on surface-level containers. Cards, sidebars, page panels, and dialogs never cast shadows. Overlay elements (dropdowns, select popups, sheets, toasts) are the only exceptions — their temporariness earns the shadow.

## 5. Components

### Buttons

Precise, compact, and confident. Based on `@base-ui/react` button primitive with CVA variants.

- **Shape:** Rounded `lg` (0.625rem / 10px). No pill shapes.
- **Primary (`default`):** Ink background (`oklch(0.205 0 0)`), Paper text (`oklch(0.985 0 0)`). The high-contrast call to action.
- **Hover:** Opacity shift (`hover:bg-primary/80`) — subtle darkening.
- **Focus:** Ring border (`focus-visible:border-ring`) + 3px focus ring (`focus-visible:ring-3 ring-ring/50`).
- **Active:** `translateY(1px)` press — physical feedback without layout shift.
- **Outline:** Paper background, Ink text, Boundary border. Used for secondary actions alongside a primary button.
- **Ghost:** Transparent background. Used in toolbars, table actions, and icon buttons.
- **Destructive:** Ink-on-danger (`bg-destructive/10 text-destructive`). Red text + tinted background — never a full red fill, preserving the Rarity Rule.
- **Disabled:** `opacity-50`, `pointer-events-none`. No special background — the opacity dim is enough.
- **Sizes:** Default (h-8), xs (h-6), sm (h-7), lg (h-9), icon (h-8/w-8). All compact.

### Cards

Room-like containers for grouped information. Used sparingly — cards are not the default layout pattern.

- **Corner Style:** Rounded `xl` (0.75rem / 12px).
- **Background:** `bg-card` (Paper in light mode, `oklch(0.205 0 0)` in dark).
- **Border:** `ring-1 ring-foreground/10` — subtle ring, not a box-shadow.
- **Internal Padding:** 1rem (`px-4 py-4`), with a compact `sm` size at 0.75rem (`px-3 py-3`).
- **Title:** `font-heading text-base font-medium` (16px Semi-Bold).
- **Description:** `text-sm text-muted-foreground` (14px Surface Ink).
- **Footer:** Separated by `border-t bg-muted/50` — a tinted footer bar, not a shadow.

### Inputs / Fields

Clean, border-defined strokes with a single focus shift.

- **Resting Stroke:** 1px solid `var(--border)` (Boundary). Background transparent (inherits surface).
- **Focus:** Stroke switches to `var(--ring)` (Focus Ring) + 3px ring at 50% opacity. No glow, no animation.
- **Error:** `border-destructive` + red focus ring (`aria-invalid:border-destructive`, `aria-invalid:ring-3 ring-destructive/20`). Accompanied by text error message — never colour-only.
- **Disabled:** `opacity-50`, `pointer-events-none`.
- **Placeholder:** `text-muted-foreground` at 4.6:1 contrast — never the washed-out gray default.
- **Size:** `h-8` compact default, matching button height for aligned form rows.

### Navigation (Sidebar)

Vertical sidebar nav on desktop, sheet drawer on mobile.

- **Default State:** `text-muted-foreground` (Surface Ink). `hover:bg-muted hover:text-foreground` — subtle dim background on hover.
- **Active State:** `bg-primary/10 text-primary` (Ink at 10% opacity). No left stripe, no underline, no icon colour shift — just a tinted background.
- **Typography:** `text-sm font-medium` (Label weight).
- **Icon:** `size-4` Lucide icons, same colour as text label (no separate icon colour).
- **Mobile:** Sheet drawer from left, full-height, `w-64`.

### Dialog / Modal

Standard overlay with backdrop and focus trap. Based on `@base-ui/react/dialog`.

- **Backdrop:** `bg-black/10` — black at 10%, with optional `backdrop-blur-xs` on supported browsers. A light tint, not a heavy dim.
- **Content Panel:** Popover background (`bg-popover`) with ring border (`ring-1 ring-foreground/10`), rounded `xl` (0.75rem). Centred in the viewport with `max-w-sm` (384px).
- **Close Button:** Ghost icon button (`size="icon-sm"`) in the top-right corner, using `XIcon`.
- **Header:** `flex flex-col gap-2`. Title uses `font-heading text-base font-medium`, description uses `text-sm text-muted-foreground`.
- **Footer:** `border-t bg-muted/50` tinted bar, `-mx-4 -mb-4` for edge-to-edge coverage. Button group right-aligned on `sm+`.
- **Animation:** Fade-in + zoom-in (95%) on open via `tw-animate-css` at 100ms duration. Symmetric on close.

### Alert Dialog

Focused confirmation dialog for destructive or critical actions. Shares the same backdrop and ring-border pattern as Dialog, with a centred icon/heading layout.

- **Structure:** Title + optional media icon + description + action/cancel button pair. Composed from `@base-ui/react/alert-dialog`.
- **Backdrop:** Identical to Dialog — `bg-black/10`, `backdrop-blur-xs` on supported browsers.
- **Content Panel:** Same Popover styling as Dialog. Default size `max-w-xs` (320px), expanding to `sm:max-w-sm` on larger screens. Compact `sm` size variant available.
- **Header:** Centred on mobile, left-aligned on `sm+`. The optional media icon (destructive icon, warning icon) sits above the title in a `size-10 bg-muted` rounded container.
- **Footer:** Tinted bar identical to Dialog footer. Button pair (Cancel + Confirm) stacked on mobile, inline on `sm+`. Confirm action uses `Button` directly — can accept any button variant, including `destructive`.
- **Animation:** Same fade+zoom as Dialog, 100ms.

### Sheet

Slide-in panel for secondary content — used as the mobile sidebar drawer and for detail panels.

- **Backdrop:** `bg-black/10`, fading in/out at 150ms.
- **Content Panel:** Popover background with ring border. 4 sides supported (top, right, bottom, left). Default width `w-3/4`, capped at `sm:max-w-sm`. Slides in from the chosen edge with a 2.5rem (40px) translate offset — visible travel without excessive distance.
- **Close Button:** Ghost icon button in the top-right corner (top-3 right-3).
- **Header/Footer:** Shorthand layout components with `p-4`.
- **Sidebar mobile variant:** `w-64`, left-anchored, no close button (native Sheet dismiss). Used at `lg:hidden` alongside the desktop fixed sidebar.
- **Animation:** 200ms ease-in-out slide + fade. Reduced motion suppresses all transform.

### Dropdown Menu

Contextual action menu triggered by buttons, avatars, or right-click. Based on `@base-ui/react/menu`.

- **Trigger:** Any interactive element. Typically a ghost button or avatar wrapper.
- **Content Panel:** Popover background with ring border (`ring-1 ring-foreground/10`) and `shadow-md`. Rounded `lg` (0.625rem). Sized to anchor width, minimum 8rem. Controlled via `PopoverPositioner` with configurable side/align.
- **Items:** `rounded-md` padding `px-1.5 py-1`, `text-sm`. Default: `focus:bg-accent focus:text-accent-foreground`. Destructive variant: `text-destructive`, red tint on focus. Checkbox and radio item types include a right-aligned check indicator.
- **Label:** `text-xs font-medium text-muted-foreground`, `px-1.5 py-1`.
- **Separator:** `h-px bg-border`, `-mx-1 my-1`.
- **Shortcut:** Right-aligned `text-xs tracking-widest text-muted-foreground`.
- **Submenu:** Nested flyout, same styling as parent. Chevron right indicator on the submenu trigger.
- **Animation:** Fade-in + zoom-in (95%) at 100ms, with `slide-in-from-top-2` for bottom-anchored menus. Symmetric on close.

### Select

Native-behaving dropdown for choosing from a list of options. Based on `@base-ui/react/select`.

- **Trigger:** `h-8` compact button matching input height. Border, background, focus treatment identical to the Input component. Chevron down icon on the right (`text-muted-foreground`).
- **Content Popup:** Popover background with ring border and `shadow-md`. Rounded `lg`. Sized to anchor width, minimum 9rem. Uses `PopoverPositioner` with configurable side/align.
- **Items:** Same treatment as Dropdown Menu items — `rounded-md`, `px-1.5 py-1`, `text-sm`. Selected item shows a check icon (`CheckIcon`) on the right.
- **Label/Group:** Optional `SelectGroup` with `SelectLabel` (`text-xs text-muted-foreground`). Separator between groups.
- **Scroll buttons:** Chevron up/down arrows when content overflows.
- **Animation:** Fade-in + zoom-in (95%) at 100ms.

### Tabs

Horizontal (default) or vertical tab navigation for switching between content panels. Based on `@base-ui/react/tabs`.

- **List Container (default variant):** Muted background (`bg-muted`), rounded `lg` (0.625rem), inline-flex, `h-8`. 3px padding around items.
- **Tab Trigger:** Compact (`h-[calc(100%-1px)]`), `px-1.5 py-0.5`, `text-sm font-medium`. Default: `text-foreground/60`. Active: `bg-background text-foreground` with subtle `shadow-sm`. Hover: `text-foreground`. Focus ring on keyboard navigation.
- **Line Variant:** Transparent background. Active state indicated by a 2px underline bar (`.after:bg-foreground`) positioned below the tab. No background or shadow on the active tab.
- **Content Panel:** `text-sm`, flex-1, outline-none. Spacing between list and panel is handled by the parent layout (8px gap in `group/tabs`).
- **Vertical orientation:** `flex-col` list, items full-width. Active indicator shifts to the right edge.

### Table

Standard data table with row hover and selection states. Semantic `<table>` wrapped in a horizontal scroll container.

- **Wrapper:** `relative w-full overflow-auto` — horizontal scroll on overflow, no container break.
- **Rows:** `border-b` between rows. `hover:bg-muted/50` row highlight. `data-[state=selected]:bg-muted` for checked/selected rows.
- **Header:** `h-10`, `px-2`, `text-left`, `font-medium text-muted-foreground`. Bottom border via `[&_tr]:border-b`.
- **Cells:** `p-2`, `align-middle`. Compact padding for dense data layouts.
- **Typography:** `text-sm` throughout. Table inherits the Body role (14px).

### Avatar

User and entity avatars with image, fallback initials, badge, and group stacking. Based on `@base-ui/react/avatar`.

- **Shape:** Circular (`rounded-full`), `size-8` by default. Size variants: `sm` (size-6), `lg` (size-10).
- **Fallback:** `bg-muted text-muted-foreground text-sm`. Initials extracted from the user's name (uppercase, 2 characters max).
- **Border:** `after:border after:border-border` pseudo-element — a subtle ring overlay that adapts to dark mode via `mix-blend-mode`.
- **Badge:** Small coloured dot at bottom-right (`size-2.5`), `bg-primary text-primary-foreground`, with `ring-2 ring-background` separation. Scales with avatar size.
- **Group:** `flex -space-x-2` overlapping stack. Each avatar receives `ring-2 ring-background` to separate visually.

### Separator

Thin visual divider for grouping content sections. Based on `@base-ui/react/separator`.

- **Horizontal:** `h-px w-full bg-border`. Used between sidebar sections and within card headers.
- **Vertical:** `w-px self-stretch bg-border`. Used in toolbars and inline actions.
- **No margins** — spacing is owned by the parent layout.

### Progress

Linear progress indicator for loading states, quotas, and usage meters.

- **Track:** `h-2 w-full rounded-full bg-muted`.
- **Fill:** `rounded-full bg-primary`, width transitioned via inline `style` (animating `width` is the single approved layout-property animation — the transition is imperceptible and essential for accuracy).
- **Accessibility:** `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.

### Toast / Sonner

Transient notification system using the `sonner` library, themed to match the design system tokens.

- **Styling:** Toast background = `--popover`, text = `--popover-foreground`, border = `--border`. Rounded corners inherit `--radius`. Tokens are passed as CSS custom properties to the Sonner container.
- **Icons:** Inlined Lucide icons per type — `CircleCheckIcon` (success), `InfoIcon` (info), `TriangleAlertIcon` (warning), `OctagonXIcon` (error), `Loader2Icon` (loading with spin animation).
- **Theme:** Adapts to light/dark/system via `next-themes`.

### Skeleton / Loading

Placeholder shimmer for content that hasn't loaded yet.

- **Style:** `animate-pulse rounded-md bg-muted`. Uses the CSS `pulse` animation (opacity fade, 2s infinite).
- **Usage:** Sized via className to match the expected content dimensions. Composes into structured loading states (table skeleton, card skeleton, etc.).
- **No spinner.** Loading is communicated through skeleton shapes that mirror the final layout — users scan structure, not spinners.

### Empty State

Instructional blank-slate component shown when a list or view has no data. Teach, don't just say "nothing here."

- **Layout:** Centred column, `py-16`, `text-center`.
- **Icon:** `size-16` circular muted container, `size-8` icon in `text-muted-foreground`. Defaults to `InboxIcon`.
- **Title:** `text-base font-medium text-foreground`.
- **Description:** `text-sm text-muted-foreground`, `max-w-sm` — one to two sentences about what to do.
- **Action:** Optional CTA button (default variant, size sm) — either a `Link` (href-based) or `Button` (onClick-based). Matches the primary button style.

### Page Header

Consistent top-of-page title bar for authenticated surfaces.

- **Layout:** `flex flex-wrap items-start justify-between gap-4`. Title and actions on opposite sides, wrapping on narrow viewports.
- **Title:** `text-2xl font-bold tracking-tight text-foreground` — the display role at fixed 2xl (32px), not fluid. Product register fixity applies.
- **Description:** `text-sm text-muted-foreground` — optional subtitle below the title.
- **Actions:** `flex items-center gap-2` — toolbar of buttons, dropdowns, or filters aligned to the right.

### Chips / Badges

Small metadata indicators used for plan tier, QR status, and tags.

- **Shape:** Inline rounded (`rounded-md` by default, `rounded-sm` for badges).
- **Default Variant:** `bg-muted text-muted-foreground` — muted fill, Surface Ink text.
- **Outline Variant:** `border border-border text-foreground` — transparent fill, Ink text.
- **No colour variants.** Status changes are communicated through text, icon, or layout, not badge colour.

## 6. Do's and Don'ts

### Do:

- **Do** use the Ink/Paper contrast axis for primary actions. The near-black on white is the system's strongest signal; reserve it for what matters most.
- **Do** use Surface Ink (`oklch(0.556 0 0)`) for secondary text — it provides ~4.6:1 contrast against Paper.
- **Do** use `ring-1 ring-foreground/10` for card and container borders. It's crisp, it's uniform, and it works identically in light and dark mode.
- **Do** keep danger colour to ≤2% of any screen. Its rarity makes it discoverable.
- **Do** prefer dense information layouts. 14px body text, 8px grid, compact buttons. Trust the user to parse information quickly.
- **Do** use `text-wrap: balance` on headings and `text-wrap: pretty` on body paragraphs.
- **Do** use skeleton placeholders for loading states — let users scan the structure before data arrives.
- **Do** use the Empty State pattern to teach the interface when a list is empty. Never just "nothing here."
- **Do** use `shadow-md` / `shadow-lg` on floating overlays (dropdowns, select popups, sheets) — the Flat-By-Default rule applies to surface-level containers, not temporary overlays.

### Don't:

- **Don't** use the generic blue/white B2B SaaS convention (navy primary, blue accents, rounded everything). QR Studio's palette is grayscale-dominant with a near-black primary.
- **Don't** add gradient text, glassmorphism, or side-stripe borders. These are banned by name in the design system.
- **Don't** use hero-metric templates (big number, small label, gradient accent). Data is presented in compact tables and sparklines.
- **Don't** use tiny uppercase tracked eyebrow text above every section (`TYPES / STATUS / ABOUT`). One deliberate kicker is voice; an eyebrow on every section is a generative tell.
- **Don't** use numbered section markers (01, 02, 03) unless the content is literally a sequential process.
- **Don't** use identical card grids (icon + heading + text repeated). Vary layout rhythm.
- **Don't** use colour as the only indicator of state. Errors, pauses, and deletions must include text, icons, or patterns.
- **Don't** let text overflow its container. Test heading copy at every breakpoint.
- **Don't** animate layout properties. Use `transform` and `opacity` only.
- **Don't** skip `@media (prefers-reduced-motion: reduce)` — all animations must have a reduced-motion fallback.
