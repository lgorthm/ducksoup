import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
  SidebarTrigger,
} from '@/shared/components/ui/sidebar';

interface MainLayoutProps {
  sidebarHeader?: React.ReactNode;
  sidebarContent?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function MainLayout({
  sidebarHeader,
  sidebarContent,
  sidebarFooter,
  defaultOpen = true,
  children,
}: MainLayoutProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar collapsible="offcanvas">
        {sidebarHeader != null && (
          <SidebarHeader>{sidebarHeader}</SidebarHeader>
        )}
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
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
