# Blue Moon Apartment — CLAUDE.md

## Project Overview

Marketing website for **Blue Moon Apartment**, a luxury 2-bedroom short-term rental in Mandre, Croatia (island of Pag). The site drives direct bookings, showcases the property, and serves as an alternative to OTAs (Booking.com, Airbnb).

Operates seasonally (June–September). Multi-language support (7 languages) is framework-ready but not yet implemented — only English content exists.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Astro](https://astro.build) ^4.16.0 — static site generator |
| Output | `static` (all pages pre-rendered at build time, 0KB JS shipped by default) |
| Styling | Vanilla CSS — scoped component styles + global design system |
| Fonts | Google Fonts: Playfair Display (serif headings), Nunito (sans-serif body) |
| Hosting | Cloudflare Pages (configured via `wrangler.toml`) |
| Forms | Netlify Forms (`data-netlify="true"` on form elements) |
| Interactivity | Vanilla JS inline `<script>` blocks only — no frontend framework |

## Key Directories

```
src/
  layouts/          # BaseLayout.astro (root shell), PageLayout.astro (inner-page hero wrapper)
  components/       # Nav, Footer, WhatsAppButton, CookieBanner
  pages/            # File-based routes — one .astro file per URL
  styles/           # global.css — CSS variables, resets, utility classes
  i18n/             # en.json — translation strings (multi-lang framework, not yet active)
public/
  images/           # logo.png; gallery/ (placeholder — real photos not yet added)
  _redirects        # Cloudflare Pages URL redirects
  _headers          # Cloudflare Pages security headers
```

**All content is hardcoded in page files** — there is no CMS, database, or data-fetching layer.

## Build & Dev Commands

```bash
npm run dev       # Dev server at localhost:4321
npm run build     # Static build → /dist
npm run preview   # Preview production build locally
```

No test or lint scripts are configured.

## Key Config Files

| File | Purpose |
|------|---------|
| `astro.config.mjs` | Site URL, `output: 'static'` mode |
| `wrangler.toml` | Cloudflare Pages build config, Node 20 |
| `src/styles/global.css` | CSS custom properties (colors, shadows, spacing), utility classes |
| `src/env.d.ts` | Astro TypeScript ambient declarations |

## Pages

| File | Route | Notes |
|------|-------|-------|
| `src/pages/index.astro` | `/` | Homepage — hero, features, pricing teaser, reviews |
| `src/pages/apartment.astro` | `/apartment` | Full property details |
| `src/pages/gallery.astro` | `/gallery` | Photo gallery with JS filter |
| `src/pages/pricelist.astro` | `/pricelist` | Rates, policies, check-in times |
| `src/pages/contact.astro` | `/contact` | Inquiry form + map |
| `src/pages/about-mandre.astro` | `/about-mandre` | Destination guide |
| `src/pages/about-us.astro` | `/about-us` | Host profile |
| `src/pages/reviews.astro` | `/reviews` | Guest testimonials |
| `src/pages/directions.astro` | `/directions` | Travel info |
| `src/pages/404.astro` | 404 | Custom error page |

## Image Placeholders

Real photos are not yet added. All images are CSS placeholder `<div>` elements using `.img-ph` + category modifier classes (`.ph-terrace`, `.ph-sea`, etc.) defined in `src/styles/global.css:207`. When adding real images, replace these divs with `<img>` or Astro `<Image>` components.

## Adding New Features or Fixing Bugs

**IMPORTANT**: When you work on a new feature or bug, create a git branch first. Then work on changes in that branch for the remainder of the session.

## Additional Documentation

- [`.claude/docs/architectural_patterns.md`](.claude/docs/architectural_patterns.md) — Recurring patterns, component conventions, CSS system; check when adding pages, components, or significant styling.
