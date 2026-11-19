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
  Link,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { formatShanghaiDateTime } from '../data/shanghaiTime';
import {
  WoolItem,
  formatDeadlineLabel,
  getItemExpiresAt,
  formatDirectionLabel,
  formatDirectionColor,
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

/** 按标点符号或空格截断文本，避免在词或数字中间截断，并保留完整金额。 */
export function truncateReward(reward: string, maxLen = 60): string {
  if (!reward || reward.length <= maxLen) return reward;

  const cut = reward.slice(0, maxLen);
  const lastPunct = Math.max(
    cut.lastIndexOf('，'),
    cut.lastIndexOf('、'),
    cut.lastIndexOf('。'),
    cut.lastIndexOf(' '),
    cut.lastIndexOf(';'),
    cut.lastIndexOf('/')
  );

  if (lastPunct >= 0 && lastPunct < maxLen - 1) {
    return cut.slice(0, lastPunct + 1);
  }

  return cut;
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

  const directionLabel = formatDirectionLabel(item.direction ?? 'neutral');
  const directionColor = formatDirectionColor(item.direction ?? 'neutral');

  // 官方页面摘录只作佐证，不改变 verificationStatus。
  const evidence = item.evidence;
  const EvidenceIcon =
    evidence?.status === '强命中'
      ? CheckCircle2
      : evidence?.status === '无法访问'
        ? XCircle
        : AlertCircle;
  const evidencePageUrl = evidence?.finalUrl ?? evidence?.sourceUrl ?? null;

  const handleCopyCode = async () => {
    if (!item.promoCode) return;
    const result = await copyToClipboard(item.promoCode);
    if (!result.success) {
      console.warn('剪贴板复制失败：', result.error);
    }
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

  // 奖励文本：若与标题相同则不显示；否则截断
  const rewardText = item.reward && item.reward !== item.title ? item.reward : null;
  const showReward = rewardText !== null && rewardText.length > 0;
  const showCondition = item.condition && item.condition.length > 0;

  return (
    <article
      className={`border rounded-xl p-4 sm:p-5 transition-colors flex flex-col justify-between ${cardSurfaceClass}`}
    >
      <div>
        {/* 顶行：核验标记 + 方向提示 + 收藏 */}
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

            {/* 官方页面摘录状态（只作佐证，不改变核验状态） */}
            {evidence && (
              <span
                title={`官方页面摘录：${evidence.status} · 抓取于 ${formatShanghaiDateTime(evidence.fetchedAt)}`}
                className="inline-flex items-center gap-1 font-semibold whitespace-nowrap shrink-0 text-slate-600 dark:text-slate-400"
              >
                <EvidenceIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{evidence.status}</span>
              </span>
            )}

            {/* 方向标签 */}
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 ${directionColor}`}
            >
              {directionLabel}
            </span>

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
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                <CalendarOff className="w-3.5 h-3.5 shrink-0" />
                <span>{deadlineInfo.badgeText}</span>
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

        {/* 官方页面摘录：命中片段或抓取结果；不会自动改变核验状态 */}
        {evidence && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs dark:border-slate-700/80 dark:bg-slate-800/40">
            {evidence.matches.length > 0 ? (
              <div className="space-y-1">
                <div className="font-semibold text-slate-700 dark:text-slate-200">
                  官方页面摘录
                </div>
                {evidence.matches.map((match, index) => (
                  <p
                    key={`${match.keyword}-${index}`}
                    className="leading-relaxed text-slate-600 dark:text-slate-300 break-words"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      [{match.keyword}]
                    </span>{' '}
                    “{match.snippet}”
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-slate-600 dark:text-slate-300">
                {evidence.status === '页面未提及'
                  ? '官方页面可访问，但未提及标题中的具体数字、日期或金额。'
                  : `官方页面无法访问${evidence.httpStatus ? `（HTTP ${evidence.httpStatus}）` : ''}。`}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              {evidencePageUrl && (
                <a
                  href={evidencePageUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="break-all underline decoration-slate-300 underline-offset-2 hover:text-slate-700 dark:decoration-slate-600 dark:hover:text-slate-200"
                >
                  {evidencePageUrl}
                </a>
              )}
              <span>抓取于 {formatShanghaiDateTime(evidence.fetchedAt)}</span>
            </div>
          </div>
        )}

        {/* 卡片正面只保留：能得到什么 / 领取条件 / 截止时间 */}
        <dl className="mt-3 space-y-2 text-sm">
          {showReward && (
            <div className="flex items-baseline gap-2">
              <dt className="text-xs font-semibold text-teal-700 dark:text-teal-400 whitespace-nowrap shrink-0 w-16">
                能得到什么
              </dt>
              <dd
                className={`font-semibold break-words ${
                  isExpired
                    ? 'text-slate-500 dark:text-slate-400'
                    : 'text-teal-900 dark:text-teal-300'
                }`}
              >
                {truncateReward(rewardText)}
              </dd>
            </div>
          )}
          {showCondition && (
            <div className="flex items-baseline gap-2">
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0 w-16">
                领取条件
              </dt>
              <dd className="text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed break-words">
                {item.condition}
              </dd>
            </div>
          )}
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

      {/* 展开区：核验记录、兑换码、步骤、风险、来源、标签、官方链接 */}
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

          {/* 官方直达链接（醒目） + 情报出处（次要） */}
          <div className="flex flex-wrap items-start gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold">去官网</span>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-teal-700 dark:text-teal-400 hover:text-teal-500 dark:hover:text-teal-300 underline underline-offset-2 hover:underline whitespace-nowrap shrink-0"
              >
                {item.sourceUrl}
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold">情报出处</span>
              {item.hasOfficialLink ? (
                <span className="text-xs text-slate-600 dark:text-slate-300 break-words truncate">
                  {item.intelSource || item.sourceUrl}
                </span>
              ) : (
                <span className="text-xs text-rose-600 dark:text-rose-400 break-words truncate">
                  暂无官方链接
                </span>
              )}
            </div>
          </div>

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
          {item.hasOfficialLink ? (
            <>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-teal-700 dark:text-teal-400 hover:text-teal-500 dark:hover:text-teal-300 whitespace-nowrap shrink-0"
              >
                <span>去官网</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
              <span className="text-xs text-slate-600 dark:text-slate-300 break-all truncate max-w-[120px]">
                情报出处：{item.intelSource || item.sourceUrl}
              </span>
            </>
          ) : (
            <>
              <span className="text-xs text-rose-600 dark:text-rose-400 break-all truncate max-w-[200px]">
                情报出处：暂无官方链接
              </span>
            </>
          )}

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
