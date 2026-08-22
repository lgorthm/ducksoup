import path from 'node:path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type PluginOption } from 'vite';

const enablePerf = process.env.PERF === '1';
// Only upload source maps when a Sentry auth token is present (CI).
// Local builds skip the plugin entirely, so they never create releases.
const enableSentryUpload = Boolean(process.env.SENTRY_AUTH_TOKEN);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(enablePerf
      ? [
          visualizer({
            filename: 'perf/stats.html',
            gzipSize: true,
            brotliSize: true,
          }) as PluginOption,
        ]
      : []),
    ...(enableSentryUpload
      ? [
          sentryVitePlugin({
            org: 'ducksoup',
            project: 'javascript-react',
            sourcemaps: {
              filesToDeleteAfterUpload: ['dist/**/*.map'],
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // "hidden" = emit maps without a sourceMappingURL comment; only needed
    // when uploading to Sentry, and the plugin deletes them before deploy.
    sourcemap: enableSentryUpload ? 'hidden' : false,
    rolldownOptions: {
      output: {
        advancedChunks: {
          // Split stable vendor code into long-term-cacheable chunks so app
          // releases don't invalidate them. Tests match the inner
          // `node_modules/<pkg>/` segment of pnpm-store paths.
          groups: [
            {
              name: 'framework',
              test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
            },
            {
              name: 'sentry',
              test: /node_modules[\\/]@sentry[\\/]/,
            },
            {
              name: 'base-ui',
              test: /node_modules[\\/](?:@base-ui|@floating-ui)[\\/]/,
            },
            {
              name: 'openai',
              test: /node_modules[\\/]openai[\\/]/,
            },
          ],
        },
      },
    },
  },
});
