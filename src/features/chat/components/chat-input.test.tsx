import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from './chat-input';

function setupInput(overrides: Partial<Parameters<typeof ChatInput>[0]> = {}) {
  const onSend = vi.fn();
  const onCancel = vi.fn();
  const onToggleDeepThink = vi.fn();
  const props = {
    onSend,
    disabled: false,
    isStreaming: false,
    onCancel,
    deepThink: false,
    onToggleDeepThink,
    ...overrides,
  };
  render(<ChatInput {...props} />);
  return { onSend, onCancel, onToggleDeepThink, props };
}

function setEditorText(text: string) {
  const editor = screen.getByRole('textbox') as HTMLDivElement;
  // jsdom 不支持 contentEditable 的 innerText，手动定义
  let currentText = text;
  Object.defineProperty(editor, 'innerText', {
    get: () => currentText,
    set: (v: string) => {
      currentText = v;
    },
    configurable: true,
  });
  fireEvent.input(editor);
}

describe('ChatInput', () => {
  it('渲染 placeholder', () => {
    setupInput();
    const editor = screen.getByRole('textbox');
    expect(editor).toHaveAttribute('data-placeholder', expect.any(String));
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
    expect(onSend).toHaveBeenCalledWith('你好世界', false);
  });

  it('发送后清空输入', () => {
    setupInput();
    setEditorText('你好');
    fireEvent.click(screen.getByText('发送'));
    expect(screen.getByText('发送')).toBeDisabled();
  });

  it('Enter 键发送', () => {
    const { onSend } = setupInput();
    setEditorText('测试');
    const editor = screen.getByRole('textbox');
    fireEvent.keyDown(editor, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('测试', false);
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
    expect(onSend).toHaveBeenCalledWith('你好', true);
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
    const editor = screen.getByRole('textbox');
    expect(editor).toHaveAttribute('contenteditable', 'false');
  });

  it('流式时输入框不可编辑', () => {
    setupInput({ isStreaming: true });
    const editor = screen.getByRole('textbox');
    expect(editor).toHaveAttribute('contenteditable', 'false');
  });
});
