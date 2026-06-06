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
  const [ringStyle, setRingStyle] = React.useState<React.CSSProperties>({
    opacity: 0,
  });

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const button = container.querySelector(
      `[data-value="${currentValue}"]`,
    ) as HTMLElement | null;
    if (!button) return;

    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    const spread = 2;
    setRingStyle({
      left: buttonRect.left - containerRect.left - spread,
      top: buttonRect.top - containerRect.top - spread,
      width: buttonRect.width + spread * 2,
      height: buttonRect.height + spread * 2,
      opacity: 1,
    });
  }, [currentValue]);

  const handleClick = (optionValue: T) => {
    if (!isControlled) {
      setInternalValue(optionValue);
    }
    onValueChange?.(optionValue);
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-flex border', className)}
    >
      {/* 悬浮指示环 */}
      <div
        aria-hidden
        className="pointer-events-none absolute z-10 rounded-none border-2 border-amber-400 bg-amber-400/15 transition-all duration-300 ease-out"
        style={ringStyle}
      />
      {options.map((option) => (
        <Button
          key={option.value}
          variant="ghost"
          data-value={option.value}
          className="relative z-20 cursor-pointer hover:bg-transparent hover:text-inherit dark:hover:bg-transparent"
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
