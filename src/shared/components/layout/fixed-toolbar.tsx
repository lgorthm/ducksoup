import { useEffect, useState } from 'react';
import duckSvg from '@/assets/duck.svg';
import { SidebarTrigger } from '@/shared/components/ui/sidebar';

interface FixedToolbarProps {
  open: boolean;
  buttonGroup?: React.ReactNode;
}

export function FixedToolbar({ open, buttonGroup }: FixedToolbarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => setVisible(false));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (open) return null;

  return (
    <div
      className="fixed top-0 left-0 z-10000 flex -translate-x-full pt-2 pl-4 md:translate-x-0"
      style={{
        width: '100px',
        opacity: visible ? 1 : 0,
        transition: 'opacity .2s ease-in-out, transform .2s steps(1, end)',
      }}
    >
      <img src={duckSvg} alt="Duck" className="mr-4 h-7 w-auto" />
      <SidebarTrigger />
      {buttonGroup}
    </div>
  );
}
