import './instrument';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { reactErrorHandler } from '@sentry/react';

import './index.css';
import '@/shared/i18n';
import { router } from '@/routes';
import { ThemeProvider } from '@/shared/providers/theme-provider';
import { Toaster } from '@/shared/components/ui/sonner';

createRoot(document.getElementById('root')!, {
  onUncaughtError: reactErrorHandler(),
  onCaughtError: reactErrorHandler(),
  onRecoverableError: reactErrorHandler(),
}).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  </StrictMode>,
);
