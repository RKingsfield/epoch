import { useEffect, useState } from 'react';

export interface UseApiResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Returns null fn to skip the call (loading=false, data=null, no error).
 */
export function useApi<T>(
  fn: (() => Promise<T>) | null,
  deps: ReadonlyArray<unknown> = [],
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(fn !== null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (!fn) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fn()
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (alive) setError(String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, bump]);

  return { data, error, loading, reload: () => setBump((b) => b + 1) };
}
