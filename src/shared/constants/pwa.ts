// PWA manifest shared by vite.config.ts (VitePWA plugin) and unit tests.
// Icons/splash screens are pre-generated into public/ via
// pwa-assets.config.mjs (see that file for the regeneration command).
import type { ManifestOptions } from 'vite-plugin-pwa';

export const pwaManifest: Partial<ManifestOptions> &
  Pick<ManifestOptions, 'icons'> = {
  id: '/',
  name: 'ducksoup',
  short_name: 'ducksoup',
  description: 'ducksoup — DeepSeek chat client',
  lang: 'zh-CN',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  theme_color: '#FFCA3A',
  background_color: '#FFFFFF',
  icons: [
    {
      src: 'pwa-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      // iOS 16.4+ reads the manifest icon; must be opaque (no alpha).
      src: 'apple-touch-icon-180x180.png',
      sizes: '180x180',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'maskable-icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

// Precached by the service worker so the installed app boots offline.
export const pwaPrecacheAssets = [
  'pwa-*.png',
  'maskable-icon-*.png',
  'apple-touch-icon*.png',
  'apple-splash-*.png',
  'duck.svg',
];
