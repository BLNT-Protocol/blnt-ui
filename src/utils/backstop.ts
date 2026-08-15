import {
  Backstop,
  BackstopPool,
  BackstopPoolEst,
  BackstopPoolUser,
  BackstopPoolUserEst,
  BackstopPoolUserV3,
  BackstopPoolV3,
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
    return Object.values(BackstopTierV3).reduce((total, tier) => {
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

export function getTierLabel(tier: BackstopTierV3): string {
  switch (tier) {
    case BackstopTierV3.BlndXlm:
      return 'BLND-XLM LP';
    case BackstopTierV3.BlndUsdc:
      return 'BLND-USDC LP';
    case BackstopTierV3.Usdc:
      return 'USDC';
  }
}

export function getTierIcon(tier: BackstopTierV3): string {
  switch (tier) {
    case BackstopTierV3.BlndXlm:
      return '/icons/tokens/xlm.svg';
    case BackstopTierV3.BlndUsdc:
      return '/icons/tokens/blndusdclp.svg';
    case BackstopTierV3.Usdc:
      return '/icons/tokens/soroban.svg';
  }
}
