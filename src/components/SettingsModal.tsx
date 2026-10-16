import React, { useState } from 'react';
import { X, Sliders, Type, Palette, Terminal as TerminalIcon, Sparkles } from 'lucide-react';
import { TerminalSettings } from '../types/terminal';
import { THEMES } from '../utils/theme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TerminalSettings;
  onUpdateSettings: (newSettings: TerminalSettings) => void;
}

const PRIMARY_FONTS = [
  'JetBrains Mono',
  'Fira Code',
  'Cascadia Code',
  'Consolas',
  'Source Code Pro',
];

const KHMER_FONTS = [
  'Kantumruy Pro',
  'Noto Sans Khmer',
  'Khmer OS Siemreap',
  'Khmer OS Battambang',
  'Siemreap',
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'font' | 'appearance' | 'terminal'>('font');

  if (!isOpen) return null;

  const handleChange = <K extends keyof TerminalSettings>(
    key: K,
    value: TerminalSettings[K]
  ) => {
    const updated = { ...settings, [key]: value };
    onUpdateSettings(updated);
  };

  const previewFontFamily = `"${settings.primaryFont}", "${settings.khmerFont}", "Kantumruy Pro", "Noto Sans Khmer", monospace`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-kui-surface border border-kui-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-kui-border bg-kui-dark/60">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-kui-accent/15 text-kui-accent">
              <Sliders size={20} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-wide">KUI Settings</h2>
              <p className="text-xs text-gray-400">Real-time terminal & Khmer CTL configuration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close Settings (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-kui-border bg-kui-dark/30 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('font')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'font'
                ? 'border-kui-accent text-kui-accent bg-kui-surface'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Type size={15} />
            <span>Fonts & Khmer CTL</span>
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'appearance'
                ? 'border-kui-accent text-kui-accent bg-kui-surface'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Palette size={15} />
            <span>Theme & Colors</span>
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'terminal'
                ? 'border-kui-accent text-kui-accent bg-kui-surface'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <TerminalIcon size={15} />
            <span>Cursor & Shell</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'font' && (
            <div className="space-y-6">
              {/* Primary Code Font */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Primary Code Font
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRIMARY_FONTS.map((font) => (
                    <button
                      key={font}
                      type="button"
                      onClick={() => handleChange('primaryFont', font)}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-all ${
                        settings.primaryFont === font
                          ? 'border-kui-accent bg-kui-accent/20 text-kui-accent font-semibold'
                          : 'border-kui-border bg-kui-dark hover:border-gray-500 text-gray-300'
                      }`}
                    >
                      {font}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={settings.primaryFont}
                  onChange={(e) => handleChange('primaryFont', e.target.value)}
                  placeholder="Or enter custom monospace font..."
                  className="w-full px-3 py-2 text-sm bg-kui-dark border border-kui-border rounded-lg text-gray-200 focus:outline-none focus:border-kui-accent transition-colors"
                />
              </div>

              {/* Khmer Font */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Khmer Unicode Fallback Font</span>
                  <span className="text-[11px] text-cyan-400 font-normal">Complex Text Layout (CTL)</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {KHMER_FONTS.map((font) => (
                    <button
                      key={font}
                      type="button"
                      onClick={() => handleChange('khmerFont', font)}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-all ${
                        settings.khmerFont === font
                          ? 'border-kui-accent bg-kui-accent/20 text-kui-accent font-semibold'
                          : 'border-kui-border bg-kui-dark hover:border-gray-500 text-gray-300'
                      }`}
                    >
                      {font}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={settings.khmerFont}
                  onChange={(e) => handleChange('khmerFont', e.target.value)}
                  placeholder="Or enter custom Khmer font name..."
                  className="w-full px-3 py-2 text-sm bg-kui-dark border border-kui-border rounded-lg text-gray-200 focus:outline-none focus:border-kui-accent transition-colors"
                />
              </div>

              {/* Font Size & Line Height */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 bg-kui-dark/40 p-3 rounded-lg border border-kui-border/60">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-gray-300">Font Size</span>
                    <span className="text-kui-accent font-mono font-bold">{settings.fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="28"
                    step="1"
                    value={settings.fontSize}
                    onChange={(e) => handleChange('fontSize', Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>10px</span>
                    <span>15px (Def)</span>
                    <span>28px</span>
                  </div>
                </div>

                <div className="space-y-2 bg-kui-dark/40 p-3 rounded-lg border border-kui-border/60">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-gray-300">Line Height (Zero-Clip)</span>
                    <span className="text-kui-accent font-mono font-bold">{settings.lineHeight.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="1.8"
                    step="0.05"
                    value={settings.lineHeight}
                    onChange={(e) => handleChange('lineHeight', Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>1.00</span>
                    <span>1.35 (Optimal)</span>
                    <span>1.80</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Color Scheme Presets
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.values(THEMES).map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => handleChange('theme', th.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      settings.theme === th.id
                        ? 'border-kui-accent bg-kui-accent/15 ring-1 ring-kui-accent'
                        : 'border-kui-border bg-kui-dark hover:border-gray-600'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-gray-200">{th.name}</div>
                      <div className="flex gap-1.5 mt-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: th.theme.red }} />
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: th.theme.green }} />
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: th.theme.yellow }} />
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: th.theme.blue }} />
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: th.theme.cyan }} />
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: th.theme.magenta }} />
                      </div>
                    </div>
                    <div
                      className="w-8 h-8 rounded border border-gray-700 flex items-center justify-center font-mono text-[10px] font-bold"
                      style={{ backgroundColor: th.theme.background, color: th.theme.foreground }}
                    >
                      KUI
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'terminal' && (
            <div className="space-y-6">
              {/* Cursor Style */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Cursor Style
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['bar', 'block', 'underline'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => handleChange('cursorStyle', style)}
                      className={`px-4 py-2.5 text-xs font-medium rounded-lg border capitalize transition-all ${
                        settings.cursorStyle === style
                          ? 'border-kui-accent bg-kui-accent/20 text-kui-accent font-semibold'
                          : 'border-kui-border bg-kui-dark hover:border-gray-500 text-gray-300'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cursor Blink */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-kui-border bg-kui-dark/40">
                <div>
                  <div className="text-xs font-semibold text-gray-200">Cursor Blinking</div>
                  <div className="text-[11px] text-gray-400">Animate cursor pulse inside active terminal</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.cursorBlink}
                  onChange={(e) => handleChange('cursorBlink', e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 accent-cyan-500"
                />
              </div>

              {/* Custom Shell */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Custom Shell Executable (Optional)
                </label>
                <input
                  type="text"
                  value={settings.shell}
                  onChange={(e) => handleChange('shell', e.target.value)}
                  placeholder="e.g. powershell.exe, cmd.exe, /bin/zsh (leave empty for auto)"
                  className="w-full px-3 py-2 text-sm bg-kui-dark border border-kui-border rounded-lg text-gray-200 focus:outline-none focus:border-kui-accent transition-colors"
                />
              </div>
            </div>
          )}

          {/* Live Khmer & TUI Preview Box */}
          <div className="space-y-2 pt-2 border-t border-kui-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
                <Sparkles size={14} className="text-cyan-400" />
                <span>Live Khmer & TUI Render Preview</span>
              </span>
              <span className="text-[11px] text-gray-400">
                Testing subscripts (ជើងអក្សរ), stacked vowels & TUI box borders
              </span>
            </div>
            <div
              className="p-4 rounded-lg bg-kui-darker border border-kui-border font-mono overflow-x-auto select-text shadow-inner transition-all"
              style={{
                fontFamily: previewFontFamily,
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
              }}
            >
              <div className="text-cyan-400">┌── សូមស្វាគមន៍មកកាន់ KUI & OpenCode ──┐</div>
              <div className="text-emerald-400">│ ខ្ញុំកំពុងសរសេរកូដភាសាខ្មែរ និងសាកល្បងជើងអក្សរ │</div>
              <div className="text-gray-300">│ ស្ត្រី កម្ពុជា ស្រឡាញ់ ត្រី ព្រឹក ខ្ញុំបាទ      │</div>
              <div className="text-purple-400">│ const message = "សួស្តីពិភពលោក (KUI)";        │</div>
              <div className="text-cyan-400">└──────────────────────────────────────┘</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-kui-border bg-kui-dark/60">
          <span className="text-xs text-gray-400">Settings automatically sync to all open panes</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-kui-accent hover:bg-kui-accentHover text-black font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
