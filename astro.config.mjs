// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import icon from 'astro-icon';
import { site } from './src/site.config.ts';

export default defineConfig({
  site: `https://${site.domain}`,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Inline small stylesheets to kill render-blocking requests (Lighthouse >=95 bar).
    inlineStylesheets: 'auto',
  },
  integrations: [
    // Lucide, inlined as SVG at build time. Only icons actually referenced get
    // emitted, so this stays zero client JS and zero extra requests.
    icon(),
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/thanks/'),
    }),
  ],
  devToolbar: { enabled: false },
});
