import { Asset } from '@stellar/stellar-sdk';

export const USDC_ASSET = new Asset('USDC', process.env.NEXT_PUBLIC_USDC_ISSUER || '');

export const V3_USDC_ASSET = new Asset(
  'USDC',
  process.env.NEXT_PUBLIC_V3_USDC_ISSUER || process.env.NEXT_PUBLIC_USDC_ISSUER || ''
);

export const BLND_ASSET = new Asset('BLND', process.env.NEXT_PUBLIC_BLND_ISSUER || '');

export const BLNT_ASSET = new Asset(
  'BLNT',
  process.env.NEXT_PUBLIC_BLNT_ISSUER || process.env.NEXT_PUBLIC_BLND_ISSUER || ''
);

export const MAINNET_USDC_CONTRACT_ADDRESS =
  'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
