export type SplitDirection = 'horizontal' | 'vertical';

export type PaneNode =
  | {
      type: 'leaf';
      sessionId: string;
      title?: string;
    }
  | {
      type: 'split';
      direction: SplitDirection;
      ratio: number; // 0.1 to 0.9
      children: [PaneNode, PaneNode];
    };

export interface TabItem {
  id: string;
  title: string;
  rootPane: PaneNode;
  activeSessionId: string;
}

export type CursorStyle = 'block' | 'underline' | 'bar';

export interface TerminalSettings {
  primaryFont: string;
  khmerFont: string;
  fontSize: number;
  lineHeight: number;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  theme: string;
  shell: string;
}

export const DEFAULT_SETTINGS: TerminalSettings = {
  primaryFont: 'JetBrains Mono',
  khmerFont: 'Kantumruy Pro',
  fontSize: 15,
  lineHeight: 1.2,
  cursorStyle: 'bar',
  cursorBlink: true,
  theme: 'kui-dark',
  shell: '',
};
