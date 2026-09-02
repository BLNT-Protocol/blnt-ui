import {
  BackstopAssetV3,
  BackstopClaimArgsV3,
  BackstopContractV3,
  BackstopPoolUserV3,
  BackstopPoolV3,
  BackstopTierV3,
  FixedMath,
  parseError,
  parseResult,
} from '@blend-capital/blend-sdk';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box, Typography } from '@mui/material';
import { rpc } from '@stellar/stellar-sdk';
import { useWallet } from '../../contexts/wallet';
import {
  useBackstopPool,
  useBackstopPoolUser,
  useHorizonAccount,
  useSimulateOperation,
  useTokenBalance,
} from '../../hooks/api';
import { PoolMeta } from '../../hooks/types';
import theme from '../../theme';
import { getTierIcon, getTierLabel } from '../../utils/backstop';
import { toBalance, toPercentage } from '../../utils/formatter';
import { CustomButton } from '../common/CustomButton';
import { Divider } from '../common/Divider';
import { FlameIcon } from '../common/FlameIcon';
import { Icon } from '../common/Icon';
import { LinkBox } from '../common/LinkBox';
import { OpaqueButton } from '../common/OpaqueButton';
import { Row } from '../common/Row';
import { Section, SectionSize } from '../common/Section';
import { SectionBase } from '../common/SectionBase';
import { Skeleton } from '../common/Skeleton';
import { StackedText } from '../common/StackedText';
import { PoolExploreBar } from '../pool/PoolExploreBar';
import { PoolHealthBanner } from '../pool/PoolHealthBanner';
import { BackstopAPR } from './BackstopAPR';
import { BackstopAuthorizationStatus } from './BackstopAuthorizationStatus';
import { BackstopV3QueueItem } from './BackstopV3Action';

interface V3ClaimButtonProps {
  poolMeta: PoolMeta;
  pool: BackstopPoolV3;
  tier: BackstopTierV3;
}

const V3ClaimButton: React.FC<V3ClaimButtonProps> = ({ poolMeta, pool, tier }) => {
  const { connected, walletAddress, backstopClaim, restore } = useWallet();
  const args: BackstopClaimArgsV3 = {
    tier,
    from: walletAddress,
    pool_addresses: [poolMeta.id],
    min_lp_tokens_out: BigInt(0),
  };
  const operation =
    connected && walletAddress !== ''
      ? new BackstopContractV3(process.env.NEXT_PUBLIC_BACKSTOP_V3 ?? '').claim(args)
      : '';
  const {
    data: simulation,
    isLoading,
    refetch,
  } = useSimulateOperation(operation, connected && operation !== '');
  const isRestore = simulation !== undefined && rpc.Api.isSimulationRestore(simulation);
  const isError = simulation !== undefined && rpc.Api.isSimulationError(simulation);
  const amount =
    simulation !== undefined && rpc.Api.isSimulationSuccess(simulation)
      ? parseResult(simulation, BackstopContractV3.parsers.claim) ?? BigInt(0)
      : BigInt(0);
  const tierData = pool.tier(tier).data;
  const tierLabel = getTierLabel(tier, tierData.token, tierData.asset);
  const value =
    tierData.tokens > BigInt(0)
      ? FixedMath.toFloat((amount * tierData.value) / tierData.tokens, 7)
      : 0;
  const handleClick = async () => {
    if (isRestore) {
      await restore(simulation);
    } else if (connected && amount > BigInt(0)) {
      await backstopClaim(poolMeta, args, false);
    }
    refetch();
  };

  const error = isError ? parseError(simulation) : undefined;
  return (
    <CustomButton
      onClick={handleClick}
      disabled={!connected || isLoading || (!isRestore && (isError || amount === BigInt(0)))}
      title={error ? `Unable to claim: ${error.type}` : undefined}
      sx={{
        width: '100%',
        margin: '6px',
        padding: '12px',
        color: theme.palette.text.primary,
        backgroundColor: theme.palette.background.default,
        '&:hover': { color: theme.palette.primary.main },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <FlameIcon />
        <Icon
          src={getTierIcon(tier, tierData.token, tierData.asset)}
          alt={tierLabel}
          sx={{ height: '30px', width: '30px', marginRight: '12px' }}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          {isRestore ? (
            <Typography variant="h4">Restore Data</Typography>
          ) : (
            <>
              <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                <Typography variant="h4" sx={{ marginRight: '6px' }}>
                  {toBalance(amount, 7)}
                </Typography>
                <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
                  {tierLabel}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                ${toBalance(value)}
              </Typography>
            </>
          )}
        </Box>
      </Box>
      <ArrowForwardIcon fontSize="inherit" />
    </CustomButton>
  );
};

const V3TierBalanceCard: React.FC<{
  title: string;
  tier: BackstopTierV3;
  token: string;
  asset: BackstopAssetV3;
  amount: bigint | undefined;
  value: number | undefined;
}> = ({ title, tier, token, asset, amount, value }) => (
  <Box sx={{ width: 'calc(50% - 6px)' }}>
    <Typography variant="body2" sx={{ margin: '6px' }}>
      {title}
    </Typography>
    <Box
      sx={{
        padding: '12px',
        color: theme.palette.text.primary,
        backgroundColor: theme.palette.background.default,
        borderRadius: '5px',
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', flexDirection: 'row' }}>
          <Typography variant="h4" sx={{ marginRight: '6px' }}>
            {toBalance(amount, 7)}
          </Typography>
          <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
            {getTierLabel(tier, token, asset)}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
          ${toBalance(value)}
        </Typography>
      </Box>
    </Box>
  </Box>
);

interface V3TierCardProps {
  poolMeta: PoolMeta;
  pool: BackstopPoolV3;
  user: BackstopPoolUserV3 | undefined;
  tier: BackstopTierV3;
  walletBalance: bigint | undefined;
}

const V3TierCard: React.FC<V3TierCardProps> = ({ poolMeta, pool, user, tier, walletBalance }) => {
  const tierPool = pool.tier(tier);
  const tierLabel = getTierLabel(tier, tierPool.data.token, tierPool.data.asset);
  const userBalance = user?.balance(tier);
  const userTokens = userBalance ? tierPool.sharesToTokens(userBalance.shares) : BigInt(0);
  const queue = userBalance?.q4w ?? [];
  const now = BigInt(Math.floor(Date.now() / 1000));
  const unlockedShares = queue.reduce(
    (total, item) => (item.exp <= now ? total + item.amount : total),
    BigInt(0)
  );
  const lockedQueue = queue.filter((item) => item.exp > now);
  const lossTierLabel =
    tier === BackstopTierV3.FirstLoss
      ? 'First-loss tier'
      : tier === BackstopTierV3.SecondLoss
      ? 'Second-loss tier'
      : 'Third-loss tier';
  const totalWeight = pool.configuredTiers.reduce(
    (total, configuredTier) => total + pool.tier(configuredTier).data.take_rate_weight,
    0
  );
  const weightPercentage = `${((tierPool.data.take_rate_weight * 100) / totalWeight).toFixed(2)}%`;
  const canManage = tierPool.data.blnt_emission_eligible;
  const userValue =
    tierPool.data.tokens > BigInt(0)
      ? FixedMath.toFloat((userTokens * tierPool.data.value) / tierPool.data.tokens, 7)
      : 0;
  const walletValue =
    walletBalance !== undefined && tierPool.data.tokens > BigInt(0)
      ? FixedMath.toFloat((walletBalance * tierPool.data.value) / tierPool.data.tokens, 7)
      : undefined;

  return (
    <Section width={SectionSize.FULL} sx={{ flexDirection: 'column', marginBottom: '12px' }}>
      <Row sx={{ alignItems: 'center', padding: '12px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', width: '33.33%' }}>
          <Icon
            src={getTierIcon(tier, tierPool.data.token, tierPool.data.asset)}
            alt={tierLabel}
            sx={{ height: '30px', width: '30px', marginRight: '12px' }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <Typography variant="h4">{tierLabel}</Typography>
            <BackstopAuthorizationStatus tierPool={tierPool} sx={{ marginTop: '2px' }} />
          </Box>
        </Box>
        <Box sx={{ textAlign: 'center', width: '33.33%' }}>
          <Typography variant="body2" color={theme.palette.text.secondary}>
            {lossTierLabel}
          </Typography>
          <Typography variant="body2" color={theme.palette.text.secondary}>
            Weight: {weightPercentage}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '33.33%' }}>
          {canManage && (
            <LinkBox
              sx={{ width: '100%', maxWidth: '140px' }}
              to={{ pathname: '/backstop-token', query: { poolId: poolMeta.id, tier } }}
            >
              <OpaqueButton palette={theme.palette.primary} sx={{ width: '100%', padding: '6px' }}>
                Manage LP
              </OpaqueButton>
            </LinkBox>
          )}
        </Box>
      </Row>
      <Row sx={{ width: SectionSize.FULL, margin: '6px' }}>
        <V3TierBalanceCard
          title="Wallet balance"
          tier={tier}
          token={tierPool.data.token}
          asset={tierPool.data.asset}
          amount={walletBalance}
          value={walletValue}
        />
        <V3TierBalanceCard
          title="Backstop deposit"
          tier={tier}
          token={tierPool.data.token}
          asset={tierPool.data.asset}
          amount={userTokens}
          value={userValue}
        />
      </Row>
      <Row sx={{ width: SectionSize.FULL, margin: '6px' }}>
        <LinkBox
          sx={{
            width: '50%',
            marginRight: '6px',
          }}
          to={{ pathname: '/backstop-deposit', query: { poolId: poolMeta.id, tier } }}
        >
          <OpaqueButton palette={theme.palette.backstop} sx={{ width: '100%', padding: '6px' }}>
            Backstop Deposit
          </OpaqueButton>
        </LinkBox>
        <LinkBox
          sx={{ width: '50%', marginLeft: '6px' }}
          to={{ pathname: '/backstop-q4w', query: { poolId: poolMeta.id, tier } }}
        >
          <OpaqueButton palette={theme.palette.positive} sx={{ width: '100%', padding: '6px' }}>
            Queue for Withdrawal
          </OpaqueButton>
        </LinkBox>
      </Row>
      {queue.length > 0 && (
        <Box sx={{ width: '100%', marginTop: '6px' }}>
          <Box
            sx={{
              width: SectionSize.FULL,
              margin: '6px',
              padding: '6px',
              backgroundColor: theme.palette.background.default,
              borderRadius: '5px',
            }}
          >
            <Typography sx={{ padding: '6px' }}>Queued for withdrawal (Q4W)</Typography>
          </Box>
          {unlockedShares > BigInt(0) && (
            <BackstopV3QueueItem
              poolMeta={poolMeta}
              tier={tier}
              tierPool={tierPool}
              q4w={{ amount: unlockedShares, exp: BigInt(0) }}
              canDequeue={false}
            />
          )}
          {lockedQueue.map((item, index) => (
            <BackstopV3QueueItem
              key={`${item.exp.toString()}-${index}`}
              poolMeta={poolMeta}
              tier={tier}
              tierPool={tierPool}
              q4w={item}
              canDequeue={index === lockedQueue.length - 1}
            />
          ))}
        </Box>
      )}
    </Section>
  );
};

export const BackstopV3View: React.FC<{ poolMeta: PoolMeta }> = ({ poolMeta }) => {
  const { connected } = useWallet();
  const { data: loadedPool } = useBackstopPool(poolMeta);
  const pool = loadedPool instanceof BackstopPoolV3 ? loadedPool : undefined;
  const emissionEligibleTiers =
    pool?.configuredTiers.filter((tier) => pool.tier(tier).data.blnt_emission_eligible) ?? [];
  const hasEmissionEligibleTier = emissionEligibleTiers.length > 0;
  const { data: loadedUser } = useBackstopPoolUser(poolMeta);
  const { data: horizonAccount } = useHorizonAccount();
  const user = loadedUser instanceof BackstopPoolUserV3 ? loadedUser : undefined;
  const { data: firstLossBalance } = useTokenBalance(
    pool?.tiers[BackstopTierV3.FirstLoss]?.data.token,
    undefined,
    horizonAccount
  );
  const { data: secondLossBalance } = useTokenBalance(
    pool?.tiers[BackstopTierV3.SecondLoss]?.data.token,
    undefined,
    horizonAccount
  );
  const { data: thirdLossBalance } = useTokenBalance(
    pool?.tiers[BackstopTierV3.ThirdLoss]?.data.token,
    undefined,
    horizonAccount
  );

  if (pool === undefined) return <Skeleton />;
  const walletBalances = {
    [BackstopTierV3.FirstLoss]: connected ? firstLossBalance : BigInt(0),
    [BackstopTierV3.SecondLoss]: connected ? secondLossBalance : BigInt(0),
    [BackstopTierV3.ThirdLoss]: connected ? thirdLossBalance : BigInt(0),
  };

  return (
    <>
      <PoolHealthBanner poolId={poolMeta.id} />
      <PoolExploreBar poolId={poolMeta.id} />
      <Row>
        <SectionBase type="alt" sx={{ margin: '6px', padding: '6px' }}>
          Backstop Manager
        </SectionBase>
      </Row>
      <Divider />
      <Row>
        <Section width={SectionSize.THIRD}>
          <BackstopAPR poolId={poolMeta.id} />
        </Section>
        <Section width={SectionSize.THIRD}>
          <StackedText
            title="Q4W"
            text={toPercentage(FixedMath.toFloat(pool.data.q4w_pct, 7))}
            sx={{ width: '100%', padding: '6px' }}
            tooltip="Percent of capital insuring this pool queued for withdrawal (Q4W). A higher percent indicates potential risks."
          />
        </Section>
        <Section width={SectionSize.THIRD}>
          <StackedText
            title="Total Deposited"
            text={`$${toBalance(FixedMath.toFloat(pool.totalValue(), 7))}`}
            sx={{ width: '100%', padding: '6px' }}
          />
        </Section>
      </Row>
      {hasEmissionEligibleTier && (
        <Row>
          <Section
            width={SectionSize.FULL}
            sx={{ flexDirection: 'column', paddingTop: '12px' }}
          >
            <Typography variant="body2" sx={{ margin: '6px' }}>
              Emissions to claim
            </Typography>
            {emissionEligibleTiers.map((tier) => (
              <Row key={tier}>
                <V3ClaimButton poolMeta={poolMeta} pool={pool} tier={tier} />
              </Row>
            ))}
          </Section>
        </Row>
      )}
      {pool.configuredTiers.map((tier) => (
        <V3TierCard
          key={tier}
          poolMeta={poolMeta}
          pool={pool}
          user={user}
          tier={tier}
          walletBalance={walletBalances[tier]}
        />
      ))}
    </>
  );
};
