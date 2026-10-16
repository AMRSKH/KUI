import React, { useState, useRef, useCallback } from 'react';
import { PaneNode, SplitDirection, TerminalSettings } from '../types/terminal';
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
  canClose,
  onFocusSession,
  onSplitPane,
  onClosePane,
  onUpdateRatio,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // If this node is a leaf, render the TerminalPane directly
  if (node.type === 'leaf') {
    return (
      <TerminalPane
        sessionId={node.sessionId}
        isFocused={node.sessionId === activeSessionId}
        settings={settings}
        canClose={canClose}
        onFocus={() => onFocusSession(node.sessionId)}
        onSplit={(dir) => onSplitPane(node.sessionId, dir)}
        onClose={() => onClosePane(node.sessionId)}
      />
    );
  }

  const { direction, ratio, children } = node;
  const isVertical = direction === 'vertical'; // left/right

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const totalSize = isVertical ? containerRect.width : containerRect.height;
      const initialRatio = ratio;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = isVertical
          ? moveEvent.clientX - startX
          : moveEvent.clientY - startY;

        const deltaRatio = delta / totalSize;
        const newRatio = Math.min(Math.max(initialRatio + deltaRatio, 0.1), 0.9);

        // Find identifier for this split node
        const firstLeafId =
          children[0].type === 'leaf'
            ? children[0].sessionId
            : '';
        if (firstLeafId) {
          onUpdateRatio(firstLeafId, newRatio);
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [isVertical, ratio, children, onUpdateRatio]
  );

  const firstStyle = isVertical
    ? { width: `${ratio * 100}%` }
    : { height: `${ratio * 100}%` };

  const secondStyle = isVertical
    ? { width: `${(1 - ratio) * 100}%` }
    : { height: `${(1 - ratio) * 100}%` };

  return (
    <div
      ref={containerRef}
      className={`h-full w-full flex ${
        isVertical ? 'flex-row' : 'flex-col'
      } overflow-hidden relative select-none`}
    >
      {/* First Child Pane */}
      <div style={firstStyle} className="h-full overflow-hidden">
        <SplitPaneContainer
          node={children[0]}
          activeSessionId={activeSessionId}
          settings={settings}
          canClose={canClose}
          onFocusSession={onFocusSession}
          onSplitPane={onSplitPane}
          onClosePane={onClosePane}
          onUpdateRatio={onUpdateRatio}
        />
      </div>

      {/* Resize Divider Bar */}
      <div
        onMouseDown={handleMouseDown}
        className={`relative z-10 flex-shrink-0 transition-colors ${
          isVertical
            ? 'w-[5px] cursor-col-resize hover:bg-cyan-500/70'
            : 'h-[5px] cursor-row-resize hover:bg-cyan-500/70'
        } ${isDragging ? 'bg-cyan-500' : 'bg-kui-border/60 hover:bg-cyan-500/50'}`}
      >
        <div
          className={`absolute inset-0 ${
            isVertical ? '-left-1 -right-1' : '-top-1 -bottom-1'
          }`}
        />
      </div>

      {/* Second Child Pane */}
      <div style={secondStyle} className="h-full overflow-hidden">
        <SplitPaneContainer
          node={children[1]}
          activeSessionId={activeSessionId}
          settings={settings}
          canClose={canClose}
          onFocusSession={onFocusSession}
          onSplitPane={onSplitPane}
          onClosePane={onClosePane}
          onUpdateRatio={onUpdateRatio}
        />
      </div>
    </div>
  );
};
