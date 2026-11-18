import test from 'node:test';
import assert from 'node:assert/strict';
import { RealSource } from './realSource';
import type { WoolItem } from './woolData';

function makeWoolItem(overrides: Partial<WoolItem> = {}): WoolItem {
  return {
    id: `fli-test-${Math.random().toString(36).slice(2)}`,
    title: '测试条目',
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
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isNew: false,
    isUpdated: false,
    sourceId: 'src-fli-test',
    sourceName: '测试来源',
    sourceUrl: 'https://example.com',
    steps: [],
    riskNotes: '',
    tags: [],
    hasOfficialLink: false,
    ...overrides,
  };
}

function makeWoolJson(items: WoolItem[]) {
  return {
    source: 'free-llm-intel 公开订阅',
    sourceUrl: 'https://free-llm-intel.aishort.top/',
    fetchedAt: new Date().toISOString(),
    count: items.length,
    items,
  };
}

async function mockFetchWith(
  woolItems: WoolItem[],
  sourcesStatus: number,
  sourcesBody?: unknown
) {
  const origFetch = globalThis.fetch;
  let woolCalled = false;
  let sourcesCalled = false;
  (globalThis as any).fetch = async (url: string) => {
    const u = String(url);
    if (u.endsWith('/data/wool.json')) {
      woolCalled = true;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => makeWoolJson(woolItems),
      } as Response;
    }
    if (u.endsWith('/data/sources.json')) {
      sourcesCalled = true;
      return {
        ok: sourcesStatus >= 200 && sourcesStatus < 300,
        status: sourcesStatus,
        statusText: sourcesStatus >= 200 && sourcesStatus < 300 ? 'OK' : 'Not Found',
        json: async () => sourcesBody,
      } as Response;
    }
    throw new Error(`unexpected fetch: ${u}`);
  };
  return { origFetch, woolCalled, sourcesCalled };
}

test('realSource: sources.json 404 时 wool 条目仍正常显示，channels 为空', async () => {
  const items = Array.from({ length: 66 }, () => makeWoolItem());
  const { origFetch } = await mockFetchWith(items, 404);

  try {
    const source = new RealSource();
    await source.refresh();

    const snapshot = source.list();
    assert.equal(snapshot.items.length, 66, 'wool 条目应仍显示 66 条');
    assert.equal(snapshot.channels.length, 0, 'sources.json 404 时 channels 应为空');

    const status = source.getStatus();
    assert.equal(status.ok, true);
    assert.equal(status.count, 66);
    assert.equal(status.error, null);
    assert.ok(status.fetchedAt, 'fetchedAt 应不为 null');
  } finally {
    (globalThis as any).fetch = origFetch;
  }
});

test('realSource: sources.json 正常时 channels 与 items 都有数据', async () => {
  const items = Array.from({ length: 66 }, () => makeWoolItem());
  const sources = [
    {
      id: 'src-fli-changes',
      name: '免费额度/活动变化',
      type: '额度/活动变化',
      url: 'https://free-llm-intel.aishort.top/feeds/llm-intel-changes.xml',
      entryCount: 66,
      fetchedAt: new Date().toISOString(),
    },
  ];
  const { origFetch } = await mockFetchWith(items, 200, {
    source: 'free-llm-intel 公开订阅',
    sourceUrl: 'https://free-llm-intel.aishort.top/',
    fetchedAt: new Date().toISOString(),
    count: 1,
    sources,
  });

  try {
    const source = new RealSource();
    await source.refresh();

    const snapshot = source.list();
    assert.equal(snapshot.items.length, 66);
    assert.equal(snapshot.channels.length, 1);
    assert.equal(snapshot.channels[0].id, 'src-fli-changes');
    assert.equal(snapshot.channels[0].entryCount, 66);
  } finally {
    (globalThis as any).fetch = origFetch;
  }
});
