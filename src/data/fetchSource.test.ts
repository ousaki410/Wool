import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRss,
  convertToWoolItem,
  classifyKind,
  shouldEnterToday,
  deduplicate,
} from '../../scripts/fetch-source';

const CHANGES_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>LLM 免费额度 · 新活动与新额度变化</title>
    <item>
      <title>额度变化 · Google Gemini：免费层新增可用的 Gemini Decision 1</title>
      <link>https://github.com/rockbenben/free-llm-intel#28-google-gemini</link>
      <guid isPermaLink="false">changelog-2026-11-17-google_gemini</guid>
      <pubDate>Tue, 17 Nov 2026 00:00:00 +0000</pubDate>
      <description>免费层新增可用的 Gemini Decision 1</description>
    </item>
    <item>
      <title>额度变化 · Google Gemini Enterprise：免费页新增「Gemini Enterprise Plus 版 30 天免费试用」</title>
      <link>https://github.com/rockbenben/free-llm-intel#63-gcp</link>
      <guid isPermaLink="false">changelog-2026-11-17-gcp</guid>
      <pubDate>Tue, 17 Nov 2026 00:00:00 +0000</pubDate>
      <description>新增「30 天免费试用」这一限时活动</description>
    </item>
    <item>
      <title>缺少字段的变化条目</title>
      <pubDate>不是一个合法日期</pubDate>
    </item>
  </channel>
</rss>`;

const NEWS_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>全部厂商 · 官方动态</title>
    <item>
      <title>[OpenAI] GPT-6.2 Astra 和 Sol 简介</title>
      <link>https://openai.com/index/introducing-gpt-6-2-astra-sol</link>
      <guid isPermaLink="true">https://openai.com/index/introducing-gpt-6-2-astra-sol</guid>
      <pubDate>Tue, 17 Nov 2026 00:00:00 +0000</pubDate>
      <category>OpenAI</category>
      <description>原文标题：Introducing GPT-6.2 Astra and Sol</description>
    </item>
  </channel>
</rss>`;

test('parseRss 提取变化订阅 item 字段（无 category/source）', () => {
  const items = parseRss(CHANGES_RSS);
  assert.equal(items.length, 3);

  const first = items[0];
  assert.equal(first.title, '额度变化 · Google Gemini：免费层新增可用的 Gemini Decision 1');
  assert.equal(
    first.link,
    'https://github.com/rockbenben/free-llm-intel#28-google-gemini'
  );
  assert.equal(first.guid, 'changelog-2026-11-17-google_gemini');
  assert.equal(first.category, undefined);
  assert.equal(first.source, undefined);

  const last = items[2];
  assert.equal(last.title, '缺少字段的变化条目');
  assert.equal(last.link, '');
  assert.equal(last.pubDate, '不是一个合法日期');
});

test('classifyKind：新闻订阅为 news；变化订阅中命中福利关键词为 deal，其余为 change', () => {
  const newsItem = { title: '[OpenAI] 新模型发布', link: '', guid: '', pubDate: '', description: '' };
  assert.equal(classifyKind(newsItem, 'news'), 'news');

  const dealItem = {
    title: '额度变化 · X：免费页新增「30 天免费试用」',
    link: '',
    guid: '',
    pubDate: '',
    description: '新增「30 天免费试用」这一限时活动',
  };
  assert.equal(classifyKind(dealItem, 'changes'), 'deal');

  const changeItem = {
    title: '额度变化 · X：免费层新增可用的模型',
    link: '',
    guid: '',
    pubDate: '',
    description: '免费层新增可用的模型，策略调整',
  };
  assert.equal(classifyKind(changeItem, 'changes'), 'change');
});

test('shouldEnterToday：只有 deal 和 change 进入今日羊毛，news 不进入', () => {
  assert.equal(shouldEnterToday('deal'), true);
  assert.equal(shouldEnterToday('change'), true);
  assert.equal(shouldEnterToday('news'), false);
});

test('convertToWoolItem：核验状态固定未核验，不生成兑换码，不推断截止时间，带 kind', () => {
  const rss = {
    title: '额度变化 · Google Gemini：免费层新增可用的 Gemini Decision 1',
    link: 'https://github.com/rockbenben/free-llm-intel#28-google-gemini',
    guid: 'changelog-2026-11-17-google_gemini',
    pubDate: 'Tue, 17 Nov 2026 00:00:00 +0000',
    category: undefined,
    source: undefined,
    description: '免费层新增可用的 Gemini Decision 1',
  };
  const item = convertToWoolItem(rss, 'change', Date.parse('2026-11-17T14:00:00+08:00'));

  assert.equal(item.verificationStatus, '未核验');
  assert.equal(item.promoCode, undefined);
  assert.equal(item.expiresAt, null);
  assert.equal(item.deadline, null);
  assert.equal(item.kind, 'change');
  assert.ok(item.publishedAt.startsWith('2026-11-17T'));
  assert.ok(item.id.startsWith('fli-'));
  assert.ok(item.verificationNote.includes('未独立核验'));
});

test('convertToWoolItem：字段缺失时不抛出，使用安全兜底', () => {
  const item = convertToWoolItem(
    {
      title: '缺少字段的变化条目',
      link: '',
      guid: '',
      pubDate: '不是一个合法日期',
      category: undefined,
      source: undefined,
      description: '',
    },
    'change',
    Date.now()
  );

  assert.equal(item.title, '缺少字段的变化条目');
  assert.equal(item.verificationStatus, '未核验');
  assert.equal(item.expiresAt, null);
  assert.ok(item.publishedAt.length > 0);
  assert.ok(item.sourceUrl.length > 0);
});

test('deduplicate：按 sourceUrl 去重，保留首次出现', () => {
  const now = Date.now();
  const base = convertToWoolItem(
    {
      title: '额度变化 · X：免费试用',
      link: 'https://example.com/x',
      guid: 'https://example.com/x',
      pubDate: 'Tue, 17 Nov 2026 00:00:00 +0000',
      category: undefined,
      source: undefined,
      description: '第一条',
    },
    'deal',
    now
  );
  const dup = { ...base, title: '重复标题', description: '重复' };
  const distinct = convertToWoolItem(
    {
      title: '额度变化 · Y：另一条',
      link: 'https://example.com/y',
      guid: 'https://example.com/y',
      pubDate: 'Tue, 17 Nov 2026 00:00:00 +0000',
      category: undefined,
      source: undefined,
      description: '另一条',
    },
    'change',
    now
  );

  const result = deduplicate([base, dup, distinct]);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, base.id);
  assert.equal(result[1].sourceName, '未知厂商');
});

test('新闻条目不进入羊毛列表：shouldEnterToday 过滤后仅保留 deal/change', () => {
  const now = Date.now();
  const news = convertToWoolItem(
    {
      title: '[OpenAI] GPT-6.2 简介',
      link: 'https://openai.com/x',
      guid: 'https://openai.com/x',
      pubDate: 'Tue, 17 Nov 2026 00:00:00 +0000',
      category: 'OpenAI',
      source: '',
      description: '新闻',
    },
    'news',
    now
  );
  const deal = convertToWoolItem(
    {
      title: '额度变化 · X：免费试用',
      link: 'https://example.com/x',
      guid: 'https://example.com/x',
      pubDate: 'Tue, 17 Nov 2026 00:00:00 +0000',
      category: undefined,
      source: undefined,
      description: '免费试用',
    },
    'deal',
    now
  );
  const change = convertToWoolItem(
    {
      title: '额度变化 · Y：策略调整',
      link: 'https://example.com/y',
      guid: 'https://example.com/y',
      pubDate: 'Tue, 17 Nov 2026 00:00:00 +0000',
      category: undefined,
      source: undefined,
      description: '策略调整',
    },
    'change',
    now
  );

  const all = [news, deal, change];
  const today = all.filter((it) => shouldEnterToday(it.kind!));
  assert.equal(today.length, 2);
  assert.ok(today.every((it) => it.kind === 'deal' || it.kind === 'change'));
  assert.ok(!today.some((it) => it.kind === 'news'));
});
