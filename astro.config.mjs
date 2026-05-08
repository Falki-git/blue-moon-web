import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://bluemoonmandre.eu',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/admin') && !page.includes('/booking/confirm'),
    }),
  ],
});
