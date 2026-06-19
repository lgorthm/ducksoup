import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import './index.css';
import '@/shared/i18n';
import { router } from '@/routes';
import { ThemeProvider } from '@/shared/providers/theme-provider';
import { Toaster } from '@/shared/components/ui/sonner';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  </StrictMode>,
);
