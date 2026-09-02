import { Box, Typography, useTheme } from '@mui/material';
import type { NextPage } from 'next';
import { BackfillSwap } from '../components/backstop/BackfillSwap';
import { Divider } from '../components/common/Divider';
import { GoBackButton } from '../components/common/GoBackButton';
import { Icon } from '../components/common/Icon';
import { Row } from '../components/common/Row';

const BackfillSwapPage: NextPage = () => {
  const theme = useTheme();
  return (
    <>
      <Row sx={{ margin: '12px', justifyContent: 'flex-start', alignItems: 'center' }}>
        <GoBackButton sx={{ backgroundColor: theme.palette.background.paper, margin: '12px' }} />
        <Icon
          src="/icons/tokens/blnd-yellow.svg"
          alt="BLND and BLNT conversion"
          isCircle={false}
          height="30px"
          width="45px"
          sx={{ marginRight: '12px' }}
        />
        <Typography variant="h2">BLND / BLNT Conversion</Typography>
      </Row>
      <Divider />
      <Box>
        <BackfillSwap />
      </Box>
    </>
  );
};

export default BackfillSwapPage;
