import { Version } from '@blend-capital/blend-sdk';
import { Typography, TypographyProps, useTheme } from '@mui/material';

export interface VersionTagProps extends TypographyProps {
  version: Version;
}

export const VersionTag: React.FC<VersionTagProps> = ({ version, sx, ...props }) => {
  const theme = useTheme();
  const palette =
    version === Version.V1
      ? theme.palette.primary
      : version === Version.V3
      ? theme.palette.positive
      : theme.palette.backstop;
  return (
    <Typography
      variant="body1"
      sx={{
        backgroundColor: palette.opaque,
        color: palette.main,
        borderRadius: '5px',
        paddingLeft: '6px',
        paddingRight: '6px',
        ...sx,
      }}
      {...props}
    >
      {version}
    </Typography>
  );
};
