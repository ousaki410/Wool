#!/usr/bin/env npx tsx
/**
 * 抓取 free-llm-intel 公开订阅，转换为 WoolRadar 种子字段，
 * 输出到 public/data/wool.json（今日羊毛）与 public/data/news.json（单独“动态”分区，不进今日羊毛）。
 *
 * 只读上游公开订阅与原始 README，不执行上游任何安装脚本，不调用任何付费接口。
 * 核验状态固定“未核验”；不生成兑换码；不推断截止时间（expiresAt 始终 null）。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

import type { ItemDirection, ItemKind, WoolItem } from '../src/data/woolData';

const CHANGES_RSS_URL = 'https://free-llm-intel.aishort.top/feeds/llm-intel-changes.xml';
const NEWS_RSS_URL = 'https://free-llm-intel.aishort.top/feeds/llm-news-all.xml';
const README_URL = 'https://raw.githubusercontent.com/rockbenben/free-llm-intel/main/README.md';
const WOOL_JSON_PATH = 'public/data/wool.json';
const NEWS_JSON_PATH = 'public/data/news.json';
const SOURCES_JSON_PATH = 'public/data/sources.json';
const SOURCE_NAME = 'free-llm-intel 公开订阅';
const SOURCE_URL = 'https://free-llm-intel.aishort.top/';

/** 最近 72 小时（ms），用于判断 isNew。 */
export const RECENT_HOURS_MS = 72 * 60 * 60 * 1000;

export interface RssItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  category?: string;
  source?: string;
  description: string;
}

export interface SourceInfo {
  id: string;
  name: string;
  type: string;
  url: string;
  entryCount: number;
  fetchedAt: string;
}

export interface OfficialLink {
  text: string;
  url: string;
}

interface ReadmeVendor {
  name: string;
  officialLinks: OfficialLink[];
}

interface FetchStats {
  unknownVendorCount: number;
  noOfficialLinkCount: number;
  kindCount: Record<ItemKind, number>;
  directionCount: Record<ItemDirection, number>;
  /** 各 kind 的占比（0-100），四舍五入取整 */
  kindPct: Record<ItemKind, number>;
  /** 各 direction 的占比（0-100），四舍五入取整 */
  directionPct: Record<ItemDirection, number>;
}

/** 抓取 RSS 文本。 */
export async function fetchRssText(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.text();
}

/** 从 RSS XML 里提取全部 <item>。不依赖任何 XML 解析库。 */
export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const blocks = xml.split('<item>');
  // 第一段是 channel 头部，从第 2 段开始才是 item
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const end = block.indexOf('</item>');
    const itemXml = end === -1 ? block : block.slice(0, end);
    const get = (tag: string): string => {
      const m = itemXml.match(new RegExp(`<${tag}([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '';
    };
    const getAttr = (tag: string, attr: string): string => {
      const m = itemXml.match(
        new RegExp(`<${tag}[^>]*\\s${attr}=["']([^'"]*)["']`, 'i')
      );
      return m ? m[1] : '';
    };
    const title = get('title');
    if (!title) continue;
    items.push({
      title,
      link: get('link'),
      guid: get('guid') || get('link'),
      pubDate: get('pubDate'),
      category: get('category') || undefined,
      source: getAttr('source', 'url') || get('source') || undefined,
      description: get('description'),
    });
  }
  return items;
}

/** djb2 哈希，用于为每条订阅生成稳定且唯一的 id。 */
function stableId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, '0');
}

function vendorSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** 所有变化订阅条目统一归入“AI 与大模型”。 */
function mapCategory(_vendor: string): WoolItem['category'] {
  return 'AI 与大模型';
}

function toIso(rfc2822: string): string {
  const d = new Date(rfc2822);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** 判断 ISO 字符串是否在最近 72 小时内。 */
export function isWithinRecentHours(iso: string, hoursMs: number): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= hoursMs && t <= Date.now();
}

/** deal 强正向词：命中标题时优先归为 deal。 */
const DEAL_STRONG_POSITIVE_KEYWORDS = ['新增', '新推出', '上线', '赠送', '赠金', 'credits', '试用', '限时免费'];

/** deal 弱否定词：更名、微调 —— 仅在没有强正向词时使 deal 降级。 */
const DEAL_WEAK_NEGATIVE_KEYWORDS = ['更名', '微调'];

/** deal 强否定词：未变、仍维持、不变 —— 在没有“新增”时否决 deal。 */
const DEAL_STRONG_NEGATIVE_KEYWORDS = ['未变', '仍维持', '不变'];

/** deal 绝对否决语境：标题中命中任一者，即使有强正向词也不判为 deal。
 * 用于排除“新增付费模型/计划/限制”被误判为免费福利。 */
const DEAL_BREAKER_CONTEXT = [
  '不享受免费额度',
  '不在免费层内',
  '不适用于免费层',
  '无免费层',
  '无免费 API 额度',
  '无免费试用',
  '没有免费试用',
  '需付费订阅',
  '付费订阅',
  'Not supported',
  '下架',
  '不免费',
  '需付费',
];

/** 付费订阅语境词：标题包含这些词表明核心是付费订阅/套餐/计划，不应归为 deal。 */
const SUBSCRIPTION_CONTEXT_KEYWORDS = ['订阅', '套餐', '计划', '会员'];

/** 免费福利词：与价格付费语境共现时，表明该条目包含免费成分。 */
const FREE_BENEFIT_WORDS = ['赠送', '赠金', '试用', '限时免费', '免费'];

/** 降价、更名、计费微调等价格/计费变动关键词。 */
const PRICE_CHANGE_KEYWORDS = [
  '降价',
  '更名',
  '计费微调',
  '计费调整',
  '微调.*计费',
  '计费.*微调',
  '定价',
  '收费',
  '付费',
  '取消.*免费',
  '无免费',
  '不再.*免费',
  '不享受.*免费',
  '改为.*收费',
  '改为.*付费',
];

/** 正向方向词：新增福利或延期。 */
const DIRECTION_POSITIVE_KEYWORDS = [
  '新增', '新推出', '上线', '赠送', '赠金', 'credits', '试用', '限时免费',
  '延期', '顺延', '延长', '恢复', '回归', '再次',
];

/** 负向方向词：取消、下线、免费期结束、不支持免费、门槛提高。 */
const DIRECTION_NEGATIVE_KEYWORDS = [
  '取消', '下架', '下线', '结束', '停止', '终止', '移除', '移出',
  '不支持免费', '无免费', '不再免费', '取消免费', '免费期结束', '免费到期',
  '门槛提高', '涨价', '调高', '不再提供', '停止免费',
];

/** 链接文字正向关键词：命中则加分。 */
const LINK_POSITIVE_KEYWORDS = [
  '定价',
  '免费额度',
  '活动',
  '更新日志',
  '官方文档',
  'pricing',
  'free',
];

/** 链接文字负向关键词：命中则扣分（API Key、控制台、登录等非直达页面）。 */
const LINK_NEGATIVE_KEYWORDS = ['API Key', '控制台', '登录', 'console', 'dashboard', 'api-keys'];

/** 从标题 "额度变化 · 厂商：内容" 中解析厂商名。解析失败返回 null。 */
export function parseVendorFromTitle(title: string): string | null {
  const m = title.match(/^额度变化\s*·\s*([^：\n]+?)(?:：|$)/);
  if (!m) return null;
  const vendor = m[1].trim();
  return vendor || null;
}

/** 从标题中提取 reward：去掉"额度变化 · 厂商："前缀，保留变化内容，截断到 80 字。 */
export function extractReward(title: string): string | null {
  const m = title.match(/^额度变化\s*·\s*[^：\n]+?：(.*)$/);
  if (!m) return null;
  let withoutPrefix = m[1].trim();
  if (!withoutPrefix) return null;
  // 截断到 80 字
  return withoutPrefix.length > 80 ? withoutPrefix.slice(0, 80) : withoutPrefix;
}

/** 把名称规范化为可比较的 Token 集合。 */
function normalizeName(name: string): string[] {
  const lower = name.toLowerCase();
  const noParen = lower.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  const tokens = noParen
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
  return tokens;
}

/** 抓取上游 README 并解析出各厂商的“官方直达”链接映射（保留链接文字）。 */
export async function fetchReadmeVendors(): Promise<Map<string, ReadmeVendor>> {
  const map = new Map<string, ReadmeVendor>();
  let readme = '';
  try {
    readme = await fetchRssText(README_URL);
  } catch {
    return map;
  }

  const sections = readme.split(/\n### \d+\. /);
  for (const section of sections) {
    const headerMatch = section.match(/^([^\n]+?)\n/);
    if (!headerMatch) continue;
    const header = headerMatch[1].trim();
    const rawName = header.replace(/^\d+\.\s*/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!rawName) continue;

    const officialRow = section.match(/\|\s*\*\*官方直达\*\*\s*\|([\s\S]*?)\|\n/);
    const officialLinks: OfficialLink[] = [];
    if (officialRow) {
      const cell = officialRow[1];
      const urlMatches = cell.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g);
      for (const m of urlMatches) {
        officialLinks.push({ text: m[1].trim(), url: m[2] });
      }
    }

    const key = normalizeName(rawName).join(' ');
    map.set(key, {
      name: rawName,
      officialLinks,
    });
  }
  return map;
}

/** 为链接文字打分：正向关键词 +2，负向关键词 -3。 */
export function scoreLinkText(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();
  for (const kw of LINK_POSITIVE_KEYWORDS) {
    if (text.includes(kw) || lower.includes(kw.toLowerCase())) score += 2;
  }
  for (const kw of LINK_NEGATIVE_KEYWORDS) {
    if (text.includes(kw) || lower.includes(kw.toLowerCase())) score -= 3;
  }
  return score;
}

/**
 * 用 RSS 解析出的厂商名去 README 映射中模糊匹配，并选出最佳官方链接。
 *
 * 选取规则：
 * 1. 在匹配到的厂商官方链接中，按链接文字打分，选得分最高的正分链接；
 * 2. 没有正分时，选第一个不含负向关键词的链接（而非直接放弃）；
 * 3. 全是负向关键词才返回 null（hasOfficialLink=false）。
 */
export function selectOfficialLink(
  vendor: string | null,
  vendorMap: Map<string, ReadmeVendor>
): OfficialLink | null {
  if (!vendor) return null;
  const vendorTokens = normalizeName(vendor);
  if (vendorTokens.length === 0) return null;

  let bestVendor: ReadmeVendor | null = null;
  let bestScore = 0;
  for (const rv of vendorMap.values()) {
    const readmeTokens = normalizeName(rv.name);
    if (readmeTokens.length === 0) continue;
    const shorter = vendorTokens.length <= readmeTokens.length ? vendorTokens : readmeTokens;
    const longer = vendorTokens.length <= readmeTokens.length ? readmeTokens : vendorTokens;
    const isSubset = shorter.every((t) => longer.includes(t));
    if (!isSubset) continue;
    const score = shorter.length / Math.max(1, longer.length);
    if (score > bestScore) {
      bestScore = score;
      bestVendor = rv;
    }
  }

  if (!bestVendor || bestVendor.officialLinks.length === 0) return null;

  // 第 1 优先级：得分最高的正分链接
  let bestPositiveLink: OfficialLink | null = null;
  let bestPositiveScore = 0;
  for (const link of bestVendor.officialLinks) {
    const s = scoreLinkText(link.text);
    if (s > bestPositiveScore) {
      bestPositiveScore = s;
      bestPositiveLink = link;
    }
  }
  if (bestPositiveScore > 0 && bestPositiveLink) return bestPositiveLink;

  // 第 2 优先级：第一个不含负向关键词的链接
  const firstNonNegativeLink = bestVendor.officialLinks.find(
    (l) => !LINK_NEGATIVE_KEYWORDS.some((kw) => l.text.includes(kw) || l.text.toLowerCase().includes(kw.toLowerCase()))
  );
  if (firstNonNegativeLink) return firstNonNegativeLink;

  // 第 3 优先级：全是负向关键词，返回 null
  return null;
}

/** 根据标题推断条目分类（打分制，不再一票否决）。
 *
 * 规则：
 * - 强正向词：新增、新推出、上线、赠送、赠金、credits、试用、限时免费
 * - 弱否定词：更名、微调 —— 仅在没有强正向词时使 deal 降级
 * - 强否定词：未变、仍维持、不变 —— 在没有“新增”时否决 deal
 * - 绝对否决语境：标题命中任一 deal-breaker 语境词，即使有强正向词也不判为 deal
 *   （用于排除“新增付费模型/计划/限制”被误判为免费福利）
 * - 付费订阅语境：标题包含订阅/套餐/计划/会员，不判为 deal
 * - 价格付费检测：标题含 $\d+/月 或 $\d+/年 且无免费福利词，也不判为 deal
 *
 * 分类：
 * - deal：有强正向词，且不被强否定词否决（除非有“新增”）；弱否定词仅在无强正向词时降级
 * - price_change：标题含降价/更名/计费微调等计费变动关键词
 - change：其他额度与活动变化
 */
export function classifyKind(rss: RssItem): ItemKind {
  const title = rss.title;
  const text = `${title}\n${rss.description ?? ''}`.toLowerCase();

  // 强正向词
  const strongPositive = DEAL_STRONG_POSITIVE_KEYWORDS.some((kw) => title.includes(kw));
  // 是否有“新增”（强否定词的豁免条件）
  const hasNew增 = title.includes('新增');
  // 强否定词：未变、仍维持、不变 —— 在没有“新增”时否决 deal
  const strongNegative = DEAL_STRONG_NEGATIVE_KEYWORDS.some((kw) => title.includes(kw));
  // 弱否定词：更名、微调 —— 仅在没有强正向词时降级
  const weakNegative = DEAL_WEAK_NEGATIVE_KEYWORDS.some((kw) => title.includes(kw));

  // 1. 绝对否决语境：即使有强正向词，也不判为 deal
  const hasDealBreaker = DEAL_BREAKER_CONTEXT.some((kw) => title.includes(kw));
  if (hasDealBreaker) {
    // 绝对否决后，继续向下判断 price_change / change
  } else {
    // deal 判定：必须有强正向词
    if (strongPositive) {
      // 强否定词否决（除非有“新增”）
      // 特殊：若标题同时含“免费层”和“未变”，表明免费层本身未变，
      // 此时“新增”不能豁免“未变”的否决（无新免费福利）
      const 免费层未变 = title.includes('免费层') && title.includes('未变');
      const strongNegativeVeto = strongNegative && (!hasNew增 || 免费层未变);

      if (!strongNegativeVeto) {
        // 2. 付费订阅语境：标题包含订阅/套餐/计划/会员，不判为 deal
        const hasSubscriptionContext = SUBSCRIPTION_CONTEXT_KEYWORDS.some((kw) => title.includes(kw));
        if (hasSubscriptionContext) {
          // 付费订阅语境，不判为 deal，继续向下判断 price_change / change
        } else {
          // 3. 价格付费检测：标题含 $\d+/月 或 $\d+/年 且无免费福利词，也不判为 deal
          const hasPaidPrice = /\$\d+\/(月|年)/.test(title);
          const hasFreeBenefit = FREE_BENEFIT_WORDS.some((kw) => title.includes(kw));
          if (!(hasPaidPrice && !hasFreeBenefit)) {
            // 弱否定词不否决 deal（有强正向词时保留 deal）
            return 'deal';
          }
        }
      }
    }
  }

  // 非 deal：判断 price_change 或 change
  for (const kw of PRICE_CHANGE_KEYWORDS) {
    if (new RegExp(kw, 'i').test(text)) return 'price_change';
  }

  return 'change';
}

/** 根据标题推断条目方向。
 *
 * 规则：
 * - positive：新增福利或延期（新增、新推出、上线、赠送、赠金、credits、试用、限时免费、延期、顺延、延长、恢复等）
 * - negative：取消、下线、免费期结束、不支持免费、门槛提高（取消、下架、下线、结束、停止、终止、移除、不支持免费、无免费、不再免费、取消免费、免费期结束、门槛提高、涨价等）
 * - neutral：其他
 */
export function classifyDirection(rss: RssItem): ItemDirection {
  const title = rss.title;
  const text = `${title}\n${rss.description ?? ''}`.toLowerCase();

  const hasPositive = DIRECTION_POSITIVE_KEYWORDS.some((kw) => text.includes(kw));
  const hasNegative = DIRECTION_NEGATIVE_KEYWORDS.some((kw) => text.includes(kw));

  if (hasPositive && !hasNegative) return 'positive';
  if (hasNegative && !hasPositive) return 'negative';
  if (hasPositive && hasNegative) {
    // 既有正向又有负向，以负向为准（保守策略：不要把可能减少福利的条目标为正向）
    return 'negative';
  }
  return 'neutral';
}

/** 是否应进入“今日羊毛”：deal / price_change / change 均进入，news 不进入。 */
export function shouldEnterToday(kind: ItemKind): boolean {
  return kind !== 'news';
}

/** 从标题中提取明确截止日期提示（如“顺延至 2026-11-23”），不写入 expiresAt。
 * 取标题中出现的最后一个日期，对应“顺延至 X”的新截止日期。 */
export function extractDeadlineHint(title: string): string | null {
  const matches = title.match(/\d{4}-\d{2}-\d{2}/g);
  return matches ? matches[matches.length - 1] : null;
}

/** 按 id 去重，保留首次出现。id 由 guid 稳定生成，不同变更条目不会冲突。 */
export function deduplicate(items: WoolItem[]): WoolItem[] {
  const seen = new Set<string>();
  const out: WoolItem[] = [];
  for (const it of items) {
    const key = it.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/** 把条目写入指定的 JSON 文件。 */
export function writeWoolJson(path: string, items: WoolItem[], nowMs: number, stats?: FetchStats): void {
  const dir = path.split('/').slice(0, -1).join('/');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const out: Record<string, unknown> = {
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    fetchedAt: new Date(nowMs).toISOString(),
    count: items.length,
    ...(stats ? { stats } : {}),
    items,
  };
  writeFileSync(path, JSON.stringify(out, null, 2) + '\n', 'utf8');
}

/** 把来源聚合信息写入指定的 JSON 文件。 */
export function writeSourceJson(path: string, sources: SourceInfo[], nowMs: number): void {
  const dir = path.split('/').slice(0, -1).join('/');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const out: Record<string, unknown> = {
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    fetchedAt: new Date(nowMs).toISOString(),
    count: sources.length,
    sources,
  };
  writeFileSync(path, JSON.stringify(out, null, 2) + '\n', 'utf8');
}

/** 把单条 RSS 条目转为 WoolItem。缺失字段不编造，核验状态固定“未核验”。 */
export function convertToWoolItem(
  rss: RssItem,
  kind: ItemKind,
  nowMs: number,
  vendor: string | null,
  selectedLink: OfficialLink | null,
  deadlineHint: string | null
): WoolItem {
  const hasOfficialLink = selectedLink !== null;
  const sourceUrl = hasOfficialLink ? selectedLink.url : rss.link || rss.guid || SOURCE_URL;
  const linkText = hasOfficialLink ? selectedLink.text : undefined;
  const publishedAt = toIso(rss.pubDate);
  const vendorName = vendor || '未知厂商';

  const reward = extractReward(rss.title);
  const direction = classifyDirection(rss);
  const isNew = isWithinRecentHours(publishedAt, RECENT_HOURS_MS);

  return {
    id: `fli-${stableId(rss.guid || rss.link || rss.title)}`,
    title: rss.title,
    reward,
    estimatedValue: null,
    estimatedValueRmb: null,
    condition: null,
    category: mapCategory(vendorName),
    claimMethod: null,
    verificationStatus: '未核验',
    verificationNote:
      '来自 free-llm-intel 公开 RSS 订阅，未独立核验，以官方页面为准；未生成兑换码。',
    expiresAt: null,
    deadline: null,
    publishedAt,
    createdAt: publishedAt,
    updatedAt: publishedAt,
    isNew,
    isUpdated: false,
    sourceId: `src-fli-${vendorSlug(vendorName)}`,
    sourceName: vendorName,
    sourceUrl,
    steps: ['打开官方链接阅读原文', '在官方页面确认免费额度或活动规则'],
    riskNotes:
      '来自第三方订阅，标题已汉化，未经官方确认，请以厂商官方页面为准。',
    tags: [vendorName, '官方动态'],
    kind,
    direction,
    hasOfficialLink,
    deadlineHint: deadlineHint || undefined,
    intelSource: rss.link || undefined,
    linkText,
  };
}

/** 主流程：抓取变化订阅（今日羊毛）与新闻订阅（单独动态分区）。 */
export async function main(): Promise<void> {
  const nowMs = Date.now();
  const vendorMap = await fetchReadmeVendors();
  const stats: FetchStats = {
    unknownVendorCount: 0,
    noOfficialLinkCount: 0,
    kindCount: { deal: 0, price_change: 0, change: 0, news: 0 },
    directionCount: { positive: 0, negative: 0, neutral: 0 },
    kindPct: { deal: 0, price_change: 0, change: 0, news: 0 },
    directionPct: { positive: 0, negative: 0, neutral: 0 },
  };

  // 变化订阅 → 今日羊毛（deal / price_change / change）
  const changesXml = await fetchRssText(CHANGES_RSS_URL);
  const changesRss = parseRss(changesXml);
  const changesItems: WoolItem[] = [];
  for (const r of changesRss) {
    const vendor = parseVendorFromTitle(r.title);
    if (!vendor) stats.unknownVendorCount += 1;
    const selectedLink = selectOfficialLink(vendor, vendorMap);
    if (!selectedLink) stats.noOfficialLinkCount += 1;
    const kind = classifyKind(r);
    stats.kindCount[kind] += 1;
    const direction = classifyDirection(r);
    stats.directionCount[direction] += 1;
    const deadlineHint = extractDeadlineHint(r.title);
    changesItems.push(convertToWoolItem(r, kind, nowMs, vendor, selectedLink, deadlineHint));
  }
  const todayItems = deduplicate(changesItems.filter((it) => shouldEnterToday(it.kind ?? 'change')));
  // 统计基于进入文件的最终条目，使 count 与分布一致
  const finalStats: FetchStats = {
    unknownVendorCount: todayItems.filter((i) => i.sourceName === '未知厂商').length,
    noOfficialLinkCount: todayItems.filter((i) => !i.hasOfficialLink).length,
    kindCount: { deal: 0, price_change: 0, change: 0, news: 0 },
    directionCount: { positive: 0, negative: 0, neutral: 0 },
    kindPct: { deal: 0, price_change: 0, change: 0, news: 0 },
    directionPct: { positive: 0, negative: 0, neutral: 0 },
  };
  for (const it of todayItems) {
    finalStats.kindCount[it.kind ?? 'change'] += 1;
    finalStats.directionCount[it.direction ?? 'neutral'] += 1;
  }

  const total = todayItems.length;
  for (const k of ['deal', 'price_change', 'change', 'news'] as const) {
    finalStats.kindPct[k] = total > 0 ? Math.round((finalStats.kindCount[k] / total) * 100) : 0;
  }
  for (const d of ['positive', 'negative', 'neutral'] as const) {
    finalStats.directionPct[d] = total > 0 ? Math.round((finalStats.directionCount[d] / total) * 100) : 0;
  }

  // deal 占比超过 50% 时在日志里警告
  if (finalStats.kindPct.deal > 50) {
    // eslint-disable-next-line no-console
    console.warn(
      `[fetch-source] 警告：deal 占比 ${finalStats.kindPct.deal}% 超过 50%`
    );
  }

  // 今日羊毛 → 写入 public/data/wool.json
  writeWoolJson(WOOL_JSON_PATH, todayItems, nowMs, finalStats);

  // 新闻订阅 → 单独“动态”分区，不进今日羊毛（news）
  // 需在 sources 聚合前先拿到 newsItems 的条目数
  const newsXml = await fetchRssText(NEWS_RSS_URL);
  const newsRss = parseRss(newsXml);
  const newsItems: WoolItem[] = [];
  for (const r of newsRss) {
    stats.kindCount['news'] += 1;
    newsItems.push(convertToWoolItem(r, 'news', nowMs, null, null, null));
  }

  // 聚合每个来源的条目数，写入 sources.json
  // 固定 2 条订阅：额度/活动变化、厂商新闻
  const sources: SourceInfo[] = [
    {
      id: 'src-fli-changes',
      name: '免费额度/活动变化',
      type: '额度/活动变化',
      url: CHANGES_RSS_URL,
      entryCount: todayItems.length,
      fetchedAt: new Date(nowMs).toISOString(),
    },
    {
      id: 'src-fli-news',
      name: '厂商新闻',
      type: '厂商新闻',
      url: NEWS_RSS_URL,
      entryCount: newsItems.length,
      fetchedAt: new Date(nowMs).toISOString(),
    },
  ];
  writeSourceJson(SOURCES_JSON_PATH, sources, nowMs);

  writeWoolJson(NEWS_JSON_PATH, deduplicate(newsItems), nowMs);

  // eslint-disable-next-line no-console
  console.log(
    `[fetch-source] 抓取完成：变化 ${changesRss.length} 条（今日羊毛 ${todayItems.length} 条），新闻 ${newsRss.length} 条（单独动态分区，不进今日羊毛）`
  );
  // eslint-disable-next-line no-console
  console.log(
    `[fetch-source] 统计：未知厂商 ${finalStats.unknownVendorCount} 条，无官方链接 ${finalStats.noOfficialLinkCount} 条，kind=${JSON.stringify(finalStats.kindCount)}，kind占比=${JSON.stringify(finalStats.kindPct)}，direction=${JSON.stringify(finalStats.directionCount)}，direction占比=${JSON.stringify(finalStats.directionPct)}`
  );
  // eslint-disable-next-line no-console
  console.log(`[fetch-source] 已写入 ${WOOL_JSON_PATH}、${NEWS_JSON_PATH} 与 ${SOURCES_JSON_PATH}`);
}

if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('fetch-source.ts')) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[fetch-source] 失败：', e);
    process.exit(1);
  });
}
