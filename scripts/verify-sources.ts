#!/usr/bin/env npx tsx
/**
 * 对 public/data/wool.json 中 hasOfficialLink=true 的线索抓取官方页面并存证。
 *
 * - 每个域名两次请求之间至少间隔 1 秒，并遵守 robots.txt（含 Crawl-delay）。
 * - 请求带超时与重试；4xx/5xx、超时、robots 禁止记为“无法访问”。
 * - 页面命中标题里的具体数字/日期/金额记为“强命中”；仅命中通用词记为“弱相关”；
 *   页面可打开但没有任何命中记为“页面未提及”。
 * - 只输出页面摘录，不修改任何条目的 verificationStatus（不会自动升为“官方已核验”）。
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

import {
  evaluateEvidence,
  htmlToText,
  type EvidenceJson,
  type EvidenceMatch,
  type EvidenceRecord,
  type EvidenceStatus,
  type PageEvidenceInput,
} from '../src/data/evidence';
import type { WoolItem } from '../src/data/woolData';

const WOOL_JSON_PATH = 'public/data/wool.json';
const EVIDENCE_JSON_PATH = 'public/data/evidence.json';

const USER_AGENT =
  'WoolRadarEvidenceBot/1.0 (+https://github.com/ousaki410/Wool)';
const REQUEST_TIMEOUT_MS = 10_000;
const ROBOTS_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 2;
const DOMAIN_INTERVAL_MS = 1_000;
const MAX_CONCURRENCY = 4;
const MAX_PAGE_CHARS = 2_000_000;

interface RobotsGroup {
  agents: string[];
  rules: Array<{ type: 'allow' | 'disallow'; path: string }>;
  crawlDelayMs: number | null;
}

export interface RobotsPolicy {
  allowed: boolean;
  crawlDelayMs: number | null;
}

interface TextFetchResult {
  ok: boolean;
  status: number | null;
  finalUrl: string | null;
  text: string | null;
  contentType: string | null;
  error: string | null;
}

interface RobotsFetchResult {
  status: number | null;
  text: string | null;
  error: string | null;
}

interface RobotsDecision extends RobotsPolicy {
  error: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 同一域名的请求串行排队，并保证相邻两次请求至少间隔 intervalMs。
 * robots.txt、页面请求与重试都走同一个限速器。
 */
export class DomainRateLimiter {
  private lastAt = new Map<string, number>();
  private chain = new Map<string, Promise<void>>();

  constructor(private readonly defaultIntervalMs = DOMAIN_INTERVAL_MS) {}

  async wait(host: string, intervalMs = this.defaultIntervalMs): Promise<void> {
    const previous = this.chain.get(host) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.chain.set(
      host,
      previous.then(() => gate)
    );

    await previous;
    const last = this.lastAt.get(host) ?? 0;
    const delay = last + intervalMs - Date.now();
    if (delay > 0) await sleep(delay);
    this.lastAt.set(host, Date.now());
    release();
  }
}

/** 把 robots.txt 中的通配符路径转换为匹配函数。 */
function matchesRobotsPath(path: string, pattern: string): boolean {
  if (!pattern) return false;

  let source = '';
  for (const char of pattern) {
    if (char === '*') {
      source += '.*';
    } else if (char === '$') {
      source += '$';
    } else if (/[.+?^${}()|[\]\\]/.test(char)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
  }

  try {
    return new RegExp(`^${source}`).test(path);
  } catch {
    return false;
  }
}

/** 解析 robots.txt，返回当前 User-Agent 对指定路径是否允许抓取。 */
export function parseRobotsTxt(
  robotsTxt: string,
  userAgent: string,
  path: string
): RobotsPolicy {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasUserAgent = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === 'user-agent') {
      if (!current || !lastWasUserAgent) {
        current = { agents: [], rules: [], crawlDelayMs: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasUserAgent = true;
    } else if (key === 'allow' || key === 'disallow') {
      if (!current) {
        current = { agents: ['*'], rules: [], crawlDelayMs: null };
        groups.push(current);
      }
      current.rules.push({ type: key, path: value });
      lastWasUserAgent = false;
    } else if (key === 'crawl-delay') {
      if (current) {
        const seconds = Number(value);
        if (Number.isFinite(seconds) && seconds >= 0) {
          current.crawlDelayMs = Math.round(seconds * 1000);
        }
      }
      lastWasUserAgent = false;
    } else {
      lastWasUserAgent = false;
    }
  }

  const uaToken = userAgent.split('/')[0].trim().toLowerCase();
  const specific = groups.filter((group) =>
    group.agents.some(
      (agent) =>
        agent !== '*' &&
        (uaToken.includes(agent) || agent.includes(uaToken))
    )
  );
  const selected = specific.length
    ? specific
    : groups.filter((group) => group.agents.includes('*'));

  if (selected.length === 0) {
    return { allowed: true, crawlDelayMs: null };
  }

  const crawlDelays = selected
    .map((group) => group.crawlDelayMs)
    .filter((value): value is number => value !== null);
  const crawlDelayMs = crawlDelays.length ? Math.max(...crawlDelays) : null;

  const rules = selected
    .flatMap((group) => group.rules)
    .filter((rule) => rule.path !== '');
  if (rules.length === 0) {
    return { allowed: true, crawlDelayMs };
  }

  const target = path || '/';
  let bestLength = -1;
  let bestAllow = true;

  for (const rule of rules) {
    if (!matchesRobotsPath(target, rule.path)) continue;
    const length = rule.path.replace(/[*$]/g, '').length;
    if (length > bestLength || (length === bestLength && rule.type === 'allow')) {
      bestLength = length;
      bestAllow = rule.type === 'allow';
    }
  }

  return {
    allowed: bestLength < 0 ? true : bestAllow,
    crawlDelayMs,
  };
}

/** 带超时、重试与域名限速的文本抓取。 */
async function fetchText(
  url: string,
  limiter: DomainRateLimiter,
  intervalMs: number,
  options: {
    timeoutMs?: number;
    maxAttempts?: number;
    maxChars?: number;
  } = {}
): Promise<TextFetchResult> {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const maxAttempts = Math.max(1, options.maxAttempts ?? MAX_ATTEMPTS);
  const maxChars = options.maxChars ?? MAX_PAGE_CHARS;
  const host = new URL(url).hostname;

  let lastStatus: number | null = null;
  let lastFinalUrl: string | null = null;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await limiter.wait(host, intervalMs);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
        },
      });

      lastStatus = response.status;
      lastFinalUrl = response.url || url;

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        const retryable =
          response.status === 408 ||
          response.status === 425 ||
          response.status === 429 ||
          response.status >= 500;
        if (retryable && attempt < maxAttempts) {
          await response.body?.cancel().catch(() => {});
          await sleep(1_000 * attempt);
          continue;
        }
        return {
          ok: false,
          status: response.status,
          finalUrl: lastFinalUrl,
          text: null,
          contentType: response.headers.get('content-type'),
          error: lastError,
        };
      }

      const raw = await response.text();
      return {
        ok: true,
        status: response.status,
        finalUrl: lastFinalUrl,
        text: raw.slice(0, maxChars),
        contentType: response.headers.get('content-type'),
        error: null,
      };
    } catch (error) {
      lastStatus = null;
      lastFinalUrl = null;
      lastError =
        error instanceof Error && error.name === 'AbortError'
          ? `请求超时（${timeoutMs}ms）`
          : error instanceof Error
            ? error.message
            : String(error);

      if (attempt < maxAttempts) {
        await sleep(1_000 * attempt);
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    status: lastStatus,
    finalUrl: lastFinalUrl,
    text: null,
    contentType: null,
    error: lastError ?? '请求失败',
  };
}

/** 抓取并缓存每个 origin 的 robots.txt；路径规则按目标 URL 实时判断。 */
async function getRobotsDecision(
  target: URL,
  limiter: DomainRateLimiter,
  cache: Map<string, Promise<RobotsFetchResult>>
): Promise<RobotsDecision> {
  let pending = cache.get(target.origin);
  if (!pending) {
    pending = fetchText(
      `${target.origin}/robots.txt`,
      limiter,
      DOMAIN_INTERVAL_MS,
      {
        timeoutMs: ROBOTS_TIMEOUT_MS,
        maxAttempts: 2,
        maxChars: 200_000,
      }
    ).then((result) => ({
      status: result.status,
      text: result.text,
      error: result.error,
    }));
    cache.set(target.origin, pending);
  }

  const robots = await pending;
  if (robots.status === 404 || robots.status === 410) {
    return { allowed: true, crawlDelayMs: null, error: null };
  }
  if (robots.status === 401 || robots.status === 403) {
    return {
      allowed: false,
      crawlDelayMs: null,
      error: `robots.txt 返回 HTTP ${robots.status}`,
    };
  }
  if (robots.status === null || robots.status >= 500) {
    return {
      allowed: false,
      crawlDelayMs: null,
      error: `robots.txt 无法访问${robots.error ? `：${robots.error}` : ''}`,
    };
  }
  if (robots.status >= 400) {
    // 其他 4xx 视为 robots.txt 不存在，允许抓取。
    return { allowed: true, crawlDelayMs: null, error: null };
  }

  const parsed = parseRobotsTxt(
    robots.text ?? '',
    USER_AGENT,
    `${target.pathname}${target.search}`
  );
  return {
    allowed: parsed.allowed,
    crawlDelayMs: parsed.crawlDelayMs,
    error: parsed.allowed ? null : 'robots.txt 禁止抓取该路径',
  };
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function failureRecord(item: WoolItem, error: unknown): EvidenceRecord {
  const evaluated = evaluateEvidence(item.title, null);
  return {
    itemId: item.id,
    title: item.title,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    fetchedAt: new Date().toISOString(),
    httpStatus: null,
    finalUrl: null,
    textHash: null,
    status: evaluated.status,
    matches: evaluated.matches,
    error: error instanceof Error ? error.message : String(error),
  };
}

/** 抓取一条线索的官方页面并生成证据记录。 */
export async function verifyItem(
  item: WoolItem,
  limiter: DomainRateLimiter,
  robotsCache: Map<string, Promise<RobotsFetchResult>>
): Promise<EvidenceRecord> {
  let httpStatus: number | null = null;
  let finalUrl: string | null = null;
  let textHash: string | null = null;
  let error: string | null = null;
  let page: PageEvidenceInput | null = null;

  try {
    const target = new URL(item.sourceUrl);
    const robots = await getRobotsDecision(target, limiter, robotsCache);

    if (!robots.allowed) {
      const evaluated = evaluateEvidence(item.title, null);
      return {
        itemId: item.id,
        title: item.title,
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        fetchedAt: new Date().toISOString(),
        httpStatus: null,
        finalUrl: null,
        textHash: null,
        status: evaluated.status,
        matches: evaluated.matches,
        error: robots.error ?? 'robots.txt 禁止抓取',
      };
    }

    const intervalMs = Math.max(
      DOMAIN_INTERVAL_MS,
      robots.crawlDelayMs ?? 0
    );
    const result = await fetchText(
      target.toString(),
      limiter,
      intervalMs
    );

    httpStatus = result.status;
    finalUrl = result.finalUrl;
    error = result.error;

    if (result.ok && result.text !== null) {
      const contentType = (result.contentType ?? '').toLowerCase();
      const textual =
        contentType === '' ||
        contentType.includes('text/') ||
        contentType.includes('xhtml') ||
        contentType.includes('xml') ||
        contentType.includes('json');

      if (textual) {
        const text = htmlToText(result.text);
        textHash = sha256(text);
        page = {
          httpStatus: result.status ?? 200,
          finalUrl: result.finalUrl ?? target.toString(),
          text,
          textHash,
        };
      } else {
        error = `非文本页面（${result.contentType}）`;
      }
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  const evaluated = evaluateEvidence(item.title, page);
  const record: EvidenceRecord = {
    itemId: item.id,
    title: item.title,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    fetchedAt: new Date().toISOString(),
    httpStatus,
    finalUrl,
    textHash,
    status: evaluated.status,
    matches: evaluated.matches,
  };
  if (error) record.error = error;
  return record;
}

function countStatuses(records: EvidenceRecord[]): Record<EvidenceStatus, number> {
  const counts: Record<EvidenceStatus, number> = {
    强命中: 0,
    弱相关: 0,
    页面未提及: 0,
    无法访问: 0,
  };
  for (const record of records) {
    counts[record.status] += 1;
  }
  return counts;
}

/** 主流程：读取 wool.json，抓取官方页面，写出 evidence.json。 */
export async function main(): Promise<void> {
  const wool = JSON.parse(readFileSync(WOOL_JSON_PATH, 'utf8')) as {
    items?: WoolItem[];
  };
  const items = Array.isArray(wool.items) ? wool.items : [];
  const eligible = items.filter(
    (item) =>
      item.hasOfficialLink &&
      typeof item.sourceUrl === 'string' &&
      /^https?:\/\//i.test(item.sourceUrl)
  );

  // eslint-disable-next-line no-console
  console.log(
    `[verify-sources] 目标 ${eligible.length} 条 hasOfficialLink=true 线索（共 ${items.length} 条）`
  );

  const limiter = new DomainRateLimiter(DOMAIN_INTERVAL_MS);
  const robotsCache = new Map<string, Promise<RobotsFetchResult>>();
  const records: EvidenceRecord[] = new Array(eligible.length);
  let cursor = 0;
  let completed = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= eligible.length) return;

      const item = eligible[index];
      try {
        records[index] = await verifyItem(item, limiter, robotsCache);
      } catch (error) {
        records[index] = failureRecord(item, error);
      }

      completed += 1;
      // eslint-disable-next-line no-console
      console.log(
        `[verify-sources] ${completed}/${eligible.length} ${records[index].status} · ${item.sourceName} · ${item.sourceUrl}`
      );
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENCY, Math.max(eligible.length, 1)) },
      () => worker()
    )
  );

  const statusCounts = countStatuses(records);
  const output: EvidenceJson = {
    generatedAt: new Date().toISOString(),
    count: records.length,
    statusCounts,
    records,
  };

  const dir = EVIDENCE_JSON_PATH.split('/').slice(0, -1).join('/');
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(EVIDENCE_JSON_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log(
    `[verify-sources] 完成：强命中 ${statusCounts['强命中']}，弱相关 ${statusCounts['弱相关']}，页面未提及 ${statusCounts['页面未提及']}，无法访问 ${statusCounts['无法访问']}`
  );
  // eslint-disable-next-line no-console
  console.log(`[verify-sources] 已写入 ${EVIDENCE_JSON_PATH}`);
}

if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].endsWith('verify-sources.ts')
) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[verify-sources] 失败：', error);
    process.exit(1);
  });
}
