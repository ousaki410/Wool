import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { WoolItem } from './woolData';
import {
  confirmItem,
  listVerifiedRecords,
  revokeItem,
  VerifiedStoreError,
  type VerificationPaths,
} from '../../scripts/verified-store';
import { validateVerifiedDocument } from '../../scripts/validate-verified';

const NOW = '2026-11-19T06:00:00.000Z';

function makeItem(overrides: Partial<WoolItem> = {}): WoolItem {
  return {
    id: 'fli-cli-test',
    title: '额度变化 · Example AI：免费层新增每月 200 次请求',
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

function setupWorkspace(): {
  dir: string;
  paths: VerificationPaths;
  cleanup: () => void;
} {
  const dir = mkdtempSync(join(tmpdir(), 'wool-verified-'));
  const paths: VerificationPaths = {
    woolPath: join(dir, 'wool.json'),
    evidencePath: join(dir, 'evidence.json'),
    verifiedPath: join(dir, 'verified.json'),
  };
  writeFileSync(
    paths.woolPath,
    JSON.stringify({ items: [makeItem()] }, null, 2),
    'utf8'
  );
  writeFileSync(
    paths.evidencePath,
    JSON.stringify(
      {
        generatedAt: NOW,
        count: 1,
        statusCounts: { 强命中: 1, 弱相关: 0, 页面未提及: 0, 无法访问: 0 },
        records: [
          {
            itemId: 'fli-cli-test',
            title: makeItem().title,
            sourceName: 'Example AI',
            sourceUrl: 'https://example.com/pricing',
            fetchedAt: NOW,
            httpStatus: 200,
            finalUrl: 'https://example.com/pricing',
            textHash: 'abc123',
            status: '强命中',
            matches: [
              {
                keyword: '200 次',
                snippet: '新用户注册即赠送每月 200 次免费请求。',
                strength: 'strong',
              },
            ],
          },
        ],
      },
      null,
      2
    ),
    'utf8'
  );
  writeFileSync(
    paths.verifiedPath,
    JSON.stringify({ version: 1, records: [] }, null, 2),
    'utf8'
  );

  return {
    dir,
    paths,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function readRecords(path: string): Array<Record<string, unknown>> {
  return JSON.parse(readFileSync(path, 'utf8')).records;
}

test('confirm-item: 写入标题快照、官方链接与确认时间', () => {
  const { paths, cleanup } = setupWorkspace();
  try {
    const result = confirmItem(
      {
        id: 'fli-cli-test',
        quote: '新用户注册即赠送每月 200 次免费请求。',
        note: '已在官方定价页核对',
        by: '测试确认人',
        now: NOW,
      },
      paths
    );

    assert.equal(result.warnings.length, 0);
    const records = readRecords(paths.verifiedPath);
    assert.equal(records.length, 1);
    assert.deepEqual(records[0], {
      itemId: 'fli-cli-test',
      titleSnapshot: makeItem().title,
      officialUrl: 'https://example.com/pricing',
      quote: '新用户注册即赠送每月 200 次免费请求。',
      note: '已在官方定价页核对',
      confirmedAt: NOW,
      confirmedBy: '测试确认人',
      revokedAt: null,
    });
  } finally {
    cleanup();
  }
});

test('confirm-item: 同一 itemId 已有有效记录时拒绝重复添加', () => {
  const { paths, cleanup } = setupWorkspace();
  try {
    const options = {
      id: 'fli-cli-test',
      quote: '新用户注册即赠送每月 200 次免费请求。',
      by: '测试确认人',
      now: NOW,
    };
    confirmItem(options, paths);

    assert.throws(
      () => confirmItem(options, paths),
      (error: unknown) =>
        error instanceof VerifiedStoreError &&
        /已有有效确认记录/.test(error.message)
    );
    assert.equal(readRecords(paths.verifiedPath).length, 1);
  } finally {
    cleanup();
  }
});

test('confirm-item: quote 不在 evidence 摘录中只警告，不阻止写入', () => {
  const { paths, cleanup } = setupWorkspace();
  try {
    const result = confirmItem(
      {
        id: 'fli-cli-test',
        quote: '定价页另有一段未进入摘录的说明文字。',
        by: '测试确认人',
        now: NOW,
      },
      paths
    );

    assert.equal(readRecords(paths.verifiedPath).length, 1);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /quote 未出现在 evidence\.json/);
  } finally {
    cleanup();
  }
});

test('confirm-item: quote 去空白后少于 10 字时拒绝写入', () => {
  const { paths, cleanup } = setupWorkspace();
  try {
    assert.throws(
      () =>
        confirmItem(
          {
            id: 'fli-cli-test',
            quote: '免 费 额 度',
            by: '测试确认人',
            now: NOW,
          },
          paths
        ),
      (error: unknown) =>
        error instanceof VerifiedStoreError && /至少 10 个字符/.test(error.message)
    );
    assert.equal(readRecords(paths.verifiedPath).length, 0);
  } finally {
    cleanup();
  }
});

test('confirm-item: --revoke 只设置 revokedAt，保留原记录', () => {
  const { paths, cleanup } = setupWorkspace();
  try {
    confirmItem(
      {
        id: 'fli-cli-test',
        quote: '新用户注册即赠送每月 200 次免费请求。',
        by: '测试确认人',
        now: NOW,
      },
      paths
    );

    const revokedAt = '2026-11-19T07:00:00.000Z';
    const result = revokeItem('fli-cli-test', '上游页面已改版', paths, revokedAt);

    assert.equal(result.records.length, 1);
    const records = readRecords(paths.verifiedPath);
    assert.equal(records.length, 1, '撤销不得删除记录');
    assert.equal(records[0].confirmedAt, NOW, '原确认时间应保留');
    assert.equal(records[0].revokedAt, revokedAt);

    const listed = listVerifiedRecords(paths, revokedAt);
    assert.equal(listed[0].reason, '已撤销');
  } finally {
    cleanup();
  }
});

test('validate-verified: 格式错误 exit 1 级别，失效记录只产生警告', () => {
  const items = [makeItem()];

  const malformed = validateVerifiedDocument(
    { version: 1, records: [{ itemId: 'fli-cli-test' }] },
    items,
    NOW
  );
  assert.equal(malformed.formatErrors.length, 1);
  assert.equal(malformed.warnings.length, 0);

  const stale = validateVerifiedDocument(
    {
      version: 1,
      records: [
        {
          itemId: 'fli-cli-test',
          titleSnapshot: '旧标题',
          officialUrl: 'https://example.com/pricing',
          quote: '新用户注册即赠送每月 200 次免费请求。',
          note: '',
          confirmedAt: '2026-11-18T00:00:00.000Z',
          confirmedBy: '测试确认人',
          revokedAt: null,
        },
      ],
    },
    items,
    NOW
  );
  assert.equal(stale.formatErrors.length, 0);
  assert.equal(stale.warnings.length, 1);
  assert.match(stale.warnings[0], /标题已变化/);
});
