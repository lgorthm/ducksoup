import path from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
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
    babel({ presets: [reactCompilerPreset()] }),
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
  },
});
