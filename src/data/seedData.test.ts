import test from 'node:test';
import assert from 'node:assert/strict';
import { MockSource } from './mockSource';
import { countRecentWoolItems, getDeadlineState } from './woolData';
import {
  SOURCE_CHANNEL_SEEDS,
  WOOL_SEED_ITEMS,
  materializeSeedData,
} from './woolSeed';

const HOUR_MS = 60 * 60 * 1000;
const LOAD_TIMES = [
  '2026-12-02T09:30:00+08:00',
  '2027-03-15T23:01:00+08:00',
];

function snapshotAt(iso: string) {
  const nowMs = Date.parse(iso);
  const source = new MockSource({ seed: 1, clock: () => nowMs });
  const { items, channels } = source.list();
  const nowIso = source.nowIso();

  const expiring = items.filter(
    (item) => getDeadlineState(item.expiresAt, nowIso) === 'expiring_soon'
  );
  const expired = items.filter(
    (item) => getDeadlineState(item.expiresAt, nowIso) === 'expired'
  );
  const expiringWithin24h = expiring.filter(
    (item) =>
      Date.parse(item.expiresAt!) - Date.parse(nowIso) <= 24 * HOUR_MS
  );

  return {
    source,
    nowIso,
    items,
    channels,
    expiringCount: expiring.length,
    expiringWithin24hCount: expiringWithin24h.length,
    expiredCount: expired.length,
    recent24hCount: countRecentWoolItems(items, nowIso),
  };
}

test('seed demo keeps the same deadline structure at different load times', () => {
  const snapshots = LOAD_TIMES.map(snapshotAt);

  for (const snapshot of snapshots) {
    assert.ok(snapshot.expiringCount >= 6);
    assert.ok(snapshot.expiringWithin24hCount >= 1);
    assert.ok(snapshot.expiredCount >= 2 && snapshot.expiredCount <= 3);
    assert.ok(snapshot.recent24hCount >= 3);

    const types = new Set(snapshot.channels.map((channel) => channel.type));
    assert.ok(types.has('官方公告'));
    assert.ok(types.has('技术社区'));
    assert.ok(types.has('聚合频道'));
  }

  const structure = (snapshot: ReturnType<typeof snapshotAt>) => ({
    expiring: snapshot.expiringCount,
    expiringWithin24h: snapshot.expiringWithin24hCount,
    expired: snapshot.expiredCount,
    recent24h: snapshot.recent24hCount,
  });

  assert.deepEqual(structure(snapshots[0]), structure(snapshots[1]));
});

test('materialized seed data never contains the fixed 2026-11-17 date', () => {
  for (const iso of LOAD_TIMES) {
    const snapshot = snapshotAt(iso);
    const serialized = JSON.stringify({
      items: snapshot.items,
      channels: snapshot.channels,
    });

    assert.ok(!serialized.includes('2026-11-17'));
    assert.ok(!serialized.includes('11月17日'));
    assert.ok(!serialized.includes('11/17'));
  }
});

test('seed definitions store only relative time offsets', () => {
  for (const item of WOOL_SEED_ITEMS) {
    assert.ok(item.publishedAtOffsetHours < 0);
    assert.ok(
      item.expiresInHours === null || Number.isFinite(item.expiresInHours)
    );
    assert.ok(!('publishedAt' in item));
    assert.ok(!('expiresAt' in item));
    assert.ok(!('deadline' in item));
  }

  for (const channel of SOURCE_CHANNEL_SEEDS) {
    assert.ok(channel.lastSyncOffsetMinutes >= 0);
    assert.ok(!('lastSyncAt' in channel));
  }
});

test('nowIso comes from the data source clock', () => {
  const fixedMs = Date.parse('2028-02-29T23:59:00+08:00');
  const source = new MockSource({ clock: () => fixedMs });

  assert.equal(source.nowIso(), new Date(fixedMs).toISOString());

  const materialized = materializeSeedData(fixedMs);
  assert.ok(
    !JSON.stringify(materialized).includes('2026-11-17')
  );
});
