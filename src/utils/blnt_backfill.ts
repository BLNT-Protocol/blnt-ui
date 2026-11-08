import { Network } from '@blend-capital/blend-sdk';
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import allocations from '../data/blnt_backfill_allocations.json';

const VIEW_SOURCE = 'GANXGJV2RNOFMOSQ2DTI3RKDBAVERXUVFC27KW3RLVQCLB3RYNO3AAI4';
export const BLNT_BACKFILL_ID = process.env.NEXT_PUBLIC_BLNT_BACKFILL || '';
export const BLNT_LOCKUP_BACKFILL_ID = process.env.NEXT_PUBLIC_BLNT_LOCKUP_BACKFILL || '';

export interface BackfillEmissionsState {
  totalAllocation: bigint;
  vestedAllocation: bigint;
  claimable: bigint;
  vestingStart: bigint;
  vestingEnd: bigint;
}

export interface ContributorGrantState {
  totalAllocation: bigint;
  vestedAllocation: bigint;
  claimable: bigint;
  vestingStart: bigint;
  vestingEnd: bigint;
}

export interface LockupBackfillClaimState {
  totalAllocation: bigint;
  vestedAllocation: bigint;
  claimable: bigint;
  claimed: bigint;
  unclaimed: bigint;
}

export interface BackfillSwapState {
  legacyBlndToken: string;
  blntToken: string;
  remainingCapacity: bigint;
  swapDeadline: bigint;
  ledgerCloseTime: bigint;
}

export function getBackfillAllocation(address: string): bigint {
  const rawAllocation = (allocations as Record<string, string>)[address];
  return rawAllocation === undefined ? BigInt(0) : BigInt(rawAllocation);
}

export function buildClaimBackfillOperation(backfillId: string, user: string): xdr.Operation {
  return new Contract(backfillId).call('claim_backfill', Address.fromString(user).toScVal());
}

export function buildClaimGrantOperation(backfillId: string, user: string): xdr.Operation {
  return new Contract(backfillId).call('claim_grant', Address.fromString(user).toScVal());
}

export function buildClaimAndFundOperation(lockupBackfillId: string): xdr.Operation {
  return new Contract(lockupBackfillId).call('claim_and_fund');
}

export function buildClaimLockupBackfillOperation(
  lockupBackfillId: string,
  beneficiary: string
): xdr.Operation {
  return new Contract(lockupBackfillId).call(
    'claim',
    Address.fromString(beneficiary).toScVal()
  );
}

export function buildSwapBlndForBlntOperation(
  backfillId: string,
  user: string,
  blntAmount: bigint
): xdr.Operation {
  return new Contract(backfillId).call(
    'swap_blnd_for_blnt',
    Address.fromString(user).toScVal(),
    nativeToScVal(blntAmount, { type: 'i128' })
  );
}

function buildViewTransaction(
  networkPassphrase: string,
  backfillId: string,
  method: string,
  args: xdr.ScVal[] = []
) {
  return new TransactionBuilder(new Account(VIEW_SOURCE, '0'), {
    fee: BASE_FEE,
    networkPassphrase,
    timebounds: { minTime: 0, maxTime: 0 },
  })
    .addOperation(new Contract(backfillId).call(method, ...args))
    .build();
}

async function simulateBigIntView(
  stellarRpc: rpc.Server,
  networkPassphrase: string,
  backfillId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<bigint> {
  const response = await stellarRpc.simulateTransaction(
    buildViewTransaction(networkPassphrase, backfillId, method, args)
  );
  if (!rpc.Api.isSimulationSuccess(response) || response.result?.retval === undefined) {
    throw new Error(`Unable to load BLNT backfill ${method} view`);
  }
  return BigInt(scValToNative(response.result.retval));
}

async function simulateAddressView(
  stellarRpc: rpc.Server,
  networkPassphrase: string,
  backfillId: string,
  method: string
): Promise<string> {
  const response = await stellarRpc.simulateTransaction(
    buildViewTransaction(networkPassphrase, backfillId, method)
  );
  if (!rpc.Api.isSimulationSuccess(response) || response.result?.retval === undefined) {
    throw new Error(`Unable to load BLNT backfill ${method} view`);
  }
  return scValToNative(response.result.retval).toString();
}

function calculateVestedAllocation(
  allocation: bigint,
  start: bigint,
  end: bigint,
  now: bigint
): bigint {
  if (now <= start) return BigInt(0);
  if (now >= end) return allocation;
  const duration = end - start;
  if (duration <= BigInt(0)) {
    throw new Error('Invalid BLNT backfill vesting schedule');
  }
  return (allocation * (now - start)) / duration;
}

async function loadContributorGrantAllocation(
  stellarRpc: rpc.Server,
  backfillId: string,
  grantee: string
): Promise<bigint> {
  const grantClaimsKey = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: Address.fromString(backfillId).toScAddress(),
      key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('GrantClaims')]),
      durability: xdr.ContractDataDurability.persistent(),
    })
  );
  const response = await stellarRpc.getLedgerEntries(grantClaimsKey);
  if (response.entries.length !== 1) return BigInt(0);

  const entry = response.entries[0].val.contractData().val();
  const grants = scValToNative(entry) as Record<string, unknown>;
  const allocation = grants?.[grantee];
  return typeof allocation === 'bigint' && allocation > BigInt(0) ? allocation : BigInt(0);
}

export async function loadBackfillEmissionsState(
  network: Network,
  backfillId: string,
  claimant: string
): Promise<BackfillEmissionsState> {
  const totalAllocation = getBackfillAllocation(claimant);
  if (totalAllocation === BigInt(0)) {
    return {
      totalAllocation,
      vestedAllocation: BigInt(0),
      claimable: BigInt(0),
      vestingStart: BigInt(0),
      vestingEnd: BigInt(0),
    };
  }

  const stellarRpc = new rpc.Server(network.rpc, network.opts);
  const claimantScVal = Address.fromString(claimant).toScVal();
  const [claimable, vestingStart, vestingEnd, latestLedger] = await Promise.all([
    simulateBigIntView(stellarRpc, network.passphrase, backfillId, 'get_backfill_claimable', [
      claimantScVal,
    ]),
    simulateBigIntView(stellarRpc, network.passphrase, backfillId, 'get_vesting_start'),
    simulateBigIntView(stellarRpc, network.passphrase, backfillId, 'get_vesting_end'),
    stellarRpc.getLatestLedger(),
  ]);
  const now = BigInt(latestLedger.closeTime);

  return {
    totalAllocation,
    vestedAllocation: calculateVestedAllocation(totalAllocation, vestingStart, vestingEnd, now),
    claimable,
    vestingStart,
    vestingEnd,
  };
}

export async function loadContributorGrantState(
  network: Network,
  backfillId: string,
  grantee: string
): Promise<ContributorGrantState | null> {
  const stellarRpc = new rpc.Server(network.rpc, network.opts);
  const totalAllocation = await loadContributorGrantAllocation(stellarRpc, backfillId, grantee);
  if (totalAllocation === BigInt(0)) return null;

  const granteeScVal = Address.fromString(grantee).toScVal();
  const [claimable, vestingStart, vestingEnd, latestLedger] = await Promise.all([
    simulateBigIntView(stellarRpc, network.passphrase, backfillId, 'get_grant_claimable', [
      granteeScVal,
    ]),
    simulateBigIntView(stellarRpc, network.passphrase, backfillId, 'get_grant_vesting_start'),
    simulateBigIntView(stellarRpc, network.passphrase, backfillId, 'get_grant_vesting_end'),
    stellarRpc.getLatestLedger(),
  ]);
  const now = BigInt(latestLedger.closeTime);

  return {
    totalAllocation,
    vestedAllocation: calculateVestedAllocation(totalAllocation, vestingStart, vestingEnd, now),
    claimable,
    vestingStart,
    vestingEnd,
  };
}

export async function loadLockupBackfillOwner(
  network: Network,
  lockupBackfillId: string
): Promise<string> {
  const stellarRpc = new rpc.Server(network.rpc, network.opts);
  const response = await stellarRpc.simulateTransaction(
    buildViewTransaction(network.passphrase, lockupBackfillId, 'get_config')
  );
  if (!rpc.Api.isSimulationSuccess(response) || response.result?.retval === undefined) {
    throw new Error('Unable to load BLNT lockup backfill configuration');
  }

  const config = scValToNative(response.result.retval) as Record<string, unknown>;
  const owner = config?.owner;
  if (typeof owner !== 'string') {
    throw new Error('BLNT lockup backfill configuration has no owner');
  }
  return owner;
}

export async function loadLockupBackfillClaimState(
  network: Network,
  lockupBackfillId: string,
  beneficiary: string
): Promise<LockupBackfillClaimState | null> {
  const stellarRpc = new rpc.Server(network.rpc, network.opts);
  const response = await stellarRpc.simulateTransaction(
    buildViewTransaction(network.passphrase, lockupBackfillId, 'get_claim', [
      Address.fromString(beneficiary).toScVal(),
    ])
  );

  if (rpc.Api.isSimulationError(response) && response.error.includes('Error(Contract, #1510)')) {
    return null;
  }
  if (!rpc.Api.isSimulationSuccess(response) || response.result?.retval === undefined) {
    throw new Error('Unable to load BLNT lockup backfill claim');
  }

  const claim = scValToNative(response.result.retval) as Record<string, unknown>;
  const allocation = claim?.allocation;
  const claimed = claim?.claimed;
  const payable = claim?.payable;
  const unclaimed = claim?.unclaimed;
  const vested = claim?.vested;
  if (
    typeof allocation !== 'bigint' ||
    typeof claimed !== 'bigint' ||
    typeof payable !== 'bigint' ||
    typeof unclaimed !== 'bigint' ||
    typeof vested !== 'bigint'
  ) {
    throw new Error('BLNT lockup backfill claim has an invalid response');
  }

  return {
    totalAllocation: allocation,
    vestedAllocation: vested,
    claimable: payable,
    claimed,
    unclaimed,
  };
}

export async function loadBackfillSwapState(
  network: Network,
  backfillId: string
): Promise<BackfillSwapState> {
  const stellarRpc = new rpc.Server(network.rpc, network.opts);
  const [legacyBlndToken, blntToken, remainingCapacity, swapDeadline, latestLedger] =
    await Promise.all([
      simulateAddressView(stellarRpc, network.passphrase, backfillId, 'get_legacy_blnd_token'),
      simulateAddressView(stellarRpc, network.passphrase, backfillId, 'get_blnt_token'),
      simulateBigIntView(stellarRpc, network.passphrase, backfillId, 'get_remaining_swap_capacity'),
      simulateBigIntView(stellarRpc, network.passphrase, backfillId, 'get_swap_deadline'),
      stellarRpc.getLatestLedger(),
    ]);

  return {
    legacyBlndToken,
    blntToken,
    remainingCapacity,
    swapDeadline,
    ledgerCloseTime: BigInt(latestLedger.closeTime),
  };
}
