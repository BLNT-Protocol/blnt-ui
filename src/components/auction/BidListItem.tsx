import { Reserve } from '@blend-capital/blend-sdk';
import { Box, BoxProps, Typography } from '@mui/material';
import { useSettings, ViewType } from '../../contexts';
import { toBalance } from '../../utils/formatter';
import { Version } from '../../utils/version';
import { TokenHeader } from '../common/TokenHeader';
import { AuctionBackstopTokenHeader } from './AuctionBackstopTokenHeader';

export interface BidItemProps extends BoxProps {
  assetId: string;
  reserve: Reserve | undefined;
  version: Version;
  type: string;
  amount: bigint;
  oracleValue: number | undefined;
}
export const BidListItem: React.FC<BidItemProps> = ({
  assetId,
  reserve,
  version,
  type,
  amount,
  oracleValue,
  ...props
}) => {
  const { viewType } = useSettings();

  const tableNum = viewType == ViewType.REGULAR ? 3 : 3;
  const tableWidth = `${(100 / tableNum).toFixed(2)}%`;
  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px',
        type: 'alt',
      }}
      {...props}
    >
      <Box
        sx={{
          width: tableWidth,
          display: 'flex',
          justifyContent: 'left',
        }}
      >
        {reserve ? (
          <TokenHeader assetId={reserve.assetId} />
        ) : (
          <AuctionBackstopTokenHeader token={assetId} version={version} />
        )}
      </Box>
      <Box
        sx={{
          width: tableWidth,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Typography variant="body1">{type}</Typography>
      </Box>
      <Box
        sx={{
          width: tableWidth,
          display: 'flex',
          justifyContent: 'right',
          alignItems: 'flex-end',
          flexDirection: 'column',
        }}
      >
        <Typography variant="body1">
          {`${toBalance(amount, reserve?.config.decimals ?? 7)}`}
        </Typography>
        {oracleValue !== undefined && oracleValue !== 0 && (
          <Typography variant="body2" color="text.secondary">
            {`$${toBalance(oracleValue, 2)}`}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
