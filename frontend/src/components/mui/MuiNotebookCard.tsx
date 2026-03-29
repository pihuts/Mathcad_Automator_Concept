import { Paper, styled } from '@mui/material';
import { tokens } from '../../theme/mui-theme';

/**
 * NotebookCard: Uses design tokens for theming.
 * Used for the main workflow sheets/cards in the center panel.
 * Supports dark mode via theme background.paper
 */
export const MuiNotebookCard = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: tokens.radius.xl,
  padding: theme.spacing(3),
  border: `1px solid ${theme.palette.divider}`,
  transition: `box-shadow ${tokens.transition.slow}`,
  '&:hover': {
    boxShadow: theme.shadows[3],
  },
}));

/**
 * BentoCard: Uses design tokens for theming.
 * Used for grouped settings in the right panel.
 * Supports dark mode via theme background.paper
 */
export const MuiBentoCard = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: tokens.radius.md,
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  transition: `transform ${tokens.transition.normal}, box-shadow ${tokens.transition.normal}`,
  cursor: 'pointer',
  '&:hover': {
    boxShadow: theme.shadows[2],
  },
  '&:active': {
    transform: 'scale(0.98)',
  },
}));
