import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getWoolItems,
  getSourceChannels,
  getDeadlineState,
  formatDeadlineLabel,
  filterAndSortWoolItems,
  buildTelegramDigestText,
  countRecentWoolItems,
} from './woolData';
import { REFERENCE_NOW_ISO } from './testFixtures';
import { MockSource } from './mockSource';

const FIXED_NOW_MS = Date.parse(REFERENCE_NOW_ISO);

test('woolData provides exactly 25 realistic mock items with complete fields', () => {
  const items = getWoolItems(FIXED_NOW_MS);
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
  const items = getWoolItems(FIXED_NOW_MS);

  const verifiedOnly = filterAndSortWoolItems(
    items,
    { verificationStatus: '官方已核验' },
    REFERENCE_NOW_ISO
  );
  assert.ok(verifiedOnly.length > 0);
  assert.ok(verifiedOnly.every((i) => i.verificationStatus === '官方已核验'));

  const expiringOnly = filterAndSortWoolItems(
    items,
    { deadlineFilter: '即将到期' },
    REFERENCE_NOW_ISO
  );
  assert.ok(expiringOnly.length >= 4);
  assert.ok(expiringOnly.every((i) => getDeadlineState(i.deadline, REFERENCE_NOW_ISO) === 'expiring_soon'));

  const expiredOnly = filterAndSortWoolItems(
    items,
    { deadlineFilter: '已过期' },
    REFERENCE_NOW_ISO
  );
  assert.equal(expiredOnly.length, 3);
  assert.ok(expiredOnly.every((i) => getDeadlineState(i.deadline, REFERENCE_NOW_ISO) === 'expired'));

  const codeClaim = filterAndSortWoolItems(
    items,
    { claimMethod: '兑换码激活' },
    REFERENCE_NOW_ISO
  );
  assert.ok(codeClaim.length > 0);
  assert.ok(codeClaim.every((i) => i.claimMethod === '兑换码激活'));
});

test('buildTelegramDigestText renders structured Telegram digest', () => {
  const items = getWoolItems(FIXED_NOW_MS);
  const digest = buildTelegramDigestText(
    items,
    {
      onlyVerified: true,
      includeExpiringSection: true,
      templateStyle: 'detailed',
    },
    REFERENCE_NOW_ISO
  );

  assert.ok(digest.includes('WoolRadar 羊毛雷达 · 今日情报汇总'));
  assert.ok(digest.includes('72h 内即将截止'));
  assert.ok(digest.includes('今日精选已核验羊毛'));
});

test('source channels list is populated', () => {
  const channels = getSourceChannels(FIXED_NOW_MS);
  assert.ok(channels.length >= 6);
  const label = formatDeadlineLabel('2026-11-18T12:00:00+08:00', REFERENCE_NOW_ISO);
  assert.equal(label.state, 'expiring_soon');
});

test('event-driven source keeps item list and channel status in sync', () => {
  const source = new MockSource({ seed: 11 });
  const events: string[] = [];
  source.subscribe((event) => events.push(event.type));

  const initial = source.list();
  assert.equal(initial.items.length, 25);

  // 新增事件：列表立即增加一条，订阅方收到事件
  source.trigger('added');
  assert.equal(source.list().items.length, 26);
  assert.equal(events.at(-1), 'added');

  // 条件变化：列表内对应条目同步更新
  source.trigger('updated');
  assert.equal(events.at(-1), 'updated');

  // 来源失败：渠道状态同步变为异常
  source.trigger('source_failed');
  assert.equal(events.at(-1), 'source_failed');
  assert.ok(source.list().channels.some((channel) => channel.status !== '正常'));

  // 来源恢复：对应渠道状态同步恢复
  source.trigger('source_recovered');
  assert.equal(events.at(-1), 'source_recovered');
  assert.ok(source.list().channels.some((channel) => channel.status === '正常'));

  // 过期：条目截止时间同步进入过去
  source.trigger('expired');
  assert.equal(events.at(-1), 'expired');
});

test('digest title, weekday and generation time follow nowIso across midnight', () => {
  const items = getWoolItems(FIXED_NOW_MS);
  const options = {
    onlyVerified: false,
    includeExpiringSection: true,
    templateStyle: 'detailed' as const,
  };

  const beforeMidnight = buildTelegramDigestText(
    items,
    options,
    '2026-11-18T23:59:00+08:00'
  );
  const afterMidnight = buildTelegramDigestText(
    items,
    options,
    '2026-11-19T00:01:00+08:00'
  );

  assert.ok(beforeMidnight.includes('📅 日期：2026-11-18 星期三'));
  assert.ok(afterMidnight.includes('📅 日期：2026-11-19 星期四'));
  assert.ok(beforeMidnight.includes('🕒 生成时间：2026-11-18 23:59:00'));
  assert.ok(afterMidnight.includes('🕒 生成时间：2026-11-19 00:01:00'));
});

test('digest 24-hour new-item window moves with nowIso', () => {
  const items = getWoolItems(FIXED_NOW_MS);
  const options = {
    onlyVerified: false,
    includeExpiringSection: true,
    templateStyle: 'compact' as const,
  };

  assert.equal(countRecentWoolItems(items, '2026-11-17T14:00:00+08:00'), 12);
  assert.equal(countRecentWoolItems(items, '2026-11-19T14:00:00+08:00'), 0);

  const duringWindow = buildTelegramDigestText(
    items,
    options,
    '2026-11-17T14:00:00+08:00'
  );
  const afterWindow = buildTelegramDigestText(
    items,
    options,
    '2026-11-19T14:00:00+08:00'
  );

  assert.ok(duringWindow.includes('🆕 最近 24 小时新增：12 条'));
  assert.ok(afterWindow.includes('🆕 最近 24 小时新增：0 条'));
});

test('deadline labels recalculate remaining days across month and year boundaries', () => {
  const monthDeadline = '2026-12-31T23:59:00+08:00';
  const beforeMonth = formatDeadlineLabel(
    monthDeadline,
    '2026-11-30T23:59:00+08:00'
  );
  const afterMonth = formatDeadlineLabel(
    monthDeadline,
    '2026-12-01T00:01:00+08:00'
  );

  assert.equal(beforeMonth.state, 'active');
  assert.equal(beforeMonth.badgeText, '剩余 31 天');
  assert.equal(afterMonth.state, 'active');
  assert.equal(afterMonth.badgeText, '剩余 30 天');

  const yearDeadline = '2027-01-02T00:00:00+08:00';
  const beforeYear = formatDeadlineLabel(
    yearDeadline,
    '2026-12-31T23:59:00+08:00'
  );
  const afterYear = formatDeadlineLabel(
    yearDeadline,
    '2027-01-01T00:01:00+08:00'
  );

  assert.equal(beforeYear.state, 'expiring_soon');
  assert.equal(beforeYear.badgeText, '即将到期 · 剩 2 天');
  assert.equal(beforeYear.dateText, '2027-01-02 00:00');
  assert.equal(afterYear.state, 'expiring_soon');
  assert.equal(afterYear.badgeText, '剩 23 小时到期');
});

test('digest never emits the fixed 2026-11-17 date unless nowIso is that day', () => {
  const items = getWoolItems(FIXED_NOW_MS);
  const options = {
    onlyVerified: false,
    includeExpiringSection: true,
    templateStyle: 'detailed' as const,
  };

  const otherDay = buildTelegramDigestText(
    items,
    options,
    '2027-01-01T00:01:00+08:00'
  );
  assert.ok(!otherDay.includes('2026-11-17'));

  const sameDay = buildTelegramDigestText(
    items,
    options,
    '2026-11-17T14:00:00+08:00'
  );
  assert.ok(sameDay.includes('2026-11-17'));
});

test('deadline filtering for push preview follows the same nowIso', () => {
  const items = getWoolItems(FIXED_NOW_MS);
  const november = filterAndSortWoolItems(
    items,
    { deadlineFilter: '有效期内' },
    '2026-11-17T14:00:00+08:00'
  );
  const january = filterAndSortWoolItems(
    items,
    { deadlineFilter: '有效期内' },
    '2027-01-01T00:01:00+08:00'
  );

  assert.ok(november.length > january.length);
  assert.ok(january.every((item) => item.expiresAt === null));
});
