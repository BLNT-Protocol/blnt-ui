import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box, SxProps, Theme, Typography, useTheme } from '@mui/material';
import { rpc } from '@stellar/stellar-sdk';
import { useSettings, ViewType } from '../../contexts';
import { useWallet } from '../../contexts/wallet';
import { useBackfillEmissions, useHorizonAccount, useSimulateOperation } from '../../hooks/api';
import {
  BLNT_BACKFILL_ID,
  buildClaimBackfillOperation,
  getBackfillAllocation,
} from '../../utils/blnt_backfill';
import { toBalance } from '../../utils/formatter';
import { requiresTrustline } from '../../utils/horizon';
import { BLNT_ASSET } from '../../utils/token_display';
import { CustomButton } from '../common/CustomButton';
import { FlameIcon } from '../common/FlameIcon';
import { Icon } from '../common/Icon';
import { Row } from '../common/Row';
import { StackedText } from '../common/StackedText';
import { TooltipText } from '../common/TooltipText';

const BLNT_DECIMALS = 7;

export const BackfillEmissions: React.FC = () => {
  const theme = useTheme();
  const { viewType } = useSettings();
  const { connected, walletAddress, backfillClaim, createTrustlines, restore } = useWallet();
  const { data: account, refetch: refetchAccount } = useHorizonAccount();
  const {
    data: backfill,
    isError: isBackfillError,
    refetch: refetchBackfill,
  } = useBackfillEmissions();

  const totalAllocation = getBackfillAllocation(walletAddress);
  const claimable = backfill?.claimable;
  const hasClaimable = claimable !== undefined && claimable > BigInt(0);
  const requiresBlntTrustline = account !== undefined && requiresTrustline(account, BLNT_ASSET);
  const showTrustlineAction = hasClaimable && requiresBlntTrustline;
  const claimOperation =
    BLNT_BACKFILL_ID !== '' && walletAddress !== ''
      ? buildClaimBackfillOperation(BLNT_BACKFILL_ID, walletAddress, walletAddress).toXDR('base64')
      : '';
  const { data: claimSimulation, refetch: refetchClaimSimulation } = useSimulateOperation(
    claimOperation,
    claimOperation !== '' &&
      (hasClaimable || isBackfillError) &&
      totalAllocation > BigInt(0) &&
      account !== undefined &&
      !requiresBlntTrustline
  );

  const isRestore = claimSimulation !== undefined && rpc.Api.isSimulationRestore(claimSimulation);

  const formatAmount = (amount: bigint | undefined) =>
    amount === undefined ? '-- BLNT' : `${toBalance(amount, BLNT_DECIMALS)} BLNT`;
  const claimButtonText = showTrustlineAction
    ? 'Add BLNT Trustline'
    : connected
    ? formatAmount(claimable)
    : '0 BLNT';

  async function handleClaim() {
    if (!connected) return;

    if (isRestore) {
      await restore(claimSimulation);
      await refetchBackfill();
      await refetchClaimSimulation();
    } else if (!hasClaimable) {
      return;
    } else if (requiresBlntTrustline) {
      await createTrustlines([BLNT_ASSET]);
      await refetchAccount();
      await refetchClaimSimulation();
    } else {
      await backfillClaim(walletAddress, walletAddress, false);
      await refetchBackfill();
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
    <>
      <Row>
        <Box sx={{ paddingLeft: '6px' }}>
          <Typography variant="h2" sx={{ padding: '6px' }}>
            Backfill emissions
          </Typography>
        </Box>
      </Row>
      <Row sx={rowSX}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: isRegularViewType ? '130px auto' : 'auto auto',
            columnGap: isRegularViewType ? '50px' : '18px',
            rowGap: '6px',
            alignItems: 'center',
            width: isRegularViewType ? '50%' : '100%',
          }}
        >
          <TooltipText
            tooltip="Your total BLNT backfill allocation based on attributed pre-incident Comet LP ownership."
            width="auto"
            sx={{ justifyContent: 'flex-start', whiteSpace: 'nowrap' }}
          >
            Total allocation
          </TooltipText>
          <Typography variant="h2">
            {connected ? formatAmount(totalAllocation) : '0 BLNT'}
          </Typography>
          <TooltipText
            tooltip="The portion of your BLNT backfill allocation vested under the 180-day linear schedule."
            width="auto"
            sx={{ justifyContent: 'flex-start', whiteSpace: 'nowrap' }}
          >
            Vested allocation
          </TooltipText>
          <Typography variant="h2">
            {connected ? formatAmount(backfill?.vestedAllocation) : '0 BLNT'}
          </Typography>
        </Box>
        <Box sx={{ width: isRegularViewType ? '45%' : '100%', display: 'flex' }}>
          <Box sx={{ width: '100%', display: 'flex' }}>
            <CustomButton
              sx={{
                width: '100%',
                padding: '12px',
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.background.paper,
                '&:hover': {
                  color: showTrustlineAction
                    ? theme.palette.warning.main
                    : theme.palette.primary.main,
                },
              }}
              onClick={handleClaim}
            >
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                {showTrustlineAction ? (
                  <Box
                    sx={{
                      borderRadius: '50%',
                      backgroundColor: theme.palette.warning.opaque,
                      width: '32px',
                      height: '32px',
                      margin: '6px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Icon
                      alt="BLNT Token Icon"
                      src="/icons/tokens/blnd-yellow.svg"
                      height="24px"
                      width="18px"
                      isCircle={false}
                    />
                  </Box>
                ) : (
                  <FlameIcon />
                )}
                <StackedText
                  title="Claim Backfill Emissions"
                  titleColor="inherit"
                  text={claimButtonText}
                  textColor="inherit"
                  type="large"
                />
              </Box>
              <ArrowForwardIcon fontSize="inherit" />
            </CustomButton>
          </Box>
        </Box>
      </Row>
    </>
  );
};
