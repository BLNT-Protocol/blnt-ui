import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Typography, useTheme } from '@mui/material';
import {
  BACKSTOP_DEPOSIT_ALLOWED,
  RESERVE_BORROW_ALLOWED,
  RESERVE_SUPPLY_ALLOWED,
  Version,
} from '@blend-capital/blend-sdk';
import { useWallet } from '../../contexts/wallet';
import { usePoolPermissions } from '../../hooks/api';
import { PoolMeta } from '../../hooks/types';
import { toCompactAddress } from '../../utils/formatter';
import { Row } from '../common/Row';

export const PoolAccessBanner: React.FC<{ poolMeta: PoolMeta | undefined }> = ({ poolMeta }) => {
  const theme = useTheme();
  const { connected } = useWallet();
  const controller = poolMeta?.version === Version.V3 ? poolMeta.accessController : undefined;
  const { data: permissions, isError, isLoading } = usePoolPermissions(
    poolMeta,
    controller !== undefined
  );

  if (controller === undefined) {
    return null;
  }

  let walletStatus = 'Connect a wallet to check its permissions.';
  if (connected && isLoading) {
    walletStatus = 'Checking wallet permissions.';
  } else if (connected && isError) {
    walletStatus = 'Permission check unavailable; risk-increasing actions are disabled.';
  } else if (connected && permissions !== undefined) {
    const allowed = (permission: number) =>
      (permissions & permission) === permission ? 'allowed' : 'blocked';
    walletStatus = `Wallet permissions: supply ${allowed(
      RESERVE_SUPPLY_ALLOWED
    )}, borrow ${allowed(RESERVE_BORROW_ALLOWED)}, backstop deposit ${allowed(
      BACKSTOP_DEPOSIT_ALLOWED
    )}.`;
  }

  return (
    <Row
      sx={{
        background: theme.palette.warning.opaque,
        color: theme.palette.warning.main,
        justifyContent: 'flex-start',
        alignItems: 'center',
        margin: '6px',
        padding: '12px',
        paddingRight: '20px',
        borderRadius: '5px',
      }}
    >
      <InfoOutlinedIcon sx={{ marginRight: '8px' }} />
      <Box>
        <Typography variant="body2">
          Permissioned pool. Access is controlled by{' '}
          <Box
            component="a"
            href={`${process.env.NEXT_PUBLIC_STELLAR_EXPERT_URL}/contract/${controller}`}
            target="_blank"
            rel="noreferrer"
            sx={{ color: 'inherit' }}
          >
            {toCompactAddress(controller)}
          </Box>
          .
        </Typography>
        <Typography variant="body2">{walletStatus}</Typography>
      </Box>
    </Row>
  );
};
