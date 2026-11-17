import React from 'react';
import {
  Radar,
  Send,
  Activity,
  Sliders,
  Bookmark,
  Sun,
  Moon,
} from 'lucide-react';

export type ActiveTab = 'today' | 'digest' | 'sources' | 'settings' | 'bookmarks';

interface TopNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  bookmarkCount: number;
  expiringCount: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onSelectTab,
  bookmarkCount,
  expiringCount,
  darkMode,
  onToggleDarkMode,
}) => {
  const navItems: {
    id: ActiveTab;
    label: string;
    mobileLabel: string;
    icon: React.FC<{ className?: string }>;
    count?: number;
  }[] = [
    {
      id: 'today',
      label: `今日羊毛 (${expiringCount} 急)`,
      mobileLabel: '今日羊毛',
      icon: Radar,
    },
    {
      id: 'digest',
      label: '日报预览',
      mobileLabel: '日报预览',
      icon: Send,
    },
    {
      id: 'sources',
      label: '来源状态',
      mobileLabel: '来源状态',
      icon: Activity,
    },
    {
      id: 'settings',
      label: '推送设置',
      mobileLabel: '推送设置',
      icon: Sliders,
    },
    {
      id: 'bookmarks',
      label: `收藏 (${bookmarkCount})`,
      mobileLabel: `收藏 (${bookmarkCount})`,
      icon: Bookmark,
      count: bookmarkCount,
    },
  ];

  return (
    <>
      {/* Desktop & Tablet Top Header — Strict 3-Zone Contract */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 h-14">
          {/* Zone 1: Brand Title, One Line */}
          <a
            href="#today"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('today');
            }}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            WoolRadar 羊毛雷达
          </a>

          {/* Zone 2: 5 Concise Single-Line Navigation Links */}
          <nav
            aria-label="主导航"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                    isActive
                      ? 'border-teal-600 dark:border-teal-400 text-slate-900 dark:text-white font-semibold'
                      : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action (Theme Switch) */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? '切换为浅色模式' : '切换为深色模式'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>浅色模式</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  <span>深色模式</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (<= 52px height to stay well within 15% mobile sticky cap) */}
      <nav
        aria-label="移动端底部导航"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 h-13 px-1 flex items-center justify-around"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'text-teal-600 dark:text-teal-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
