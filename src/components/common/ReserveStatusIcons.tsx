import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import { Box, BoxProps, Tooltip, useTheme } from '@mui/material';
import { Reserve } from '@blend-capital/blend-sdk';
import { ReserveHealthIcon } from './ReserveHealthIcon';

export interface ReserveStatusIconsProps extends BoxProps {
  reserve: Reserve;
}

export const ReserveStatusIcons: React.FC<ReserveStatusIconsProps> = ({ reserve, sx, ...props }) => {
  const theme = useTheme();

  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', ...sx }}
      {...props}
    >
      {reserve.isPoolDeauthorized && (
        <Tooltip
          title="Reserve deauthorized: the asset issuer has revoked this pool's authorization. Transfers are unavailable and this asset provides no borrowing capacity until the issuer reauthorizes the pool."
          placement="top"
          enterTouchDelay={0}
          enterDelay={500}
          leaveTouchDelay={3000}
        >
          <Box
            component="span"
            aria-label="Reserve deauthorized"
            sx={{ display: 'inline-flex', alignItems: 'center', color: theme.palette.error.main }}
          >
            <BlockOutlinedIcon sx={{ width: '18px', height: '18px' }} />
          </Box>
        </Tooltip>
      )}
      <ReserveHealthIcon bRate={reserve.data.bRate} />
    </Box>
  );
};
