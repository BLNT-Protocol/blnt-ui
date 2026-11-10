import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box, SxProps, Theme, Typography, useTheme } from '@mui/material';
import { rpc } from '@stellar/stellar-sdk';
import { useSettings, ViewType } from '../../contexts';
import { useWallet } from '../../contexts/wallet';
import {
  useBlntBackstopManagerHelperConfig,
  useBlntBackstopManagerHelperState,
  useSimulateOperation,
} from '../../hooks/api';
import {
  BLNT_BACKSTOP_MANAGER_HELPER_ID,
  buildBackstopManagerDepositAndClaimOperation,
} from '../../utils/blnt_backstop_manager_helper';
import { toBalance } from '../../utils/formatter';
import { CustomButton } from '../common/CustomButton';
import { Divider } from '../common/Divider';
import { FlameIcon } from '../common/FlameIcon';
import { Row } from '../common/Row';
import { StackedText } from '../common/StackedText';
import { TooltipText } from '../common/TooltipText';

const TOKEN_DECIMALS = 7;

/** Show the owner-only atomic YieldBlent manager route and its live before/after balances. */
export const YieldBlentBackstopManager: React.FC = () => {
  const theme = useTheme();
  const { viewType } = useSettings();
  const { connected, walletAddress, backstopManagerDepositAndClaim, restore } = useWallet();
  const { data: config } = useBlntBackstopManagerHelperConfig();
  const isOwner = config !== undefined && config.owner === walletAddress;
  const { data: state, refetch: refetchState } = useBlntBackstopManagerHelperState(config, isOwner);
  const hasBlnt = state !== undefined && state.blntBalance > BigInt(0);
  const operation =
    BLNT_BACKSTOP_MANAGER_HELPER_ID !== '' && isOwner
      ? buildBackstopManagerDepositAndClaimOperation(BLNT_BACKSTOP_MANAGER_HELPER_ID).toXDR(
          'base64'
        )
      : '';
  const {
    data: simulation,
    isLoading: simulationLoading,
    refetch: refetchSimulation,
  } = useSimulateOperation(operation, operation !== '' && hasBlnt);
  const isRestore = simulation !== undefined && rpc.Api.isSimulationRestore(simulation);
  const simulationSucceeded = simulation !== undefined && rpc.Api.isSimulationSuccess(simulation);

  if (!connected || !isOwner || state === undefined) return null;

  const formatToken = (amount: bigint) => `${toBalance(amount, TOKEN_DECIMALS)} BLNT`;
  const formatPosition = (amount: bigint, value: bigint, symbol: string) => (
    <Box>
      <Typography variant="h2">
        {toBalance(amount, TOKEN_DECIMALS)} {symbol}
      </Typography>
      <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
        ${toBalance(value, TOKEN_DECIMALS)}
      </Typography>
    </Box>
  );

  async function handleDepositAndClaim() {
    if (isRestore) {
      await restore(simulation);
    } else if (simulationSucceeded && hasBlnt) {
      await backstopManagerDepositAndClaim(false);
    } else {
      return;
    }
    await refetchState();
    await refetchSimulation();
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
    <>
      <Divider />
      <Box sx={{ margin: '0px 12px' }}>
        <Row>
          <Box sx={{ paddingLeft: '6px' }}>
            <Typography variant="h2" sx={{ padding: '6px' }}>
              YieldBlent backstop manager
            </Typography>
          </Box>
        </Row>
        <Row sx={rowSX}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: isRegularViewType ? '150px auto' : 'auto auto',
              columnGap: isRegularViewType ? '30px' : '18px',
              rowGap: '8px',
              alignItems: 'center',
              width: isRegularViewType ? '55%' : '100%',
            }}
          >
            <TooltipText
              tooltip="Loose BLNT currently held by the backstop manager. Deposit and Claim splits its available non-harvestable balance evenly across both tiers."
              width="auto"
              sx={{ justifyContent: 'flex-start', whiteSpace: 'nowrap' }}
            >
              Manager BLNT
            </TooltipText>
            <Typography variant="h2">{formatToken(state.blntBalance)}</Typography>
            <TooltipText
              tooltip="Current BLNT:XLM LP position in the YieldBlent FirstLoss tier, including queued shares."
              width="auto"
              sx={{ justifyContent: 'flex-start', whiteSpace: 'nowrap' }}
            >
              FirstLoss position
            </TooltipText>
            {formatPosition(state.firstLpTokens, state.firstValue, 'BLNT:XLM LP')}
            <TooltipText
              tooltip="Current BLNT:USDC LP position in the YieldBlent SecondLoss tier, including queued shares."
              width="auto"
              sx={{ justifyContent: 'flex-start', whiteSpace: 'nowrap' }}
            >
              SecondLoss position
            </TooltipText>
            {formatPosition(state.secondLpTokens, state.secondValue, 'BLNT:USDC LP')}
          </Box>
          <Box sx={{ width: isRegularViewType ? '40%' : '100%', display: 'flex' }}>
            <CustomButton
              disabled={simulationLoading || (!isRestore && (!hasBlnt || !simulationSucceeded))}
              sx={{
                width: '100%',
                padding: '12px',
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.background.paper,
                '&:hover': { color: theme.palette.primary.main },
              }}
              onClick={handleDepositAndClaim}
            >
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                <FlameIcon />
                <StackedText
                  title={isRestore ? 'Restore Data' : 'Deposit and Claim'}
                  titleColor="inherit"
                  text={formatToken(state.blntBalance)}
                  textColor="inherit"
                  type="large"
                />
              </Box>
              <ArrowForwardIcon fontSize="inherit" />
            </CustomButton>
          </Box>
        </Row>
      </Box>
    </>
  );
};
