import { Box, BoxProps } from '@mui/material';
import Link from 'next/link';
import { UrlObject } from 'url';

export interface LinkBoxProps extends BoxProps {
  to: UrlObject;
}

export const LinkBox = ({ to, title, sx, ...props }: LinkBoxProps) => {
  return (
    <Box
      component={Link}
      href={to}
      sx={{
        padding: '0',
        color: 'inherit',
        textDecoration: 'none',
        '&:visited': { color: 'inherit' },
        ...sx,
      }}
      {...props}
    ></Box>
  );
};
