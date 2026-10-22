import React, { useState, useRef, useCallback } from 'react';
import { PaneNode, SplitDirection, TerminalSettings } from '../types/terminal';
import { findFirstSessionId } from '../utils/tree';
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

        // Identify the divider by the first leaf of its left side. Using the
        // first leaf (instead of only a direct leaf child) keeps nested
        // splits resizable.
        const firstLeafId = findFirstSessionId(children[0]);
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

  const firstStyle: React.CSSProperties = isVertical
    ? { flex: `${ratio} 1 0%`, width: 0, minWidth: 0 }
    : { flex: `${ratio} 1 0%`, height: 0, minHeight: 0 };

  const secondStyle: React.CSSProperties = isVertical
    ? { flex: `${1 - ratio} 1 0%`, width: 0, minWidth: 0 }
    : { flex: `${1 - ratio} 1 0%`, height: 0, minHeight: 0 };

  return (
    <div
      ref={containerRef}
      className={`h-full w-full flex ${
        isVertical ? 'flex-row' : 'flex-col'
      } overflow-hidden relative ${isDragging ? 'select-none' : ''}`}
    >
      {/* First Child Pane */}
      <div
        key={children[0].type === 'leaf' ? children[0].sessionId : 'split-0'}
        style={firstStyle}
        className="h-full w-full min-w-0 min-h-0 overflow-hidden relative"
      >
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
      <div
        key={children[1].type === 'leaf' ? children[1].sessionId : 'split-1'}
        style={secondStyle}
        className="h-full w-full min-w-0 min-h-0 overflow-hidden relative"
      >
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
