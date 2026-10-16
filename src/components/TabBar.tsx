import React from 'react';
import {
  Plus,
  X,
  Settings,
  Columns,
  Rows,
  Terminal,
} from 'lucide-react';
import { TabItem, SplitDirection } from '../types/terminal';

interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onNewTab: () => void;
  onCloseTab: (tabId: string) => void;
  onOpenSettings: () => void;
  onSplitActive: (direction: SplitDirection) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onNewTab,
  onCloseTab,
  onOpenSettings,
  onSplitActive,
}) => {
  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-10 bg-kui-darker border-b border-kui-border/80 px-2 select-none"
    >
      {/* Left Branding & Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar flex-1 mr-2">
        {/* KUI Brand Header / Logo */}
        <div
          data-tauri-drag-region
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-gradient-to-r from-cyan-950/60 to-blue-950/40 border border-cyan-800/40 text-cyan-400 font-mono text-xs font-bold tracking-wider shadow-sm select-none mr-1"
        >
          <Terminal size={14} className="text-cyan-400" />
          <span>KUI</span>
          <span className="text-[10px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-sans font-semibold">
            CTL
          </span>
        </div>

        {/* Tab List */}
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`group flex items-center space-x-2 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer border-t-2 transition-all ${
                  isActive
                    ? 'bg-kui-surface border-kui-accent text-white shadow-sm font-medium'
                    : 'bg-kui-dark/40 border-transparent text-gray-400 hover:text-gray-200 hover:bg-kui-dark/80'
                }`}
              >
                <span className="text-gray-500 font-mono text-[10px]">#{idx + 1}</span>
                <span className="max-w-[120px] truncate tracking-wide">
                  {tab.title}
                </span>

                {/* Close Tab Button */}
                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    title="Close Tab (Ctrl+Shift+W)"
                    className="p-0.5 rounded-full hover:bg-white/10 hover:text-rose-400 text-gray-500 opacity-60 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* New Tab Button */}
        <button
          type="button"
          onClick={onNewTab}
          title="New Tab (Ctrl+Shift+T)"
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => onSplitActive('vertical')}
          title="Split Pane Right (Alt+Shift+D)"
          className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-white/10 transition-colors"
        >
          <Columns size={15} />
        </button>
        <button
          type="button"
          onClick={() => onSplitActive('horizontal')}
          title="Split Pane Down (Alt+Shift+E)"
          className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-white/10 transition-colors"
        >
          <Rows size={15} />
        </button>

        <div className="w-[1px] h-4 bg-kui-border/80 mx-1" />

        <button
          type="button"
          onClick={onOpenSettings}
          title="KUI Settings & Khmer Font Customizer"
          className="flex items-center space-x-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Settings size={15} />
          <span className="hidden sm:inline text-[11px] font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
};
