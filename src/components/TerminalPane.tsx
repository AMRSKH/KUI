import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Columns, Rows, X, Terminal as TerminalIcon } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { TerminalSettings, SplitDirection } from '../types/terminal';
import { getTheme } from '../utils/theme';

interface TerminalPaneProps {
  sessionId: string;
  isFocused: boolean;
  settings: TerminalSettings;
  onFocus: () => void;
  onSplit: (direction: SplitDirection) => void;
  onClose: () => void;
  canClose: boolean;
}

interface PtyOutputPayload {
  session_id: string;
  data: string;
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
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [, setIsSpawned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Compute font family chain specifically tailored for Khmer CTL + Monospace
  const computedFontFamily = `"${settings.primaryFont}", "${settings.khmerFont}", "Kantumruy Pro", "Noto Sans Khmer", monospace`;

  // Safely resize PTY
  const handleResize = useCallback(() => {
    if (!termRef.current || !fitAddonRef.current || !containerRef.current) return;
    try {
      fitAddonRef.current.fit();
      const cols = termRef.current.cols;
      const rows = termRef.current.rows;
      if (cols > 0 && rows > 0) {
        invoke('resize_pty', { sessionId, cols, rows }).catch(() => {
          // Ignore resize errors if pty is already closed or restarting
        });
      }
    } catch {
      // Container might be zero-width during split transitions
    }
  }, [sessionId]);

  // Initialize terminal instance and spawn PTY
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Initialize Terminal with Khmer Unicode 11 support & zero-clipping line height
    const term = new Terminal({
      allowProposedApi: true,
      fontFamily: computedFontFamily,
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      cursorStyle: settings.cursorStyle,
      cursorBlink: settings.cursorBlink,
      theme: getTheme(settings.theme),
      scrollback: 5000,
      cursorInactiveStyle: 'outline',
      convertEol: true,
      windowsMode: true,
    });

    // 2. Addons
    const fitAddon = new FitAddon();
    const unicode11Addon = new Unicode11Addon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(unicode11Addon);
    term.loadAddon(webLinksAddon);

    // CRITICAL for Khmer script: Activate Unicode 11 grapheme cluster width calculation
    term.unicode.activeVersion = '11';

    term.open(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Fit initial dimensions
    fitAddon.fit();
    const initialCols = term.cols || 80;
    const initialRows = term.rows || 24;

    // 3. Spawn shell backend
    invoke('spawn_pty', {
      sessionId,
      shell: settings.shell.trim() || null,
      cols: initialCols,
      rows: initialRows,
    })
      .then(() => {
        setIsSpawned(true);
      })
      .catch((err) => {
        term.writeln(`\r\n\x1b[31;1m[KUI Error]\x1b[0m Failed to spawn shell: ${err}\r\n`);
      });

    // 4. Handle terminal keyboard / IME / paste input to PTY
    const onDataDisposable = term.onData((data) => {
      invoke('write_to_pty', { sessionId, data }).catch(() => {
        // Ignored
      });
    });

    // 5. Listen to PTY output event emitted by Tauri
    let unlistenOutput: UnlistenFn | null = null;
    let unlistenClosed: UnlistenFn | null = null;

    listen<PtyOutputPayload>('pty-output', (event) => {
      if (event.payload.session_id === sessionId) {
        term.write(event.payload.data);
      }
    }).then((unlisten) => {
      unlistenOutput = unlisten;
    });

    listen<PtyOutputPayload>('pty-closed', (event) => {
      if (event.payload.session_id === sessionId) {
        term.writeln('\r\n\x1b[90m[Process completed]\x1b[0m');
      }
    }).then((unlisten) => {
      unlistenClosed = unlisten;
    });

    // Focus if initial
    if (isFocused) {
      term.focus();
    }

    // Cleanup when pane closes
    return () => {
      onDataDisposable.dispose();
      if (unlistenOutput) unlistenOutput();
      if (unlistenClosed) unlistenClosed();
      invoke('kill_pty', { sessionId }).catch(() => {});
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]); // Only re-create if sessionId changes

  // Update terminal settings in real-time without restarting shell
  useEffect(() => {
    if (!termRef.current) return;
    const term = termRef.current;

    term.options.fontFamily = computedFontFamily;
    term.options.fontSize = settings.fontSize;
    term.options.lineHeight = settings.lineHeight;
    term.options.cursorStyle = settings.cursorStyle;
    term.options.cursorBlink = settings.cursorBlink;
    term.options.theme = getTheme(settings.theme);

    // Refit after font/size change
    handleResize();
  }, [settings, computedFontFamily, handleResize]);

  // Focus terminal when isFocused becomes true
  useEffect(() => {
    if (isFocused && termRef.current) {
      termRef.current.focus();
    }
  }, [isFocused]);

  // ResizeObserver on container div to automatically adapt to split pane adjustments
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    let timeoutId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        handleResize();
      }, 35);
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [handleResize]);

  return (
    <div
      onClick={onFocus}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative h-full w-full flex flex-col bg-kui-darker overflow-hidden transition-all duration-150 ${
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
          <span className="text-[10px] px-1 py-0.2 rounded bg-white/5 text-gray-400">
            CTL
          </span>
        </div>

        {/* Action Controls */}
        <div
          className={`flex items-center space-x-1 transition-opacity ${
            isHovered || isFocused ? 'opacity-100' : 'opacity-40'
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSplit('vertical');
            }}
            title="Split Right (Alt+Shift+D)"
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
            title="Split Down (Alt+Shift+E)"
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

      {/* xterm.js Canvas / DOM Container */}
      <div
        ref={containerRef}
        className="flex-1 w-full h-full overflow-hidden p-1 bg-transparent"
      />
    </div>
  );
};
