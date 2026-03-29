import { Modal, Box, Typography, Button, Stack, Chip, Alert } from '@mui/material';
import { Replay, Delete } from '@mui/icons-material';

interface BatchState {
  batch_id: string;
  total: number;
  completed: number;
  status: string;
}

interface RecoveryState {
  has_active_processes: boolean;
  batches?: Record<string, BatchState>;
  workflow_checkpoints?: string[];
  opened_files?: string[];
}

interface RecoveryModalProps {
  state: RecoveryState;
  onContinue: () => void;
  onDiscard: () => void;
  open: boolean;
}

export const RecoveryModal = ({ state, onContinue, onDiscard, open }: RecoveryModalProps) => {
  const { batches, workflow_checkpoints, opened_files } = state;

  const handleContinueClick = () => {
    onContinue();
  };

  const handleDiscardClick = () => {
    onDiscard();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        // Don't close on backdrop click - user must explicitly choose Continue or Discard
      }}
    >
      <Box
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-modal-title"
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          bgcolor: 'background.paper',
          p: 4,
          borderRadius: 2,
          minWidth: { xs: 'calc(100vw - 32px)', sm: 500 },
          maxWidth: 600
        }}
      >
        <Typography id="recovery-modal-title" variant="h6" gutterBottom>
          Resume In Progress?
        </Typography>

        <Alert severity="info" sx={{ mb: 2 }}>
          The application was closed while processes were running.
        </Alert>

        {/* Active processes display */}
        <Stack spacing={2} sx={{ mb: 3 }}>
          {batches && Object.keys(batches).length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Batch Processing
              </Typography>
              {Object.values(batches).map((batch: BatchState) => (
                <Chip
                  key={batch.batch_id}
                  label={`${batch.batch_id}: ${batch.completed}/${batch.total} complete`}
                  size="small"
                  color="primary"
                  sx={{ mr: 0.5 }}
                />
              ))}
            </Box>
          )}

          {workflow_checkpoints && workflow_checkpoints.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Workflow Checkpoints
              </Typography>
              <Typography variant="body2">
                {workflow_checkpoints.length} workflow(s) can be resumed
              </Typography>
            </Box>
          )}

          {opened_files && opened_files.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Opened Files
              </Typography>
              <Typography variant="body2">
                {opened_files.length} file(s) were open
              </Typography>
            </Box>
          )}
        </Stack>

        {/* Action buttons */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="outlined"
            color="error"
            startIcon={<Delete />}
            onClick={handleDiscardClick}
          >
            Discard
          </Button>
          <Button
            variant="contained"
            startIcon={<Replay />}
            onClick={handleContinueClick}
            autoFocus
          >
            Continue
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
};
