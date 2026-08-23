import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatInput } from './chat-input';

/** 1×1 PNG，通过魔数校验 */
const PNG_1X1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

function setupInput(overrides: Partial<Parameters<typeof ChatInput>[0]> = {}) {
  const onSend = vi.fn();
  const onCancel = vi.fn();
  const onToggleDeepThink = vi.fn();
  const onToggleWebSearch = vi.fn();
  const props = {
    onSend,
    disabled: false,
    isStreaming: false,
    onCancel,
    deepThink: false,
    onToggleDeepThink,
    webSearch: false,
    onToggleWebSearch,
    ...overrides,
  };
  const view = render(<ChatInput {...props} />);
  return {
    onSend,
    onCancel,
    onToggleDeepThink,
    onToggleWebSearch,
    props,
    unmount: view.unmount,
  };
}

function setEditorText(text: string) {
  const editor = screen.getByRole('textbox');
  fireEvent.change(editor, { target: { value: text } });
}

describe('ChatInput', () => {
  it('渲染 placeholder', () => {
    setupInput();
    const editor = screen.getByRole('textbox');
    expect(editor).toHaveAttribute('placeholder', expect.any(String));
  });

  it('初始状态发送按钮禁用', () => {
    setupInput();
    expect(screen.getByText('发送')).toBeDisabled();
  });

  it('输入内容后发送按钮启用', () => {
    setupInput();
    setEditorText('你好');
    expect(screen.getByText('发送')).toBeEnabled();
  });

  it('点击发送调用 onSend', () => {
    const { onSend } = setupInput();
    setEditorText('你好世界');
    fireEvent.click(screen.getByText('发送'));
    expect(onSend).toHaveBeenCalledWith('你好世界', false, []);
  });

  it('发送后清空输入', () => {
    setupInput();
    setEditorText('你好');
    fireEvent.click(screen.getByText('发送'));
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByText('发送')).toBeDisabled();
  });

  it('Enter 键发送', () => {
    const { onSend } = setupInput();
    setEditorText('测试');
    const editor = screen.getByRole('textbox');
    fireEvent.keyDown(editor, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('测试', false, []);
  });

  it('Shift+Enter 不发送', () => {
    const { onSend } = setupInput();
    setEditorText('测试');
    const editor = screen.getByRole('textbox');
    fireEvent.keyDown(editor, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('中文合成中 Enter 不发送', () => {
    const { onSend } = setupInput();
    setEditorText('测试');
    const editor = screen.getByRole('textbox');
    fireEvent.keyDown(editor, {
      key: 'Enter',
      isComposing: true,
    });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('深度思考按钮调用 onToggleDeepThink', () => {
    const { onToggleDeepThink } = setupInput();
    fireEvent.click(screen.getByText('深度思考'));
    expect(onToggleDeepThink).toHaveBeenCalledOnce();
  });

  it('deepThink 为 true 时发送传递 true', () => {
    const { onSend } = setupInput({ deepThink: true });
    setEditorText('你好');
    fireEvent.click(screen.getByText('发送'));
    expect(onSend).toHaveBeenCalledWith('你好', true, []);
  });

  it('网页搜索按钮调用 onToggleWebSearch', () => {
    const { onToggleWebSearch } = setupInput();
    fireEvent.click(screen.getByText('网页搜索'));
    expect(onToggleWebSearch).toHaveBeenCalledOnce();
  });

  it('网页搜索按钮在深度思考按钮右侧', () => {
    setupInput();
    const deepThink = screen.getByTestId('deep-think-button');
    const webSearch = screen.getByTestId('web-search-button');
    expect(
      deepThink.compareDocumentPosition(webSearch) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it('webSearch 激活态与深度思考相同', () => {
    const { unmount } = setupInput({ webSearch: true });
    const webSearchActive = screen.getByTestId('web-search-button').className;
    unmount();

    setupInput({ deepThink: true });
    const deepThinkActive = screen.getByTestId('deep-think-button').className;
    const amberClasses = deepThinkActive
      .split(/\s+/)
      .filter((c) => c.includes('amber-400'));
    expect(amberClasses.length).toBeGreaterThan(0);
    for (const cls of amberClasses) {
      expect(webSearchActive.split(/\s+/)).toContain(cls);
    }
  });

  it('流式时显示停止按钮', () => {
    setupInput({ isStreaming: true });
    expect(screen.getByText('停止')).toBeInTheDocument();
    expect(screen.queryByText('发送')).not.toBeInTheDocument();
  });

  it('点击停止按钮调用 onCancel', () => {
    const { onCancel } = setupInput({ isStreaming: true });
    fireEvent.click(screen.getByText('停止'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disabled 时输入框不可编辑', () => {
    setupInput({ disabled: true });
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('流式时输入框不可编辑', () => {
    setupInput({ isStreaming: true });
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('canAttachImages 为 false 时不渲染附件按钮', () => {
    setupInput({ canAttachImages: false });
    expect(screen.queryByTestId('attach-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('attach-file-input')).not.toBeInTheDocument();
  });

  it('canAttachImages 为 true 时附件按钮启用', () => {
    setupInput({ canAttachImages: true });
    expect(screen.getByTestId('attach-button')).toBeEnabled();
  });

  it('附件按钮在发送按钮左侧', () => {
    setupInput({ canAttachImages: true });
    const attach = screen.getByTestId('attach-button');
    const send = screen.getByTestId('send-button');
    expect(
      attach.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it('流式时停止按钮只有文案没有图标', () => {
    setupInput({ isStreaming: true });
    const stop = screen.getByTestId('stop-button');
    expect(stop).toHaveTextContent('停止');
    expect(stop.querySelector('svg')).toBeNull();
  });

  it('发送后释放图片预览 URL', async () => {
    const previewUrl = 'blob:preview-send';
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(previewUrl);
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    setupInput({ canAttachImages: true });
    const file = new File([PNG_1X1], 'tiny.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('attach-file-input'), {
      target: { files: [file] },
    });

    await screen.findByTestId('attachment-preview');
    fireEvent.click(screen.getByTestId('send-button'));

    await waitFor(() => {
      expect(revoke).toHaveBeenCalledWith(previewUrl);
    });

    vi.restoreAllMocks();
  });
});
