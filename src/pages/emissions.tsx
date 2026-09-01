import { Box, Typography } from '@mui/material';
import type { NextPage } from 'next';
import { BackfillEmissions } from '../components/backstop/BackfillEmissions';
import { BackstopTokens } from '../components/backstop/BackstopTokens';
import { Divider } from '../components/common/Divider';
import { Row } from '../components/common/Row';

const EmissionsPage: NextPage = () => {
  return (
    <>
      <Row sx={{ margin: '12px', padding: '12px' }}>
        <Typography variant="h1">BLNT Backfill</Typography>
      </Row>
      <Divider />
      <Box sx={{ margin: '0px 12px' }}>
        <BackfillEmissions />
      </Box>
      <Divider />
      <Box sx={{ margin: '0px 12px' }}>
        <BackstopTokens />
      </Box>
    </>
  );
};

export default EmissionsPage;
