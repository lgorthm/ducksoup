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
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useMinLoadingDisplay } from '@/shared/hooks/use-min-loading-display';
import { FixedToolbar } from './fixed-toolbar';

const LOGO_IMG = <img src={logoSvg} alt="Logo" className="h-7 w-auto" />;

// 移动端 sidebar 关闭时不渲染 logo 的 <img>，首次打开才会发起请求，
// 导致短暂空白。注入 <link rel="preload"> 让浏览器在页面加载时提前拉取，
// 保证打开 sidebar 时图片已在缓存中立即显示。
// 注意不能用无引用的 new Image()：GC 可能取消未完成的请求。
if (typeof document !== 'undefined') {
  const preloadLink = document.createElement('link');
  preloadLink.rel = 'preload';
  preloadLink.as = 'image';
  preloadLink.href = logoSvg;
  document.head.appendChild(preloadLink);
}

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
  titleLoading?: boolean;
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
  titleLoading,
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
        titleLoading={titleLoading}
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
  titleLoading,
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

  // 标题加载期间显示骨架屏，加载完成后保留最短展示时长再淡入
  const { revealed: titleRevealed, wasLoading: titleWasLoading } =
    useMinLoadingDisplay(!titleLoading);

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
          {!titleRevealed ? (
            <div
              data-testid="conversation-title-skeleton"
              className="flex min-w-0 flex-col gap-1"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          ) : conversationTitle != null ? (
            <div
              className={cn(
                'flex min-w-0 flex-col',
                titleWasLoading && 'animate-in fade-in-0 duration-300',
              )}
            >
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
