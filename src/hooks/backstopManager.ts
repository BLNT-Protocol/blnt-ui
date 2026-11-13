import { Asset, Horizon } from '@stellar/stellar-sdk';
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
const XLM_SCALE = BigInt(10_000_000);
const XLM_FEE_BUFFER = BigInt(3) * XLM_SCALE;

function amountToStroops(value: string): bigint {
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * XLM_SCALE + BigInt((fraction + '0000000').slice(0, 7));
}

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

/** Amount unavailable to transfer for each classic asset because of reserves or liabilities. */
export function useWalletFundingReserves(
  enabled: boolean = true
): UseQueryResult<Record<string, bigint>, Error> {
  const { network } = useSettings();
  const { walletAddress, connected } = useWallet();
  return useQuery({
    staleTime: STALE_TIME,
    queryKey: ['account', 'backstopManagerFundingReserves', walletAddress],
    enabled: enabled && connected && walletAddress !== '',
    queryFn: async () => {
      const horizon = new Horizon.Server(network.horizonUrl, network.opts);
      const [account, ledgers] = await Promise.all([
        horizon.loadAccount(walletAddress),
        horizon.ledgers().order('desc').limit(1).call(),
      ]);
      const latestLedger = ledgers.records[0];
      if (latestLedger === undefined) throw new Error('Unable to load the current base reserve');
      const reserveEntries = Math.max(
        0,
        2 + account.subentry_count + account.num_sponsoring - account.num_sponsored
      );
      const minimumBalance = BigInt(latestLedger.base_reserve_in_stroops) * BigInt(reserveEntries);
      const unavailable: Record<string, bigint> = {};
      for (const balance of account.balances) {
        let asset: Asset;
        if (balance.asset_type === 'native') {
          asset = Asset.native();
        } else if (
          balance.asset_type === 'credit_alphanum4' ||
          balance.asset_type === 'credit_alphanum12'
        ) {
          asset = new Asset(balance.asset_code, balance.asset_issuer);
        } else {
          continue;
        }
        const sellingLiabilities = amountToStroops(balance.selling_liabilities);
        unavailable[asset.contractId(network.passphrase)] =
          sellingLiabilities + (asset.isNative() ? minimumBalance + XLM_FEE_BUFFER : BigInt(0));
      }
      return unavailable;
    },
  });
}
