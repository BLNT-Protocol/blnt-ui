import { Network } from '@blend-capital/blend-sdk';
import {
  Account,
  Contract,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

const VIEW_SOURCE = 'GANXGJV2RNOFMOSQ2DTI3RKDBAVERXUVFC27KW3RLVQCLB3RYNO3AAI4';

export const BLNT_BACKSTOP_MANAGER_HELPER_ID =
  process.env.NEXT_PUBLIC_BLNT_BACKSTOP_MANAGER_HELPER || '';

export interface BlntBackstopManagerHelperConfig {
  backstop: string;
  blnt: string;
  manager: string;
  owner: string;
  pool: string;
}

export function buildBackstopManagerDepositAndClaimOperation(helperId: string): xdr.Operation {
  return new Contract(helperId).call('deposit_and_claim');
}

function requireAddress(config: Record<string, unknown>, field: string): string {
  const value = config[field];
  if (typeof value !== 'string') {
    throw new Error(`BLNT backstop manager helper configuration has no ${field}`);
  }
  return value;
}

export async function loadBlntBackstopManagerHelperConfig(
  network: Network,
  helperId: string
): Promise<BlntBackstopManagerHelperConfig> {
  const transaction = new TransactionBuilder(new Account(VIEW_SOURCE, '0'), {
    fee: '100',
    networkPassphrase: network.passphrase,
    timebounds: { minTime: 0, maxTime: 0 },
  })
    .addOperation(new Contract(helperId).call('get_config'))
    .build();
  const stellarRpc = new rpc.Server(network.rpc, network.opts);
  const response = await stellarRpc.simulateTransaction(transaction);
  if (!rpc.Api.isSimulationSuccess(response) || response.result?.retval === undefined) {
    throw new Error('Unable to load BLNT backstop manager helper configuration');
  }

  const config = scValToNative(response.result.retval) as Record<string, unknown>;
  return {
    backstop: requireAddress(config, 'backstop'),
    blnt: requireAddress(config, 'blnt'),
    manager: requireAddress(config, 'manager'),
    owner: requireAddress(config, 'owner'),
    pool: requireAddress(config, 'pool'),
  };
}
