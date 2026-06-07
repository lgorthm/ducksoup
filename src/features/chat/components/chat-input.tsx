import { useRef, useCallback, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const content = textarea.value.trim();
    if (!content || disabled) return;
    onSend(content);
    textarea.value = '';
    textarea.style.height = 'auto';
  }, [onSend, disabled]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  return (
    <div className="flex items-end gap-2 border-t bg-background p-3">
      <textarea
        ref={textareaRef}
        className="max-h-[200px] min-h-[44px] w-full resize-none rounded-none border bg-background px-3 py-2.5 text-base outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        placeholder={t('chat.input.placeholder')}
        rows={1}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
      />
      <Button
        size="icon"
        className="shrink-0"
        disabled={disabled}
        onClick={handleSend}
      >
        <Send className="size-4" />
      </Button>
    </div>
  );
}
