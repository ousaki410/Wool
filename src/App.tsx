import { useState, useMemo, useEffect } from 'react';
import {
  Flame,
  ShieldCheck,
  Bookmark,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  PauseCircle,
  PlayCircle,
  Zap,
  Activity,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import {
  getDefaultBookmarkIds,
  DEFAULT_PUSH_SETTINGS,
  filterAndSortWoolItems,
  getDeadlineState,
  getItemExpiresAt,
  WoolCategory,
  ClaimMethod,
  DeadlineFilter,
  VerificationStatus,
  SourceChannel,
  PushSettingsConfig,
  WoolItem,
} from './data/woolData';
import { formatShanghaiDateTime } from './data/shanghaiTime';
import { useWools } from './hooks/useWools';
import { TopNav, ActiveTab } from './components/TopNav';
import { FilterBar } from './components/FilterBar';
import { WoolCard } from './components/WoolCard';
import { TelegramDigestView } from './components/TelegramDigestView';
import { SourcesStatusView } from './components/SourcesStatusView';
import { PushSettingsView } from './components/PushSettingsView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { copyToClipboard } from './utils/clipboard';

/** 收藏条目从来源消失时的兜底过期时间 */
const FALLBACK_EXPIRED_AT = '2000-01-01T00:00:00+08:00';

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

  // 唯一数据入口：列表、来源状态和每分钟时间刷新
  const {
    items: allItems,
    channels: sourceChannels,
    nowIso,
    paused,
    pause,
    resume,
    trigger,
    markViewed,
    getFreshMarks,
    source,
  } = useWools();

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

  // 收藏快照：条目过期或从来源消失后，收藏页仍可展示
  const [bookmarkSnapshots, setBookmarkSnapshots] = useState<Record<string, WoolItem>>(() => {
    try {
      const raw = localStorage.getItem('woolradar_bookmark_snapshots');
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem('woolradar_bookmarks', JSON.stringify(bookmarkIds));
    } catch {
      // ignore
    }
  }, [bookmarkIds]);

  useEffect(() => {
    setBookmarkSnapshots((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of allItems) {
        if (!bookmarkIds.includes(item.id)) continue;
        if (JSON.stringify(next[item.id]) !== JSON.stringify(item)) {
          next[item.id] = item;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allItems, bookmarkIds]);

  useEffect(() => {
    try {
      localStorage.setItem('woolradar_bookmark_snapshots', JSON.stringify(bookmarkSnapshots));
    } catch {
      // ignore
    }
  }, [bookmarkSnapshots]);

  const handleToggleBookmark = (id: string) => {
    setBookmarkIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [id, ...prev]
    );
  };

  // 来源通道状态来自 useWools；本地仅保存启用/停用偏好
  const [channelEnabledOverrides, setChannelEnabledOverrides] = useState<
    Record<string, boolean>
  >({});

  const channels = useMemo<SourceChannel[]>(
    () =>
      sourceChannels.map((ch) =>
        channelEnabledOverrides[ch.id] === undefined
          ? ch
          : { ...ch, enabled: channelEnabledOverrides[ch.id] }
      ),
    [sourceChannels, channelEnabledOverrides]
  );

  const handleToggleChannel = (id: string) => {
    setChannelEnabledOverrides((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? sourceChannels.find((c) => c.id === id)?.enabled ?? true),
    }));
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
  const [clueCollapsed, setClueCollapsed] = useState(true);

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategory('全部');
    setClaimMethod('全部');
    setDeadlineFilter('全部');
    setVerificationStatus('全部');
    setSourceIdFilter('全部');
    setSortBy('recommended');
  };

  const allFilteredItems = useMemo(
    () =>
      filterAndSortWoolItems(
        allItems,
        {
          searchQuery,
          category,
          claimMethod,
          deadlineFilter,
          verificationStatus,
          sourceId: sourceIdFilter,
          sortBy,
        },
        nowIso
      ),
    [
      allItems,
      nowIso,
      searchQuery,
      category,
      claimMethod,
      deadlineFilter,
      verificationStatus,
      sourceIdFilter,
      sortBy,
    ]
  );

  // 主列表仅显示官方已核验
  const verifiedItems = allFilteredItems.filter(
    (i) => i.verificationStatus === '官方已核验'
  );

  // 线索分区：非官方已核验（社区线索 + 未核验），默认折叠
  const clueItems = allItems.filter(
    (i) => i.verificationStatus !== '官方已核验'
  );

  // Summary metrics（按当前时间实时计算）
  const expiringSoonItems = useMemo(
    () =>
      allItems.filter(
        (i) => getDeadlineState(getItemExpiresAt(i), nowIso) === 'expiring_soon'
      ),
    [allItems, nowIso]
  );

  const officialVerifiedActiveItems = useMemo(
    () =>
      allItems.filter(
        (i) =>
          i.verificationStatus === '官方已核验' &&
          getDeadlineState(getItemExpiresAt(i), nowIso) !== 'expired'
      ),
    [allItems, nowIso]
  );

  const normalSourceCount = useMemo(
    () => channels.filter((c) => c.status === '正常').length,
    [channels]
  );

  const activeSourceObj = useMemo(
    () =>
      sourceIdFilter === '全部'
        ? null
        : channels.find((c) => c.id === sourceIdFilter) || null,
    [channels, sourceIdFilter]
  );

  // Bookmarked items list（含已过期/已消失条目的快照兜底）
  const bookmarkedItems = useMemo(
    () =>
      bookmarkIds
        .map((id) => {
          const live = allItems.find((item) => item.id === id);
          if (live) return live;
          const snapshot = bookmarkSnapshots[id];
          if (!snapshot) return null;
          return {
            ...snapshot,
            expiresAt: FALLBACK_EXPIRED_AT,
            deadline: FALLBACK_EXPIRED_AT,
          };
        })
        .filter((item): item is WoolItem => Boolean(item)),
    [bookmarkIds, allItems, bookmarkSnapshots]
  );

  const [copiedBookmarks, setCopiedBookmarks] = useState(false);

  const handleCopyBookmarksList = async () => {
    const text = bookmarkedItems
      .map(
        (item, idx) =>
          `${idx + 1}. [${item.verificationStatus}] ${item.title} — 可得: ${item.reward}`
      )
      .join('\n');
    const result = await copyToClipboard(text);
    if (!result.success) {
      console.warn('剪贴板复制失败：', result.error);
    }
    setCopiedBookmarks(true);
    setTimeout(() => setCopiedBookmarks(false), 2000);
  };

  return (
    <ErrorBoundary>
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
        {/* 数据来源状态条：显示当前数据源、最后同步时间与抓取失败原因 */}
        {source.kind === 'real' && (
          <section
            className="flex flex-wrap items-center gap-2 gap-x-3 rounded-xl border px-3 py-2 text-xs"
          >
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              数据来源：
            </span>
            <span
              className={`font-mono text-sm ${
                source.real?.ok
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {source.name}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              |
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              最后同步：
              <span className="font-mono tabular-nums">
                {source.real?.lastSyncAt ? formatShanghaiDateTime(source.real.lastSyncAt) : '—'}
              </span>
            </span>
            {source.loading && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  |
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
                  抓取中…
                </span>
              </>
            )}
            {source.real?.error && !source.real?.ok && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  |
                </span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  抓取失败：{source.real.error}
                </span>
              </>
            )}
          </section>
        )}
        {/* TAB 1: 今日羊毛 */}
        {activeTab === 'today' && (
          <>
            {/* 紧凑统计条：首屏只占一行 */}
            <section
              aria-label="今日情报态势概览"
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs"
            >
              <button
                type="button"
                onClick={() =>
                  setDeadlineFilter(deadlineFilter === '即将到期' ? '全部' : '即将到期')
                }
                className={`inline-flex items-center gap-1.5 font-semibold transition-colors cursor-pointer ${
                  deadlineFilter === '即将到期'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>72h 内到期</span>
                <strong className="font-mono tabular-nums">{expiringSoonItems.length}</strong>
              </button>

              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">|</span>

              <button
                type="button"
                onClick={() =>
                  setVerificationStatus(
                    verificationStatus === '官方已核验' ? '全部' : '官方已核验'
                  )
                }
                className={`inline-flex items-center gap-1.5 font-semibold transition-colors cursor-pointer ${
                  verificationStatus === '官方已核验'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>官方已核验</span>
                <strong className="font-mono tabular-nums">
                  {officialVerifiedActiveItems.length}
                </strong>
              </button>

              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">|</span>

              <button
                type="button"
                onClick={() => setActiveTab('sources')}
                className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>来源正常</span>
                <strong className="font-mono tabular-nums">
                  {normalSourceCount}/{channels.length}
                </strong>
              </button>

              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">|</span>

              <span className="text-slate-500 dark:text-slate-400">
                共 <strong className="font-mono tabular-nums">{allItems.length}</strong> 条
              </span>

              {source.kind === 'mock' && (
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      paused
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        paused ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                    {paused ? '模拟已暂停' : '模拟运行中'}
                  </span>

                  <button
                    type="button"
                    onClick={paused ? resume : pause}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    {paused ? (
                      <PlayCircle className="w-3.5 h-3.5" />
                    ) : (
                      <PauseCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{paused ? '继续模拟' : '暂停模拟'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={trigger}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-950/80 transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>模拟一条事件</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('digest')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                  >
                    <span>日报预览 →</span>
                  </button>
                </div>
              )}
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
              totalMatching={verifiedItems.length}
              totalCount={allItems.length}
            />

            {/* High-Density Cards Grid */}
            {verifiedItems.length > 0 ? (
              <section
                aria-label="羊毛情报列表"
                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              >
                {verifiedItems.map((item) => {
                  const marks = getFreshMarks(item);
                  return (
                    <WoolCard
                      key={item.id}
                      item={item}
                      isBookmarked={bookmarkIds.includes(item.id)}
                      onToggleBookmark={handleToggleBookmark}
                      onFilterBySource={(srcId) => setSourceIdFilter(srcId)}
                      nowIso={nowIso}
                      isNew={marks.isNew}
                      isUpdated={marks.isUpdated}
                      onViewed={markViewed}
                    />
                  );
                })}
              </section>
            ) : (
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
                <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                  暂无已核验的福利。下方 {clueItems.length} 条线索尚未核验，仅供参考。
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  您可以尝试放宽「核验状态」或「截止日期」条件，或点击下方按钮恢复显示全部情报。
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

        {/* TAB 1-续：线索分区（未核验） */}
        {clueItems.length > 0 && (
          <section className="mt-4">
            <div
              onClick={() => setClueCollapsed(!clueCollapsed)}
              className="cursor-pointer flex items-center gap-2"
            >
              <h3 className="text-base font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>未核验线索，仅供参考 ({clueItems.length})</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${clueCollapsed ? '' : 'rotate-180'}`}
                />
              </h3>
            </div>
            {!clueCollapsed && (
              <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {clueItems.map((item) => {
                  const marks = getFreshMarks(item);
                  return (
                    <WoolCard
                      key={item.id}
                      item={item}
                      isBookmarked={bookmarkIds.includes(item.id)}
                      onToggleBookmark={handleToggleBookmark}
                      onFilterBySource={(srcId) => setSourceIdFilter(srcId)}
                      nowIso={nowIso}
                      isNew={marks.isNew}
                      isUpdated={marks.isUpdated}
                      onViewed={markViewed}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: 日报预览 (Telegram 消息样式) */}
        {activeTab === 'digest' && (
          <TelegramDigestView
            items={allItems}
            nowIso={nowIso}
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
            onSyncAll={trigger}
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
            nowIso={nowIso}
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
                  保存在本地浏览器的待办羊毛清单；已过期或已从来源消失的条目仍会保留并标记为已过期。
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
                {bookmarkedItems.map((item) => {
                  const marks = getFreshMarks(item);
                  return (
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
                      nowIso={nowIso}
                      isNew={marks.isNew}
                      isUpdated={marks.isUpdated}
                      onViewed={markViewed}
                    />
                  );
                })}
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
    </ErrorBoundary>
  );
}
