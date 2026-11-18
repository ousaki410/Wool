import React, { useState, useMemo } from 'react';
import {
  Check,
  RotateCcw,
  Bell,
  Clock,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import {
  PushSettingsConfig,
  WOOL_CATEGORIES,
  WoolCategory,
  WoolItem,
  getDeadlineState,
  getItemExpiresAt,
  formatDeadlineLabel,
} from '../data/woolData';
import { formatShanghaiDateTime } from '../data/shanghaiTime';

interface PushSettingsViewProps {
  settings: PushSettingsConfig;
  onSaveSettings: (next: PushSettingsConfig) => void;
  onResetDefaults: () => void;
  items: WoolItem[];
  /** 当前时间（ISO），由 useWools 每分钟刷新 */
  nowIso: string;
}

const VERIFICATION_ORDER: Record<WoolItem['verificationStatus'], number> = {
  官方已核验: 0,
  社区线索: 1,
  未核验: 2,
};

export const PushSettingsView: React.FC<PushSettingsViewProps> = ({
  settings,
  onSaveSettings,
  onResetDefaults,
  items,
  nowIso,
}) => {
  const [draft, setDraft] = useState<PushSettingsConfig>(settings);
  const [savedNotice, setSavedNotice] = useState(false);

  // Sync draft if parent resets
  React.useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const toggleCategory = (cat: WoolCategory) => {
    setDraft((prev) => {
      const exists = prev.subscribedCategories.includes(cat);
      const nextCats = exists
        ? prev.subscribedCategories.filter((c) => c !== cat)
        : [...prev.subscribedCategories, cat];
      return { ...prev, subscribedCategories: nextCats };
    });
  };

  // 命中预演：不按预估价值过滤，按核验状态与截止时间排序
  const matchingItems = useMemo(() => {
    if (!draft.enabled) return [];
    return items
      .filter((item) => {
        const st = getDeadlineState(getItemExpiresAt(item), nowIso);
        if (st === 'expired') return false;
        if (!draft.subscribedCategories.includes(item.category)) return false;
        if (draft.onlyVerified && item.verificationStatus !== '官方已核验') return false;
        if (
          !draft.onlyVerified &&
          !draft.includeCommunityClues &&
          item.verificationStatus !== '官方已核验'
        ) {
          return false;
        }
        if (draft.mode === 'urgent_only' && st !== 'expiring_soon') return false;
        return true;
      })
      .sort((a, b) => {
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
  }, [draft, items, nowIso]);

  const matchingRuleCount = matchingItems.length;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(draft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2200);
  };

  return (
    <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main Settings Form (8 cols) */}
      <div className="lg:col-span-8 space-y-6">
        {/* Section 1: Master Switch & Delivery Mode */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>推送总开关与触发模式</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                仅配置前端筛选与汇总分发策略，不涉及任何第三方密钥或账号凭据输入。
              </p>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {draft.enabled ? '推送已开启' : '推送已暂停'}
              </span>
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'instant_and_digest' as const,
                title: '实时高优 + 每日早报',
                desc: '官方核验大额羊毛即时提醒，其余汇总至早报',
              },
              {
                id: 'digest_only' as const,
                title: '仅每日定时日报',
                desc: '全天静默收录，仅在设定时间推送 1 封汇总消息',
              },
              {
                id: 'urgent_only' as const,
                title: '仅即将到期紧急预警',
                desc: '只推送剩余时间不足预警阈值的倒计时情报',
              },
            ].map((option) => {
              const active = draft.mode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setDraft({ ...draft, mode: option.id })}
                  className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'border-teal-600 dark:border-teal-400 bg-teal-50/40 dark:bg-teal-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {option.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {option.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 2: Schedule & Quiet Hours */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>定时汇总与免打扰时段</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="digest-time-select"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                每日早报投递时间
              </label>
              <select
                id="digest-time-select"
                value={draft.digestTime}
                onChange={(e) => setDraft({ ...draft, digestTime: e.target.value })}
                className="w-full text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 cursor-pointer"
              >
                <option value="08:00">08:00 (早间通勤)</option>
                <option value="08:30">08:30 (推荐早报点)</option>
                <option value="12:30">12:30 (午休汇总)</option>
                <option value="20:00">20:00 (晚间复盘)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="quiet-start-select"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                夜间免打扰开始
              </label>
              <select
                id="quiet-start-select"
                value={draft.quietHoursStart}
                onChange={(e) => setDraft({ ...draft, quietHoursStart: e.target.value })}
                className="w-full text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 cursor-pointer"
              >
                <option value="22:00">22:00</option>
                <option value="23:00">23:00</option>
                <option value="23:30">23:30</option>
                <option value="00:00">00:00</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="quiet-end-select"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                夜间免打扰结束
              </label>
              <select
                id="quiet-end-select"
                value={draft.quietHoursEnd}
                onChange={(e) => setDraft({ ...draft, quietHoursEnd: e.target.value })}
                className="w-full text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 cursor-pointer"
              >
                <option value="07:00">07:00</option>
                <option value="07:30">07:30</option>
                <option value="08:00">08:00</option>
                <option value="09:00">09:00</option>
              </select>
            </div>
          </div>
        </section>

        {/* Section 3: Verification & Value Filter Thresholds */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>核验准入与价值门槛</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  严格模式：仅推送「官方已核验」
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  开启后自动屏蔽所有社区线索与未核验传闻
                </div>
              </div>
              <input
                type="checkbox"
                checked={draft.onlyVerified}
                onChange={(e) => setDraft({ ...draft, onlyVerified: e.target.checked })}
                className="w-4 h-4 accent-teal-600 rounded mt-0.5 cursor-pointer"
              />
            </label>

            <label className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  包含高热度「社区线索」
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  当严格模式关闭时，允许推送 V2EX / Linux.do 实测线索
                </div>
              </div>
              <input
                type="checkbox"
                disabled={draft.onlyVerified}
                checked={!draft.onlyVerified && draft.includeCommunityClues}
                onChange={(e) =>
                  setDraft({ ...draft, includeCommunityClues: e.target.checked })
                }
                className="w-4 h-4 accent-teal-600 rounded mt-0.5 cursor-pointer disabled:opacity-40"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label
                htmlFor="expiring-hours-select"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                即将到期二次提醒提前量
              </label>
              <select
                id="expiring-hours-select"
                value={draft.expiringReminderHours}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    expiringReminderHours: Number(e.target.value) as 24 | 48 | 72,
                  })
                }
                className="w-full text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 cursor-pointer"
              >
                <option value={24}>截止前 24 小时</option>
                <option value={48}>截止前 48 小时（推荐）</option>
                <option value={72}>截止前 72 小时</option>
              </select>
            </div>
          </div>
        </section>

        {/* Section 4: Category Subscriptions */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>订阅情报分类 ({draft.subscribedCategories.length}/{WOOL_CATEGORIES.length})</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                setDraft({ ...draft, subscribedCategories: [...WOOL_CATEGORIES] })
              }
              className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
            >
              全选分类
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {WOOL_CATEGORIES.map((cat) => {
              const checked = draft.subscribedCategories.includes(cat);
              return (
                <label
                  key={cat}
                  className={`flex items-center justify-between p-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                    checked
                      ? 'border-teal-600/70 dark:border-teal-500/70 bg-teal-50/30 dark:bg-teal-950/25 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <span>{cat}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(cat)}
                    className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
                  />
                </label>
              );
            })}
          </div>
        </section>
      </div>

      {/* Right Summary & Save Panel (4 cols) */}
      <aside className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 sticky top-20">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            当前规则命中预演
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            根据左侧勾选的过滤条件，实时计算当前收录情报中将触发推送的条目数。
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">符合推送规则的有效情报</div>
          <div className="text-3xl font-bold font-mono text-teal-700 dark:text-teal-400 tabular-nums">
            {matchingRuleCount}{' '}
            <span className="text-sm font-normal text-slate-500">/ {items.length} 条收录</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            已剔除过期条目，按核验状态与截止时间排序
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            预演基准时间：<span className="font-mono tabular-nums">{formatShanghaiDateTime(nowIso)}</span>
            （Asia/Shanghai）
          </div>

          {matchingItems.length > 0 && (
            <ul className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
              {matchingItems.slice(0, 3).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300"
                >
                  <span className="truncate">{item.title}</span>
                  <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">
                    {item.verificationStatus} · {formatDeadlineLabel(getItemExpiresAt(item), nowIso).badgeText}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <dl className="text-xs space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300">
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">推送状态</dt>
            <dd className="font-semibold">{draft.enabled ? '开启中' : '已关闭'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">早报时间</dt>
            <dd className="font-mono tabular-nums">{draft.digestTime}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">免打扰窗口</dt>
            <dd className="font-mono tabular-nums">
              {draft.quietHoursStart} – {draft.quietHoursEnd}
            </dd>
          </div>
        </dl>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Check className="w-4 h-4" />
            <span>{savedNotice ? '已保存推送规则配置' : '保存推送设置'}</span>
          </button>

          <button
            type="button"
            onClick={onResetDefaults}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>恢复默认配置</span>
          </button>
        </div>
      </aside>
    </form>
  );
};
