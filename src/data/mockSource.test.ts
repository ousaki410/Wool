import test from 'node:test';
import assert from 'node:assert/strict';
import { MockSource } from './mockSource';
import type { WoolSourceEvent } from './source';

test('mock source starts from the 25 seed items and 8 channels', () => {
  const source = new MockSource({ seed: 1 });
  const snapshot = source.list();
  assert.equal(snapshot.items.length, 25);
  assert.equal(snapshot.channels.length, 8);
  assert.ok(snapshot.items.every((i) => i.id.startsWith('WR-2026-')));
});

test('added event appends an item and notifies subscribers', () => {
  const source = new MockSource({ seed: 2 });
  const events: WoolSourceEvent[] = [];
  source.subscribe((event) => events.push(event));

  source.trigger('added');

  const snapshot = source.list();
  assert.equal(snapshot.items.length, 26);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'added');
  assert.ok(events[0].itemId);
  assert.equal(events[0].item?.isNew, true);

  const added = snapshot.items.find((i) => i.id === events[0].itemId);
  assert.ok(added);
  assert.equal(added?.isNew, true);
  assert.ok(added?.createdAt);
});

test('updated event changes condition/reward and marks isUpdated', () => {
  const source = new MockSource({ seed: 3 });
  const events: WoolSourceEvent[] = [];
  source.subscribe((event) => events.push(event));

  source.trigger('updated');

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'updated');
  const updated = source.list().items.find((i) => i.id === events[0].itemId);
  assert.ok(updated);
  assert.equal(updated?.isUpdated, true);
  assert.ok(updated?.condition.endsWith('（已调整）'));
  assert.ok(updated?.reward.endsWith('· 已更新'));
});

test('expired event moves expiresAt into the past for a live item', () => {
  const source = new MockSource({ seed: 4 });
  const events: WoolSourceEvent[] = [];
  source.subscribe((event) => events.push(event));

  source.trigger('expired');

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'expired');
  const expired = source.list().items.find((i) => i.id === events[0].itemId);
  assert.ok(expired);
  assert.ok(expired?.expiresAt);
  assert.ok(new Date(expired!.expiresAt!).getTime() < Date.now());
  // 过渡别名与规范字段保持同步
  assert.equal(expired?.deadline, expired?.expiresAt);
});

test('source failure and recovery update channel status synchronously', () => {
  const source = new MockSource({ seed: 5 });
  const events: WoolSourceEvent[] = [];
  source.subscribe((event) => events.push(event));

  const before = source.list().channels.filter((c) => c.status === '正常').length;

  source.trigger('source_failed');
  const failedEvent = events.at(-1);
  assert.equal(failedEvent?.type, 'source_failed');
  const failedChannel = source
    .list()
    .channels.find((c) => c.id === failedEvent?.sourceId);
  assert.ok(failedChannel);
  assert.notEqual(failedChannel?.status, '正常');
  const afterFailure = source.list().channels.filter((c) => c.status === '正常').length;
  assert.equal(afterFailure, before - 1);

  source.trigger('source_recovered');
  const recoveredEvent = events.at(-1);
  assert.equal(recoveredEvent?.type, 'source_recovered');
  const recoveredChannel = source
    .list()
    .channels.find((c) => c.id === recoveredEvent?.sourceId);
  assert.equal(recoveredChannel?.status, '正常');
  const afterRecovery = source.list().channels.filter((c) => c.status === '正常').length;
  assert.equal(afterRecovery, before);
});

test('pause/resume only affects automatic events, manual trigger still works', () => {
  const source = new MockSource({ seed: 6 });
  assert.equal(source.isPaused(), false);

  source.pause();
  assert.equal(source.isPaused(), true);

  // 手动触发在暂停状态下仍然可用
  const type = source.trigger('added');
  assert.equal(type, 'added');
  assert.equal(source.list().items.length, 26);

  source.resume();
  assert.equal(source.isPaused(), false);
});

test('same seed produces a deterministic event sequence', () => {
  const a = new MockSource({ seed: 20261117 });
  const b = new MockSource({ seed: 20261117 });

  const typesA: string[] = [];
  const typesB: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    typesA.push(a.trigger());
    typesB.push(b.trigger());
  }

  assert.deepEqual(typesA, typesB);
});

test('unsubscribe stops receiving events', () => {
  const source = new MockSource({ seed: 7 });
  let count = 0;
  const unsubscribe = source.subscribe(() => {
    count += 1;
  });

  source.trigger('source_failed');
  assert.equal(count, 1);

  unsubscribe();
  source.trigger('source_recovered');
  assert.equal(count, 1);
});

test('markViewed fades the new/updated marker for that item', () => {
  const source = new MockSource({ seed: 8 });
  const events: WoolSourceEvent[] = [];
  source.subscribe((event) => events.push(event));

  source.trigger('added');
  const id = events[0].itemId!;
  assert.equal(source.isFaded(id), false);
  source.markViewed(id);
  assert.equal(source.isFaded(id), true);
});
