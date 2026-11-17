import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getWoolItems,
  getSourceChannels,
  getDeadlineState,
  formatDeadlineLabel,
  filterAndSortWoolItems,
  buildTelegramDigestText,
  REFERENCE_NOW_ISO,
} from './woolData';

test('woolData provides exactly 25 realistic mock items with complete fields', () => {
  const items = getWoolItems();
  assert.equal(items.length, 25);

  for (const item of items) {
    assert.ok(item.id.startsWith('WR-2026-'));
    assert.ok(item.title.length > 0);
    assert.ok(item.reward.length > 0);
    assert.ok(item.condition.length > 0);
    assert.ok(['官方已核验', '社区线索', '未核验'].includes(item.verificationStatus));
    assert.ok(item.steps.length > 0);
  }
});

test('getDeadlineState distinguishes expiring_soon, active, long_term, and expired', () => {
  assert.equal(getDeadlineState(null, REFERENCE_NOW_ISO), 'long_term');
  assert.equal(getDeadlineState('2026-11-18T12:00:00+08:00', REFERENCE_NOW_ISO), 'expiring_soon');
  assert.equal(getDeadlineState('2026-11-30T23:59:59+08:00', REFERENCE_NOW_ISO), 'active');
  assert.equal(getDeadlineState('2026-11-12T23:59:59+08:00', REFERENCE_NOW_ISO), 'expired');
});

test('filterAndSortWoolItems filters by category, claimMethod, deadlineFilter, and verificationStatus', () => {
  const items = getWoolItems();

  const verifiedOnly = filterAndSortWoolItems(items, {
    verificationStatus: '官方已核验',
  });
  assert.ok(verifiedOnly.length > 0);
  assert.ok(verifiedOnly.every((i) => i.verificationStatus === '官方已核验'));

  const expiringOnly = filterAndSortWoolItems(items, {
    deadlineFilter: '即将到期',
  });
  assert.ok(expiringOnly.length >= 4);
  assert.ok(expiringOnly.every((i) => getDeadlineState(i.deadline) === 'expiring_soon'));

  const expiredOnly = filterAndSortWoolItems(items, {
    deadlineFilter: '已过期',
  });
  assert.equal(expiredOnly.length, 4);
  assert.ok(expiredOnly.every((i) => getDeadlineState(i.deadline) === 'expired'));

  const codeClaim = filterAndSortWoolItems(items, {
    claimMethod: '兑换码激活',
  });
  assert.ok(codeClaim.length > 0);
  assert.ok(codeClaim.every((i) => i.claimMethod === '兑换码激活'));
});

test('buildTelegramDigestText renders structured Telegram digest', () => {
  const items = getWoolItems();
  const digest = buildTelegramDigestText(items, {
    onlyVerified: true,
    includeExpiringSection: true,
    templateStyle: 'detailed',
  });

  assert.ok(digest.includes('WoolRadar 羊毛雷达 · 今日情报汇总'));
  assert.ok(digest.includes('72h 内即将截止'));
  assert.ok(digest.includes('今日精选已核验羊毛'));
});

test('source channels list is populated', () => {
  const channels = getSourceChannels();
  assert.ok(channels.length >= 6);
  const label = formatDeadlineLabel('2026-11-18T12:00:00+08:00', REFERENCE_NOW_ISO);
  assert.equal(label.state, 'expiring_soon');
});
