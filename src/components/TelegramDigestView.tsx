import React, { useState, useMemo } from 'react';
import {
  Send,
  Copy,
  Check,
  CheckCheck,
  BellRing,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import {
  WoolItem,
  getDeadlineState,
  getItemExpiresAt,
  formatDeadlineLabel,
  buildTelegramDigestText,
} from '../data/woolData';

interface TelegramDigestViewProps {
  items: WoolItem[];
  /** 当前时间（ISO），用于实时计算剩余天数与“即将到期” */
  nowIso: string;
  onNavigateToFiltered: (options: {
    deadlineFilter?: '全部' | '即将到期';
    verificationStatus?: '全部' | '官方已核验';
  }) => void;
  onNavigateToBookmarks: () => void;
}

const VERIFICATION_ORDER: Record<WoolItem['verificationStatus'], number> = {
  官方已核验: 0,
  社区线索: 1,
  未核验: 2,
};

export const TelegramDigestView: React.FC<TelegramDigestViewProps> = ({
  items,
  nowIso,
  onNavigateToFiltered,
  onNavigateToBookmarks,
}) => {
  const [onlyVerified, setOnlyVerified] = useState<boolean>(false);
  const [includeExpiringSection, setIncludeExpiringSection] = useState<boolean>(true);
  const [templateStyle, setTemplateStyle] = useState<'detailed' | 'compact'>('detailed');
  const [copied, setCopied] = useState(false);
  const [simulatedMessages, setSimulatedMessages] = useState<
    { id: string; time: string; note: string }[]
  >([]);

  const validItems = useMemo(() => {
    return items
      .filter((item) => {
        const st = getDeadlineState(getItemExpiresAt(item), nowIso);
        if (st === 'expired') return false;
        if (onlyVerified && item.verificationStatus !== '官方已核验') return false;
        return true;
      })
      .sort((a, b) => {
        // 改按核验状态与截止时间排序，不再使用预估价值
        const verifyDiff =
          VERIFICATION_ORDER[a.verificationStatus] - VERIFICATION_ORDER[b.verificationStatus];
        if (verifyDiff !== 0) return verifyDiff;
        const aExpires = getItemExpiresAt(a);
        const bExpires = getItemExpiresAt(b);
        return (
          (aExpires ? new Date(aExpires).getTime() : Number.MAX_SAFE_INTEGER) -
          (bExpires ? new Date(bExpires).getTime() : Number.MAX_SAFE_INTEGER)
        );
      });
  }, [items, onlyVerified, nowIso]);

  const expiringItems = useMemo(
    () =>
      validItems
        .filter(
          (item) => getDeadlineState(getItemExpiresAt(item), nowIso) === 'expiring_soon'
        )
        .sort(
          (a, b) =>
            new Date(getItemExpiresAt(a)!).getTime() -
            new Date(getItemExpiresAt(b)!).getTime()
        ),
    [validItems, nowIso]
  );

  const featuredVerified = useMemo(
    () =>
      validItems
        .filter((item) => item.verificationStatus === '官方已核验')
        .slice(0, 6),
    [validItems]
  );

  const plainDigestText = useMemo(
    () => {
      // 传给文本生成器的列表也按核验状态与截止时间排序
      const sorted = [...items].sort((a, b) => {
        const verifyDiff =
          VERIFICATION_ORDER[a.verificationStatus] - VERIFICATION_ORDER[b.verificationStatus];
        if (verifyDiff !== 0) return verifyDiff;
        const aExpires = getItemExpiresAt(a);
        const bExpires = getItemExpiresAt(b);
        return (
          (aExpires ? new Date(aExpires).getTime() : Number.MAX_SAFE_INTEGER) -
          (bExpires ? new Date(bExpires).getTime() : Number.MAX_SAFE_INTEGER)
        );
      });
      return buildTelegramDigestText(
        sorted,
        {
          onlyVerified,
          includeExpiringSection,
          templateStyle,
        },
        nowIso
      );
    },
    [items, onlyVerified, includeExpiringSection, templateStyle, nowIso]
  );

  const handleCopyDigest = () => {
    navigator.clipboard?.writeText(plainDigestText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulatePush = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    setSimulatedMessages((prev) => [
      ...prev,
      {
        id: `sim-${Date.now()}`,
        time: `${hh}:${mm}:${ss}`,
        note: `已按「${templateStyle === 'detailed' ? '详细版' : '精简版'} · ${
          onlyVerified ? '仅官方已核验' : '全量有效线索'
        }」生成快照并投递至本地预览流（共包含 ${validItems.length} 条有效羊毛）。`,
      },
    ]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Configuration Panel (4 cols on desktop) */}
      <aside className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            日报编译器与排版控制
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            实时调整 Telegram 频道日报渲染模板，支持一键复制 Markdown 纯文本或模拟投递效果。
          </p>
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            信息密度模式
          </div>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
            <button
              type="button"
              onClick={() => setTemplateStyle('detailed')}
              className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                templateStyle === 'detailed'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              详细版（含条件/码）
            </button>
            <button
              type="button"
              onClick={() => setTemplateStyle('compact')}
              className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                templateStyle === 'compact'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              精简速览版
            </button>
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                仅收录「官方已核验」
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                过滤社区线索与未核验传闻
              </div>
            </div>
            <input
              type="checkbox"
              checked={onlyVerified}
              onChange={(e) => setOnlyVerified(e.target.checked)}
              className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                置顶「72h 即将到期」专区
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                在消息顶部高亮倒计时羊毛
              </div>
            </div>
            <input
              type="checkbox"
              checked={includeExpiringSection}
              onChange={(e) => setIncludeExpiringSection(e.target.checked)}
              className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
            />
          </label>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          <button
            type="button"
            onClick={handleCopyDigest}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>已复制 Telegram 消息文本</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>复制日报文本</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSimulatePush}
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>模拟发送一条测试预览</span>
          </button>
        </div>

        {/* Raw Text Preview Drawer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>原始文本预览</span>
            <span className="font-mono tabular-nums">{plainDigestText.length} 字符</span>
          </div>
          <pre className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
            {plainDigestText}
          </pre>
        </div>
      </aside>

      {/* Right Telegram Desktop/Mobile Channel Simulation Window (8 cols on desktop) */}
      <section
        aria-label="Telegram 消息样式预览窗口"
        className="lg:col-span-8 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-[#E7EBF0] dark:bg-[#0E1621]"
      >
        {/* Telegram Channel Top Bar */}
        <div className="bg-white dark:bg-[#17212B] px-4 py-3 border-b border-slate-200 dark:border-[#101921] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#2AABEE] text-white flex items-center justify-center font-bold text-sm shrink-0">
              WR
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>WoolRadar 羊毛雷达日报</span>
                <span className="text-[11px] font-mono font-normal text-[#2AABEE]">
                  @woolradar_digest
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-[#6C7883] tabular-nums">
                本地单用户情报频道 · 实时编译自 {items.length} 条本地数据源
              </div>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-500 dark:text-[#6C7883] tabular-nums">
            2026-11-17
          </div>
        </div>

        {/* Telegram Chat Stream Canvas */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[760px] overflow-y-auto">
          {/* Date Separator in Telegram */}
          <div className="flex justify-center">
            <span className="px-3 py-0.5 text-xs font-medium rounded-full bg-slate-900/15 dark:bg-black/35 text-slate-700 dark:text-slate-200 tabular-nums">
              11月17日 星期二
            </span>
          </div>

          {/* Main Telegram Channel Message Bubble */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-[#182533] text-slate-900 dark:text-[#F5F5F5] rounded-2xl rounded-tl-sm p-4 sm:p-5 shadow-xs border border-slate-200/60 dark:border-[#202B36] space-y-4">
              {/* Message Header */}
              <div className="border-b border-slate-100 dark:border-[#243447] pb-3">
                <div className="text-xs font-bold text-[#2AABEE] mb-1">
                  WoolRadar 羊毛雷达 · 每日早报
                </div>
                <div className="text-base font-bold leading-snug">
                  📡 【WoolRadar 羊毛情报汇总】2026-11-17
                </div>
                <div className="mt-1.5 text-xs text-slate-600 dark:text-[#8E9BA8] font-mono tabular-nums">
                  有效情报：{validItems.length} 条 · 72h 内即将截止：{expiringItems.length} 条 · 官方已核验：{featuredVerified.length} 条
                </div>
              </div>

              {/* Section 1: Expiring Soon in 72h */}
              {includeExpiringSection && expiringItems.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    ⏰ 【72小时内即将截止 · 建议优先处理】
                  </div>
                  <div className="space-y-2.5">
                    {expiringItems.map((item, idx) => {
                      const dl = formatDeadlineLabel(getItemExpiresAt(item), nowIso);
                      return (
                        <div
                          key={item.id}
                          className="text-xs sm:text-sm space-y-1 pb-2.5 border-b border-slate-100 dark:border-[#243447] last:border-b-0 last:pb-0"
                        >
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {idx + 1}.{' '}
                            <span
                              className={
                                item.verificationStatus === '官方已核验'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : item.verificationStatus === '社区线索'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              [{item.verificationStatus}]
                            </span>{' '}
                            {item.title}
                          </div>
                          <div className="text-slate-700 dark:text-[#D1D9E0]">
                            🎁 <strong>可得：</strong>
                            <span className="text-teal-700 dark:text-[#5AC8FA] font-semibold">
                              {item.reward}
                            </span>{' '}
                          </div>
                          {templateStyle === 'detailed' && (
                            <div className="text-xs text-slate-500 dark:text-[#9AA7B4]">
                              📋 条件：{item.condition}
                            </div>
                          )}
                          <div className="text-xs font-mono text-amber-700 dark:text-amber-300 tabular-nums">
                            ⏳ 截止：{dl.badgeText}（{dl.dateText}）
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 2: Featured Official Verified */}
              <div className="space-y-2.5 pt-1">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  ✅ 【今日精选 · 官方已核验高价值羊毛】
                </div>
                <div className="space-y-2.5">
                  {featuredVerified.map((item, idx) => {
                    const dl = formatDeadlineLabel(getItemExpiresAt(item), nowIso);
                    return (
                      <div
                        key={item.id}
                        className="text-xs sm:text-sm space-y-1 pb-2.5 border-b border-slate-100 dark:border-[#243447] last:border-b-0 last:pb-0"
                      >
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {idx + 1}. {item.title}
                        </div>
                        <div className="text-slate-700 dark:text-[#D1D9E0]">
                          🎁 <strong>可得：</strong>
                          {item.reward}
                        </div>
                        {templateStyle === 'detailed' && (
                          <div className="text-xs text-slate-500 dark:text-[#9AA7B4]">
                            🔑 方式：{item.claimMethod} · 条件：{item.condition}
                            {item.promoCode && (
                              <span className="ml-1 font-mono text-slate-800 dark:text-white bg-slate-100 dark:bg-[#243447] px-1.5 py-0.5 rounded">
                                码: {item.promoCode}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-[#6C7883] font-mono tabular-nums">
                          <span>
                            🕒 {dl.badgeText} · 来源: {item.sourceName}
                          </span>
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#2AABEE] hover:underline inline-flex items-center gap-0.5"
                          >
                            <span>直达链接</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Telegram Footer Timestamp & Views */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#243447] flex items-center justify-between text-[11px] text-slate-400 dark:text-[#6C7883] font-mono tabular-nums">
                <span>💡 领完试用订阅后请检查自动续费设置，防反撸</span>
                <span className="inline-flex items-center gap-1">
                  <span>08:30</span>
                  <CheckCheck className="w-3.5 h-3.5 text-[#2AABEE]" />
                </span>
              </div>
            </div>

            {/* Telegram Inline Keyboard Action Buttons Below Bubble */}
            <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onNavigateToFiltered({
                    deadlineFilter: '即将到期',
                    verificationStatus: '全部',
                  })
                }
                className="py-2 px-3 text-xs font-medium rounded-xl bg-white/90 dark:bg-[#182533]/90 hover:bg-white dark:hover:bg-[#203042] text-[#2AABEE] border border-slate-200/70 dark:border-[#202B36] transition-colors cursor-pointer whitespace-nowrap tabular-nums"
              >
                ⏰ 仅看即将到期 ({expiringItems.length})
              </button>
              <button
                type="button"
                onClick={() =>
                  onNavigateToFiltered({
                    deadlineFilter: '全部',
                    verificationStatus: '官方已核验',
                  })
                }
                className="py-2 px-3 text-xs font-medium rounded-xl bg-white/90 dark:bg-[#182533]/90 hover:bg-white dark:hover:bg-[#203042] text-[#2AABEE] border border-slate-200/70 dark:border-[#202B36] transition-colors cursor-pointer whitespace-nowrap tabular-nums"
              >
                ✅ 官方已核验专区
              </button>
              <button
                type="button"
                onClick={onNavigateToBookmarks}
                className="py-2 px-3 text-xs font-medium rounded-xl bg-white/90 dark:bg-[#182533]/90 hover:bg-white dark:hover:bg-[#203042] text-[#2AABEE] border border-slate-200/70 dark:border-[#202B36] transition-colors cursor-pointer whitespace-nowrap"
              >
                ⭐ 打开我的收藏夹
              </button>
            </div>
          </div>

          {/* Simulated Test Messages Appended by User */}
          {simulatedMessages.map((msg) => (
            <div key={msg.id} className="max-w-2xl mx-auto">
              <div className="bg-white dark:bg-[#182533] text-slate-900 dark:text-[#F5F5F5] rounded-2xl rounded-tl-sm p-3.5 shadow-xs border border-teal-300 dark:border-teal-700/70 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 text-xs">
                  <Sparkles className="w-4 h-4 text-[#2AABEE] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[#2AABEE]">本地模拟推送测试</div>
                    <div className="mt-0.5 text-slate-700 dark:text-[#D1D9E0]">{msg.note}</div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400 dark:text-[#6C7883] shrink-0 tabular-nums">
                  {msg.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
