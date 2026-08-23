import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { MessageNode } from '@/stores/models';
import { editMessage } from '@/stores/actions';
import { useStore } from '@/stores';
import { EditForm } from './message-edit-form';

vi.mock('@/stores/actions', () => ({
  editMessage: vi.fn(),
  setEditingMessage: vi.fn(),
}));

vi.mock('@/features/chat/hooks/use-blob-url', () => ({
  useBlobUrl: () => 'blob:mock-image',
}));

const attachment = {
  id: 'att-1',
  mime: 'image/png' as const,
  width: 10,
  height: 10,
  byteLength: 8,
  blobKey: 'blob-1',
  filename: 'a.png',
};

function makeMessage(overrides: Partial<MessageNode> = {}): MessageNode {
  return {
    id: 'u1',
    conversationId: 'c1',
    role: 'user',
    parentId: 'root',
    childrenIds: [],
    siblingIndex: 0,
    activeChildId: null,
    content: '看这张图',
    status: 'done',
    createdAt: 1,
    attachments: [attachment],
    ...overrides,
  };
}

function seedConversation(
  model: 'deepseek-v4-flash-vision-exp' | 'deepseek-v4-pro',
) {
  useStore.setState({
    isLoading: false,
    currentConversationId: 'c1',
    conversations: [
      {
        id: 'c1',
        title: '测试会话',
        createdAt: 1,
        updatedAt: 1,
        messageCount: 1,
        rootId: 'root',
        activeLeafId: 'u1',
        model,
      },
    ],
  });
}

describe('EditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({ isLoading: false });
  });

  it('移除全部图片后提交空附件列表，而不是 undefined', async () => {
    render(<EditForm message={makeMessage()} />);

    fireEvent.click(screen.getByTestId('attachment-remove'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('message-edit-send'));
    });

    expect(editMessage).toHaveBeenCalledWith('u1', '看这张图', []);
  });

  it('Flash 会话显示附件按钮', () => {
    seedConversation('deepseek-v4-flash-vision-exp');
    render(<EditForm message={makeMessage({ attachments: undefined })} />);
    expect(screen.getByTestId('edit-attach-button')).toBeInTheDocument();
  });

  it('Pro 会话不显示附件按钮', () => {
    seedConversation('deepseek-v4-pro');
    render(<EditForm message={makeMessage({ attachments: undefined })} />);
    expect(screen.queryByTestId('edit-attach-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-attach-input')).not.toBeInTheDocument();
  });
});
