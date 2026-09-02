import {
  BackstopPoolV3,
  ContractErrorType,
  parseError,
  PoolClaimArgs,
  PoolContractV1,
  PositionsEstimate,
  Version,
} from '@blend-capital/blend-sdk';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box, SxProps, Theme, Typography, useTheme } from '@mui/material';
import { rpc } from '@stellar/stellar-sdk';
import { useSettings, ViewType } from '../../contexts';
import { useWallet } from '../../contexts/wallet';
import {
  useBackstopPool,
  useHorizonAccount,
  usePool,
  usePoolMeta,
  usePoolOracle,
  usePoolUser,
  useSimulateOperation,
} from '../../hooks/api';
import { toBalance, toPercentage } from '../../utils/formatter';
import { requiresTrustline } from '../../utils/horizon';
import { BLND_ASSET, BLNT_ASSET } from '../../utils/token_display';
import { CustomButton } from '../common/CustomButton';
import { FlameIcon } from '../common/FlameIcon';
import { Icon } from '../common/Icon';
import { PoolComponentProps } from '../common/PoolComponentProps';
import { Row } from '../common/Row';
import { Skeleton } from '../common/Skeleton';
import { StackedText } from '../common/StackedText';
import { BorrowCapRing } from './BorrowCapRing';

export const PositionOverview: React.FC<PoolComponentProps> = ({ poolId }) => {
  const { viewType } = useSettings();
  const theme = useTheme();
  const { connected, walletAddress, poolClaim, createTrustlines, restore } = useWallet();

  const { data: poolMeta } = usePoolMeta(poolId);
  const isV3 = poolMeta?.version === Version.V3;
  const emissionsAsset = isV3 ? BLNT_ASSET : BLND_ASSET;
  const { data: loadedBackstopPool } = useBackstopPool(poolMeta, isV3);
  const backstopPoolV3 =
    loadedBackstopPool instanceof BackstopPoolV3 ? loadedBackstopPool : undefined;
  const showPoolEmissionsClaim =
    !isV3 ||
    (backstopPoolV3?.configuredTiers.some(
      (tier) => backstopPoolV3.tier(tier).data.blnt_emission_eligible
    ) ?? false);
  const { data: account, refetch: refechAccount } = useHorizonAccount();
  const { data: pool } = usePool(poolMeta);
  const { data: poolOracle } = usePoolOracle(pool);
  const { data: userPoolData, refetch: refetchPoolUser } = usePoolUser(pool);

  const { emissions, claimedTokens } =
    userPoolData && pool
      ? userPoolData.estimateEmissions(Array.from(pool.reserves.values()))
      : { emissions: 0, claimedTokens: [] };

  const poolContract = poolId ? new PoolContractV1(poolId) : undefined;
  const claimArgs: PoolClaimArgs = {
    from: walletAddress,
    reserve_token_ids: claimedTokens,
    to: walletAddress,
  };
  const sim_op = poolContract && walletAddress !== '' ? poolContract.claim(claimArgs) : '';
  const {
    data: simResult,
    isLoading,
    refetch: refetchSim,
  } = useSimulateOperation(
    sim_op,
    showPoolEmissionsClaim && claimedTokens.length > 0 && sim_op !== '' && connected
  );

  if (pool === undefined || userPoolData === undefined) {
    return <Skeleton />;
  }

  const hasEmissionsTrustline = !requiresTrustline(account, emissionsAsset);
  const isRestore =
    isLoading === false && simResult !== undefined && rpc.Api.isSimulationRestore(simResult);
  const isError =
    isLoading === false && simResult !== undefined && rpc.Api.isSimulationError(simResult);

  const userEst = poolOracle
    ? PositionsEstimate.build(pool, poolOracle, userPoolData.positions)
    : undefined;
  const handleSubmitTransaction = async () => {
    if (connected && poolMeta && userPoolData) {
      if (claimedTokens.length > 0) {
        let claimArgs: PoolClaimArgs = {
          from: walletAddress,
          reserve_token_ids: claimedTokens,
          to: walletAddress,
        };
        await poolClaim(poolMeta, claimArgs, false);
        refetchPoolUser();
      }
    }
  };

  async function handleCreateTrustlineClick() {
    if (connected) {
      await createTrustlines([emissionsAsset]);
      refechAccount();
    }
  }

  const handleRestore = async () => {
    if (simResult && rpc.Api.isSimulationRestore(simResult)) {
      await restore(simResult);
      refetchSim();
    }
  };

  function renderClaimButton() {
    if (hasEmissionsTrustline && !isRestore && !isError) {
      return (
        <CustomButton
          sx={{
            width: '100%',
            padding: '12px',
            color: theme.palette.text.primary,
            backgroundColor: theme.palette.background.paper,
            '&:hover': {
              color: theme.palette.primary.main,
            },
          }}
          onClick={handleSubmitTransaction}
        >
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
            <FlameIcon />
            <StackedText
              title="Claim Pool Emissions"
              titleColor="inherit"
              text={`${toBalance(emissions)} ${emissionsAsset.code}`}
              textColor="inherit"
              type="large"
            />
          </Box>
          <ArrowForwardIcon fontSize="inherit" />
        </CustomButton>
      );
    } else {
      let buttonText = '';
      let onClick = undefined;
      if (isRestore) {
        buttonText = 'Restore Data';
        onClick = handleRestore;
      } else if (!hasEmissionsTrustline) {
        buttonText = `Add ${emissionsAsset.code} Trustline`;
        onClick = handleCreateTrustlineClick;
      } else if (isError) {
        const claimError = parseError(simResult);
        buttonText = `Error checking claim: ${ContractErrorType[claimError.type]}`;
      }
      return (
        <Box sx={{ width: '100%' }}>
          <CustomButton
            sx={{
              width: '100%',
              padding: '12px',
              color: theme.palette.text.primary,
              backgroundColor: theme.palette.background.paper,
              '&:hover': {
                color: theme.palette.warning.main,
              },
            }}
            onClick={onClick}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Box
                sx={{
                  borderRadius: '50%',
                  backgroundColor: theme.palette.warning.opaque,
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Icon
                  alt="BLND Token Icon"
                  src="/icons/tokens/blnd-yellow.svg"
                  height="24px"
                  width="18px"
                  isCircle={false}
                />
              </Box>
              <StackedText
                title="Claim Pool Emissions"
                titleColor="inherit"
                text={buttonText}
                textColor="inherit"
                type="large"
              />
            </Box>
            <ArrowForwardIcon fontSize="inherit" />
          </CustomButton>
        </Box>
      );
    }
  }

  const isRegularViewType = viewType === ViewType.REGULAR;
  const rowSX: SxProps<Theme> = isRegularViewType
    ? { padding: '0px 12px' }
    : {
        display: 'flex',
        flexDirection: 'column',
        padding: '0px 12px',
        gap: '12px',
        alignItems: 'center',
      };
  return (
    <Row sx={rowSX}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          width: isRegularViewType && showPoolEmissionsClaim ? '50%' : '100%',
          justifyContent: isRegularViewType ? undefined : 'space-between',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            width: '110px',
          }}
        >
          <StackedText
            title="Net APY"
            titleColor="inherit"
            text={toPercentage(userEst?.netApy)}
            textColor="inherit"
            type="large"
          />
          <Icon
            src={'/icons/dashboard/net_apr.svg'}
            alt={`backstop size icon`}
            isCircle={false}
            sx={{ marginLeft: '18px' }}
          />
        </Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginLeft: isRegularViewType ? '50px' : '18px',
          }}
        >
          <StackedText
            title="Borrow Capacity"
            titleColor="inherit"
            text={`$${toBalance(userEst?.borrowCap)}`}
            textColor="inherit"
            type="large"
          />
          <BorrowCapRing borrowLimit={userEst?.borrowLimit} />
        </Box>
      </Box>
      {showPoolEmissionsClaim && (
        <Box sx={{ width: isRegularViewType ? '45%' : '100%', display: 'flex' }}>
          {renderClaimButton()}
        </Box>
      )}
    </Row>
  );
};
