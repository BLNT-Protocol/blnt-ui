import {
  BackstopPoolUserV3,
  BackstopPoolV3,
  BACKSTOP_DEPOSIT_ALLOWED,
  BackstopTierV3,
  BackstopContractV3,
  BackstopTierPoolV3,
  parseResult,
  Q4WV3,
  TierBackstopActionArgsV3,
  Version,
} from '@blend-capital/blend-sdk';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { rpc } from '@stellar/stellar-sdk';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { useSettings, ViewType } from '../../contexts';
import { TxStatus, TxType, useWallet } from '../../contexts/wallet';
import {
  useBackstopPool,
  useBackstopPoolUser,
  useHorizonAccount,
  usePoolPermissions,
  useTokenBalance,
  useSimulateOperation,
} from '../../hooks/api';
import { RPC_DEBOUNCE_DELAY, useDebouncedState } from '../../hooks/debounce';
import { PoolMeta } from '../../hooks/types';
import { getTierIcon, getTierLabel } from '../../utils/backstop';
import { toBalance, toTimeSpan } from '../../utils/formatter';
import { bigintToInput, scaleInputToBigInt } from '../../utils/scval';
import { getErrorFromSim, getPoolPermissionError } from '../../utils/txSim';
import { AnvilAlert } from '../common/AnvilAlert';
import { InputBar } from '../common/InputBar';
import { InputButton } from '../common/InputButton';
import { OpaqueButton } from '../common/OpaqueButton';
import { Row } from '../common/Row';
import { Section, SectionSize } from '../common/Section';
import { Skeleton } from '../common/Skeleton';
import { ToggleSlider } from '../common/ToggleSlider';
import { TxFeeSelector } from '../common/TxFeeSelector';
import { TxOverview } from '../common/TxOverview';
import { Value } from '../common/Value';
import { ValueChange } from '../common/ValueChange';
import { BackstopAuthorizationStatus } from './BackstopAuthorizationStatus';

export function parseBackstopTier(value: string | string[] | undefined): BackstopTierV3 {
  return Object.values(BackstopTierV3).includes(value as BackstopTierV3)
    ? (value as BackstopTierV3)
    : BackstopTierV3.FirstLoss;
}

export const BackstopV3QueueItem: React.FC<{
  poolMeta: PoolMeta;
  tier: BackstopTierV3;
  tierPool: BackstopTierPoolV3;
  q4w: Q4WV3;
  canDequeue: boolean;
}> = ({ poolMeta, tier, tierPool, q4w, canDequeue }) => {
  const theme = useTheme();
  const { connected, walletAddress, backstopDequeueWithdrawal, backstopWithdraw, restore } =
    useWallet();
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const {
    data: poolPermissions,
    isError: isPermissionError,
    isLoading: isPermissionLoading,
  } = usePoolPermissions(poolMeta);
  const unlocked = q4w.exp === BigInt(0) || q4w.exp <= BigInt(now);
  const dequeuePermission = getPoolPermissionError(
    poolMeta.version === Version.V3 && poolMeta.accessController !== undefined,
    poolPermissions,
    BACKSTOP_DEPOSIT_ALLOWED,
    isPermissionLoading,
    isPermissionError,
    'dequeueing a backstop withdrawal'
  );
  const args: TierBackstopActionArgsV3 = {
    tier,
    from: walletAddress,
    pool_address: poolMeta.id,
    amount: q4w.amount,
  };
  const operation =
    connected && walletAddress !== '' && (unlocked || canDequeue)
      ? unlocked
        ? new BackstopContractV3(process.env.NEXT_PUBLIC_BACKSTOP_V3 ?? '').withdraw({
            ...args,
            to: walletAddress,
          })
        : new BackstopContractV3(process.env.NEXT_PUBLIC_BACKSTOP_V3 ?? '').dequeueWithdrawal(args)
      : '';
  const {
    data: simulation,
    isLoading,
    refetch,
  } = useSimulateOperation(operation, operation !== '');
  const isRestore = simulation !== undefined && rpc.Api.isSimulationRestore(simulation);
  const isError = simulation !== undefined && rpc.Api.isSimulationError(simulation);
  const timeLeft = Math.max(0, Number(q4w.exp) - now);
  const timeWaitedPercentage = Math.min(1, Math.max(0, 1 - timeLeft / (17 * 24 * 60 * 60)));

  useEffect(() => {
    if (unlocked) return;
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, [unlocked]);

  const act = async () => {
    if (isRestore) {
      await restore(simulation);
    } else if (unlocked) {
      await backstopWithdraw(poolMeta, args, false);
    } else if (canDequeue) {
      await backstopDequeueWithdrawal(poolMeta, args, false);
    }
    refetch();
  };

  return (
    <Row>
      <Box sx={{ margin: '6px', padding: '6px', display: 'flex', alignItems: 'center' }}>
        {timeLeft > 0 ? (
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '50px',
            }}
          >
            <CircularProgress
              sx={{
                color: theme.palette.positive.main,
                marginLeft: '6px',
                marginRight: '12px',
                position: 'absolute',
              }}
              size="30px"
              thickness={4.5}
              variant="determinate"
              value={timeWaitedPercentage * 100}
            />
            <CircularProgress
              sx={{
                color: theme.palette.positive.opaque,
                marginLeft: '6px',
                marginRight: '12px',
              }}
              size="30px"
              thickness={4.5}
              variant="determinate"
              value={100}
            />
          </Box>
        ) : (
          <CheckCircleOutlineIcon
            sx={{ color: theme.palette.primary.main, marginRight: '12px', fontSize: '35px' }}
          />
        )}
        <Box>
          <Box sx={{ display: 'flex', flexDirection: 'row' }}>
            <Typography variant="h4" sx={{ marginRight: '6px' }}>
              {toBalance(tierPool.sharesToTokens(q4w.amount), 7)}
            </Typography>
            <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
              {getTierLabel(tier, tierPool.data.token, tierPool.data.asset)}
            </Typography>
          </Box>
          <Typography variant="h4" sx={{ marginRight: '6px' }}>
            {timeLeft > 0 ? toTimeSpan(timeLeft) : 'Unlocked'}
          </Typography>
        </Box>
      </Box>
      <OpaqueButton
        onClick={act}
        palette={theme.palette.positive}
        disabled={
          !connected ||
          isLoading ||
          (!isRestore &&
            (isError || (!unlocked && (!canDequeue || dequeuePermission !== undefined))))
        }
        sx={{ height: '35px', width: '108px', margin: '12px' }}
      >
        {isRestore ? 'Restore' : unlocked ? 'Withdraw' : 'Unqueue'}
      </OpaqueButton>
    </Row>
  );
};

export const BackstopV3Action: React.FC<{
  poolMeta: PoolMeta;
  tier: BackstopTierV3;
  type: 'deposit' | 'q4w';
}> = ({ poolMeta, tier, type }) => {
  const theme = useTheme();
  const router = useRouter();
  const { viewType } = useSettings();
  const {
    connected,
    walletAddress,
    backstopDeposit,
    backstopQueueWithdrawal,
    txStatus,
    txType,
    isLoading,
    txInclusionFee,
  } = useWallet();
  const { data: loadedPool, refetch: refetchPool } = useBackstopPool(poolMeta);
  const {
    data: poolPermissions,
    isError: isPermissionError,
    isLoading: isPermissionLoading,
  } = usePoolPermissions(poolMeta);
  const { data: loadedUser, refetch: refetchUser } = useBackstopPoolUser(poolMeta);
  const { data: horizonAccount } = useHorizonAccount();
  const pool = loadedPool instanceof BackstopPoolV3 ? loadedPool : undefined;
  const user = loadedUser instanceof BackstopPoolUserV3 ? loadedUser : undefined;
  const tierPool = pool?.tiers[tier];
  const { data: walletBalance } = useTokenBalance(
    tierPool?.data.token,
    undefined,
    horizonAccount
  );
  const [amount, setAmount] = useState('');
  const [simulation, setSimulation] = useState<rpc.Api.SimulateTransactionResponse>();
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  const depositedTokens =
    tierPool && user ? tierPool.sharesToTokens(user.balance(tier).shares) : BigInt(0);
  const available = type === 'deposit' ? walletBalance ?? BigInt(0) : depositedTokens;
  const queue = user?.balance(tier).q4w ?? [];
  const queuedShares = queue.reduce((total, item) => total + item.amount, BigInt(0));
  const queuedTokens = tierPool?.sharesToTokens(queuedShares) ?? BigInt(0);
  const queueNow = BigInt(Math.floor(Date.now() / 1000));
  const unlockedQueueShares = queue.reduce(
    (total, item) => (item.exp <= queueNow ? total + item.amount : total),
    BigInt(0)
  );
  const lockedQueue = queue.filter((item) => item.exp > queueNow);
  const isSimulationSuccess = simulation !== undefined && rpc.Api.isSimulationSuccess(simulation);
  const depositShares =
    type === 'deposit' && isSimulationSuccess
      ? parseResult(simulation, BackstopContractV3.parsers.deposit)
      : undefined;
  const queuedWithdrawal =
    type === 'q4w' && isSimulationSuccess
      ? parseResult(simulation, BackstopContractV3.parsers.queueWithdrawal)
      : undefined;
  const requestedTokens = isSimulationSuccess ? scaleInputToBigInt(amount, 7) : BigInt(0);
  const estimatedDepositedTokens =
    tierPool !== undefined && depositShares !== undefined
      ? tierPool.data.shares + depositShares === BigInt(0)
        ? BigInt(0)
        : (((user?.balance(tier).shares ?? BigInt(0)) + depositShares) *
            (tierPool.data.tokens + requestedTokens)) /
          (tierPool.data.shares + depositShares)
      : BigInt(0);
  const estimatedQueuedTokens =
    tierPool !== undefined && queuedWithdrawal !== undefined
      ? queuedTokens + tierPool.sharesToTokens(queuedWithdrawal.amount)
      : BigInt(0);

  const amountInContractUnits = () => {
    const tokens = scaleInputToBigInt(amount, 7);
    if (type === 'deposit' || tierPool === undefined) return tokens;
    return tierPool.tokensToShares(tokens);
  };

  const submit = async (sim: boolean) => {
    if (!connected || amount === '') return;
    const args: TierBackstopActionArgsV3 = {
      tier,
      from: walletAddress,
      pool_address: poolMeta.id,
      amount: amountInContractUnits(),
    };
    const result =
      type === 'deposit'
        ? await backstopDeposit(poolMeta, args, sim)
        : await backstopQueueWithdrawal(poolMeta, args, sim);
    if (sim) setSimulation(result);
  };

  useDebouncedState(amount, RPC_DEBOUNCE_DELAY, txType, async () => {
    setSimulation(undefined);
    if (amount !== '') await submit(true);
    setLoadingEstimate(false);
  });

  useEffect(() => {
    setAmount('');
    setSimulation(undefined);
    setLoadingEstimate(false);
  }, [tier, type]);

  useEffect(() => {
    if (txStatus === TxStatus.SUCCESS && txType === TxType.CONTRACT) {
      setAmount('');
      setSimulation(undefined);
      void Promise.all([refetchPool(), refetchUser()]);
    }
  }, [refetchPool, refetchUser, txStatus, txType]);

  const { isSubmitDisabled, isMaxDisabled, reason, disabledType, isError, extraContent } = useMemo(
    () =>
      getErrorFromSim(amount, 7, isLoading || loadingEstimate, simulation, () => {
        if (type === 'deposit') {
          const permissionError = getPoolPermissionError(
            poolMeta.version === Version.V3 && poolMeta.accessController !== undefined,
            poolPermissions,
            BACKSTOP_DEPOSIT_ALLOWED,
            isPermissionLoading,
            isPermissionError,
            'backstop deposits'
          );
          if (permissionError) return permissionError;
        }
        const requested = scaleInputToBigInt(amount, 7);
        if (requested <= BigInt(0)) {
          return {
            isError: true,
            isSubmitDisabled: true,
            reason: 'Please enter an amount greater than zero.',
            disabledType: 'warning',
          };
        }
        if (requested > available) {
          return {
            isError: true,
            isSubmitDisabled: true,
            reason: 'The amount exceeds your available balance.',
            disabledType: 'warning',
          };
        }
        return {};
      }),
    [
      amount,
      available,
      isLoading,
      loadingEstimate,
      simulation,
      type,
      poolMeta.version,
      poolMeta.accessController,
      poolPermissions,
      isPermissionLoading,
      isPermissionError,
    ]
  );

  if (pool === undefined || tierPool === undefined) return <Skeleton />;

  const tierLabel = getTierLabel(tier, tierPool.data.token, tierPool.data.asset);

  return (
    <>
      <Row>
        <Section width={SectionSize.FULL} sx={{ padding: '12px', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
            <Typography variant="body2">Backstop tier</Typography>
            <BackstopAuthorizationStatus tierPool={tierPool} sx={{ marginLeft: '6px' }} />
          </Box>
          <ToggleSlider
            options={pool.configuredTiers.map((optionTier) => ({
              optionName: optionTier,
              palette: theme.palette.backstop,
            }))}
            text={pool.configuredTiers.map((optionTier) => {
              const data = pool.tier(optionTier).data;
              return getTierLabel(optionTier, data.token, data.asset);
            })}
            icons={
              type === 'q4w'
                ? pool.configuredTiers.map((optionTier) => {
                    const data = pool.tier(optionTier).data;
                    return {
                      src: getTierIcon(optionTier, data.token, data.asset),
                      alt: getTierLabel(optionTier, data.token, data.asset),
                    };
                  })
                : undefined
            }
            selected={tier}
            changeState={(nextTier: BackstopTierV3) =>
              router.replace({
                pathname: router.pathname,
                query: { poolId: poolMeta.id, tier: nextTier },
              })
            }
            sx={{ width: '100%', minHeight: '32px' }}
          />
        </Section>
      </Row>
      <Row>
        <Section width={SectionSize.FULL} sx={{ padding: '12px' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Typography variant="h5">
              Available {type === 'deposit' ? 'in wallet' : 'to queue'}
            </Typography>
            <Typography variant="h4" color={theme.palette.backstop.main}>
              {toBalance(available, 7)} {tierLabel}
            </Typography>
          </Box>
        </Section>
      </Row>
      <Row>
        <Section width={SectionSize.FULL} sx={{ padding: 0, flexDirection: 'column' }}>
          <Box
            sx={{
              background: theme.palette.backstop.opaque,
              width: '100%',
              borderRadius: '5px',
              padding: '12px',
              marginBottom: '12px',
            }}
          >
            <Typography variant="body2" sx={{ marginBottom: '12px' }}>
              Amount to {type === 'deposit' ? 'deposit' : 'queue for withdrawal'}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                gap: '12px',
                flexDirection: viewType === ViewType.MOBILE ? 'column' : 'row',
              }}
            >
              <InputBar
                symbol={tierLabel}
                value={amount}
                onValueChange={(value) => {
                  setAmount(value);
                  setLoadingEstimate(true);
                }}
                palette={theme.palette.backstop}
                sx={{ width: '100%' }}
              >
                <InputButton
                  palette={theme.palette.backstop}
                  onClick={() => {
                    setAmount(bigintToInput(available, 7));
                    setLoadingEstimate(true);
                  }}
                  disabled={isMaxDisabled}
                  text="MAX"
                />
              </InputBar>
              <OpaqueButton
                onClick={() => submit(false)}
                palette={theme.palette.backstop}
                sx={{ minWidth: '108px', padding: '6px' }}
                disabled={!connected || isSubmitDisabled}
              >
                {type === 'deposit' ? 'Deposit' : 'Queue'}
              </OpaqueButton>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <TxFeeSelector />
            </Box>
          </Box>
          {!isError && isSimulationSuccess && (
            <TxOverview>
              <Value
                title={type === 'deposit' ? 'Amount to deposit' : 'Amount to queue'}
                value={`${amount} ${tierLabel}`}
              />
              <Value
                title={
                  <>
                    <Image src="/icons/dashboard/gascan.svg" alt="Gas" width={20} height={20} /> Gas
                  </>
                }
                value={`${toBalance(
                  BigInt((simulation as any).minResourceFee ?? 0) + BigInt(txInclusionFee.fee),
                  7
                )} XLM`}
              />
              {type === 'deposit' ? (
                <ValueChange
                  title="Your total deposit"
                  curValue={`${toBalance(depositedTokens, 7)} ${tierLabel}`}
                  newValue={`${toBalance(estimatedDepositedTokens, 7)} ${tierLabel}`}
                />
              ) : (
                <>
                  <Value
                    title="New queue expiration"
                    value={
                      queuedWithdrawal === undefined
                        ? 'Unavailable'
                        : new Date(Number(queuedWithdrawal.exp) * 1000).toISOString().split('T')[0]
                    }
                  />
                  <ValueChange
                    title="Your total amount queued"
                    curValue={`${toBalance(queuedTokens, 7)} ${tierLabel}`}
                    newValue={`${toBalance(estimatedQueuedTokens, 7)} ${tierLabel}`}
                  />
                </>
              )}
            </TxOverview>
          )}
          {isError && (
            <AnvilAlert severity={disabledType} message={reason} extraContent={extraContent} />
          )}
        </Section>
      </Row>
      {type === 'q4w' && user !== undefined && tierPool !== undefined && queue.length > 0 && (
        <Row>
          <Section width={SectionSize.FULL} sx={{ flexDirection: 'column' }}>
            <Row>
              <Box
                sx={{
                  margin: '6px',
                  padding: '6px',
                  width: '100%',
                  alignItems: 'center',
                  backgroundColor: theme.palette.background.default,
                  borderRadius: '5px',
                }}
              >
                <Typography sx={{ padding: '6px' }}>Queued for withdrawal (Q4W)</Typography>
              </Box>
            </Row>
            {unlockedQueueShares > BigInt(0) && (
              <BackstopV3QueueItem
                poolMeta={poolMeta}
                tier={tier}
                tierPool={tierPool}
                q4w={{ amount: unlockedQueueShares, exp: BigInt(0) }}
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
          </Section>
        </Row>
      )}
    </>
  );
};
