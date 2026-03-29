import { useState, type ReactNode } from 'react';
import { Box, useMediaQuery, IconButton, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Panel, Group } from "react-resizable-panels";
import {
  ChevronLeft,
  ChevronRight,
  KeyboardArrowDown as ChevronDown,
  KeyboardArrowUp as ChevronUp,
} from '@mui/icons-material';
import { MuiPanelResizer } from './mui/MuiPanelResizer';
import type { PanelState } from '../hooks/usePanelLayout';
import { tokens } from '../theme/mui-theme';

/**
 * WorkflowThreePanel props interface
 */
export interface WorkflowThreePanelProps {
  /** Content to render in the left panel (Data) */
  leftPanelContent: ReactNode;
  /** Content to render in the center panel (Workflow Canvas) */
  centerPanelContent: ReactNode;
  /** Content to render in the right panel default view (Settings) */
  rightPanelDefaultContent: ReactNode;
  /** Content to render in the right panel when a pill is selected (Input Config) */
  rightPanelPillContent: ReactNode;
  /** Initial panel sizes as percentages [left, center, right] */
  initialSizes?: number[];
  /** Callback when panel sizes change (after drag completes) */
  onSizesChange?: (sizes: number[]) => void;
  /** Panel state from parent (to avoid dual hook instance issue) */
  panelState?: PanelState;
  /** Callback to toggle left panel collapse */
  onToggleLeftPanel?: () => void;
  /** Callback to toggle right panel collapse */
  onToggleRightPanel?: () => void;
}

/**
 * Collapsed left panel strip showing expand button
 */
function CollapsedLeftPanel({ onExpand }: { onExpand: () => void }) {
  return (
    <Box
      sx={{
        width: 40,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRight: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Tooltip title="Show Data Panel" placement="right">
        <IconButton
          onClick={onExpand}
          aria-label="Expand left panel"
          sx={{
            animation: 'pulse-subtle 2s ease-in-out infinite',
          }}
        >
          <ChevronRight />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

/**
 * Collapsed right panel strip showing expand button
 */
function CollapsedRightPanel({ onExpand }: { onExpand: () => void }) {
  return (
    <Box
      sx={{
        width: 40,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderLeft: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Tooltip title="Show Settings Panel" placement="left">
        <IconButton
          onClick={onExpand}
          aria-label="Expand right panel"
          sx={{
            animation: 'pulse-subtle 2s ease-in-out infinite',
          }}
        >
          <ChevronLeft />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

/**
 * Left panel with header collapse button
 */
function LeftPanel({
  children,
  onCollapse,
}: {
  children: ReactNode;
  onCollapse: () => void;
}) {
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box component="span" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
          Data
        </Box>
        <Tooltip title="Hide Panel" placement="right">
          <IconButton
            size="small"
            onClick={onCollapse}
            aria-label="Collapse left panel"
          >
            <ChevronLeft fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>{children}</Box>
    </Box>
  );
}

/**
 * Right panel with header collapse button
 */
function RightPanel({
  children,
  onCollapse,
}: {
  children: ReactNode;
  onCollapse: () => void;
}) {
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box component="span" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
          Settings
        </Box>
        <Tooltip title="Hide Panel" placement="left">
          <IconButton
            size="small"
            onClick={onCollapse}
            aria-label="Collapse right panel"
          >
            <ChevronRight fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>{children}</Box>
    </Box>
  );
}

/**
 * Three-panel layout container with resizable split panes using react-resizable-panels
 *
 * Features:
 * - 25%-50%-25% initial width distribution (Desktop)
 * - Resizable panels with drag handles
 * - Collapsible side panels (collapse to 40px strips)
 * - Context-aware right panel (default settings vs pill-specific config)
 * - Panel size persistence via onSizesChange callback
 * - Responsive behavior: Tablet (1024px) narrower, Mobile (768px) vertical stack
 * - Visual polish: subtle borders, hover effects, smooth transitions
 *
 * @param props - Panel content props
 * @returns Three-panel layout component
 */
export function WorkflowThreePanel({
  leftPanelContent,
  centerPanelContent,
  rightPanelDefaultContent,
  rightPanelPillContent,
  initialSizes = [25, 50, 25],
  onSizesChange: _onSizesChange,
  panelState,
  onToggleLeftPanel,
  onToggleRightPanel,
}: WorkflowThreePanelProps) {
  const theme = useTheme();
  // Responsive hooks
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Mobile drawer state
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

  // Use panelState from props if provided (from parent), otherwise fall back to local state
  const { leftCollapsed, rightCollapsed, selectedPill } = panelState || {
    leftCollapsed: false,
    rightCollapsed: false,
    selectedPill: null,
  };

  const handleToggleLeftPanel = onToggleLeftPanel || (() => {});
  const handleToggleRightPanel = onToggleRightPanel || (() => {});

  // Determine right panel content based on selectedPill (instant swap, no animation)
  const rightPanelContent = selectedPill ? rightPanelPillContent : rightPanelDefaultContent;

  // MOBILE VIEW: Vertical stacked layout
  if (isMobile) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          gap: 1,
          p: 1,
        }}
      >
        {/* Left panel as collapsible section */}
        <Box
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <Box
            role="button"
            tabIndex={0}
            aria-expanded={leftDrawerOpen}
            aria-controls="mobile-left-panel-content"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1,
              cursor: 'pointer',
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              },
            }}
            onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setLeftDrawerOpen(!leftDrawerOpen);
              }
            }}
          >
            <Box component="span" sx={{ fontWeight: 600 }}>
              Data Sources
            </Box>
            <IconButton size="small" aria-hidden tabIndex={-1}>
              {leftDrawerOpen ? <ChevronUp fontSize="small" /> : <ChevronDown fontSize="small" />}
            </IconButton>
          </Box>
          {leftDrawerOpen && (
            <Box id="mobile-left-panel-content" sx={{ p: 1 }}>{leftPanelContent}</Box>
          )}
        </Box>

        {/* Center panel - always visible, takes priority */}
        <Box
          sx={{
            flex: 1,
            bgcolor: 'background.paper',
            borderRadius: 3,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 2,
              py: 1,
              borderBottom: '1px solid',
          borderColor: 'divider',
            }}
          >
            <Box component="span" sx={{ fontWeight: 600 }}>
              Workflow Canvas
            </Box>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>{centerPanelContent}</Box>
        </Box>

        {/* Right panel as bottom section */}
        <Box
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <Box
            role="button"
            tabIndex={0}
            aria-expanded={rightDrawerOpen}
            aria-controls="mobile-right-panel-content"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1,
              cursor: 'pointer',
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              },
            }}
            onClick={() => setRightDrawerOpen(!rightDrawerOpen)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setRightDrawerOpen(!rightDrawerOpen);
              }
            }}
          >
            <Box component="span" sx={{ fontWeight: 600 }}>
              {selectedPill ? 'Pill Configuration' : 'Workflow Settings'}
            </Box>
            <IconButton size="small" aria-hidden tabIndex={-1}>
              {rightDrawerOpen ? <ChevronUp fontSize="small" /> : <ChevronDown fontSize="small" />}
            </IconButton>
          </Box>
          {rightDrawerOpen && (
            <Box id="mobile-right-panel-content" sx={{ p: 1 }}>{rightPanelContent}</Box>
          )}
        </Box>
      </Box>
    );
  }

  // DESKTOP/TABLET VIEW: Split pane layout
  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        bgcolor: tokens.surface.canvas,
        p: 0.5,
      }}
    >
      <Group orientation="horizontal" id="workflow-three-panel">
        {/* Left Panel - Data */}
        {leftCollapsed ? (
          <Panel id="left-collapsed" defaultSize={2} minSize={2} maxSize={2}>
            <CollapsedLeftPanel onExpand={handleToggleLeftPanel} />
          </Panel>
        ) : (
          <>
            <Panel
              id="left-panel"
              defaultSize={initialSizes[0]}
              minSize={isTablet ? 15 : 20}
              maxSize={isTablet ? 35 : 40}
            >
              <LeftPanel onCollapse={handleToggleLeftPanel}>{leftPanelContent}</LeftPanel>
            </Panel>
            <MuiPanelResizer />
          </>
        )}

        {/* Center Panel - Workflow Canvas */}
        <Panel id="center-panel" minSize={30}>
          <Box
            sx={{
              height: '100%',
              overflow: 'auto',
              bgcolor: tokens.surface.canvas,
              p: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {centerPanelContent}
          </Box>
        </Panel>

        {/* Right Panel - Context-Aware Settings */}
        {rightCollapsed ? (
          <Panel id="right-collapsed" defaultSize={2} minSize={2} maxSize={2}>
            <CollapsedRightPanel onExpand={handleToggleRightPanel} />
          </Panel>
        ) : (
          <>
            <MuiPanelResizer />
            <Panel
              id="right-panel"
              defaultSize={initialSizes[2]}
              minSize={isTablet ? 15 : 20}
              maxSize={isTablet ? 35 : 40}
            >
              <RightPanel onCollapse={handleToggleRightPanel}>{rightPanelContent}</RightPanel>
            </Panel>
          </>
        )}
      </Group>
    </Box>
  );
}
