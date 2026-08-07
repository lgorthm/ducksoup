import './instrument';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { reactErrorHandler } from '@sentry/react';

import './index.css';
import '@/shared/i18n';
import { router } from '@/routes';
import { AppErrorBoundary } from '@/shared/components/app-error-boundary';
import { PwaReloadPrompt } from '@/shared/components/pwa-reload-prompt';
import { ThemeProvider } from '@/shared/providers/theme-provider';
import { Toaster } from '@/shared/components/ui/sonner';

// Prefetch the markdown chunk in parallel with app boot and IndexedDB
// hydration, so lazy message rendering adds no network waterfall (LCP-safe).
void import('@/shared/components/markdown-renderer');

createRoot(document.getElementById('root')!, {
  onUncaughtError: reactErrorHandler(),
  onCaughtError: reactErrorHandler(),
  onRecoverableError: reactErrorHandler(),
}).render(
  <StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <RouterProvider router={router} />
        <Toaster />
        <PwaReloadPrompt />
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
