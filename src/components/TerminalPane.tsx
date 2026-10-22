import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { KhmerUnicodeAddon } from '../utils/khmerUnicode';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Columns, Rows, X, Terminal as TerminalIcon } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { TerminalSettings, SplitDirection, DEFAULT_SETTINGS } from '../types/terminal';
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

// Reliably detect Tauri — works in both dev and installed production builds.
// __TAURI_INTERNALS__ is injected by the Tauri WebView IPC bridge.
const isTauriEnv = (): boolean => {
  try {
    return (
      typeof window !== 'undefined' &&
      '__TAURI_INTERNALS__' in window &&
      Boolean((window as Record<string, unknown>).__TAURI_INTERNALS__)
    );
  } catch {
    return false;
  }
};

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
  const [isHovered, setIsHovered] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Compute font family chain specifically tailored for Khmer CTL + Monospace
  const computedFontFamily = `"${settings.primaryFont}", "${settings.khmerFont}", "Kantumruy Pro", "Noto Sans Khmer", "Leelawadee UI", "Khmer UI", "DaunPenh", "Segoe UI", monospace`;

  // Safely resize PTY
  const handleResize = useCallback(() => {
    if (!termRef.current || !fitAddonRef.current || !containerRef.current) return;
    try {
      fitAddonRef.current.fit();
      const cols = termRef.current.cols;
      const rows = termRef.current.rows;
      if (isTauriEnv() && cols > 0 && rows > 0) {
        invoke('resize_pty', { sessionId, cols, rows }).catch(() => {});
      }
    } catch {
      // Container might be zero-width during split transitions
    }
  }, [sessionId]);

  // Initialize terminal instance and spawn PTY or Browser Demo Shell
  useEffect(() => {
    if (!containerRef.current) return;
    const isTauri = isTauriEnv();

    // 1. Initialize Terminal with Khmer CTL & cluster-aware Unicode support
    const term = new Terminal({
      allowProposedApi: true,
      fontFamily: computedFontFamily,
      fontSize: settings.fontSize,
      // 1.2 is the minimum height that fits Khmer stacked glyphs (ជើង)
      lineHeight: settings.lineHeight || DEFAULT_SETTINGS.lineHeight,
      letterSpacing: 0,
      cursorStyle: settings.cursorStyle,
      cursorBlink: settings.cursorBlink,
      theme: getTheme(settings.theme),
      scrollback: 5000,
      cursorInactiveStyle: 'outline',
      convertEol: true,
      // ConPTY on Windows 11 (>= 21376) handles wrapping natively, so xterm.js
      // must not assume lines are wrapped (this replaces the deprecated
      // `windowsMode` option).
      windowsPty: {
        backend: 'conpty',
        buildNumber: 22000,
      },
    });

    // 2. Addons
    const fitAddon = new FitAddon();
    const khmerAddon = new KhmerUnicodeAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(khmerAddon);
    term.loadAddon(webLinksAddon);

    let onDataDisposable = { dispose: () => {} };
    let onBinaryDisposable = { dispose: () => {} };
    let onResizeDisposable = { dispose: () => {} };
    let unlistenOutput: UnlistenFn | null = null;
    let unlistenClosed: UnlistenFn | null = null;
    let isDisposed = false;

    // Load fonts before opening terminal to prevent overlapping Khmer glyphs
    const initTerminal = async () => {
      if (typeof document !== 'undefined' && document.fonts) {
        try {
          await document.fonts.ready;
          await Promise.all([
            document.fonts.load(`${settings.fontSize}px "${settings.primaryFont}"`),
            document.fonts.load(`${settings.fontSize}px "${settings.khmerFont}"`),
          ]);
        } catch {
          // Ignore font loading errors and continue
        }
      }

      if (isDisposed || !containerRef.current) return;

      term.open(containerRef.current);
      termRef.current = term;
      fitAddonRef.current = fitAddon;

      // Allow app global shortcuts to bypass xterm and bubble to window
      term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        const code = e.code;
        const key = e.key ? e.key.toUpperCase() : '';
        const isD = code === 'KeyD' || key === 'D' || e.key === 'ឌ';
        const isE = code === 'KeyE' || key === 'E' || e.key === 'ែ';
        const isX = code === 'KeyX' || key === 'X' || e.key === 'ខ';
        const isT = code === 'KeyT' || key === 'T' || e.key === 'ធ';
        const isW = code === 'KeyW' || key === 'W' || e.key === 'ឹ';

        const isAppShortcut =
          (e.ctrlKey && e.shiftKey && (isT || isW || isX || isD || isE)) ||
          (e.altKey && e.shiftKey && (isD || isE)) ||
          (e.ctrlKey && !e.shiftKey && !e.altKey && (code === 'Comma' || e.key === ',')) ||
          (e.ctrlKey && !e.altKey && (code === 'Equal' || code === 'NumpadAdd' || e.key === '=' || e.key === '+')) ||
          (e.ctrlKey && !e.altKey && (code === 'Minus' || code === 'NumpadSubtract' || e.key === '-')) ||
          (e.ctrlKey && !e.altKey && (code === 'Digit0' || code === 'Numpad0' || e.key === '0')) ||
          (code === 'Escape' || e.key === 'Escape');

        if (isAppShortcut) {
          return false;
        }
        return true;
      });

      term.textarea?.addEventListener('focus', () => {
        onFocus();
      });

      // Initial fit after open
      try {
        fitAddon.fit();
      } catch {
        // Container might be zero-width
      }

      // Re-fit again once fonts are completely settled
      if (typeof document !== 'undefined' && document.fonts) {
        document.fonts.ready.then(() => {
          if (!isDisposed) {
            handleResize();
          }
        });
      }

      const initialCols = term.cols || 80;
      const initialRows = term.rows || 24;

      if (isTauri) {
        // === TAURI NATIVE PTY MODE ===
        setStatusMsg('Connecting...');
        invoke('spawn_pty', {
          sessionId,
          shell: settings.shell.trim() || null,
          cols: initialCols,
          rows: initialRows,
        })
          .then(() => {
            if (isDisposed) return;
            setStatusMsg('');
            // Re-fit and synchronize exact container dimensions with ConPTY immediately
            if (fitAddonRef.current && termRef.current) {
              try {
                fitAddonRef.current.fit();
                const c = termRef.current.cols;
                const r = termRef.current.rows;
                if (c > 0 && r > 0) {
                  invoke('resize_pty', { sessionId, cols: c, rows: r }).catch(() => {});
                }
              } catch {
                // ignore
              }
            }
          })
          .catch((err) => {
            if (isDisposed) return;
            setStatusMsg('Error');
            term.writeln(`\r\n\x1b[31;1m[KUI Error]\x1b[0m Failed to spawn shell: ${err}\r\n`);
          });

        // Synchronize PTY size whenever xterm grid changes
        onResizeDisposable = term.onResize(({ cols, rows }) => {
          if (cols > 0 && rows > 0) {
            invoke('resize_pty', { sessionId, cols, rows }).catch(() => {});
          }
        });

        // Forward every keypress / paste to the PTY
        onDataDisposable = term.onData((data) => {
          invoke('write_to_pty', { sessionId, data }).catch(() => {});
        });

        // Forward binary streams
        onBinaryDisposable = term.onBinary((data) => {
          invoke('write_to_pty', { sessionId, data }).catch(() => {});
        });

        // Stream PTY output back to xterm
        listen<PtyOutputPayload>('pty-output', (event) => {
          if (event.payload.session_id === sessionId) {
            term.write(event.payload.data);
          }
        }).then((unlisten) => {
          if (isDisposed) unlisten();
          else unlistenOutput = unlisten;
        });

        listen<PtyOutputPayload>('pty-closed', (event) => {
          if (event.payload.session_id === sessionId) {
            setStatusMsg('Closed');
            term.writeln('\r\n\x1b[90m[Process completed — press Enter to dismiss]\x1b[0m');
          }
        }).then((unlisten) => {
          if (isDisposed) unlisten();
          else unlistenClosed = unlisten;
        });
      } else {
        term.writeln('\r\n\x1b[33;1m[KUI Desktop]\x1b[0m KUI is designed as a desktop terminal application.');
        term.writeln('Native PTY requires Tauri desktop runtime (\x1b[36mnpm run tauri dev\x1b[0m or KUI.exe).\r\n');
      }

      if (isFocused) {
        term.focus();
      }
    };

    initTerminal();

    return () => {
      isDisposed = true;
      onDataDisposable.dispose();
      onBinaryDisposable.dispose();
      onResizeDisposable.dispose();
      if (unlistenOutput) unlistenOutput();
      if (unlistenClosed) unlistenClosed();
      if (isTauri) {
        invoke('kill_pty', { sessionId }).catch(() => {});
      }
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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

    // Re-measure after runtime font changes
    if (typeof document !== 'undefined' && document.fonts) {
      Promise.all([
        document.fonts.ready,
        document.fonts.load(`${settings.fontSize}px "${settings.primaryFont}"`),
        document.fonts.load(`${settings.fontSize}px "${settings.khmerFont}"`),
      ])
        .then(() => {
          handleResize();
          term.refresh(0, term.rows - 1);
        })
        .catch(() => {
          handleResize();
        });
    } else {
      handleResize();
    }
  }, [settings, computedFontFamily, handleResize]);

  // Focus terminal and re-fit when isFocused becomes true (e.g. switching tabs)
  useEffect(() => {
    if (isFocused && termRef.current) {
      requestAnimationFrame(() => {
        handleResize();
        termRef.current?.focus();
      });
    }
  }, [isFocused, handleResize]);

  // Responsive ResizeObserver & Window Resize handler for all window sizes & DPIs
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

    // Initial trigger
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
      className={`relative h-full w-full min-h-0 min-w-0 flex flex-col bg-kui-darker overflow-hidden transition-all duration-150 ${
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
            onClick={(e) => { e.stopPropagation(); onSplit('vertical'); }}
            title="Split Right (Ctrl+Shift+D / Alt+Shift+D)"
            className="p-1 rounded hover:bg-white/10 hover:text-cyan-400 text-gray-400 transition-colors"
          >
            <Columns size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSplit('horizontal'); }}
            title="Split Down (Ctrl+Shift+E / Alt+Shift+E)"
            className="p-1 rounded hover:bg-white/10 hover:text-cyan-400 text-gray-400 transition-colors"
          >
            <Rows size={13} />
          </button>
          {canClose && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
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
