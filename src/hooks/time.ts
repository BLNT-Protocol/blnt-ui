import { useEffect, useState } from 'react';

/**
 * Read wall-clock time on the client without making rendering impure or
 * producing server/client hydration differences.
 */
export function useCurrentTimestamp(refreshIntervalMs: number = 1000): number | undefined {
  const [timestamp, setTimestamp] = useState<number>();

  useEffect(() => {
    const updateTimestamp = () => setTimestamp(Math.floor(Date.now() / 1000));
    const initialUpdate = window.setTimeout(updateTimestamp, 0);
    const interval = window.setInterval(updateTimestamp, refreshIntervalMs);

    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, [refreshIntervalMs]);

  return timestamp;
}
