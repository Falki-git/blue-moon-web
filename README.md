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
│   │   ├── logo.png               ← Blue Moon logo (already added)
│   │   └── gallery/               ← ADD your apartment photos here
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
│   │   ├── apartment.astro        ← Apartment detail
│   │   ├── gallery.astro          ← Photo gallery
│   │   ├── pricelist.astro        ← Pricing & policies
│   │   ├── about-mandre.astro     ← Mandre destination guide
│   │   ├── about-us.astro         ← Host profile (Goran)
│   │   ├── reviews.astro          ← Guest reviews
│   │   ├── contact.astro          ← Inquiry form & contacts
│   │   ├── directions.astro       ← How to get here
│   │   └── 404.astro              ← Custom 404 page
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

### Content to Personalise

- [ ] **`src/pages/about-us.astro`** — Fill in the `[Placeholder]` paragraphs with your personal story as a host.
- [ ] **`src/pages/about-mandre.astro`** — Fill in the "Goran's Picks" section (01–05) with your real local recommendations.
- [ ] **All pages** — Replace `info@bluemoonapartment.com` with your real email address.
- [ ] **All pages** — Replace `+385981234567` with your real WhatsApp/phone number.
- [ ] **`src/pages/pricelist.astro`** — Update check-in/check-out times and exact deposit/cancellation policy if needed.

### Photos

Add your apartment photos to `/public/images/gallery/` and update the `<img>` placeholders in each page. The placeholder `div` elements with class `img-ph` are your targets — replace them with real `<img>` or `<picture>` tags using Astro's `<Image />` component.

Example replacement:
```astro
<!-- Before (placeholder) -->
<div class="img-ph ph-terrace ar-4-3">
  <span class="ph-icon">📷</span>
</div>

<!-- After (real photo) -->
<img
  src="/images/gallery/terrace-hot-tub.jpg"
  alt="Terrace with hot tub and sea view"
  width="800"
  height="600"
  loading="lazy"
  class="apt-photo"
/>
```

### Contact Form

The form uses `data-netlify="true"` for serverless form handling. On Cloudflare Pages, you have two options:

**Option A — Formspree (recommended):**
1. Create a free account at [formspree.io](https://formspree.io)
2. Replace the form `action` in `contact.astro` with your Formspree endpoint:
   ```html
   <form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
   ```
3. Remove the `data-netlify` attribute.

**Option B — Cloudflare Pages Functions:**
Create `/functions/form.js` to handle form submissions server-side.

### Maps

In `directions.astro` and `contact.astro`, replace the map placeholder divs with a real Google Maps embed:
1. Go to [maps.google.com](https://maps.google.com) and search for "Mandre, Pag, Croatia"
2. Click Share → Embed a map → Copy the iframe code
3. Replace the `<div class="img-ph...">` with the iframe

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
Website: https://blue-moon-web.gfalkoni.workers.dev/