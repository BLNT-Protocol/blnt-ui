import { BackstopTierPoolV3 } from '@blend-capital/blend-sdk';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, BoxProps, Tooltip, Typography, useTheme } from '@mui/material';

export interface BackstopAuthorizationStatusProps extends BoxProps {
  tierPool: BackstopTierPoolV3;
}

export const BackstopAuthorizationStatus: React.FC<BackstopAuthorizationStatusProps> = ({
  tierPool,
  sx,
  ...props
}) => {
  const theme = useTheme();

  if (!tierPool.isDeauthorized) return null;

  return (
    <Tooltip
      arrow
      placement="top"
      enterTouchDelay={0}
      leaveTouchDelay={5000}
      title="The USDC issuer has deauthorized the shared backstop balance. This tier has zero transferable value and is excluded from activation, reward-zone qualification, take-rate allocation, auctions, and loss absorption until reauthorized. Its shares, queued withdrawals, and pending interest remain recorded."
    >
      <Box
        component="span"
        aria-label="Backstop asset deauthorized"
        tabIndex={0}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          color: theme.palette.error.main,
          ...sx,
        }}
        {...props}
      >
        <ErrorOutlineIcon sx={{ width: '16px', height: '16px', marginRight: '4px' }} />
        <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 600 }}>
          Deauthorized
        </Typography>
      </Box>
    </Tooltip>
  );
};
