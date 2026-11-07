import React, { useEffect, useState } from 'react';

import { Theme } from '@emotion/react';
import { SxProps } from '@mui/material';
import { getReserveTokenIcon } from '../../external/icon-map';
import { useTokenMetadata } from '../../hooks/api';
import { toCompactAddress } from '../../utils/formatter';
import { Icon } from './Icon';
import { LetterIcon } from './LetterIcon';

export interface TokenIconProps {
  assetId: string;
  height?: string;
  width?: string;
  sx?: SxProps<Theme> | undefined;
}
export const TokenIcon: React.FC<TokenIconProps> = ({ assetId, ...props }) => {
  const { data: stellarTokenMetadata } = useTokenMetadata(assetId);
  const symbol = stellarTokenMetadata?.symbol || toCompactAddress(assetId);
  const fallbackImage = getReserveTokenIcon(assetId);
  const imageCandidates = [stellarTokenMetadata?.image, fallbackImage].filter(
    (image, index, images): image is string => image !== undefined && images.indexOf(image) === index
  );
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const image = imageCandidates.find((candidate) => !failedImages.includes(candidate));

  useEffect(() => {
    setFailedImages([]);
  }, [assetId, stellarTokenMetadata?.image, fallbackImage]);

  if (image) {
    return (
      <Icon
        src={image}
        alt={symbol}
        onError={() => setFailedImages((failed) => [...failed, image])}
        {...props}
      />
    );
  } else {
    // return circle with capitalized first letter of the symbol
    return <LetterIcon text={symbol.charAt(0).toUpperCase()} {...props} />;
  }
};
