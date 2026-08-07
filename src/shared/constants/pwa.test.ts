import { describe, expect, it } from 'vitest';
import { pwaManifest, pwaPrecacheAssets } from './pwa';

describe('pwaManifest', () => {
  it('declares a standalone installable app', () => {
    expect(pwaManifest.name).toBe('ducksoup');
    expect(pwaManifest.short_name).toBe('ducksoup');
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.start_url).toBe('/');
    expect(pwaManifest.scope).toBe('/');
    expect(pwaManifest.lang).toBe('zh-CN');
    expect(pwaManifest.theme_color).toBe('#FFCA3A');
    expect(pwaManifest.background_color).toBe('#FFFFFF');
  });

  it('provides any + maskable + apple touch icons with valid sizes', () => {
    const byPurpose = (purpose?: string) =>
      pwaManifest.icons.filter((i) => i.purpose === purpose);
    expect(byPurpose('maskable')).toHaveLength(1);
    expect(byPurpose('any').map((i) => i.src)).toEqual([
      'pwa-192x192.png',
      'pwa-512x512.png',
      'apple-touch-icon-180x180.png',
    ]);
    for (const icon of pwaManifest.icons) {
      expect(icon.sizes).toMatch(/^\d+x\d+$/);
      expect(icon.type).toBe('image/png');
    }
  });

  it('precaches icons and splash screens for offline boot', () => {
    expect(pwaPrecacheAssets).toContain('apple-splash-*.png');
    expect(pwaPrecacheAssets).toContain('maskable-icon-*.png');
    expect(pwaPrecacheAssets).toContain('apple-touch-icon*.png');
  });
});
