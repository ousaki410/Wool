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
  sourcesBody?: unknown,
  evidenceStatus = 404,
  evidenceBody?: unknown,
  verifiedStatus = 404,
  verifiedBody?: unknown
) {
  const origFetch = globalThis.fetch;
  let woolCalled = false;
  let sourcesCalled = false;
  let evidenceCalled = false;
  let verifiedCalled = false;
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
    if (u.endsWith('/data/evidence.json')) {
      evidenceCalled = true;
      return {
        ok: evidenceStatus >= 200 && evidenceStatus < 300,
        status: evidenceStatus,
        statusText: evidenceStatus >= 200 && evidenceStatus < 300 ? 'OK' : 'Not Found',
        json: async () => evidenceBody,
      } as Response;
    }
    if (u.endsWith('/data/verified.json')) {
      verifiedCalled = true;
      return {
        ok: verifiedStatus >= 200 && verifiedStatus < 300,
        status: verifiedStatus,
        statusText: verifiedStatus >= 200 && verifiedStatus < 300 ? 'OK' : 'Not Found',
        json: async () => verifiedBody,
      } as Response;
    }
    throw new Error(`unexpected fetch: ${u}`);
  };
  return {
    origFetch,
    get woolCalled() {
      return woolCalled;
    },
    get sourcesCalled() {
      return sourcesCalled;
    },
    get evidenceCalled() {
      return evidenceCalled;
    },
    get verifiedCalled() {
      return verifiedCalled;
    },
  };
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

test('realSource: evidence.json 正常时条目挂载存证，但不改变核验状态', async () => {
  const items = [
    makeWoolItem({
      id: 'fli-evidence-test',
      hasOfficialLink: true,
      verificationStatus: '未核验',
    }),
  ];
  const evidence = {
    generatedAt: new Date().toISOString(),
    count: 1,
    statusCounts: { 强命中: 1, 弱相关: 0, 页面未提及: 0, 无法访问: 0 },
    records: [
      {
        itemId: 'fli-evidence-test',
        title: '测试条目',
        sourceName: '测试来源',
        sourceUrl: 'https://example.com',
        fetchedAt: new Date().toISOString(),
        httpStatus: 200,
        finalUrl: 'https://example.com',
        textHash: 'abc123',
        status: '强命中',
        matches: [
          {
            keyword: '免费额度',
            snippet: '新用户可领取免费额度',
            strength: 'weak',
          },
        ],
      },
    ],
  };
  const { origFetch } = await mockFetchWith(items, 404, undefined, 200, evidence);

  try {
    const source = new RealSource();
    await source.refresh();

    const snapshot = source.list();
    assert.equal(snapshot.items.length, 1);
    assert.equal(snapshot.items[0].evidence?.status, '强命中');
    assert.equal(snapshot.items[0].evidence?.matches[0].snippet, '新用户可领取免费额度');
    assert.equal(
      snapshot.items[0].verificationStatus,
      '未核验',
      '存证不得自动升级核验状态'
    );
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

test('realSource: verified.json 404 时条目仍然显示，状态都是未核验', async () => {
  const items = [
    makeWoolItem({
      id: 'fli-no-verified',
      title: '额度变化 · Example AI：免费层新增每月 200 次请求',
      sourceUrl: 'https://example.com/pricing',
    }),
  ];
  const mock = await mockFetchWith(items, 404);

  try {
    const source = new RealSource();
    await source.refresh();

    const snapshot = source.list();
    assert.equal(mock.verifiedCalled, true, '应尝试加载 verified.json');
    assert.equal(snapshot.items.length, 1);
    assert.equal(snapshot.items[0].verificationStatus, '未核验');
    assert.equal(snapshot.items[0].verification, null);
    assert.equal(snapshot.items[0].verificationIssue, null);
  } finally {
    (globalThis as any).fetch = mock.origFetch;
  }
});

test('realSource: verified.json 有效记录升级为官方已核验并附确认信息', async () => {
  const title = '额度变化 · Example AI：免费层新增每月 200 次请求';
  const sourceUrl = 'https://example.com/pricing';
  const items = [makeWoolItem({ id: 'fli-valid-verified', title, sourceUrl })];
  const record = {
    itemId: 'fli-valid-verified',
    titleSnapshot: title,
    officialUrl: sourceUrl,
    quote: '新用户注册即赠送每月 200 次免费请求。',
    note: '已在官方定价页核对',
    confirmedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    confirmedBy: '测试确认人',
    revokedAt: null,
  };
  const { origFetch } = await mockFetchWith(
    items,
    404,
    undefined,
    404,
    undefined,
    200,
    { version: 1, records: [record] }
  );

  try {
    const source = new RealSource();
    await source.refresh();

    const snapshot = source.list();
    assert.equal(snapshot.items[0].verificationStatus, '官方已核验');
    assert.deepEqual(snapshot.items[0].verification, {
      confirmedAt: record.confirmedAt,
      confirmedBy: '测试确认人',
      quote: record.quote,
      note: record.note,
      officialUrl: sourceUrl,
    });
    assert.equal(snapshot.items[0].verificationIssue, null);
  } finally {
    (globalThis as any).fetch = origFetch;
  }
});

test('realSource: verified.json 中标题变化的记录不升级，并给出失效原因', async () => {
  const items = [
    makeWoolItem({
      id: 'fli-stale-verified',
      title: '额度变化 · Example AI：免费层新增每月 200 次请求',
      sourceUrl: 'https://example.com/pricing',
    }),
  ];
  const record = {
    itemId: 'fli-stale-verified',
    titleSnapshot: '额度变化 · Example AI：免费层新增每月 100 次请求',
    officialUrl: 'https://example.com/pricing',
    quote: '新用户注册即赠送每月 200 次免费请求。',
    note: '',
    confirmedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    confirmedBy: '测试确认人',
    revokedAt: null,
  };
  const { origFetch } = await mockFetchWith(
    items,
    404,
    undefined,
    404,
    undefined,
    200,
    { version: 1, records: [record] }
  );

  try {
    const source = new RealSource();
    await source.refresh();

    const snapshot = source.list();
    assert.equal(snapshot.items[0].verificationStatus, '未核验');
    assert.equal(snapshot.items[0].verification, null);
    assert.equal(snapshot.items[0].verificationIssue?.reason, '标题已变化');
  } finally {
    (globalThis as any).fetch = origFetch;
  }
});
