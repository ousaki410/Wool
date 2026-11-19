import {
  formatShanghaiDate,
  formatShanghaiDateTime,
  formatShanghaiDateTimeWithSeconds,
  formatShanghaiWeekday,
  getShanghaiCalendarDayDiff,
  isWithinPastHours,
} from './shanghaiTime';
import { materializeSeedData } from './woolSeed';

export type WoolCategory =
  | 'AI 与大模型'
  | '云服务与算力'
  | '开发工具与 SaaS'
  | '支付与银行卡券'
  | '数字会员与影音'
  | '电商与生活福利';

export type ClaimMethod =
  | '直接领取'
  | '注册认证'
  | '兑换码激活'
  | '任务达标'
  | '教育/开源资质'
  | '受邀抽签';

export type VerificationStatus = '官方已核验' | '社区线索' | '未核验';

/** 条目分类：deal 可领取的福利或额度 / price_change 降价、更名、计费微调 /
 * change 其他额度与活动变化 / news 厂商新闻。
 * 只有 deal 和 change 进入“今日羊毛”，price_change 与 news 保留在单独分区。 */
export type ItemKind = 'deal' | 'price_change' | 'change' | 'news';

/** 条目方向：positive 新增福利或延期 / negative 取消下线免费期结束不支持免费门槛提高 / neutral 其他。 */
export type ItemDirection = 'positive' | 'negative' | 'neutral';

export type DeadlineState = 'expiring_soon' | 'active' | 'long_term' | 'expired';

export type DeadlineFilter = '全部' | '即将到期' | '有效期内' | '长期有效' | '已过期';

export interface WoolItem {
  id: string;
  title: string;
  reward: string | null;
  estimatedValue: string | null;
  estimatedValueRmb: number | null;
  condition: string | null;
  category: WoolCategory;
  claimMethod: ClaimMethod | null;
  verificationStatus: VerificationStatus;
  verificationNote: string;
  /** 规范字段：截止时间（ISO 字符串，null 表示长期有效）。剩余天数与“即将到期”按当前时间实时计算。 */
  expiresAt: string | null;
  /**
   * 过渡别名，值应与 expiresAt 保持一致。
   * 新代码只使用 expiresAt，deadline 后续删除。
   * @deprecated 使用 expiresAt
   */
  deadline: string | null;
  publishedAt: string;
  /** 首次入库时间（ISO），用于“新增”标记的时效判断；缺省回退到 publishedAt */
  createdAt?: string;
  /** 最后变更时间（ISO），用于“已更新”标记的时效判断；缺省回退到 publishedAt */
  updatedAt?: string;
  /** 来源端标记为新增，查看或超时后淡化 */
  isNew?: boolean;
  /** 来源端标记为已更新，查看或超时后淡化 */
  isUpdated?: boolean;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  steps: string[];
  promoCode?: string;
  riskNotes?: string;
  tags: string[];
  /** 条目分类，由数据来源计算得出；mock 种子不设此字段。 */
  kind?: ItemKind;
  /** 条目方向，由数据来源计算得出；mock 种子不设此字段。 */
  direction?: ItemDirection;
  /** 是否命中官方直达链接（sourceUrl 指向官方页而非 GitHub 镜像）。 */
  hasOfficialLink?: boolean;
  /** 标题中出现的明确截止日期提示（如“顺延至 2026-11-23”），不写入 expiresAt。 */
  deadlineHint?: string;
  /** 情报出处：上游 RSS 的 GitHub 锚点链接。 */
  intelSource?: string;
  /** 原始 README 中“官方直达”一栏的链接文字（用于审计链接是否对应正确厂商）。 */
  linkText?: string;
}

export interface SourceChannel {
  id: string;
  name: string;
  type: string;
  url: string;
  entryCount: number;
  lastFetchAt: string | null;
}

export interface PushSettingsConfig {
  enabled: boolean;
  mode: 'instant_and_digest' | 'digest_only' | 'urgent_only';
  digestTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  onlyVerified: boolean;
  includeCommunityClues: boolean;
  expiringReminderHours: 24 | 48 | 72;
  minEstimatedValueRmb: number;
  subscribedCategories: WoolCategory[];
  templateStyle: 'compact' | 'detailed';
}

export const WOOL_CATEGORIES: WoolCategory[] = [
  'AI 与大模型',
  '云服务与算力',
  '开发工具与 SaaS',
  '支付与银行卡券',
  '数字会员与影音',
  '电商与生活福利',
];

export const CLAIM_METHODS: ClaimMethod[] = [
  '直接领取',
  '注册认证',
  '兑换码激活',
  '任务达标',
  '教育/开源资质',
  '受邀抽签',
];

export const VERIFICATION_STATUSES: VerificationStatus[] = [
  '官方已核验',
  '社区线索',
  '未核验',
];

export const DEADLINE_FILTERS: DeadlineFilter[] = [
  '全部',
  '即将到期',
  '有效期内',
  '长期有效',
  '已过期',
];

export const DEFAULT_PUSH_SETTINGS: PushSettingsConfig = {
  enabled: true,
  mode: 'instant_and_digest',
  digestTime: '08:30',
  quietHoursStart: '23:30',
  quietHoursEnd: '07:30',
  onlyVerified: false,
  includeCommunityClues: true,
  expiringReminderHours: 48,
  minEstimatedValueRmb: 20,
  subscribedCategories: [...WOOL_CATEGORIES],
  templateStyle: 'detailed',
};

/**
 * 读取条目的规范截止时间。
 * 过渡期兼容旧字段 deadline；新代码应只使用 expiresAt。
 */
export function getItemExpiresAt(
  item: Pick<WoolItem, 'expiresAt' | 'deadline'>
): string | null {
  return item.expiresAt ?? item.deadline;
}

/**
 * Pure helper to calculate the deadline state of a WoolItem relative to a reference ISO date.
 * - expired: deadline < now
 * - expiring_soon: deadline is within 72 hours (3 days) from now
 * - active: deadline > 72 hours from now
 * - long_term: deadline is null
 */
export function getDeadlineState(
  deadlineIso: string | null,
  referenceNowIso: string
): DeadlineState {
  if (!deadlineIso) {
    return 'long_term';
  }
  const nowMs = new Date(referenceNowIso).getTime();
  const endMs = new Date(deadlineIso).getTime();
  const diffMs = endMs - nowMs;

  if (diffMs < 0) {
    return 'expired';
  }
  const hours72Ms = 72 * 60 * 60 * 1000;
  if (diffMs <= hours72Ms) {
    return 'expiring_soon';
  }
  return 'active';
}

/** 方向标签文本：positive 新增福利 / negative 福利收紧 / neutral 其他变化。 */
export function formatDirectionLabel(direction: ItemDirection): string {
  switch (direction) {
    case 'positive':
      return '新增福利';
    case 'negative':
      return '福利收紧';
    case 'neutral':
      return '其他变化';
  }
}

/**
 * 根据 direction 返回对应的文本颜色类名。
 */
export function formatDirectionColor(direction: ItemDirection): string {
  switch (direction) {
    case 'positive':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'negative':
      return 'text-rose-700 dark:text-rose-400';
    case 'neutral':
      return 'text-slate-500 dark:text-slate-400';
  }
}

/**
 * Formats a human-readable relative countdown or date label in Chinese.
 */
export function formatDeadlineLabel(
  deadlineIso: string | null,
  referenceNowIso: string
): { state: DeadlineState; badgeText: string; dateText: string } {
  if (!deadlineIso) {
    return {
      state: 'long_term',
      badgeText: '截止时间未知',
      dateText: '无固定截止日期',
    };
  }

  const nowMs = new Date(referenceNowIso).getTime();
  const endMs = new Date(deadlineIso).getTime();
  const diffMs = endMs - nowMs;

  // 截止时间统一按 Asia/Shanghai 展示
  const dateText = formatShanghaiDateTime(deadlineIso);

  if (diffMs < 0) {
    // 过期天数按上海日历日计算，23:59 → 00:01 会正确跳到下一天
    const pastDays = Math.max(
      1,
      Math.abs(getShanghaiCalendarDayDiff(referenceNowIso, deadlineIso))
    );
    return {
      state: 'expired',
      badgeText: `已过期 ${pastDays} 天`,
      dateText,
    };
  }

  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffMs <= 72 * 60 * 60 * 1000) {
    if (diffMs < 24 * 60 * 60 * 1000) {
      return {
        state: 'expiring_soon',
        badgeText: `剩 ${Math.max(1, diffHours)} 小时到期`,
        dateText,
      };
    }
    const diffDays = Math.max(
      1,
      getShanghaiCalendarDayDiff(referenceNowIso, deadlineIso)
    );
    return {
      state: 'expiring_soon',
      badgeText: `即将到期 · 剩 ${diffDays} 天`,
      dateText,
    };
  }

  const remainingDays = Math.max(
    1,
    getShanghaiCalendarDayDiff(referenceNowIso, deadlineIso)
  );
  return {
    state: 'active',
    badgeText: `剩余 ${remainingDays} 天`,
    dateText,
  };
}

export interface WoolFilterCriteria {
  searchQuery?: string;
  category?: WoolCategory | '全部';
  claimMethod?: ClaimMethod | '全部';
  deadlineFilter?: DeadlineFilter;
  verificationStatus?: VerificationStatus | '全部';
  sourceId?: string | '全部';
  sortBy?: 'recommended' | 'value_desc' | 'deadline_asc' | 'latest';
}

/**
 * Pure function to filter and sort wool intelligence items.
 */
export function filterAndSortWoolItems(
  items: WoolItem[],
  criteria: WoolFilterCriteria,
  referenceNowIso: string
): WoolItem[] {
  const {
    searchQuery = '',
    category = '全部',
    claimMethod = '全部',
    deadlineFilter = '全部',
    verificationStatus = '全部',
    sourceId = '全部',
    sortBy = 'recommended',
  } = criteria;

  const q = searchQuery.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (category !== '全部' && item.category !== category) {
      return false;
    }
    if (claimMethod !== '全部' && item.claimMethod !== claimMethod) {
      return false;
    }
    if (verificationStatus !== '全部' && item.verificationStatus !== verificationStatus) {
      return false;
    }
    if (sourceId !== '全部' && item.sourceId !== sourceId) {
      return false;
    }

    const dState = getDeadlineState(getItemExpiresAt(item), referenceNowIso);
    if (deadlineFilter === '即将到期' && dState !== 'expiring_soon') {
      return false;
    }
    if (deadlineFilter === '有效期内' && dState === 'expired') {
      return false;
    }
    if (deadlineFilter === '长期有效' && dState !== 'long_term') {
      return false;
    }
    if (deadlineFilter === '已过期' && dState !== 'expired') {
      return false;
    }

    if (q) {
      const haystack = [
        item.title,
        item.reward,
        item.condition,
        item.sourceName,
        item.category,
        item.claimMethod,
        ...item.tags,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    const stateA = getDeadlineState(getItemExpiresAt(a), referenceNowIso);
    const stateB = getDeadlineState(getItemExpiresAt(b), referenceNowIso);

    // Always sink expired items to bottom unless explicitly sorting by latest
    if (stateA === 'expired' && stateB !== 'expired') return 1;
    if (stateA !== 'expired' && stateB === 'expired') return -1;

    if (sortBy === 'value_desc') {
      const va = a.estimatedValueRmb ?? 0;
      const vb = b.estimatedValueRmb ?? 0;
      return vb - va;
    }

    if (sortBy === 'deadline_asc') {
      const endA = getItemExpiresAt(a)
        ? new Date(getItemExpiresAt(a)!).getTime()
        : Number.MAX_SAFE_INTEGER;
      const endB = getItemExpiresAt(b)
        ? new Date(getItemExpiresAt(b)!).getTime()
        : Number.MAX_SAFE_INTEGER;
      return endA - endB;
    }

    if (sortBy === 'latest') {
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    }

    // Default 'recommended': expiring_soon first, then official verified, then nearest deadline
    const priorityState = { expiring_soon: 0, active: 1, long_term: 2, expired: 3 };
    if (priorityState[stateA] !== priorityState[stateB]) {
      return priorityState[stateA] - priorityState[stateB];
    }
    const priorityVerify = { 官方已核验: 0, 社区线索: 1, 未核验: 2 };
    if (priorityVerify[a.verificationStatus] !== priorityVerify[b.verificationStatus]) {
      return priorityVerify[a.verificationStatus] - priorityVerify[b.verificationStatus];
    }
    const endA = getItemExpiresAt(a);
    const endB = getItemExpiresAt(b);
    return (
      (endA ? new Date(endA).getTime() : Number.MAX_SAFE_INTEGER) -
      (endB ? new Date(endB).getTime() : Number.MAX_SAFE_INTEGER)
    );
  });
}

/**
 * 统计 nowIso 之前 hours 小时内新增/入库的条目数。
 * 优先使用 createdAt，缺省回退 publishedAt；不读取系统当前时间。
 */
export function countRecentWoolItems(
  items: WoolItem[],
  nowIso: string,
  hours = 24
): number {
  return items.filter((item) =>
    isWithinPastHours(item.createdAt ?? item.publishedAt, nowIso, hours)
  ).length;
}

/**
 * 生成 Telegram 日报文本。
 * 所有与“当前时间”有关的展示（日期、星期、生成时间、24h 新增、剩余天数、
 * 即将到期判断）都只能使用调用方传入的 referenceNowIso。
 */
export function buildTelegramDigestText(
  items: WoolItem[],
  options: {
    onlyVerified: boolean;
    includeExpiringSection: boolean;
    templateStyle: 'compact' | 'detailed';
  },
  referenceNowIso: string
): string {
  const validItems = items.filter((item) => {
    const st = getDeadlineState(getItemExpiresAt(item), referenceNowIso);
    if (st === 'expired') return false;
    if (options.onlyVerified && item.verificationStatus !== '官方已核验') return false;
    return true;
  });

  const expiringItems = validItems.filter(
    (i) => getDeadlineState(getItemExpiresAt(i), referenceNowIso) === 'expiring_soon'
  );
  const topVerifiedItems = validItems
    .filter((i) => i.verificationStatus === '官方已核验')
    .slice(0, 6);
  const recentAddedCount = countRecentWoolItems(items, referenceNowIso, 24);

  const lines: string[] = [
    '📡 【WoolRadar 羊毛雷达 · 今日情报汇总】',
    `📅 日期：${formatShanghaiDate(referenceNowIso)} ${formatShanghaiWeekday(referenceNowIso)} | 终端单用户本地版`,
    `🕒 生成时间：${formatShanghaiDateTimeWithSeconds(referenceNowIso)} (Asia/Shanghai)`,
    `🆕 最近 24 小时新增：${recentAddedCount} 条`,
    `📊 有效情报：${validItems.length} 条 | 即将到期：${expiringItems.length} 条`,
    '────────────────────',
  ];

  if (options.includeExpiringSection && expiringItems.length > 0) {
    lines.push('⏰ 【72h 内即将截止 · 优先处理】');
    expiringItems.forEach((item, idx) => {
      const dl = formatDeadlineLabel(getItemExpiresAt(item), referenceNowIso);
      const badge =
        item.verificationStatus === '官方已核验'
          ? '[官方核验]'
          : item.verificationStatus === '社区线索'
          ? '[社区线索]'
          : '[未核验]';
      lines.push(`${idx + 1}. ${badge} ${item.title}`);
      lines.push(`   🎁 可得：${item.reward}`);
      if (options.templateStyle === 'detailed') {
        lines.push(`   📋 条件：${item.condition}`);
      }
      lines.push(`   ⏳ 截止：${dl.badgeText} (${dl.dateText})`);
    });
    lines.push('────────────────────');
  }

  lines.push('✅ 【今日精选已核验羊毛】');
  topVerifiedItems.forEach((item, idx) => {
    const dl = formatDeadlineLabel(getItemExpiresAt(item), referenceNowIso);
    lines.push(`${idx + 1}. ${item.title}`);
    lines.push(`   🎁 权益：${item.reward}`);
    if (options.templateStyle === 'detailed') {
      lines.push(`   🔑 方式：${item.claimMethod} | 条件：${item.condition}`);
      if (item.promoCode) {
        lines.push(`   🎫 兑换码：${item.promoCode}`);
      }
    }
    lines.push(`   🕒 状态：${dl.badgeText} | 来源：${item.sourceName}`);
  });

  lines.push('────────────────────');
  lines.push('💡 提示：领完试用订阅后请及时检查自动续费设置，谨防反撸。');

  return lines.join('\n');
}

// Unified Data Access Layer (Single entry point for replacing with real APIs later)
export function getWoolItems(nowMs: number): WoolItem[] {
  return materializeSeedData(nowMs).items;
}

export function getSourceChannels(nowMs: number): SourceChannel[] {
  return materializeSeedData(nowMs).channels;
}

export function getDefaultBookmarkIds(): string[] {
  return ['WR-2026-01', 'WR-2026-03', 'WR-2026-06', 'WR-2026-07'];
}
