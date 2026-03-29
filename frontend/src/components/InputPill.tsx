import { Box, Typography, Tooltip } from '@mui/material';
import { MuiPill } from './mui/MuiPill';
import { tokens } from '../theme/mui-theme';

export interface MappedSource {
  stepIndex: number;
  stepLabel: string;
  outputAlias: string;
}

export interface InputPillProps {
  alias: string;
  mappedSource?: MappedSource;
  valueType: 'number' | 'string';
  valueStatus?: string;
  isSelected?: boolean;
  onClick: () => void;
}

/**
 * InputPill: MUI refactored version of InputPill.
 * Uses MuiPill with primary (jade) or string (teal accent) theme.
 */
export const InputPill = ({
  alias,
  mappedSource,
  valueType,
  valueStatus,
  isSelected = false,
  onClick,
}: InputPillProps) => {
  // number → jade primary, string → teal accent (brand palette)
  const color = valueType === 'number' ? 'primary' : 'string';

  const pillContent = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: tokens.pill.maxWidth, overflow: 'hidden' }}>
      <Typography 
        variant="caption" 
        sx={{ 
          fontFamily: tokens.fontStack.mono, 
          fontWeight: 600,
          fontSize: '0.875rem'
        }}
      >
        {alias}
      </Typography>

      {mappedSource ? (
        <>
          <Typography variant="caption" sx={{ color: 'text.secondary', mx: 0.25, fontSize: '0.875rem' }} aria-hidden="true">←</Typography>
          <Typography
            variant="caption"
            aria-hidden="true"
            sx={{
              fontFamily: tokens.fontStack.mono,
              color: 'text.secondary',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: '0.875rem'
            }}
          >
            Step {mappedSource.stepIndex}: {mappedSource.outputAlias}
          </Typography>
        </>
      ) : valueStatus ? (
        <>
          <Typography variant="caption" sx={{ color: 'text.secondary', mx: 0.25, fontSize: '0.875rem' }} aria-hidden="true">•</Typography>
          <Typography
            variant="caption"
            aria-hidden="true"
            sx={{
              color: 'text.secondary',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: '0.875rem'
            }}
          >
            {valueStatus}
          </Typography>
        </>
      ) : null}
    </Box>
  );

  const pill = (
    <MuiPill
      color={color}
      label={pillContent}
      role="button"
      aria-label={`Input ${alias}${mappedSource ? ` mapped from Step ${mappedSource.stepIndex}: ${mappedSource.outputAlias}` : valueStatus ? `, ${valueStatus}` : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
      sx={{
        ...(isSelected && {
          borderWidth: '2px',
          borderColor: valueType === 'number' ? tokens.primary[700] : tokens.accent[600],
          // Use solid border instead of glow for WCAG 1.4.11 compliance (3:1 contrast for UI boundaries)
        }),
      }}
    />
  );

  if (mappedSource && valueStatus) {
    return (
      <Tooltip title={valueStatus} arrow placement="top">
        <Box component="span" sx={{ display: 'inline-flex' }}>
          {pill}
        </Box>
      </Tooltip>
    );
  }

  return pill;
};
