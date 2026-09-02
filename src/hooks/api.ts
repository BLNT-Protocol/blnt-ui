import {
  ALL_ACCESS_PERMISSIONS,
  Backstop,
  BackstopAssetV3,
  BackstopConfig,
  BackstopPool,
  BackstopPoolUser,
  BackstopPoolUserV3,
  BackstopPoolV3,
  BackstopPoolV1,
  BackstopPoolV2,
  BackstopToken,
  BackstopTierV3,
  BackstopV3,
  ErrorTypes,
  getOracleDecimals,
  loadAccessPermissions,
  Network,
  Pool,
  poolEventV1FromEventResponse,
  poolEventV2FromEventResponse,
  PoolMetadata,
  PoolOracle,
  PoolUser,
  PoolV1,
  PoolV1Event,
  PoolV2,
  PoolV2Event,
  PoolV3,
  PoolV3Event,
  Positions,
  TokenMetadata,
  UserBalance,
  Version,
} from '@blend-capital/blend-sdk';
import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Horizon,
  Networks,
  rpc,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import {
  keepPreviousData,
  useQueries,
  useQuery,
  useQueryClient,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';
import { useSettings } from '../contexts';
import { useWallet } from '../contexts/wallet';
import { getContractTokenIcon } from '../external/icon-map';
import { getTokenMetadataFromTOML, TomlMetadata } from '../external/stellar-toml';
import { getTokenBalance } from '../external/token';
import {
  BackfillEmissionsState,
  BackfillSwapState,
  BLNT_BACKFILL_ID,
  loadBackfillEmissionsState,
  loadBackfillSwapState,
} from '../utils/blnt_backfill';
import { getOraclePrices } from '../utils/stellar_rpc';
import { ReserveTokenMetadata } from '../utils/token';
import { NOT_BLEND_POOL_ERROR_MESSAGE, PoolMeta } from './types';

const DEFAULT_STALE_TIME = 30 * 1000;
const USER_STALE_TIME = 60 * 1000;
const BACKSTOP_ID = process.env.NEXT_PUBLIC_BACKSTOP || '';
const BACKSTOP_ID_V2 = process.env.NEXT_PUBLIC_BACKSTOP_V2 || '';
const BACKSTOP_ID_V3 = process.env.NEXT_PUBLIC_BACKSTOP_V3 || '';
const V3_POOL_WASM_HASH = process.env.NEXT_PUBLIC_V3_POOL_WASM_HASH || '';
const BLND_TOKEN_ID = process.env.NEXT_PUBLIC_BLND_TOKEN || '';
const USDC_TOKEN_ID = process.env.NEXT_PUBLIC_USDC_TOKEN || '';
const BLND_USDC_COMET_ID = process.env.NEXT_PUBLIC_BLND_USDC_COMET || '';
const ORACLE_PRICE_FETCHER = process.env.NEXT_PUBLIC_ORACLE_PRICE_FETCHER?.trim();
const POOL_WASM_V1 = 'baf978f10efdbcd85747868bef8832845ea6809f7643b67a4ac0cd669327fc2c';
const POOL_WASM_V2 = 'a41fc53d6753b6c04eb15b021c55052366a4c8e0e21bc72700f461264ec1350e';

//********** Query Client Data **********//

export function useQueryClientCacheCleaner(): {
  cleanWalletCache: () => void;
  cleanBackstopCache: () => void;
  cleanPoolCache: (poolId: string) => void;
  cleanBackstopPoolCache: (poolId: string) => void;
} {
  const queryClient = useQueryClient();

  const cleanWalletCache = () => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === 'balance' ||
        query.queryKey[0] === 'account' ||
        query.queryKey[0] === 'backfillEmissions' ||
        query.queryKey[0] === 'backfillSwap' ||
        query.queryKey[0] === 'sim',
    });

    // Re-invalide the balance and account queries to ensure they are re-fetched after Horizon is updated
    // This is a temporary solution until we have a better way to handle delayed Horizon updates
    setTimeout(() => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'balance' || query.queryKey[0] === 'account',
      });
    }, 1000);
  };

  const cleanBackstopCache = () => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === 'backstop' || query.queryKey[0] === 'backstopTierTokenV3',
    });
  };

  const cleanPoolCache = (poolId: string) => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        (query.queryKey[0] === 'pool' || query.queryKey[0] === 'poolPositions') &&
        query.queryKey[1] === poolId,
    });
  };

  const cleanBackstopPoolCache = (poolId: string) => {
    cleanBackstopCache();
    const invalidatePoolBackstop = () =>
      queryClient.invalidateQueries({
        predicate: (query) =>
          (query.queryKey[0] === 'backstopPool' || query.queryKey[0] === 'backstopPoolUser') &&
          query.queryKey[1] === poolId,
      });
    void invalidatePoolBackstop();

    // Public RPC nodes can briefly serve the ledger preceding a successful
    // submission. Refresh once more so queue/dequeue state does not remain
    // hidden behind the user query's stale-time window.
    setTimeout(() => void invalidatePoolBackstop(), 1000);
  };

  return { cleanWalletCache, cleanBackstopCache, cleanPoolCache, cleanBackstopPoolCache };
}

//********** Chain Data **********//

/**
 * Fetches the current block number from the RPC server.
 * @returns Query result with the current block number.
 */
export function useCurrentBlockNumber(): UseQueryResult<number, Error> {
  const { getRPCServer } = useSettings();
  return useQuery({
    staleTime: 5 * 1000,
    queryKey: ['blockNumber'],
    queryFn: async () => {
      const rpc = getRPCServer();
      const data = await rpc.getLatestLedger();
      return data.sequence;
    },
  });
}

/**
 * Fetch the connected wallet's immutable backfill allocation and live vesting state.
 */
export function useBackfillEmissions(
  enabled: boolean = true
): UseQueryResult<BackfillEmissionsState, Error> {
  const { network } = useSettings();
  const { connected, walletAddress } = useWallet();

  return useQuery({
    staleTime: DEFAULT_STALE_TIME,
    refetchInterval: DEFAULT_STALE_TIME,
    queryKey: ['backfillEmissions', BLNT_BACKFILL_ID, walletAddress],
    enabled: enabled && connected && walletAddress !== '' && BLNT_BACKFILL_ID !== '',
    queryFn: () => loadBackfillEmissionsState(network, BLNT_BACKFILL_ID, walletAddress),
  });
}

/** Fetch the immutable token bindings and live BLND-to-BLNT conversion state. */
export function useBackfillSwapState(
  enabled: boolean = true
): UseQueryResult<BackfillSwapState, Error> {
  const { network } = useSettings();

  return useQuery({
    staleTime: DEFAULT_STALE_TIME,
    refetchInterval: DEFAULT_STALE_TIME,
    queryKey: ['backfillSwap', BLNT_BACKFILL_ID],
    enabled: enabled && BLNT_BACKFILL_ID !== '',
    queryFn: () => loadBackfillSwapState(network, BLNT_BACKFILL_ID),
  });
}

//********** Pool Data **********//

export function usePoolMeta(
  poolId: string,
  enabled: boolean = true
): UseQueryResult<PoolMeta, Error> {
  const { network } = useSettings();

  return useQuery({
    staleTime: Infinity,
    queryKey: ['poolMetadata', poolId],
    enabled: enabled && poolId !== '',
    queryFn: async () => {
      try {
        let metadata;
        try {
          metadata = await PoolMetadata.load(network, poolId);
        } catch (error: any) {
          if (!error?.message?.includes(ErrorTypes.LedgerEntryParseError)) {
            throw error;
          }
          metadata = await PoolMetadata.loadV3(network, poolId);
        }
        if (metadata.wasmHash === POOL_WASM_V1) {
          // v1 pool - validate backstop is correct
          if (metadata.backstop === BACKSTOP_ID) {
            return { id: poolId, version: Version.V1, ...metadata } as PoolMeta;
          }
        } else if (
          metadata.wasmHash === POOL_WASM_V2 ||
          // testnet v2 pool hash
          (network.passphrase === Networks.TESTNET &&
            metadata.wasmHash ===
              '6a7c67449f6bad0d5f641cfbdf03f430ec718faa85107ecb0b97df93410d1c43')
        ) {
          // v2 pool - validate backstop is correct
          if (metadata.backstop === BACKSTOP_ID_V2) {
            return { id: poolId, version: Version.V2, ...metadata } as PoolMeta;
          }
          // Blend's current testnet lane uses v2 pool bytecode. Treat it as
          // the UI's v1/team lane so it remains distinct from our v2 stack.
          if (network.passphrase === Networks.TESTNET && metadata.backstop === BACKSTOP_ID) {
            return { id: poolId, version: Version.V1, ...metadata } as PoolMeta;
          }
        } else if (
          V3_POOL_WASM_HASH !== '' &&
          metadata.wasmHash === V3_POOL_WASM_HASH &&
          metadata.backstop === BACKSTOP_ID_V3
        ) {
          return { id: poolId, version: Version.V3, ...metadata } as PoolMeta;
        }
        throw new Error(NOT_BLEND_POOL_ERROR_MESSAGE);
      } catch (e: any) {
        if (e?.message?.includes(ErrorTypes.LedgerEntryParseError)) {
          throw new Error(NOT_BLEND_POOL_ERROR_MESSAGE);
        } else {
          console.error('Error fetching pool metadata', e);
        }
        throw e;
      }
    },
    retry: (failureCount, error) => {
      if (error?.message === NOT_BLEND_POOL_ERROR_MESSAGE) {
        // Do not retry if this is not a blend pool
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Fetches pool data for the given pool ID.
 * @param poolId - The pool ID
 * @param enabled - Whether the query is enabled (optional - defaults to true)
 * @returns Query result with the pool data.
 */
export function usePool(
  poolMeta: PoolMeta | undefined,
  enabled: boolean = true
): UseQueryResult<Pool, Error> {
  const { network } = useSettings();
  return useQuery({
    staleTime: DEFAULT_STALE_TIME,
    queryKey: ['pool', poolMeta?.id],
    enabled: enabled && poolMeta !== undefined,
    queryFn: async () => {
      if (poolMeta !== undefined) {
        try {
          if (poolMeta.version === Version.V3) {
            return await PoolV3.loadWithMetadata(network, poolMeta.id, poolMeta);
          } else if (poolMeta.version === Version.V2) {
            return await PoolV2.loadWithMetadata(network, poolMeta.id, poolMeta);
          } else if (poolMeta.wasmHash === POOL_WASM_V2) {
            const pool = await PoolV2.loadWithMetadata(network, poolMeta.id, poolMeta);
            pool.version = Version.V1;
            return pool;
          } else {
            return await PoolV1.loadWithMetadata(network, poolMeta.id, poolMeta);
          }
        } catch (e: any) {
          console.error('Error fetching pool data', e);
          throw e;
        }
      }
    },
  });
}

/**
 * Loads the connected wallet's immutable pool-local access flags. Open pools
 * return all standardized bits without invoking an external controller.
 */
export function usePoolPermissions(
  poolMeta: PoolMeta | undefined,
  enabled: boolean = true
): UseQueryResult<number, Error> {
  const { network } = useSettings();
  const { walletAddress, connected } = useWallet();
  const controller = poolMeta?.version === Version.V3 ? poolMeta.accessController : undefined;

  return useQuery({
    staleTime: DEFAULT_STALE_TIME,
    queryKey: ['poolPermissions', poolMeta?.id, controller, walletAddress],
    enabled: enabled && poolMeta !== undefined && connected && walletAddress !== '',
    placeholderData: controller === undefined ? ALL_ACCESS_PERMISSIONS : 0,
    queryFn: async () => {
      if (poolMeta === undefined || controller === undefined) {
        return ALL_ACCESS_PERMISSIONS;
      }
      const result = await loadAccessPermissions(network, controller, poolMeta.id, walletAddress);
      return result.permissions;
    },
    retry: 1,
  });
}

/**
 * Fetch the oracle data for the given pool.
 * @param pool - The pool
 * @param enabled - Whether the query is enabled (optional - defaults to true)
 * @returns Query result with the oracle data.
 */
export function usePoolOracle(
  pool: Pool | undefined,
  enabled: boolean = true
): UseQueryResult<PoolOracle, Error> {
  const { network } = useSettings();
  return useQuery({
    staleTime: DEFAULT_STALE_TIME,
    queryKey: ['poolOracle', pool?.id],
    enabled: pool !== undefined && enabled,
    queryFn: async () => {
      if (pool !== undefined) {
        if (ORACLE_PRICE_FETCHER) {
          try {
            const { decimals, latestLedger } = await getOracleDecimals(
              network,
              pool.metadata.oracle
            );
            const prices = await getOraclePrices(
              network,
              ORACLE_PRICE_FETCHER,
              pool.metadata.oracle,
              pool.metadata.reserveList
            );
            if (prices.size < pool.metadata.reserveList.length) {
              throw new Error('Invalid number of prices returned from oracle');
            }
            return new PoolOracle(pool.metadata.oracle, prices, decimals, latestLedger);
          } catch (e: any) {
            console.error('Price fetcher call failed: ', e);
            // if the oracle fetcher fails, fallback to default loading method
            return await pool.loadOracle();
          }
        } else {
          return await pool.loadOracle();
        }
      }
    },
    retry: 1,
    retryDelay: 1000,
  });
}

/**
 * Fetch the user for the given pool and connected wallet.
 * @param poolId - The pool ID
 * @param enabled - Whether the query is enabled (optional - defaults to true)
 * @returns Query result with the user positions.
 */
export function usePoolUser(
  pool: Pool | undefined,
  enabled: boolean = true
): UseQueryResult<PoolUser, Error> {
  const { walletAddress, connected } = useWallet();
  return useQuery({
    staleTime: USER_STALE_TIME,
    queryKey: ['poolPositions', pool?.id, walletAddress],
    enabled: enabled && pool !== undefined && connected,
    placeholderData: new PoolUser(
      walletAddress,
      new Positions(new Map(), new Map(), new Map()),
      new Map()
    ),
    queryFn: async () => {
      if (pool !== undefined && walletAddress !== '') {
        return await pool.loadUser(walletAddress);
      }
    },
  });
}

//********** Backstop Data **********//

/**
 * Fetches the backstop data.
 * @param enabled - Whether the query is enabled (optional - defaults to true)
 * @returns Query result with the backstop data.
 */
export function useBackstop(
  version: Version | undefined,
  enabled: boolean = true
): UseQueryResult<Backstop, Error> {
  const { network } = useSettings();
  return useQuery({
    staleTime: DEFAULT_STALE_TIME,
    queryKey: ['backstop', version],
    enabled: enabled && version !== undefined,
    queryFn: async () => {
      if (version === Version.V3) {
        const v3 = await BackstopV3.load(network, BACKSTOP_ID_V3);
        const blndUsdcToken = await BackstopToken.load(
          network,
          BLND_USDC_COMET_ID,
          BLND_TOKEN_ID,
          USDC_TOKEN_ID
        );
        const config = new BackstopConfig(
          '',
          BLND_TOKEN_ID,
          USDC_TOKEN_ID,
          BLND_USDC_COMET_ID,
          '',
          v3.rewardZone,
          v3.latestLedger
        );
        return new Backstop(
          BACKSTOP_ID_V3,
          config,
          blndUsdcToken,
          v3.latestLedger,
          Math.floor(Date.now() / 1000)
        );
      }
      return await Backstop.load(network, version === Version.V2 ? BACKSTOP_ID_V2 : BACKSTOP_ID);
    },
  });
}

/** Fetch the tier-aware v3 backstop state. */
export function useBackstopV3(enabled: boolean = true): UseQueryResult<BackstopV3, Error> {
  const { network } = useSettings();
  return useQuery({
    staleTime: DEFAULT_STALE_TIME,
    queryKey: ['backstopV3'],
    enabled: enabled && BACKSTOP_ID_V3 !== '',
    queryFn: async () => BackstopV3.load(network, BACKSTOP_ID_V3),
  });
}

/** Fetch the Comet state for one of v3's LP-token backstop tiers. */
export function useBackstopTierTokenV3(
  tier: BackstopTierV3,
  poolMeta: PoolMeta | undefined,
  enabled: boolean = true
): UseQueryResult<BackstopToken, Error> {
  const { network } = useSettings();
  const { data: loadedPool } = useBackstopPool(poolMeta, enabled);
  const pool = loadedPool instanceof BackstopPoolV3 ? loadedPool : undefined;
  const tierData = pool?.tiers[tier]?.data;
  const lpTokenId = tierData?.token;
  const isBlntXlm = tierData?.asset === BackstopAssetV3.BlntXlm;
  const isBlntUsdc = tierData?.asset === BackstopAssetV3.BlntUsdc;
  const pairTokenId = isBlntXlm
    ? Asset.native().contractId(network.passphrase)
    : USDC_TOKEN_ID;
  return useQuery({
    staleTime: DEFAULT_STALE_TIME,
    queryKey: ['backstopTierTokenV3', tier, lpTokenId],
    enabled:
      enabled &&
      tierData?.blnt_emission_eligible === true &&
      (isBlntXlm || isBlntUsdc) &&
      lpTokenId !== undefined &&
      BLND_TOKEN_ID !== '' &&
      pairTokenId !== '',
    queryFn: async () => {
      if (lpTokenId === undefined || (!isBlntXlm && !isBlntUsdc)) {
        throw new Error('The selected v3 tier is not a Comet LP token.');
      }
      return BackstopToken.load(network, lpTokenId, BLND_TOKEN_ID, pairTokenId);
    },
  });
}

export interface ManagedBackstopToken {
  backstopToken: BackstopToken | undefined;
  blndTokenId: string;
  cometPoolId: string;
  lpSymbol: string;
  pairSymbol: 'USDC' | 'XLM';
  pairTokenId: string;
}

/** Resolve the token bindings used by the shared V2/V3 Comet management UI. */
export function useManagedBackstopToken(
  tier?: BackstopTierV3,
  version: Version = Version.V1,
  poolMeta?: PoolMeta
): ManagedBackstopToken {
  const { network } = useSettings();
  const isV3 = tier !== undefined;
  const effectiveTier = tier ?? BackstopTierV3.SecondLoss;
  const { data: legacyBackstop } = useBackstop(version, !isV3);
  const { data: loadedPool } = useBackstopPool(poolMeta, isV3);
  const v3Pool = loadedPool instanceof BackstopPoolV3 ? loadedPool : undefined;
  const v3TierData = v3Pool?.tiers[effectiveTier]?.data;
  const v3TierToken = v3TierData?.token;
  const { data: v3BackstopToken } = useBackstopTierTokenV3(effectiveTier, poolMeta, isV3);
  const pairIsXlm = v3TierData?.asset === BackstopAssetV3.BlntXlm;

  return {
    backstopToken: isV3 ? v3BackstopToken : legacyBackstop?.backstopToken,
    blndTokenId: isV3 ? BLND_TOKEN_ID : legacyBackstop?.config.blndTkn ?? '',
    cometPoolId: isV3
      ? v3TierToken ?? ''
      : legacyBackstop?.config.backstopTkn ?? '',
    lpSymbol: isV3 ? (pairIsXlm ? 'BLNT-XLM LP' : 'BLNT-USDC LP') : 'BLND-USDC LP',
    pairSymbol: pairIsXlm ? 'XLM' : 'USDC',
    pairTokenId: pairIsXlm
      ? Asset.native().contractId(network.passphrase)
      : isV3
      ? USDC_TOKEN_ID
      : legacyBackstop?.config.usdcTkn ?? '',
  };
}

/**
 * Fetch the backstop pool data for the given pool ID.
 * @param poolMeta - The pool metadata
 * @param enabled - Whether the query is enabled (optional - defaults to true)
 * @returns Query result with the backstop pool data.
 */
export function useBackstopPool(
  poolMeta: PoolMeta | undefined,
  enabled: boolean = true
): UseQueryResult<BackstopPool | BackstopPoolV3, Error> {
  const { network } = useSettings();
  return useQuery({
    staleTime: DEFAULT_STALE_TIME,
    queryKey: ['backstopPool', poolMeta?.id],
    enabled: enabled && poolMeta !== undefined,
    queryFn: async () => {
      if (poolMeta !== undefined) {
        if (poolMeta.version === Version.V3) {
          return await BackstopPoolV3.load(network, BACKSTOP_ID_V3, poolMeta.id);
        }
        if (poolMeta.version === Version.V1 && poolMeta.wasmHash === POOL_WASM_V2) {
          return await BackstopPoolV2.load(network, BACKSTOP_ID, poolMeta.id);
        }
        return poolMeta.version === Version.V2
          ? await BackstopPoolV2.load(network, BACKSTOP_ID_V2, poolMeta.id)
          : await BackstopPoolV1.load(network, BACKSTOP_ID, poolMeta.id);
      }
    },
  });
}

/**
 * Fetch the backstop pool user data for the given pool and connected wallet.
 * @param poolId - The pool ID
 * @param enabled - Whether the query is enabled (optional - defaults to true)
 * @returns Query result with the backstop pool user data.
 */
export function useBackstopPoolUser(
  poolMeta: PoolMeta | undefined,
  enabled: boolean = true
): UseQueryResult<BackstopPoolUser | BackstopPoolUserV3, Error> {
  const { network } = useSettings();
  const { walletAddress, connected } = useWallet();
  return useQuery({
    staleTime: USER_STALE_TIME,
    queryKey: ['backstopPoolUser', poolMeta?.id, walletAddress],
    enabled: enabled && poolMeta !== undefined && connected,
    placeholderData:
      poolMeta?.version === Version.V3
        ? undefined
        : new BackstopPoolUser(
            walletAddress,
            poolMeta?.id ?? '',
            new UserBalance(BigInt(0), [], BigInt(0), BigInt(0)),
            undefined
          ),
    queryFn: async () => {
      if (walletAddress !== '' && poolMeta !== undefined) {
        if (poolMeta.version === Version.V3) {
          return await BackstopPoolUserV3.load(network, BACKSTOP_ID_V3, poolMeta.id, walletAddress);
        }
        return await BackstopPoolUser.load(
          network,
          poolMeta.version === Version.V2 ? BACKSTOP_ID_V2 : BACKSTOP_ID,
          poolMeta.id,
          walletAddress
        );
      }
    },
  });
}

//********** General User Data **********//

/**
 * Fetch the account from Horizon for the connected wallet.
 * @param enabled - Whether the query is enabled (optional - defaults to true)
 * @returns Query result with the account data.
 */
export function useHorizonAccount(
  enabled: boolean = true
): UseQueryResult<Horizon.AccountResponse> {
  const { walletAddress, connected } = useWallet();
  const { network } = useSettings();
  return useQuery({
    staleTime: USER_STALE_TIME,
    queryKey: ['account', walletAddress],
    enabled: enabled && connected && walletAddress !== '',
    queryFn: async () => {
      if (walletAddress === '') {
        throw new Error('No wallet address');
      }
      let horizon = new Horizon.Server(network.horizonUrl, network.opts);
      return await horizon.loadAccount(walletAddress);
    },
  });
}

/**
 * Fetch the token balance for the given token ID and connected wallet.
 * Will use the Horizon account data if available.
 * @param tokenId - The token ID
 * @param asset - The Stellar asset (or undefined if a soroban token)
 * @param account - The Horizon account data
 * @param enabled - Whether the query is enabled (optional - defaults to true)
 * @returns Query result with the token balance.
 */
export function useTokenBalance(
  tokenId: string | undefined,
  asset: Asset | undefined,
  account: Horizon.AccountResponse | undefined,
  enabled: boolean = true
): UseQueryResult<bigint> {
  const { walletAddress, connected } = useWallet();
  const { network } = useSettings();
  return useQuery({
    staleTime: USER_STALE_TIME,
    queryKey: ['balance', tokenId, walletAddress, account?.last_modified_ledger],
    enabled: enabled && connected && !!account && walletAddress !== '',
    queryFn: async () => {
      if (walletAddress === '') {
        throw new Error('No wallet address');
      }
      if (tokenId === undefined || tokenId === '') {
        return BigInt(0);
      }

      if (account !== undefined && asset !== undefined) {
        let balance_line = account.balances.find((balance) => {
          if (balance.asset_type == 'native') {
            // @ts-ignore
            return asset.isNative();
          }
          return (
            // @ts-ignore
            balance.asset_code === asset.getCode() &&
            // @ts-ignore
            balance.asset_issuer === asset.getIssuer()
          );
        });
        if (balance_line !== undefined) {
          return BigInt(balance_line.balance.replace('.', ''));
        }
      }
      const stellarRpc = new rpc.Server(network.rpc, network.opts);
      return await getTokenBalance(
        stellarRpc,
        network.passphrase,
        tokenId,
        new Address(walletAddress)
      );
    },
  });
}

//********** Auction Data **********//

/**
 * Fetch auction related events for the given pool ID.
 * @param poolId - The pool ID
 * @param enabled - Whether the query is enabled (optional - defaults to true)
 * @returns An object containing an events and latestLedger field.
 */
export function useAuctionEventsLongQuery(
  poolMeta: PoolMeta | undefined,
  enabled: boolean = true
): UseQueryResult<
  { events: PoolV1Event[] | PoolV2Event[] | PoolV3Event[]; latestLedger: number },
  Error
> {
  const { network } = useSettings();
  return useQuery({
    staleTime: 10 * 60 * 1000,
    queryKey: ['auctionEventsLong', poolMeta?.id],
    enabled: enabled && poolMeta !== undefined,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (poolMeta === undefined) {
        throw new Error();
      }
      try {
        const stellarRpc = new rpc.Server(network.rpc, network.opts);
        const latestLedger = (await stellarRpc.getLatestLedger()).sequence;
        // default event retention period for RPCs is 17280 ledgers
        // but RPCs currently only scan 10k ledgers per request, provide
        // some buffer to ensure the latest ledger is read
        let queryLedger = Math.round(latestLedger - 9990);
        queryLedger = Math.max(queryLedger, 100);

        return getAuctionEventsQuery(poolMeta, network, queryLedger);
      } catch (e) {
        console.error('Error fetching auction events', e);
        return undefined;
      }
    },
  });
}

/**
 * Fetch auction related events starting from the `lastCurser` or `lastLedgerFetched`.
 * @param poolId - The pool ID
 * @param lastLedgerFetched - The last ledger fetched
 * @param enabled - Whether the query is enabled (optional - defaults to true)
 * @returns An object containing an events and latestLedger field.
 */
export function useAuctionEventsShortQuery(
  poolMeta: PoolMeta | undefined,
  lastLedgerFetched: number,
  enabled: boolean = true
): UseQueryResult<
  { events: PoolV1Event[] | PoolV2Event[] | PoolV3Event[]; latestLedger: number },
  Error
> {
  const { network } = useSettings();
  // TODO: Use cursor instead of lastLedger when possible once RPC cursor usage is fixed.
  return useQuery({
    queryKey: ['auctionEventsShort', poolMeta?.id, lastLedgerFetched],
    enabled: enabled && poolMeta !== undefined && lastLedgerFetched > 0,
    refetchInterval: 5 * 1000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (poolMeta === undefined) {
        throw new Error();
      }
      try {
        return getAuctionEventsQuery(poolMeta, network, lastLedgerFetched);
      } catch (e) {
        console.error('Error fetching auction events', e);
        return undefined;
      }
    },
  });
}

/**
 * Fetch the simulating result for a given operation.
 * @param operation_str - The operation XDR string in base64
 * @param enabled - Whether the query is enabled (optional - defaults to true)
 * @returns Query result with the simulation transaction response.
 */
export function useSimulateOperation<T>(
  operation_str: string,
  enabled: boolean = true
): UseQueryResult<rpc.Api.SimulateTransactionResponse> {
  const { walletAddress, connected } = useWallet();
  const { network } = useSettings();
  return useQuery({
    staleTime: USER_STALE_TIME,
    queryKey: ['sim', operation_str],
    enabled: enabled && connected && walletAddress !== '',
    queryFn: async () => {
      if (walletAddress === '') {
        throw new Error('No wallet address');
      }
      let operation = xdr.Operation.fromXDR(operation_str, 'base64');
      const stellarRpc = new rpc.Server(network.rpc, network.opts);
      const account = new Account(walletAddress, '123');
      const tx_builder = new TransactionBuilder(account, {
        networkPassphrase: network.passphrase,
        fee: BASE_FEE,
        timebounds: { minTime: 0, maxTime: Math.floor(Date.now() / 1000) + 5 * 60 * 1000 },
      }).addOperation(operation);
      const transaction = tx_builder.build();
      return await stellarRpc.simulateTransaction(transaction);
    },
  });
}

//********** Misc Data **********//

/**
 * Fetch the token metadata for the given reserve.
 * @param assetId - The reserve assetId
 * @param enabled - Whether the query is enabled (optional - defaults to true)
 * @returns Query result with the token metadata.
 */
export function useTokenMetadata(
  assetId: string | undefined,
  enabled: boolean = true
): UseQueryResult<ReserveTokenMetadata, Error> {
  const { network } = useSettings();
  return useQuery(createTokenMetadataQuery(network, assetId, enabled));
}

/**
 * Fetch the token metadata for the list of assets.
 * @param assetIds - The reserve assetId
 * @param enabled - Whether the query is enabled (optional - defaults to true)
 * @returns Query result with the token metadata.
 */
export function useTokenMetadataList(
  assetIds: string[],
  enabled: boolean = true
): UseQueryResult<ReserveTokenMetadata, Error>[] {
  const { network } = useSettings();
  return useQueries({
    queries: assetIds.map((assetId) => createTokenMetadataQuery(network, assetId, enabled)),
  });
}

/**
 * Fetch the fee stats from the RPC server.
 * @returns Query result with the fee stats.
 */
export function useFeeStats(
  enabled: boolean = true
): UseQueryResult<{ low: string; medium: string; high: string }> {
  const { network } = useSettings();
  return useQuery({
    staleTime: DEFAULT_STALE_TIME,
    queryKey: ['feeStats'],
    enabled: enabled,
    queryFn: async () => {
      let stellarRpc = new rpc.Server(network.rpc, network.opts);
      const feeStats = await stellarRpc.getFeeStats();

      const lowFee = Math.max(parseInt(feeStats.sorobanInclusionFee.p30), 500).toString();
      const mediumFee = Math.max(parseInt(feeStats.sorobanInclusionFee.p60), 2000).toString();
      const highFee = Math.max(parseInt(feeStats.sorobanInclusionFee.p90), 10000).toString();

      return {
        low: lowFee,
        medium: mediumFee,
        high: highFee,
      };
    },
  });
}

// ***** HELPERS / UTILS ***** //

/**
 * Helper function to create a token metadata query.
 */
function createTokenMetadataQuery(
  network: Network & {
    horizonUrl: string;
  },
  assetId: string | undefined,
  enabled: boolean = true
): UseQueryOptions<ReserveTokenMetadata, Error> {
  return {
    staleTime: Infinity,
    queryKey: ['tokenMetadata', assetId],
    enabled: enabled && assetId !== undefined && assetId !== '',
    queryFn: async () => {
      if (assetId === undefined || assetId === '') {
        throw new Error('No assetId');
      }
      const horizon = new Horizon.Server(network.horizonUrl, network.opts);
      const tokenMetadata = await TokenMetadata.load(network, assetId);
      // contract only tokens don't have tomls
      // load image directly from the icon map
      let tomlMetadata: TomlMetadata;
      if (tokenMetadata.asset !== undefined) {
        tomlMetadata = await getTokenMetadataFromTOML(horizon, tokenMetadata);
      } else {
        tomlMetadata = {
          domain: undefined,
          image: getContractTokenIcon(tokenMetadata.symbol),
        };
      }
      const reserveTokenMeta: ReserveTokenMetadata = {
        assetId: assetId,
        ...tokenMetadata,
        ...tomlMetadata,
      };
      return reserveTokenMeta;
    },
  };
}

const AUCTION_EVENT_FILTERS = [
  [xdr.ScVal.scvSymbol('fill_auction').toXDR('base64'), '*', '*'],
  [xdr.ScVal.scvSymbol('delete_liquidation_auction').toXDR('base64'), '*'],
  [xdr.ScVal.scvSymbol('new_liquidation_auction').toXDR('base64'), '*'],
  [xdr.ScVal.scvSymbol('new_auction').toXDR('base64'), '*'],
  [xdr.ScVal.scvSymbol('delete_liquidation_auction').toXDR('base64'), '*'],
];
const AUCTION_EVENT_FILTERS_V2 = [
  [xdr.ScVal.scvSymbol('new_auction').toXDR('base64'), '*', '*'],
  [xdr.ScVal.scvSymbol('fill_auction').toXDR('base64'), '*', '*'],
  [xdr.ScVal.scvSymbol('delete_auction').toXDR('base64'), '*', '*'],
];

/**
 * Helper function to fetch auction events based on the pool version.
 */
async function getAuctionEventsQuery(
  poolMeta: PoolMeta,
  network: Network,
  startLedger: number
): Promise<{ events: PoolV1Event[] | PoolV2Event[]; latestLedger: number }> {
  // TODO: add pagination once cursor usage is fixed
  const stellarRpc = new rpc.Server(network.rpc, network.opts);
  const useV1Events = poolMeta.version === Version.V1 && poolMeta.wasmHash !== POOL_WASM_V2;
  const topics = useV1Events ? AUCTION_EVENT_FILTERS : AUCTION_EVENT_FILTERS_V2;
  const resp = await stellarRpc._getEvents({
    startLedger,
    filters: [
      {
        type: 'contract',
        contractIds: [poolMeta.id],
        topics,
      },
    ],
    limit: 1000,
  });

  if (useV1Events) {
    let events: PoolV1Event[] = [];
    for (const respEvent of resp.events) {
      let poolEvent = poolEventV1FromEventResponse(respEvent);
      if (poolEvent) events.push(poolEvent);
    }
    return { events, latestLedger: resp.latestLedger };
  } else {
    let events: PoolV2Event[] = [];
    for (const respEvent of resp.events) {
      let poolEvent = poolEventV2FromEventResponse(respEvent);
      if (poolEvent) events.push(poolEvent);
    }
    return { events, latestLedger: resp.latestLedger };
  }
}
