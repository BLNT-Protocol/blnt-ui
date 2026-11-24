import React, { useState } from 'react';

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
    (image, index, images): image is string =>
      image !== undefined && images.indexOf(image) === index
  );
  const candidateKey = imageCandidates.join('\u0000');
  const [failedImageState, setFailedImageState] = useState<{
    candidateKey: string;
    images: string[];
  }>({ candidateKey, images: [] });
  const failedImages =
    failedImageState.candidateKey === candidateKey ? failedImageState.images : [];
  const image = imageCandidates.find((candidate) => !failedImages.includes(candidate));

  if (image) {
    return (
      <Icon
        src={image}
        alt={symbol}
        onError={() =>
          setFailedImageState((current) => {
            const images = current.candidateKey === candidateKey ? current.images : [];
            return {
              candidateKey,
              images: images.includes(image) ? images : [...images, image],
            };
          })
        }
        {...props}
      />
    );
  } else {
    // return circle with capitalized first letter of the symbol
    return <LetterIcon text={symbol.charAt(0).toUpperCase()} {...props} />;
  }
};
