// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import vercel from '@astrojs/vercel';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Configuration du domaine pour la génération du sitemap
  site: 'https://acctherm.com', 
  
  adapter: vercel(),
  integrations: [icon(), sitemap()],
  vite: {
    plugins: [tailwindcss()] 
  }
});