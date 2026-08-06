import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { AppErrorBoundary } from './app-error-boundary';

const throwState = { shouldThrow: false };

function Bomb() {
  if (throwState.shouldThrow) throw new Error('boom');
  return <div>一切正常</div>;
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    throwState.shouldThrow = false;
    // React 会把边界捕获的错误打到 console，测试里静音
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('正常渲染子组件', () => {
    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );
    expect(screen.getByText('一切正常')).toBeInTheDocument();
  });

  it('子组件抛错时展示兜底 UI', () => {
    throwState.shouldThrow = true;
    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('页面出错了')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '刷新页面' }),
    ).toBeInTheDocument();
  });

  it('错误消失后点击重试可恢复渲染', () => {
    throwState.shouldThrow = true;
    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    throwState.shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(screen.getByText('一切正常')).toBeInTheDocument();
  });
});
