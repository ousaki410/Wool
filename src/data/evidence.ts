/** 官方页面摘录：只记录页面是否提到标题里的具体事实，不改变条目的核验状态。 */
export type EvidenceStatus = '强命中' | '弱相关' | '页面未提及' | '无法访问';

export const EVIDENCE_STATUSES: EvidenceStatus[] = [
  '强命中',
  '弱相关',
  '页面未提及',
  '无法访问',
];

export type EvidenceStrength = 'strong' | 'weak';

export interface EvidenceMatch {
  /** 命中的关键事实类别，例如“免费额度”“$5”“2026-11-23”。 */
  keyword: string;
  /** 命中位置前后各 80 字的原文片段。 */
  snippet: string;
  /** strong 表示具体数字/日期/金额；weak 表示通用词或非数字短语。 */
  strength: EvidenceStrength;
}

export interface EvidenceRecord {
  itemId: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  /** 本次尝试抓取的时间（ISO）。 */
  fetchedAt: string;
  /** HTTP 状态码；超时或网络错误时为 null。 */
  httpStatus: number | null;
  /** 跟随重定向后的最终 URL；未拿到响应时为 null。 */
  finalUrl: string | null;
  /** 页面正文文本的 SHA-256；未取得正文时为 null。 */
  textHash: string | null;
  status: EvidenceStatus;
  matches: EvidenceMatch[];
  /** 失败原因（超时、robots.txt 禁止、HTTP 错误等）。 */
  error?: string;
}

export interface EvidenceJson {
  generatedAt: string;
  count: number;
  statusCounts: Record<EvidenceStatus, number>;
  records: EvidenceRecord[];
}

/** 页面正文与抓取结果，供纯函数判断证据状态。 */
export interface PageEvidenceInput {
  httpStatus: number;
  finalUrl: string;
  text: string;
  textHash: string | null;
}

interface FactTerm {
  label: string;
  terms: string[];
  strength: EvidenceStrength;
}

interface KeywordGroup {
  label: string;
  synonyms: string[];
}

/** 标题中的关键事实词表。英文短词匹配时使用单词边界。 */
const KEYWORD_GROUPS: KeywordGroup[] = [
  {
    label: '免费额度',
    synonyms: ['免费额度', '免费层', '免费', 'free tier', 'free quota', 'free credits', 'free'],
  },
  {
    label: '赠送',
    synonyms: ['赠送', '赠金', '免费送', 'bonus', 'free credit'],
  },
  { label: '试用', synonyms: ['试用', 'trial'] },
  {
    label: '优惠',
    synonyms: ['优惠', '折扣', '减免', '代金券', 'discount', 'coupon', 'promo'],
  },
  {
    label: '截止日期',
    synonyms: ['截止日期', '截止', '有效期', '到期', '限时', 'deadline', 'expires', 'valid until'],
  },
  {
    label: '领取条件',
    synonyms: ['领取', '注册', '认证', '实名', 'sign up', 'register', 'verify'],
  },
  { label: '首充', synonyms: ['首充', '充值', 'deposit'] },
  { label: '每月额度', synonyms: ['每月', 'monthly', 'per month'] },
  { label: '限速/限额', synonyms: ['限速', '限额', 'rate limit', 'quota', 'limit'] },
  {
    label: '下线/失效',
    synonyms: ['下线', '失效', 'legacy', 'deprecated', 'retired'],
  },
  { label: '用尽即停', synonyms: ['用尽即停'] },
  { label: '定价/计费', synonyms: ['定价', '计费', '价格', 'pricing', 'price'] },
  { label: '活动', synonyms: ['活动', 'event', 'promotion'] },
  { label: 'token', synonyms: ['token', 'tokens'] },
  { label: '美元', synonyms: ['美元', 'usd'] },
];

/** 标题中的具体数字/日期/金额；只有这些命中才可能得到“强命中”。 */
const STRONG_FACT_PATTERNS: RegExp[] = [
  /\d{4}-\d{2}-\d{2}/g,
  /\d{4}\.\d{1,2}\.\d{1,2}/g,
  /\d{4}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?/g,
  /\d{1,2}\s*月\s*\d{1,2}\s*日/g,
  /\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g,
  /[$¥€£]\s?\d[\d,]*(?:\.\d+)?\s*[KMB]?/gi,
  /\d[\d,]*(?:\.\d+)?\s*(?:美元|元|万|亿)/g,
  /\d[\d,]*(?:\.\d+)?\s*(?:次|天|个月|小时|分钟|%|折|tokens?|requests?|pages?)/gi,
  /[一二三四五六七八九十百千万亿]+\s*折/g,
];

const TITLE_PREFIX_PATTERN =
  /^(额度变化|价格变化|厂商新闻|其他变化|厂商动态)\s*[·:：]\s*/;

const CONTEXT_RADIUS = 80;
const MAX_MATCHES = 3;

/** 去掉标题前缀“额度变化 · ”等分类标记。 */
export function stripTitlePrefix(title: string): string {
  return title.replace(TITLE_PREFIX_PATTERN, '').trim();
}

/** 从标题提取关键事实类别；没有命中词表时返回空数组。 */
export function extractKeywords(title: string): string[] {
  return extractFactTerms(title).map((term) => term.label);
}

/** 英文词按单词边界判断，避免 freedom 被当成 free、unlimited 被当成 limit。 */
function containsKeyword(haystack: string, term: string): boolean {
  if (!/[A-Za-z]/.test(term)) {
    return haystack.includes(term);
  }
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'i').test(
    haystack
  );
}

function extractFactTerms(title: string): FactTerm[] {
  const cleaned = stripTitlePrefix(title);
  const lower = cleaned.toLowerCase();
  const terms: FactTerm[] = [];
  const seen = new Set<string>();

  for (const group of KEYWORD_GROUPS) {
    if (group.synonyms.some((synonym) => containsKeyword(lower, synonym.toLowerCase()))) {
      terms.push({
        label: group.label,
        terms: group.synonyms,
        strength: 'weak',
      });
      seen.add(group.label);
    }
  }

  const claimedRanges: Array<{ start: number; end: number }> = [];

  for (const pattern of STRONG_FACT_PATTERNS) {
    for (const match of cleaned.matchAll(pattern)) {
      const fact = match[0].replace(/\s+/g, ' ').trim();
      if (!fact || seen.has(fact)) continue;

      const start = match.index ?? 0;
      const end = start + match[0].length;
      // 跳过与更完整日期/金额重叠的片段，例如“2026 年 11 月 1 日”里的“11 月 1 日”。
      if (claimedRanges.some((range) => start < range.end && end > range.start)) {
        continue;
      }

      seen.add(fact);
      claimedRanges.push({ start, end });
      terms.push({ label: fact, terms: [fact], strength: 'strong' });
    }
  }

  return terms;
}

/** 把 HTML 粗略转换为正文文本，不执行任何脚本。 */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (entity, code: string) => decodeEntity(code))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntity(code: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    middot: '·',
    mdash: '—',
    ndash: '–',
  };
  const lower = code.toLowerCase();
  if (lower.startsWith('#x')) {
    const value = Number.parseInt(lower.slice(2), 16);
    return Number.isFinite(value) ? String.fromCodePoint(value) : '';
  }
  if (lower.startsWith('#')) {
    const value = Number.parseInt(lower.slice(1), 10);
    return Number.isFinite(value) ? String.fromCodePoint(value) : '';
  }
  return named[lower] ?? '';
}

/**
 * 构造匹配正则：
 * - 英文短词使用单词边界，freedom 不会命中 free；
 * - 数字事实使用前后邻接限制，$5 不会命中 $50；
 * - 空白允许灵活匹配。
 */
function buildMatchRegex(term: string, strength: EvidenceStrength): RegExp {
  let source = '';

  for (let i = 0; i < term.length; i += 1) {
    const char = term[i];
    if (/\s/.test(char)) {
      source += '\\s*';
      while (i + 1 < term.length && /\s/.test(term[i + 1])) i += 1;
    } else if (/[.*+?^${}()|[\]\\]/.test(char)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
  }

  const first = term[0];
  const last = term[term.length - 1];

  if (strength === 'strong' && /\d/.test(first)) {
    source = `(?<![\\d,])${source}`;
  } else if (/[A-Za-z0-9]/.test(first)) {
    source = `\\b${source}`;
  }

  if (/[A-Za-z]/.test(last)) {
    source += '\\b';
  } else if (/\d/.test(last)) {
    // 允许数字后跟句号/逗号，但不能是更长数字（$5 不命中 $50、$5.50、$5,000）。
    source += '(?!\\d|,\\d|\\.\\d)';
  }

  return new RegExp(source, 'i');
}

/** 在页面文本里查找标题关键事实，返回最多 3 条前后各 80 字的原文片段。 */
export function findEvidenceMatches(
  title: string,
  pageText: string,
  maxMatches = MAX_MATCHES
): EvidenceMatch[] {
  const terms = extractFactTerms(title);
  if (terms.length === 0 || !pageText) return [];

  const hits: Array<{
    index: number;
    keyword: string;
    snippet: string;
    strength: EvidenceStrength;
  }> = [];

  for (const term of terms) {
    const candidates = [...term.terms].sort((a, b) => b.length - a.length);
    for (const candidate of candidates) {
      const match = buildMatchRegex(candidate, term.strength).exec(pageText);
      if (!match) continue;

      const start = Math.max(0, match.index - CONTEXT_RADIUS);
      const end = Math.min(
        pageText.length,
        match.index + match[0].length + CONTEXT_RADIUS
      );
      let snippet = pageText.slice(start, end).replace(/\s+/g, ' ').trim();
      if (start > 0) snippet = `…${snippet}`;
      if (end < pageText.length) snippet = `${snippet}…`;

      hits.push({
        index: match.index,
        keyword: term.label,
        snippet,
        strength: term.strength,
      });
      break;
    }
  }

  // 强事实优先，确保数字/日期/金额命中不会被通用词挤出前 3 条。
  return hits
    .sort((a, b) => {
      if (a.strength !== b.strength) return a.strength === 'strong' ? -1 : 1;
      return a.index - b.index;
    })
    .slice(0, maxMatches)
    .map(({ keyword, snippet, strength }) => ({ keyword, snippet, strength }));
}

/**
 * 根据抓取结果判断状态：
 * - 无响应、超时、4xx/5xx、robots 禁止 → 无法访问
 * - 2xx 且命中具体数字/日期/金额 → 强命中
 * - 2xx 仅命中通用词或非数字短语 → 弱相关
 * - 2xx 但没有任何关键词命中 → 页面未提及
 * 没有命中片段时绝不会返回“强命中”。
 */
export function evaluateEvidence(
  title: string,
  page: PageEvidenceInput | null
): { status: EvidenceStatus; matches: EvidenceMatch[] } {
  if (!page || page.httpStatus < 200 || page.httpStatus >= 300) {
    return { status: '无法访问', matches: [] };
  }

  const matches = findEvidenceMatches(title, page.text);
  if (matches.some((match) => match.strength === 'strong')) {
    return { status: '强命中', matches };
  }
  if (matches.length > 0) {
    return { status: '弱相关', matches };
  }
  return { status: '页面未提及', matches: [] };
}

/** 校验 evidence.json 中的单条记录，防止异常数据进入页面。 */
export function isEvidenceRecord(value: unknown): value is EvidenceRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (typeof record.itemId !== 'string' || typeof record.title !== 'string') {
    return false;
  }
  if (typeof record.fetchedAt !== 'string') return false;
  if (!EVIDENCE_STATUSES.includes(record.status as EvidenceStatus)) return false;
  if (record.finalUrl !== null && typeof record.finalUrl !== 'string') return false;
  if (record.textHash !== null && typeof record.textHash !== 'string') return false;
  if (record.httpStatus !== null && typeof record.httpStatus !== 'number') return false;
  if (!Array.isArray(record.matches)) return false;
  return record.matches.every((match) => {
    if (!match || typeof match !== 'object') return false;
    const item = match as EvidenceMatch;
    return (
      typeof item.keyword === 'string' &&
      typeof item.snippet === 'string' &&
      (item.strength === 'strong' || item.strength === 'weak')
    );
  });
}
