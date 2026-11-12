import { Typography, useTheme } from '@mui/material';
import type { NextPage } from 'next';
import { useState } from 'react';
import { Divider } from '../components/common/Divider';
import { Row } from '../components/common/Row';
import { SectionBase } from '../components/common/SectionBase';
import { ToggleSlider } from '../components/common/ToggleSlider';
import { MarketsList } from '../components/markets/MarketsList';
import { ENABLED_VERSIONS, LATEST_VERSION, Version } from '../utils/version';

const DEFAULT_VERSION = ENABLED_VERSIONS.includes(Version.V3) ? Version.V3 : LATEST_VERSION;

const Markets: NextPage = () => {
  const theme = useTheme();
  const [version, setVersion] = useState<Version>(DEFAULT_VERSION);

  return (
    <>
      <Row sx={{ alignItems: 'center' }}>
        <SectionBase type="alt" sx={{ margin: '6px', padding: '6px' }}>
          <Typography component="h1" variant="h1">
            Markets
          </Typography>
        </SectionBase>
        {ENABLED_VERSIONS.length > 1 && (
          <ToggleSlider
            options={ENABLED_VERSIONS.map((option) => ({
              optionName: option,
              palette:
                option === Version.V1
                  ? theme.palette.primary
                  : option === Version.V3
                  ? theme.palette.positive
                  : theme.palette.backstop,
            }))}
            selected={version}
            changeState={setVersion}
            sx={{
              height: '24px',
              width: `${44 * ENABLED_VERSIONS.length}px`,
              marginRight: '6px',
            }}
          />
        )}
      </Row>
      <SectionBase type="alt" sx={{ margin: '6px', padding: '12px' }}>
        <Typography component="p" variant="body2">
          BLNT Trade is the interface for BLNT V3, a Blend-derived lending protocol on Stellar
          designed for permissionless lending and real-world assets. Explore the Fixed Pool V3
          and YieldBlent markets. V1/V2/V2.1 are Blend markets.
        </Typography>
      </SectionBase>
      <Divider />
      <MarketsList version={version} />
    </>
  );
};

export default Markets;
