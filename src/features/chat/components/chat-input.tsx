import { useRef, useCallback, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface ChatInputProps {
  onSend: (content: string, deepThink: boolean) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const [deepThink, setDeepThink] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleSend = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const content = editor.innerText.trim();
    if (!content || disabled) return;
    onSend(content, deepThink);
    editor.innerText = '';
    setIsEmpty(true);
  }, [onSend, disabled, deepThink]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    setIsEmpty(!editor.innerText.trim());
  }, []);

  return (
    <div className="border bg-background p-3 shadow-sm">
      <div
        ref={editorRef}
        contentEditable={!disabled}
        className={cn(
          'max-h-[200px] min-h-[44px] w-full overflow-y-auto rounded-none bg-background px-0.5 py-0.5 text-base outline-none',
          'empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
          disabled && 'cursor-not-allowed opacity-50',
        )}
        data-placeholder={t('chat.input.placeholder')}
        role="textbox"
        aria-multiline="true"
        onKeyDown={handleKeyDown}
        onInput={handleInput}
      />
      <div className="mt-2 flex items-center justify-between">
        <Button
          variant={deepThink ? 'default' : 'outline'}
          size="default"
          disabled={disabled}
          onClick={() => setDeepThink((prev) => !prev)}
        >
          {t('chat.input.deepThink')}
        </Button>
        <Button
          size="default"
          disabled={disabled || isEmpty}
          onClick={handleSend}
        >
          {t('chat.input.send')}
        </Button>
      </div>
    </div>
  );
}
