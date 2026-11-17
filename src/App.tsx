import { useState, useMemo, useEffect } from 'react';
import {
  Flame,
  ShieldCheck,
  Bookmark,
  Trash2,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  getWoolItems,
  getSourceChannels,
  getDefaultBookmarkIds,
  DEFAULT_PUSH_SETTINGS,
  filterAndSortWoolItems,
  getDeadlineState,
  WoolCategory,
  ClaimMethod,
  DeadlineFilter,
  VerificationStatus,
  SourceChannel,
  PushSettingsConfig,
  REFERENCE_NOW_ISO,
} from './data/woolData';
import { TopNav, ActiveTab } from './components/TopNav';
import { FilterBar } from './components/FilterBar';
import { WoolCard } from './components/WoolCard';
import { TelegramDigestView } from './components/TelegramDigestView';
import { SourcesStatusView } from './components/SourcesStatusView';
import { PushSettingsView } from './components/PushSettingsView';

export default function App() {
  // Theme state (default to dark mode or saved preference)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('woolradar_theme');
      return saved ? saved === 'dark' : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('woolradar_theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [darkMode]);

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');

  // Centralized Wool Data
  const allItems = useMemo(() => getWoolItems(), []);

  // Bookmarks State
  const [bookmarkIds, setBookmarkIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('woolradar_bookmarks');
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return getDefaultBookmarkIds();
  });

  useEffect(() => {
    try {
      localStorage.setItem('woolradar_bookmarks', JSON.stringify(bookmarkIds));
    } catch {
      // ignore
    }
  }, [bookmarkIds]);

  const handleToggleBookmark = (id: string) => {
    setBookmarkIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [id, ...prev]
    );
  };

  // Source Channels State
  const [channels, setChannels] = useState<SourceChannel[]>(() => getSourceChannels());

  const handleToggleChannel = (id: string) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, enabled: !ch.enabled } : ch))
    );
  };

  const handleSyncAllChannels = () => {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.enabled
          ? {
              ...ch,
              status: '正常',
              lastSyncAt: '2026-11-17 14:00',
            }
          : ch
      )
    );
  };

  // Push Settings State
  const [pushSettings, setPushSettings] = useState<PushSettingsConfig>(() => {
    try {
      const saved = localStorage.getItem('woolradar_push_settings');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_PUSH_SETTINGS;
  });

  const handleSavePushSettings = (next: PushSettingsConfig) => {
    setPushSettings(next);
    try {
      localStorage.setItem('woolradar_push_settings', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  // Filter States for "今日羊毛"
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<WoolCategory | '全部'>('全部');
  const [claimMethod, setClaimMethod] = useState<ClaimMethod | '全部'>('全部');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('全部');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | '全部'>('全部');
  const [sourceIdFilter, setSourceIdFilter] = useState<string | '全部'>('全部');
  const [sortBy, setSortBy] = useState<'recommended' | 'value_desc' | 'deadline_asc' | 'latest'>(
    'recommended'
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategory('全部');
    setClaimMethod('全部');
    setDeadlineFilter('全部');
    setVerificationStatus('全部');
    setSourceIdFilter('全部');
    setSortBy('recommended');
  };

  const filteredItems = useMemo(
    () =>
      filterAndSortWoolItems(allItems, {
        searchQuery,
        category,
        claimMethod,
        deadlineFilter,
        verificationStatus,
        sourceId: sourceIdFilter,
        sortBy,
      }),
    [
      allItems,
      searchQuery,
      category,
      claimMethod,
      deadlineFilter,
      verificationStatus,
      sourceIdFilter,
      sortBy,
    ]
  );

  // Summary metrics
  const expiringSoonItems = useMemo(
    () =>
      allItems.filter(
        (i) => getDeadlineState(i.deadline, REFERENCE_NOW_ISO) === 'expiring_soon'
      ),
    [allItems]
  );

  const officialVerifiedActiveItems = useMemo(
    () =>
      allItems.filter(
        (i) =>
          i.verificationStatus === '官方已核验' &&
          getDeadlineState(i.deadline, REFERENCE_NOW_ISO) !== 'expired'
      ),
    [allItems]
  );

  const totalActiveValueRmb = useMemo(
    () =>
      allItems
        .filter((i) => getDeadlineState(i.deadline, REFERENCE_NOW_ISO) !== 'expired')
        .reduce((sum, i) => sum + i.estimatedValueRmb, 0),
    [allItems]
  );

  const activeSourceObj = useMemo(
    () =>
      sourceIdFilter === '全部'
        ? null
        : channels.find((c) => c.id === sourceIdFilter) || null,
    [channels, sourceIdFilter]
  );

  // Bookmarked items list
  const bookmarkedItems = useMemo(
    () =>
      bookmarkIds
        .map((id) => allItems.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [bookmarkIds, allItems]
  );

  const [copiedBookmarks, setCopiedBookmarks] = useState(false);

  const handleCopyBookmarksList = () => {
    const text = bookmarkedItems
      .map(
        (item, idx) =>
          `${idx + 1}. [${item.verificationStatus}] ${item.title} — 可得: ${item.reward} (${item.estimatedValue})`
      )
      .join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedBookmarks(true);
    setTimeout(() => setCopiedBookmarks(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-12 transition-colors">
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        bookmarkCount={bookmarkedItems.length}
        expiringCount={expiringSoonItems.length}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
      />

      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 pt-5 space-y-5">
        {/* TAB 1: 今日羊毛 */}
        {activeTab === 'today' && (
          <>
            {/* Compact Interactive Situation Bar */}
            <section
              aria-label="今日情报态势概览"
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
            >
              <button
                type="button"
                onClick={() => {
                  setDeadlineFilter(deadlineFilter === '即将到期' ? '全部' : '即将到期');
                }}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  deadlineFilter === '即将到期'
                    ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-semibold">
                  <span>72h 内即将到期</span>
                  <Flame className="w-4 h-4" />
                </div>
                <div className="mt-1 text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                  {expiringSoonItems.length} <span className="text-xs font-normal text-slate-500">条急需处理</span>
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  点击快速筛选倒计时羊毛
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setVerificationStatus(
                    verificationStatus === '官方已核验' ? '全部' : '官方已核验'
                  );
                }}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  verificationStatus === '官方已核验'
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                  <span>官方已核验有效</span>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="mt-1 text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                  {officialVerifiedActiveItems.length} <span className="text-xs font-normal text-slate-500">/ 21 条有效</span>
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  点击仅看 100% 实测可靠渠道
                </div>
              </button>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  在途可领权益总估值
                </div>
                <div className="mt-1 text-2xl font-bold font-mono text-teal-700 dark:text-teal-400 tabular-nums">
                  ¥{totalActiveValueRmb.toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  涵盖算力额度、IDE 授权与消费立减
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('digest')}
                className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500 rounded-xl p-4 transition-colors cursor-pointer"
              >
                <div className="text-xs text-teal-700 dark:text-teal-400 font-semibold">
                  Telegram 日报已就绪
                </div>
                <div className="mt-1 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  预览今日早报 →
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  共收录 {allItems.length} 条（含 4 条归档）
                </div>
              </button>
            </section>

            {/* Multi-dimensional Filter Bar */}
            <FilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              category={category}
              onCategoryChange={setCategory}
              claimMethod={claimMethod}
              onClaimMethodChange={setClaimMethod}
              deadlineFilter={deadlineFilter}
              onDeadlineFilterChange={setDeadlineFilter}
              verificationStatus={verificationStatus}
              onVerificationStatusChange={setVerificationStatus}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              activeSourceName={activeSourceObj?.name || null}
              onClearSourceFilter={() => setSourceIdFilter('全部')}
              onResetAll={handleResetFilters}
              totalMatching={filteredItems.length}
              totalCount={allItems.length}
            />

            {/* High-Density Cards Grid */}
            {filteredItems.length > 0 ? (
              <section
                aria-label="羊毛情报列表"
                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              >
                {filteredItems.map((item) => (
                  <WoolCard
                    key={item.id}
                    item={item}
                    isBookmarked={bookmarkIds.includes(item.id)}
                    onToggleBookmark={handleToggleBookmark}
                    onFilterBySource={(srcId) => setSourceIdFilter(srcId)}
                  />
                ))}
              </section>
            ) : (
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
                <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                  没有匹配当前筛选条件的羊毛情报
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  您可以尝试放宽「核验状态」或「截止日期」条件，或点击下方按钮恢复显示全部 25 条情报。
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>重置全部筛选条件</span>
                </button>
              </section>
            )}
          </>
        )}

        {/* TAB 2: 日报预览 (Telegram 消息样式) */}
        {activeTab === 'digest' && (
          <TelegramDigestView
            items={allItems}
            onNavigateToFiltered={({ deadlineFilter: df, verificationStatus: vs }) => {
              handleResetFilters();
              if (df) setDeadlineFilter(df);
              if (vs) setVerificationStatus(vs);
              setActiveTab('today');
            }}
            onNavigateToBookmarks={() => setActiveTab('bookmarks')}
          />
        )}

        {/* TAB 3: 来源状态 */}
        {activeTab === 'sources' && (
          <SourcesStatusView
            channels={channels}
            onToggleChannel={handleToggleChannel}
            onSyncAll={handleSyncAllChannels}
            onSelectSourceItems={(srcId) => {
              handleResetFilters();
              setSourceIdFilter(srcId);
              setActiveTab('today');
            }}
          />
        )}

        {/* TAB 4: 推送设置（仅界面） */}
        {activeTab === 'settings' && (
          <PushSettingsView
            settings={pushSettings}
            onSaveSettings={handleSavePushSettings}
            onResetDefaults={() => handleSavePushSettings(DEFAULT_PUSH_SETTINGS)}
            items={allItems}
          />
        )}

        {/* TAB 5: 收藏 */}
        {activeTab === 'bookmarks' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>我的羊毛收藏夹 ({bookmarkedItems.length})</span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  保存在本地浏览器的待办羊毛清单，优先展示即将截止的高价值权益。
                </p>
              </div>

              {bookmarkedItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyBookmarksList}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedBookmarks ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>已复制清单</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>导出收藏文本</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setBookmarkIds([])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>清空收藏</span>
                  </button>
                </div>
              )}
            </div>

            {bookmarkedItems.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {bookmarkedItems.map((item) => (
                  <WoolCard
                    key={item.id}
                    item={item}
                    isBookmarked={true}
                    onToggleBookmark={handleToggleBookmark}
                    onFilterBySource={(srcId) => {
                      handleResetFilters();
                      setSourceIdFilter(srcId);
                      setActiveTab('today');
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
                <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                  收藏夹暂无条目
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  在「今日羊毛」卡片右上角点击「收藏」按钮，即可将需要稍后处理的羊毛保存在此处。
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('today')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer"
                >
                  <span>前往今日羊毛挑选</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
