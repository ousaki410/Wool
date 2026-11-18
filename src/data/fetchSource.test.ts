import test from 'node:test';
import assert from 'node:assert/strict';
import type { WoolItem } from '../../src/data/woolData';
import {
  parseRss,
  parseVendorFromTitle,
  classifyKind,
  classifyDirection,
  shouldEnterToday,
  extractDeadlineHint,
  extractReward,
  deduplicate,
  scoreLinkText,
  selectOfficialLink,
  fetchReadmeVendors,
  isWithinRecentHours,
  RECENT_HOURS_MS,
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
      <title>额度变化 · Morph Labs：免费层「每月 200 次请求」与首充送 $5 未变，但托管模型阵容已更新</title>
      <link>https://github.com/rockbenben/free-llm-intel#46-morph-labs</link>
      <guid isPermaLink="false">changelog-2026-11-17-morph_labs</guid>
      <pubDate>Tue, 17 Nov 2026 00:00:00 +0000</pubDate>
      <description>免费层每月 200 次请求与首充送 $5 未变</description>
    </item>
    <item>
      <title>额度变化 · 复旦 MOSS (MOSI)：付费模型开启六折优惠</title>
      <link>https://github.com/rockbenben/free-llm-intel#18-moss</link>
      <guid isPermaLink="false">changelog-2026-11-17-moss</guid>
      <pubDate>Tue, 17 Nov 2026 00:00:00 +0000</pubDate>
      <description>付费模型六折优惠</description>
    </item>
    <item>
      <title>额度变化 · Together AI：输入计费微调为 $0.042/1M tokens</title>
      <link>https://github.com/rockbenben/free-llm-intel#39-together</link>
      <guid isPermaLink="false">changelog-2026-11-17-together</guid>
      <pubDate>Tue, 17 Nov 2026 00:00:00 +0000</pubDate>
      <description>输入计费微调为 $0.042/1M tokens</description>
    </item>
    <item>
      <title>额度变化 · Anthropic Claude：官方调整高级订阅体系并细化限额：新增 Ultra 计划（$200/月，含 $200 API 额度），Max 计划固定为 $100/月（含 $100 API 额度）</title>
      <link>https://github.com/rockbenben/free-llm-intel#26-anthropic-claude</link>
      <guid isPermaLink="false">changelog-2026-11-01-anthropic</guid>
      <pubDate>Sun, 01 Nov 2026 00:00:00 +0000</pubDate>
      <description>新增 Ultra 计划（$200/月，含 $200 API 额度）</description>
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
  assert.equal(parseVendorFromTitle('额度变化 · 仅厂商名'), '仅厂商名');
  assert.equal(parseVendorFromTitle('[OpenAI] GPT-6.2 简介'), null);
  assert.equal(parseVendorFromTitle('无关标题'), null);
});

test('extractReward 从标题提取，去掉前缀并截断到 80 字', () => {
  assert.equal(
    extractReward('额度变化 · Google Gemini：免费层新增可用的 Gemini Decision 1 并公开其限额'),
    '免费层新增可用的 Gemini Decision 1 并公开其限额'
  );
  // 截断到 80 字
  const longTitle = '额度变化 · X厂商：' + 'A'.repeat(120);
  assert.equal(extractReward(longTitle), 'A'.repeat(80));
  // 无前缀时返回 null
  assert.equal(extractReward('无关标题'), null);
});

test('classifyKind：deal 仅用于新增免费层/赠金/试用/限时免费，且标题不含否定词', () => {
  const freeTier = { title: '额度变化 · X：免费层新增可用的模型', link: '', guid: '', pubDate: '', description: '免费层新增' };
  assert.equal(classifyKind(freeTier), 'deal');

  const trial = { title: '额度变化 · X：新增 30 天免费试用', link: '', guid: '', pubDate: '', description: '免费试用' };
  assert.equal(classifyKind(trial), 'deal');

  const credit = { title: '额度变化 · X：新增 $500 Credits', link: '', guid: '', pubDate: '', description: '赠金' };
  assert.equal(classifyKind(credit), 'deal');

  const limited = { title: '额度变化 · X：限时免费活动', link: '', guid: '', pubDate: '', description: '限时免费' };
  assert.equal(classifyKind(limited), 'deal');

  // 否定词：未变
  assert.equal(
    classifyKind({ title: '额度变化 · Morph Labs：免费层「每月 200 次请求」与首充送 $5 未变', link: '', guid: '', pubDate: '', description: '未变' }),
    'change'
  );
  // 否定词：微调
  assert.equal(
    classifyKind({ title: '额度变化 · Together AI：输入计费微调为 $0.042/1M tokens', link: '', guid: '', pubDate: '', description: '计费微调' }),
    'price_change'
  );
  // 否定词：更名
  assert.equal(
    classifyKind({ title: '额度变化 · Parallel Web API：免费档由「Developer」更名为「Build」', link: '', guid: '', pubDate: '', description: '更名' }),
    'price_change'
  );
  // 其他变化
  assert.equal(
    classifyKind({ title: '额度变化 · X：策略调整，文案更新', link: '', guid: '', pubDate: '', description: '策略调整' }),
    'change'
  );
});

test('classifyKind：Morph Labs / MOSS / Together AI 样例均不应为 deal', () => {
  const morph = {
    title: '额度变化 · Morph Labs：免费层「每月 200 次请求」与首充送 $5 未变，但托管模型阵容已更新',
    link: '',
    guid: '',
    pubDate: '',
    description: '未变',
  };
  assert.equal(classifyKind(morph), 'change');

  const moss = {
    title: '额度变化 · 复旦 MOSS (MOSI)：付费模型开启六折优惠',
    link: '',
    guid: '',
    pubDate: '',
    description: '付费模型六折优惠',
  };
  assert.equal(classifyKind(moss), 'price_change');

  const together = {
    title: '额度变化 · Together AI：输入计费微调为 $0.042/1M tokens',
    link: '',
    guid: '',
    pubDate: '',
    description: '计费微调',
  };
  assert.equal(classifyKind(together), 'price_change');
});

test('classifyKind：Anthropic Ultra 付费订阅不应为 deal', () => {
  const ultra = {
    title: '额度变化 · Anthropic Claude：官方调整高级订阅体系并细化限额：新增 Ultra 计划（$200/月，含 $200 API 额度），Max 计划固定为 $100/月（含 $100 API 额度）',
    link: '',
    guid: '',
    pubDate: '',
    description: '新增 Ultra 计划（$200/月，含 $200 API 额度）',
  };
  // 有"新增"强正向词，但包含"订阅"付费订阅语境，不应判为 deal
  assert.equal(classifyKind(ultra), 'change');
});

test('classifyDirection：正向、负向、中性分类', () => {
  assert.equal(
    classifyDirection({ title: '额度变化 · X：免费层新增可用的模型', link: '', guid: '', pubDate: '', description: '' }),
    'positive'
  );
  assert.equal(
    classifyDirection({ title: '额度变化 · X：限时免费活动', link: '', guid: '', pubDate: '', description: '' }),
    'positive'
  );
  assert.equal(
    classifyDirection({ title: '额度变化 · X：StepAudio 3 系列限时免费截止时间顺延至 2026-11-23', link: '', guid: '', pubDate: '', description: '' }),
    'positive'
  );
  assert.equal(
    classifyDirection({ title: '额度变化 · X：官方定价页已改为全部模型按 token 计费，无免费套餐', link: '', guid: '', pubDate: '', description: '' }),
    'negative'
  );
  assert.equal(
    classifyDirection({ title: '额度变化 · X：下架免费模型层', link: '', guid: '', pubDate: '', description: '' }),
    'negative'
  );
  assert.equal(
    classifyDirection({ title: '额度变化 · X：策略调整，文案更新', link: '', guid: '', pubDate: '', description: '' }),
    'neutral'
  );
  // 既有正向又有负向，以负向为准
  assert.equal(
    classifyDirection({ title: '额度变化 · X：新增免费试用但下架旧免费模型', link: '', guid: '', pubDate: '', description: '' }),
    'negative'
  );
});

test('shouldEnterToday：deal / price_change / change 进入，news 不进入', () => {
  assert.equal(shouldEnterToday('deal'), true);
  assert.equal(shouldEnterToday('price_change'), true);
  assert.equal(shouldEnterToday('change'), true);
  assert.equal(shouldEnterToday('news'), false);
});

test('isWithinRecentHours：最近 72 小时内为 true，否则 false', () => {
  const now = new Date();
  const within72h = new Date(now.getTime() - 50 * 60 * 60 * 1000).toISOString(); // 50 小时前
  const over72h = new Date(now.getTime() - 100 * 60 * 60 * 1000).toISOString(); // 100 小时前
  const future = new Date(now.getTime() + 10 * 60 * 60 * 1000).toISOString(); // 未来

  assert.equal(isWithinRecentHours(within72h, RECENT_HOURS_MS), true);
  assert.equal(isWithinRecentHours(over72h, RECENT_HOURS_MS), false);
  assert.equal(isWithinRecentHours(future, RECENT_HOURS_MS), false);
  assert.equal(isWithinRecentHours('invalid-date', RECENT_HOURS_MS), false);
});

test('parseRss 提取变化订阅 item 字段（无 category/source）', () => {
  const items = parseRss(CHANGES_RSS);
  assert.equal(items.length, 7);
  const first = items[0];
  assert.equal(first.title, '额度变化 · Google Gemini：免费层新增可用的 Gemini Decision 1 并公开其限额');
  assert.equal(first.category, undefined);
});

test('deduplicate：按 id 去重，保留首次出现', () => {
  const base: WoolItem = {
    id: 'fli-aaa',
    title: '额度变化 · X：免费试用',
    reward: '免费试用',
    estimatedValue: null,
    estimatedValueRmb: null,
    condition: null,
    category: 'AI 与大模型',
    claimMethod: null,
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
    direction: 'positive',
    hasOfficialLink: false,
  };
  const dup: WoolItem = { ...base, title: '重复标题' };
  const distinct: WoolItem = { ...base, id: 'fli-bbb', sourceUrl: 'https://example.com/y', title: '另一条' };
  const result = deduplicate([base, dup, distinct]);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, base.id);
});
