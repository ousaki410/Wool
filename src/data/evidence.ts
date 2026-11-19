/** 官方页面存证：只记录页面是否命中原标题里的关键事实，不改变条目的核验状态。 */
export type EvidenceStatus = '有证据' | '证据不足' | '无法访问';

export const EVIDENCE_STATUSES: EvidenceStatus[] = [
  '有证据',
  '证据不足',
  '无法访问',
];

export interface EvidenceMatch {
  /** 命中的关键事实类别，例如“免费额度”“赠送”“截止日期”。 */
  keyword: string;
  /** 命中位置前后各 80 字的原文片段。 */
  snippet: string;
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
}

interface KeywordGroup {
  label: string;
  synonyms: string[];
}

/** 标题中的关键事实词表。英文同义词用于官方英文页面。 */
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

function extractFactTerms(title: string): FactTerm[] {
  const cleaned = stripTitlePrefix(title);
  const lower = cleaned.toLowerCase();
  const terms: FactTerm[] = [];

  for (const group of KEYWORD_GROUPS) {
    if (group.synonyms.some((synonym) => lower.includes(synonym.toLowerCase()))) {
      terms.push({ label: group.label, terms: group.synonyms });
    }
  }

  // 标题里的明确日期与带单位数字也作为关键事实（如 2026-11-23、$5、200 次、30 天、六折）。
  const numericFacts = cleaned.match(
    /\d{4}-\d{2}-\d{2}|\$?\d+(?:\.\d+)?\s*(?:美元|次|天|个月|%|折)/g
  );
  if (numericFacts) {
    for (const fact of numericFacts) {
      const normalized = fact.replace(/\s+/g, ' ').trim();
      if (normalized && !terms.some((term) => term.label === normalized)) {
        terms.push({ label: normalized, terms: [normalized] });
      }
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

/** 在页面文本里查找标题关键事实，返回最多 3 条前后各 80 字的原文片段。 */
export function findEvidenceMatches(
  title: string,
  pageText: string,
  maxMatches = MAX_MATCHES
): EvidenceMatch[] {
  const terms = extractFactTerms(title);
  if (terms.length === 0 || !pageText) return [];

  const haystack = pageText.toLowerCase();
  const hits: Array<{ index: number; keyword: string; snippet: string }> = [];

  for (const term of terms) {
    if (hits.length >= maxMatches) break;

    const candidates = [...term.terms].sort((a, b) => b.length - a.length);
    for (const candidate of candidates) {
      const index = haystack.indexOf(candidate.toLowerCase());
      if (index < 0) continue;

      const start = Math.max(0, index - CONTEXT_RADIUS);
      const end = Math.min(
        pageText.length,
        index + candidate.length + CONTEXT_RADIUS
      );
      let snippet = pageText.slice(start, end).replace(/\s+/g, ' ').trim();
      if (start > 0) snippet = `…${snippet}`;
      if (end < pageText.length) snippet = `${snippet}…`;

      hits.push({ index, keyword: term.label, snippet });
      break;
    }
  }

  return hits
    .sort((a, b) => a.index - b.index)
    .slice(0, maxMatches)
    .map(({ keyword, snippet }) => ({ keyword, snippet }));
}

/**
 * 根据抓取结果判断证据状态：
 * - 无响应、超时、4xx/5xx、robots 禁止 → 无法访问
 * - 2xx 但未命中关键事实 → 证据不足
 * - 2xx 且命中至少一条关键事实 → 有证据
 * 没有命中片段时绝不会返回“有证据”。
 */
export function evaluateEvidence(
  title: string,
  page: PageEvidenceInput | null
): { status: EvidenceStatus; matches: EvidenceMatch[] } {
  if (!page || page.httpStatus < 200 || page.httpStatus >= 300) {
    return { status: '无法访问', matches: [] };
  }

  const matches = findEvidenceMatches(title, page.text);
  return {
    status: matches.length > 0 ? '有证据' : '证据不足',
    matches,
  };
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
  return record.matches.every(
    (match) =>
      Boolean(match) &&
      typeof match === 'object' &&
      typeof (match as EvidenceMatch).keyword === 'string' &&
      typeof (match as EvidenceMatch).snippet === 'string'
  );
}
