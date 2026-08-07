import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Shows a sticky toast when a new service worker is waiting; the user
// decides when to reload (registerType: 'prompt' in vite.config.ts).
export function PwaReloadPrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;
    toast(t('pwa.newVersion'), {
      id: 'pwa-reload',
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: t('pwa.reload'),
        onClick: () => void updateServiceWorker(true),
      },
    });
  }, [needRefresh, updateServiceWorker, t]);

  return null;
}
