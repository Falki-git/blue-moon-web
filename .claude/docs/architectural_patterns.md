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

All pages use a two-layer nesting:
1. **`BaseLayout.astro`** — `<html>` shell, SEO meta, Nav, Footer, WhatsAppButton, CookieBanner, seasonal bar
2. **`PageLayout.astro`** — wraps `BaseLayout`, adds hero header with background image, dark overlay, title, subtitle

`index.astro` uses `BaseLayout` directly (custom hero). Every other page uses `PageLayout`.

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

## Image Placeholder Pattern

All images are placeholder `<div>` elements; real photos are not yet loaded:

```astro
<div class="img-ph ph-terrace ar-4-3" aria-hidden="true">
  <span class="ph-icon">📷</span>
  <span class="ph-label">Terrace with Hot Tub</span>
</div>
```

Modifier classes: `.ph-terrace`, `.ph-sea`, `.ph-interior`, `.ph-bedroom`, `.ph-kitchen`  
Aspect ratio classes: `.ar-4-3`, `.ar-16-9`, `.ar-hero`  
Defined at: `src/styles/global.css:207`

When replacing with real images, swap the `<div>` for `<img>` or `<Image>` keeping the aspect-ratio wrapper.

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
