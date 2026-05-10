import { useState, useEffect } from 'react';

import { cachedGet } from '@/api/apiBase';

export function useVisibility(): Record<string, boolean> | null {
  const [visibility, setVisibility] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();

    cachedGet<Record<string, boolean>>('/visibility', {
      signal: ctrl.signal,
      cacheTtl: 120_000,
    })
      .then((data) => {
        if (!ctrl.signal.aborted && data && typeof data === 'object') {
          setVisibility(data);
        }
      })
      .catch(() => {});

    return () => ctrl.abort();
  }, []);

  return visibility;
}
