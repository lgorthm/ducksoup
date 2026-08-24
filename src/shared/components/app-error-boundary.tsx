import type { ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { TriangleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as Sentry from '@sentry/react';

import duckSvg from '@/assets/duck.svg';
import { Button } from '@/shared/components/ui/button';

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const { t } = useTranslation();
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground"
    >
      <img src={duckSvg} alt="" className="h-12 w-auto opacity-80" />
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlertIcon className="size-7" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('error.title')}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {t('error.description')}
      </p>
      {message && (
        <p className="max-w-md text-xs break-all text-muted-foreground/70">
          {message}
        </p>
      )}
      <div className="mt-2 flex items-center gap-3">
        <Button variant="outline" onClick={resetErrorBoundary}>
          {t('error.retry')}
        </Button>
        <Button onClick={() => window.location.reload()}>
          {t('error.reload')}
        </Button>
      </div>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => {
        Sentry.captureException(error, {
          extra: { componentStack: info.componentStack },
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
