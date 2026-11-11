import {
  BackstopAssetV3,
  BackstopPoolUserV3,
  BackstopPoolV3,
  BackstopTierV3,
  Network,
  Q4WV3,
} from '@blend-capital/blend-sdk';
import {
  Account,
  Address,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

/**
 * Client for BLNT-Protocol/backstop-manager: a contract that holds an owner's
 * backstop position and lets a scoped manager operate it.
 * Scopes: 0 = Low, 1 = Medium, 2 = High. The owner may do everything.
 */

// Any funded account works as the source of a read-only simulation
const VIEW_SOURCE = 'GANXGJV2RNOFMOSQ2DTI3RKDBAVERXUVFC27KW3RLVQCLB3RYNO3AAI4';

export enum ManagerScope {
  Low = 0,
  Medium = 1,
  High = 2,
}

export const SCOPE_NAMES = ['Low', 'Medium', 'High'];

export const MAX_BPS = BigInt(10000);

export type ManagerAction =
  | 'fund'
  | 'join'
  | 'deposit'
  | 'claim'
  | 'queue'
  | 'withdraw'
  | 'harvest';

/** Scope each action requires; undefined means anyone may do it. */
export const ACTION_SCOPE: Record<ManagerAction, ManagerScope | undefined> = {
  fund: undefined,
  join: ManagerScope.High,
  deposit: ManagerScope.Medium,
  claim: ManagerScope.Low,
  queue: ManagerScope.Medium,
  withdraw: ManagerScope.High,
  harvest: ManagerScope.Low,
};

export interface TokenHolding {
  id: string;
  symbol: string;
  /** Held by the manager contract */
  contractBalance: bigint;
}

export interface ManagerPosition {
  backstop: string;
  pool: string;
  tier: BackstopTierV3;
  /** The tier's backstop asset, e.g. BlntXlm */
  asset: BackstopAssetV3;
  /** The tier's backstop token (a Comet LP, or plain USDC/XLM) */
  lpToken: TokenHolding;
  /** Tokens the tier's Comet LP is made of, with the comet's reserves; empty if not a Comet */
  underlying: (TokenHolding & { cometBalance: bigint })[];
  lpTotalSupply: bigint;
  /** Backstop shares held by the contract, not queued */
  shares: bigint;
  q4w: Q4WV3[];
  /** Tier totals, for share <-> token conversion */
  tierShares: bigint;
  tierTokens: bigint;
  /** LP tokens deposited, as tracked by the contract */
  principal: bigint;
  /** LP tokens owed to the manager, sitting in the contract */
  harvestable: bigint;
}

export interface BackstopManagerState {
  id: string;
  owner: string;
  manager: { id: string; scope: number };
  harvestBps: number;
  backstops: string[];
  pools: string[];
  positions: ManagerPosition[];
}

/** Backstop assets whose token is a Comet LP (and so can be joined) */
const COMET_ASSETS = [BackstopAssetV3.BlntXlm, BackstopAssetV3.BlntUsdc];

export const ASSET_LABEL: Record<BackstopAssetV3, string> = {
  [BackstopAssetV3.BlntXlm]: 'BLNT:XLM LP',
  [BackstopAssetV3.BlntUsdc]: 'BLNT:USDC LP',
  [BackstopAssetV3.Usdc]: 'USDC',
  [BackstopAssetV3.Xlm]: 'XLM',
};

/********** Value helpers **********/

/** LP tokens the contract's shares (queued included) are worth. */
export function positionValue(p: ManagerPosition): bigint {
  const queued = queuedShares(p);
  if (p.tierShares === BigInt(0)) return BigInt(0);
  return ((p.shares + queued) * p.tierTokens) / p.tierShares;
}

export function queuedShares(p: ManagerPosition): bigint {
  return p.q4w.reduce((total, q) => total + q.amount, BigInt(0));
}

export function maturedShares(p: ManagerPosition, now: number): bigint {
  return p.q4w.reduce((total, q) => (q.exp <= BigInt(now) ? total + q.amount : total), BigInt(0));
}

/** Position value above principal, in LP tokens. */
export function positionEarnings(p: ManagerPosition): bigint {
  const earnings = positionValue(p) - p.principal;
  return earnings > BigInt(0) ? earnings : BigInt(0);
}

/**
 * Default shares to queue: those worth the earnings, less shares already
 * queued (withdrawals count as earnings first). Same as cli/queue.sh.
 */
export function defaultQueueShares(p: ManagerPosition): bigint {
  if (p.tierTokens === BigInt(0)) return BigInt(0);
  let shares = (positionEarnings(p) * p.tierShares) / p.tierTokens - queuedShares(p);
  if (shares > p.shares) shares = p.shares;
  return shares > BigInt(0) ? shares : BigInt(0);
}

/** Default LP tokens to deposit: the contract's balance less what is harvestable. */
export function defaultDeposit(p: ManagerPosition): bigint {
  const amount = p.lpToken.contractBalance - p.harvestable;
  return amount > BigInt(0) ? amount : BigInt(0);
}

/** Most LP tokens the contract's underlying balances can mint (Comet joins are proportional). */
export function maxJoinOut(p: ManagerPosition): bigint {
  let max: bigint | undefined;
  for (const token of p.underlying) {
    if (token.cometBalance === BigInt(0)) return BigInt(0);
    const limit = (token.contractBalance * p.lpTotalSupply) / token.cometBalance;
    max = max === undefined || limit < max ? limit : max;
  }
  return max ?? BigInt(0);
}

/** Max amounts in for minting `out` LP tokens, `slippageBps` above the pool ratio, capped at holdings. */
export function joinMaxAmountsIn(p: ManagerPosition, out: bigint, slippageBps: bigint): bigint[] {
  return p.underlying.map((token) => {
    // ceil(out * reserve / supply)
    const expected = -((-out * token.cometBalance) / p.lpTotalSupply);
    const limit = (expected * (MAX_BPS + slippageBps)) / MAX_BPS;
    return limit < token.contractBalance ? limit : token.contractBalance;
  });
}

export function lessSlippage(amount: bigint, slippageBps: bigint): bigint {
  return (amount * (MAX_BPS - slippageBps)) / MAX_BPS;
}

/********** Operations **********/

const tierToScVal = (tier: BackstopTierV3) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(tier)]);
const addr = (a: string) => new Address(a).toScVal();
const i128 = (n: bigint) => nativeToScVal(n, { type: 'i128' });

function positionCall(
  managerId: string,
  method: string,
  from: string,
  p: ManagerPosition,
  ...rest: xdr.ScVal[]
): xdr.Operation {
  return new Contract(managerId).call(
    method,
    addr(from),
    addr(p.backstop),
    tierToScVal(p.tier),
    addr(p.pool),
    ...rest
  );
}

export const managerOps = {
  /** Plain token transfer from the signer to the manager contract (anyone). */
  fund: (managerId: string, token: string, from: string, amount: bigint) =>
    new Contract(token).call('transfer', addr(from), addr(managerId), i128(amount)),
  join: (managerId: string, from: string, p: ManagerPosition, out: bigint, maxIn: bigint[]) =>
    positionCall(
      managerId,
      'c_join_pool',
      from,
      p,
      i128(out),
      xdr.ScVal.scvVec(maxIn.map((v) => i128(v)))
    ),
  deposit: (managerId: string, from: string, p: ManagerPosition, amount: bigint) =>
    positionCall(managerId, 'b_deposit', from, p, i128(amount)),
  claim: (managerId: string, from: string, p: ManagerPosition, minOut: bigint) =>
    positionCall(managerId, 'b_claim', from, p, i128(minOut)),
  queue: (managerId: string, from: string, p: ManagerPosition, shares: bigint) =>
    positionCall(managerId, 'b_queue_withdrawal', from, p, i128(shares)),
  withdraw: (managerId: string, from: string, p: ManagerPosition, shares: bigint) =>
    positionCall(managerId, 'b_withdraw', from, p, i128(shares)),
  harvest: (managerId: string, from: string, token: string) =>
    new Contract(managerId).call('harvest', addr(from), addr(token)),
};

/********** Loading **********/

async function view<T>(stellarRpc: rpc.Server, network: Network, op: xdr.Operation): Promise<T> {
  const transaction = new TransactionBuilder(new Account(VIEW_SOURCE, '0'), {
    fee: '100',
    networkPassphrase: network.passphrase,
    timebounds: { minTime: 0, maxTime: 0 },
  })
    .addOperation(op)
    .build();
  const response = await stellarRpc.simulateTransaction(transaction);
  if (!rpc.Api.isSimulationSuccess(response) || response.result?.retval === undefined) {
    throw new Error('Backstop manager view call failed');
  }
  return scValToNative(response.result.retval) as T;
}

async function tokenHolding(
  stellarRpc: rpc.Server,
  network: Network,
  token: string,
  holder: string
): Promise<TokenHolding> {
  const contract = new Contract(token);
  const [symbol, balance] = await Promise.all([
    view<string>(stellarRpc, network, contract.call('symbol')).catch(() => '?'),
    view<bigint>(stellarRpc, network, contract.call('balance', addr(holder))),
  ]);
  return {
    id: token,
    symbol: symbol === 'native' ? 'XLM' : symbol,
    contractBalance: BigInt(balance),
  };
}

/** Balance of `token` held by `holder`. */
export async function loadTokenBalance(
  network: Network,
  token: string,
  holder: string
): Promise<bigint> {
  const stellarRpc = new rpc.Server(network.rpc, network.opts);
  const balance = await view<bigint>(
    stellarRpc,
    network,
    new Contract(token).call('balance', addr(holder))
  );
  return BigInt(balance);
}

export async function loadBackstopManagerState(
  network: Network,
  managerId: string
): Promise<BackstopManagerState> {
  const stellarRpc = new rpc.Server(network.rpc, network.opts);
  const manager = new Contract(managerId);
  const call = <T>(method: string, ...args: xdr.ScVal[]) =>
    view<T>(stellarRpc, network, manager.call(method, ...args));

  const [owner, mgr, harvestBps, backstops, pools] = await Promise.all([
    call<string>('owner'),
    call<{ id: string; scope: number }>('manager'),
    call<number>('harvest_bps'),
    call<string[]>('backstops'),
    call<string[]>('pools'),
  ]);

  const positions: ManagerPosition[] = [];
  for (const backstop of backstops) {
    for (const pool of pools) {
      const [poolData, user] = await Promise.all([
        BackstopPoolV3.load(network, backstop, pool),
        BackstopPoolUserV3.load(network, backstop, pool, managerId),
      ]);
      const tiers = await Promise.all(
        poolData.configuredTiers.map(async (tier): Promise<ManagerPosition> => {
          const tierPool = poolData.tier(tier);
          const lpId = tierPool.data.token;
          const comet = new Contract(lpId);
          const isComet = COMET_ASSETS.includes(tierPool.data.asset);
          const [lpToken, principal, harvestable, supply, cometTokens] = await Promise.all([
            tokenHolding(stellarRpc, network, lpId, managerId),
            call<bigint>('principal', addr(backstop), addr(pool), tierToScVal(tier)),
            call<bigint>('harvestable', addr(lpId)),
            isComet ? view<bigint>(stellarRpc, network, comet.call('get_total_supply')) : BigInt(0),
            isComet
              ? view<string[]>(stellarRpc, network, comet.call('get_tokens'))
              : ([] as string[]),
          ]);
          const underlying = await Promise.all(
            cometTokens.map(async (token) => ({
              ...(await tokenHolding(stellarRpc, network, token, managerId)),
              cometBalance: BigInt(
                await view<bigint>(stellarRpc, network, comet.call('get_balance', addr(token)))
              ),
            }))
          );
          const balance = user.balance(tier);
          return {
            backstop,
            pool,
            tier,
            asset: tierPool.data.asset,
            lpToken,
            underlying,
            lpTotalSupply: BigInt(supply),
            shares: balance.shares,
            q4w: balance.q4w,
            tierShares: tierPool.data.shares,
            tierTokens: tierPool.data.tokens,
            principal: BigInt(principal),
            harvestable: BigInt(harvestable),
          };
        })
      );
      positions.push(...tiers);
    }
  }

  return {
    id: managerId,
    owner,
    manager: { id: mgr.id, scope: Number(mgr.scope) },
    harvestBps: Number(harvestBps),
    backstops,
    pools,
    positions,
  };
}

/** Whether `wallet` may perform `action` on this manager contract. */
export function canPerform(
  state: BackstopManagerState | undefined,
  wallet: string,
  action: ManagerAction
): boolean {
  const required = ACTION_SCOPE[action];
  if (required === undefined) return wallet !== '';
  if (state === undefined || wallet === '') return false;
  if (wallet === state.owner) return true;
  return wallet === state.manager.id && state.manager.scope >= required;
}
