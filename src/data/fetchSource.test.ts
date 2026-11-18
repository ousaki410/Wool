import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRss,
  convertToWoolItem,
  deduplicate,
  extractMeta,
} from '../../scripts/fetch-source';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>全部厂商 · 官方动态</title>
    <item>
      <title>[OpenAI] GPT-6.2 Astra 和 Sol 简介</title>
      <link>https://openai.com/index/introducing-gpt-6-2-astra-sol</link>
      <guid isPermaLink="true">https://openai.com/index/introducing-gpt-6-2-astra-sol</guid>
      <pubDate>Tue, 17 Nov 2026 00:00:00 +0000</pubDate>
      <category>OpenAI</category>
      <source url="https://free-llm-intel.aishort.top/feeds/llm-news-openai.xml">OpenAI</source>
      <description>原文标题：Introducing GPT-6.2 Astra and Sol</description>
    </item>
    <item>
      <title>[OpenAI] GPT-6.2 Astra 和 Sol 简介</title>
      <link>https://openai.com/index/introducing-gpt-6-2-astra-sol</link>
      <guid isPermaLink="true">https://openai.com/index/introducing-gpt-6-2-astra-sol</guid>
      <pubDate>Tue, 17 Nov 2026 00:00:00 +0000</pubDate>
      <category>OpenAI</category>
      <description>重复条目，应被去重</description>
    </item>
    <item>
      <title>[Google Gemini] Gemini 3.5 Transcribe 语音编辑</title>
      <link>https://aistudio.google.com/docs/changelog#11-17-2026</link>
      <guid isPermaLink="true">https://aistudio.google.com/docs/changelog#11-17-2026</guid>
      <pubDate>Tue, 17 Nov 2026 00:00:00 +0000</pubDate>
      <category>Google Gemini</category>
      <description>完整标题：Gemini 3.5 Transcribe 中的语音编辑</description>
    </item>
    <item>
      <title>缺少字段的条目</title>
      <pubDate>不是一个合法日期</pubDate>
    </item>
  </channel>
</rss>`;

test('parseRss 提取全部 item 字段并忽略非 item 段落', () => {
  const items = parseRss(RSS);
  assert.equal(items.length, 4);

  const first = items[0];
  assert.equal(first.title, '[OpenAI] GPT-6.2 Astra 和 Sol 简介');
  assert.equal(first.link, 'https://openai.com/index/introducing-gpt-6-2-astra-sol');
  assert.equal(first.guid, 'https://openai.com/index/introducing-gpt-6-2-astra-sol');
  assert.equal(first.category, 'OpenAI');
  assert.equal(
    first.source,
    'https://free-llm-intel.aishort.top/feeds/llm-news-openai.xml'
  );
  assert.ok(first.description.includes('Introducing GPT-6.2 Astra and Sol'));

  const last = items[3];
  assert.equal(last.title, '缺少字段的条目');
  assert.equal(last.link, '');
  assert.equal(last.category, '');
});

test('convertToWoolItem 不生成官方已核验或兑换码，核验状态固定未核验', () => {
  const rss = {
    title: '[OpenAI] GPT-6.2 Astra 和 Sol 简介',
    link: 'https://openai.com/index/introducing-gpt-6-2-astra-sol',
    guid: 'https://openai.com/index/introducing-gpt-6-2-astra-sol',
    pubDate: 'Tue, 17 Nov 2026 00:00:00 +0000',
    category: 'OpenAI',
    source: '',
    description: '原文标题：Introducing GPT-6.2 Astra and Sol',
  };
  const item = convertToWoolItem(rss, Date.parse('2026-11-17T14:00:00+08:00'));

  assert.equal(item.verificationStatus, '未核验');
  assert.equal(item.promoCode, undefined);
  assert.equal(item.expiresAt, null);
  assert.equal(item.deadline, null);
  assert.equal(item.estimatedValueRmb, 0);
  assert.ok(item.publishedAt.startsWith('2026-11-17T'));
  assert.ok(item.sourceId.startsWith('src-fli-'));
  assert.ok(item.id.startsWith('fli-'));
  assert.ok(item.tags.includes('OpenAI'));
  assert.ok(item.tags.includes('官方动态'));
  assert.ok(item.verificationNote.includes('未独立核验'));
});

test('convertToWoolItem 字段缺失时不抛出，缺失字段使用安全兜底', () => {
  const item = convertToWoolItem(
    {
      title: '缺少字段的条目',
      link: '',
      guid: '',
      pubDate: '不是一个合法日期',
      category: '',
      source: '',
      description: '',
    },
    Date.now()
  );

  assert.equal(item.title, '缺少字段的条目');
  assert.equal(item.verificationStatus, '未核验');
  assert.equal(item.expiresAt, null);
  // 非法日期应回退到当前时间，而非崩溃；缺失链接回退到订阅首页
  assert.ok(item.publishedAt.length > 0);
  assert.ok(item.sourceUrl.length > 0);
  assert.equal(item.sourceName, '未知厂商');
});

test('deduplicate 按 sourceUrl 去重，保留首次出现', () => {
  const base = convertToWoolItem(
    {
      title: '[OpenAI] GPT-6.2 Astra 和 Sol 简介',
      link: 'https://openai.com/index/introducing-gpt-6-2-astra-sol',
      guid: 'https://openai.com/index/introducing-gpt-6-2-astra-sol',
      pubDate: 'Tue, 17 Nov 2026 00:00:00 +0000',
      category: 'OpenAI',
      source: '',
      description: '第一条',
    },
    Date.now()
  );
  const dup = { ...base, title: '重复标题', description: '重复' };
  const distinct = convertToWoolItem(
    {
      title: '[Google Gemini] 另一条',
      link: 'https://aistudio.google.com/docs/changelog#11-17-2026',
      guid: 'https://aistudio.google.com/docs/changelog#11-17-2026',
      pubDate: 'Tue, 17 Nov 2026 00:00:00 +0000',
      category: 'Google Gemini',
      source: '',
      description: '另一条',
    },
    Date.now()
  );

  const result = deduplicate([base, dup, distinct]);
  assert.equal(result.length, 2);
  // 去重保留首次出现（相同 guid 产生相同 id）
  assert.equal(result[0].id, base.id);
  assert.equal(result[1].sourceName, 'Google Gemini');
});

test('extractMeta 对 wool.json 顶层元数据提取正确', () => {
  const now = new Date('2026-11-17T14:00:00+08:00').getTime();
  const item = convertToWoolItem(
    {
      title: '[OpenAI] 测试',
      link: 'https://openai.com/x',
      guid: 'https://openai.com/x',
      pubDate: 'Tue, 17 Nov 2026 00:00:00 +0000',
      category: 'OpenAI',
      source: '',
      description: 'd',
    },
    now
  );
  const payload = { source: 'x', sourceUrl: 'y', fetchedAt: now.toString(), count: 1, items: [item] };
  const meta = extractMeta(payload as unknown);
  assert.equal(meta, null); // 顶层没有 __meta，应返回 null
});

test('extractMeta 提取内嵌 __meta 元数据', () => {
  const item = convertToWoolItem(
    {
      title: '[OpenAI] 测试',
      link: 'https://openai.com/x',
      guid: 'https://openai.com/x',
      pubDate: 'Tue, 17 Nov 2026 00:00:00 +0000',
      category: 'OpenAI',
      source: '',
      description: 'd',
    },
    Date.now()
  );
  const payload = {
    items: [item],
    __meta: {
      source: 'free-llm-intel 公开订阅',
      sourceUrl: 'https://free-llm-intel.aishort.top/',
      fetchedAt: '2026-11-17T14:00:00.000Z',
      count: 1,
    },
  };
  const meta = extractMeta(payload as unknown);
  assert.ok(meta);
  assert.equal(meta?.source, 'free-llm-intel 公开订阅');
  assert.equal(meta?.count, 1);
});

test('extractMeta 对非对象或缺失 __meta 返回 null', () => {
  assert.equal(extractMeta(null), null);
  assert.equal(extractMeta('not-object'), null);
  assert.equal(extractMeta({ items: [] }), null);
});
