import iconMap from './icon-map.json';

type ContractTokenIconConfig = {
  contractTokenSymbol: string;
  icon: string;
};

type PoolIconConfig = {
  poolAddress: string;
  icon: string;
};

type IconMap = {
  contractTokenIcons?: ContractTokenIconConfig[];
  poolIcons?: PoolIconConfig[];
};

const typedIconMap = iconMap as IconMap;

export function getContractTokenIcon(symbol: string): string {
  return (
    typedIconMap.contractTokenIcons?.find(
      ({ contractTokenSymbol }) => contractTokenSymbol === symbol
    )?.icon ?? '/icons/tokens/soroban.svg'
  );
}

export function getPoolIcon(poolAddress: string | undefined): string {
  return (
    typedIconMap.poolIcons?.find(
      ({ poolAddress: configuredPoolAddress }) => configuredPoolAddress === poolAddress
    )?.icon ?? `/icons/pools/blend.svg`
  );
}
