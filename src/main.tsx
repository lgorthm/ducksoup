import './instrument';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { reactErrorHandler } from '@sentry/react';

import './index.css';
import '@/shared/i18n';
import { router } from '@/routes';
import { AppErrorBoundary } from '@/shared/components/app-error-boundary';
import { ThemeProvider } from '@/shared/providers/theme-provider';
import { Toaster } from '@/shared/components/ui/sonner';

// Prefetch the markdown chunk in parallel with app boot and IndexedDB
// hydration, so lazy message rendering adds no network waterfall (LCP-safe).
// Swallow failures: the lazy import at render time retries on its own.
void import('@/shared/components/markdown-renderer').catch(() => {});

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found in index.html');
}

// onCaughtError reports boundary-caught errors to Sentry, so error
// boundaries (e.g. AppErrorBoundary) must not capture them manually.
const handleReactError = reactErrorHandler();

createRoot(container, {
  onUncaughtError: handleReactError,
  onCaughtError: handleReactError,
  onRecoverableError: handleReactError,
}).render(
  <StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
