import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRobotsTxt } from '../../scripts/verify-sources';

const USER_AGENT =
  'WoolRadarEvidenceBot/1.0 (+https://github.com/ousaki410/Wool)';

test('robots.txt: 优先使用匹配当前 User-Agent 的规则组', () => {
  const robots = `
User-agent: *
Disallow: /

User-agent: WoolRadarEvidenceBot
Disallow: /private
Allow: /private/public
Crawl-delay: 2
`;

  const allowed = parseRobotsTxt(
    robots,
    USER_AGENT,
    '/private/public/pricing'
  );
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.crawlDelayMs, 2000);

  const denied = parseRobotsTxt(robots, USER_AGENT, '/private/secret');
  assert.equal(denied.allowed, false);
});

test('robots.txt: 无匹配规则或空 Disallow 时允许抓取', () => {
  assert.deepEqual(
    parseRobotsTxt('User-agent: Googlebot\nDisallow: /', USER_AGENT, '/pricing'),
    { allowed: true, crawlDelayMs: null }
  );
  assert.deepEqual(
    parseRobotsTxt('User-agent: *\nDisallow:', USER_AGENT, '/pricing'),
    { allowed: true, crawlDelayMs: null }
  );
});

test('robots.txt: 最长匹配优先，同长度 Allow 覆盖 Disallow', () => {
  const robots = `
User-agent: *
Disallow: /docs/
Allow: /docs/pricing
Disallow: /docs/pricing/legacy
`;
  assert.equal(parseRobotsTxt(robots, USER_AGENT, '/docs/pricing').allowed, true);
  assert.equal(
    parseRobotsTxt(robots, USER_AGENT, '/docs/pricing/legacy').allowed,
    false
  );
  assert.equal(parseRobotsTxt(robots, USER_AGENT, '/docs/other').allowed, false);
});
