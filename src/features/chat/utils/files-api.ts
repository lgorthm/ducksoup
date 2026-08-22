const DEEPSEEK_BASE = 'https://api.deepseek.com';
const FILE_EXPIRES_SECONDS = 2_592_000; // 30 days

function createClient(apiKey: string) {
  return import('openai').then(({ default: OpenAI }) => {
    return new OpenAI({
      apiKey,
      baseURL: DEEPSEEK_BASE,
      dangerouslyAllowBrowser: true,
      maxRetries: 0,
    });
  });
}

export async function uploadImageFile(
  apiKey: string,
  blob: Blob,
  filename: string,
  signal?: AbortSignal,
): Promise<string> {
  const client = await createClient(apiKey);
  const safeName = (filename || 'image.png').slice(0, 512);
  const file = new File([blob], safeName, { type: blob.type || 'image/png' });
  const uploaded = await client.files.create(
    {
      file,
      purpose: 'user_data',
      expires_after: {
        anchor: 'created_at',
        seconds: FILE_EXPIRES_SECONDS,
      },
    },
    { signal },
  );
  return uploaded.id;
}

export async function deleteImageFile(
  apiKey: string,
  fileId: string,
): Promise<void> {
  try {
    const client = await createClient(apiKey);
    await client.files.delete(fileId);
  } catch {
    // 远端清理失败不阻挡本地删除
  }
}
