import type { WoolItem } from './woolData';

export const VERIFIED_JSON_VERSION = 1;
/** 人工确认有效期：30 天。 */
export const VERIFICATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const VERIFICATION_MIN_QUOTE_LENGTH = 10;

export type VerificationInvalidReason =
  | '标题已变化'
  | '确认已过期，需复核'
  | '已撤销'
  | '域名不符'
  | '原文不足 10 字'
  | '确认时间无效'
  | '记录格式无效'
  | '条目不存在';

export interface VerifiedRecord {
  itemId: string;
  titleSnapshot: string;
  officialUrl: string;
  quote: string;
  note: string;
  confirmedAt: string;
  confirmedBy: string;
  revokedAt: string | null;
}

export interface VerifiedJson {
  version: typeof VERIFIED_JSON_VERSION;
  records: VerifiedRecord[];
}

/** 有效记录挂载到条目上的人工确认信息。 */
export interface ManualVerification {
  confirmedAt: string;
  confirmedBy: string;
  quote: string;
  note: string;
  officialUrl: string;
}

/** 记录存在但已失效时，卡片展示的失效信息。 */
export interface VerificationIssue {
  reason: VerificationInvalidReason;
  confirmedAt: string | null;
  confirmedBy: string | null;
}

function toTime(value: Date | string | number): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** 官方网站域名；忽略 www. 前缀差异。 */
export function normalizeDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

/** 记录结构是否完整、字段类型是否正确（不判断 30 天有效期等业务规则）。 */
export function isVerifiedRecordShape(value: unknown): value is VerifiedRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    isNonEmptyString(record.itemId) &&
    isNonEmptyString(record.titleSnapshot) &&
    isNonEmptyString(record.officialUrl) &&
    typeof record.quote === 'string' &&
    typeof record.note === 'string' &&
    isNonEmptyString(record.confirmedAt) &&
    isNonEmptyString(record.confirmedBy) &&
    (record.revokedAt === null || typeof record.revokedAt === 'string')
  );
}

/**
 * 返回记录失效原因；null 表示记录有效。
 * 规则：结构正确、quote ≥ 10 字、confirmedAt 合法且不晚于 now、未撤销、
 * 条目存在、标题快照一致、官方链接域名一致、确认时间不超过 30 天。
 */
export function getVerificationInvalidReason(
  record: unknown,
  item: Pick<WoolItem, 'title' | 'sourceUrl'> | null | undefined,
  now: Date | string | number
): VerificationInvalidReason | null {
  if (!isVerifiedRecordShape(record)) return '记录格式无效';
  if (record.revokedAt !== null) return '已撤销';
  if (!item) return '条目不存在';
  if (record.quote.replace(/\s+/g, '').length < VERIFICATION_MIN_QUOTE_LENGTH) {
    return '原文不足 10 字';
  }
  if (record.titleSnapshot !== item.title) return '标题已变化';

  const officialDomain = normalizeDomain(record.officialUrl);
  const itemDomain = normalizeDomain(item.sourceUrl);
  if (!officialDomain || !itemDomain || officialDomain !== itemDomain) {
    return '域名不符';
  }

  const confirmedAt = toTime(record.confirmedAt);
  const nowTime = toTime(now);
  if (confirmedAt === null || nowTime === null || confirmedAt > nowTime) {
    return '确认时间无效';
  }
  if (nowTime - confirmedAt > VERIFICATION_MAX_AGE_MS) {
    return '确认已过期，需复核';
  }

  return null;
}

/** 纯函数：记录是否有效。 */
export function isRecordValid(
  record: unknown,
  item: Pick<WoolItem, 'title' | 'sourceUrl'> | null | undefined,
  now: Date | string | number
): boolean {
  return getVerificationInvalidReason(record, item, now) === null;
}

/** 解析 verified.json；格式不合法时返回空数组，交由校验脚本报告错误。 */
export function parseVerifiedRecords(value: unknown): VerifiedRecord[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const root = value as Record<string, unknown>;
  if (root.version !== VERIFIED_JSON_VERSION || !Array.isArray(root.records)) {
    return [];
  }
  return root.records.filter((record): record is VerifiedRecord =>
    isVerifiedRecordShape(record)
  );
}

function recordTime(record: unknown): number {
  if (!record || typeof record !== 'object') return 0;
  const value = (record as Record<string, unknown>).confirmedAt;
  if (typeof value !== 'string') return 0;
  return Date.parse(value) || 0;
}

function toManualVerification(record: VerifiedRecord): ManualVerification {
  return {
    confirmedAt: record.confirmedAt,
    confirmedBy: record.confirmedBy,
    quote: record.quote,
    note: record.note,
    officialUrl: record.officialUrl,
  };
}

/**
 * 把 verified.json 记录应用到 wool 条目：
 * - 仅有效记录可升级为“官方已核验”；
 * - 失效记录保留原状态，并附带 verificationIssue 供线索卡展示原因；
 * - 上游自带“官方已核验”但缺少有效记录时，降级为“未核验”。
 */
export function applyManualVerification(
  items: WoolItem[],
  records: VerifiedRecord[],
  now: Date | string | number
): WoolItem[] {
  const recordsByItem = new Map<string, VerifiedRecord[]>();
  for (const record of records) {
    if (!isVerifiedRecordShape(record)) continue;
    const list = recordsByItem.get(record.itemId) ?? [];
    list.push(record);
    recordsByItem.set(record.itemId, list);
  }

  return items.map((item) => {
    // 没有有效记录时，上游自带“官方已核验”也必须降级。
    const base: WoolItem = {
      ...item,
      verificationStatus:
        item.verificationStatus === '官方已核验'
          ? '未核验'
          : item.verificationStatus,
      verification: null,
      verificationIssue: null,
    };

    const candidates = recordsByItem.get(item.id) ?? [];
    if (candidates.length === 0) return base;

    const evaluated = candidates
      .map((record) => ({
        record,
        reason: getVerificationInvalidReason(record, item, now),
      }))
      .sort((a, b) => recordTime(b.record) - recordTime(a.record));

    const valid = evaluated.find((entry) => entry.reason === null);
    if (valid) {
      return {
        ...base,
        verificationStatus: '官方已核验',
        verification: toManualVerification(valid.record),
        verificationIssue: null,
        verificationNote:
          valid.record.note || `人工确认：${valid.record.confirmedBy}`,
      };
    }

    const latest = evaluated[0];
    return {
      ...base,
      verificationIssue: {
        reason: latest.reason ?? '记录格式无效',
        confirmedAt: latest.record.confirmedAt || null,
        confirmedBy: latest.record.confirmedBy || null,
      },
    };
  });
}
