import React from 'react';
import { Search, RotateCcw, ShieldCheck, Users, HelpCircle, X } from 'lucide-react';
import {
  WOOL_CATEGORIES,
  CLAIM_METHODS,
  DEADLINE_FILTERS,
  VERIFICATION_STATUSES,
  WoolCategory,
  ClaimMethod,
  DeadlineFilter,
  VerificationStatus,
} from '../data/woolData';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  category: WoolCategory | '全部';
  onCategoryChange: (c: WoolCategory | '全部') => void;
  claimMethod: ClaimMethod | '全部';
  onClaimMethodChange: (m: ClaimMethod | '全部') => void;
  deadlineFilter: DeadlineFilter;
  onDeadlineFilterChange: (d: DeadlineFilter) => void;
  verificationStatus: VerificationStatus | '全部';
  onVerificationStatusChange: (v: VerificationStatus | '全部') => void;
  sortBy: 'recommended' | 'value_desc' | 'deadline_asc' | 'latest';
  onSortByChange: (s: 'recommended' | 'value_desc' | 'deadline_asc' | 'latest') => void;
  activeSourceName?: string | null;
  onClearSourceFilter?: () => void;
  onResetAll: () => void;
  totalMatching: number;
  totalCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  category,
  onCategoryChange,
  claimMethod,
  onClaimMethodChange,
  deadlineFilter,
  onDeadlineFilterChange,
  verificationStatus,
  onVerificationStatusChange,
  sortBy,
  onSortByChange,
  activeSourceName,
  onClearSourceFilter,
  onResetAll,
  totalMatching,
  totalCount,
}) => {
  const hasActiveFilter =
    searchQuery.trim() !== '' ||
    category !== '全部' ||
    claimMethod !== '全部' ||
    deadlineFilter !== '全部' ||
    verificationStatus !== '全部' ||
    Boolean(activeSourceName);

  return (
    <section
      aria-label="情报多维筛选栏"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-3.5"
    >
      {/* Top Row: Search Input + Sort Selector + Active Result Count */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索羊毛名称、可得权益、领取条件、兑换码或平台（如 Claude、阿里云、数币、教育邮箱）..."
            aria-label="搜索羊毛情报"
            className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-teal-600 dark:focus:border-teal-400 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="清空搜索词"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 shrink-0">
          {activeSourceName && onClearSourceFilter && (
            <button
              type="button"
              onClick={onClearSourceFilter}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>来源：{activeSourceName}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <label
              htmlFor="wool-sort-select"
              className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0"
            >
              排序
            </label>
            <select
              id="wool-sort-select"
              value={sortBy}
              onChange={(e) =>
                onSortByChange(
                  e.target.value as 'recommended' | 'value_desc' | 'deadline_asc' | 'latest'
                )
              }
              className="text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-teal-600 dark:focus:border-teal-400 cursor-pointer"
            >
              <option value="recommended">智能优先级（即将到期/已核验优先）</option>
              <option value="value_desc">预估价值（从高到低）</option>
              <option value="deadline_asc">截止时间（最近截止优先）</option>
              <option value="latest">发布时间（最新收录优先）</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap shrink-0">
            匹配 <strong className="text-slate-900 dark:text-slate-100 font-semibold">{totalMatching}</strong> / {totalCount} 条
          </div>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={onResetAll}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重置筛选</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Matrix Rows */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 1. 核验状态 */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0 w-14 pt-1.5">
            核验状态
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => onVerificationStatusChange('全部')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                verificationStatus === '全部'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              全部状态
            </button>
            {VERIFICATION_STATUSES.map((status) => {
              const active = verificationStatus === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => onVerificationStatusChange(status)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? status === '官方已核验'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : status === '社区线索'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {status === '官方已核验' && <ShieldCheck className="w-3.5 h-3.5" />}
                  {status === '社区线索' && <Users className="w-3.5 h-3.5" />}
                  {status === '未核验' && <HelpCircle className="w-3.5 h-3.5" />}
                  <span>{status}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 截止日期 */}
        <div className="flex items-start gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0 w-14 pt-1.5">
            截止日期
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            {DEADLINE_FILTERS.map((df) => {
              const active = deadlineFilter === df;
              return (
                <button
                  key={df}
                  type="button"
                  onClick={() => onDeadlineFilterChange(df)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? df === '即将到期'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : df === '已过期'
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {df}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. 羊毛类型 */}
        <div className="flex items-start gap-2 md:col-span-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0 w-14 pt-1.5">
            情报类型
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => onCategoryChange('全部')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                category === '全部'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              全部类型
            </button>
            {WOOL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  category === cat
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 4. 获取方式 */}
        <div className="flex items-start gap-2 md:col-span-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0 w-14 pt-1.5">
            获取方式
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => onClaimMethodChange('全部')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                claimMethod === '全部'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              全部方式
            </button>
            {CLAIM_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => onClaimMethodChange(method)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  claimMethod === method
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
