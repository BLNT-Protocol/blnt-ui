import {
  BackstopPoolV3,
  BackstopToken,
  FixedMath,
  getOracleDecimals,
  Network,
  PoolEstimate,
  PoolMetadata,
  PoolOracle,
  PoolV3,
} from '@blend-capital/blend-sdk';
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  rpc,
  scValToNative,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { getOraclePrices } from './stellar_rpc';
import { BackfillSwapState, loadBackfillSwapState } from './blnt_backfill';

const VIEW_SOURCE = 'GANXGJV2RNOFMOSQ2DTI3RKDBAVERXUVFC27KW3RLVQCLB3RYNO3AAI4';
const TOKEN_DECIMALS = 7;

export interface StatsPool {
  id: string;
  name: string;
}

export interface BlntStatsConfig {
  backfillId: string;
  lockupBackfillId: string;
  backstopId: string;
  blntTokenId: string;
  blntIssuer: string;
  usdcTokenId: string;
  blntUsdcCometId: string;
  oraclePriceFetcher?: string;
  pools: StatsPool[];
}

export interface BlntProtocolStats {
  blntPrice: number;
  totalSupply: bigint | undefined;
  backfillBalance: bigint;
  lockupBackfillBalance: bigint;
  backstopBlntBalance: bigint;
  circulatingSupply: bigint | undefined;
  marketCap: number | undefined;
  totalSupplied: number;
  totalBorrowed: number;
  totalBackstop: number;
  backfill: BackfillProtocolStats;
}

export interface BackfillProtocolStats extends BackfillSwapState {
  backfillAllocated: bigint;
  backfillVested: bigint;
  vestingStart: bigint;
  vestingEnd: bigint;
  totalSwapped: bigint;
}

interface HorizonAssetRecord {
  asset_code: string;
  asset_issuer: string;
  balances?: Record<string, string>;
  claimable_balances_amount?: string;
  liquidity_pools_amount?: string;
  contracts_amount?: string;
}

interface HorizonAssetResponse {
  _embedded?: { records?: HorizonAssetRecord[] };
}

interface HorizonSupplySnapshot {
  total: bigint;
  contracts: bigint;
}

function decimalToRaw(value: string | undefined): bigint {
  if (value === undefined) return BigInt(0);
  const match = /^(\d+)(?:\.(\d{0,7}))?$/.exec(value);
  if (match === null) throw new Error(`Invalid Horizon asset amount: ${value}`);
  return BigInt(match[1]) * BigInt(10 ** TOKEN_DECIMALS) + BigInt((match[2] ?? '').padEnd(7, '0'));
}

async function loadHorizonSupply(
  horizonUrl: string,
  assetCode: string,
  issuer: string
): Promise<HorizonSupplySnapshot> {
  const horizonBaseUrl = horizonUrl.endsWith('/') ? horizonUrl : `${horizonUrl}/`;
  const url = new URL('assets', horizonBaseUrl);
  url.searchParams.set('asset_code', assetCode);
  url.searchParams.set('asset_issuer', issuer);
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Unable to load BLNT supply from Horizon (${response.status})`);
  const body = (await response.json()) as HorizonAssetResponse;
  const record = body._embedded?.records?.find(
    (asset) => asset.asset_code === assetCode && asset.asset_issuer === issuer
  );
  if (record === undefined) throw new Error('Horizon did not return the configured BLNT asset');

  const accountBalances = Object.values(record.balances ?? {}).reduce(
    (total, balance) => total + decimalToRaw(balance),
    BigInt(0)
  );
  const contractBalances = decimalToRaw(record.contracts_amount);
  return {
    total:
      accountBalances +
      decimalToRaw(record.claimable_balances_amount) +
      decimalToRaw(record.liquidity_pools_amount) +
      contractBalances,
    contracts: contractBalances,
  };
}

async function loadTokenBalance(
  network: Network,
  tokenId: string,
  holderId: string
): Promise<bigint> {
  if (holderId === '') return BigInt(0);
  const transaction = new TransactionBuilder(new Account(VIEW_SOURCE, '0'), {
    fee: BASE_FEE,
    networkPassphrase: network.passphrase,
    timebounds: { minTime: 0, maxTime: 0 },
  })
    .addOperation(new Contract(tokenId).call('balance', Address.fromString(holderId).toScVal()))
    .build();
  const response = await new rpc.Server(network.rpc, network.opts).simulateTransaction(transaction);
  if (!rpc.Api.isSimulationSuccess(response) || response.result?.retval === undefined) {
    throw new Error(`Unable to load BLNT balance for ${holderId}`);
  }
  return BigInt(scValToNative(response.result.retval));
}

async function loadBigIntView(
  network: Network,
  contractId: string,
  method: string
): Promise<bigint> {
  const transaction = new TransactionBuilder(new Account(VIEW_SOURCE, '0'), {
    fee: BASE_FEE,
    networkPassphrase: network.passphrase,
    timebounds: { minTime: 0, maxTime: 0 },
  })
    .addOperation(new Contract(contractId).call(method))
    .build();
  const response = await new rpc.Server(network.rpc, network.opts).simulateTransaction(transaction);
  if (!rpc.Api.isSimulationSuccess(response) || response.result?.retval === undefined) {
    throw new Error(`Unable to load BLNT backfill ${method} view`);
  }
  return BigInt(scValToNative(response.result.retval));
}

async function loadPoolStats(
  network: Network,
  backstopId: string,
  pool: StatsPool,
  oraclePriceFetcher?: string
): Promise<{ supplied: number; borrowed: number; backstop: number }> {
  const metadata = await PoolMetadata.loadV3(network, pool.id);
  const loadedPool = await PoolV3.loadWithMetadata(network, pool.id, metadata);
  let oracle: PoolOracle;

  if (oraclePriceFetcher !== undefined && oraclePriceFetcher !== '') {
    try {
      const { decimals, latestLedger } = await getOracleDecimals(network, metadata.oracle);
      const prices = await getOraclePrices(
        network,
        oraclePriceFetcher,
        metadata.oracle,
        metadata.reserveList
      );
      if (prices.size < metadata.reserveList.length) {
        throw new Error('Oracle price fetcher returned an incomplete price set');
      }
      oracle = new PoolOracle(metadata.oracle, prices, decimals, latestLedger);
    } catch {
      oracle = await loadedPool.loadOracle();
    }
  } else {
    oracle = await loadedPool.loadOracle();
  }

  const estimate = PoolEstimate.build(loadedPool.reserves, oracle);
  const backstop = await BackstopPoolV3.load(network, backstopId, pool.id);
  return {
    supplied: estimate.totalSupply,
    borrowed: estimate.totalBorrowed,
    backstop: FixedMath.toFloat(backstop.totalValue(), TOKEN_DECIMALS),
  };
}

export async function loadBlntProtocolStats(
  network: Network & { horizonUrl: string },
  config: BlntStatsConfig
): Promise<BlntProtocolStats> {
  if (
    config.backfillId === '' ||
    config.backstopId === '' ||
    config.blntTokenId === '' ||
    config.blntIssuer === '' ||
    config.usdcTokenId === '' ||
    config.blntUsdcCometId === '' ||
    config.pools.length === 0
  ) {
    throw new Error('BLNT stats configuration is incomplete');
  }

  const [
    comet,
    horizonSupply,
    backfillBalance,
    lockupBackfillBalance,
    backstopBlntBalance,
    backfillSwap,
    backfillAllocated,
    vestingStart,
    vestingEnd,
    totalSwapped,
    poolStats,
  ] = await Promise.all([
    BackstopToken.load(network, config.blntUsdcCometId, config.blntTokenId, config.usdcTokenId),
    loadHorizonSupply(network.horizonUrl, 'BLNT', config.blntIssuer),
    loadTokenBalance(network, config.blntTokenId, config.backfillId),
    loadTokenBalance(network, config.blntTokenId, config.lockupBackfillId),
    loadTokenBalance(network, config.blntTokenId, config.backstopId),
    loadBackfillSwapState(network, config.backfillId),
    loadBigIntView(network, config.backfillId, 'get_backfill_allocated'),
    loadBigIntView(network, config.backfillId, 'get_vesting_start'),
    loadBigIntView(network, config.backfillId, 'get_vesting_end'),
    loadBigIntView(network, config.backfillId, 'get_total_swapped'),
    Promise.all(
      config.pools.map((pool) =>
        loadPoolStats(network, config.backstopId, pool, config.oraclePriceFetcher)
      )
    ),
  ]);

  if (comet.blnd <= BigInt(0) || comet.usdc <= BigInt(0)) {
    throw new Error('The canonical BLNT:USDC pool has no priceable reserves');
  }

  // The canonical pool is an 80% BLNT / 20% USDC Comet pool. Its USDC side
  // therefore represents one fifth of pool value and its BLNT side four fifths.
  const blntPrice = (Number(comet.usdc) * 4) / Number(comet.blnd);
  const excludedSupply = backfillBalance + lockupBackfillBalance + backstopBlntBalance;
  const totalSupply =
    excludedSupply > horizonSupply.contracts ? undefined : horizonSupply.total;
  const circulatingSupply =
    totalSupply === undefined
      ? undefined
      : totalSupply > excludedSupply
      ? totalSupply - excludedSupply
      : BigInt(0);
  const totals = poolStats.reduce(
    (result, pool) => ({
      supplied: result.supplied + pool.supplied,
      borrowed: result.borrowed + pool.borrowed,
      backstop: result.backstop + pool.backstop,
    }),
    { supplied: 0, borrowed: 0, backstop: 0 }
  );
  const vestingDuration = vestingEnd - vestingStart;
  if (vestingDuration <= BigInt(0)) {
    throw new Error('The BLNT backfill vesting schedule is invalid');
  }
  const vestingElapsed =
    backfillSwap.ledgerCloseTime <= vestingStart
      ? BigInt(0)
      : backfillSwap.ledgerCloseTime >= vestingEnd
      ? vestingDuration
      : backfillSwap.ledgerCloseTime - vestingStart;
  const backfillVested = (backfillAllocated * vestingElapsed) / vestingDuration;

  return {
    blntPrice,
    totalSupply,
    backfillBalance,
    lockupBackfillBalance,
    backstopBlntBalance,
    circulatingSupply,
    marketCap:
      circulatingSupply === undefined
        ? undefined
        : FixedMath.toFloat(circulatingSupply, TOKEN_DECIMALS) * blntPrice,
    totalSupplied: totals.supplied,
    totalBorrowed: totals.borrowed,
    totalBackstop: totals.backstop,
    backfill: {
      ...backfillSwap,
      backfillAllocated,
      backfillVested,
      vestingStart,
      vestingEnd,
      totalSwapped,
    },
  };
}
