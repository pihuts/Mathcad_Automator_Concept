import { Separator } from "react-resizable-panels";
import { Box, styled } from "@mui/material";
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { tokens } from '../../theme/mui-theme';

const ResizerLine = styled(Box)(({ theme }) => ({
  width: '2px',
  height: '100%',
  backgroundColor: theme.palette.divider,
  transition: 'all 0.2s ease',
}));

const DragHandleIconWrapper = styled(Box)(({ theme: _theme }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  backgroundColor: tokens.surface.paper,
  borderRadius: '4px',
  boxShadow: tokens.shadow.sm,
  display: 'flex',
  padding: '2px',
  opacity: 0,
  transition: 'opacity 0.2s ease',
  color: tokens.primary[700],
  pointerEvents: 'none',
}));

/**
 * Custom resizer component for react-resizable-panels using MUI.
 * Uses Separator from react-resizable-panels v4 API.
 */
export const MuiPanelResizer = () => {
  return (
    <Separator className="resizer-handle">
      <ResizerLine className="resizer-line" />
      <DragHandleIconWrapper className="drag-handle-icon">
        <DragIndicatorIcon sx={{ fontSize: 16 }} />
      </DragHandleIconWrapper>
    </Separator>
  );
};
