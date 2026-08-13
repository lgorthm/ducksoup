import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SidebarProvider } from '@/shared/components/ui/sidebar';
import { SettingsEntry } from './settings-entry';

// 隔离 SettingsDialog 的依赖树，只验证入口自身的挂载时机与开关行为
vi.mock('@/features/settings/settings-dialog', () => ({
  SettingsDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">设置弹窗</div> : null,
}));

function renderEntry() {
  return render(
    <SidebarProvider>
      <SettingsEntry />
    </SidebarProvider>,
  );
}

describe('SettingsEntry', () => {
  it('设置入口是原生 button（键盘可达）', () => {
    renderEntry();

    const button = screen.getByTestId('settings-button');
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveTextContent('系统设置');
  });

  it('首次点击前不挂载弹窗，点击后打开', async () => {
    renderEntry();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-button'));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
