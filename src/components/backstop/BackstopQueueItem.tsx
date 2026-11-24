import { BackstopContractV1, PoolBackstopActionArgs, Q4W } from '@blend-capital/blend-sdk';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Box, CircularProgress, SxProps, Theme, Tooltip, Typography } from '@mui/material';
import { rpc } from '@stellar/stellar-sdk';
import { useSettings, ViewType } from '../../contexts';
import { useWallet } from '../../contexts/wallet';
import { usePoolMeta, useSimulateOperation } from '../../hooks/api';
import { useCurrentTimestamp } from '../../hooks/time';
import theme from '../../theme';
import { toBalance, toTimeSpan } from '../../utils/formatter';
import { BACKSTOP_IDS, isV2Contracts, Version } from '../../utils/version';
import { Icon } from '../common/Icon';
import { OpaqueButton } from '../common/OpaqueButton';
import { PoolComponentProps } from '../common/PoolComponentProps';
import { Row } from '../common/Row';

export interface BackstopQueueItemProps extends PoolComponentProps {
  version: Version;
  q4w: Q4W;
  inTokens: number;
  canUnqueue: boolean;
}
export const BackstopQueueItem: React.FC<BackstopQueueItemProps> = ({
  version,
  q4w,
  inTokens,
  canUnqueue,
  poolId,
}) => {
  const { connected, walletAddress, backstopDequeueWithdrawal, backstopWithdraw, restore } =
    useWallet();
  const { viewType } = useSettings();

  const { data: poolMeta } = usePoolMeta(poolId);

  const backstop = new BackstopContractV1(BACKSTOP_IDS[poolMeta?.version ?? Version.V1]);
  const actionArgs: PoolBackstopActionArgs = {
    from: walletAddress,
    pool_address: poolId,
    amount: q4w.amount,
  };
  // the BackstopQueueMod sets the expiration for unlocked withdrawals to 0
  // user can take an action if the Q4W has unlocked or if they can unqueue the entry
  const enabled = q4w.exp === BigInt(0) || canUnqueue;
  const sim_op =
    q4w.exp === BigInt(0) ? backstop.withdraw(actionArgs) : backstop.dequeueWithdrawal(actionArgs);
  const { data: simResult, isLoading, refetch: refetchSim } = useSimulateOperation(sim_op, enabled);
  const isRestore =
    isLoading === false && simResult !== undefined && rpc.Api.isSimulationRestore(simResult);

  const TOTAL_QUEUE_TIME_SECONDS = version === Version.V1 ? 21 * 24 * 60 * 60 : 17 * 24 * 60 * 60;

  const now = useCurrentTimestamp();
  const timeLeft =
    q4w.exp === BigInt(0) ? 0 : now === undefined ? undefined : Math.max(0, Number(q4w.exp) - now);
  const timeWaitedPercentage =
    timeLeft === undefined ? 0 : Math.min(1, 1 - timeLeft / TOTAL_QUEUE_TIME_SECONDS);

  const handleClick = async () => {
    if (connected && poolMeta) {
      if (timeLeft === undefined) return;
      if (timeLeft > 0) {
        await backstopDequeueWithdrawal(poolMeta, actionArgs, false);
      } else {
        await backstopWithdraw(poolMeta, actionArgs, false);
      }
    }
  };

  const handleRestore = async () => {
    if (simResult && rpc.Api.isSimulationRestore(simResult)) {
      await restore(simResult);
      refetchSim();
    }
  };

  const queueItemActionButton = (sx: SxProps<Theme>) => {
    const needsTooltip = !enabled || isRestore;
    const tooltipMessage = !enabled
      ? isV2Contracts(version)
        ? 'You can only unqueue the most recent withdrawal'
        : 'You can only unqueue the oldest withdrawal'
      : 'This transaction ran into expired entries which need to be restored before proceeding.';

    return needsTooltip ? (
      <Tooltip
        title={tooltipMessage}
        placement="top"
        enterTouchDelay={0}
        enterDelay={500}
        leaveTouchDelay={3000}
      >
        <Box sx={sx}>
          {isRestore ? (
            <OpaqueButton
              onClick={() => handleRestore()}
              palette={theme.palette.warning}
              disabled={false}
              sx={{ width: '100%' }}
            >
              Restore
            </OpaqueButton>
          ) : (
            <OpaqueButton
              onClick={() => handleClick()}
              palette={theme.palette.positive}
              disabled={!enabled || timeLeft === undefined}
              sx={{ width: '100%' }}
            >
              {timeLeft === undefined ? 'Loading...' : timeLeft > 0 ? 'Unqueue' : 'Withdraw'}
            </OpaqueButton>
          )}
        </Box>
      </Tooltip>
    ) : (
      <OpaqueButton
        onClick={() => handleClick()}
        palette={theme.palette.positive}
        disabled={!enabled || timeLeft === undefined}
        sx={sx}
      >
        {timeLeft === undefined ? 'Loading...' : timeLeft > 0 ? 'Unqueue' : 'Withdraw'}
      </OpaqueButton>
    );
  };

  return (
    <>
      <Row>
        <Box sx={{ margin: '6px', padding: '6px', display: 'flex', alignItems: 'center' }}>
          {timeLeft === undefined || timeLeft > 0 ? (
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
                  position: 'absolte',
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
                  position: 'absolute',
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
          <Icon
            src={`/icons/tokens/blndusdclp.svg`}
            alt={`blndusdclp`}
            sx={{ height: '30px', width: '30px', marginRight: '12px' }}
          />
          <Box>
            <Box sx={{ display: 'flex', flexDirection: 'row' }}>
              <Typography variant="h4" sx={{ marginRight: '6px' }}>
                {toBalance(inTokens)}
              </Typography>
              <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
                BLND-USDC LP
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ marginRight: '6px' }}>
              {timeLeft === undefined
                ? 'Loading...'
                : timeLeft > 0
                ? toTimeSpan(timeLeft)
                : 'Unlocked'}
            </Typography>
          </Box>
        </Box>
        {viewType === ViewType.REGULAR &&
          queueItemActionButton({ height: '35px', width: '108px', margin: '12px' })}
      </Row>
      {viewType !== ViewType.REGULAR && (
        <Row>{queueItemActionButton({ height: '35px', width: '100%', margin: '12px' })}</Row>
      )}
    </>
  );
};
