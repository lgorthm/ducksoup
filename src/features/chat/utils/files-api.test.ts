import { describe, expect, it, vi, beforeEach } from 'vitest';
import { uploadImageFile } from './files-api';

const mockCreate = vi.fn();
const OpenAI = vi.fn(function MockOpenAI() {
  return { files: { create: mockCreate, delete: vi.fn() } };
});

vi.mock('openai', () => ({
  default: OpenAI,
}));

beforeEach(() => {
  OpenAI.mockClear();
  mockCreate.mockReset();
  mockCreate.mockResolvedValue({ id: 'file-api-xyz' });
});

describe('uploadImageFile', () => {
  it('以 user_data purpose 上传并返回 file id', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const id = await uploadImageFile('key', blob, 'shot.png');
    expect(id).toBe('file-api-xyz');
    expect(OpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'key',
        baseURL: 'https://api.deepseek.com',
        dangerouslyAllowBrowser: true,
      }),
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'user_data',
        expires_after: {
          anchor: 'created_at',
          seconds: 2_592_000,
        },
      }),
      expect.objectContaining({ signal: undefined }),
    );
  });
});
