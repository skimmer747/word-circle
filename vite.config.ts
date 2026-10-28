import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/word-circle/',
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Word Circle',
        short_name: 'Word Circle',
        description: 'A calm, large-print word game',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#d8eaf7',
        theme_color: '#d8eaf7',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Jigsaw's starter pictures and their list are kept on the iPad, so they work without Wi-Fi.
        globPatterns: ['**/*.{js,css,html,woff2,png,ico,svg}', 'jigsaw/*.{jpg,json}'],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
