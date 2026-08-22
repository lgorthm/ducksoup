import { memo, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp, Loader2, Paperclip, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { ImageAttachment, MessageNode } from '@/stores/models';
import { editMessage, setEditingMessage } from '@/stores/actions';
import { useEditFormState } from '@/stores/selectors';
import { MessageImages } from './message-images';
import * as db from '@/features/chat/utils/db';
import { generateId } from '@/stores/utils/ids';
import {
  type PendingImage,
  validateImageFile,
} from '@/features/chat/utils/image-attachments';

interface EditFormProps {
  message: MessageNode;
}

export const EditForm = memo(function EditForm({ message }: EditFormProps) {
  const { t } = useTranslation();
  const { isLoading } = useEditFormState();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [kept, setKept] = useState<ImageAttachment[]>(
    () => message.attachments ?? [],
  );
  const [pending, setPending] = useState<PendingImage[]>([]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    const len = ta.value.length;
    ta.setSelectionRange(len, len);
    autoResize(ta);
  }, []);

  const cancel = () => {
    for (const item of pending) URL.revokeObjectURL(item.previewUrl);
    setEditingMessage(null);
  };

  const send = async () => {
    const ta = textareaRef.current;
    if (!ta || isLoading) return;
    const value = ta.value.trim();
    const added: ImageAttachment[] = [];
    for (const item of pending) {
      const blobKey = generateId();
      await db.putBlob(blobKey, item.blob);
      added.push({
        id: generateId(),
        mime: item.mime,
        width: item.width,
        height: item.height,
        byteLength: item.blob.size,
        blobKey,
        filename: item.filename,
      });
    }
    const next = [...kept, ...added];
    if (!value && next.length === 0) return;
    for (const item of pending) URL.revokeObjectURL(item.previewUrl);
    void editMessage(message.id, value, next.length > 0 ? next : undefined);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!isLoading) void send();
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
      <div className="px-3 pt-2">
        <MessageImages
          attachments={kept}
          compact
          onRemove={(id) => setKept((prev) => prev.filter((a) => a.id !== id))}
        />
        {pending.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((item) => (
              <img
                key={item.id}
                src={item.previewUrl}
                alt={item.filename}
                className="max-h-20 max-w-24 rounded-lg object-cover"
              />
            ))}
          </div>
        ) : null}
      </div>
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
      <div className="flex items-center justify-between gap-2 px-1 py-1">
        <input
          ref={fileInputRef}
          data-testid="edit-attach-input"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            void validateImageFile(file).then((result) => {
              if (!result.ok) return;
              setPending((prev) => [
                ...prev,
                {
                  id: generateId(),
                  blob: file,
                  mime: result.meta.mime,
                  width: result.meta.width,
                  height: result.meta.height,
                  filename: file.name,
                  previewUrl: URL.createObjectURL(file),
                },
              ]);
            });
          }}
        />
        <Button
          type="button"
          data-testid="edit-attach-button"
          variant="ghost"
          size="sm"
          disabled={isLoading}
          aria-label={t('chat.input.attach')}
          className="rounded-full"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="size-3.5" />
        </Button>
        <div className="flex items-center gap-2">
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
            onClick={() => void send()}
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
    </div>
  );
});

function autoResize(el: HTMLTextAreaElement | HTMLInputElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
}
