# 🌙 Blue Moon Apartment — Marketing Website

**🔗 Live site:** [bluemoonmandre.eu](https://bluemoonmandre.eu)
**🧪 Dev environment:** [dev-blue-moon-web.gfalkoni.workers.dev](https://dev-blue-moon-web.gfalkoni.workers.dev)

A production marketing website for **Blue Moon Apartment**, a luxury short-term rental in Mandre, Croatia (island of Pag). Built to drive direct bookings and reduce dependency on OTAs (Booking.com, Airbnb).

---

## 🏗️ Solution Structure

Covers the full guest journey — from discovery and gallery browsing through direct online booking, with an owner-facing admin panel for reservation management:

| Page | Purpose |
|------|---------|
| 🏠 Home | Hero, highlights, pricing teaser, guest reviews |
| 🛏️ Apartment | Full property detail with filterable image carousels |
| 🖼️ Gallery | Photo gallery with category filter and lightbox |
| 💰 Price list | Seasonal rates, policies, check-in/check-out rules |
| 📅 Booking | Interactive availability calendar, live pricing, guest reservation form |
| 🌊 About Mandre | Destination guide with carousels and Google Maps embed |
| ⭐ Reviews | Guest testimonials |
| 📬 Contact | Short inquiry form with WhatsApp fallback |
| 🗺️ Directions | Travel routes with embedded Google Maps |
| 🔐 Admin | Owner dashboard — pending/confirmed reservations, manual date blocks, per-month pricing |

---

## ⚙️ Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | [Astro](https://astro.build) v4 | Ships 0 KB of JavaScript by default — ideal for a content site |
| Output | Static (`output: 'static'`) + Worker API routes | Pages pre-rendered at build time; dynamic booking/admin API handled by the Worker |
| Styling | Vanilla CSS (scoped + global) | No framework overhead; full control over design tokens |
| Images | Astro `<Image />` component | Automatic format conversion (WebP/AVIF), responsive `srcset`, lazy loading |
| Hosting | Cloudflare Workers + Assets | Global CDN, custom domain, free tier |
| Database | Cloudflare D1 (SQLite at the edge) | Reservations, manual date blocks, per-month pricing rules — zero-latency reads |
| Emails | Resend API | Transactional emails: owner booking notifications, guest confirmations, approve/decline flow |
| Fonts | Google Fonts (Playfair Display + Nunito) | Serif headings for a luxury feel; humanist sans for body text |

---

## ✨ Key Features

- 📱 **Responsive design** — mobile-first layout, works across all screen sizes
- 📅 **Direct booking system** — interactive availability calendar with live date blocking, per-night pricing, and deposit calculation
- 🔐 **Admin dashboard** — password-protected reservation management; approve/decline via signed email links; manual date blocking; per-month pricing editor
- 📧 **Email notification flow** — owner receives booking request with approve/decline links; guest receives pending confirmation and final approval/rejection
- 🖼️ **Optimised images** — Astro processes all photos at build time; `srcset` for every image
- 🎠 **Image carousels** — touch-friendly, keyboard-accessible, built in vanilla JS
- 🔍 **Gallery lightbox** — full-screen photo viewer with category filtering, no dependencies
- 🛡️ **Bot protection** — Cloudflare Turnstile on all submission forms
- 🍪 **GDPR cookie banner** — consent management with localStorage persistence
- 💬 **WhatsApp CTA** — floating button with pre-filled message for instant guest contact
- 🗺️ **Google Maps embeds** — location and directions without external JS libraries
- 🌍 **Multi-language ready** — i18n architecture in place (7 languages planned, English live)
- 🔒 **Security headers** — CSP, HSTS, X-Frame-Options, and more via `_headers`
- 🚫 **Custom 404** — branded error page with navigation back to site

---

## 🧠 Architecture Highlights

**Static-first, no JS by default.** Every interactive feature (carousels, lightbox, filters, cookie banner) is implemented with minimal inline `<script>` blocks — no bundler, no npm runtime dependencies, no hydration overhead.

**Full booking backend on the edge.** The Cloudflare Worker handles dynamic API routes alongside static asset serving. Bookings are stored in Cloudflare D1 (SQLite), availability and per-month pricing are served from D1 via `GET /api/availability`, and reservations are created via `POST /api/booking`. The owner approves or declines requests through signed one-time links delivered by email — no third-party booking engine required.

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
  pages/            # One .astro file per route (incl. admin/, booking/)
  styles/           # global.css — design tokens & utilities
  assets/gallery/   # Source photos (processed by Astro at build time)
  i18n/             # en.json — translation strings
  worker/           # Cloudflare Worker — API routes, D1 queries, email, auth
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
