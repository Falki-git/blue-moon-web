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
| Forms | Netlify Forms (`data-netlify="true"`) — code is in place but **Netlify Forms does not function on Cloudflare Pages**; form handling is an open TODO |
| Interactivity | Vanilla JS inline `<script>` blocks only — no frontend framework |

## Key Directories

```
src/
  layouts/          # BaseLayout.astro (root shell), PageLayout.astro (inner-page hero wrapper)
  components/       # Nav, Footer, WhatsAppButton, CookieBanner
  pages/            # File-based routes — one .astro file per URL
  styles/           # global.css — CSS variables, resets, utility classes
  assets/
    gallery/        # Real apartment & destination photos — processed by Astro Image at build time
  i18n/             # en.json — translation strings (multi-lang framework, not yet active)
public/
  images/           # logo.svg, nav-logo.svg, og-image.jpg, favicon.svg
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
| `src/pages/apartment.astro` | `/apartment` | Full property details with image carousels |
| `src/pages/gallery.astro` | `/gallery` | Photo gallery with Astro Image component, JS filter, lightbox |
| `src/pages/pricelist.astro` | `/pricelist` | Rates, policies, check-in times |
| `src/pages/contact.astro` | `/contact` | Inquiry form (Netlify Forms — see TODO above) |
| `src/pages/about-mandre.astro` | `/about-mandre` | Destination guide with image carousels and Google Maps embed |
| `src/pages/reviews.astro` | `/reviews` | Guest testimonials |
| `src/pages/directions.astro` | `/directions` | Travel info with Google Maps embed |
| `src/pages/404.astro` | 404 | Custom error page |

## Images

Two patterns coexist:

**Real photos (Astro `<Image>` component)** — The gallery page and all carousels (apartment, about-mandre) use real photos from `src/assets/gallery/`. Astro processes these at build time for optimized output.

**CSS placeholder divs** — Some page sections (hero backgrounds, static apartment detail shots) still use `.img-ph` + category modifier classes (`.ph-terrace`, `.ph-sea`, etc.) defined in `src/styles/global.css:207`. These are `<div>` elements with gradient placeholders. When replacing with real images, swap for `<img>` or Astro `<Image>` components, keeping any aspect-ratio wrapper class.

## Git Branching Workflow

### Branch purposes
| Branch | Purpose |
|--------|---------|
| `main` | Production only — always 100% identical to what is live on Cloudflare Pages. Never commit or push here directly. |
| `development` | Integration branch for all ongoing work. The default base for new branches. |
| Feature/fix branches | Short-lived branches cut from `development`, merged back via PR. |

### Workflow for any change
1. Branch from `development`: `git checkout development && git checkout -b <branch-name>`
2. Make changes on the feature/fix branch
3. Open a PR targeting `development` (never `main`)
4. Merge into `development` when ready

**IMPORTANT**: Never commit or push until the user explicitly asks. Make edits freely, then stop and wait for the go-ahead.

### Deploying to production
**IMPORTANT**: Never open a PR from `development` → `main` on your own initiative. Only open this PR when the user explicitly asks for it (e.g., "create a PR to main", "open the deployment PR"). Never merge `development` into `main` directly. 

1. When the user requests it, open a PR from `development` → `main`
2. User reviews, approves, and merges the PR
3. After user confirms the merge, sync `development`: `git checkout development && git merge main`
4. Continue new work from `development`

**IMPORTANT**: If a user doesn't specify details of opening a PR, always assume the user means opening a PR from a feature/bugfix branch against the `development` branch.

## Additional Documentation

- [`.claude/docs/architectural_patterns.md`](.claude/docs/architectural_patterns.md) — Recurring patterns, component conventions, CSS system; check when adding pages, components, or significant styling.
