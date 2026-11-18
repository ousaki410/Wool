import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  AlertTriangle,
  Clock,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  CalendarOff,
  Flame,
  Infinity as InfinityIcon,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  WoolItem,
  formatDeadlineLabel,
  getItemExpiresAt,
} from '../data/woolData';

interface WoolCardProps {
  item: WoolItem;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
  onFilterBySource?: (sourceId: string) => void;
  /** 当前时间（ISO），由 useWools 每分钟刷新 */
  nowIso: string;
  /** 新增标记（查看或超时后淡化） */
  isNew?: boolean;
  /** 已更新标记（查看或超时后淡化） */
  isUpdated?: boolean;
  /** 展开详情时回调，用于淡化新增/已更新标记 */
  onViewed?: (id: string) => void;
}

export const WoolCard: React.FC<WoolCardProps> = ({
  item,
  isBookmarked,
  onToggleBookmark,
  onFilterBySource,
  nowIso,
  isNew = false,
  isUpdated = false,
  onViewed,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const deadlineInfo = formatDeadlineLabel(getItemExpiresAt(item), nowIso);
  const isExpired = deadlineInfo.state === 'expired';
  const isExpiringSoon = deadlineInfo.state === 'expiring_soon';
  const isLongTerm = deadlineInfo.state === 'long_term';

  const handleCopyCode = () => {
    if (!item.promoCode) return;
    navigator.clipboard?.writeText(item.promoCode).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleToggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      if (next) onViewed?.(item.id);
      return next;
    });
  };

  // 过期置灰；新增高亮；其余保持默认
  const cardSurfaceClass = isExpired
    ? 'bg-slate-100/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60'
    : isNew
    ? 'bg-white dark:bg-slate-900 border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-200 dark:ring-emerald-900'
    : isExpiringSoon
    ? 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700/80'
    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700';

  return (
    <article
      className={`border rounded-xl p-4 sm:p-5 transition-colors flex flex-col justify-between ${cardSurfaceClass}`}
    >
      <div>
        {/* 顶行：核验标记 + 变化提示 + 收藏 */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* 核验标记 */}
            {item.verificationStatus === '官方已核验' && (
              <span
                title={item.verificationNote}
                className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>✓ 官方已核验</span>
              </span>
            )}
            {item.verificationStatus === '社区线索' && (
              <span
                title={item.verificationNote}
                className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap shrink-0"
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>⚡ 社区线索</span>
              </span>
            )}
            {item.verificationStatus === '未核验' && (
              <span
                title={item.verificationNote}
                className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400 whitespace-nowrap shrink-0"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>? 未核验</span>
              </span>
            )}

            {/* 新增 / 已更新标记（查看或超时后淡化） */}
            {isNew && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold whitespace-nowrap">
                <Sparkles className="w-3 h-3" />
                <span>新</span>
              </span>
            )}
            {isUpdated && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-semibold whitespace-nowrap">
                <RefreshCw className="w-3 h-3" />
                <span>已更新</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* 截止状态 */}
            {isExpiringSoon && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 tabular-nums whitespace-nowrap">
                <Flame className="w-3.5 h-3.5 shrink-0" />
                <span>{deadlineInfo.badgeText}</span>
              </span>
            )}
            {isExpired && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                <CalendarOff className="w-3.5 h-3.5 shrink-0" />
                <span>{deadlineInfo.badgeText}</span>
              </span>
            )}
            {isLongTerm && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 tabular-nums whitespace-nowrap">
                <InfinityIcon className="w-3.5 h-3.5 shrink-0" />
                <span>长期有效</span>
              </span>
            )}
            {deadlineInfo.state === 'active' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{deadlineInfo.badgeText}</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => onToggleBookmark(item.id)}
              aria-label={isBookmarked ? `取消收藏 ${item.title}` : `收藏 ${item.title}`}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isBookmarked
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
              <span>{isBookmarked ? '已收藏' : '收藏'}</span>
            </button>
          </div>
        </div>

        {/* 标题 */}
        <h3
          className={`mt-3 text-base font-bold leading-snug ${
            isExpired
              ? 'text-slate-500 dark:text-slate-500 line-through'
              : 'text-slate-900 dark:text-slate-100'
          }`}
        >
          {item.title}
        </h3>

        {/* 卡片正面只保留：能得到什么 / 领取条件 / 截止时间（核验标记在顶行） */}
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-baseline gap-2">
            <dt className="text-xs font-semibold text-teal-700 dark:text-teal-400 whitespace-nowrap shrink-0 w-16">
              能得到什么
            </dt>
            <dd
              className={`font-semibold ${
                isExpired
                  ? 'text-slate-500 dark:text-slate-400'
                  : 'text-teal-900 dark:text-teal-300'
              }`}
            >
              {item.reward}
            </dd>
          </div>

          <div className="flex items-baseline gap-2">
            <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0 w-16">
              领取条件
            </dt>
            <dd className="text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
              {item.condition}
            </dd>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <dt className="font-semibold whitespace-nowrap shrink-0 w-16">截止时间</dt>
            <dd
              className={`font-mono tabular-nums ${
                isExpiringSoon
                  ? 'text-amber-700 dark:text-amber-400 font-semibold'
                  : isExpired
                  ? 'text-slate-400 dark:text-slate-500 line-through'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {deadlineInfo.dateText}（{deadlineInfo.badgeText}）
            </dd>
          </div>
        </dl>
      </div>

      {/* 展开区：核验记录、兑换码、步骤、风险、来源、标签 */}
      {expanded && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
              核验记录：{item.verificationNote}
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
              {item.steps.map((step, i) => (
                <li key={i} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {item.promoCode && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 dark:text-slate-500">兑换码:</span>
              <code className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {item.promoCode}
              </code>
              <button
                type="button"
                onClick={handleCopyCode}
                aria-label={`复制兑换码 ${item.promoCode}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/60 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>复制</span>
                  </>
                )}
              </button>
            </div>
          )}

          {item.riskNotes && (
            <p className="text-amber-800 dark:text-amber-300 font-medium">
              注意事项：{item.riskNotes}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span>来源:</span>
            {onFilterBySource ? (
              <button
                type="button"
                onClick={() => onFilterBySource(item.sourceId)}
                className="font-medium text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 underline underline-offset-2 truncate cursor-pointer"
              >
                {item.sourceName}
              </button>
            ) : (
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                {item.sourceName}
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span className="truncate">{item.tags.join(' / ')}</span>
          </div>
        </div>
      )}

      {/* 底部：原始页面 + 展开按钮 */}
      <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 truncate">
          {item.id}
        </span>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap shrink-0"
          >
            <span>原始页面</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={handleToggleExpanded}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{expanded ? '收起详情' : '更多详情'}</span>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </article>
  );
};
