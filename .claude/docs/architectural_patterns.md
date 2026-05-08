# Architectural Patterns

Recurring patterns found across multiple files. Follow these when adding pages or components.

---

## Component Structure

Every `.astro` component has three zones: frontmatter (server logic), HTML, scoped `<style>` block.

**Props interface + destructuring with defaults** — used in every layout and component:
- `src/layouts/BaseLayout.astro:8-18` — `Props` interface, destructure with default `description` and `ogImage`
- `src/layouts/PageLayout.astro:1-10` — `pageTitle`, `pageSubtitle`, `label`, `bgClass` props

```astro
interface Props { title: string; description?: string; }
const { title, description = 'fallback' } = Astro.props;
```

---

## Two-Layout System

All public pages use a two-layer nesting:
1. **`BaseLayout.astro`** — `<html>` shell, SEO meta, Nav, Footer, WhatsAppButton, CookieBanner, seasonal bar
2. **`PageLayout.astro`** — wraps `BaseLayout`, adds hero header with background image, dark overlay, title, subtitle

`index.astro` uses `BaseLayout` directly (custom hero). Every other public page uses `PageLayout`.

**Exception — Admin pages** (`src/pages/admin/`): bypass both layouts entirely. They render a fully custom `<!DOCTYPE html>` shell with `<meta name="robots" content="noindex, nofollow">`, a branded `adm-header`, and no Nav/Footer. They import only `global.css` for base tokens. Do not wrap admin pages in BaseLayout.

---

## Section Container Pattern

Every content section across all pages follows this structure:

```astro
<section class="section">        <!-- vertical padding preset -->
  <div class="container">        <!-- max-width: 1180px, centered -->
    <!-- content -->
  </div>
</section>
```

Seen in: `src/pages/index.astro`, `src/pages/apartment.astro`, `src/pages/gallery.astro`, and every other page.

---

## Section Label + Heading Pattern

Every content section opens with an eyebrow label followed by an `<h2>`:

```astro
<span class="section-label">Overview</span>
<h2>A Semi-Penthouse Above the Adriatic</h2>
```

`src/pages/apartment.astro:19,45,62,83,105,125` — used 6 times on that page alone.

---

## Alternating Two-Column Layout

Property details pages use a grid that reverses column order on alternating sections:

```astro
<div class="apt-grid">            <!-- image left, text right -->
  <div>…content…</div>
  <div class="img-ph …">…</div>
</div>
<div class="apt-grid apt-grid--reverse">  <!-- text left, image right -->
```

`src/pages/apartment.astro:17,40,60,78,103` — used 5 times.

---

## Astro `<Image>` Component Pattern

Gallery and carousels use Astro's built-in `<Image>` component for build-time optimization. Images live in `src/assets/gallery/` — Astro processes them and emits optimized output.

**Import and use:**
```astro
---
import { Image } from 'astro:assets';
import heroBg from '../assets/gallery/terrace-12.jpg';
---
<Image src={heroBg} alt="Terrace with sea view"
  widths={[400, 700, 1100]}
  sizes="(max-width: 900px) 100vw, 50vw" />
```

**Glob import** (used in gallery to load a folder dynamically):
```astro
const galleryImages = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/gallery/*.{jpg,jpeg,png}',
  { eager: true }
);
const img = (filename: string) =>
  galleryImages[`../assets/gallery/${filename}`]?.default;
```

Used in: `src/pages/gallery.astro`, `src/pages/apartment.astro`, `src/pages/about-mandre.astro`

---

## Image Placeholder Pattern

Some page sections not yet replaced with real photos use CSS placeholder `<div>` elements:

```astro
<div class="img-ph ph-terrace ar-4-3" aria-hidden="true">
  <span class="ph-icon">📷</span>
  <span class="ph-label">Terrace with Hot Tub</span>
</div>
```

Modifier classes: `.ph-terrace`, `.ph-sea`, `.ph-interior`, `.ph-bedroom`, `.ph-kitchen`  
Aspect ratio classes: `.ar-4-3`, `.ar-16-9`, `.ar-hero`  
Defined at: `src/styles/global.css:207`

When replacing with real images, swap the `<div>` for an `<Image>` component (see pattern above) keeping the aspect-ratio wrapper class.

---

## Carousel Pattern

Multi-image carousels with prev/next buttons, dot indicators, keyboard arrows, and touch swipe. The carousel logic is an inline `<script>` block per page — there is no shared carousel component.

```astro
<div class="carousel" id="overview-carousel">
  <div class="carousel__track">
    <div class="carousel__slide">
      <Image src={photo1} alt="…" widths={[400, 700, 1100]} sizes="(max-width: 900px) 100vw, 50vw" />
    </div>
    <!-- more slides -->
  </div>
  <button class="carousel__btn carousel__btn--prev" aria-label="Previous image">&#8249;</button>
  <button class="carousel__btn carousel__btn--next" aria-label="Next image">&#8250;</button>
  <div class="carousel__dots">
    <button class="carousel__dot carousel__dot--active" aria-label="Slide 1"></button>
    <!-- more dots -->
  </div>
</div>
```

When a page has multiple carousels, each gets a unique `id` so the JS can scope to that container. The inline script initialises all carousels on the page by iterating over `.carousel` elements.

Used in: `src/pages/apartment.astro` (5 carousels), `src/pages/about-mandre.astro` (4 carousels)

---

## Gallery Lightbox (Modal) Pattern

Full-screen image viewer on the gallery page. The modal is rendered once in the HTML; JS populates it dynamically on item click.

```astro
<div id="galleryModal" class="gallery-modal"
     role="dialog" aria-modal="true" aria-hidden="true" aria-label="Image viewer">
  <div class="gallery-modal__backdrop" id="modalBackdrop"></div>
  <button class="gallery-modal__close" id="modalClose" aria-label="Close">…</button>
  <button class="gallery-modal__nav gallery-modal__nav--prev" id="modalPrev" aria-label="Previous image">…</button>
  <div class="gallery-modal__stage" id="modalStage"></div>
  <button class="gallery-modal__nav gallery-modal__nav--next" id="modalNext" aria-label="Next image">…</button>
  <div class="gallery-modal__caption" id="modalCaption"></div>
</div>
```

JS handles: open/close, prev/next navigation, Escape and arrow key support, touch swipe, dynamic stage sizing. `.is-open` class is toggled to show/hide the modal.

Used in: `src/pages/gallery.astro`

---

## Navigation Data as Constants

Nav links and language options are defined as arrays, then `.map()`-rendered. This keeps the nav and footer in sync:

- `src/components/Nav.astro:2-21` — `navLinks` array, `languages` array
- `src/components/Footer.astro:2-12` — parallel `footerLinks` array

```astro
const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/apartment', label: 'Apartment' },
];
{navLinks.map(link => <li><a href={link.href}>{link.label}</a></li>)}
```

---

## Vanilla JS Interactivity

No frontend framework — all interactivity is inline `<script>` blocks with DOM APIs:

- Burger menu toggle: `src/components/Nav.astro:257-279`
- Language dropdown: `src/components/Nav.astro:280-295`
- Cookie consent with `localStorage`: `src/components/CookieBanner.astro:76-105`
- Gallery category filter: `src/pages/gallery.astro` (script block at end of file)

---

## CSS Design System

**Global custom properties** (`src/styles/global.css:4-29`):

| Variable | Value | Use |
|----------|-------|-----|
| `--sky-blue` | `#4A9FD4` | Primary accent |
| `--ocean-blue` | `#1A5FAD` | Primary dark |
| `--deep-navy` | `#081628` | Footer / hero overlays |
| `--warm-sand` | `#F7EDD8` | Alternate section backgrounds |
| `--sunset-gold` | `#E8A82A` | Highlight accents |
| `--radius` | `12px` | All rounded corners |
| `--transition` | `0.3s ease` | All hover transitions |

**Utility classes** (`src/styles/global.css:68-204`):
- `.container` — centered max-width wrapper
- `.section`, `.section-sm`, `.section-lg` — vertical padding presets
- `.btn`, `.btn-primary`, `.btn-sky`, `.btn-white`, `.btn-gold` — button variants
- `.card` — box-shadow card with hover lift
- `.grid-2`, `.grid-3`, `.grid-4` — responsive CSS grid layouts
- `.section-label` — uppercase eyebrow text
- `.fade-up`, `.fade-up-1` through `.fade-up-4` — staggered entrance animations

---

## BEM-like CSS Naming

Component-scoped styles use BEM conventions:
- `__` for child elements: `.hero__title`, `.hero__overlay`, `.apt-highlight__grid`
- `--` for variants: `.price-card--peak`, `.price-card--shoulder`, `.apt-grid--reverse`
- Base class + modifier never mixed into global styles — always scoped to the component's `<style>` block

---

## Responsive Breakpoints

Two consistent breakpoints used across all component `<style>` blocks:

```css
@media (max-width: 960px) { /* tablet */ }
@media (max-width: 580px) { /* mobile */ }
```

Some components use `860px` as a component-specific mid-break, but 960/580 are the system standards.

---

## Wave SVG Dividers

Curved SVG waves separate sections with different background colors:

```astro
<div class="wave">
  <svg viewBox="0 0 1440 56" preserveAspectRatio="none">
    <path d="M0,28 C240,56 480,0 720,28 C960,56 1200,8 1440,28 L1440,56 L0,56 Z" fill="#F7EDD8"/>
  </svg>
</div>
```

The `fill` color matches the *destination* section's background.  
Used at: `src/pages/index.astro:94-99`, `src/pages/index.astro:132-137`.

---

## SEO Pattern

Every page has its own `title` and `description` passed to `BaseLayout`. `BaseLayout` generates all meta tags, canonical URL, and Open Graph tags from these props (`src/layouts/BaseLayout.astro:20-46`). Defaults are provided if props are omitted.

---

## Worker API Routes

All API routes are handled in `src/worker/index.ts` and delegated to module handlers:

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| POST | `/api/contact` | `contact.ts` | Contact form → owner email via Resend |
| GET | `/api/availability` | `booking.ts` | Returns blocked/pending dates, per-month pricing, season config |
| POST | `/api/booking` | `booking.ts` | Creates reservation in D1, sends owner + guest emails |
| GET | `/api/booking/decide` | `booking.ts` | Owner approve/decline via signed token link in email |
| GET | `/api/booking/resolve` | `booking.ts` | Alias for `/decide` |
| * | `/api/admin/*` | `admin.ts` | Admin dashboard: list reservations, manage blocks, update pricing |

**Env bindings** (defined in `Env` interface in `index.ts`): `ASSETS`, `DB` (D1), `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `CONTACT_TO_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`.

---

## Booking / Availability Data Flow

The booking page fetches live data client-side on load:

```js
const res = await fetch('/api/availability');
const { blocked, pending, pricing, season, minNights, depositPct } = await res.json();
```

`blocked` and `pending` are arrays of ISO date strings used to disable calendar days. `pricing` is a `{month: rate}` map used for price calculation. All this data lives in Cloudflare D1 (`pricing_rules`, `manual_blocks`, `reservations` tables via `src/worker/db.ts`).
