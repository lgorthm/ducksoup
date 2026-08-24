import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
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
import { useIsDesktop, useIsTablet } from '@/shared/hooks/use-media-query';

// logo 放在 public/ 下，由 index.html 中的 <link rel="preload"> 提前加载，
// 避免移动端首次打开 sidebar 时才发请求导致短暂空白。
const LOGO_IMG = <img src="/logo.svg" alt="Logo" className="h-7 w-auto" />;

const HEADER_STYLE_FIXED = { marginLeft: '140px' } as const;
const HEADER_STYLE_DEFAULT = { marginLeft: 0 } as const;

interface MainLayoutProps {
  defaultOpen?: boolean;
  header?: React.ReactNode;
  sidebarContent?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  toolbarActions?: React.ReactNode;
  children: React.ReactNode;
}

export function MainLayout({
  defaultOpen = true,
  header,
  sidebarContent,
  sidebarFooter,
  toolbarActions,
  children,
}: MainLayoutProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <MainLayoutInner
        header={header}
        sidebarContent={sidebarContent}
        sidebarFooter={sidebarFooter}
        toolbarActions={toolbarActions}
      >
        {children}
      </MainLayoutInner>
    </SidebarProvider>
  );
}

function MainLayoutInner({
  header,
  sidebarContent,
  sidebarFooter,
  toolbarActions,
  children,
}: Omit<MainLayoutProps, 'defaultOpen'>) {
  const { t } = useTranslation();
  const { isMobile, open } = useSidebar();
  const [prevIsOpen, setPrevIsOpen] = useState(open);
  useEffect(() => {
    setPrevIsOpen(open);
  }, [open]);

  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();

  const showFixed = !isMobile && !open;
  const enableTransition =
    (isDesktop && open) ||
    (!isMobile && prevIsOpen && !open) ||
    (isTablet && !prevIsOpen && open);

  return (
    <>
      <a href="#chat-main" className="skip-to-content">
        {t('sidebar.skipToContent')}
      </a>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="flex flex-row items-center justify-between pl-4">
          {LOGO_IMG}
          <SidebarTrigger data-testid="sidebar-trigger" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>{sidebarContent}</SidebarMenu>
        </SidebarContent>
        {sidebarFooter != null ? (
          <SidebarFooter className="border-t">{sidebarFooter}</SidebarFooter>
        ) : null}
      </Sidebar>
      <SidebarInset className="max-h-svh">
        <FixedToolbar
          open={open}
          isMobile={isMobile}
          buttonGroup={toolbarActions}
        />
        <header
          className={cn(
            'flex h-12 shrink-0 items-center gap-2 px-2',
            enableTransition &&
              'transition-[margin-left] duration-200 ease-linear',
          )}
          style={showFixed ? HEADER_STYLE_FIXED : HEADER_STYLE_DEFAULT}
        >
          {isMobile ? <SidebarTrigger /> : null}
          {header}
        </header>
        {/* 页面主内容地标由 SidebarInset 的 <main> 承担，这里用 div 避免嵌套 main */}
        <div
          id="chat-main"
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {children}
        </div>
      </SidebarInset>
    </>
  );
}
