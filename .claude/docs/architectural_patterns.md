# Architectural Patterns

Recurring patterns found across multiple files. Follow these when adding pages or components.

---

## Localized Page Pattern

The site ships in 7 languages, so **every public page is three files**:

```
src/pages/apartment.astro              # English shell → /apartment
src/pages/[lang]/apartment.astro       # Other six     → /hr/apartment, /de/apartment, …
src/components/pages/ApartmentContent.astro   # The actual page body
```

Both shells are thin and do nothing but resolve translations and render the shared component:

```astro
---
// src/pages/apartment.astro — English, unprefixed
import { getTranslations } from '../i18n/utils';
import ApartmentContent from '../components/pages/ApartmentContent.astro';
const T = getTranslations('en');
---
<ApartmentContent lang="en" T={T} />
```

```astro
---
// src/pages/[lang]/apartment.astro — the other six
import { SUPPORTED_LANGS, getTranslations } from '../../i18n/utils';
import ApartmentContent from '../../components/pages/ApartmentContent.astro';

export function getStaticPaths() {
  return SUPPORTED_LANGS.filter(l => l !== 'en').map(lang => ({ params: { lang } }));
}
const { lang } = Astro.params;
const T = getTranslations(lang);
---
<ApartmentContent {lang} T={T} />
```

**Adding a public page means adding all three files** — a `[lang]/` shell that is forgotten produces a 404 in six languages.

### Inside a `*Content.astro`

Every content component takes the same two props and derives a link prefix from them:

```astro
interface Props { lang: string; T: Translations; }
const { lang, T } = Astro.props;
const prefix = lang === 'en' ? '' : `/${lang}`;
```

- **All internal links must use `prefix`** — `href={`${prefix}/directions`}`. A bare `/directions` drops a German visitor back to English.
- **All user-facing text comes from `T`** — never hardcode a string in the component. Convention on longer pages is a short local alias (`const G = T.guestGuide;`).
- Alt text and `aria-label`s that are not visible copy are commonly left in English; visible copy never is.

### Translation files

`src/i18n/utils.ts` exports `SUPPORTED_LANGS` (`en, hr, de, si, it, pl, cz`), `HREFLANG_MAP`, `INTL_LOCALE_MAP`, and `getTranslations(lang)`. The URL codes `si` and `cz` are project-specific — ISO would be `sl`/`cs`, which is what `HREFLANG_MAP` converts them to for SEO tags.

`getTranslations` deep-merges the locale file over `en.json` and skips `null`/`undefined`/`""` as "not yet translated".

**IMPORTANT**: a key missing from a locale file falls back to English instead of failing the build. Copy changes therefore have to be made in **all seven** `src/i18n/*.json` files — add the key to `en.json` first (it is the schema: `type Translations = typeof en`), then translate it in the other six. Nothing in the build will warn you otherwise.

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

`IndexContent.astro` uses `BaseLayout` directly (custom hero). Every other public page uses `PageLayout`. Both take a `lang` prop, which they forward to Nav, Footer and the SEO tags.

**Exception — Admin and crew pages** (`src/pages/admin/`, `src/pages/cleaning/`): bypass both layouts entirely. They render a fully custom `<!DOCTYPE html>` shell with `<meta name="robots" content="noindex, nofollow">`, a branded header (`adm-header` / `crew-header`), and no Nav/Footer. They import only `global.css` for base tokens, are English-only, and have no `[lang]` counterpart. Do not wrap them in BaseLayout.

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

Seen in: `src/components/pages/IndexContent.astro`, `ApartmentContent.astro`, `GalleryContent.astro`, and every other page component.

---

## Section Label + Heading Pattern

Every content section opens with an eyebrow label followed by an `<h2>`:

```astro
<span class="section-label">{T.apartment.overviewLabel}</span>
<h2>{T.apartment.overviewTitle}</h2>
```

`src/components/pages/ApartmentContent.astro` — used 6 times on that page alone.

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

`src/components/pages/ApartmentContent.astro` — used 5 times.

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

Used in: `src/components/pages/GalleryContent.astro`, `ApartmentContent.astro`, `AboutMandreContent.astro`, `GuestGuideContent.astro`

Images are shared across all locales — they live in the component, not in the translation files. Only the `alt` text and any visible caption come from `T`.

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

Used in: `src/components/pages/ApartmentContent.astro` (5 carousels), `AboutMandreContent.astro` (5), `GuestGuideContent.astro` (1, plus per-card carousels rendered from a slides array)

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

Used in: `src/components/pages/GalleryContent.astro`

---

## Navigation Data as Constants

Nav links and language options are defined as arrays, then `.map()`-rendered. This keeps the nav and footer in sync:

- `src/components/Nav.astro` — `languages` array (code, flag, label), `navLinks` array, `isActive()` helper
- `src/components/Footer.astro` — parallel `footerLinks` array

Labels come from `T`, and every `href` is built from the language prefix:

```astro
const prefix = lang === 'en' ? '' : `/${lang}`;
const navLinks = [
  { href: `${prefix}/`,          label: T.nav.home },
  { href: `${prefix}/apartment`, label: T.nav.apartment },
];
{navLinks.map(link => <li><a href={link.href}>{link.label}</a></li>)}
```

The language switcher's static `href` points at the target language's homepage as a no-JS fallback, but its click handler preventDefaults and rewrites the *current* path instead — stripping any existing `/<lang>` segment and re-prefixing it — so switching language keeps the visitor on the same page.

---

## Vanilla JS Interactivity

No frontend framework — all interactivity is inline `<script>` blocks with DOM APIs:

- Burger menu toggle: `src/components/Nav.astro`
- Language dropdown + `bm_lang` cookie write: `src/components/Nav.astro` (script block at end of file)
- Cookie consent with `localStorage`: `src/components/CookieBanner.astro`
- Gallery category filter: `src/components/pages/GalleryContent.astro` (script block at end of file)
- Language preference redirect: `src/layouts/BaseLayout.astro` — an `is:inline` script in `<head>`

**Language preference redirect** — the only script that runs before render. It reads the `bm_lang` cookie (set by the language switcher, 7-day expiry) and, if it disagrees with the language in the URL, `location.replace()`s to the same page under the preferred language. It runs synchronously in `<head>` to avoid a flash of the wrong language, and skips `/admin` and `/booking/confirm`. Since it fires on every page, a new locale code has to be added to its inline `SUPPORTED` array too — the array is duplicated there rather than imported, because the script is inlined verbatim.

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
Used at: `src/components/pages/IndexContent.astro` (twice), and between most sections of `GuestGuideContent.astro`.

---

## SEO Pattern

**Meta tags** — Every page passes `title` and `description` to `BaseLayout`. `BaseLayout` generates all meta tags, canonical URL, Open Graph, and Twitter Card tags from these props (`src/layouts/BaseLayout.astro:20-46`). Defaults are provided if props are omitted. Canonical URLs are built from `Astro.site` (set to `https://bluemoonmandre.eu` in `astro.config.mjs`).

**hreflang / canonical** — `BaseLayout` strips the `/<lang>` prefix from `Astro.url.pathname` to get a language-neutral slug, then emits a `<link rel="alternate">` for all seven languages plus `x-default` (pointing at English). `HREFLANG_MAP` converts the project's URL codes to ISO (`si` → `sl`, `cz` → `cs`); `og:locale` comes from a parallel map in `BaseLayout`. `<html lang>` is set from the `lang` prop. All of this depends on the page passing `lang` down — a page that omits it silently advertises itself as English.

**Sitemap** — `@astrojs/sitemap@3.2.0` (pinned — v3.7+ requires Astro 5) auto-generates `sitemap-index.xml` + `sitemap-0.xml` at build time, covering all localized URLs. Configured in `astro.config.mjs` with a filter that excludes `/admin`, `/booking/confirm` and `/guest-guide` (unlisted — reachable only via the link emailed to confirmed guests). `astro.config.mjs` also declares the `i18n` block with `prefixDefaultLocale: false`, which is why English is unprefixed.

**robots.txt** — Lives at `public/robots.txt`. Allows all crawlers on public pages, disallows `/admin` and `/booking/confirm`, references the sitemap.

**noindex pages** — Admin (`/admin`, `/admin/login`), crew (`/cleaning`, `/cleaning/login`, `/cleaning/docs`) and the booking confirmation page (`/booking/confirm`) hardcode `<meta name="robots" content="noindex, nofollow">` in their own `<head>`, since they bypass `BaseLayout`. The guest guide goes through `BaseLayout` instead and sets `noindex={true}` as a prop — for pages using the standard layouts, that prop is the mechanism.

**JSON-LD structured data** — Key pages embed a `<script type="application/ld+json">` block using Astro's `set:html` directive to inject pre-serialised JSON without Vite processing it:

```astro
<script type="application/ld+json" set:html={JSON.stringify(schemaObject)} />
```

- `src/components/pages/IndexContent.astro` — `LodgingBusiness` schema (amenities, capacity, check-in/out, booking URL)
- `src/components/pages/ReviewsContent.astro` — `LodgingBusiness` with `aggregateRating` + individual `Review` entries; schema data is computed in the frontmatter from the `reviews` array before being passed to `JSON.stringify`

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
| * | `/api/admin/*` | `admin.ts` | Admin dashboard: list reservations, manage blocks, update pricing, guest data, invoices |
| * | `/api/crew/*` | `crew.ts` | Cleaning crew: login, guest list, reference docs |

Anything not matching falls through to the `ASSETS` binding, which serves the pre-rendered pages.

**Env bindings** (defined in `Env` interface in `index.ts`): `ASSETS`, `DB` (D1), `INVOICES` (R2), `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `CONTACT_TO_EMAIL`, `ADMIN_PASSWORD`, `CREW_PASSWORD`, `SESSION_SECRET`.

Guest-facing emails are localized from the same source: `email.ts` imports `getTranslations` and `INTL_LOCALE_MAP` from `src/i18n/utils`, and each builder resolves `langCode ?? reservation.language`. Email copy therefore lives in the same `src/i18n/*.json` files and follows the same all-seven-languages rule as page copy. Owner-facing mail stays English.

---

## Booking / Availability Data Flow

The booking page fetches live data client-side on load:

```js
const res = await fetch('/api/availability');
const { blocked, pending, pricing, season, minNights, depositPct } = await res.json();
```

`blocked` and `pending` are arrays of ISO date strings used to disable calendar days. `pricing` is a `{month: rate}` map used for price calculation. All this data lives in Cloudflare D1 (`pricing_rules`, `manual_blocks`, `reservations` tables via `src/worker/db.ts`).
