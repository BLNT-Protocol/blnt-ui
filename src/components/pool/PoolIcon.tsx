import { IconProps } from '@mui/material';
import React from 'react';
import { getPoolIcon } from '../../external/icon-map';
import { Icon } from '../common/Icon';

export interface PoolIconProps extends IconProps {
  name: string;
  poolAddress?: string;
}

export const PoolIcon: React.FC<PoolIconProps> = ({ name, poolAddress, ...props }) => {
  const imgSrc = getPoolIcon(poolAddress);

  return <Icon src={imgSrc} alt={`${name}`} {...props} />;
};
