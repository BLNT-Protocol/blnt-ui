import { Box, BoxProps, Typography } from '@mui/material';
import { ReactNode } from 'react';

import { useTokenMetadata } from '../../hooks/api';
import { toCompactAddress } from '../../utils/formatter';
import { TokenIcon } from './TokenIcon';

export interface TokenHeaderProps extends BoxProps {
  assetId: string;
  hideDomain?: boolean;
  iconSize?: string;
  status?: ReactNode;
}

export const TokenHeader: React.FC<TokenHeaderProps> = ({
  assetId,
  sx,
  hideDomain,
  iconSize,
  status,
  ...props
}) => {
  const { data: tokenMetadata } = useTokenMetadata(assetId);

  if (tokenMetadata === undefined) {
    return <></>;
  }

  let domain =
    tokenMetadata.domain === undefined || tokenMetadata.domain === ''
      ? toCompactAddress(tokenMetadata.asset?.issuer ?? tokenMetadata.assetId)
      : tokenMetadata.domain;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        borderRadius: '5px',
        ...sx,
      }}
      {...props}
    >
      <TokenIcon
        assetId={assetId}
        height={iconSize || '32px'}
        width={iconSize || '32px'}
        sx={{ marginRight: '6px' }}
      />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Typography variant="body1">{tokenMetadata.symbol}</Typography>
          {status}
        </Box>
        {!hideDomain && (
          <Typography variant="body2" color="text.secondary">
            {domain}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
