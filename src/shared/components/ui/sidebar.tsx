import * as React from 'react';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { useTranslation } from 'react-i18next';

import { useIsMobile, useIsBelowDesktop } from '@/shared/hooks/use-media-query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { MenuIcon, PanelLeftIcon } from 'lucide-react';

const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_WIDTH_ICON = '3rem';

// 移动端抽屉打开时，参与 Tab 焦点循环的元素
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 元素自身或祖先不可见（hidden / display:none / visibility:hidden）时不参与焦点循环。
// 沿祖先链查计算样式而非 offsetParent，以兼容无布局的测试环境（jsdom）。
function isVisible(element: HTMLElement): boolean {
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.parentElement
  ) {
    if (node.hidden) return false;
    const { display, visibility } = window.getComputedStyle(node);
    if (display === 'none' || visibility === 'hidden') return false;
  }
  return true;
}

// 真实 Tab 顺序：正 tabindex 的元素优先（按数值升序），其余保持 DOM 顺序
function getFocusableInTabOrder(container: HTMLElement): HTMLElement[] {
  const tabOrder = (element: HTMLElement) =>
    element.tabIndex > 0 ? element.tabIndex : Number.MAX_SAFE_INTEGER;
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(isVisible)
    .sort((a, b) => tabOrder(a) - tabOrder(b));
}

type SidebarContextProps = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
  /** sidebar 容器 id，供 trigger 的 aria-controls 引用 */
  sidebarId: string;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }

  return context;
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const isBelowDesktop = useIsBelowDesktop();
  const [openMobile, setOpenMobile] = React.useState(false);

  // 手动关闭标记：非移动端用户手动关闭 sidebar 时置为 true；
  // 为 true 时，跨越 1024px 断点回到桌面端保持折叠、不自动展开；
  // 用户再次手动打开时清除，恢复断点自动行为。
  const [manualClosed, setManualClosed] = React.useState(false);

  const sidebarId = React.useId();

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(
    () => defaultOpen && !isBelowDesktop,
  );
  const open = openProp ?? _open;

  // open 的最新值镜像：setOpen 用它解析函数式更新，从而无需把 open 写进
  // useCallback 依赖（否则每次开合都会重建 setOpen/toggleSidebar/contextValue）。
  // 声明在其余 layout effect 之前，保证它们调用 setOpen 时读到的必是最新值。
  const openRef = React.useRef(open);
  React.useLayoutEffect(() => {
    openRef.current = open;
  });

  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState =
        typeof value === 'function' ? value(openRef.current) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }
    },
    [setOpenProp],
  );

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((prev) => !prev);
      return;
    }
    // 非移动端：记录用户意图——手动关闭置为 sticky，手动打开恢复自动
    const next = !openRef.current;
    setManualClosed(!next);
    setOpen(next);
  }, [isMobile, setOpen]);

  // 切换到移动端时，关闭移动端抽屉，桌面 open 一并记为关闭：
  // 回到 768–1023px 时 sidebar 保持关闭；回到 >=1024px 时是否自动展开，
  // 由下方的断点 effect 按 manualClosed 决定。
  // 断点变化属于外部副作用，在 layout effect 中响应（绘制前完成修正，不闪烁），
  // 而非渲染期间 setState（受控时会触发父组件渲染期 setState 警告）。
  // 故意省略依赖数组：每次 commit 都运行，用 ref 自行比对上一个值。
  const prevIsMobileRef = React.useRef(isMobile);
  React.useLayoutEffect(() => {
    const prev = prevIsMobileRef.current;
    prevIsMobileRef.current = isMobile;
    if (prev !== isMobile && isMobile) {
      if (open) setOpen(false);
      setOpenMobile(false);
    }
  });

  // 根据屏幕宽度自动展开/折叠 sidebar
  // 仅在屏幕宽度跨越 1024px 断点时响应（同样故意省略依赖数组）
  const prevBelowDesktopRef = React.useRef(isBelowDesktop);
  React.useLayoutEffect(() => {
    const prev = prevBelowDesktopRef.current;
    prevBelowDesktopRef.current = isBelowDesktop;
    if (prev !== isBelowDesktop && !isMobile) {
      if (isBelowDesktop) {
        // 进入 < 1024px：自动折叠
        if (open) setOpen(false);
      } else if (manualClosed) {
        // 用户手动关闭过：回到 >= 1024px 保持折叠
        if (open) setOpen(false);
      } else {
        // 回到 >= 1024px：自动展开
        if (!open) setOpen(true);
      }
    }
  });

  // state 供 data-state 与 context 消费者使用，反映当前实际可见状态：
  // 移动端由抽屉 openMobile 驱动，桌面端由 open 驱动。
  const state = (isMobile ? openMobile : open) ? 'expanded' : 'collapsed';

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      sidebarId,
    }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar, sidebarId],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            '--sidebar-width': SIDEBAR_WIDTH,
            '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          'group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  side?: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
  collapsible?: 'offcanvas' | 'icon' | 'none';
}) {
  const { isMobile, state, openMobile, setOpenMobile, sidebarId } =
    useSidebar();
  const { t } = useTranslation();
  const rootRef = React.useRef<HTMLDivElement>(null);

  // 移动端抽屉打开期间：焦点移入抽屉、Esc 关闭、Tab 在抽屉内循环；
  // 抽屉关闭（或跨断点、卸载）后，焦点归还给打开前的元素。
  React.useEffect(() => {
    if (!isMobile || !openMobile) return;
    const container = rootRef.current?.querySelector<HTMLElement>(
      '[data-slot="sidebar-container"]',
    );
    if (!container) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    container.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      // 焦点在抽屉之外的浮层（如设置对话框）时，不与浮层争抢按键
      const active = document.activeElement;
      const focusOutside =
        active instanceof HTMLElement &&
        active !== document.body &&
        !container.contains(active);
      if (focusOutside) return;

      if (event.key === 'Escape') {
        setOpenMobile(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusableInTabOrder(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [isMobile, openMobile, setOpenMobile]);

  if (collapsible === 'none') {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          'flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  // mobile 与 >=768px 共用同一棵 DOM 树：跨 768px 断点时元素不卸载，
  // 收放过渡得以保留。mobile 下为覆盖式抽屉，gap 恒为 0（抽屉不推挤内容）。
  // context 的 state 已按 isMobile 切换数据源（移动端为 openMobile），直接使用。
  return (
    <div
      ref={rootRef}
      className="group peer text-sidebar-foreground"
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-variant={variant}
      data-side={side}
      data-mobile={isMobile ? 'true' : undefined}
      data-slot="sidebar"
    >
      {/* mobile 遮罩：常驻 DOM，仅 mobile 且抽屉打开时可见，opacity 双向过渡。
          backdrop-blur 只在可见时挂载——全屏 backdrop-filter 即使透明也有合成开销 */}
      <div
        data-slot="sidebar-backdrop"
        aria-hidden
        onClick={() => setOpenMobile(false)}
        className={cn(
          'fixed inset-0 z-40 bg-black/10 transition-opacity duration-200',
          isMobile && openMobile
            ? 'opacity-100 supports-backdrop-filter:backdrop-blur-xs'
            : 'pointer-events-none opacity-0',
        )}
      />
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          'relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[mobile=true]:w-0',
          variant === 'floating' || variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
        )}
      />
      <div
        data-slot="sidebar-container"
        data-side={side}
        id={sidebarId}
        // 移动端抽屉打开期间即对话框语义（role/aria 仅此时挂载，避免与
        // 页面上其他 dialog 冲突）；桌面端与抽屉关闭时均为常规布局面板。
        // 用展开写法是因为 biome 静态分析无法识别"role 与 aria-modal 同生共死"
        {...(isMobile && openMobile
          ? ({
              role: 'dialog',
              'aria-modal': true,
              'aria-label': t('sidebar.label'),
            } as const)
          : {})}
        // 抽屉打开时焦点落在此容器上（-1 不进入 Tab 序列）
        tabIndex={-1}
        className={cn(
          // visibility 参与过渡：关闭动画播完才真正隐藏（且屏外抽屉不可聚焦），
          // 打开时立即可见
          'fixed inset-y-0 z-10 flex h-svh w-(--sidebar-width) transition-[left,right,width,opacity,visibility] duration-200 ease-linear data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
          // mobile：覆盖式抽屉浮于内容之上；收起 = 向侧滑出并淡出
          'group-data-[mobile=true]:z-50 group-data-[mobile=true]:shadow-lg',
          'group-data-[mobile=true]:group-data-[collapsible=offcanvas]:opacity-0 group-data-[mobile=true]:group-data-[collapsible=offcanvas]:invisible',
          // Adjust the padding for floating and inset variants.
          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="flex size-full flex-col bg-sidebar group-data-[variant=floating]:rounded-xl group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  // 图标与尺寸由 context 的真实视口状态派生，无需调用方传参
  const { isMobile, open, openMobile, toggleSidebar, sidebarId } = useSidebar();
  const { t } = useTranslation();

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size={isMobile ? undefined : 'icon-sm'}
      aria-expanded={isMobile ? openMobile : open}
      aria-controls={sidebarId}
      className={cn(
        isMobile && 'size-11',
        // ghost variant 的 aria-expanded:bg-muted 在 CSS 中排在 hover 规则之后，
        // 同特异度下会覆盖 hover 背景；这里先将其压成透明，再用特异度更高的
        // aria-expanded:hover 堆叠 variant 让展开态下的 hover 生效。
        'rounded-full hover:bg-foreground/15 dark:hover:bg-foreground/15 aria-expanded:bg-transparent aria-expanded:hover:bg-foreground/15 dark:aria-expanded:hover:bg-foreground/15',
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      {isMobile ? <MenuIcon /> : <PanelLeftIcon />}
      <span className="sr-only">{t('sidebar.toggle')}</span>
    </Button>
  );
}

function SidebarInset({ className, ...props }: React.ComponentProps<'main'>) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        'relative flex w-full flex-1 flex-col bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
        className,
      )}
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        'no-scrollbar flex min-h-0 flex-1 flex-col gap-0 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn('flex w-full min-w-0 flex-col gap-0', className)}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn('group/menu-item relative', className)}
      {...props}
    />
  );
}

const sidebarMenuButtonVariants = cva(
  'peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-xs ring-sidebar-ring outline-hidden transition-[width,height,padding] group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:hover:bg-sidebar-accent data-open:hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate',
  {
    variants: {
      variant: {
        default: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        outline:
          'bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]',
      },
      size: {
        default: 'h-8 text-xs',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-xs group-data-[collapsible=icon]:p-0!',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function SidebarMenuButton({
  render,
  isActive = false,
  variant = 'default',
  size = 'default',
  tooltip,
  className,
  ...props
}: useRender.ComponentProps<'button'> &
  React.ComponentProps<'button'> & {
    isActive?: boolean;
    tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  } & VariantProps<typeof sidebarMenuButtonVariants>) {
  const { isMobile, state } = useSidebar();
  const comp = useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(
      {
        className: cn(sidebarMenuButtonVariants({ variant, size }), className),
      },
      props,
    ),
    render: !tooltip ? render : <TooltipTrigger render={render} />,
    state: {
      slot: 'sidebar-menu-button',
      sidebar: 'menu-button',
      size,
      active: isActive,
    },
  });

  if (!tooltip) {
    return comp;
  }

  const tooltipProps =
    typeof tooltip === 'string' ? { children: tooltip } : tooltip;

  return (
    <Tooltip>
      {comp}
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== 'collapsed' || isMobile}
        {...tooltipProps}
      />
    </Tooltip>
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  // biome-ignore lint/style/useComponentExportOnlyModules: shadcn 约定：hook 与组件同文件导出
  useSidebar,
};
