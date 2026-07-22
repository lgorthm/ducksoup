import * as React from 'react';
import { Button } from './button';
import { cn } from '@/shared/lib/utils';

interface RadioGroupButtonProps<T extends string = string> {
  options: { label: string; value: T }[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  className?: string;
}

function RadioGroupButton<T extends string = string>({
  options,
  value: controlledValue,
  defaultValue,
  onValueChange,
  className,
}: RadioGroupButtonProps<T>) {
  const [internalValue, setInternalValue] = React.useState<T>(
    () => defaultValue ?? (options[0]?.value as T),
  );

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const currentValueRef = React.useRef(currentValue);
  const [ringStyle, setRingStyle] = React.useState<React.CSSProperties>({
    opacity: 0,
  });

  const measure = React.useCallback((value: T) => {
    const container = containerRef.current;
    if (!container) return;

    const buttons = container.querySelectorAll<HTMLElement>('[data-value]');
    if (buttons.length === 0) return;

    // 找到当前选中按钮的索引
    let index = 0;
    for (let i = 0; i < buttons.length; i++) {
      if (buttons[i].dataset.value === value) {
        index = i;
        break;
      }
    }

    const containerRect = container.getBoundingClientRect();
    const buttonRect = buttons[index].getBoundingClientRect();
    const borderWidth = 1;

    setRingStyle({
      transform: `translateX(${buttonRect.left - containerRect.left - borderWidth * 2}px) translateY(${buttonRect.top - containerRect.top - borderWidth * 2}px)`,
      width: buttonRect.width + borderWidth * 2,
      height: containerRect.height,
      opacity: 1,
    });
  }, []);

  React.useLayoutEffect(() => {
    measure(currentValue);
  }, [currentValue, measure]);

  React.useEffect(() => {
    currentValueRef.current = currentValue;
  }, [currentValue]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => measure(currentValueRef.current));
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure]);

  const handleClick = (optionValue: T) => {
    if (!isControlled) {
      setInternalValue(optionValue);
    }
    onValueChange?.(optionValue);
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-flex rounded-lg border', className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute z-20 rounded-lg border border-amber-400 bg-amber-400/15 transition-transform duration-300 ease-out"
        style={ringStyle}
      />
      {options.map((option) => (
        <Button
          key={option.value}
          variant="ghost"
          data-value={option.value}
          className={cn(
            'relative z-10 cursor-pointer transition-[background-color] duration-300 ease-out hover:text-inherit active:not-aria-[haspopup]:translate-y-0',
            option.value === currentValue &&
              'text-amber-400 hover:bg-white hover:text-amber-400',
          )}
          onClick={() => handleClick(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export { RadioGroupButton };
export type { RadioGroupButtonProps };
