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
          <img src={logoSvg} alt="Logo" className="h-7 w-auto" />
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
          className="flex h-12 shrink-0 items-center gap-2 px-4"
          style={{ marginLeft: showFixed ? fixedWidth : 0 }}
        >
          {isMobile && <SidebarTrigger />}
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </SidebarInset>
    </>
  );
}
