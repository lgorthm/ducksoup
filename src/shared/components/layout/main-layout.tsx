import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import duckSvg from '@/assets/duck.svg';
import logoSvg from '@/assets/logo.svg';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/shared/components/ui/sidebar';
import { SettingsDialog } from '@/features/settings/settings-dialog';

interface MainLayoutProps {
  sidebarContent?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  defaultOpen?: boolean;
  buttonGroup?: React.ReactNode;
  onSettingsClick?: () => void;
  children: React.ReactNode;
}

export function MainLayout({
  sidebarContent,
  sidebarFooter,
  defaultOpen = true,
  buttonGroup,
  onSettingsClick,
  children,
}: MainLayoutProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <MainLayoutInner
        sidebarContent={sidebarContent}
        sidebarFooter={sidebarFooter}
        buttonGroup={buttonGroup}
        onSettingsClick={onSettingsClick}
      >
        {children}
      </MainLayoutInner>
    </SidebarProvider>
  );
}

function MainLayoutInner({
  sidebarContent,
  sidebarFooter,
  buttonGroup,
  onSettingsClick,
  children,
}: Omit<MainLayoutProps, 'defaultOpen'>) {
  const { t } = useTranslation();
  const { isMobile, open } = useSidebar();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fixedWidth = 'var(--sidebar-width)';
  const showFixed = !isMobile && !open;

  const handleSettingsClick = onSettingsClick ?? (() => setSettingsOpen(true));

  return (
    <>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="flex flex-row items-center justify-between pl-1">
          <img src={logoSvg} alt="Logo" className="h-7 w-auto" />
          <SidebarTrigger />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {sidebarContent ?? (
              <div className="flex flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
                {t('conversation.empty')}
              </div>
            )}
          </SidebarMenu>
          <SidebarMenu className="mt-auto border-t p-2">
            <div
              className="group flex cursor-pointer items-center rounded-none px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent/50"
              onClick={handleSettingsClick}
            >
              <Settings className="mr-2 size-4" />
              <span>{t('settings.title')}</span>
            </div>
          </SidebarMenu>
        </SidebarContent>
        {sidebarFooter != null && (
          <SidebarFooter>{sidebarFooter}</SidebarFooter>
        )}
      </Sidebar>
      <SidebarInset className="max-h-svh">
        <div
          className="fixed top-0 left-0 z-10000 flex h-full -translate-x-full pt-2 pl-4 transition-all duration-300 ease-in-out md:translate-x-0"
          style={{
            width: 'var(--sidebar-width)',
            opacity: open ? 0 : 1,
            pointerEvents: open ? 'none' : 'auto',
          }}
        >
          <img src={duckSvg} alt="Duck" className="h-7 w-auto" />{' '}
          <SidebarTrigger />
          {buttonGroup}
        </div>
        <header
          className="flex h-12 shrink-0 items-center gap-2 px-2"
          style={{ marginLeft: showFixed ? fixedWidth : 0 }}
        >
          {isMobile && <SidebarTrigger isMobile />}
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </SidebarInset>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        isMobile={isMobile}
      />
    </>
  );
}
