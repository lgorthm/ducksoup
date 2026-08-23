import { useState } from 'react';
import type { ImageAttachment } from '@/stores/models';
import { useBlobUrl } from '@/features/chat/hooks/use-blob-url';
import { cn } from '@/shared/lib/utils';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';

interface MessageImagesProps {
  attachments: ImageAttachment[];
  onRemove?: (id: string) => void;
  compact?: boolean;
  className?: string;
}

export function MessageImages({
  attachments,
  onRemove,
  compact = false,
  className,
}: MessageImagesProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<{
    attachment: ImageAttachment;
    url: string;
  } | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      <div
        data-testid="message-images"
        className={cn(
          'flex flex-wrap gap-2',
          compact ? 'mb-2' : undefined,
          className,
        )}
      >
        {attachments.map((attachment) => (
          <MessageImageThumb
            key={attachment.id}
            attachment={attachment}
            onRemove={onRemove}
            compact={compact}
            onPreview={(url) => setPreview({ attachment, url })}
          />
        ))}
      </div>
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-black/85 backdrop-blur-none supports-backdrop-filter:backdrop-blur-none"
          className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center rounded-none bg-transparent p-0 ring-0 sm:max-w-none"
          data-testid="image-lightbox"
          onClick={() => setPreview(null)}
        >
          <DialogTitle className="sr-only">
            {preview?.attachment.filename || t('chat.message.imagePreview')}
          </DialogTitle>
          {preview ? (
            <img
              src={preview.url}
              alt={preview.attachment.filename ?? ''}
              className="h-[90dvh] w-[90vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : null}
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon"
                data-testid="image-lightbox-close"
                aria-label={t('common.close')}
                className="absolute top-4 right-4 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                onClick={(e) => e.stopPropagation()}
              />
            }
          >
            <X className="size-5" />
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MessageImageThumb({
  attachment,
  onRemove,
  compact,
  onPreview,
}: {
  attachment: ImageAttachment;
  onRemove?: (id: string) => void;
  compact: boolean;
  onPreview: (url: string) => void;
}) {
  const url = useBlobUrl(attachment.blobKey);
  const { t } = useTranslation();
  const boxClass = compact ? 'size-20' : 'size-24';

  return (
    <div className="relative">
      {url ? (
        <button
          type="button"
          data-testid="message-image-thumb"
          aria-label={t('chat.message.imagePreview')}
          onClick={(e) => {
            e.stopPropagation();
            onPreview(url);
          }}
          className={cn('cursor-zoom-in overflow-hidden rounded-lg', boxClass)}
        >
          <img
            src={url}
            alt={attachment.filename ?? ''}
            data-testid="message-image"
            className="size-full object-cover"
          />
        </button>
      ) : (
        <div className={cn('animate-pulse rounded-lg bg-muted', boxClass)} />
      )}
      {onRemove ? (
        <button
          type="button"
          data-testid="attachment-remove"
          aria-label={t('chat.input.removeImage')}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(attachment.id);
          }}
          className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}
