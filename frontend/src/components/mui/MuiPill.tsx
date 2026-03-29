import type { FC } from 'react';
import { Chip, styled } from '@mui/material';
import type { ChipProps } from '@mui/material';
import { pillColors, type PillColorVariant } from '../../theme/tokens';
import { tokens } from '../../theme/mui-theme';

export interface MuiPillProps extends Omit<ChipProps, 'color'> {
  color?: PillColorVariant;
}

/** Props the styled chip accepts — excludes `color` since it's handled via shouldForwardProp */
type StyledChipProps = Omit<ChipProps, 'color'>;

const StyledChipBase = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'color',
})<StyledChipProps>(({ theme: _theme }) => {
  // Note: color is applied via the outer MuiPill wrapper using sx or direct style,
  // not via styled template — see MuiPill component below
  return {
    borderRadius: tokens.radius.sm,
    minHeight: '44px', // WCAG 2.5.5: Minimum touch target size
    fontSize: '0.875rem',
    padding: '8px 0', // Increased padding to achieve 44px height
    fontWeight: 600,
    transition: 'background-color 150ms ease, box-shadow 150ms ease',
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      '&:hover': {
        filter: 'none',
      },
    },
    '&:focus-visible': {
      outline: `2px solid ${tokens.primary[700]}`,
      outlineOffset: '2px', // Increased for better visibility
    },
    '& .MuiChip-label': {
      paddingLeft: '12px',
      paddingRight: '12px',
    },
    '& .MuiChip-icon': {
      fontSize: '1rem', // 16px - slightly larger for better visibility
      color: 'inherit',
      marginLeft: '8px',
      marginRight: '-4px',
    },
    '& .MuiChip-deleteIcon': {
      fontSize: '1.125rem', // 18px - larger delete icon for better touch target
    },
  };
});

/**
 * MuiPill: Reusable Material Pill component.
 * Uses design tokens from theme/mui-theme.ts for consistent theming.
 * `color` is passed via sx prop to StyledChip to avoid MUI Chip color type conflict.
 */
export const MuiPill: FC<MuiPillProps> = ({ color, ...props }: MuiPillProps) => {
  const variant = (color ?? 'default') as PillColorVariant;
  const palette = pillColors as Record<string, { bg: string; text: string; border: string; hoverBg?: string }>;
  const selected = palette[variant];

  return (
    <StyledChipBase
      {...props}
      sx={{
        backgroundColor: selected.bg,
        color: selected.text,
        border: `1px solid ${selected.border}`,
        '&:hover': {
          backgroundColor: selected.hoverBg,
          boxShadow: tokens.shadow.sm,
        },
        ...(props.sx as object),
      }}
    />
  );
};


