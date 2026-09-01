import { Box, Typography, useTheme } from '@mui/material';
import type { NextPage } from 'next';
import { useState } from 'react';
import { BackfillSwap, BackfillSwapMode } from '../components/backstop/BackfillSwap';
import { Divider } from '../components/common/Divider';
import { GoBackButton } from '../components/common/GoBackButton';
import { Icon } from '../components/common/Icon';
import { Row } from '../components/common/Row';
import { Section, SectionSize } from '../components/common/Section';
import { ToggleButton } from '../components/common/ToggleButton';

const BackfillSwapPage: NextPage = () => {
  const theme = useTheme();
  const [mode, setMode] = useState<BackfillSwapMode>('swap');

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
      <Row>
        <Section width={SectionSize.FULL} sx={{ padding: '0px' }}>
          <ToggleButton
            active={mode === 'swap'}
            palette={theme.palette.backstop}
            sx={{ width: '50%', padding: '12px' }}
            onClick={() => setMode('swap')}
          >
            Swap BLND for BLNT
          </ToggleButton>
          <ToggleButton
            active={mode === 'refund'}
            palette={theme.palette.backstop}
            sx={{ width: '50%', padding: '12px' }}
            onClick={() => setMode('refund')}
          >
            Refund BLNT for BLND
          </ToggleButton>
        </Section>
      </Row>
      <Box>
        <BackfillSwap mode={mode} />
      </Box>
    </>
  );
};

export default BackfillSwapPage;
