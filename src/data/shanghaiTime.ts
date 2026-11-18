/**
 * 统一的 Asia/Shanghai 时间格式化与日期计算。
 *
 * 约定：
 * - 本模块只接收调用方传入的 ISO 字符串，绝不读取系统当前时间。
 * - 所有面向用户的日期/时间/星期展示都必须经过这里，避免各处自行 toLocaleString。
 * - 日期比较使用上海时区的“日历日”，因此 23:59 → 00:01 的跨日边界会正确变化。
 */

export const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface ShanghaiDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: SHANGHAI_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const weekdayFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: SHANGHAI_TIME_ZONE,
  weekday: 'long',
});

/**
 * 把任意合法 ISO 时间解析为上海时区的年月日时分秒。
 * 非法输入返回 null，避免展示逻辑抛出 RangeError。
 */
export function getShanghaiDateTimeParts(iso: string): ShanghaiDateTimeParts | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const parts: Record<string, string> = {};
  for (const part of dateTimeFormatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
  }

  const result: ShanghaiDateTimeParts = {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };

  return Object.values(result).every(Number.isFinite) ? result : null;
}

/** 上海时区日期：YYYY-MM-DD */
export function formatShanghaiDate(iso: string): string {
  const p = getShanghaiDateTimeParts(iso);
  if (!p) return iso;
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** 上海时区时间：HH:mm（withSeconds 时为 HH:mm:ss） */
export function formatShanghaiClock(iso: string, withSeconds = false): string {
  const p = getShanghaiDateTimeParts(iso);
  if (!p) return iso;
  const base = `${pad2(p.hour)}:${pad2(p.minute)}`;
  return withSeconds ? `${base}:${pad2(p.second)}` : base;
}

/** 上海时区日期时间：YYYY-MM-DD HH:mm */
export function formatShanghaiDateTime(iso: string): string {
  return `${formatShanghaiDate(iso)} ${formatShanghaiClock(iso)}`;
}

/** 上海时区日期时间（含秒）：YYYY-MM-DD HH:mm:ss */
export function formatShanghaiDateTimeWithSeconds(iso: string): string {
  return `${formatShanghaiDate(iso)} ${formatShanghaiClock(iso, true)}`;
}

/** 上海时区星期：星期三 */
export function formatShanghaiWeekday(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return weekdayFormatter.format(date);
}

/** 上海时区月日 + 星期：11月18日 星期三 */
export function formatShanghaiMonthDayWeek(iso: string): string {
  const p = getShanghaiDateTimeParts(iso);
  if (!p) return iso;
  return `${p.month}月${p.day}日 ${formatShanghaiWeekday(iso)}`;
}

/**
 * 两个 ISO 时间在上海时区相差的日历天数（to - from）。
 * 例如 2026-11-30T23:59 与 2026-12-01T00:01 相差 1 天。
 */
export function getShanghaiCalendarDayDiff(fromIso: string, toIso: string): number {
  const from = getShanghaiDateTimeParts(fromIso);
  const to = getShanghaiDateTimeParts(toIso);
  if (!from || !to) return 0;

  const fromDay = Date.UTC(from.year, from.month - 1, from.day);
  const toDay = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toDay - fromDay) / DAY_MS);
}

/**
 * targetIso 是否落在 nowIso 之前的 hours 小时窗口内（含边界）。
 * 用于“最近 24 小时新增”等基于 nowIso 的统计，不读取系统时间。
 */
export function isWithinPastHours(targetIso: string, nowIso: string, hours: number): boolean {
  const target = new Date(targetIso).getTime();
  const now = new Date(nowIso).getTime();
  if (!Number.isFinite(target) || !Number.isFinite(now)) return false;

  const delta = now - target;
  return delta >= 0 && delta <= hours * HOUR_MS;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
