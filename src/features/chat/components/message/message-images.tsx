import type { ImageAttachment } from '@/stores/models';
import { useBlobUrl } from '@/features/chat/hooks/use-blob-url';
import { cn } from '@/shared/lib/utils';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MessageImagesProps {
  attachments: ImageAttachment[];
  onRemove?: (id: string) => void;
  compact?: boolean;
}

export function MessageImages({
  attachments,
  onRemove,
  compact = false,
}: MessageImagesProps) {
  if (attachments.length === 0) return null;
  return (
    <div
      data-testid="message-images"
      className={cn('flex flex-wrap gap-2', compact ? 'mb-2' : 'mb-1')}
    >
      {attachments.map((attachment) => (
        <MessageImageThumb
          key={attachment.id}
          attachment={attachment}
          onRemove={onRemove}
          compact={compact}
        />
      ))}
    </div>
  );
}

function MessageImageThumb({
  attachment,
  onRemove,
  compact,
}: {
  attachment: ImageAttachment;
  onRemove?: (id: string) => void;
  compact: boolean;
}) {
  const url = useBlobUrl(attachment.blobKey);
  const { t } = useTranslation();
  return (
    <div className="relative">
      {url ? (
        <img
          src={url}
          alt={attachment.filename ?? ''}
          data-testid="message-image"
          className={cn(
            'rounded-lg object-contain',
            compact ? 'max-h-20 max-w-24' : 'max-h-64 max-w-full',
          )}
        />
      ) : (
        <div
          className={cn(
            'animate-pulse rounded-lg bg-muted',
            compact ? 'h-20 w-20' : 'h-32 w-32',
          )}
        />
      )}
      {onRemove ? (
        <button
          type="button"
          data-testid="attachment-remove"
          aria-label={t('chat.input.removeImage')}
          onClick={() => onRemove(attachment.id)}
          className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}
