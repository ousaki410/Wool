#!/usr/bin/env npx tsx
/**
 * 抓取 free-llm-intel 公开订阅，转换为 WoolRadar 种子字段，
 * 输出到 public/data/wool.json（今日羊毛）与 public/data/news.json（单独“动态”分区，不进今日羊毛）。
 *
 * 只读上游公开订阅与原始 README，不执行上游任何安装脚本，不调用任何付费接口。
 * 核验状态固定“未核验”；不生成兑换码；不推断截止时间（expiresAt 始终 null）。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

import type { ItemKind, WoolItem } from '../src/data/woolData';

const CHANGES_RSS_URL = 'https://free-llm-intel.aishort.top/feeds/llm-intel-changes.xml';
const NEWS_RSS_URL = 'https://free-llm-intel.aishort.top/feeds/llm-news-all.xml';
const README_URL = 'https://raw.githubusercontent.com/rockbenben/free-llm-intel/main/README.md';
const WOOL_JSON_PATH = 'public/data/wool.json';
const NEWS_JSON_PATH = 'public/data/news.json';
const SOURCE_NAME = 'free-llm-intel 公开订阅';
const SOURCE_URL = 'https://free-llm-intel.aishort.top/';

export interface RssItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  category?: string;
  source?: string;
  description: string;
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
  /** 各 kind 的占比（0-100），四舍五入取整 */
  kindPct: Record<ItemKind, number>;
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
        new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*)["']`, 'i')
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

function mapCategory(_vendor: string): WoolItem['category'] {
  // 变化订阅不再细分厂商类别，统一归入“开发工具与 SaaS”，避免误判。
  return '开发工具与 SaaS';
}

function toIso(rfc2822: string): string {
  const d = new Date(rfc2822);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** 可领取的福利或额度关键词（仅命中标题时才归为 deal）。 */
const DEAL_POSITIVE_KEYWORDS = ['新增', '新推出', '上线', '赠送', '限时免费', '试用'];

/** deal 否定关键词：标题中含任一者，不得归为 deal。 */
const DEAL_NEGATIVE_KEYWORDS = ['未变', '仍维持', '微调', '不变', '更名'];

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

/** 官方主页关键词：作为降级兜底。 */
const HOMEPAGE_KEYWORDS = ['官方主页', '官方网站', '官网'];

/** 从标题 "额度变化 · 厂商：内容" 中解析厂商名。解析失败返回 null。 */
export function parseVendorFromTitle(title: string): string | null {
  const m = title.match(/^额度变化\s*·\s*([^：\n]+?)(?:：|$)/);
  if (!m) return null;
  const vendor = m[1].trim();
  return vendor || null;
}

/** 把名称规范化为可比较的 Token 集合。 */
function normalizeName(name: string): string[] {
  const lower = name.toLowerCase();
  // 去掉括号及其内容（如 "(深度求索)"、"(Google AI Studio)"）
  const noParen = lower.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  // 只保留字母数字与中文，其余切分为 Token
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
    // README 抓取失败不阻断主流程，官方链接映射为空
    return map;
  }

  // 按厂商标题 "### N. VendorName (中文名)" 切分
  const sections = readme.split(/\n### \d+\. /);
  for (const section of sections) {
    const headerMatch = section.match(/^([^\n]+?)\n/);
    if (!headerMatch) continue;
    const header = headerMatch[1].trim();
    // 去掉可能的序号前缀与括号，保留厂商名
    const rawName = header.replace(/^\d+\.\s*/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!rawName) continue;

    // 提取 **官方直达** 行，保留链接文字和 URL
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

function isOfficialHomepage(text: string): boolean {
  return HOMEPAGE_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * 用 RSS 解析出的厂商名去 README 映射中模糊匹配，并选出最佳官方链接。
 *
 * 选取规则：
 * 1. 在匹配到的厂商官方链接中，按链接文字打分，选得分最高的；
 * 2. 若最高分 <= 0（没有合适的正向链接），回退到“官方主页”链接；
 * 3. 仍没有则返回 null（hasOfficialLink=false）。
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

  // 按链接文字打分，选得分最高的
  let bestLink: OfficialLink | null = null;
  let bestLinkScore = -Infinity;
  for (const link of bestVendor.officialLinks) {
    const s = scoreLinkText(link.text);
    if (s > bestLinkScore) {
      bestLinkScore = s;
      bestLink = link;
    }
  }

  // 若最高分 > 0，认为有合适的链接，直接使用
  if (bestLinkScore > 0 && bestLink) return bestLink;

  // 否则回退到“官方主页”链接
  const homepageLink = bestVendor.officialLinks.find((l) => isOfficialHomepage(l.text));
  return homepageLink || null;
}

/** 根据标题推断条目分类。
 *
 * 规则：
 * - deal：标题须含“新增/新推出/上线/赠送/限时免费/试用”之一，且不含“未变/仍维持/微调/不变/更名”；
 * - price_change：标题含降价/更名/计费微调等计费变动关键词；
 * - change：其他额度与活动变化。
 */
export function classifyKind(rss: RssItem): ItemKind {
  const title = rss.title;
  const hasNegative = DEAL_NEGATIVE_KEYWORDS.some((kw) => title.includes(kw));
  const hasPositive = DEAL_POSITIVE_KEYWORDS.some((kw) => title.includes(kw));

  if (hasPositive && !hasNegative) return 'deal';

  const text = `${title}\n${rss.description ?? ''}`.toLowerCase();
  for (const kw of PRICE_CHANGE_KEYWORDS) {
    if (new RegExp(kw, 'i').test(text)) return 'price_change';
  }

  return 'change';
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
  const publishedAt = toIso(rss.pubDate);
  const vendorName = vendor || '未知厂商';

  return {
    id: `fli-${stableId(rss.guid || rss.link || rss.title)}`,
    title: rss.title,
    reward: `官方动态：${vendorName} 发布新内容`,
    estimatedValue: '¥0',
    estimatedValueRmb: 0,
    condition: '点击官方链接阅读原文，确认是否涉及免费额度或限时活动',
    category: mapCategory(vendorName),
    claimMethod: '直接领取',
    verificationStatus: '未核验',
    verificationNote:
      '来自 free-llm-intel 公开 RSS 订阅，未独立核验，以官方页面为准；未生成兑换码。',
    expiresAt: null,
    deadline: null,
    publishedAt,
    createdAt: publishedAt,
    updatedAt: publishedAt,
    isNew: true,
    isUpdated: false,
    sourceId: `src-fli-${vendorSlug(vendorName)}`,
    sourceName: vendorName,
    sourceUrl,
    steps: ['打开官方链接阅读原文', '在官方页面确认免费额度或活动规则'],
    riskNotes:
      '来自第三方订阅，标题已汉化，未经官方确认，请以厂商官方页面为准。',
    tags: [vendorName, '官方动态'],
    kind,
    hasOfficialLink,
    deadlineHint: deadlineHint || undefined,
    intelSource: rss.link || undefined,
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
    kindPct: { deal: 0, price_change: 0, change: 0, news: 0 },
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
    const deadlineHint = extractDeadlineHint(r.title);
    changesItems.push(convertToWoolItem(r, kind, nowMs, vendor, selectedLink, deadlineHint));
  }
  const todayItems = deduplicate(changesItems.filter((it) => shouldEnterToday(it.kind ?? 'change')));
  // 统计基于进入文件的最终条目，使 count 与 kind 分布一致
  const finalStats: FetchStats = {
    unknownVendorCount: todayItems.filter((i) => i.sourceName === '未知厂商').length,
    noOfficialLinkCount: todayItems.filter((i) => !i.hasOfficialLink).length,
    kindCount: { deal: 0, price_change: 0, change: 0, news: 0 },
    kindPct: { deal: 0, price_change: 0, change: 0, news: 0 },
  };
  for (const it of todayItems) finalStats.kindCount[it.kind ?? 'change'] += 1;

  const total = todayItems.length;
  for (const k of ['deal', 'price_change', 'change', 'news'] as const) {
    finalStats.kindPct[k] = total > 0 ? Math.round((finalStats.kindCount[k] / total) * 100) : 0;
  }

  // deal 占比超过 50% 时在日志里警告
  if (finalStats.kindPct.deal > 50) {
    // eslint-disable-next-line no-console
    console.warn(
      `[fetch-source] 警告：deal 占比 ${finalStats.kindPct.deal}% 超过 50%`
    );
  }

  writeWoolJson(WOOL_JSON_PATH, todayItems, nowMs, finalStats);

  // 新闻订阅 → 单独“动态”分区，不进今日羊毛（news）
  const newsXml = await fetchRssText(NEWS_RSS_URL);
  const newsRss = parseRss(newsXml);
  const newsItems: WoolItem[] = [];
  for (const r of newsRss) {
    stats.kindCount['news'] += 1;
    newsItems.push(convertToWoolItem(r, 'news', nowMs, null, null, null));
  }
  writeWoolJson(NEWS_JSON_PATH, deduplicate(newsItems), nowMs);

  // eslint-disable-next-line no-console
  console.log(
    `[fetch-source] 抓取完成：变化 ${changesRss.length} 条（今日羊毛 ${todayItems.length} 条），新闻 ${newsRss.length} 条（单独动态分区，不进今日羊毛）`
  );
  // eslint-disable-next-line no-console
  console.log(
    `[fetch-source] 统计：未知厂商 ${finalStats.unknownVendorCount} 条，无官方链接 ${finalStats.noOfficialLinkCount} 条，kind=${JSON.stringify(finalStats.kindCount)}，占比=${JSON.stringify(finalStats.kindPct)}`
  );
  // eslint-disable-next-line no-console
  console.log(`[fetch-source] 已写入 ${WOOL_JSON_PATH} 与 ${NEWS_JSON_PATH}`);
}

if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('fetch-source.ts')) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[fetch-source] 失败：', e);
    process.exit(1);
  });
}
