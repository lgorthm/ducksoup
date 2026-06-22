import { useRef, useCallback, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Square } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface ChatInputProps {
  onSend: (content: string, deepThink: boolean) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onCancel?: () => void;
}

export function ChatInput({
  onSend,
  disabled,
  isStreaming,
  onCancel,
}: ChatInputProps) {
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
        if (!isStreaming) {
          handleSend();
        }
      }
    },
    [handleSend, isStreaming],
  );

  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    setIsEmpty(!editor.innerText.trim());
  }, []);

  const inputDisabled = disabled || isStreaming;

  return (
    <div
      data-testid="chat-input"
      className="border bg-background p-3 shadow-sm"
    >
      <div
        ref={editorRef}
        data-testid="chat-input-editor"
        contentEditable={!inputDisabled}
        className={cn(
          'max-h-[200px] min-h-[44px] w-full overflow-y-auto rounded-none bg-background px-0.5 py-0.5 text-base outline-none',
          'empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
          inputDisabled && 'cursor-not-allowed opacity-50',
        )}
        data-placeholder={t('chat.input.placeholder')}
        role="textbox"
        aria-multiline="true"
        onKeyDown={handleKeyDown}
        onInput={handleInput}
      />
      <div className="mt-2 flex items-center justify-between">
        <Button
          data-testid="deep-think-button"
          variant={deepThink ? 'default' : 'outline'}
          size="default"
          disabled={inputDisabled}
          onClick={() => setDeepThink((prev) => !prev)}
        >
          {t('chat.input.deepThink')}
        </Button>
        {isStreaming ? (
          <Button
            data-testid="stop-button"
            size="default"
            onClick={onCancel}
            className="gap-1.5"
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
          >
            {t('chat.input.send')}
          </Button>
        )}
      </div>
    </div>
  );
}
