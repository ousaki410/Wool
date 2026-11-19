import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateEvidence,
  extractKeywords,
  findEvidenceMatches,
  htmlToText,
  type PageEvidenceInput,
} from './evidence';

const TITLE =
  '额度变化 · Example AI：免费额度新增每月 200 次请求，注册赠送 $5';

function page(
  text: string,
  overrides: Partial<PageEvidenceInput> = {}
): PageEvidenceInput {
  return {
    httpStatus: 200,
    finalUrl: 'https://example.com/pricing',
    text,
    textHash: 'hash',
    ...overrides,
  };
}

test('extractKeywords 去掉标题前缀并识别关键事实', () => {
  const keywords = extractKeywords(TITLE);
  assert.ok(keywords.includes('免费额度'));
  assert.ok(keywords.includes('赠送'));
  assert.ok(keywords.includes('每月额度'));
  assert.ok(keywords.includes('领取条件'));
  assert.ok(keywords.includes('$5'), '金额应作为具体事实');
  assert.ok(keywords.includes('200 次'), '带单位数字应作为具体事实');
  assert.ok(!keywords.includes('额度变化'), '分类前缀不应作为关键事实');
});

test('findEvidenceMatches 保存命中位置前后各 80 字原文', () => {
  const text = `${'甲'.repeat(100)}免费额度${'乙'.repeat(100)}`;
  const matches = findEvidenceMatches('额度变化 · Example：免费额度', text);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].keyword, '免费额度');
  assert.equal(matches[0].strength, 'weak');
  assert.ok(matches[0].snippet.includes('甲'.repeat(80)));
  assert.ok(matches[0].snippet.includes('乙'.repeat(80)));
  assert.ok(matches[0].snippet.startsWith('…'));
  assert.ok(matches[0].snippet.endsWith('…'));
});

test('英文短词按单词边界匹配：freedom 不命中 free', () => {
  const matches = findEvidenceMatches(
    '额度变化 · Example：免费额度',
    'Freedom of speech is protected. No pricing here.'
  );

  assert.equal(matches.length, 0, 'freedom 中的 free 不应被当作命中');
});

test('标题里的 freedom 也不会被当作 free 关键事实', () => {
  const title = '额度变化 · Example：Freedom plan announcement';
  assert.ok(!extractKeywords(title).includes('免费额度'));

  const result = evaluateEvidence(title, page('Plans include a free tier.'));
  assert.equal(result.status, '页面未提及');
});

test('仅通用词命中时为“弱相关”', () => {
  const matches = findEvidenceMatches(
    '额度变化 · Example：免费额度与限速',
    'Plans include a free tier with a quota limit.'
  );
  assert.ok(matches.length > 0);
  assert.ok(matches.every((match) => match.strength === 'weak'));

  const result = evaluateEvidence(
    '额度变化 · Example：免费额度与限速',
    page('Plans include a free tier with a quota limit.')
  );
  assert.equal(result.status, '弱相关');
});

test('具体金额命中时为“强命中”，$5 不会命中 $50', () => {
  const title = '额度变化 · Example：注册赠送 $5';
  const strong = evaluateEvidence(title, page('Sign up and receive $5 in credits.'));
  assert.equal(strong.status, '强命中');
  assert.ok(strong.matches.some((match) => match.strength === 'strong'));

  const wrongNumber = evaluateEvidence(title, page('Receive $50 in credits.'));
  assert.equal(wrongNumber.status, '页面未提及');
  assert.ok(wrongNumber.matches.every((match) => match.strength !== 'strong'));
});

test('具体数字/日期命中时为“强命中”', () => {
  const result = evaluateEvidence(
    '额度变化 · Example：每月 200 次请求，活动截止 2026-11-30',
    page('免费层：每月 200 次请求。活动截止 2026-11-30。')
  );

  assert.equal(result.status, '强命中');
  assert.ok(result.matches.some((match) => match.strength === 'strong'));
  assert.ok(
    result.matches.filter((match) => match.strength === 'strong').length >= 2,
    '数字与日期命中应优先保留'
  );
});

test('不会把完整日期拆成“11 月”等片段造成强命中', () => {
  const title = '额度变化 · Example：明确将于 2026 年 11 月 1 日起开始收费';
  assert.ok(extractKeywords(title).includes('2026 年 11 月 1 日'));
  assert.ok(!extractKeywords(title).includes('11 月'));

  const result = evaluateEvidence(
    title,
    page('自北京时间 2026 年 11 月 18 日 12:00 起，调用模型开始计费。')
  );
  assert.ok(
    result.matches.every((match) => match.keyword !== '11 月'),
    '标题中的具体日期不应退化为仅命中月份'
  );
  assert.notEqual(result.status, '强命中');
});

test('数字/金额后紧跟英文句号时仍能命中', () => {
  assert.equal(
    evaluateEvidence('额度变化 · Example：注册赠送 $5', page('Receive $5.'))
      .status,
    '强命中'
  );
  assert.equal(
    evaluateEvidence('额度变化 · Example：活动截止 2026-11-30', page('Offer ends 2026-11-30.'))
      .status,
    '强命中'
  );
});

test('$5 也不会命中 $5.50 或 $5,000', () => {
  const title = '额度变化 · Example：注册赠送 $5';
  for (const text of ['Receive $5.50 in credits.', 'Receive $5,000 in credits.']) {
    const result = evaluateEvidence(title, page(text));
    assert.notEqual(result.status, '强命中', text);
  }
});

test('页面可打开但没有命中时为“页面未提及”，绝不输出“强命中”', () => {
  const texts = [
    '欢迎访问 Example AI 官方网站。我们提供企业级模型与技术支持。',
    '',
    'Contact sales for enterprise deployment.',
  ];

  for (const text of texts) {
    const result = evaluateEvidence(TITLE, page(text));
    assert.equal(result.matches.length, 0);
    assert.equal(result.status, '页面未提及');
    assert.notEqual(result.status, '强命中');
  }
});

test('没有命中片段时即便标题含数字也不会输出“强命中”', () => {
  const result = evaluateEvidence(
    '额度变化 · Example：每月 200 次请求',
    page('Welcome to our website.')
  );

  assert.equal(result.matches.length, 0);
  assert.notEqual(result.status, '强命中');
});

test('超时、4xx、5xx 或没有响应时为“无法访问”', () => {
  assert.equal(evaluateEvidence(TITLE, null).status, '无法访问');
  assert.equal(
    evaluateEvidence(TITLE, page('', { httpStatus: 404 })).status,
    '无法访问'
  );
  assert.equal(
    evaluateEvidence(TITLE, page('内部错误', { httpStatus: 500 })).status,
    '无法访问'
  );
});

test('htmlToText 移除脚本样式并解码常见实体', () => {
  const html = `<!doctype html><html><head>
    <style>.x { color: red; }</style>
    <script>alert('x')</script>
  </head><body><h1>免费额度</h1><p>赠送 &amp; 试用&nbsp;活动</p></body></html>`;

  assert.equal(htmlToText(html), '免费额度 赠送 & 试用 活动');
});
