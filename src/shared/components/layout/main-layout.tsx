import duckSvg from '@/assets/duck.svg';

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

interface MainLayoutProps {
  sidebarContent?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  defaultOpen?: boolean;
  buttonGroup?: React.ReactNode;
  children: React.ReactNode;
}

export function MainLayout({
  sidebarContent,
  sidebarFooter,
  defaultOpen = true,
  buttonGroup,
  children,
}: MainLayoutProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <MainLayoutInner
        sidebarContent={sidebarContent}
        sidebarFooter={sidebarFooter}
        buttonGroup={buttonGroup}
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
  children,
}: Omit<MainLayoutProps, 'defaultOpen'>) {
  const { isMobile, open } = useSidebar();

  const fixedWidth = 'var(--sidebar-width)';
  const showFixed = !isMobile && !open;

  return (
    <>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="flex flex-row items-center justify-between px-4">
          <img src={duckSvg} alt="Logo" className="h-7 w-auto" />
          <SidebarTrigger />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {sidebarContent ?? (
              <div className="flex flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
                暂无对话
              </div>
            )}
          </SidebarMenu>
        </SidebarContent>
        {sidebarFooter != null && (
          <SidebarFooter>{sidebarFooter}</SidebarFooter>
        )}
      </Sidebar>
      <SidebarInset>
        {/* 非移动端：fixed 定位的 logo + 按钮组，带滑入/滑出动画 */}
        <div
          className="fixed top-0 left-0 z-30 flex h-12 items-center gap-2 bg-background px-4 transition-transform duration-300 ease-in-out"
          style={{
            width: fixedWidth,
            transform: showFixed ? 'translateX(0)' : 'translateX(-100%)',
            pointerEvents: showFixed ? 'auto' : 'none',
          }}
        >
          <img src={duckSvg} alt="Logo" className="h-7 w-auto" />
          <SidebarTrigger />
          {buttonGroup}
        </div>
        <header
          className="flex h-12 shrink-0 items-center gap-2 px-4"
          style={{ marginLeft: showFixed ? fixedWidth : 0 }}
        >
          {isMobile && <SidebarTrigger />}
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </>
  );
}
