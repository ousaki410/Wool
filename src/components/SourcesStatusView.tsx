import React, { useId, useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { SourceChannel, WoolItem } from '../data/woolData';
import { formatShanghaiDateTime } from '../data/shanghaiTime';

interface SourcesStatusViewProps {
  items: WoolItem[];
  channels: SourceChannel[];
  onSelectSourceItems: (sourceId: string) => void;
}

export const SourcesStatusView: React.FC<SourcesStatusViewProps> = ({
  items,
  channels,
  onSelectSourceItems,
}) => {
  const [vendorCollapsed, setVendorCollapsed] = useState(true);
  const vendorListId = useId();

  const sourceCount = channels.length;
  // “已收录条目”只统计 wool 线索（今日羊毛），新闻在订阅表里单独显示
  const totalEntries = items.length;
  // “已核验条目”只统计 verified.json 中有效的人工确认记录
  const verifiedCount = items.filter((i) => i.verification != null).length;
  // 最后抓取时间取所有来源中最新的一个
  const lastFetchAt = channels.length > 0
    ? channels.map((c) => c.lastFetchAt).filter(Boolean).sort().pop() || null
    : null;
  const formattedLastSync = lastFetchAt
    ? formatShanghaiDateTime(lastFetchAt)
    : '—';

  // 按来源名聚合“涉及厂商”数据，数据来自 wool.json 条目，按条目数降序
  const vendorMap = new Map<
    string,
    { name: string; entryCount: number; url: string; hasOfficialLink: boolean }
  >();
  for (const item of items) {
    const existing = vendorMap.get(item.sourceName);
    if (existing) {
      existing.entryCount += 1;
      existing.hasOfficialLink = existing.hasOfficialLink || Boolean(item.hasOfficialLink);
    } else {
      vendorMap.set(item.sourceName, {
        name: item.sourceName,
        entryCount: 1,
        url: item.sourceUrl,
        hasOfficialLink: Boolean(item.hasOfficialLink),
      });
    }
  }
  const vendors = Array.from(vendorMap.values()).sort(
    (a, b) => b.entryCount - a.entryCount
  );

  return (
    <div className="space-y-6">
      {/* 顶部 4 张卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            数据源数量
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {sourceCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            已收录条目
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {totalEntries} <span className="text-sm font-normal text-slate-400">条</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            已核验条目
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {verifiedCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            最后抓取时间
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums whitespace-nowrap">
            {formattedLastSync}
          </div>
        </div>
      </div>

      {/* 来源列表 */}
      {channels.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
          <div className="text-base font-bold text-slate-900 dark:text-slate-100">
            暂无来源数据
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            暂未加载到来源数据，请稍后再试。
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/60">
                  <th className="py-3 px-4">来源名称</th>
                  <th className="py-3 px-4 whitespace-nowrap">来源类型</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">条目数</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">最后抓取</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">上游链接</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {channels.map((ch) => (
                  <tr key={ch.id}>
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{ch.name}</span>
                        <a
                          href={ch.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`访问 ${ch.name} 订阅`}
                          className="text-slate-400 hover:text-teal-600 dark:hover:text-teal-400"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {ch.type}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap">
                      {ch.entryCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {ch.lastFetchAt
                        ? formatShanghaiDateTime(ch.lastFetchAt)
                        : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <a
                        href={ch.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-600 dark:text-teal-400 hover:underline truncate max-w-[220px]"
                      >
                        {ch.url}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 涉及厂商折叠区 */}
      {vendors.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setVendorCollapsed(!vendorCollapsed)}
            aria-expanded={!vendorCollapsed}
            aria-controls={vendorListId}
            className="w-full cursor-pointer flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-950/60 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 focus-visible:outline-offset-[-2px]"
          >
            <span className="text-base font-bold text-slate-900 dark:text-slate-100">
              涉及厂商（{vendors.length}）
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform ${vendorCollapsed ? '' : 'rotate-180'}`}
            />
          </button>
          <div
            id={vendorListId}
            hidden={vendorCollapsed}
            className="divide-y divide-slate-100 dark:divide-slate-800/80"
          >
            {vendors.map((v) => (
              <div
                key={v.name}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {v.name}
                  </span>
                  {v.hasOfficialLink && (
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-400 hover:text-teal-600 dark:hover:text-teal-400"
                    >
                      {v.url}
                    </a>
                  )}
                </div>
                <span className="text-xs font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                  {v.entryCount} 条
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
