import { useEffect, useState } from 'react';
import * as db from '@/features/chat/utils/db';

export function useBlobUrl(blobKey: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!blobKey) return;
    let alive = true;
    let objectUrl: string | undefined;
    void db.getBlob(blobKey).then((blob) => {
      if (!alive || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [blobKey]);

  return url;
}
