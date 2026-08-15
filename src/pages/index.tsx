import { Version } from '@blend-capital/blend-sdk';
import { useTheme } from '@mui/material';
import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { Divider } from '../components/common/Divider';
import { Row } from '../components/common/Row';
import { SectionBase } from '../components/common/SectionBase';
import { ToggleSlider } from '../components/common/ToggleSlider';
import { MarketsList } from '../components/markets/MarketsList';
import { useSettings } from '../contexts';

const Markets: NextPage = () => {
  const theme = useTheme();
  const { isV2Enabled, isV3Enabled, lastPool } = useSettings();

  const [version, setVersion] = useState<Version | undefined>(undefined);

  useEffect(() => {
    if ((isV2Enabled || isV3Enabled) && lastPool?.version) {
      setVersion(lastPool.version);
    } else if (isV2Enabled) {
      setVersion(Version.V2);
    } else if (isV3Enabled) {
      setVersion(Version.V3);
    } else {
      setVersion(Version.V1);
    }
  }, [isV2Enabled, isV3Enabled, lastPool]);

  return (
    <>
      <Row sx={{ alignItems: 'center' }}>
        <SectionBase type="alt" sx={{ margin: '6px', padding: '6px' }}>
          Markets
        </SectionBase>
        {(isV2Enabled || isV3Enabled) && version !== undefined && (
          <ToggleSlider
            options={[
              { optionName: Version.V1, palette: theme.palette.primary },
              ...(isV2Enabled ? [{ optionName: Version.V2, palette: theme.palette.backstop }] : []),
              ...(isV3Enabled ? [{ optionName: Version.V3, palette: theme.palette.positive }] : []),
            ]}
            selected={version}
            changeState={setVersion}
            sx={{ height: '24px', width: isV3Enabled ? '132px' : '80px', marginRight: '6px' }}
          />
        )}
      </Row>
      <Divider />
      <MarketsList version={version} />
    </>
  );
};

export default Markets;
