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
  scoreLinkText,
  selectOfficialLink,
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

test('classifyKind：deal 仅用于新增免费层/赠金/试用/限时免费，且标题不含否定词', () => {
  const freeTier = { title: '额度变化 · X：免费层新增可用的模型', link: '', guid: '', pubDate: '', description: '免费层新增' };
  assert.equal(classifyKind(freeTier), 'deal');

  const trial = { title: '额度变化 · X：新增 30 天免费试用', link: '', guid: '', pubDate: '', description: '免费试用' };
  assert.equal(classifyKind(trial), 'deal');

  const credit = { title: '额度变化 · X：新增 $500 Credits', link: '', guid: '', pubDate: '', description: '赠金' };
  assert.equal(classifyKind(credit), 'deal');

  const limited = { title: '额度变化 · X：限时免费活动', link: '', guid: '', pubDate: '', description: '限时免费' };
  assert.equal(classifyKind(limited), 'deal');

  const launch = { title: '额度变化 · X：新产品正式上线', link: '', guid: '', pubDate: '', description: '上线' };
  assert.equal(classifyKind(launch), 'deal');

  const gift = { title: '额度变化 · X：新用户注册赠送 $10 代金券', link: '', guid: '', pubDate: '', description: '赠送' };
  assert.equal(classifyKind(gift), 'deal');

  // 否定词：未变
  assert.equal(
    classifyKind({ title: '额度变化 · Morph Labs：免费层「每月 200 次请求」与首充送 $5 未变', link: '', guid: '', pubDate: '', description: '未变' }),
    'change'
  );
  // 否定词：仍维持
  assert.equal(
    classifyKind({ title: '额度变化 · X：免费层「每月 200 次请求」与首充送 $5 仍维持', link: '', guid: '', pubDate: '', description: '仍维持' }),
    'change'
  );
  // 否定词：微调
  assert.equal(
    classifyKind({ title: '额度变化 · Together AI：输入计费微调为 $0.042/1M tokens', link: '', guid: '', pubDate: '', description: '微调' }),
    'price_change'
  );
  // 否定词：不变
  assert.equal(
    classifyKind({ title: '额度变化 · X：免费额度保持不变', link: '', guid: '', pubDate: '', description: '不变' }),
    'change'
  );
  // 否定词：更名
  assert.equal(
    classifyKind({ title: '额度变化 · Parallel Web API：免费档由「Developer」更名为「Build」', link: '', guid: '', pubDate: '', description: '更名' }),
    'price_change'
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
  // "付费" 匹配价格变动关键词，应为 price_change（不是 deal）
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

test('shouldEnterToday：deal / price_change / change 进入，news 不进入', () => {
  assert.equal(shouldEnterToday('deal'), true);
  assert.equal(shouldEnterToday('price_change'), true);
  assert.equal(shouldEnterToday('change'), true);
  assert.equal(shouldEnterToday('news'), false);
});

test('scoreLinkText：正向关键词加分，负向关键词扣分', () => {
  assert.equal(scoreLinkText('定价文档（人民币峰谷价）'), 2);
  assert.equal(scoreLinkText('免费额度官方文档'), 4); // 免费额度 +2, 官方文档 +2
  assert.equal(scoreLinkText('更新日志'), 2);
  assert.equal(scoreLinkText('API Key 管理'), -3);
  assert.equal(scoreLinkText('模型服务控制台'), -3);
  assert.equal(scoreLinkText('登录'), -3);
  assert.equal(scoreLinkText('定价页面 ｜ API Key 设置'), -1); // 定价 +2, API Key -3
  assert.equal(scoreLinkText('普通链接'), 0);
});

test('selectOfficialLink：API Key 链接被排除，回退到官方主页', () => {
  return fetchReadmeVendors().then((vendorMap) => {
    // Together AI：官方直达行有 "API Key 设置直达"（-3 分）和 "定价页面"（+2 分）
    // 最高分 > 0，应选定价页面（API Key 链接被降价排除）
    const together = selectOfficialLink('Together AI', vendorMap);
    assert.ok(together);
    assert.equal(together.text, '定价页面');
    assert.equal(together.url, 'https://www.together.ai/pricing');

    // Gemini Enterprise：应命中包含“定价”的正分链接
    const geminiEnterprise = selectOfficialLink('Google Gemini Enterprise', vendorMap);
    assert.ok(geminiEnterprise);
    assert.ok(geminiEnterprise.url.includes('pricing'), `期望 pricing 链接，实际：${geminiEnterprise.url}`);

    // Parallel Web API：应命中包含“定价”的正分链接
    const parallel = selectOfficialLink('Parallel Web API', vendorMap);
    assert.ok(parallel);
    assert.ok(parallel.url.includes('pricing'), `期望 pricing 链接，实际：${parallel.url}`);

    // MOSS：无正分链接，应回退到第一个不含负向关键词的链接（模型列表）
    const moss = selectOfficialLink('复旦 MOSS (MOSI)', vendorMap);
    assert.ok(moss);
    assert.ok(
      moss.url.includes('platform.mosi.cn') || moss.url.includes('platform.moss.cn'),
      `期望 mosi.cn 链接，实际：${moss.url}`
    );
    assert.equal(moss.text, '模型列表（官方全文，含计费标准）');

    // 不存在的厂商
    const unknown = selectOfficialLink('不存在的厂商 XXXX', vendorMap);
    assert.equal(unknown, null);
  });
});

test('parseRss 提取变化订阅 item 字段（无 category/source）', () => {
  const items = parseRss(CHANGES_RSS);
  assert.equal(items.length, 6);
  const first = items[0];
  assert.equal(first.title, '额度变化 · Google Gemini：免费层新增可用的 Gemini Decision 1 并公开其限额');
  assert.equal(first.category, undefined);
});

test('deduplicate：按 id 去重，保留首次出现', () => {
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
