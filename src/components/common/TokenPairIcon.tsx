import { Box, SxProps, Theme } from '@mui/material';
import { Icon } from './Icon';

export interface TokenPairIconProps {
  backSrc: string;
  frontSrc: string;
  alt: string;
  sx?: SxProps<Theme>;
}

/** Render two token icons with the second token overlapping the first. */
export const TokenPairIcon: React.FC<TokenPairIconProps> = ({ backSrc, frontSrc, alt, sx }) => (
  <Box
    role="img"
    aria-label={alt}
    sx={{
      position: 'relative',
      width: '39px',
      height: '30px',
      minWidth: '39px',
      minHeight: '30px',
      ...sx,
    }}
  >
    <Icon
      src={backSrc}
      alt=""
      height="30px"
      width="30px"
      sx={{ position: 'absolute', left: 0, top: 0 }}
    />
    <Icon
      src={frontSrc}
      alt=""
      height="30px"
      width="30px"
      sx={{
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 1,
        outline: '1px solid',
        outlineColor: 'background.default',
      }}
    />
  </Box>
);
