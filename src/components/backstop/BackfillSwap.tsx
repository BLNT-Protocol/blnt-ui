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
import {
  BLNT_BACKFILL_ID,
  buildRefundBlntForBlndOperation,
  buildSwapBlndForBlntOperation,
} from '../../utils/blnt_backfill';
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

export type BackfillSwapMode = 'swap' | 'refund';

function parseAmount(input: string): bigint | undefined {
  if (!/^(?:\d+(?:\.\d{0,7})?|\.\d{1,7})$/.test(input)) return undefined;
  try {
    return scaleInputToBigInt(input, TOKEN_DECIMALS);
  } catch {
    return undefined;
  }
}

export const BackfillSwap: React.FC<{ mode: BackfillSwapMode }> = ({ mode }) => {
  const theme = useTheme();
  const { viewType } = useSettings();
  const {
    connected,
    walletAddress,
    backfillSwapBlndForBlnt,
    backfillRefundBlntForBlnd,
    createTrustlines,
    clearLastTx,
    restore,
    txStatus,
    txType,
    isLoading,
  } = useWallet();
  const { data: account, refetch: refetchAccount } = useHorizonAccount();
  const { data: swapState, refetch: refetchSwapState } = useBackfillSwapState(walletAddress);
  const { data: blndBalance } = useTokenBalance(
    swapState?.legacyBlndToken,
    BLND_ASSET,
    account
  );
  const { data: blntBalance } = useTokenBalance(swapState?.blntToken, BLNT_ASSET, account);
  const [amount, setAmount] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const debouncedAmount = useDebouncedState(amount, RPC_DEBOUNCE_DELAY, txType);
  const requestedAmount = parseAmount(amount);
  const debouncedRequestedAmount = parseAmount(debouncedAmount);
  const isSwap = mode === 'swap';
  const inputSymbol = isSwap ? 'BLND' : 'BLNT';
  const outputSymbol = isSwap ? 'BLNT' : 'BLND';
  const outputAsset = isSwap ? BLNT_ASSET : BLND_ASSET;
  const inputBalance = connected ? (isSwap ? blndBalance : blntBalance) ?? BigInt(0) : BigInt(0);
  const laneLimit = isSwap
    ? swapState?.remainingCapacity ?? BigInt(0)
    : swapState?.refundable ?? BigInt(0);
  const maxAmount = inputBalance < laneLimit ? inputBalance : laneLimit;
  const expired = swapState !== undefined && swapState.ledgerCloseTime >= swapState.swapDeadline;
  const needsOutputTrustline =
    connected && account !== undefined && requiresTrustline(account, outputAsset);
  const showTrustlineAction = needsOutputTrustline && !expired;
  const canSimulate =
    connected &&
    account !== undefined &&
    !needsOutputTrustline &&
    !expired &&
    swapState !== undefined &&
    debouncedRequestedAmount !== undefined &&
    debouncedRequestedAmount > BigInt(0) &&
    debouncedRequestedAmount <= inputBalance &&
    debouncedRequestedAmount <= laneLimit;
  const operation =
    canSimulate && walletAddress !== ''
      ? (isSwap ? buildSwapBlndForBlntOperation : buildRefundBlntForBlndOperation)(
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
          const loadedBalance = isSwap ? blndBalance : blntBalance;
          if (swapState === undefined || account === undefined || loadedBalance === undefined) {
            return {
              isError: true,
              isSubmitDisabled: true,
              reason: `Loading ${inputSymbol} conversion details...`,
              disabledType: 'info',
            };
          }
          if (expired) {
            return {
              isError: true,
              isSubmitDisabled: true,
              reason: 'The BLND-to-BLNT conversion and refund window has closed.',
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
          if (requestedAmount > loadedBalance) {
            return {
              isError: true,
              isSubmitDisabled: true,
              reason: `The amount exceeds your available ${inputSymbol} balance.`,
              disabledType: 'warning',
            };
          }
          if (requestedAmount > laneLimit) {
            return {
              isError: true,
              isSubmitDisabled: true,
              reason: isSwap
                ? 'The amount exceeds the remaining BLND-to-BLNT swap capacity.'
                : 'The amount exceeds your refundable BLND credit.',
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
      blntBalance,
      connected,
      expired,
      inputSymbol,
      isDebouncing,
      isSimulationLoading,
      isSwap,
      laneLimit,
      requestedAmount,
      simulation,
      swapState,
    ]
  );

  useEffect(() => setAmount(''), [mode]);

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
      await createTrustlines([outputAsset]);
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
    if (isSwap) {
      await backfillSwapBlndForBlnt(walletAddress, requestedAmount, false);
    } else {
      await backfillRefundBlntForBlnd(walletAddress, requestedAmount, false);
    }
  };

  const deadline =
    swapState === undefined
      ? '--'
      : new Date(Number(swapState.swapDeadline) * 1000).toISOString().split('T')[0];
  const actionLabel = showTrustlineAction
    ? `Add ${outputSymbol} Trustline`
    : isRestore
    ? 'Restore Data'
    : expired
    ? `${isSwap ? 'Swap' : 'Refund'} unavailable`
    : isSwap
    ? 'Swap'
    : 'Refund';
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
            <Typography variant="body2">Available {inputSymbol}</Typography>
            <Typography variant="h4">
              {toBalance(inputBalance, TOKEN_DECIMALS)} {inputSymbol}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              gap: '12px',
              flexDirection: viewType === ViewType.MOBILE ? 'column' : 'row',
            }}
          >
            <InputBar
              symbol={inputSymbol}
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
                You receive {toBalance(requestedAmount ?? BigInt(0), TOKEN_DECIMALS)}{' '}
                {outputSymbol}
              </Typography>
              <Typography variant="h5" sx={{ color: theme.palette.text.secondary }}>
                1 BLND = 1 BLNT · Window closes: {deadline}
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
