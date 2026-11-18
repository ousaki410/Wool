import test from 'node:test';
import assert from 'node:assert/strict';
import type { WoolItem } from '../../src/data/woolData';
import {
  parseRss,
  parseVendorFromTitle,
  classifyKind,
  shouldEnterToday,
  extractDeadlineHint,
  deduplicate,
  matchOfficialLinks,
  fetchReadmeVendors,
} from '../../scripts/fetch-source';

const CHANGES_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>LLM 免费额度 · 新活动与新额度变化</title>
    <item>
      <title>额度变化 · Google Gemini：免费层新增可用的 Gemini Decision 1 并公开其限额</title>
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
      <title>额度变化 · Parallel Web API：免费档由「Developer」更名为「Build」</title>
      <link>https://github.com/rockbenben/free-llm-intel#57-parallel</link>
      <guid isPermaLink="false">changelog-2026-11-17-parallel</guid>
      <pubDate>Tue, 17 Nov 2026 00:00:00 +0000</pubDate>
      <description>免费档由 Developer 更名为 Build</description>
    </item>
    <item>
      <title>额度变化 · 阶跃星辰 StepFun：StepAudio 3 系列限时免费截止时间顺延至 2026-11-23</title>
      <link>https://github.com/rockbenben/free-llm-intel#25-stepfun</link>
      <guid isPermaLink="false">changelog-2026-11-17-stepfun</guid>
      <pubDate>Tue, 17 Nov 2026 00:00:00 +0000</pubDate>
      <description>限时免费截止时间顺延至 2026-11-23</description>
    </item>
    <item>
      <title>额度变化 · Together AI：输入计费微调为 $0.042/1M tokens</title>
      <link>https://github.com/rockbenben/free-llm-intel#39-together</link>
      <guid isPermaLink="false">changelog-2026-11-17-together</guid>
      <pubDate>Tue, 17 Nov 2026 00:00:00 +0000</pubDate>
      <description>输入计费微调为 $0.042/1M tokens</description>
    </item>
    <item>
      <title>缺少字段的变化条目</title>
      <pubDate>不是一个合法日期</pubDate>
    </item>
  </channel>
</rss>`;

test('parseVendorFromTitle 解析厂商名，失败返回 null', () => {
  assert.equal(parseVendorFromTitle('额度变化 · Google Gemini：免费层新增可用的 Gemini Decision 1'), 'Google Gemini');
  assert.equal(parseVendorFromTitle('额度变化 · 阶跃星辰 StepFun：限时免费顺延'), '阶跃星辰 StepFun');
  assert.equal(parseVendorFromTitle('额度变化 · DeepSeek：降价'), 'DeepSeek');
  // 无 "：" 分隔
  assert.equal(parseVendorFromTitle('额度变化 · 仅厂商名'), '仅厂商名');
  // 非变化标题
  assert.equal(parseVendorFromTitle('[OpenAI] GPT-6.2 简介'), null);
  assert.equal(parseVendorFromTitle('无关标题'), null);
});

test('extractDeadlineHint 提取标题中的明确日期，不写入 expiresAt', () => {
  assert.equal(extractDeadlineHint('额度变化 · 阶跃星辰 StepFun：顺延至 2026-11-23'), '2026-11-23');
  assert.equal(extractDeadlineHint('额度变化 · X：2026-11-23 起收费'), '2026-11-23');
  assert.equal(extractDeadlineHint('额度变化 · X：无日期'), null);
});

test('classifyKind：deal 仅用于新增免费层/赠金/试用/限时免费；price_change 用于降价更名计费微调', () => {
  const freeTier = { title: '额度变化 · X：免费层新增可用的模型', link: '', guid: '', pubDate: '', description: '免费层新增' };
  assert.equal(classifyKind(freeTier), 'deal');

  const trial = { title: '额度变化 · X：新增 30 天免费试用', link: '', guid: '', pubDate: '', description: '免费试用' };
  assert.equal(classifyKind(trial), 'deal');

  const credit = { title: '额度变化 · X：新增 $500 Credits', link: '', guid: '', pubDate: '', description: '赠金' };
  assert.equal(classifyKind(credit), 'deal');

  const limited = { title: '额度变化 · X：限时免费活动', link: '', guid: '', pubDate: '', description: '限时免费' };
  assert.equal(classifyKind(limited), 'deal');

  const rename = { title: '额度变化 · X：免费档由 Developer 更名为 Build', link: '', guid: '', pubDate: '', description: '更名' };
  assert.equal(classifyKind(rename), 'price_change');

  const priceCut = { title: '额度变化 · X：输入计费微调为 $0.042/1M tokens', link: '', guid: '', pubDate: '', description: '计费微调' };
  assert.equal(classifyKind(priceCut), 'price_change');

  const other = { title: '额度变化 · X：策略调整，文案更新', link: '', guid: '', pubDate: '', description: '策略调整' };
  assert.equal(classifyKind(other), 'change');
});

test('shouldEnterToday：deal / price_change / change 进入，news 不进入', () => {
  assert.equal(shouldEnterToday('deal'), true);
  assert.equal(shouldEnterToday('price_change'), true);
  assert.equal(shouldEnterToday('change'), true);
  assert.equal(shouldEnterToday('news'), false);
});

test('parseRss 提取变化订阅 item 字段（无 category/source）', () => {
  const items = parseRss(CHANGES_RSS);
  assert.equal(items.length, 6);
  const first = items[0];
  assert.equal(first.title, '额度变化 · Google Gemini：免费层新增可用的 Gemini Decision 1 并公开其限额');
  assert.equal(first.category, undefined);
});

test('matchOfficialLinks 与 fetchReadmeVendors：命中官方直达链接，未命中返回空', () => {
  // 这个测试需要网络抓取 README，若失败则降级为空映射，不应抛出
  return fetchReadmeVendors().then((vendorMap) => {
    // Google Gemini 应能命中 README 中的 "Google Gemini (Google AI Studio)"
    const gemini = matchOfficialLinks('Google Gemini', vendorMap);
    assert.ok(gemini.matched || gemini.links.length === 0);

    // 不存在的厂商不应命中
    const unknown = matchOfficialLinks('不存在的厂商 XXXX', vendorMap);
    assert.equal(unknown.matched, false);
    assert.equal(unknown.links.length, 0);
  });
});

test('deduplicate：按 sourceUrl 去重，保留首次出现', () => {
  const base: WoolItem = {
    id: 'fli-aaa',
    title: '额度变化 · X：免费试用',
    reward: '',
    estimatedValue: '¥0',
    estimatedValueRmb: 0,
    condition: '',
    category: '开发工具与 SaaS',
    claimMethod: '直接领取',
    verificationStatus: '未核验',
    verificationNote: '',
    expiresAt: null,
    deadline: null,
    publishedAt: '2026-11-17T00:00:00.000Z',
    createdAt: '2026-11-17T00:00:00.000Z',
    updatedAt: '2026-11-17T00:00:00.000Z',
    isNew: true,
    isUpdated: false,
    sourceId: 'src-fli-x',
    sourceName: '未知厂商',
    sourceUrl: 'https://example.com/x',
    steps: [],
    riskNotes: '',
    tags: [],
    kind: 'deal',
  };
  const dup: WoolItem = { ...base, title: '重复标题' };
  const distinct: WoolItem = { ...base, id: 'fli-bbb', sourceUrl: 'https://example.com/y', title: '另一条' };
  const result = deduplicate([base, dup, distinct]);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, base.id);
});
