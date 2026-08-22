import {
  useRef,
  useCallback,
  useEffect,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ChangeEvent,
  type ClipboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Paperclip, Square } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { generateId } from '@/stores/utils/ids';
import {
  MAX_IMAGES_PER_MESSAGE,
  validateImageFile,
  type PendingImage,
} from '@/features/chat/utils/image-attachments';

interface ChatInputProps {
  onSend: (content: string, deepThink: boolean, images: PendingImage[]) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onCancel?: () => void;
  deepThink: boolean;
  onToggleDeepThink: () => void;
  canAttachImages?: boolean;
  onPendingImagesChange?: (count: number) => void;
}

export function ChatInput({
  onSend,
  disabled,
  isStreaming,
  onCancel,
  deepThink,
  onToggleDeepThink,
  canAttachImages = false,
  onPendingImagesChange,
}: ChatInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const isEmpty = !value.trim() && pending.length === 0;

  useEffect(() => {
    onPendingImagesChange?.(pending.length);
  }, [pending.length, onPendingImagesChange]);

  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => {
    return () => {
      for (const item of pendingRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      if (!canAttachImages || disabled || isStreaming) return;
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length === 0) return;

      const room = MAX_IMAGES_PER_MESSAGE - pending.length;
      if (room <= 0) {
        toast.error(
          t('chat.input.imageTooMany', { count: MAX_IMAGES_PER_MESSAGE }),
        );
        return;
      }
      const accepted = images.slice(0, room);
      if (images.length > room) {
        toast.error(
          t('chat.input.imageTooMany', { count: MAX_IMAGES_PER_MESSAGE }),
        );
      }

      const next: PendingImage[] = [];
      for (const file of accepted) {
        const result = await validateImageFile(file);
        if (!result.ok) {
          const key =
            result.code === 'too-large'
              ? 'chat.input.imageTooLarge'
              : result.code === 'too-big-dimension'
                ? 'chat.input.imageTooBig'
                : 'chat.input.imageFormatError';
          toast.error(t(key));
          continue;
        }
        next.push({
          id: generateId(),
          blob: file,
          mime: result.meta.mime,
          width: result.meta.width,
          height: result.meta.height,
          filename: file.name,
          previewUrl: URL.createObjectURL(file),
        });
      }
      if (next.length > 0) {
        setPending((prev) => [...prev, ...next]);
      }
    },
    [canAttachImages, disabled, isStreaming, pending.length, t],
  );

  const removePending = useCallback((id: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const handleSend = useCallback(() => {
    const content = value.trim();
    if ((!content && pending.length === 0) || disabled) return;
    onSend(content, deepThink, pending);
    setValue('');
    setPending([]);
  }, [value, onSend, disabled, deepThink, pending]);

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

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      const files = [...e.clipboardData.files];
      if (files.some((f) => f.type.startsWith('image/'))) {
        e.preventDefault();
        void addFiles(files);
      }
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      void addFiles([...e.dataTransfer.files]);
    },
    [addFiles],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: 用 value 触发按内容重算高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  const inputDisabled = disabled || isStreaming;

  const attachButton = (
    <Button
      type="button"
      data-testid="attach-button"
      variant="outline"
      size="icon"
      disabled={inputDisabled || !canAttachImages}
      onClick={() => fileInputRef.current?.click()}
      aria-label={t('chat.input.attach')}
      className="rounded-full"
    >
      <Paperclip className="size-4" />
    </Button>
  );

  return (
    <div
      data-testid="chat-input"
      className={cn(
        'rounded-3xl border bg-background p-3 shadow-sm',
        isDragging && canAttachImages && 'border-primary',
      )}
      onPaste={handlePaste}
      onDragOver={(e) => {
        if (!canAttachImages) return;
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        data-testid="attach-file-input"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        disabled={inputDisabled || !canAttachImages}
        onChange={(e) => {
          const list = e.target.files ? [...e.target.files] : [];
          e.target.value = '';
          void addFiles(list);
        }}
      />
      {pending.length > 0 ? (
        <div
          data-testid="attachment-preview"
          className="mb-2 flex flex-wrap gap-2"
        >
          {pending.map((item) => (
            <div key={item.id} className="relative">
              <img
                src={item.previewUrl}
                alt={item.filename}
                className="max-h-20 max-w-24 rounded-lg object-cover"
              />
              <button
                type="button"
                data-testid="attachment-remove"
                aria-label={t('chat.input.removeImage')}
                onClick={() => removePending(item.id)}
                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-xs text-background"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
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
        <div className="flex items-center gap-2">
          {canAttachImages ? (
            attachButton
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex" />}>
                  {attachButton}
                </TooltipTrigger>
                <TooltipContent>
                  {t('chat.input.attachDisabled')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
        </div>
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
