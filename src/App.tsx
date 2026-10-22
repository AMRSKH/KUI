import React, { useState, useEffect, useCallback } from 'react';
import { TabItem, TerminalSettings, DEFAULT_SETTINGS, SplitDirection } from './types/terminal';
import { splitLeaf, removeLeaf, updateSplitRatio, findFirstSessionId } from './utils/tree';
import { TabBar } from './components/TabBar';
import { SplitPaneContainer } from './components/SplitPaneContainer';
import { SettingsModal } from './components/SettingsModal';

const SETTINGS_KEY = 'kui-terminal-settings';
const SETTINGS_VERSION_KEY = 'kui-terminal-settings-version';
// Bump whenever the stored settings need to be migrated.
const SETTINGS_VERSION = 2;

/**
 * Migrates settings that were stored by an older version of KUI.
 * v2: Khmer stacked glyphs (ជើង) need more vertical room than the old 1.0
 *     line height, otherwise the subscripts are clipped.
 */
function migrateSettings(parsed: Record<string, unknown>): Record<string, unknown> {
  const version = Number(localStorage.getItem(SETTINGS_VERSION_KEY) || '1');
  if (version >= SETTINGS_VERSION) return parsed;

  const next = { ...parsed };
  const lineHeight = Number(next.lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight < DEFAULT_SETTINGS.lineHeight) {
    next.lineHeight = DEFAULT_SETTINGS.lineHeight;
  }
  return next;
}

export const App: React.FC = () => {
  // Load settings from localStorage
  const [settings, setSettings] = useState<TerminalSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = migrateSettings(JSON.parse(saved));
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initialize tabs with an initial tab and leaf session
  const [tabs, setTabs] = useState<TabItem[]>(() => {
    const initialSessionId = crypto.randomUUID();
    const initialTabId = crypto.randomUUID();
    return [
      {
        id: initialTabId,
        title: 'Terminal 1',
        rootPane: {
          type: 'leaf',
          sessionId: initialSessionId,
          title: 'Terminal',
        },
        activeSessionId: initialSessionId,
      },
    ];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);

  // Persist settings (and the schema version) to localStorage
  const persistSettings = useCallback((next: TerminalSettings) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      localStorage.setItem(SETTINGS_VERSION_KEY, String(SETTINGS_VERSION));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save settings on update
  const handleUpdateSettings = useCallback(
    (newSettings: TerminalSettings) => {
      setSettings(newSettings);
      persistSettings(newSettings);
    },
    [persistSettings]
  );

  // Create a new tab
  const handleNewTab = useCallback(() => {
    const newSessionId = crypto.randomUUID();
    const newTabId = crypto.randomUUID();
    setTabs((prev) => {
      const newTabNumber = prev.length + 1;
      const newTab: TabItem = {
        id: newTabId,
        title: `Terminal ${newTabNumber}`,
        rootPane: {
          type: 'leaf',
          sessionId: newSessionId,
          title: 'Terminal',
        },
        activeSessionId: newSessionId,
      };
      return [...prev, newTab];
    });
    setActiveTabId(newTabId);
  }, []);

  // Close a tab
  const handleCloseTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((t) => t.id !== tabId);
      setActiveTabId((currentActive) => {
        if (currentActive === tabId) {
          return filtered[filtered.length - 1]?.id || filtered[0]?.id || '';
        }
        return currentActive;
      });
      return filtered;
    });
  }, []);

  // Split a pane inside the active tab
  const handleSplitPane = useCallback(
    (targetSessionId: string, direction: SplitDirection) => {
      const newSessionId = crypto.randomUUID();
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabId) return tab;
          const updatedTree = splitLeaf(tab.rootPane, targetSessionId, newSessionId, direction);
          return {
            ...tab,
            rootPane: updatedTree,
            activeSessionId: newSessionId,
          };
        })
      );
    },
    [activeTabId]
  );

  // Close a pane inside the active tab
  const handleClosePane = useCallback(
    (targetSessionId: string) => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabId) return tab;
          const updatedTree = removeLeaf(tab.rootPane, targetSessionId);
          if (!updatedTree) {
            // Entire tab tree was closed: recreate fresh single leaf
            const freshSessionId = crypto.randomUUID();
            return {
              ...tab,
              rootPane: {
                type: 'leaf',
                sessionId: freshSessionId,
                title: 'Terminal',
              },
              activeSessionId: freshSessionId,
            };
          }
          const nextActive = findFirstSessionId(updatedTree) || '';
          return {
            ...tab,
            rootPane: updatedTree,
            activeSessionId:
              tab.activeSessionId === targetSessionId ? nextActive : tab.activeSessionId,
          };
        })
      );
    },
    [activeTabId]
  );

  // Update split ratio when divider is dragged
  const handleUpdateRatio = useCallback(
    (targetFirstChildSessionId: string, ratio: number) => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabId) return tab;
          const updatedTree = updateSplitRatio(
            tab.rootPane,
            targetFirstChildSessionId,
            ratio
          );
          return {
            ...tab,
            rootPane: updatedTree,
          };
        })
      );
    },
    [activeTabId]
  );

  // Set focused session ID for current tab
  const handleFocusSession = useCallback(
    (sessionId: string) => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabId) return tab;
          return { ...tab, activeSessionId: sessionId };
        })
      );
    },
    [activeTabId]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const key = e.key ? e.key.toUpperCase() : '';
      const keyCode = e.keyCode || e.which || 0;
      const isD = code === 'KeyD' || key === 'D' || keyCode === 68 || e.key === 'ឌ';
      const isE = code === 'KeyE' || key === 'E' || keyCode === 69 || e.key === 'ែ';
      const isX = code === 'KeyX' || key === 'X' || keyCode === 88 || e.key === 'ខ';
      const isT = code === 'KeyT' || key === 'T' || keyCode === 84 || e.key === 'ធ';
      const isW = code === 'KeyW' || key === 'W' || keyCode === 87 || e.key === 'ឹ';

      const isCtrlShiftX = e.ctrlKey && e.shiftKey && !e.altKey && isX;

      // 1. If Settings modal is open: Ctrl+Shift+X closes it! (DO NOT use Esc per request)
      if (isSettingsOpen) {
        if (isCtrlShiftX) {
          e.preventDefault();
          e.stopPropagation();
          setIsSettingsOpen(false);
          return;
        }

        // If user is typing in a form input in settings, also allow Ctrl+, to toggle
        const target = e.target as HTMLElement | null;
        const isFormInput = Boolean(
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        );
        if (isFormInput) {
          if (e.ctrlKey && !e.shiftKey && !e.altKey && (code === 'Comma' || e.key === ',' || keyCode === 188)) {
            e.preventDefault();
            e.stopPropagation();
            setIsSettingsOpen(false);
          }
          return;
        }
      }

      // If user is typing in a general form input, do not execute terminal shortcuts
      const target = e.target as HTMLElement | null;
      const isXterm = Boolean(
        target?.classList?.contains('xterm-helper-textarea') ||
        target?.closest?.('.xterm')
      );
      const isFormInput = !isXterm && Boolean(
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      );
      if (isFormInput) {
        return;
      }

      const tab = tabs.find((t) => t.id === activeTabId) || tabs[0];
      const targetSession = tab?.activeSessionId || (tab ? findFirstSessionId(tab.rootPane) : '') || '';

      // Ctrl+Shift+T: New Tab
      if (e.ctrlKey && e.shiftKey && !e.altKey && isT) {
        e.preventDefault();
        e.stopPropagation();
        handleNewTab();
      }
      // Ctrl+Shift+W: Close Tab
      else if (e.ctrlKey && e.shiftKey && !e.altKey && isW) {
        e.preventDefault();
        e.stopPropagation();
        handleCloseTab(activeTabId);
      }
      // Ctrl+Shift+X: Close Settings (if open) or Close Focused Pane (or tab)
      else if (isCtrlShiftX) {
        e.preventDefault();
        e.stopPropagation();
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else if (targetSession) {
          if (tab.rootPane.type === 'split') {
            handleClosePane(targetSession);
          } else if (tabs.length > 1) {
            handleCloseTab(activeTabId);
          }
        }
      }
      // Ctrl+Shift+D or Alt+Shift+D: Split Right
      else if ((e.ctrlKey || e.altKey) && e.shiftKey && isD) {
        e.preventDefault();
        e.stopPropagation();
        if (targetSession) {
          handleSplitPane(targetSession, 'vertical');
        }
      }
      // Ctrl+Shift+E or Alt+Shift+E: Split Down
      else if ((e.ctrlKey || e.altKey) && e.shiftKey && isE) {
        e.preventDefault();
        e.stopPropagation();
        if (targetSession) {
          handleSplitPane(targetSession, 'horizontal');
        }
      }
      // Ctrl+, : Toggle Settings
      else if (e.ctrlKey && !e.shiftKey && !e.altKey && (code === 'Comma' || e.key === ',' || keyCode === 188)) {
        e.preventDefault();
        e.stopPropagation();
        setIsSettingsOpen((v) => !v);
      }
      // Ctrl+= / Ctrl++: Zoom in (Increase Font Size)
      else if (e.ctrlKey && !e.altKey && (code === 'Equal' || code === 'NumpadAdd' || e.key === '=' || e.key === '+' || keyCode === 187 || keyCode === 107)) {
        e.preventDefault();
        e.stopPropagation();
        setSettings((prev) => {
          const next = { ...prev, fontSize: Math.min(prev.fontSize + 1, 32) };
          persistSettings(next);
          return next;
        });
      }
      // Ctrl+-: Zoom out (Decrease Font Size)
      else if (e.ctrlKey && !e.altKey && (code === 'Minus' || code === 'NumpadSubtract' || e.key === '-' || keyCode === 189 || keyCode === 109)) {
        e.preventDefault();
        e.stopPropagation();
        setSettings((prev) => {
          const next = { ...prev, fontSize: Math.max(prev.fontSize - 1, 9) };
          persistSettings(next);
          return next;
        });
      }
      // Ctrl+0: Reset Font Size
      else if (e.ctrlKey && !e.altKey && !e.shiftKey && (code === 'Digit0' || code === 'Numpad0' || e.key === '0' || keyCode === 48 || keyCode === 96)) {
        e.preventDefault();
        e.stopPropagation();
        setSettings((prev) => {
          const next = { ...prev, fontSize: DEFAULT_SETTINGS.fontSize };
          persistSettings(next);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    handleNewTab,
    handleCloseTab,
    handleClosePane,
    handleSplitPane,
    persistSettings,
    activeTabId,
    tabs,
    isSettingsOpen,
  ]);

  return (
    <div className="h-full w-full flex flex-col bg-kui-darker text-gray-100 font-sans overflow-hidden">
      {/* Top Tab Bar & App Header */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onNewTab={handleNewTab}
        onCloseTab={handleCloseTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Terminal Workspace (Persistent Tabs across switching) */}
      <div className="flex-1 w-full min-h-0 overflow-hidden relative">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`absolute inset-0 h-full w-full ${
                isActive ? 'block' : 'hidden'
              }`}
            >
              <SplitPaneContainer
                node={tab.rootPane}
                activeSessionId={isActive ? tab.activeSessionId : ''}
                settings={settings}
                canClose={tab.rootPane.type === 'split'}
                onFocusSession={handleFocusSession}
                onSplitPane={handleSplitPane}
                onClosePane={handleClosePane}
                onUpdateRatio={handleUpdateRatio}
              />
            </div>
          );
        })}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />
    </div>
  );
};

export default App;
