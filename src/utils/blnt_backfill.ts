import { Network } from '@blend-capital/blend-sdk';
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import allocations from '../data/blnt_backfill_allocations.json';

const VIEW_SOURCE = 'GANXGJV2RNOFMOSQ2DTI3RKDBAVERXUVFC27KW3RLVQCLB3RYNO3AAI4';

export const BLNT_BACKFILL_ID = process.env.NEXT_PUBLIC_BLNT_BACKFILL || '';

export interface BackfillEmissionsState {
  totalAllocation: bigint;
  vestedAllocation: bigint;
  claimable: bigint;
  vestingStart: bigint;
  vestingEnd: bigint;
}

export function getBackfillAllocation(address: string): bigint {
  const rawAllocation = (allocations as Record<string, string>)[address];
  return rawAllocation === undefined ? BigInt(0) : BigInt(rawAllocation);
}

export function buildClaimBackfillOperation(
  backfillId: string,
  claimant: string,
  to: string
): xdr.Operation {
  return new Contract(backfillId).call(
    'claim_backfill',
    Address.fromString(claimant).toScVal(),
    Address.fromString(to).toScVal()
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
