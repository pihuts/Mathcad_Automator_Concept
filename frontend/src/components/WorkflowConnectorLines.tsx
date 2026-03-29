import { useRef, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { useTheme } from '@mui/material/styles';
import { tokens } from '../theme/mui-theme';

export interface WorkflowConnectorLinesProps {
  /** Array of unique IDs for each step card, used for positioning */
  stepIds?: string[];
  /** Parent container ref for coordinate calculations */
  containerRef?: RefObject<HTMLDivElement | null>;
}

interface PathData {
  id: string;
  d: string;
}

/**
 * SVG bezier connector lines between workflow step cards.
 * Renders curved lines connecting the bottom of each card to the top of the next.
 */
export const WorkflowConnectorLines = ({
  stepIds = [],
  containerRef,
}: WorkflowConnectorLinesProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme();
  const [paths, setPaths] = useState<PathData[]>([]);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Get stroke color from theme
  const normalStrokeColor = theme.palette.primary.main || tokens.accent[500];

  /**
   * Calculate cubic bezier curve path between two DOM elements.
   * From point: bottom center of source element
   * To point: top center of target element
   */
  const calculatePath = (
    fromElement: Element,
    toElement: Element,
  ): string | null => {
    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();

    // Get container offset if available
    let containerOffset = { left: 0, top: 0 };
    if (containerRef?.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      containerOffset = { left: containerRect.left, top: containerRect.top };
    }

    // Calculate from point (bottom center of source card)
    const fromX = fromRect.left + fromRect.width / 2 - containerOffset.left;
    const fromY = fromRect.bottom - containerOffset.top;

    // Calculate to point (top center of target card)
    const toX = toRect.left + toRect.width / 2 - containerOffset.left;
    const toY = toRect.top - containerOffset.top;

    // Control points for smooth bezier curve
    // Vertical offset creates the "S" curve shape
    const verticalSpacing = toY - fromY;
    const controlY1 = fromY + verticalSpacing * 0.5;
    const controlY2 = toY - verticalSpacing * 0.5;

    // Cubic bezier path: M x1 y1 C cx1 cy1, cx2 cy2, x2 y2
    return `M ${fromX} ${fromY} C ${fromX} ${controlY1}, ${toX} ${controlY2}, ${toX} ${toY}`;
  };

  /**
   * Recalculate all connector paths based on current element positions.
   */
  const recalculatePaths = () => {
    if (!stepIds || stepIds.length < 2) {
      setPaths([]);
      return;
    }

    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      const newPaths: PathData[] = [];

      for (let i = 0; i < stepIds.length - 1; i++) {
        const fromId = stepIds[i];
        const toId = stepIds[i + 1];

        // Skip if either ID is empty
        if (!fromId || !toId) continue;

        const fromElement = document.querySelector(`[data-step-id="${fromId}"]`);
        const toElement = document.querySelector(`[data-step-id="${toId}"]`);

        if (fromElement && toElement) {
          const pathD = calculatePath(fromElement, toElement);
          if (pathD) {
            newPaths.push({
              id: `${fromId}-${toId}`,
              d: pathD,
            });
          }
        }
      }

      setPaths(newPaths);

      // Update container size
      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    });
  };

  // Set up ResizeObserver to recalculate on container size changes
  useEffect(() => {
    if (!containerRef?.current) return;

    const resizeObserver = new ResizeObserver(() => {
      recalculatePaths();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  // Recalculate when step IDs change
  useEffect(() => {
    recalculatePaths();
  }, [stepIds]);

  // Handle window resize with debounce
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        recalculatePaths();
      }, 100); // 100ms debounce
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [stepIds]);

  // Don't render if no paths or container not visible
  if (paths.length === 0) {
    return null;
  }

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: containerSize.width || '100%',
        height: containerSize.height || '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {paths.map((path) => (
        <path
          key={path.id}
          d={path.d}
          stroke={normalStrokeColor}
          strokeWidth={2}
          fill="none"
          opacity={0.8}
        />
      ))}
    </svg>
  );
};
