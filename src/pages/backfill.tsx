import { Box, Typography } from '@mui/material';
import type { NextPage } from 'next';
import { BackfillEmissions } from '../components/backstop/BackfillEmissions';
import { BackfillLockupEmissions } from '../components/backstop/BackfillLockupEmissions';
import { BackstopTokens } from '../components/backstop/BackstopTokens';
import { ContributorGrants } from '../components/backstop/ContributorGrants';
import { ContributorClaimAndFund } from '../components/backstop/ContributorClaimAndFund';
import { YieldBlentBackstopManager } from '../components/backstop/YieldBlentBackstopManager';
import { Divider } from '../components/common/Divider';
import { Row } from '../components/common/Row';

const BackfillPage: NextPage = () => {
  return (
    <>
      <Row sx={{ margin: '12px', padding: '12px' }}>
        <Typography variant="h1">BLNT Backfill</Typography>
      </Row>
      <Box sx={{ margin: '0 24px 24px' }}>
        <Typography variant="body1" color="text.secondary">
          BLNT Backfill emissions distribute 74 million BLNT to pre-incident BLND:USDC Comet V1 LP
          holders in proportion to their attributed LP shares. Allocations vest linearly over 180
          days, can be claimed incrementally, and remain claimable after vesting ends. The BLNT
          Backfill is independent of any official Blend remediation and does not impact eligibility.
        </Typography>
      </Box>
      <Divider />
      <Box sx={{ margin: '0px 12px' }}>
        <BackfillEmissions />
      </Box>
      <BackfillLockupEmissions />
      <Divider />
      <Box sx={{ margin: '0px 12px' }}>
        <BackstopTokens />
      </Box>
      <ContributorGrants />
      <ContributorClaimAndFund />
      <YieldBlentBackstopManager />
    </>
  );
};

export default BackfillPage;
