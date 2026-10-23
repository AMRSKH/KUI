import { TerminalSettings } from '../types/terminal';
import { invoke } from '@tauri-apps/api/core';

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

export function computeFontFamily(settings: TerminalSettings): string {
  return `"${settings.primaryFont}", "${settings.khmerFont}", "Kantumruy Pro", "Noto Sans Khmer", "Leelawadee UI", "Khmer UI", "DaunPenh", "Segoe UI", monospace`;
}

/**
 * Kill a PTY session via Tauri command.
 */
export function destroySession(sessionId: string): void {
  if (isTauriEnv()) {
    invoke('kill_pty', { sessionId }).catch(() => {});
  }
}

/**
 * Kill multiple PTY sessions.
 */
export function destroySessions(sessionIds: string[]): void {
  for (const sid of sessionIds) {
    destroySession(sid);
  }
}

export function updateAllSessionsSettings(_settings: TerminalSettings): void {
  // Handled declaratively via props in React
}
