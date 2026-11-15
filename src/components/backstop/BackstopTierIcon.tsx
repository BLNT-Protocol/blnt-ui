import { BackstopAssetV3, BackstopTierV3 } from '@blend-capital/blend-sdk';
import { SxProps, Theme } from '@mui/material';
import { getTierIcon, getTierLabel } from '../../utils/backstop';
import { Icon } from '../common/Icon';
import { TokenPairIcon } from '../common/TokenPairIcon';

export interface BackstopTierIconProps {
  tier: BackstopTierV3;
  token?: string;
  asset?: BackstopAssetV3;
  sx?: SxProps<Theme>;
}

/** Render V3 Comet LP tiers as overlapping token pairs and plain tiers as one token. */
export const BackstopTierIcon: React.FC<BackstopTierIconProps> = ({ tier, token, asset, sx }) => {
  const label = getTierLabel(tier, token, asset);
  const isBlntXlm =
    asset === BackstopAssetV3.BlntXlm || token === process.env.NEXT_PUBLIC_BLND_XLM_COMET;
  const isBlntUsdc =
    asset === BackstopAssetV3.BlntUsdc || token === process.env.NEXT_PUBLIC_BLND_USDC_COMET;

  if (isBlntXlm || isBlntUsdc) {
    return (
      <TokenPairIcon
        backSrc="/icons/tokens/blnt.png"
        frontSrc={isBlntXlm ? '/icons/tokens/xlm.svg' : '/icons/tokens/usdc.svg'}
        alt={label}
        sx={sx}
      />
    );
  }

  return (
    <Icon
      src={getTierIcon(tier, token, asset)}
      alt={label}
      sx={{ height: '30px', width: '30px', ...sx }}
    />
  );
};
