import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import logoSvg from '@/assets/logo.svg';
import { FixedToolbar } from './fixed-toolbar';

const LOGO_IMG = <img src={logoSvg} alt="Logo" className="h-7 w-auto" />;

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

const SettingsDialog = lazy(() =>
  import('@/features/settings/settings-dialog').then((m) => ({
    default: m.SettingsDialog,
  })),
);

const HEADER_STYLE_FIXED = { marginLeft: '140px' } as const;
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

const MainLayoutInner = memo(function MainLayoutInner({
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
  const prevIsMobileRef = useRef(isMobile);
  const [isMobileChanged, setIsMobileChanged] = useState(false);

  useEffect(() => {
    if (prevIsMobileRef.current !== isMobile) {
      prevIsMobileRef.current = isMobile;
      setIsMobileChanged(true);
    } else {
      setIsMobileChanged(false);
    }
  }, [isMobile]);

  const enableTransition = !isMobile && !isMobileChanged;
  const showFixed = !isMobile && !open;

  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
    } else {
      setSettingsOpen(true);
    }
  }, [onSettingsClick]);

  return (
    <>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="flex flex-row items-center justify-between pl-4">
          {LOGO_IMG}
          <SidebarTrigger data-testid="sidebar-trigger" />
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
              data-testid="settings-button"
              className="group flex cursor-pointer items-center rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent/50"
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
        <FixedToolbar
          open={open}
          isMobile={isMobile}
          buttonGroup={buttonGroup}
        />
        <header
          className={cn(
            'flex h-12 shrink-0 items-center gap-2 px-2',
            enableTransition &&
              'transition-[margin-left] duration-300 ease-in-out',
          )}
          style={showFixed ? HEADER_STYLE_FIXED : HEADER_STYLE_DEFAULT}
        >
          {isMobile ? <SidebarTrigger isMobile /> : null}
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
      <Suspense fallback={null}>
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          isMobile={isMobile}
        />
      </Suspense>
    </>
  );
});
