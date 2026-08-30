import {
  Backstop,
  BackstopPool,
  BackstopPoolEst,
  BackstopPoolUser,
  BackstopPoolUserEst,
  BackstopPoolUserV3,
  BackstopPoolV3,
  BackstopAssetV3,
  BackstopTierV3,
  FixedMath,
} from '@blend-capital/blend-sdk';

export interface BackstopPoolMetrics {
  q4wPercentage: number;
  totalSpotValue: number;
}

export function getBackstopPoolMetrics(
  backstop: Backstop,
  pool: BackstopPool | BackstopPoolV3
): BackstopPoolMetrics {
  if (pool instanceof BackstopPoolV3) {
    return {
      q4wPercentage: FixedMath.toFloat(pool.data.q4w_pct, 7),
      totalSpotValue: FixedMath.toFloat(pool.totalValue(), 7),
    };
  }
  const estimate = BackstopPoolEst.build(backstop.backstopToken, pool.poolBalance);
  return {
    q4wPercentage: estimate.q4wPercentage,
    totalSpotValue: estimate.totalSpotValue,
  };
}

export function getBackstopUserValue(
  backstop: Backstop,
  pool: BackstopPool | BackstopPoolV3,
  user: BackstopPoolUser | BackstopPoolUserV3
): number {
  if (pool instanceof BackstopPoolV3 && user instanceof BackstopPoolUserV3) {
    return pool.configuredTiers.reduce((total, tier) => {
      const tierPool = pool.tier(tier);
      if (tierPool.data.shares === BigInt(0) || tierPool.data.tokens === BigInt(0)) return total;
      const userTokens = tierPool.sharesToTokens(user.balance(tier).shares);
      return (
        total + FixedMath.toFloat((userTokens * tierPool.data.value) / tierPool.data.tokens, 7)
      );
    }, 0);
  }
  if (pool instanceof BackstopPoolV3 || user instanceof BackstopPoolUserV3) return 0;
  return BackstopPoolUserEst.build(backstop, pool, user).totalSpotValue;
}

export function getTierLabel(
  tier: BackstopTierV3,
  token?: string,
  asset?: BackstopAssetV3
): string {
  if (asset === BackstopAssetV3.BlntXlm || token === process.env.NEXT_PUBLIC_BLND_XLM_COMET) {
    return 'BLNT-XLM LP';
  }
  if (asset === BackstopAssetV3.BlntUsdc || token === process.env.NEXT_PUBLIC_BLND_USDC_COMET) {
    return 'BLNT-USDC LP';
  }
  if (asset === BackstopAssetV3.Usdc || token === process.env.NEXT_PUBLIC_USDC_TOKEN) return 'USDC';
  if (asset === BackstopAssetV3.Xlm) return 'XLM';
  return tier === BackstopTierV3.FirstLoss
    ? 'First-loss asset'
    : tier === BackstopTierV3.SecondLoss
    ? 'Second-loss asset'
    : 'Third-loss asset';
}

export function getTierIcon(
  _tier: BackstopTierV3,
  token?: string,
  asset?: BackstopAssetV3
): string {
  if (
    asset === BackstopAssetV3.BlntXlm ||
    asset === BackstopAssetV3.Xlm ||
    token === process.env.NEXT_PUBLIC_BLND_XLM_COMET
  ) {
    return '/icons/tokens/xlm.svg';
  }
  if (asset === BackstopAssetV3.BlntUsdc || token === process.env.NEXT_PUBLIC_BLND_USDC_COMET) {
    return '/icons/tokens/blndusdclp.svg';
  }
  return '/icons/tokens/soroban.svg';
}
