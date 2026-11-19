import test from 'node:test';
import assert from 'node:assert/strict';

import type { EvidenceRecord } from './evidence';
import type { WoolItem } from './woolData';
import {
  applyManualVerification,
  getVerificationInvalidReason,
  isRecordValid,
  normalizeDomain,
  parseVerifiedRecords,
  VERIFICATION_MAX_AGE_MS,
  type VerifiedRecord,
} from './verified';

const NOW = '2026-11-19T00:00:00.000Z';

function makeItem(overrides: Partial<WoolItem> = {}): WoolItem {
  return {
    id: 'fli-verified-test',
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

function makeRecord(overrides: Partial<VerifiedRecord> = {}): VerifiedRecord {
  return {
    itemId: 'fli-verified-test',
    titleSnapshot: '额度变化 · Example AI：免费层新增每月 200 次请求',
    officialUrl: 'https://example.com/pricing',
    quote: '新用户注册即赠送每月 200 次免费请求。',
    note: '已在官方定价页核对',
    confirmedAt: '2026-11-18T00:00:00.000Z',
    confirmedBy: '测试确认人',
    revokedAt: null,
    ...overrides,
  };
}

test('verified: 有效记录升级为官方已核验并附带人工确认信息', () => {
  const item = makeItem();
  const record = makeRecord();

  assert.equal(isRecordValid(record, item, NOW), true);
  assert.equal(getVerificationInvalidReason(record, item, NOW), null);

  const [applied] = applyManualVerification([item], [record], NOW);
  assert.equal(applied.verificationStatus, '官方已核验');
  assert.deepEqual(applied.verification, {
    confirmedAt: record.confirmedAt,
    confirmedBy: record.confirmedBy,
    quote: record.quote,
    note: record.note,
    officialUrl: record.officialUrl,
  });
  assert.equal(applied.verificationIssue, null);
});

test('verified: 标题变化后记录失效，不升级且给出原因', () => {
  const item = makeItem({ title: '额度变化 · Example AI：免费层改为每月 100 次请求' });
  const record = makeRecord();

  assert.equal(getVerificationInvalidReason(record, item, NOW), '标题已变化');
  const [applied] = applyManualVerification([item], [record], NOW);
  assert.equal(applied.verificationStatus, '未核验');
  assert.equal(applied.verification, null);
  assert.equal(applied.verificationIssue?.reason, '标题已变化');
});

test('verified: 超过 30 天的确认失效，原因“确认已过期，需复核”', () => {
  const item = makeItem();
  const stale = new Date(Date.parse(NOW) - VERIFICATION_MAX_AGE_MS - 1000).toISOString();
  const record = makeRecord({ confirmedAt: stale });

  assert.equal(getVerificationInvalidReason(record, item, NOW), '确认已过期，需复核');
  const [applied] = applyManualVerification([item], [record], NOW);
  assert.equal(applied.verificationStatus, '未核验');
  assert.equal(applied.verificationIssue?.reason, '确认已过期，需复核');
});

test('verified: 已撤销记录不升级，原因“已撤销”', () => {
  const item = makeItem();
  const record = makeRecord({ revokedAt: '2026-11-18T12:00:00.000Z' });

  assert.equal(getVerificationInvalidReason(record, item, NOW), '已撤销');
  const [applied] = applyManualVerification([item], [record], NOW);
  assert.equal(applied.verificationStatus, '未核验');
  assert.equal(applied.verificationIssue?.reason, '已撤销');
});

test('verified: 域名不符不升级；www. 前缀差异视为一致', () => {
  const item = makeItem({ sourceUrl: 'https://www.example.com/pricing' });
  const mismatch = makeRecord({ officialUrl: 'https://evil.example.net/pricing' });
  const wwwRecord = makeRecord({ officialUrl: 'https://example.com/pricing' });

  assert.equal(normalizeDomain('https://www.example.com/pricing'), 'example.com');
  assert.equal(getVerificationInvalidReason(mismatch, item, NOW), '域名不符');
  assert.equal(isRecordValid(wwwRecord, item, NOW), true);

  const [applied] = applyManualVerification([item], [mismatch], NOW);
  assert.equal(applied.verificationStatus, '未核验');
  assert.equal(applied.verificationIssue?.reason, '域名不符');
});

test('verified: quote 去空白后少于 10 字无效', () => {
  const item = makeItem();
  const record = makeRecord({ quote: '免 费 额 度 很 好 用' });

  assert.equal(getVerificationInvalidReason(record, item, NOW), '原文不足 10 字');
  assert.equal(isRecordValid(record, item, NOW), false);
});

test('verified: confirmedAt 非法、未来时间或条目不存在均无效', () => {
  const item = makeItem();

  assert.equal(
    getVerificationInvalidReason(makeRecord({ confirmedAt: 'not-a-date' }), item, NOW),
    '确认时间无效'
  );
  assert.equal(
    getVerificationInvalidReason(
      makeRecord({ confirmedAt: '2026-11-20T00:00:00.000Z' }),
      item,
      NOW
    ),
    '确认时间无效'
  );
  assert.equal(
    getVerificationInvalidReason(makeRecord({ itemId: 'fli-missing' }), null, NOW),
    '条目不存在'
  );
});

test('verified: 仅强命中证据、没有确认记录时仍为未核验', () => {
  const evidence: EvidenceRecord = {
    itemId: 'fli-verified-test',
    title: '额度变化 · Example AI：免费层新增每月 200 次请求',
    sourceName: 'Example AI',
    sourceUrl: 'https://example.com/pricing',
    fetchedAt: '2026-11-18T12:00:00.000Z',
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
  };
  const item = makeItem({ evidence });
  const [applied] = applyManualVerification([item], [], NOW);

  assert.equal(applied.verificationStatus, '未核验');
  assert.equal(applied.verification, null);
  assert.equal(applied.evidence?.status, '强命中');
});

test('verified: 上游自带“官方已核验”但无有效记录时也会降级', () => {
  const item = makeItem({ verificationStatus: '官方已核验' });
  const [applied] = applyManualVerification([item], [], NOW);

  assert.equal(applied.verificationStatus, '未核验');
  assert.equal(applied.verification, null);
});

test('verified: 主列表只包含有效确认的条目', () => {
  const validItem = makeItem();
  const staleItem = makeItem({
    id: 'fli-stale',
    title: '额度变化 · Stale AI：免费层每月 5 次',
    sourceUrl: 'https://stale.example.com/pricing',
  });
  const staleRecord = makeRecord({
    itemId: 'fli-stale',
    titleSnapshot: '额度变化 · Stale AI：免费层每月 5 次',
    officialUrl: 'https://stale.example.com/pricing',
    confirmedAt: '2026-09-01T00:00:00.000Z',
  });

  const applied = applyManualVerification(
    [validItem, staleItem],
    [makeRecord(), staleRecord],
    NOW
  );
  const mainList = applied.filter(
    (item) => item.verificationStatus === '官方已核验'
  );

  assert.deepEqual(
    mainList.map((item) => item.id),
    ['fli-verified-test']
  );
  assert.equal(mainList[0].verification?.confirmedBy, '测试确认人');
  assert.equal(applied[1].verificationIssue?.reason, '确认已过期，需复核');
});

test('verified: parseVerifiedRecords 只接受 version 1 且过滤格式错误记录', () => {
  assert.deepEqual(parseVerifiedRecords(null), []);
  assert.deepEqual(parseVerifiedRecords({ version: 2, records: [] }), []);
  assert.deepEqual(parseVerifiedRecords({ version: 1, records: 'bad' }), []);

  const records = parseVerifiedRecords({
    version: 1,
    records: [makeRecord(), { itemId: 'missing-fields' }],
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].itemId, 'fli-verified-test');
});
