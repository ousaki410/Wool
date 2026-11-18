import React, { useState } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { SourceChannel } from '../data/woolData';

interface SourcesStatusViewProps {
  channels: SourceChannel[];
  onToggleChannel: (id: string) => void;
  onSyncAll: () => void;
  onSelectSourceItems: (sourceId: string) => void;
}

export const SourcesStatusView: React.FC<SourcesStatusViewProps> = ({
  channels,
  onToggleChannel,
  onSyncAll,
  onSelectSourceItems,
}) => {
  const [selectedType, setSelectedType] = useState<string>('全部');
  const [syncing, setSyncing] = useState(false);

  const sourceTypes = ['全部', '官方公告', '技术社区', '金融卡券监测', '开源与教育计划', '聚合频道'];

  const filteredChannels =
    selectedType === '全部'
      ? channels
      : channels.filter((c) => c.type === selectedType);

  const enabledCount = channels.filter((c) => c.enabled).length;
  const todayTotal = channels.reduce((sum, c) => sum + c.todayCount, 0);
  const normalCount = channels.filter((c) => c.status === '正常').length;
  const faultyCount = channels.filter((c) => c.status !== '正常').length;
  const avgVerifiedRate = Math.round(
    channels.reduce((sum, c) => sum + c.verifiedRate, 0) / Math.max(1, channels.length)
  );
  const latestSyncAt = channels.reduce(
    (latest, c) => (c.lastSyncAt > latest ? c.lastSyncAt : latest),
    ''
  );

  const handleManualSync = () => {
    setSyncing(true);
    setTimeout(() => {
      onSyncAll();
      setSyncing(false);
    }, 300);
  };

  return (
    <div className="space-y-6">
      {/* Top Summary Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">启用监测源</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {enabledCount} <span className="text-sm font-normal text-slate-400">/ {channels.length}</span>
          </div>
          <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
            {normalCount} 个源正常 · {faultyCount} 个源异常
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">今日捕获线索</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {todayTotal} <span className="text-sm font-normal text-slate-400">条</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            累计收录 {channels.reduce((sum, c) => sum + c.totalCount, 0)} 条情报
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">平均官方核验率</div>
          <div className="mt-1 text-2xl font-bold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
            {avgVerifiedRate}%
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            各渠道核验率均值，随来源事件实时更新
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">本地索引同步</div>
            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              {latestSyncAt || "—"}
            </div>
          </div>
          <button
            type="button"
            onClick={handleManualSync}
            className="mt-2 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? '正在刷新本地索引...' : '刷新全部来源状态'}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar for Source Types */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-2">
            渠道分类
          </span>
          {sourceTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                selectedType === t
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          显示 {filteredChannels.length} 个来源渠道
        </div>
      </div>

      {/* High-Density Source Table / Cards */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/60">
                <th className="py-3 px-4">情报源名称与说明</th>
                <th className="py-3 px-4 whitespace-nowrap">渠道类型</th>
                <th className="py-3 px-4 whitespace-nowrap">运行状态</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">轮询间隔</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">今日 / 累计</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">核验通过率</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">最近同步</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
              {filteredChannels.map((ch) => (
                <tr
                  key={ch.id}
                  className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                    !ch.enabled ? 'opacity-55' : ''
                  }`}
                >
                  <td className="py-3.5 px-4 max-w-md">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>{ch.name}</span>
                      <a
                        href={ch.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`访问 ${ch.name} 官网`}
                        className="text-slate-400 hover:text-teal-600 dark:hover:text-teal-400"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {ch.description}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {ch.type}
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {ch.status === '正常' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>正常</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{ch.status}</span>
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                    {ch.intervalMinutes} min
                  </td>

                  <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap">
                    <strong>+{ch.todayCount}</strong> / {ch.totalCount}
                  </td>

                  <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                    <span
                      className={
                        ch.verifiedRate >= 90
                          ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                          : ch.verifiedRate >= 70
                          ? 'text-teal-700 dark:text-teal-400 font-semibold'
                          : 'text-amber-700 dark:text-amber-400 font-semibold'
                      }
                    >
                      {ch.verifiedRate}%
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                    {ch.lastSyncAt}
                  </td>

                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectSourceItems(ch.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Filter className="w-3 h-3" />
                        <span>查看情报</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleChannel(ch.id)}
                        aria-label={ch.enabled ? `停用 ${ch.name}` : `启用 ${ch.name}`}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          ch.enabled
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            : 'bg-teal-600 text-white'
                        }`}
                      >
                        {ch.enabled ? '已启用' : '已暂停'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
