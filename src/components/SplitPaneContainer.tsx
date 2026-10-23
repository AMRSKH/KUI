import React, { useState, useRef, useCallback, useMemo } from 'react';
import { PaneNode, SplitDirection, TerminalSettings } from '../types/terminal';
import { computeLayout, SplitDividerLayout } from '../utils/tree';
import { TerminalPane } from './TerminalPane';

interface SplitPaneContainerProps {
  node: PaneNode;
  activeSessionId: string;
  settings: TerminalSettings;
  canClose: boolean;
  onFocusSession: (sessionId: string) => void;
  onSplitPane: (targetSessionId: string, direction: SplitDirection) => void;
  onClosePane: (targetSessionId: string) => void;
  onUpdateRatio: (targetFirstChildSessionId: string, ratio: number) => void;
}

export const SplitPaneContainer: React.FC<SplitPaneContainerProps> = ({
  node,
  activeSessionId,
  settings,
  onFocusSession,
  onSplitPane,
  onClosePane,
  onUpdateRatio,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const { leaves, dividers } = useMemo(() => computeLayout(node), [node]);

  const handleDividerMouseDown = useCallback(
    (divider: SplitDividerLayout, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const containerEl = containerRef.current;
      if (!containerEl) return;

      const containerBounds = containerEl.getBoundingClientRect();
      const isVertical = divider.direction === 'vertical';

      // Pixel bounds of the sub-container for this split
      const splitPixelLeft =
        containerBounds.left + (divider.containerRect.left / 100) * containerBounds.width;
      const splitPixelTop =
        containerBounds.top + (divider.containerRect.top / 100) * containerBounds.height;
      const splitPixelWidth = (divider.containerRect.width / 100) * containerBounds.width;
      const splitPixelHeight = (divider.containerRect.height / 100) * containerBounds.height;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        let newRatio: number;
        if (isVertical) {
          const deltaX = moveEvent.clientX - splitPixelLeft;
          newRatio = splitPixelWidth > 0 ? deltaX / splitPixelWidth : 0.5;
        } else {
          const deltaY = moveEvent.clientY - splitPixelTop;
          newRatio = splitPixelHeight > 0 ? deltaY / splitPixelHeight : 0.5;
        }

        const clamped = Math.min(Math.max(newRatio, 0.1), 0.9);
        onUpdateRatio(divider.id, clamped);
      };

      const handleMouseUp = () => {
        setActiveDragId(null);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      setActiveDragId(divider.id);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [onUpdateRatio]
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-kui-darker ${
        activeDragId ? 'select-none' : ''
      }`}
    >
      {/* Panes: Each leaf has a persistent key and NEVER unmounts during layout splits */}
      {leaves.map((leaf) => (
        <div
          key={leaf.sessionId}
          style={{
            position: 'absolute',
            left: `${leaf.rect.left}%`,
            top: `${leaf.rect.top}%`,
            width: `${leaf.rect.width}%`,
            height: `${leaf.rect.height}%`,
          }}
          className="overflow-hidden"
        >
          <TerminalPane
            sessionId={leaf.sessionId}
            isFocused={leaf.sessionId === activeSessionId}
            settings={settings}
            canClose={leaves.length > 1}
            onFocus={() => onFocusSession(leaf.sessionId)}
            onSplit={(dir) => onSplitPane(leaf.sessionId, dir)}
            onClose={() => onClosePane(leaf.sessionId)}
          />
        </div>
      ))}

      {/* Resize Dividers */}
      {dividers.map((divider) => {
        const isVertical = divider.direction === 'vertical';
        const isDragging = activeDragId === divider.id;

        return (
          <div
            key={`divider-${divider.id}-${divider.direction}`}
            onMouseDown={(e) => handleDividerMouseDown(divider, e)}
            style={
              isVertical
                ? {
                    position: 'absolute',
                    left: `${divider.position}%`,
                    top: `${divider.start}%`,
                    height: `${divider.length}%`,
                    width: '6px',
                    transform: 'translateX(-50%)',
                  }
                : {
                    position: 'absolute',
                    top: `${divider.position}%`,
                    left: `${divider.start}%`,
                    width: `${divider.length}%`,
                    height: '6px',
                    transform: 'translateY(-50%)',
                  }
            }
            className={`z-20 group transition-colors ${
              isVertical ? 'cursor-col-resize' : 'cursor-row-resize'
            }`}
          >
            <div
              className={`w-full h-full transition-colors ${
                isDragging
                  ? 'bg-cyan-400'
                  : 'bg-kui-border/60 hover:bg-cyan-500/80 group-hover:bg-cyan-500/80'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
};
