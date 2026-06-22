import { memo } from 'react';
import duckSvg from '@/assets/duck.svg';
import { SidebarTrigger } from '@/shared/components/ui/sidebar';

const DUCK_LOGO = <img src={duckSvg} alt="Duck" className="mr-4 h-7 w-auto" />;

const TOOLBAR_TRANSITION = {
  transition: 'transform .3s ease-in-out, opacity .2s ease-in-out',
} as const;

interface FixedToolbarProps {
  open: boolean;
  isMobile: boolean;
  buttonGroup?: React.ReactNode;
}

export const FixedToolbar = memo(function FixedToolbar({
  open,
  isMobile,
  buttonGroup,
}: FixedToolbarProps) {
  return (
    <div
      data-testid="fixed-toolbar"
      className="fixed top-0 left-0 z-10000 flex w-[100px] pt-2 pl-4"
      style={{
        ...TOOLBAR_TRANSITION,
        transform: isMobile ? 'translateX(-100%)' : 'translateX(0)',
        opacity: open ? 0 : 1,
        pointerEvents: open ? 'none' : 'auto',
      }}
    >
      {DUCK_LOGO}
      <SidebarTrigger />
      {buttonGroup}
    </div>
  );
});
