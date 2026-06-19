import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import logoSvg from '@/assets/logo.svg';
import { FixedToolbar } from './fixed-toolbar';

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

const HEADER_STYLE_FIXED = { marginLeft: '100px' } as const;
const HEADER_STYLE_DEFAULT = { marginLeft: 0 } as const;

interface MainLayoutProps {
  sidebarContent?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  defaultOpen?: boolean;
  buttonGroup?: React.ReactNode;
  onSettingsClick?: () => void;
  conversationTitle?: string;
  modelName?: string;
  children: React.ReactNode;
}

export function MainLayout({
  sidebarContent,
  sidebarFooter,
  defaultOpen = true,
  buttonGroup,
  onSettingsClick,
  conversationTitle,
  modelName,
  children,
}: MainLayoutProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <MainLayoutInner
        sidebarContent={sidebarContent}
        sidebarFooter={sidebarFooter}
        buttonGroup={buttonGroup}
        onSettingsClick={onSettingsClick}
        conversationTitle={conversationTitle}
        modelName={modelName}
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
  conversationTitle,
  modelName,
  children,
}: Omit<MainLayoutProps, 'defaultOpen'>) {
  const { t } = useTranslation();
  const { isMobile, open } = useSidebar();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // const fixedWidth = 'var(--sidebar-width)';
  const showFixed = !isMobile && !open;

  const defaultSettingsClick = useCallback(() => setSettingsOpen(true), []);
  const handleSettingsClick = onSettingsClick ?? defaultSettingsClick;

  return (
    <>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="flex flex-row items-center justify-between pl-4">
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
        {sidebarFooter != null ? (
          <SidebarFooter>{sidebarFooter}</SidebarFooter>
        ) : null}
      </Sidebar>
      <SidebarInset className="max-h-svh">
        <FixedToolbar open={open} buttonGroup={buttonGroup} />
        <header
          className="flex h-12 shrink-0 items-center gap-2 px-2 transition-[margin-left] duration-300 ease-in-out"
          style={showFixed ? HEADER_STYLE_FIXED : HEADER_STYLE_DEFAULT}
        >
          {isMobile && <SidebarTrigger isMobile />}
          {conversationTitle != null ? (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">
                {conversationTitle}
              </span>
              {modelName != null ? (
                <span className="truncate text-xs text-muted-foreground">
                  {modelName}
                </span>
              ) : null}
            </div>
          ) : null}
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
