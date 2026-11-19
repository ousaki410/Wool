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
  assert.ok(!keywords.includes('额度变化'), '分类前缀不应作为关键事实');
});

test('findEvidenceMatches 保存命中位置前后各 80 字原文', () => {
  const text = `${'甲'.repeat(100)}免费额度${'乙'.repeat(100)}`;
  const matches = findEvidenceMatches('额度变化 · Example：免费额度', text);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].keyword, '免费额度');
  assert.ok(matches[0].snippet.includes('甲'.repeat(80)));
  assert.ok(matches[0].snippet.includes('乙'.repeat(80)));
  assert.ok(matches[0].snippet.startsWith('…'));
  assert.ok(matches[0].snippet.endsWith('…'));
});

test('页面命中关键事实时为“有证据”', () => {
  const text = `${'背景'.repeat(60)}新用户注册即赠送 $5，免费额度每月 200 次。${'补充'.repeat(60)}`;
  const result = evaluateEvidence(TITLE, page(text));

  assert.equal(result.status, '有证据');
  assert.ok(result.matches.length > 0);
  assert.ok(result.matches.every((match) => match.snippet.length > 0));
});

test('页面可打开但未命中时为“证据不足”，且绝不输出“有证据”', () => {
  const texts = [
    '欢迎访问 Example AI 官方网站。我们提供企业级模型与技术支持。',
    '',
    'Contact sales for enterprise deployment.',
  ];

  for (const text of texts) {
    const result = evaluateEvidence(TITLE, page(text));
    assert.equal(result.matches.length, 0);
    assert.equal(result.status, '证据不足');
    assert.notEqual(result.status, '有证据');
  }
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
