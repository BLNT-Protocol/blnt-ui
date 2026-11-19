import { IconProps } from '@mui/material';
import React from 'react';
import { getPoolIcon } from '../../external/icon-map';
import { Version } from '../../utils/version';
import { Icon } from '../common/Icon';

export interface PoolIconProps extends IconProps {
  name: string;
  poolAddress?: string;
  version: Version;
}

export const PoolIcon: React.FC<PoolIconProps> = ({ name, poolAddress, version, ...props }) => {
  const imgSrc = version === Version.V3 ? '/icons/tokens/blnt.png' : getPoolIcon(poolAddress);

  return <Icon src={imgSrc} alt={`${name}`} {...props} />;
};
