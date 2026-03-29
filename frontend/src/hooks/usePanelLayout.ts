import { useState, useCallback } from 'react';

/**
 * Panel context type for right panel content switching
 */
export type PanelContext = 'default' | 'input-config' | 'library' | 'csv-sources';

/**
 * Selected pill data structure
 */
export interface SelectedPill {
  stepPosition: number;
  inputAlias: string;
  inputName: string;
  inputType: 'numeric' | 'string';
}

/**
 * Panel state management interface
 */
export interface PanelState {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  rightContext: PanelContext;
  selectedPill: SelectedPill | null;
}

/**
 * Hook return type with all panel state management functions
 */
export interface UsePanelLayoutReturn {
  state: PanelState;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setRightContext: (context: PanelContext) => void;
  setSelectedPill: (pill: SelectedPill) => void;
  resetRightPanel: () => void;
  panelSizes: number[];
  setPanelSizes: (sizes: number[]) => void;
}

/**
 * Panel layout state management hook
 *
 * Manages collapse state for left and right panels, context-aware
 * content switching for the right panel, selected pill state, and
 * panel size persistence to localStorage.
 *
 * Based on RESEARCH.md "Pattern 2: Panel Collapse State Management"
 * and "Store Layout in localStorage"
 *
 * @returns Panel state and control functions
 */
export function usePanelLayout(): UsePanelLayoutReturn {
  // Initialize panel sizes from localStorage
  const [panelSizes, setPanelSizes] = useState<number[]>(() => {
    if (typeof window === 'undefined') return [25, 50, 25];
    try {
      const stored = localStorage.getItem('workflow-panel-sizes');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate: must be array of 3 numbers
        if (Array.isArray(parsed) && parsed.length === 3 &&
            parsed.every((v): v is number => typeof v === 'number' && !isNaN(v))) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse panel sizes from localStorage:', e);
    }
    return [25, 50, 25];
  });

  // Persist panel sizes to localStorage when they change
  const handleSetPanelSizes = useCallback((sizes: number[]) => {
    setPanelSizes(sizes);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('workflow-panel-sizes', JSON.stringify(sizes));
      } catch (e) {
        console.warn('Failed to save panel sizes to localStorage:', e);
      }
    }
  }, []);

  const [state, setState] = useState<PanelState>({
    leftCollapsed: false,
    rightCollapsed: false,
    rightContext: 'default',
    selectedPill: null,
  });

  /**
   * Toggle left panel collapse state
   */
  const toggleLeftPanel = () =>
    setState(prev => ({ ...prev, leftCollapsed: !prev.leftCollapsed }));

  /**
   * Toggle right panel collapse state
   */
  const toggleRightPanel = () =>
    setState(prev => ({ ...prev, rightCollapsed: !prev.rightCollapsed }));

  /**
   * Set right panel context and auto-expand if collapsed
   */
  const setRightContext = (context: PanelContext) =>
    setState(prev => ({
      ...prev,
      rightContext: context,
      rightCollapsed: false, // Auto-expand when switching context
    }));

  /**
   * Set selected pill and switch to input-config context
   */
  const setSelectedPill = (pill: SelectedPill) =>
    setState(prev => ({
      ...prev,
      selectedPill: pill,
      rightContext: 'input-config',
      rightCollapsed: false, // Auto-expand when selecting pill
    }));

  /**
   * Reset right panel to default state (clear selection and return to bento)
   */
  const resetRightPanel = useCallback(() =>
    setState(prev => ({
      ...prev,
      selectedPill: null,
      rightContext: 'default',
    })), []);

  return {
    state,
    toggleLeftPanel,
    toggleRightPanel,
    setRightContext,
    setSelectedPill,
    resetRightPanel,
    panelSizes,
    setPanelSizes: handleSetPanelSizes,
  };
}
