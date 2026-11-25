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

/**
 * Read wall-clock time at a lower cadence while a countdown is far from its
 * deadline, switching to a faster cadence as the deadline approaches.
 */
export function useCountdownTimestamp(
  expirationTimestamp: number,
  slowThresholdSeconds: number = 24 * 60 * 60,
  fastRefreshIntervalMs: number = 1000,
  slowRefreshIntervalMs: number = 60 * 1000
): number | undefined {
  const [timestamp, setTimestamp] = useState<number>();

  useEffect(() => {
    if (expirationTimestamp === 0) return;

    let timer: number | undefined;
    const updateTimestamp = () => {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      setTimestamp(currentTimestamp);
      const refreshInterval =
        expirationTimestamp - currentTimestamp > slowThresholdSeconds
          ? slowRefreshIntervalMs
          : fastRefreshIntervalMs;
      timer = window.setTimeout(updateTimestamp, refreshInterval);
    };

    timer = window.setTimeout(updateTimestamp, 0);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [expirationTimestamp, fastRefreshIntervalMs, slowRefreshIntervalMs, slowThresholdSeconds]);

  return timestamp;
}
