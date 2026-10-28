import React, { useEffect, useRef, useState } from 'react';
import { Columns, Rows, X, Terminal as TerminalIcon } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { KhmerUnicodeAddon } from '../utils/khmerUnicode';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { TerminalSettings, SplitDirection } from '../types/terminal';
import { computeFontFamily, isTauriEnv, PtyOutputPayload } from '../utils/terminalSessions';
import { getTheme } from '../utils/theme';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Use representative clusters instead of a Latin-only sample. This makes the
// Font Loading API wait for the Khmer glyph face selected by unicode-range.
const KHMER_FONT_SAMPLE = 'សួស្តី កម្ពុជា ស្ត្រី ព្រះវិហារ ជើង ្ត ្រ ្ក ្ព ្ទ ញ្ជ ង្ក';
const LATIN_FONT_SAMPLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_@#%';

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
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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

  const isFocusedRef = useRef(isFocused);
  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Terminal lifecycle (mount once per pane)
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const fontFamily = computeFontFamily(settingsRef.current);
    const term = new Terminal({
      allowProposedApi: true,
      fontFamily,
      fontSize: settingsRef.current.fontSize,
      lineHeight: settingsRef.current.lineHeight || 1.2,
      letterSpacing: 0,
      cursorStyle: settingsRef.current.cursorStyle,
      cursorBlink: settingsRef.current.cursorBlink,
      theme: getTheme(settingsRef.current.theme),
      scrollback: 5000,
      cursorInactiveStyle: 'outline',
      convertEol: false,
      windowsMode: false,
      windowsPty: {
        backend: 'conpty',
        buildNumber: 22000,
      },
    });

    const fitAddon = new FitAddon();
    const khmerAddon = new KhmerUnicodeAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(khmerAddon);
    term.loadAddon(webLinksAddon);

    term.open(container);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Tag DOM spans that contain Khmer text so CSS only relaxes spacing / enables
    // CTL shaping for Khmer clusters, without affecting TUI/ASCII output.
    const classifyKhmerSpans = () => {
      const spans = container.querySelectorAll('.xterm-rows span');
      for (const span of spans) {
        const hasKhmer = /[\u1780-\u17FF]/.test(span.textContent || '');
        (span as HTMLElement).classList.toggle('kui-khmer', hasKhmer);
      }
    };
    const renderDisposable = term.onRender(classifyKhmerSpans);
    // Classify any already-rendered spans immediately as well.
    requestAnimationFrame(classifyKhmerSpans);

    const safeFit = () => {
      try {
        if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
          return;
        }
        fitAddon.fit();
        const cols = term.cols;
        const rows = term.rows;
        if (isTauriEnv() && cols > 0 && rows > 0) {
          invoke('resize_pty', { sessionId, cols, rows }).catch(() => {});
        }
      } catch {
        // ignore
      }
    };

    safeFit();

    // Re-fit and refresh when web fonts (Kantumruy Pro / JetBrains Mono) finish loading
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        safeFit();
        try {
          term.refresh(0, term.rows - 1);
        } catch {
          // ignore
        }
      });
    }

      // Keyboard shortcut routing
      term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        const code = e.code;
        const key = e.key ? e.key.toUpperCase() : '';
        const keyCode = e.keyCode || e.which || 0;
        const isD = code === 'KeyD' || key === 'D' || keyCode === 68 || e.key === 'ឌ' || e.key === 'ដ';
        const isE = code === 'KeyE' || key === 'E' || keyCode === 69 || e.key === 'ែ' || e.key === 'េ';
        const isX = code === 'KeyX' || key === 'X' || keyCode === 88 || e.key === 'ខ';
        const isT = code === 'KeyT' || key === 'T' || keyCode === 84 || e.key === 'ធ';
        const isW = code === 'KeyW' || key === 'W' || keyCode === 87 || e.key === 'ឹ';

        const isSplitRight =
          (((e.ctrlKey && e.shiftKey) || (e.altKey && e.shiftKey) || (e.ctrlKey && e.altKey)) && isD) ||
          ((e.ctrlKey || e.altKey) && e.shiftKey && code === 'ArrowRight');

        const isSplitDown =
          (((e.ctrlKey && e.shiftKey) || (e.altKey && e.shiftKey) || (e.ctrlKey && e.altKey)) && isE) ||
          ((e.ctrlKey || e.altKey) && e.shiftKey && code === 'ArrowDown');

        if (isSplitRight) {
          if (e.type === 'keydown') {
            e.preventDefault();
            e.stopPropagation();
            onSplitRef.current?.('vertical');
          }
          return false;
        }

        if (isSplitDown) {
          if (e.type === 'keydown') {
            e.preventDefault();
            e.stopPropagation();
            onSplitRef.current?.('horizontal');
          }
          return false;
        }

        const isAppShortcut =
          (e.ctrlKey && e.shiftKey && (isT || isW || isX || isD || isE)) ||
          (e.altKey && e.shiftKey && (isD || isE)) ||
          (e.ctrlKey && !e.shiftKey && !e.altKey && (code === 'Comma' || e.key === ',' || keyCode === 188)) ||
          (e.ctrlKey && !e.altKey && (code === 'Equal' || code === 'NumpadAdd' || e.key === '=' || e.key === '+' || keyCode === 187 || keyCode === 107)) ||
          (e.ctrlKey && !e.altKey && (code === 'Minus' || code === 'NumpadSubtract' || e.key === '-' || keyCode === 189 || keyCode === 109)) ||
          (e.ctrlKey && !e.altKey && (code === 'Digit0' || code === 'Numpad0' || e.key === '0' || keyCode === 48 || keyCode === 96));

        if (isAppShortcut) {
          return false;
        }
        return true;
      });

      term.textarea?.addEventListener('focus', () => {
        onFocusRef.current?.();
      });

      term.onData((data) => {
        if (isTauriEnv()) {
          invoke('write_to_pty', { sessionId, data }).catch(() => {});
        }
      });

      term.onBinary((data) => {
        if (isTauriEnv()) {
          invoke('write_to_pty', { sessionId, data }).catch(() => {});
        }
      });

      // ResizeObserver for responsive layout changes
      let rafId: number | null = null;
      const triggerFit = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(safeFit);
      };

      const ro = new ResizeObserver(triggerFit);
      ro.observe(container);
      window.addEventListener('resize', triggerFit);

      // Initial fit
      triggerFit();

      // Spawn PTY process
      let unlistenOutput: (() => void) | undefined;
      let unlistenClosed: (() => void) | undefined;

      const initPty = async () => {
        if (isTauriEnv()) {
          setStatusMsg('Connecting...');
          try {
            const [unOutput, unClosed] = await Promise.all([
              listen<PtyOutputPayload>('pty-output', (event) => {
                if (event.payload.session_id === sessionId) {
                  term.write(event.payload.data);
                }
              }),
              listen<PtyOutputPayload>('pty-closed', (event) => {
                if (event.payload.session_id === sessionId) {
                  setStatusMsg('Closed');
                  term.writeln('\r\n\x1b[90m[Process completed — press Enter to dismiss]\x1b[0m');
                }
              }),
            ]);

            unlistenOutput = unOutput;
            unlistenClosed = unClosed;

            triggerFit();

            const initialCols = term.cols > 0 ? term.cols : 80;
            const initialRows = term.rows > 0 ? term.rows : 24;

            await invoke('spawn_pty', {
              sessionId,
              shell: settingsRef.current.shell.trim() || null,
              cols: initialCols,
              rows: initialRows,
            });

            setStatusMsg('');
            triggerFit();
          } catch (err) {
            setStatusMsg('Error');
            term.writeln(`\r\n\x1b[31;1m[KUI Error]\x1b[0m Failed to spawn shell: ${err}\r\n`);
          }
        } else {
          term.writeln('\r\n\x1b[33;1m[KUI Desktop]\x1b[0m KUI is running in browser preview.');
          term.writeln('Native PTY requires Tauri desktop runtime (KUI.exe).\r\n');
        }

        if (isFocusedRef.current) {
          term.focus();
        }
      };

      initPty();

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', triggerFit);
      if (rafId) cancelAnimationFrame(rafId);
      renderDisposable?.dispose();
      unlistenOutput?.();
      unlistenClosed?.();
      term.dispose();
      if (isTauriEnv()) {
        invoke('kill_pty', { sessionId }).catch(() => {});
      }
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);


  // Update terminal settings in real time
  useEffect(() => {
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;

    term.options.fontFamily = computeFontFamily(settings);
    term.options.fontSize = settings.fontSize;
    term.options.lineHeight = settings.lineHeight;
    term.options.cursorStyle = settings.cursorStyle;
    term.options.cursorBlink = settings.cursorBlink;
    term.options.theme = getTheme(settings.theme);

    try {
      fitAddon.fit();
      term.refresh(0, term.rows - 1);
    } catch {
      // ignore
    }

    // xterm paints to a canvas. When a bundled font is still loading, its
    // first paint uses a fallback font and will remain that way until the
    // canvas is explicitly refreshed. Wait for the selected Khmer face and
    // both bundled fallbacks, then measure and repaint with the shaped glyphs.
    const refreshWhenFontsReady = async () => {
      if (typeof document === 'undefined' || !document.fonts) return;

      const size = `${settings.fontSize}px`;
      const fontFamilies = Array.from(
        new Set([
          settings.primaryFont,
          settings.khmerFont,
          'JetBrains Mono',
          'Kantumruy Pro',
          'Noto Sans Khmer',
        ])
      );

      try {
        await Promise.all([
          ...fontFamilies.flatMap((family) => [
            document.fonts.load(`400 ${size} "${family}"`, LATIN_FONT_SAMPLE),
            document.fonts.load(`700 ${size} "${family}"`, LATIN_FONT_SAMPLE),
            document.fonts.load(`400 ${size} "${family}"`, KHMER_FONT_SAMPLE),
            document.fonts.load(`700 ${size} "${family}"`, KHMER_FONT_SAMPLE),
          ]),
        ]);
        await document.fonts.ready;
      } catch {
        // Keep the browser/system fallback if a user-selected font is absent.
      }

      // A newer terminal may have replaced this one while fonts were loading.
      if (termRef.current !== term) return;

      try {
        term.clearTextureAtlas();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (term as any)._core?._charSizeService?.measure();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (term as any)._core?._renderService?.clear();
        fitAddon.fit();
        term.refresh(0, term.rows - 1);
      } catch {
        // ignore a terminal that was disposed during a layout update
      }
    };

    void refreshWhenFontsReady();
  }, [settings]);

  // Focus and re-fit when isFocused changes
  useEffect(() => {
    if (isFocused) {
      const raf = requestAnimationFrame(() => {
        try {
          if (containerRef.current && containerRef.current.clientWidth > 0) {
            fitAddonRef.current?.fit();
          }
          termRef.current?.focus();
        } catch {
          // ignore
        }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [isFocused]);

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

        {/* Pane Action Controls */}
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

      {/* xterm.js DOM Container */}
      <div
        ref={containerRef}
        className="flex-1 w-full min-h-0 min-w-0 overflow-hidden p-1 bg-transparent"
      />
    </div>
  );
};
