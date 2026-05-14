import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://bluemoonmandre.eu',
  output: 'static',
  // URL codes: 'si' for Slovenian and 'cz' for Czech are project-specific
  // (ISO 639-1 would be 'sl'/'cs'); used consistently in URLs, cookies, DB, and JSON filenames.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'hr', 'de', 'si', 'it', 'pl', 'cz'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/admin') && !page.includes('/booking/confirm'),
    }),
  ],
});
