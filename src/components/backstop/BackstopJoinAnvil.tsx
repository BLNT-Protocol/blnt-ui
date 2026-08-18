import { BackstopTierV3, Version, parseResult } from '@blend-capital/blend-sdk';
import { LoopOutlined } from '@mui/icons-material';
import { Box, Typography, useTheme } from '@mui/material';
import { Asset, rpc, scValToBigInt, xdr } from '@stellar/stellar-sdk';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { ViewType, useSettings } from '../../contexts';
import { TxStatus, TxType, useWallet } from '../../contexts/wallet';
import { useHorizonAccount, useManagedBackstopToken, useTokenBalance } from '../../hooks/api';
import { RPC_DEBOUNCE_DELAY, useDebouncedState } from '../../hooks/debounce';
import { PoolMeta } from '../../hooks/types';
import { estJoinPool, estLPTokenViaJoin } from '../../utils/comet';
import { toBalance } from '../../utils/formatter';
import { scaleInputToBigInt } from '../../utils/scval';
import { BLND_ASSET, USDC_ASSET } from '../../utils/token_display';
import { SubmitError, getErrorFromSim } from '../../utils/txSim';
import { AnvilAlert } from '../common/AnvilAlert';
import { InputBar } from '../common/InputBar';
import { InputButton } from '../common/InputButton';
import { OpaqueButton } from '../common/OpaqueButton';
import { Row } from '../common/Row';
import { Section, SectionSize } from '../common/Section';
import { Skeleton } from '../common/Skeleton';
import { TxFeeSelector } from '../common/TxFeeSelector';
import { TxOverview } from '../common/TxOverview';
import { Value } from '../common/Value';
import { ValueChange } from '../common/ValueChange';

export const BackstopJoinAnvil: React.FC<{
  tier?: BackstopTierV3;
  version?: Version;
  poolMeta?: PoolMeta;
}> = ({ tier, version, poolMeta }) => {
  const theme = useTheme();
  const { viewType } = useSettings();
  const {
    walletAddress,
    txStatus,
    cometSingleSidedDeposit,
    cometJoin,
    txType,
    isLoading,
    txInclusionFee,
  } = useWallet();

  const { backstopToken, blndTokenId, cometPoolId, lpSymbol, pairSymbol, pairTokenId } =
    useManagedBackstopToken(tier, version, poolMeta);
  const pairAsset = pairSymbol === 'XLM' ? Asset.native() : USDC_ASSET;
  const { data: horizonAccount } = useHorizonAccount();
  const { data: blndBalanceRes } = useTokenBalance(blndTokenId, BLND_ASSET, horizonAccount);
  const { data: usdcBalanceRes } = useTokenBalance(pairTokenId, pairAsset, horizonAccount);
  const { data: lpBalanceRes } = useTokenBalance(cometPoolId, undefined, horizonAccount);

  const [currentToken, setCurrentToken] = useState<{
    address: string | undefined;
    symbol: string;
  }>({ address: pairTokenId, symbol: pairSymbol });
  const [input, setInput] = useState<{ amount: string; slippage: string }>({
    amount: '',
    slippage: '1',
  });
  const [toMint, setToMint] = useState<number>(0);
  const [maxBLNDIn, setMaxBLNDIn] = useState<number>(0);
  const [maxUSDCIn, setMaxUSDCIn] = useState<number>(0);

  const [loadingEstimate, setLoadingEstimate] = useState<boolean>(false);
  const [simResponse, setSimResponse] = useState<rpc.Api.SimulateTransactionResponse>();
  const loading = isLoading || loadingEstimate;
  const decimals = 7;
  const isJoin = currentToken.symbol === lpSymbol;
  const validDecimals = (input.amount.split('.')[1]?.length ?? 0) <= decimals;

  const clearInputResultState = () => {
    setToMint(0);
    setMaxBLNDIn(0);
    setMaxUSDCIn(0);
    setSimResponse(undefined);
  };

  const handleSetInputAmount = (value: string) => {
    setInput({ amount: value, slippage: input.slippage });
  };

  const handleSetInputMaxSlippage = (value: string) => {
    setInput({ amount: input.amount, slippage: value });
  };

  const blndBalance = blndBalanceRes ?? BigInt(0);
  const usdcBalance = usdcBalanceRes ?? BigInt(0);
  const lpBalance = lpBalanceRes ?? BigInt(0);

  const curTokenBalance =
    currentToken.symbol === pairSymbol
      ? usdcBalance
      : currentToken.symbol === 'BLND'
      ? blndBalance
      : lpBalance;
  const maxBLNDDeposit = backstopToken ? backstopToken.blnd / BigInt(3) - BigInt(1) : BigInt(0);
  const maxUSDCDeposit = backstopToken ? backstopToken.usdc / BigInt(3) - BigInt(1) : BigInt(0);

  useEffect(() => {
    setCurrentToken({ address: pairTokenId, symbol: pairSymbol });
    setInput({ amount: '', slippage: '1' });
  }, [pairSymbol, pairTokenId]);

  /** run function on each state change */
  useDebouncedState(input, RPC_DEBOUNCE_DELAY, txType, handleInputChange);

  // verify that the user can act
  const { isSubmitDisabled, isMaxDisabled, reason, disabledType, isError, extraContent } =
    useMemo(() => {
      let errorProps: SubmitError = {
        isError: false,
        isSubmitDisabled: false,
        isMaxDisabled: false,
        reason: undefined,
        disabledType: undefined,
        extraContent: undefined,
      };
      let inputAsBigInt = BigInt(0);
      if (validDecimals) {
        inputAsBigInt = scaleInputToBigInt(input.amount, decimals);
      }
      if (!isJoin && curTokenBalance <= BigInt(0)) {
        errorProps.isSubmitDisabled = true;
        errorProps.isError = true;
        errorProps.isMaxDisabled = true;
        errorProps.reason = 'You do not have any available balance to mint.';
        errorProps.disabledType = 'warning';
      } else if (!isJoin && inputAsBigInt > curTokenBalance) {
        errorProps.isSubmitDisabled = true;
        errorProps.isError = true;
        errorProps.isMaxDisabled = false;
        errorProps.reason = 'You do not have enough available balance to mint.';
        errorProps.disabledType = 'warning';
      } else if (isNaN(Number(input.slippage))) {
        errorProps.isSubmitDisabled = true;
        errorProps.isError = true;
        errorProps.isMaxDisabled = false;
        errorProps.reason = 'Please enter a valid max slippage, as a percent.';
        errorProps.disabledType = 'warning';
      } else if (Number(input.slippage) < 0.1) {
        errorProps.isSubmitDisabled = true;
        errorProps.isError = true;
        errorProps.isMaxDisabled = false;
        errorProps.reason = 'Slippage must be at least 0.1%.';
        errorProps.disabledType = 'warning';
      } else if (Number(input.slippage) > 10.0) {
        errorProps.isSubmitDisabled = true;
        errorProps.isError = true;
        errorProps.isMaxDisabled = false;
        errorProps.reason = 'Slippage can be at most 10%';
        errorProps.disabledType = 'warning';
      } else if (currentToken.symbol === 'BLND' && inputAsBigInt > maxBLNDDeposit) {
        errorProps.isSubmitDisabled = true;
        errorProps.isError = true;
        errorProps.isMaxDisabled = true;
        errorProps.reason = `Cannot deposit more than a third of the pools token balance, estimated max deposit amount: ${toBalance(
          maxBLNDDeposit,
          decimals
        )}`;
        errorProps.disabledType = 'warning';
      } else if (currentToken.symbol === pairSymbol && inputAsBigInt > maxUSDCDeposit) {
        errorProps.isSubmitDisabled = true;
        errorProps.isError = true;
        errorProps.isMaxDisabled = true;
        errorProps.reason = `Cannot deposit more than a third of the pools token balance, estimated max deposit amount: ${toBalance(
          maxUSDCDeposit,
          decimals
        )}`;
        errorProps.disabledType = 'warning';
      } else if (
        isJoin &&
        (maxBLNDIn > Number(blndBalance) / 1e7 || maxUSDCIn > Number(usdcBalance) / 1e7)
      ) {
        errorProps.isSubmitDisabled = true;
        errorProps.isError = true;
        errorProps.isMaxDisabled = true;
        errorProps.reason = `You do not have enough tokens to mint the requested amount. You need ${toBalance(
          maxBLNDIn
        )} BLND and ${toBalance(maxUSDCIn)} ${pairSymbol}.`;
        errorProps.disabledType = 'warning';
      }
      if (errorProps.isError) {
        return errorProps;
      } else {
        return getErrorFromSim(input.amount, decimals, loading, simResponse);
      }
    }, [
      input,
      currentToken.symbol,
      blndBalance,
      usdcBalance,
      loadingEstimate,
      simResponse,
      maxUSDCDeposit,
      maxBLNDDeposit,
      pairSymbol,
    ]);

  if (backstopToken === undefined || cometPoolId === '') {
    return <Skeleton />;
  }

  if (txStatus === TxStatus.SUCCESS && txType === TxType.CONTRACT && input.amount !== '') {
    handleSetInputAmount('');
    clearInputResultState();
  }

  const handleMaxClick = () => {
    if (!isJoin) {
      let max = curTokenBalance;
      if (currentToken.symbol === 'BLND' && curTokenBalance > maxBLNDDeposit) {
        max = maxBLNDDeposit;
      } else if (currentToken.symbol === pairSymbol && curTokenBalance > maxUSDCDeposit) {
        max = maxUSDCDeposit;
      }
      setLoadingEstimate(true);
      handleSetInputAmount((Number(max) / 10 ** decimals).toFixed(decimals));
    } else if (backstopToken) {
      const slippageAsNum = Number(input.slippage) / 100;
      if (slippageAsNum > 0 && slippageAsNum <= 0.1) {
        let est_max_join = estLPTokenViaJoin(
          backstopToken,
          blndBalance,
          usdcBalance,
          slippageAsNum
        );
        setLoadingEstimate(true);
        handleSetInputAmount(est_max_join.toFixed(7));
      }
    }
  };

  async function handleInputChange({ amount, slippage }: { amount: string; slippage: string }) {
    setLoadingEstimate(true);
    clearInputResultState();
    const validDecimals = (amount.split('.')[1]?.length ?? 0) <= decimals;
    if (validDecimals && currentToken.address && cometPoolId && backstopToken && walletAddress) {
      const inputAsBigInt = scaleInputToBigInt(amount, decimals);
      const slippageAsNum = Number(slippage) / 100;
      if (
        !isJoin &&
        inputAsBigInt <= curTokenBalance &&
        ((currentToken.symbol === 'BLND' && inputAsBigInt <= maxBLNDDeposit) ||
          (currentToken.symbol === pairSymbol && inputAsBigInt <= maxUSDCDeposit))
      ) {
        cometSingleSidedDeposit(
          cometPoolId,
          {
            depositTokenAddress: currentToken.address,
            depositTokenAmount: inputAsBigInt,
            minLPTokenAmount: BigInt(0),
            user: walletAddress,
          },
          true
        )
          .then((sim: rpc.Api.SimulateTransactionResponse | undefined) => {
            if (sim === undefined) {
              return;
            }
            setSimResponse(sim);
            if (rpc.Api.isSimulationSuccess(sim)) {
              let result = parseResult(sim, (xdrString: string) => {
                return scValToBigInt(xdr.ScVal.fromXDR(xdrString, 'base64'));
              });
              let resultAsNumber = Number(result ?? 0) / 10 ** decimals;
              let toMintMin = resultAsNumber - resultAsNumber * slippageAsNum;
              setToMint(toMintMin);
            }
          })
          .catch((e) => {
            console.log('Failed to simulate single sided deposit transaction.');
            console.error(e);
          });
      } else if (isJoin && validDecimals) {
        let { blnd, usdc } = estJoinPool(backstopToken, inputAsBigInt, slippageAsNum);
        setMaxBLNDIn(blnd);
        setMaxUSDCIn(usdc);
        if (blnd < Number(blndBalance) / 1e7 && usdc < Number(usdcBalance) / 1e7) {
          cometJoin(
            cometPoolId,
            {
              user: walletAddress,
              poolAmount: inputAsBigInt,
              blndLimitAmount: BigInt(Math.floor(blnd * 10 ** decimals)),
              usdcLimitAmount: BigInt(Math.floor(usdc * 10 ** decimals)),
            },
            true
          )
            .then((sim: rpc.Api.SimulateTransactionResponse | undefined) => {
              setSimResponse(sim);
            })
            .catch((e) => {
              console.log('Failed to simulate join transaction.');
              console.error(e);
            });
        }
      }
    }
    setLoadingEstimate(false);
  }

  async function handleSubmitDeposit() {
    if (validDecimals && cometPoolId && currentToken.address) {
      await cometSingleSidedDeposit(
        cometPoolId,
        {
          depositTokenAddress: currentToken.address,
          depositTokenAmount: scaleInputToBigInt(input.amount, decimals),
          minLPTokenAmount: BigInt(Math.floor(toMint * 10 ** decimals)),
          user: walletAddress,
        },
        false
      );
    }
  }

  async function handleSubmitJoin() {
    if (validDecimals && cometPoolId) {
      await cometJoin(
        cometPoolId,
        {
          user: walletAddress,
          poolAmount: scaleInputToBigInt(input.amount, decimals),
          blndLimitAmount: BigInt(Math.floor(maxBLNDIn * 10 ** decimals)),
          usdcLimitAmount: BigInt(Math.floor(maxUSDCIn * 10 ** decimals)),
        },
        false
      );
    }
  }

  function handleSwitchToken() {
    if (backstopToken) {
      handleSetInputAmount('');
      clearInputResultState();
      if (currentToken.symbol === pairSymbol) {
        setCurrentToken({
          address: blndTokenId,
          symbol: 'BLND',
        });
      } else if (currentToken.symbol === 'BLND') {
        setCurrentToken({
          address: cometPoolId,
          symbol: lpSymbol,
        });
      } else {
        setCurrentToken({
          address: pairTokenId,
          symbol: pairSymbol,
        });
      }
    }
  }

  const inputInUSDC =
    pairSymbol === 'USDC'
      ? isJoin
        ? Number(input.amount) * backstopToken.lpTokenPrice
        : currentToken.symbol === 'BLND'
        ? Number(input.amount) *
          (Number(backstopToken.usdc) / 0.2 / (Number(backstopToken.blnd) / 0.8))
        : Number(input.amount)
      : undefined;

  return (
    <Row>
      <Section
        width={SectionSize.FULL}
        sx={{ padding: '0px', display: 'flex', flexDirection: 'column' }}
      >
        <Box
          sx={{
            background: theme.palette.backstop.opaque,
            width: '100%',
            borderRadius: '5px',
            padding: '12px',
            marginBottom: '12px',
            boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
          }}
        >
          <Typography variant="body2" sx={{ marginLeft: '12px', marginBottom: '12px' }}>
            {`Amount to ${isJoin ? 'mint' : 'deposit'}`}
          </Typography>
          <Box
            sx={{
              width: '100%',
              height: 'max-content',
              display: 'flex',
              gap: '12px',
              flexDirection: viewType === ViewType.MOBILE ? 'column' : 'row',
              marginBottom: '12px',
              alignItems: 'end',
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: 'max-content',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <InputBar
                symbol={currentToken.symbol}
                value={input.amount}
                onValueChange={(v) => {
                  handleSetInputAmount(v);
                  setLoadingEstimate(true);
                }}
                palette={theme.palette.backstop}
                sx={{ width: '100%' }}
              >
                <Box
                  sx={{
                    color: theme.palette.backstop.main,
                    backgroundColor: theme.palette.backstop.opaque,
                    borderRadius: '20%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    marginLeft: '6px',
                    width: '28px',
                    height: '28px',
                    cursor: 'pointer',
                  }}
                  onClick={handleSwitchToken}
                >
                  <LoopOutlined />
                </Box>
                <InputButton
                  palette={theme.palette.backstop}
                  onClick={handleMaxClick}
                  disabled={isMaxDisabled}
                  text="MAX"
                />
              </InputBar>
            </Box>
          </Box>
          <Typography variant="body2" sx={{ marginLeft: '12px', marginBottom: '12px' }}>
            {`Max Slippage`}
          </Typography>
          <Box
            sx={{
              width: '100%',
              height: 'max-content',
              display: 'flex',
              gap: '12px',
              flexDirection: viewType === ViewType.MOBILE ? 'column' : 'row',
              marginBottom: '12px',
              alignItems: 'end',
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: 'max-content',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <InputBar
                symbol={'%'}
                value={input.slippage}
                onValueChange={(v) => {
                  handleSetInputMaxSlippage(v);
                  setLoadingEstimate(true);
                }}
                palette={theme.palette.backstop}
                sx={{ width: '100%' }}
              >
                <InputButton
                  palette={theme.palette.backstop}
                  onClick={() => handleSetInputMaxSlippage('0.5')}
                  disabled={false}
                  text="0.5%"
                />
                <InputButton
                  palette={theme.palette.backstop}
                  onClick={() => handleSetInputMaxSlippage('1')}
                  disabled={false}
                  text="1%"
                />
                <InputButton
                  palette={theme.palette.backstop}
                  onClick={() => handleSetInputMaxSlippage('2')}
                  disabled={false}
                  text="2%"
                />
              </InputBar>
            </Box>
          </Box>
          <Box
            sx={{
              marginLeft: '12px',
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            {inputInUSDC !== undefined ? (
              <Typography variant="h5" sx={{ color: theme.palette.text.secondary }}>
                {`$${toBalance(inputInUSDC)}`}
              </Typography>
            ) : (
              <Box />
            )}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'flex-start',
              }}
            >
              <TxFeeSelector />
              <OpaqueButton
                onClick={isJoin ? handleSubmitJoin : handleSubmitDeposit}
                palette={theme.palette.backstop}
                sx={{
                  minWidth: '108px',
                  padding: '6px',
                  height: 'max-content',
                }}
                disabled={isSubmitDisabled}
              >
                Join
              </OpaqueButton>
            </Box>
          </Box>
        </Box>
        {!isError && (
          <TxOverview>
            <>
              {' '}
              {isJoin ? (
                <Value title="Amount to mint" value={`${input.amount ?? '0'} ${lpSymbol}`} />
              ) : (
                <Value
                  title="Amount to deposit"
                  value={`${input.amount ?? '0'} ${currentToken.symbol}`}
                />
              )}
              <Value
                title={
                  <>
                    <Image src="/icons/dashboard/gascan.svg" alt="blend" width={20} height={20} />{' '}
                    Gas
                  </>
                }
                value={`${toBalance(
                  BigInt((simResponse as any)?.minResourceFee ?? 0) + BigInt(txInclusionFee.fee),
                  decimals
                )} XLM`}
              />
              {isJoin ? (
                <>
                  <Value title="Max BLND to deposit" value={`${toBalance(maxBLNDIn)} BLND`} />
                  <ValueChange
                    title="Your BLND tokens"
                    curValue={`${toBalance(blndBalance, 7)} BLND`}
                    newValue={`${toBalance(
                      blndBalance - BigInt(Math.floor(maxBLNDIn * 1e7)),
                      7
                    )} BLND`}
                  />
                  <Value
                    title={`Max ${pairSymbol} to deposit`}
                    value={`${toBalance(maxUSDCIn)} ${pairSymbol}`}
                  />
                  <ValueChange
                    title={`Your ${pairSymbol} tokens`}
                    curValue={`${toBalance(usdcBalance, 7)} ${pairSymbol}`}
                    newValue={`${toBalance(
                      usdcBalance - BigInt(Math.floor(maxUSDCIn * 1e7)),
                      7
                    )} ${pairSymbol}`}
                  />
                </>
              ) : (
                <>
                  <Value
                    title={`Min ${lpSymbol} tokens minted`}
                    value={`${toBalance(toMint)} ${lpSymbol}`}
                  />
                  <ValueChange
                    title="Your LP tokens"
                    curValue={`${toBalance(lpBalance, 7)} ${lpSymbol}`}
                    newValue={`${toBalance(
                      lpBalance + BigInt(Math.floor(toMint * 1e7)),
                      7
                    )} ${lpSymbol}`}
                  />
                </>
              )}
            </>
          </TxOverview>
        )}
        {isError && (
          <AnvilAlert severity={disabledType} message={reason} extraContent={extraContent} />
        )}
      </Section>
    </Row>
  );
};
