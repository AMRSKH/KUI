import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Columns, Rows, X, Terminal as TerminalIcon } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { TerminalSettings, SplitDirection } from '../types/terminal';
import {
  getOrCreateSession,
  updateSessionSettings,
  getSession,
  isTauriEnv,
} from '../utils/terminalSessions';
import { invoke } from '@tauri-apps/api/core';

interface TerminalPaneProps {
  sessionId: string;
  isFocused: boolean;
  settings: TerminalSettings;
  onFocus: () => void;
  onSplit: (direction: SplitDirection) => void;
  onClose: () => void;
  canClose: boolean;
}

export const TerminalPane: React.FC<TerminalPaneProps> = ({
  sessionId,
  isFocused,
  settings,
  onFocus,
  onSplit,
  onClose,
  canClose,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Keep fresh callback references
  const onFocusRef = useRef(onFocus);
  useEffect(() => {
    onFocusRef.current = onFocus;
  }, [onFocus]);

  const onSplitRef = useRef(onSplit);
  useEffect(() => {
    onSplitRef.current = onSplit;
  }, [onSplit]);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Safely resize PTY
  const handleResize = useCallback(() => {
    const session = getSession(sessionId);
    if (!session || !containerRef.current) return;
    try {
      session.fitAddon.fit();
      const cols = session.term.cols;
      const rows = session.term.rows;
      if (isTauriEnv() && cols > 0 && rows > 0) {
        invoke('resize_pty', { sessionId, cols, rows }).catch(() => {});
      }
    } catch {
      // Container might be animating or zero-width
    }
  }, [sessionId]);

  // Connect or mount persistent session
  useEffect(() => {
    if (!containerRef.current) return;

    const session = getOrCreateSession(sessionId, settings);

    // Sync callbacks
    session.onFocus = () => onFocusRef.current?.();
    session.onSplit = (dir) => onSplitRef.current?.(dir);
    session.onClose = () => onCloseRef.current?.();

    // Subscribe to status updates
    const onStatus = (msg: string) => setStatusMsg(msg);
    session.statusSubscribers.add(onStatus);
    setStatusMsg(session.statusMsg);

    // Attach persistent terminal DOM element to this container
    const container = containerRef.current;
    if (session.domElement.parentElement !== container) {
      container.innerHTML = '';
      container.appendChild(session.domElement);
    }

    // Measure & fit cleanly across animation frames
    const rafId = requestAnimationFrame(() => {
      try {
        session.fitAddon.fit();
        if (isFocused) {
          session.term.focus();
        }
      } catch {
        // ignore
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
      session.statusSubscribers.delete(onStatus);
    };
  }, [sessionId, settings, isFocused]);

  // Update terminal settings in real-time without restarting shell
  useEffect(() => {
    updateSessionSettings(sessionId, settings);
  }, [sessionId, settings]);

  // Focus terminal and re-fit when isFocused becomes true (e.g. switching tabs / panes)
  useEffect(() => {
    if (isFocused) {
      const rafId = requestAnimationFrame(() => {
        handleResize();
        const session = getSession(sessionId);
        session?.term.focus();
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [isFocused, handleResize, sessionId]);

  // Responsive ResizeObserver & Window Resize handler
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    let rafId: number | null = null;

    const triggerFit = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        handleResize();
      });
    };

    const observer = new ResizeObserver(triggerFit);
    observer.observe(el);

    window.addEventListener('resize', triggerFit);
    triggerFit();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', triggerFit);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [handleResize]);

  return (
    <div
      onClick={onFocus}
      onFocusCapture={onFocus}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDownCapture={(e) => {
        const code = e.code;
        const key = e.key ? e.key.toUpperCase() : '';
        const keyCode = e.keyCode || e.which || 0;
        const isD = code === 'KeyD' || key === 'D' || keyCode === 68 || e.key === 'ឌ' || e.key === 'ដ';
        const isE = code === 'KeyE' || key === 'E' || keyCode === 69 || e.key === 'ែ' || e.key === 'េ';

        const isSplitRight =
          (((e.ctrlKey && e.shiftKey) || (e.altKey && e.shiftKey) || (e.ctrlKey && e.altKey)) && isD) ||
          ((e.ctrlKey || e.altKey) && e.shiftKey && code === 'ArrowRight');

        const isSplitDown =
          (((e.ctrlKey && e.shiftKey) || (e.altKey && e.shiftKey) || (e.ctrlKey && e.altKey)) && isE) ||
          ((e.ctrlKey || e.altKey) && e.shiftKey && code === 'ArrowDown');

        if (isSplitRight) {
          e.preventDefault();
          e.stopPropagation();
          onSplitRef.current?.('vertical');
        } else if (isSplitDown) {
          e.preventDefault();
          e.stopPropagation();
          onSplitRef.current?.('horizontal');
        }
      }}
      className={`relative h-full w-full min-h-0 min-w-0 flex flex-col bg-kui-darker overflow-hidden ${
        isFocused
          ? 'ring-1 ring-kui-accent/80 shadow-[inset_0_0_10px_rgba(6,182,212,0.12)]'
          : 'ring-1 ring-kui-border/40'
      }`}
    >
      {/* Pane Top Bar Header */}
      <div
        className={`flex items-center justify-between px-2.5 py-1 text-xs select-none border-b transition-colors ${
          isFocused
            ? 'bg-kui-surface/90 border-kui-accent/30 text-gray-200'
            : 'bg-kui-dark/60 border-kui-border/40 text-gray-500'
        }`}
      >
        <div className="flex items-center space-x-1.5 font-mono text-[11px]">
          <TerminalIcon
            size={12}
            className={isFocused ? 'text-kui-accent animate-pulse' : 'text-gray-500'}
          />
          <span className="font-semibold tracking-wider">
            {sessionId.slice(0, 8)}
          </span>
          {statusMsg && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-white/5 text-gray-400">
              {statusMsg}
            </span>
          )}
        </div>

        {/* Pane Action Controls — split & close for THIS pane only */}
        <div
          className={`flex items-center space-x-1 transition-opacity ${
            isHovered || isFocused ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSplit('vertical');
            }}
            title="Split Right (Ctrl+Shift+D / Alt+Shift+D)"
            className="p-1 rounded hover:bg-white/10 hover:text-cyan-400 text-gray-400 transition-colors"
          >
            <Columns size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSplit('horizontal');
            }}
            title="Split Down (Ctrl+Shift+E / Alt+Shift+E)"
            className="p-1 rounded hover:bg-white/10 hover:text-cyan-400 text-gray-400 transition-colors"
          >
            <Rows size={13} />
          </button>
          {canClose && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              title="Close Pane (Ctrl+Shift+X)"
              className="p-1 rounded hover:bg-rose-500/20 hover:text-rose-400 text-gray-400 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* xterm.js Canvas / DOM Container (Zero-padding to prevent edge clipping) */}
      <div
        ref={containerRef}
        className="flex-1 w-full min-h-0 min-w-0 overflow-hidden bg-transparent"
      />
    </div>
  );
};
