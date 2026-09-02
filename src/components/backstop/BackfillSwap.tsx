import { Box, Typography, useTheme } from '@mui/material';
import { rpc } from '@stellar/stellar-sdk';
import { useEffect, useMemo, useState } from 'react';
import { useSettings, ViewType } from '../../contexts';
import { TxStatus, TxType, useWallet } from '../../contexts/wallet';
import {
  useBackfillSwapState,
  useHorizonAccount,
  useSimulateOperation,
  useTokenBalance,
} from '../../hooks/api';
import { RPC_DEBOUNCE_DELAY, useDebouncedState } from '../../hooks/debounce';
import { BLNT_BACKFILL_ID, buildSwapBlndForBlntOperation } from '../../utils/blnt_backfill';
import { toBalance } from '../../utils/formatter';
import { requiresTrustline } from '../../utils/horizon';
import { bigintToInput, scaleInputToBigInt } from '../../utils/scval';
import { BLND_ASSET, BLNT_ASSET } from '../../utils/token_display';
import { getErrorFromSim } from '../../utils/txSim';
import { AnvilAlert } from '../common/AnvilAlert';
import { InputBar } from '../common/InputBar';
import { InputButton } from '../common/InputButton';
import { OpaqueButton } from '../common/OpaqueButton';
import { Row } from '../common/Row';
import { Section, SectionSize } from '../common/Section';
import { TxFeeSelector } from '../common/TxFeeSelector';

const TOKEN_DECIMALS = 7;
const BLND_PER_BLNT = BigInt(2);

function parseAmount(input: string): bigint | undefined {
  if (!/^(?:\d+(?:\.\d{0,7})?|\.\d{1,7})$/.test(input)) return undefined;
  try {
    return scaleInputToBigInt(input, TOKEN_DECIMALS);
  } catch {
    return undefined;
  }
}

export const BackfillSwap: React.FC = () => {
  const theme = useTheme();
  const { viewType } = useSettings();
  const {
    connected,
    walletAddress,
    backfillSwapBlndForBlnt,
    createTrustlines,
    clearLastTx,
    restore,
    txStatus,
    txType,
    isLoading,
  } = useWallet();
  const { data: account, refetch: refetchAccount } = useHorizonAccount();
  const { data: swapState, refetch: refetchSwapState } = useBackfillSwapState();
  const { data: blndBalance } = useTokenBalance(swapState?.legacyBlndToken, BLND_ASSET, account);
  const [amount, setAmount] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const debouncedAmount = useDebouncedState(amount, RPC_DEBOUNCE_DELAY, txType);
  const requestedAmount = parseAmount(amount);
  const debouncedRequestedAmount = parseAmount(debouncedAmount);
  const requestedBlnd = requestedAmount === undefined ? undefined : requestedAmount * BLND_PER_BLNT;
  const debouncedRequestedBlnd =
    debouncedRequestedAmount === undefined ? undefined : debouncedRequestedAmount * BLND_PER_BLNT;
  const inputBalance = connected ? blndBalance ?? BigInt(0) : BigInt(0);
  const laneLimit = swapState?.remainingCapacity ?? BigInt(0);
  const balanceCapacity = inputBalance / BLND_PER_BLNT;
  const maxAmount = balanceCapacity < laneLimit ? balanceCapacity : laneLimit;
  const expired = swapState !== undefined && swapState.ledgerCloseTime >= swapState.swapDeadline;
  const needsOutputTrustline =
    connected && account !== undefined && requiresTrustline(account, BLNT_ASSET);
  const showTrustlineAction = needsOutputTrustline && !expired;
  const canSimulate =
    connected &&
    account !== undefined &&
    !needsOutputTrustline &&
    !expired &&
    swapState !== undefined &&
    debouncedRequestedAmount !== undefined &&
    debouncedRequestedBlnd !== undefined &&
    debouncedRequestedAmount > BigInt(0) &&
    debouncedRequestedBlnd <= inputBalance &&
    debouncedRequestedAmount <= laneLimit;
  const operation =
    canSimulate && walletAddress !== ''
      ? buildSwapBlndForBlntOperation(
          BLNT_BACKFILL_ID,
          walletAddress,
          debouncedRequestedAmount
        ).toXDR('base64')
      : '';
  const {
    data: simulation,
    isLoading: isSimulationLoading,
    refetch: refetchSimulation,
  } = useSimulateOperation(operation, operation !== '');
  const isRestore = simulation !== undefined && rpc.Api.isSimulationRestore(simulation);
  const isDebouncing = amount !== debouncedAmount;

  const { isSubmitDisabled, reason, disabledType, isError } = useMemo(
    () =>
      getErrorFromSim(
        amount,
        TOKEN_DECIMALS,
        isDebouncing || isSimulationLoading,
        simulation,
        () => {
          if (!connected) return {};
          if (swapState === undefined || account === undefined || blndBalance === undefined) {
            return {
              isError: true,
              isSubmitDisabled: true,
              reason: 'Loading BLND conversion details...',
              disabledType: 'info',
            };
          }
          if (expired) {
            return {
              isError: true,
              isSubmitDisabled: true,
              reason: 'The BLND-to-BLNT conversion window has closed.',
              disabledType: 'warning',
            };
          }
          if (requestedAmount === undefined || requestedAmount <= BigInt(0)) {
            return {
              isError: true,
              isSubmitDisabled: true,
              reason: 'Please enter an amount greater than zero.',
              disabledType: 'warning',
            };
          }
          if (requestedBlnd === undefined || requestedBlnd > blndBalance) {
            return {
              isError: true,
              isSubmitDisabled: true,
              reason: 'The conversion requires more BLND than your available balance.',
              disabledType: 'warning',
            };
          }
          if (requestedAmount > laneLimit) {
            return {
              isError: true,
              isSubmitDisabled: true,
              reason: 'The amount exceeds the remaining BLND-to-BLNT swap capacity.',
              disabledType: 'warning',
            };
          }
          return {};
        }
      ),
    [
      account,
      amount,
      blndBalance,
      connected,
      expired,
      isDebouncing,
      isSimulationLoading,
      laneLimit,
      requestedAmount,
      requestedBlnd,
      simulation,
      swapState,
    ]
  );

  useEffect(() => {
    if (!submitted) return;
    if (txStatus === TxStatus.SUCCESS && txType === TxType.CONTRACT) {
      setSubmitted(false);
      setAmount('');
      void Promise.all([refetchAccount(), refetchSwapState()]);
    } else if (txStatus === TxStatus.FAIL) {
      setSubmitted(false);
    }
  }, [refetchAccount, refetchSwapState, submitted, txStatus, txType]);

  const handleAction = async () => {
    if (!connected) return;
    if (showTrustlineAction) {
      await createTrustlines([BLNT_ASSET]);
      await refetchAccount();
      return;
    }
    if (isRestore) {
      await restore(simulation);
      await refetchSimulation();
      return;
    }
    if (requestedAmount === undefined || isSubmitDisabled) return;
    clearLastTx();
    setSubmitted(true);
    await backfillSwapBlndForBlnt(walletAddress, requestedAmount, false);
  };

  const deadline =
    swapState === undefined
      ? '--'
      : new Date(Number(swapState.swapDeadline) * 1000).toISOString().split('T')[0];
  const actionLabel = showTrustlineAction
    ? 'Add BLNT Trustline'
    : isRestore
    ? 'Restore Data'
    : expired
    ? 'Swap unavailable'
    : 'Swap';
  const actionDisabled =
    !connected ||
    swapState === undefined ||
    isLoading ||
    (!showTrustlineAction && !isRestore && isSubmitDisabled);

  return (
    <Row>
      <Section width={SectionSize.FULL} sx={{ padding: '12px', flexDirection: 'column' }}>
        <Box
          sx={{
            background: theme.palette.backstop.opaque,
            width: '100%',
            borderRadius: '5px',
            padding: '12px',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <Typography variant="body2">Available BLND</Typography>
            <Typography variant="h4">{toBalance(inputBalance, TOKEN_DECIMALS)} BLND</Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              gap: '12px',
              flexDirection: viewType === ViewType.MOBILE ? 'column' : 'row',
            }}
          >
            <InputBar
              symbol="BLNT"
              value={amount}
              onValueChange={setAmount}
              palette={theme.palette.backstop}
              sx={{ width: '100%' }}
            >
              <InputButton
                palette={theme.palette.backstop}
                onClick={() => setAmount(bigintToInput(maxAmount, TOKEN_DECIMALS))}
                disabled={!connected || maxAmount === BigInt(0) || expired}
                text="MAX"
              />
            </InputBar>
            <OpaqueButton
              onClick={handleAction}
              palette={theme.palette.backstop}
              sx={{ minWidth: '180px', padding: '6px' }}
              disabled={actionDisabled}
            >
              {actionLabel}
            </OpaqueButton>
          </Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              gap: '12px',
            }}
          >
            <Box>
              <Typography variant="body2">
                You pay {toBalance(requestedBlnd ?? BigInt(0), TOKEN_DECIMALS)} BLND and receive{' '}
                {toBalance(requestedAmount ?? BigInt(0), TOKEN_DECIMALS)} BLNT
              </Typography>
              <Typography variant="h5" sx={{ color: theme.palette.text.secondary }}>
                2 BLND = 1 BLNT · Window closes: {deadline}
              </Typography>
            </Box>
            <TxFeeSelector />
          </Box>
        </Box>
        {isError && !showTrustlineAction && !isRestore && (
          <AnvilAlert severity={disabledType} message={reason} />
        )}
      </Section>
    </Row>
  );
};
