# 🌙 Blue Moon Apartment — Marketing Website

**🔗 Live site:** [bluemoonmandre.eu](https://bluemoonmandre.eu)
**🧪 Dev environment:** [dev-blue-moon-web.workers.dev](https://dev-blue-moon-web.workers.dev)

A production marketing website for **Blue Moon Apartment**, a luxury short-term rental in Mandre, Croatia (island of Pag). Built to drive direct bookings and reduce dependency on OTAs (Booking.com, Airbnb).

---

## 🏗️ Solution Structure

A fully static, zero-runtime-JS website covering the entire guest journey — from discovery and gallery browsing, through pricing and availability, to contact and directions:

| Page | Purpose |
|------|---------|
| 🏠 Home | Hero, highlights, pricing teaser, guest reviews |
| 🛏️ Apartment | Full property detail with filterable image carousels |
| 🖼️ Gallery | Photo gallery with category filter and lightbox |
| 💰 Price list | Seasonal rates, policies, check-in/check-out rules |
| 🌊 About Mandre | Destination guide with carousels and Google Maps embed |
| ⭐ Reviews | Guest testimonials |
| 📬 Contact | Inquiry form with WhatsApp fallback |
| 🗺️ Directions | Travel routes with embedded Google Maps |

---

## ⚙️ Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | [Astro](https://astro.build) v4 | Ships 0 KB of JavaScript by default — ideal for a content site |
| Output | Static (`output: 'static'`) | Pre-rendered at build time; no server, no cold starts |
| Styling | Vanilla CSS (scoped + global) | No framework overhead; full control over design tokens |
| Images | Astro `<Image />` component | Automatic format conversion (WebP/AVIF), responsive `srcset`, lazy loading |
| Hosting | Cloudflare Workers + Assets | Global CDN, custom domain, free tier |
| Fonts | Google Fonts (Playfair Display + Nunito) | Serif headings for a luxury feel; humanist sans for body text |

---

## ✨ Key Features

- 📱 **Responsive design** — mobile-first layout, works across all screen sizes
- 🖼️ **Optimised images** — Astro processes all photos at build time; `srcset` for every image
- 🎠 **Image carousels** — touch-friendly, keyboard-accessible, built in vanilla JS
- 🔍 **Gallery lightbox** — full-screen photo viewer with category filtering, no dependencies
- 🍪 **GDPR cookie banner** — consent management with localStorage persistence
- 💬 **WhatsApp CTA** — floating button with pre-filled message for instant guest contact
- 🗺️ **Google Maps embeds** — location and directions without external JS libraries
- 🌍 **Multi-language ready** — i18n architecture in place (7 languages planned, English live)
- 🔒 **Security headers** — CSP, HSTS, X-Frame-Options, and more via `_headers`
- 🚫 **Custom 404** — branded error page with navigation back to site

---

## 🧠 Architecture Highlights

**Static-first, no JS by default.** Every interactive feature (carousels, lightbox, filters, cookie banner) is implemented with minimal inline `<script>` blocks — no bundler, no npm runtime dependencies, no hydration overhead.

**Design token system.** All colours, shadows, and spacing are defined as CSS custom properties in `src/styles/global.css`. Every component inherits from these tokens, making global rebranding a single-file change.

**Astro Image pipeline.** Real photos live in `src/assets/gallery/` and are processed at build time. Astro generates optimised WebP output with responsive `srcset` attributes automatically — no manual image processing needed.

---

## 🚀 Running Locally

```bash
npm install
npm run dev       # dev server → localhost:4321
npm run build     # production build → /dist
npm run preview   # preview the production build
```

---

## 📁 Project Structure

```
src/
  layouts/          # BaseLayout.astro, PageLayout.astro
  components/       # Nav, Footer, WhatsAppButton, CookieBanner
  pages/            # One .astro file per route
  styles/           # global.css — design tokens & utilities
  assets/gallery/   # Source photos (processed by Astro at build time)
  i18n/             # en.json — translation strings
public/
  images/           # logo.svg, nav-logo.svg, og-image.jpg, favicon.svg
  _redirects        # URL redirect rules
  _headers          # Security headers
```

---

## 🤖 Built with Claude Code

Architecture decisions, component design, CSS system, vanilla JS interactivity, Cloudflare Workers configuration, and deployment pipeline — were developed through an iterative process with **[Claude Code](https://claude.ai/code)**, Anthropic's AI-powered CLI coding assistant.

- **No boilerplate copying** — every component was reasoned through and written from scratch in context
- **Decisions explained, not just made** — the AI walked through trade-offs (e.g. Astro vs other frameworks, static vs SSR, vanilla JS vs a library) before implementing
- **Real production constraints** — branching strategy, deployment pipeline, security headers, GDPR compliance, and image optimisation were all handled within the same workflow
- **Iterated like a real project** — features were added incrementally across multiple sessions, with the AI maintaining context about prior decisions

---

## 🌿 Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production — always mirrors what is live on [bluemoonmandre.eu](https://bluemoonmandre.eu). Never committed to directly. |
| `development` | Integration branch. All feature work merges here first and is previewed on the dev environment before going to production. |
| `feature/*` / `fix/*` | Short-lived branches cut from `development`, merged back via pull request. |

**Workflow:** `feature branch` → PR → `development` → preview on dev environment → PR → `main` → auto-deploy to production.

---

Built by [Goran Falkoni](https://github.com/Falki-git) — 🏝️ Blue Moon Apartment, Mandre, Island of Pag, Croatia.
