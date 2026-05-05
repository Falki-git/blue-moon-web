# 🌙 Blue Moon Apartment — Website

A complete Astro website for the Blue Moon Apartment short-term rental in Mandre, island of Pag, Croatia.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start dev server at localhost:4321
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📁 Project Structure

```
blue-moon-apartment/
├── public/
│   ├── images/
│   │   ├── logo.svg               ← Blue Moon logo (footer, 404)
│   │   └── nav-logo.svg           ← Navigation bar logo variant
│   ├── _redirects                 ← Cloudflare Pages redirect rules
│   ├── _headers                   ← Cloudflare Pages security headers
│   └── favicon.svg
│
├── src/
│   ├── layouts/
│   │   ├── BaseLayout.astro       ← Wraps all pages (nav, footer, meta)
│   │   └── PageLayout.astro       ← Inner pages with hero header
│   │
│   ├── components/
│   │   ├── Nav.astro              ← Navigation + language switcher
│   │   ├── Footer.astro           ← Site footer
│   │   ├── WhatsAppButton.astro   ← Floating WhatsApp CTA
│   │   └── CookieBanner.astro     ← GDPR cookie consent
│   │
│   ├── pages/
│   │   ├── index.astro            ← Home page
│   │   ├── apartment.astro        ← Apartment detail with image carousels
│   │   ├── gallery.astro          ← Photo gallery with lightbox & filter
│   │   ├── pricelist.astro        ← Pricing & policies
│   │   ├── about-mandre.astro     ← Mandre destination guide with carousels
│   │   ├── reviews.astro          ← Guest reviews
│   │   ├── contact.astro          ← Inquiry form & contacts
│   │   ├── directions.astro       ← How to get here (Google Maps embed)
│   │   └── 404.astro              ← Custom 404 page
│   │
│   ├── assets/
│   │   └── gallery/               ← Apartment & destination photos (Astro Image)
│   │
│   ├── styles/
│   │   └── global.css             ← Brand variables, typography, utilities
│   │
│   └── i18n/
│       └── en.json                ← English translations (add more languages here)
│
├── astro.config.mjs
├── package.json
└── wrangler.toml                  ← Cloudflare Pages build config
```

---

## ✏️ Before You Launch — Checklist

### Photos

Real photos are in `src/assets/gallery/` and already used in the gallery page and carousels. Some page sections still use CSS placeholder `div` elements with class `img-ph` — replace these with Astro's `<Image />` component:

```astro
<!-- Before (placeholder) -->
<div class="img-ph ph-terrace ar-4-3">
  <span class="ph-icon">📷</span>
</div>

<!-- After (real photo) -->
---
import { Image } from 'astro:assets';
import terracePhoto from '../assets/gallery/terrace-1.jpg';
---
<Image src={terracePhoto} alt="Terrace with hot tub and sea view"
  widths={[400, 700, 1100]}
  sizes="(max-width: 900px) 100vw, 50vw" />
```

### Contact Form

The form in `contact.astro` uses `data-netlify="true"`, but **Netlify Forms does not work on Cloudflare Pages** — this is an open TODO. Two replacement options:

**Option A — Formspree (easiest):**
1. Create a free account at [formspree.io](https://formspree.io)
2. Replace the form `action` in `contact.astro` with your Formspree endpoint:
   ```html
   <form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
   ```
3. Remove the `data-netlify` and `netlify-honeypot` attributes.

**Option B — Cloudflare Pages Functions:**
Create `/functions/form.js` to handle submissions server-side (requires Cloudflare account).

### OG Image

Create a 1200×630px social sharing image at `/public/images/og-image.jpg`.

---

## 🌍 Adding Languages (i18n)

Language routing is prepared. To add Croatian (HR):

1. Create `/src/i18n/hr.json` with translated strings.
2. Create `/src/pages/hr/index.astro` (and other pages under `/src/pages/hr/`).
3. Use the translations from the JSON file in each page.

---

## ☁️ Deploying to Cloudflare Pages

1. Push this repository to GitHub.
2. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → Create a project.
3. Connect your GitHub repository.
4. Set the build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version (env variable):** `NODE_VERSION = 20`
5. Click Deploy. Your site will be live at `your-project.pages.dev`.
6. Add your custom domain in Pages → Custom Domains.

---

## 🎨 Customising the Design

All brand colours are in `src/styles/global.css` as CSS custom properties:

```css
:root {
  --white:       #FFFFFF;
  --soft-sky:    #EAF6FC;
  --sky-blue:    #4A9FD4;
  --ocean-blue:  #1A5FAD;
  --deep-navy:   #081628;
  --warm-sand:   #F7EDD8;
  --sunset-gold: #E8A82A;
}
```

Change any value here and it updates across the entire site.

---

## 📞 Support

Built for Goran Falkoni — Blue Moon Apartment, Mandre, Island of Pag, Croatia.