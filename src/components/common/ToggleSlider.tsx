import { Box, Button, ButtonBaseProps, PaletteColor, useTheme } from '@mui/material';
import React from 'react';
import { Icon } from './Icon';

export interface OptionProp {
  optionName: string;
  palette: PaletteColor;
}

export interface ToggleSliderProps extends ButtonBaseProps {
  options: OptionProp[];
  selected: string;
  changeState: (value: any) => void;
  passedRef?: any;
  text?: string[];
  icons?: { src: string; alt: string }[];
}

export const ToggleSlider: React.FC<ToggleSliderProps> = ({
  options,
  selected,
  changeState,
  sx,
  passedRef,
  text,
  icons,
}) => {
  const theme = useTheme();

  const handleChangeToggle = (selectOption: string) => {
    changeState(selectOption);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        background: theme.palette.background.paper,
        borderRadius: '4px',
        margin: '4px',
        boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
        ...sx,
      }}
    >
      {options.map((option, index) => (
        <Button
          key={index}
          ref={passedRef}
          variant="contained"
          sx={{
            width: '100%',
            minWidth: 0,
            borderRadius: '4px',
            background:
              option.optionName === selected
                ? option.palette.opaque
                : theme.palette.background.paper,
            color:
              option.optionName === selected
                ? option.palette.main
                : theme.palette.menu.contrastText,
            boxShadow: 'none',
            '&:hover': {
              background:
                option.optionName === selected ? option.palette.opaque : theme.palette.menu.main,
              color:
                option.optionName === selected
                  ? option.palette.main
                  : theme.palette.menu.contrastText,
              boxShadow: 'none',
            },
          }}
          onClick={() => handleChangeToggle(option.optionName)}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            {icons?.at(index) !== undefined && (
              <Icon
                src={icons[index].src}
                alt={icons[index].alt}
                sx={{ height: '30px', width: '30px' }}
              />
            )}
            {text !== undefined ? text.at(index) ?? option.optionName : option.optionName}
          </Box>
        </Button>
      ))}
    </Box>
  );
};
