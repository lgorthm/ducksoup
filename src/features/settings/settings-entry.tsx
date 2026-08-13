import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/shared/components/ui/sidebar';

const SettingsDialog = lazy(() =>
  import('@/features/settings/settings-dialog').then((m) => ({
    default: m.SettingsDialog,
  })),
);

export function SettingsEntry() {
  const { t } = useTranslation();
  const { isMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  // 首次打开后才挂载弹窗，lazy chunk 延迟到真正需要时再请求；
  // 此后保持挂载，保留关闭动画
  const [opened, setOpened] = useState(false);

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            data-testid="settings-button"
            onClick={() => {
              setOpened(true);
              setOpen(true);
            }}
          >
            <Settings />
            <span>{t('settings.title')}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      {opened ? (
        <Suspense fallback={null}>
          <SettingsDialog
            open={open}
            onOpenChange={setOpen}
            isMobile={isMobile}
          />
        </Suspense>
      ) : null}
    </>
  );
}
