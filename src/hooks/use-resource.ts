import { useCallback, useEffect, useState } from 'react';

interface ResourceState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Generic async resource hook for service-layer calls.
 */
export function useResource<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    loader()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  }, [tick, ...deps]);

  return { data, isLoading, error, refetch };
}
