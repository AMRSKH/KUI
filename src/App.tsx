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
    const newTabNumber = tabs.length + 1;
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
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTabId);
  }, [tabs.length]);

  // Close a tab
  const handleCloseTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((t) => t.id !== tabId);
      return filtered;
    });
    setActiveTabId((currentActive) => {
      if (currentActive === tabId) {
        const remaining = tabs.filter((t) => t.id !== tabId);
        return remaining[0]?.id || '';
      }
      return currentActive;
    });
  }, [tabs]);

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

  // Active tab reference
  const currentTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never steal shortcuts while the user is typing in a text field
      // (settings inputs, the custom shell field, ...).
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Use physical key codes so shortcuts work with Khmer and other keyboard layouts.
      // `event.key` changes with the active input language (for example, Khmer).

      // Ctrl+Shift+T: New Tab
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyT') {
        e.preventDefault();
        handleNewTab();
      }
      // Ctrl+Shift+W: Close Tab
      else if (e.ctrlKey && e.shiftKey && e.code === 'KeyW') {
        e.preventDefault();
        if (tabs.length > 1) {
          handleCloseTab(activeTabId);
        }
      }
      // Ctrl+Shift+X: Close Focused Pane
      else if (e.ctrlKey && e.shiftKey && e.code === 'KeyX') {
        e.preventDefault();
        if (currentTab?.activeSessionId) {
          handleClosePane(currentTab.activeSessionId);
        }
      }
      // Alt+Shift+D: Split Right
      else if (e.altKey && e.shiftKey && e.code === 'KeyD') {
        e.preventDefault();
        if (currentTab?.activeSessionId) {
          handleSplitPane(currentTab.activeSessionId, 'vertical');
        }
      }
      // Alt+Shift+E: Split Down
      else if (e.altKey && e.shiftKey && e.code === 'KeyE') {
        e.preventDefault();
        if (currentTab?.activeSessionId) {
          handleSplitPane(currentTab.activeSessionId, 'horizontal');
        }
      }
      // Ctrl+, : Toggle Settings
      else if (e.ctrlKey && e.code === 'Comma') {
        e.preventDefault();
        setIsSettingsOpen((v) => !v);
      }
      // Ctrl+= / Ctrl++: Zoom in (Increase Font Size)
      else if (e.ctrlKey && (e.code === 'Equal' || e.code === 'NumpadAdd')) {
        e.preventDefault();
        setSettings((prev) => {
          const next = { ...prev, fontSize: Math.min(prev.fontSize + 1, 32) };
          persistSettings(next);
          return next;
        });
      }
      // Ctrl+-: Zoom out (Decrease Font Size)
      else if (e.ctrlKey && (e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault();
        setSettings((prev) => {
          const next = { ...prev, fontSize: Math.max(prev.fontSize - 1, 9) };
          persistSettings(next);
          return next;
        });
      }
      // Ctrl+0: Reset Font Size
      else if (e.ctrlKey && (e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault();
        setSettings((prev) => {
          const next = { ...prev, fontSize: DEFAULT_SETTINGS.fontSize };
          persistSettings(next);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleNewTab,
    handleCloseTab,
    handleClosePane,
    handleSplitPane,
    persistSettings,
    activeTabId,
    currentTab,
    tabs.length,
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

      {/* Main Terminal Workspace (Recursive Split Panes) */}
      <div className="flex-1 w-full min-h-0 overflow-hidden relative">
        {currentTab && (
          <SplitPaneContainer
            node={currentTab.rootPane}
            activeSessionId={currentTab.activeSessionId}
            settings={settings}
            canClose={currentTab.rootPane.type === 'split'}
            onFocusSession={handleFocusSession}
            onSplitPane={handleSplitPane}
            onClosePane={handleClosePane}
            onUpdateRatio={handleUpdateRatio}
          />
        )}
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
