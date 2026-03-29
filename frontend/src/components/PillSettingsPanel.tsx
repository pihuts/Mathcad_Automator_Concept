import {
  Box,
  Typography,
  Button,
  Stack,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { tokens } from '../theme/mui-theme';
import { InputConfigView } from './InputConfigView';
import type { SelectedPill } from '../hooks/usePanelLayout';
import type { InputConfig } from '../services/api';

/**
 * PillSettingsPanel props interface
 */
export interface PillSettingsPanelProps {
  /** The selected input pill to configure */
  selectedInput: SelectedPill;
  /** Callback to return to default (bento) view */
  onBack: () => void;
  /** Available upstream outputs for mapping */
  upstreamOutputs: Array<{ value: string; label: string; group: string }>;
  /** Current mapping for this input */
  currentMapping?: { sourceFile: string; sourceAlias: string };
  /** Current manual value for this input */
  currentValue?: InputConfig;
  /** Callback when mapping changes */
  onMappingChange: (mapping: { sourceFile: string; sourceAlias: string } | null) => void;
  /** Grouped CSV columns from global state */
  csvColumnsGrouped?: Array<{ group: string; columns: Array<{ value: string; label: string; preview: string[] }> }>;
  /** Callback when CSV column is selected */
  onCsvColumnSelect?: (fileId: string, column: string) => void;
}

/**
 * Right panel content for selected input pill configuration
 *
 * A thin wrapper around InputConfigView that adds:
 * - Breadcrumb header with back button
 * - Input header info (alias, name, step position, type badge)
 *
 * Clicking the back button returns the right panel to the default bento view.
 */
export function PillSettingsPanel({
  selectedInput,
  onBack,
  upstreamOutputs,
  currentMapping,
  currentValue,
  onMappingChange,
  csvColumnsGrouped = [],
  onCsvColumnSelect,
}: PillSettingsPanelProps) {
  const { stepPosition, inputAlias, inputName, inputType } = selectedInput;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 3 }}>
      {/* Back Button */}
      <Box sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBack sx={{ fontSize: 18 }} />}
          onClick={onBack}
          sx={{
            color: tokens.primary[700],
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            '&:hover': { backgroundColor: 'transparent', textDecoration: 'underline' },
            p: 0,
            minWidth: 0,
          }}
        >
          Back
        </Button>
      </Box>

      {/* Input header info */}
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            fontFamily: tokens.fontStack.mono,
            color: tokens.primary[800],
          }}
        >
          {inputAlias}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            {inputName}
          </Typography>
          <Typography variant="caption" color="text.disabled">•</Typography>
          <Typography variant="body2" color="text.secondary">
            Step {stepPosition + 1}
          </Typography>
        </Stack>
      </Stack>

      {/* InputConfigView - pass all props through */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <InputConfigView
          key={`${stepPosition}-${inputAlias}`}
          inputAlias={inputAlias}
          inputName={inputName}
          inputType={inputType}
          stepPosition={stepPosition}
          upstreamOutputs={upstreamOutputs}
          currentMapping={currentMapping}
          currentValue={currentValue}
          onMappingChange={onMappingChange}
          csvColumnsGrouped={csvColumnsGrouped}
          onCsvColumnSelect={onCsvColumnSelect}
        />
      </Box>
    </Box>
  );
}