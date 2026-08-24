import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import { Box, BoxProps, Tooltip, useTheme } from '@mui/material';
import { FixedMath } from '@blend-capital/blend-sdk';

const HEALTHY_B_RATE = BigInt('1000000000000');
const MIN_OPERATIONAL_B_RATE = BigInt('100000000000');

export interface ReserveHealthIconProps extends BoxProps {
  bRate: bigint;
}

export const ReserveHealthIcon: React.FC<ReserveHealthIconProps> = ({ bRate, sx, ...props }) => {
  const theme = useTheme();

  if (bRate >= HEALTHY_B_RATE) {
    return null;
  }

  const isCritical = bRate < MIN_OPERATIONAL_B_RATE;
  const rate = FixedMath.toFloat(bRate, 12).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
  const severity = isCritical ? 'Critical reserve health' : 'Impaired reserve health';
  const tooltip = isCritical
    ? `${severity}: b_rate is ${rate}, below 0.1. Supplier value is severely impaired; V3 disables new supply, collateral supply, borrowing, and flash loans until the rate recovers.`
    : `${severity}: b_rate is ${rate}, below 1.0. Each bToken represents less than one unit of the supplied asset because suppliers have absorbed a loss.`;
  const color = isCritical ? theme.palette.error.main : theme.palette.warning.main;

  return (
    <Tooltip
      title={tooltip}
      placement="top"
      enterTouchDelay={0}
      enterDelay={500}
      leaveTouchDelay={3000}
    >
      <Box
        component="span"
        aria-label={severity}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          color,
          ...sx,
        }}
        {...props}
      >
        <MonitorHeartOutlinedIcon sx={{ width: '18px', height: '18px' }} />
      </Box>
    </Tooltip>
  );
};
