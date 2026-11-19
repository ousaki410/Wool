import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { SourceChannel, WoolItem } from '../data/woolData';

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
    publishedAt: '2026-11-17T00:00:00.000Z',
    createdAt: '2026-11-17T00:00:00.000Z',
    updatedAt: '2026-11-17T00:00:00.000Z',
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

function makeChannel(overrides: Partial<SourceChannel> = {}): SourceChannel {
  return {
    id: 'src-fli-changes',
    name: '免费额度/活动变化',
    type: '额度/活动变化',
    url: 'https://free-llm-intel.aishort.top/feeds/llm-intel-changes.xml',
    entryCount: 2,
    lastFetchAt: '2026-11-18T14:26:13.453Z',
    ...overrides,
  };
}

test('涉及厂商折叠区可用按钮展开，且仅对官方链接显示厂商链接', async () => {
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
    const { render, screen, fireEvent, cleanup, within } = await import(
      '@testing-library/react'
    );
    const { SourcesStatusView } = await import('./SourcesStatusView');

    const items = [
      makeWoolItem({
        sourceName: '官方厂商',
        sourceUrl: 'https://official.example.com/pricing',
        hasOfficialLink: true,
        verificationStatus: '官方已核验',
        verification: {
          confirmedAt: '2026-11-18T00:00:00.000Z',
          confirmedBy: '测试确认人',
          quote: '新用户注册即赠送每月 200 次免费请求。',
          note: '',
          officialUrl: 'https://official.example.com/pricing',
        },
      }),
      makeWoolItem({
        sourceName: '镜像厂商',
        sourceUrl: 'https://github.com/example/mirror',
        hasOfficialLink: false,
        // 上游自带状态但没有有效确认记录，不应计入“已核验条目”
        verificationStatus: '官方已核验',
      }),
    ];

    render(
      <SourcesStatusView
        items={items}
        channels={[makeChannel()]}
        onSelectSourceItems={() => {}}
      />
    );

    const verifiedCard = screen.getByText('已核验条目').parentElement;
    assert.match(verifiedCard?.textContent ?? '', /1/);

    const toggle = screen.getByRole('button', { name: /涉及厂商/ });
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');

    const listId = toggle.getAttribute('aria-controls');
    assert.ok(listId, 'button should control the vendor list');
    const list = document.getElementById(listId);
    assert.ok(list, 'vendor list should exist');
    assert.equal(list.hidden, true, 'vendor list should start collapsed');

    fireEvent.click(toggle);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(list.hidden, false, 'vendor list should appear after click');
    assert.match(list.textContent ?? '', /官方厂商/);
    assert.match(list.textContent ?? '', /镜像厂商/);

    assert.ok(
      within(list).getByRole('link', {
        name: 'https://official.example.com/pricing',
      }),
      'official vendor should show its link'
    );
    assert.equal(
      within(list).queryByRole('link', {
        name: 'https://github.com/example/mirror',
      }),
      null,
      'vendor without official link should not show a link'
    );

    cleanup();
  } finally {
    window.close();
  }
});
