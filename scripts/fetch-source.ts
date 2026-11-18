#!/usr/bin/env npx tsx
/**
 * 抓取 free-llm-intel 公开订阅，转换为 WoolRadar 种子字段，
 * 输出到 public/data/wool.json（今日羊毛）与 public/data/news.json（单独“动态”分区，不进今日羊毛）。
 *
 * 只读上游公开订阅，不执行上游任何安装脚本，不调用任何付费接口。
 * 核验状态固定“未核验”；不生成兑换码；不推断截止时间。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

import type { ItemKind, WoolItem } from '../src/data/woolData';

const CHANGES_RSS_URL = 'https://free-llm-intel.aishort.top/feeds/llm-intel-changes.xml';
const NEWS_RSS_URL = 'https://free-llm-intel.aishort.top/feeds/llm-news-all.xml';
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

/** 判断链接是否指向厂商官方页（非 free-llm-intel / GitHub 镜像），用于核验状态例外。 */
function isOfficialLink(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return !(
      host === 'github.com' ||
      host.endsWith('.github.io') ||
      host.includes('aishort.top') ||
      host.includes('free-llm-intel')
    );
  } catch {
    return false;
  }
}

/** 可领取的福利或额度关键词：命中则归为 deal，其余变化归为 change。 */
const DEAL_KEYWORDS = [
  '免费试用',
  '免费领取',
  '免费领',
  '代金券',
  '新用户.*赠送',
  '注册.*送',
  '0 元',
  '白嫖',
  '限时免费活动',
  '赠金',
];

/** 把单条 RSS 条目转为 WoolItem。缺失字段不编造，核验状态固定“未核验”。 */
export function convertToWoolItem(rss: RssItem, kind: ItemKind, nowMs: number): WoolItem {
  const link = rss.link || rss.guid || SOURCE_URL;
  const publishedAt = toIso(rss.pubDate);
  return {
    id: `fli-${stableId(rss.guid || rss.link || rss.title)}`,
    title: rss.title,
    reward: `官方动态：${rss.category || '未知厂商'} 发布新内容`,
    estimatedValue: '¥0',
    estimatedValueRmb: 0,
    condition: '点击官方链接阅读原文，确认是否涉及免费额度或限时活动',
    category: mapCategory(rss.category || ''),
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
    sourceId: `src-fli-${vendorSlug(rss.category || 'unknown')}`,
    sourceName: rss.category || '未知厂商',
    sourceUrl: link,
    steps: ['打开官方链接查看原文', '在官方页面确认免费额度或活动规则'],
    riskNotes:
      '来自第三方订阅，标题已汉化，未经官方确认，请以厂商官方页面为准。',
    tags: [(rss.category || '未知厂商'), '官方动态'],
    kind,
  };
}

/** 根据来源与内容推断条目分类。 */
export function classifyKind(rss: RssItem, feedType: 'changes' | 'news'): ItemKind {
  if (feedType === 'news') return 'news';
  const text = `${rss.title}\n${rss.description}`.toLowerCase();
  for (const kw of DEAL_KEYWORDS) {
    if (new RegExp(kw, 'i').test(text)) return 'deal';
  }
  return 'change';
}

/** 是否应进入“今日羊毛”：只有 deal 和 change。 */
export function shouldEnterToday(kind: ItemKind): boolean {
  return kind === 'deal' || kind === 'change';
}

/** 按 guid 去重，保留首次出现。 */
export function deduplicate(items: WoolItem[]): WoolItem[] {
  const seen = new Set<string>();
  const out: WoolItem[] = [];
  for (const it of items) {
    const key = it.sourceUrl || it.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/** 把条目写入指定的 JSON 文件。 */
export function writeWoolJson(path: string, items: WoolItem[], nowMs: number): void {
  const dir = path.split('/').slice(0, -1).join('/');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const out: Record<string, unknown> = {
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    fetchedAt: new Date(nowMs).toISOString(),
    count: items.length,
    items,
  };
  writeFileSync(path, JSON.stringify(out, null, 2) + '\n', 'utf8');
}

/** 主流程：抓取变化订阅（今日羊毛）与新闻订阅（单独动态分区）。 */
export async function main(): Promise<void> {
  const nowMs = Date.now();

  // 变化订阅 → 今日羊毛（deal / change）
  const changesXml = await fetchRssText(CHANGES_RSS_URL);
  const changesRss = parseRss(changesXml);
  const changesItems = deduplicate(
    changesRss.map((r) => convertToWoolItem(r, classifyKind(r, 'changes'), nowMs))
  );
  const todayItems = changesItems.filter((it) => shouldEnterToday(it.kind ?? 'change'));
  writeWoolJson(WOOL_JSON_PATH, todayItems, nowMs);

  // 新闻订阅 → 单独“动态”分区，不进今日羊毛（news）
  const newsXml = await fetchRssText(NEWS_RSS_URL);
  const newsRss = parseRss(newsXml);
  const newsItems = deduplicate(
    newsRss.map((r) => convertToWoolItem(r, classifyKind(r, 'news'), nowMs))
  );
  writeWoolJson(NEWS_JSON_PATH, newsItems, nowMs);

  // eslint-disable-next-line no-console
  console.log(
    `[fetch-source] 抓取完成：变化 ${changesRss.length} 条（今日羊毛 ${todayItems.length} 条），新闻 ${newsRss.length} 条（单独动态分区，不进今日羊毛）`
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
