import { memo } from 'react';
import duckSvg from '@/assets/duck.svg';
import { SidebarTrigger } from '@/shared/components/ui/sidebar';

interface FixedToolbarProps {
  open: boolean;
  buttonGroup?: React.ReactNode;
}

export const FixedToolbar = memo(function FixedToolbar({
  open,
  buttonGroup,
}: FixedToolbarProps) {
  return (
    <div
      className="fixed top-0 left-0 z-10000 flex w-[100px] -translate-x-full pt-2 pl-4 md:translate-x-0"
      style={{
        opacity: open ? 0 : 1,
        pointerEvents: open ? 'none' : 'auto',
        transition: 'opacity .2s ease-in-out',
      }}
    >
      <img src={duckSvg} alt="Duck" className="mr-4 h-7 w-auto" />
      <SidebarTrigger />
      {buttonGroup}
    </div>
  );
});
