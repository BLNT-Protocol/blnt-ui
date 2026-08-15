import { ButtonProps, useTheme } from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { UrlObject } from 'url';
import { ToggleButton } from '../common/ToggleButton';

export interface INavItemProps extends ButtonProps {
  to: UrlObject;
  title: string;
}

function formatHref(to: UrlObject): string {
  const searchParams = new URLSearchParams();
  if (typeof to.query === 'object' && to.query !== null) {
    Object.entries(to.query).forEach(([key, value]) => {
      const values = Array.isArray(value) ? value : [value];
      values.forEach((entry) => {
        if (entry !== undefined && entry !== null) {
          searchParams.append(key, String(entry));
        }
      });
    });
  }

  const encodedQuery = searchParams.toString();
  const search = encodedQuery ? `?${encodedQuery}` : to.search ?? '';
  const hash = to.hash && !to.hash.startsWith('#') ? `#${to.hash}` : to.hash ?? '';
  return `${to.pathname ?? ''}${search}${hash}`;
}

export const NavItem = ({ to, title, sx, ...props }: INavItemProps) => {
  const theme = useTheme();
  const router = useRouter();
  const active = to.pathname == router.route;

  return (
    <ToggleButton
      component={Link}
      href={formatHref(to)}
      active={active}
      palette={theme.palette.primary}
      sx={{ margin: '0px 6px 0px', ...sx }}
      {...props}
    >
      {title}
    </ToggleButton>
  );
};
