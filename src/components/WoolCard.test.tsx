import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { EvidenceRecord } from '../data/evidence';
import type { WoolItem } from '../data/woolData';

function makeItem(overrides: Partial<WoolItem> = {}): WoolItem {
  return {
    id: 'fli-card-test',
    title: '额度变化 · Example AI：免费额度新增每月 200 次请求',
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
    publishedAt: '2026-11-18T00:00:00.000Z',
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
    isNew: false,
    isUpdated: false,
    sourceId: 'src-fli-example',
    sourceName: 'Example AI',
    sourceUrl: 'https://example.com/pricing',
    steps: [],
    riskNotes: '',
    tags: [],
    hasOfficialLink: true,
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    itemId: 'fli-card-test',
    title: '额度变化 · Example AI：免费额度新增每月 200 次请求',
    sourceName: 'Example AI',
    sourceUrl: 'https://example.com/pricing',
    fetchedAt: '2026-11-19T03:00:00.000Z',
    httpStatus: 200,
    finalUrl: 'https://example.com/pricing',
    textHash: 'abc123',
    status: '强命中',
    matches: [
      {
        keyword: '$5',
        snippet: '新用户注册即赠送 $5 免费额度。',
        strength: 'strong',
      },
    ],
    ...overrides,
  };
}

test('WoolCard 显示证据状态与原文片段，但不自动升级为官方已核验', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
  });
  const { window } = dom;
  const globals: Record<string, unknown> = {
    window,
    document: window.document,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    Event: window.Event,
    MouseEvent: window.MouseEvent,
    KeyboardEvent: window.KeyboardEvent,
    MutationObserver: window.MutationObserver,
    getComputedStyle: window.getComputedStyle.bind(window),
  };
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;

  try {
    const { render, screen, cleanup } = await import('@testing-library/react');
    const { WoolCard } = await import('./WoolCard');

    render(
      <WoolCard
        item={makeItem({ evidence: makeEvidence() })}
        isBookmarked={false}
        onToggleBookmark={() => {}}
        nowIso="2026-11-19T03:00:00.000Z"
      />
    );

    assert.ok(screen.getByText('强命中'));
    assert.ok(screen.getByText('官方页面摘录'));
    assert.ok(screen.getByText(/新用户注册即赠送 \$5 免费额度/));
    assert.ok(screen.getByText(/抓取于/), '片段旁应显示抓取时间');

    const link = screen.getByRole('link', {
      name: 'https://example.com/pricing',
    });
    assert.equal(link.getAttribute('href'), 'https://example.com/pricing');

    for (const forbidden of ['有证据', '已证实', '已核验']) {
      assert.equal(
        screen.queryByText(new RegExp(forbidden)),
        null,
        `证据文案不得出现“${forbidden}”`
      );
    }
    assert.equal(screen.queryByText('✓ 官方已核验'), null);
    assert.ok(screen.getByText('? 未核验'));

    cleanup();
  } finally {
    window.close();
  }
});
