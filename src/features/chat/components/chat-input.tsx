import {
  useRef,
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Square } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface ChatInputProps {
  onSend: (content: string, deepThink: boolean) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onCancel?: () => void;
  deepThink: boolean;
  onToggleDeepThink: () => void;
}

export function ChatInput({
  onSend,
  disabled,
  isStreaming,
  onCancel,
  deepThink,
  onToggleDeepThink,
}: ChatInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');
  const isEmpty = !value.trim();

  const handleSend = useCallback(() => {
    const content = value.trim();
    if (!content || disabled) return;
    onSend(content, deepThink);
    setValue('');
  }, [value, onSend, disabled, deepThink]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if (!isStreaming) {
          handleSend();
        }
      }
    },
    [handleSend, isStreaming],
  );

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  }, []);

  // 内容变化时自动调整高度（上限由 max-h-50 控制）
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  const inputDisabled = disabled || isStreaming;

  return (
    <div
      data-testid="chat-input"
      className="rounded-3xl border bg-background p-3 shadow-sm"
    >
      <textarea
        ref={textareaRef}
        data-testid="chat-input-editor"
        value={value}
        disabled={inputDisabled}
        rows={1}
        className={cn(
          'max-h-50 min-h-11 w-full resize-none overflow-y-auto bg-background px-0.5 py-0.5 text-base outline-none',
          'placeholder:text-muted-foreground',
          inputDisabled && 'cursor-not-allowed opacity-50',
        )}
        placeholder={t('chat.input.placeholder')}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
      />
      <div className="mt-2 flex items-center justify-between">
        <Button
          data-testid="deep-think-button"
          variant="outline"
          size="default"
          disabled={inputDisabled}
          onClick={onToggleDeepThink}
          className={cn(
            deepThink &&
              'border-amber-400 bg-amber-400/15 text-amber-400 hover:bg-amber-400/15 hover:text-amber-400 dark:border-amber-400 dark:bg-amber-400/15 dark:hover:bg-amber-400/15 dark:hover:text-amber-400',
            'rounded-full',
          )}
        >
          {t('chat.input.deepThink')}
        </Button>
        {isStreaming ? (
          <Button
            data-testid="stop-button"
            size="default"
            onClick={onCancel}
            className="gap-1.5 rounded-full"
          >
            <Square className="size-3" />
            {t('chat.area.stop')}
          </Button>
        ) : (
          <Button
            data-testid="send-button"
            size="default"
            disabled={disabled || isEmpty}
            onClick={handleSend}
            className="rounded-full"
          >
            {t('chat.input.send')}
          </Button>
        )}
      </div>
    </div>
  );
}
