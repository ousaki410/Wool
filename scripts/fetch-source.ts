#!/usr/bin/env npx tsx
/**
 * 抓取 free-llm-intel 公开变化订阅（RSS），转换为 WoolRadar 种子字段，
 * 输出到 public/data/wool.json。
 *
 * 只读上游公开订阅，不执行上游任何安装脚本，不调用任何付费接口。
 * 无法确认官方来源的条目，核验状态一律写“未核验”；
 * 不自动生成“官方已核验”，也不生成兑换码。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

import type { WoolItem } from '../src/data/woolData';

const RSS_URL = 'https://free-llm-intel.aishort.top/feeds/llm-news-all.xml';
const OUTPUT_PATH = 'public/data/wool.json';
const SOURCE_NAME = 'free-llm-intel 公开订阅';
const SOURCE_URL = 'https://free-llm-intel.aishort.top/';

export interface RssItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  category: string;
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
      category: get('category'),
      source: getAttr('source', 'url') || get('source'),
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

function mapCategory(vendor: string): WoolItem['category'] {
  const v = vendor.toLowerCase();
  if (/amazon|aws|google|gcp|azure|cloudflare|oracle|alibaba|aliyun|tencent|huawei/.test(v)) {
    return '云服务与算力';
  }
  if (
    /openai|anthropic|meta|llama|mistral|deepseek|xai|grok|cohere|ai21|gemini|claude/.test(v)
  ) {
    return 'AI 与大模型';
  }
  return '开发工具与 SaaS';
}

function toIso(rfc2822: string): string {
  const d = new Date(rfc2822);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** 把单条 RSS 条目转为 WoolItem。缺失字段不编造，核验状态固定“未核验”。 */
export function convertToWoolItem(rss: RssItem, nowMs: number): WoolItem {
  const vendor = rss.category || '未知厂商';
  const link = rss.link || rss.guid || SOURCE_URL;
  const publishedAt = toIso(rss.pubDate);
  return {
    id: `fli-${stableId(rss.guid || rss.link || rss.title)}`,
    title: rss.title,
    reward: `官方动态：${vendor} 发布新内容`,
    estimatedValue: '¥0',
    estimatedValueRmb: 0,
    condition: '点击官方链接阅读原文，确认是否涉及免费额度或限时活动',
    category: mapCategory(vendor),
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
    sourceId: `src-fli-${vendorSlug(vendor)}`,
    sourceName: vendor,
    sourceUrl: link,
    steps: ['打开官方链接查看原文', '在官方页面确认免费额度或活动规则'],
    riskNotes:
      '来自第三方订阅，标题已汉化，未经官方确认，请以厂商官方页面为准。',
    tags: [vendor, '官方动态'],
  };
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

/** 把转换好的条目打包成 wool.json 并写入磁盘。 */
export async function writeWoolJson(items: WoolItem[], nowMs: number): Promise<void> {
  const dir = OUTPUT_PATH.split('/').slice(0, -1).join('/');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const out: Record<string, unknown> = {
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    fetchedAt: new Date(nowMs).toISOString(),
    count: items.length,
    items,
  };
  writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
}

export interface SourceMeta {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  count: number;
}

export function extractMeta(json: unknown): SourceMeta | null {
  if (!json || typeof json !== 'object') return null;
  const obj = json as Record<string, unknown>;
  const meta = obj.__meta;
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as Record<string, unknown>;
  return {
    source: typeof m.source === 'string' ? m.source : '',
    sourceUrl: typeof m.sourceUrl === 'string' ? m.sourceUrl : '',
    fetchedAt: typeof m.fetchedAt === 'string' ? m.fetchedAt : '',
    count: typeof m.count === 'number' ? m.count : 0,
  };
}

/** 主流程：抓取 → 解析 → 转换 → 去重 → 写入 public/data/wool.json。 */
export async function main(): Promise<void> {
  const xml = await fetchRssText(RSS_URL);
  const rssItems = parseRss(xml);
  const nowMs = Date.now();
  const converted = rssItems.map((r) => convertToWoolItem(r, nowMs));
  const unique = deduplicate(converted);

  await writeWoolJson(unique, nowMs);

  // eslint-disable-next-line no-console
  console.log(
    `[fetch-source] 抓取完成：RSS 条目 ${rssItems.length} 条，去重后 ${unique.length} 条，已写入 ${OUTPUT_PATH}`
  );
}

if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('fetch-source.ts')) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[fetch-source] 失败：', e);
    process.exit(1);
  });
}
