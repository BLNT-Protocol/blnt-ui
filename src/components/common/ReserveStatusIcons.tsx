import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, BoxProps, Tooltip, useTheme } from '@mui/material';
import { Reserve } from '@blend-capital/blend-sdk';
import { useTokenMetadata } from '../../hooks/api';
import { ReserveHealthIcon } from './ReserveHealthIcon';

export interface ReserveStatusIconsProps extends BoxProps {
  reserve: Reserve;
}

export const ReserveStatusIcons: React.FC<ReserveStatusIconsProps> = ({
  reserve,
  sx,
  ...props
}) => {
  const theme = useTheme();
  const { data: tokenMetadata } = useTokenMetadata(reserve.assetId);
  const isCustomSep41Reserve = tokenMetadata !== undefined && tokenMetadata.asset === undefined;

  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', ...sx }}
      {...props}
    >
      {isCustomSep41Reserve && (
        <Tooltip
          title="Custom SEP-41 reserve: this asset's behavior is defined by its token contract. The interface cannot verify that the contract reports truthful balances or preserves its behavior after privileged configuration changes or upgrades. Review the token contract and its administrators before use."
          placement="top"
          enterTouchDelay={0}
          enterDelay={500}
          leaveTouchDelay={3000}
        >
          <Box
            component="span"
            aria-label="Custom SEP-41 reserve"
            sx={{ display: 'inline-flex', alignItems: 'center', color: theme.palette.warning.main }}
          >
            <InfoOutlinedIcon sx={{ width: '18px', height: '18px' }} />
          </Box>
        </Tooltip>
      )}
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
