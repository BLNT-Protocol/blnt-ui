import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box, SxProps, Theme, Typography, useTheme } from '@mui/material';
import { useSettings, ViewType } from '../../contexts';
import { useWallet } from '../../contexts/wallet';
import { useBackfillSwapState, useHorizonAccount, useTokenBalance } from '../../hooks/api';
import { toBalance } from '../../utils/formatter';
import { BLND_ASSET, BLNT_ASSET } from '../../utils/token_display';
import { CustomButton } from '../common/CustomButton';
import { Icon } from '../common/Icon';
import { LinkBox } from '../common/LinkBox';
import { Row } from '../common/Row';
import { StackedText } from '../common/StackedText';
import { TooltipText } from '../common/TooltipText';

const TOKEN_DECIMALS = 7;

/** Render the connected wallet's legacy and V3 backstop-token balances. */
export const BackstopTokens: React.FC = () => {
  const theme = useTheme();
  const { viewType } = useSettings();
  const { connected } = useWallet();
  const { data: account } = useHorizonAccount();
  const { data: swapState } = useBackfillSwapState();
  const { data: blndBalance } = useTokenBalance(swapState?.legacyBlndToken, BLND_ASSET, account);
  const { data: blntBalance } = useTokenBalance(swapState?.blntToken, BLNT_ASSET, account);

  const formatBalance = (balance: bigint | undefined, symbol: string) =>
    connected
      ? `${balance === undefined ? '--' : toBalance(balance, TOKEN_DECIMALS)} ${symbol}`
      : `0 ${symbol}`;
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
            Emission tokens
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
            tooltip="Your connected wallet's BLND balance. BLND is the emission token used by Blend V1/V2."
            width="auto"
            sx={{ justifyContent: 'flex-start', whiteSpace: 'nowrap' }}
          >
            BLND wallet balance
          </TooltipText>
          <Typography variant="h2">{formatBalance(blndBalance, 'BLND')}</Typography>
          <TooltipText
            tooltip="Your connected wallet's BLNT balance. BLNT is the emission token used by BLNT V3."
            width="auto"
            sx={{ justifyContent: 'flex-start', whiteSpace: 'nowrap' }}
          >
            BLNT wallet balance
          </TooltipText>
          <Typography variant="h2">{formatBalance(blntBalance, 'BLNT')}</Typography>
        </Box>
        <LinkBox
          to={{ pathname: '/backfill-swap' }}
          sx={{ width: isRegularViewType ? '45%' : '100%', display: 'flex' }}
        >
          <CustomButton
            sx={{
              width: '100%',
              padding: '12px',
              color: theme.palette.text.primary,
              backgroundColor: theme.palette.background.paper,
              '&:hover': { color: theme.palette.primary.main },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
              <Icon
                alt="BLND and BLNT token icon"
                src="/icons/tokens/blnd-yellow.svg"
                height="32px"
                width="24px"
                isCircle={false}
                sx={{ margin: '6px' }}
              />
              <StackedText
                title="Swap BLND"
                titleColor="inherit"
                text="2 BLND → 1 BLNT"
                textColor="inherit"
                type="large"
              />
            </Box>
            <ArrowForwardIcon fontSize="inherit" />
          </CustomButton>
        </LinkBox>
      </Row>
    </>
  );
};
