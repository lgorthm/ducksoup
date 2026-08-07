// One-shot PWA asset generator config (run manually, not part of the build):
//   pnpm dlx @vite-pwa/assets-generator -c pwa-assets.config.mjs
// Source image: public/duck.png. Outputs land in public/ next to it.
import {
  appleSplashScreenSizes,
  combinePresetAndAppleSplashScreens,
  defineConfig,
} from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
    basePath: '/',
    xhtml: false,
    includeId: false,
  },
  preset: combinePresetAndAppleSplashScreens(
    {
      // Android adaptive icon: duck at 80% of canvas on white, so the
      // circular safe-zone crop keeps the whole subject.
      maskable: {
        sizes: [512],
        padding: 0.2,
        resizeOptions: { background: '#ffffff', fit: 'contain' },
      },
      // iOS home-screen icon must be opaque (alpha renders as black).
      apple: {
        sizes: [180],
        padding: 0.15,
        resizeOptions: { background: '#ffffff', fit: 'contain' },
      },
      // General-purpose manifest icons, keep transparency.
      transparent: {
        sizes: [192, 512],
        favicons: [],
        padding: 0,
        resizeOptions: { background: '#00000000', fit: 'contain' },
      },
      assetName: (type, size) => {
        if (type === 'maskable') {
          return `maskable-icon-${size.width}x${size.height}.png`;
        }
        if (type === 'apple') {
          return `apple-touch-icon-${size.width}x${size.height}.png`;
        }
        return `pwa-${size.width}x${size.height}.png`;
      },
    },
    {
      // iOS launch screens: white canvas, duck at 50%; dark variants use
      // the dark-mode background token.
      padding: 0.5,
      resizeOptions: { background: '#ffffff', fit: 'contain' },
      darkResizeOptions: { background: '#0a0a0a', fit: 'contain' },
      sizes: appleSplashScreenSizes,
    },
  ),
  images: ['public/duck.png'],
});
