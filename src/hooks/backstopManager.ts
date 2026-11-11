import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useLocalStorageState } from '.';
import { useSettings } from '../contexts';
import { useWallet } from '../contexts/wallet';
import {
  BackstopManagerState,
  loadBackstopManagerState,
  loadTokenBalance,
} from '../utils/backstop_manager';

const STALE_TIME = 30 * 1000;

/**
 * Backstop manager contracts the user has opened, kept only in this browser's
 * localStorage (each contract belongs to one user, so none are built in).
 */
export function useSavedBackstopManagers(): {
  savedManagers: string[];
  saveManager: (id: string) => void;
  forgetManager: (id: string) => void;
} {
  const [stored, setStored] = useLocalStorageState('trackedBackstopManagers', undefined);
  const savedManagers = useMemo(() => {
    try {
      const parsed = JSON.parse(stored ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    } catch (e) {
      console.warn('Failed to parse trackedBackstopManagers:', e);
      return [];
    }
  }, [stored]);

  return {
    savedManagers,
    saveManager: (id: string) => {
      if (!savedManagers.includes(id)) setStored(JSON.stringify([...savedManagers, id]));
    },
    forgetManager: (id: string) => {
      if (savedManagers.includes(id)) {
        setStored(JSON.stringify(savedManagers.filter((saved) => saved !== id)));
      }
    },
  };
}

/** A backstop manager contract's roles and its positions in every allowed backstop/pool. */
export function useBackstopManager(
  managerId: string,
  enabled: boolean = true
): UseQueryResult<BackstopManagerState, Error> {
  const { network } = useSettings();
  return useQuery({
    staleTime: STALE_TIME,
    refetchInterval: STALE_TIME,
    // first key is cleared by the wallet cache cleaner after each transaction
    queryKey: ['backstopManager', managerId],
    enabled: enabled && managerId !== '',
    retry: false,
    queryFn: () => loadBackstopManagerState(network, managerId),
  });
}

/** The connected wallet's balances of the given tokens, in the same order. */
export function useWalletTokenBalances(
  tokens: string[],
  enabled: boolean = true
): UseQueryResult<bigint[], Error> {
  const { network } = useSettings();
  const { walletAddress, connected } = useWallet();
  return useQuery({
    staleTime: STALE_TIME,
    // 'balance' is cleared by the wallet cache cleaner after each transaction
    queryKey: ['balance', 'backstopManagerFund', walletAddress, ...tokens],
    enabled: enabled && connected && walletAddress !== '' && tokens.length > 0,
    queryFn: () =>
      Promise.all(tokens.map((token) => loadTokenBalance(network, token, walletAddress))),
  });
}
