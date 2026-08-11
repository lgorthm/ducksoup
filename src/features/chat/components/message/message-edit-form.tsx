import { memo, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp, Loader2, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { StoredMessage } from '@/features/chat/types/deepseek';
import { editMessage, setEditingMessage } from '@/stores/actions';
import { useEditFormState } from '@/stores/selectors';

interface EditFormProps {
  message: StoredMessage;
}

export const EditForm = memo(function EditForm({ message }: EditFormProps) {
  const { t } = useTranslation();
  const { isLoading } = useEditFormState();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动聚焦并将光标置于末尾
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    const len = ta.value.length;
    ta.setSelectionRange(len, len);
    autoResize(ta);
  }, []);

  const cancel = () => setEditingMessage(null);

  const send = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const value = ta.value.trim();
    if (!value || isLoading) return;
    void editMessage(message.id, value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!isLoading) send();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <div
      className={cn(
        'flex w-full flex-col rounded-3xl border border-border bg-background text-foreground transition-colors',
        'focus-within:border-primary',
      )}
    >
      <textarea
        ref={textareaRef}
        data-testid="message-edit-textarea"
        defaultValue={message.content}
        placeholder={t('chat.message.editPlaceholder')}
        disabled={isLoading}
        onKeyDown={onKeyDown}
        onInput={(e) => autoResize(e.currentTarget)}
        rows={1}
        className="min-h-8 w-full resize-none bg-transparent px-3 py-1 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50 md:text-sm"
      />
      <div className="flex items-center justify-end gap-2 px-1 py-1">
        <Button
          data-testid="message-edit-cancel"
          variant="ghost"
          size="sm"
          onClick={cancel}
          disabled={isLoading}
          className="rounded-full"
        >
          <X className="size-3.5" />
          {t('common.cancel')}
        </Button>
        <Button
          data-testid="message-edit-send"
          size="sm"
          onClick={send}
          disabled={isLoading}
          className="rounded-full"
        >
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowUp className="size-3.5" />
          )}
          {t('chat.input.send')}
        </Button>
      </div>
    </div>
  );
});

function autoResize(el: HTMLTextAreaElement | HTMLInputElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
}
