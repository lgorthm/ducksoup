import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ImageAttachment } from '@/stores/models';
import { MessageImages } from './message-images';

vi.mock('@/features/chat/hooks/use-blob-url', () => ({
  useBlobUrl: () => 'blob:mock-image',
}));

const attachment: ImageAttachment = {
  id: 'a1',
  mime: 'image/png',
  width: 800,
  height: 200,
  byteLength: 12,
  blobKey: 'b1',
  filename: 'wide.png',
};

describe('MessageImages', () => {
  it('缩略图使用固定方格尺寸', () => {
    render(<MessageImages attachments={[attachment]} />);
    const thumb = screen.getByTestId('message-image-thumb');
    expect(thumb.className.split(/\s+/)).toContain('size-24');
    expect(screen.getByTestId('message-image').className).toContain(
      'object-cover',
    );
  });

  it('点击缩略图打开全屏预览，关闭按钮可关掉', () => {
    render(<MessageImages attachments={[attachment]} />);
    fireEvent.click(screen.getByTestId('message-image-thumb'));
    expect(screen.getByTestId('image-lightbox')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('image-lightbox-close'));
    expect(screen.queryByTestId('image-lightbox')).not.toBeInTheDocument();
  });

  it('点移除不会打开预览', () => {
    const onRemove = vi.fn();
    render(
      <MessageImages attachments={[attachment]} onRemove={onRemove} compact />,
    );
    fireEvent.click(screen.getByTestId('attachment-remove'));
    expect(onRemove).toHaveBeenCalledWith('a1');
    expect(screen.queryByTestId('image-lightbox')).not.toBeInTheDocument();
  });
});
