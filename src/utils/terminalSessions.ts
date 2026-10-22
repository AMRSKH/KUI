import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { KhmerUnicodeAddon } from './khmerUnicode';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { TerminalSettings, DEFAULT_SETTINGS, SplitDirection } from '../types/terminal';
import { getTheme } from './theme';

export interface PtyOutputPayload {
  session_id: string;
  data: string;
}

export const isTauriEnv = (): boolean => {
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

export interface ManagedSession {
  sessionId: string;
  term: Terminal;
  fitAddon: FitAddon;
  khmerAddon: KhmerUnicodeAddon;
  webLinksAddon: WebLinksAddon;
  domElement: HTMLDivElement;
  isPtySpawned: boolean;
  unlistenOutput?: UnlistenFn;
  unlistenClosed?: UnlistenFn;
  statusMsg: string;
  statusSubscribers: Set<(status: string) => void>;
  onSplit?: (direction: SplitDirection) => void;
  onClose?: () => void;
  onFocus?: () => void;
}

const sessions = new Map<string, ManagedSession>();

export function getSession(sessionId: string): ManagedSession | undefined {
  return sessions.get(sessionId);
}

export function computeFontFamily(settings: TerminalSettings): string {
  return `"${settings.primaryFont}", "${settings.khmerFont}", "Kantumruy Pro", "Noto Sans Khmer", "Leelawadee UI", "Khmer UI", "DaunPenh", "Segoe UI", monospace`;
}

export function getOrCreateSession(
  sessionId: string,
  settings: TerminalSettings
): ManagedSession {
  const existing = sessions.get(sessionId);
  if (existing) {
    return existing;
  }

  const fontFamily = computeFontFamily(settings);

  // 1. Initialize Terminal with Khmer CTL & cluster-aware Unicode support
  const term = new Terminal({
    allowProposedApi: true,
    fontFamily,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight || DEFAULT_SETTINGS.lineHeight,
    letterSpacing: 0,
    cursorStyle: settings.cursorStyle,
    cursorBlink: settings.cursorBlink,
    theme: getTheme(settings.theme),
    scrollback: 5000,
    cursorInactiveStyle: 'outline',
    convertEol: true,
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

  const domElement = document.createElement('div');
  domElement.className = 'w-full h-full overflow-hidden';
  term.open(domElement);

  const session: ManagedSession = {
    sessionId,
    term,
    fitAddon,
    khmerAddon,
    webLinksAddon,
    domElement,
    isPtySpawned: false,
    statusMsg: '',
    statusSubscribers: new Set(),
  };

  const updateStatus = (msg: string) => {
    session.statusMsg = msg;
    for (const sub of session.statusSubscribers) {
      sub(msg);
    }
  };

  // Keyboard shortcut routing from xterm textarea
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
        session.onSplit?.('vertical');
      }
      return false;
    }

    if (isSplitDown) {
      if (e.type === 'keydown') {
        e.preventDefault();
        e.stopPropagation();
        session.onSplit?.('horizontal');
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
    session.onFocus?.();
  });

  term.onResize(({ cols, rows }) => {
    if (isTauriEnv() && cols > 0 && rows > 0) {
      invoke('resize_pty', { sessionId, cols, rows }).catch(() => {});
    }
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

  sessions.set(sessionId, session);

  // Spawn PTY or Browser shell
  const initPty = async () => {
    if (session.isPtySpawned) return;
    session.isPtySpawned = true;

    if (isTauriEnv()) {
      updateStatus('Connecting...');

      // Crucial: Register IPC listeners BEFORE spawning shell so output is never dropped
      try {
        const [unlistenOutput, unlistenClosed] = await Promise.all([
          listen<PtyOutputPayload>('pty-output', (event) => {
            if (event.payload.session_id === sessionId) {
              term.write(event.payload.data);
            }
          }),
          listen<PtyOutputPayload>('pty-closed', (event) => {
            if (event.payload.session_id === sessionId) {
              updateStatus('Closed');
              term.writeln('\r\n\x1b[90m[Process completed — press Enter to dismiss]\x1b[0m');
            }
          }),
        ]);

        session.unlistenOutput = unlistenOutput;
        session.unlistenClosed = unlistenClosed;

        const initialCols = term.cols || 80;
        const initialRows = term.rows || 24;

        await invoke('spawn_pty', {
          sessionId,
          shell: settings.shell.trim() || null,
          cols: initialCols,
          rows: initialRows,
        });

        updateStatus('');

        // Trigger fit and size sync immediately after spawn
        try {
          fitAddon.fit();
          const c = term.cols;
          const r = term.rows;
          if (c > 0 && r > 0) {
            invoke('resize_pty', { sessionId, cols: c, rows: r }).catch(() => {});
          }
        } catch {
          // ignore
        }
      } catch (err) {
        updateStatus('Error');
        term.writeln(`\r\n\x1b[31;1m[KUI Error]\x1b[0m Failed to spawn shell: ${err}\r\n`);
      }
    } else {
      term.writeln('\r\n\x1b[33;1m[KUI Desktop]\x1b[0m KUI is designed as a desktop terminal application.');
      term.writeln('Native PTY requires Tauri desktop runtime (\x1b[36mnpm run tauri dev\x1b[0m or KUI.exe).\r\n');
    }
  };

  initPty();

  return session;
}

export function destroySession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.unlistenOutput?.();
  session.unlistenClosed?.();
  session.statusSubscribers.clear();
  session.term.dispose();
  session.domElement.remove();
  sessions.delete(sessionId);

  if (isTauriEnv()) {
    invoke('kill_pty', { sessionId }).catch(() => {});
  }
}

export function destroySessions(sessionIds: string[]): void {
  for (const sid of sessionIds) {
    destroySession(sid);
  }
}

export function updateSessionSettings(
  sessionId: string,
  settings: TerminalSettings
): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  const fontFamily = computeFontFamily(settings);
  session.term.options.fontFamily = fontFamily;
  session.term.options.fontSize = settings.fontSize;
  session.term.options.lineHeight = settings.lineHeight;
  session.term.options.cursorStyle = settings.cursorStyle;
  session.term.options.cursorBlink = settings.cursorBlink;
  session.term.options.theme = getTheme(settings.theme);

  try {
    session.fitAddon.fit();
    session.term.refresh(0, session.term.rows - 1);
  } catch {
    // ignore
  }
}

export function updateAllSessionsSettings(settings: TerminalSettings): void {
  for (const sessionId of sessions.keys()) {
    updateSessionSettings(sessionId, settings);
  }
}
