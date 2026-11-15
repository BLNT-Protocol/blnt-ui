import { Box, LinearProgress, Typography, useTheme } from '@mui/material';
import type { NextPage } from 'next';
import { ReactNode } from 'react';
import { Row } from '../components/common/Row';
import { SectionBase } from '../components/common/SectionBase';
import { Skeleton } from '../components/common/Skeleton';
import { useBlntProtocolStats } from '../hooks/api';
import { toBalance, toPercentage } from '../utils/formatter';

const TOKEN_DECIMALS = 7;
const SWAP_CAPACITY = BigInt(51_000_000) * BigInt(10 ** TOKEN_DECIMALS);

const formatUsd = (value: number | undefined, decimals?: number) =>
  value === undefined ? '--' : `$${toBalance(value, decimals)}`;
const formatBlnt = (value: bigint | undefined) =>
  value === undefined ? '--' : `${toBalance(value, TOKEN_DECIMALS)} BLNT`;

const StatCard: React.FC<{
  label: string;
  value: string;
  detail: ReactNode;
  color: string;
}> = ({ label, value, detail, color }) => (
  <SectionBase
    sx={{
      minHeight: '128px',
      padding: '18px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      borderTop: `3px solid ${color}`,
    }}
  >
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="h1" sx={{ fontSize: '1.5rem', overflowWrap: 'anywhere' }}>
      {value}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {detail}
    </Typography>
  </SectionBase>
);

const ProgressCard: React.FC<{
  title: string;
  status: string;
  progress: number;
  color: string;
  children: ReactNode;
}> = ({ title, status, progress, color, children }) => (
  <SectionBase sx={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <Typography variant="h2">{title}</Typography>
      <Typography variant="h4" sx={{ color }}>
        {status}
      </Typography>
    </Box>
    <LinearProgress
      variant="determinate"
      value={Math.min(Math.max(progress, 0), 100)}
      sx={{
        height: '8px',
        borderRadius: '4px',
        backgroundColor: 'background.default',
        '& .MuiLinearProgress-bar': { backgroundColor: color, borderRadius: '4px' },
      }}
    />
    {children}
  </SectionBase>
);

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '18px' }}>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" sx={{ textAlign: 'right' }}>
      {value}
    </Typography>
  </Box>
);

const StatsPage: NextPage = () => {
  const theme = useTheme();
  const { data: stats, isLoading, isError, error } = useBlntProtocolStats();

  const vestingDuration =
    stats === undefined ? BigInt(0) : stats.backfill.vestingEnd - stats.backfill.vestingStart;
  const vestingElapsed =
    stats === undefined || stats.backfill.ledgerCloseTime <= stats.backfill.vestingStart
      ? BigInt(0)
      : stats.backfill.ledgerCloseTime >= stats.backfill.vestingEnd
      ? vestingDuration
      : stats.backfill.ledgerCloseTime - stats.backfill.vestingStart;
  const backfillRatio =
    vestingDuration > BigInt(0) ? Number(vestingElapsed) / Number(vestingDuration) : 0;
  const swapRatio =
    stats !== undefined ? Number(stats.backfill.totalSwapped) / Number(SWAP_CAPACITY) : 0;
  const swapActive =
    stats !== undefined && stats.backfill.ledgerCloseTime < stats.backfill.swapDeadline;
  const vestingEnd =
    stats === undefined
      ? '--'
      : new Date(Number(stats.backfill.vestingEnd) * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
  const swapDeadline =
    stats === undefined
      ? '--'
      : new Date(Number(stats.backfill.swapDeadline) * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

  return (
    <>
      <Row sx={{ margin: '6px', padding: '6px', width: 'calc(100% - 12px)' }}>
        <Typography component="h1" variant="h1">
          BLNT V3 Stats
        </Typography>
      </Row>
      <SectionBase type="alt" sx={{ margin: '6px', padding: '12px' }}>
        <Typography component="p" variant="body2">
          Live BLNT supply, market, lending, backstop, and backfill statistics. Lending totals cover
          the configured Fixed Pool V3 and YieldBlent markets.
        </Typography>
      </SectionBase>

      {isLoading && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: '12px',
            margin: '18px 6px',
          }}
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} width="100%" height="128px" sx={{ margin: 0 }} />
          ))}
        </Box>
      )}

      {isError && (
        <SectionBase sx={{ margin: '18px 6px', padding: '18px' }}>
          <Typography variant="h3" color="error.main">
            Unable to load BLNT V3 statistics
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ marginTop: '8px' }}>
            {error?.message ?? 'A live data source returned an unexpected response.'}
          </Typography>
        </SectionBase>
      )}

      {stats !== undefined && (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
              gap: '12px',
              margin: '18px 6px 12px',
            }}
          >
            <StatCard
              label="BLNT price"
              value={formatUsd(stats.blntPrice, TOKEN_DECIMALS)}
              detail="Canonical BLNT:USDC Comet V1.1 spot price"
              color={theme.palette.primary.main}
            />
            <StatCard
              label="Circulating supply"
              value={formatBlnt(stats.circulatingSupply)}
              detail="Total BLNT supply minus BLNT held by backfill contracts or awaiting emission claims"
              color={theme.palette.primary.main}
            />
            <StatCard
              label="Market cap"
              value={formatUsd(stats.marketCap)}
              detail="BLNT price × circulating supply"
              color={theme.palette.primary.main}
            />
            <StatCard
              label="Total supplied"
              value={formatUsd(stats.totalSupplied)}
              detail="Gross supplied value across configured BLNT V3 markets"
              color={theme.palette.lend.main}
            />
            <StatCard
              label="Total borrowed"
              value={formatUsd(stats.totalBorrowed)}
              detail="Outstanding borrowed value across configured BLNT V3 markets"
              color={theme.palette.borrow.main}
            />
            <StatCard
              label="Total backstop"
              value={formatUsd(stats.totalBackstop)}
              detail="Deposited value across all configured market tiers, including Q4W"
              color={theme.palette.backstop.main}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' },
              gap: '12px',
              margin: '0 6px 18px',
            }}
          >
            <ProgressCard
              title="Backfill completion"
              status={toPercentage(backfillRatio)}
              progress={backfillRatio * 100}
              color={theme.palette.backstop.main}
            >
              <DetailRow label="Total vested" value={formatBlnt(stats.backfill.backfillVested)} />
              <DetailRow
                label="Total allocation"
                value={formatBlnt(stats.backfill.backfillAllocated)}
              />
              <DetailRow label="Vesting completes" value={vestingEnd} />
            </ProgressCard>

            <ProgressCard
              title="Swap-and-burn status"
              status={toPercentage(swapRatio)}
              progress={swapRatio * 100}
              color={swapActive ? theme.palette.primary.main : theme.palette.text.secondary}
            >
              <DetailRow
                label="BLND burned for BLNT"
                value={toBalance(stats.backfill.totalSwapped, TOKEN_DECIMALS)}
              />
              <DetailRow
                label="Remaining capacity"
                value={formatBlnt(stats.backfill.remainingCapacity)}
              />
              <DetailRow label="Conversion deadline" value={swapDeadline} />
            </ProgressCard>
          </Box>
        </>
      )}
    </>
  );
};

export default StatsPage;
