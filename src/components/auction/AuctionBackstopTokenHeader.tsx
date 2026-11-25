import { BackstopTierV3 } from '@blend-capital/blend-sdk';
import { Box, BoxProps, Typography, useTheme } from '@mui/material';
import { getTierLabel } from '../../utils/backstop';
import { toCompactAddress } from '../../utils/formatter';
import { Version } from '../../utils/version';
import { BackstopTierIcon } from '../backstop/BackstopTierIcon';
import { Icon } from '../common/Icon';

export interface AuctionBackstopTokenHeaderProps extends BoxProps {
  token: string;
  version: Version;
}

/** Render the non-reserve backstop token used by an auction. */
export const AuctionBackstopTokenHeader: React.FC<AuctionBackstopTokenHeaderProps> = ({
  token,
  version,
  sx,
  ...props
}) => {
  const theme = useTheme();
  const tier =
    token === process.env.NEXT_PUBLIC_BLND_XLM_COMET
      ? BackstopTierV3.FirstLoss
      : token === process.env.NEXT_PUBLIC_BLND_USDC_COMET
      ? BackstopTierV3.SecondLoss
      : token === process.env.NEXT_PUBLIC_USDC_TOKEN
      ? BackstopTierV3.ThirdLoss
      : undefined;

  return (
    <Box
      sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', ...sx }}
      {...props}
    >
      {version === Version.V3 && tier !== undefined ? (
        <>
          <BackstopTierIcon tier={tier} token={token} sx={{ marginRight: '12px' }} />
          <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
            {getTierLabel(tier, token)}
          </Typography>
        </>
      ) : version === Version.V3 ? (
        <>
          <Icon
            src="/icons/tokens/soroban.svg"
            alt="Backstop token"
            sx={{ height: '30px', width: '30px', marginRight: '12px' }}
          />
          <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
            {toCompactAddress(token)}
          </Typography>
        </>
      ) : (
        <>
          <Icon
            src="/icons/tokens/blndusdclp.svg"
            alt="BLND-USDC LP"
            sx={{ height: '30px', width: '30px', marginRight: '12px' }}
          />
          <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
            BLND-USDC LP
          </Typography>
        </>
      )}
    </Box>
  );
};
