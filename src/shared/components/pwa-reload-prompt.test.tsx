import { render } from '@testing-library/react';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';
import { PwaReloadPrompt } from './pwa-reload-prompt';

const { updateServiceWorker } = vi.hoisted(() => ({
  updateServiceWorker: vi.fn(),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));

vi.mock('sonner', () => ({ toast: vi.fn() }));

describe('PwaReloadPrompt', () => {
  it('shows a sticky toast when a new version is waiting', () => {
    render(<PwaReloadPrompt />);
    expect(toast).toHaveBeenCalledWith(
      '发现新版本，刷新以更新',
      expect.objectContaining({
        id: 'pwa-reload',
        duration: Number.POSITIVE_INFINITY,
      }),
    );
  });

  it('activates the new service worker when the action is clicked', () => {
    render(<PwaReloadPrompt />);
    const options = vi.mocked(toast).mock.calls[0]?.[1];
    const action = options?.action as { onClick: () => void } | undefined;
    expect(action).toBeDefined();
    action?.onClick();
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
