import { existsSync, readFileSync, writeFileSync } from 'fs';

import type { EvidenceJson, EvidenceRecord } from '../src/data/evidence';
import {
  getVerificationInvalidReason,
  isRecordValid,
  isVerifiedRecordShape,
  VERIFIED_JSON_VERSION,
  type VerificationInvalidReason,
  type VerifiedRecord,
} from '../src/data/verified';
import type { WoolItem } from '../src/data/woolData';

export const DEFAULT_WOOL_JSON_PATH = 'public/data/wool.json';
export const DEFAULT_EVIDENCE_JSON_PATH = 'public/data/evidence.json';
export const DEFAULT_VERIFIED_JSON_PATH = 'public/data/verified.json';

export interface VerificationPaths {
  woolPath: string;
  evidencePath: string;
  verifiedPath: string;
}

export function defaultVerificationPaths(
  cwd = typeof process !== 'undefined' ? process.cwd() : '.'
): VerificationPaths {
  return {
    woolPath: `${cwd}/${DEFAULT_WOOL_JSON_PATH}`,
    evidencePath: `${cwd}/${DEFAULT_EVIDENCE_JSON_PATH}`,
    verifiedPath: `${cwd}/${DEFAULT_VERIFIED_JSON_PATH}`,
  };
}

export class VerifiedStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerifiedStoreError';
  }
}

export interface VerifiedDocument {
  version: typeof VERIFIED_JSON_VERSION;
  /** 保留原始记录，避免撤销或追加时丢弃格式有问题的审计记录。 */
  records: unknown[];
}

function readJson(path: string, label: string): unknown {
  if (!existsSync(path)) {
    throw new VerifiedStoreError(`${label} 不存在：${path}`);
  }
  const text = readFileSync(path, 'utf8');
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new VerifiedStoreError(
      `${label} 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function loadWoolItems(path = DEFAULT_WOOL_JSON_PATH): WoolItem[] {
  const data = readJson(path, 'wool.json');
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new VerifiedStoreError('wool.json 根节点必须是对象');
  }
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    throw new VerifiedStoreError('wool.json 缺少 items 数组');
  }
  return items.filter((item): item is WoolItem => {
    if (!item || typeof item !== 'object') return false;
    const value = item as Record<string, unknown>;
    return (
      typeof value.id === 'string' &&
      typeof value.title === 'string' &&
      typeof value.sourceUrl === 'string'
    );
  });
}

export function findWoolItem(
  items: WoolItem[],
  itemId: string
): WoolItem | undefined {
  return items.find((item) => item.id === itemId);
}

/** 读取 verified.json；文件不存在时返回空文档（便于首次确认）。 */
export function loadVerifiedDocument(path = DEFAULT_VERIFIED_JSON_PATH): VerifiedDocument {
  if (!existsSync(path)) {
    return { version: VERIFIED_JSON_VERSION, records: [] };
  }
  const data = readJson(path, 'verified.json');
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new VerifiedStoreError('verified.json 根节点必须是对象');
  }
  const root = data as Record<string, unknown>;
  if (root.version !== VERIFIED_JSON_VERSION) {
    throw new VerifiedStoreError(
      `verified.json 的 version 必须是 ${VERIFIED_JSON_VERSION}`
    );
  }
  if (!Array.isArray(root.records)) {
    throw new VerifiedStoreError('verified.json 缺少 records 数组');
  }
  return { version: VERIFIED_JSON_VERSION, records: root.records };
}

export function writeVerifiedDocument(
  document: VerifiedDocument,
  path = DEFAULT_VERIFIED_JSON_PATH
): void {
  const output = {
    version: VERIFIED_JSON_VERSION,
    records: document.records,
  };
  writeFileSync(path, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
}

function loadEvidenceRecords(path = DEFAULT_EVIDENCE_JSON_PATH): EvidenceRecord[] {
  if (!existsSync(path)) return [];
  try {
    const data = readJson(path, 'evidence.json') as EvidenceJson;
    return Array.isArray(data.records) ? data.records : [];
  } catch {
    return [];
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** 返回该条目在 evidence.json 中的全部摘录片段。 */
export function getEvidenceSnippets(
  itemId: string,
  path = DEFAULT_EVIDENCE_JSON_PATH
): string[] {
  const record = loadEvidenceRecords(path).find((entry) => entry.itemId === itemId);
  if (!record || !Array.isArray(record.matches)) return [];
  return record.matches
    .map((match) => (typeof match?.snippet === 'string' ? match.snippet : ''))
    .filter((snippet) => snippet.length > 0);
}

export function isQuoteInSnippets(quote: string, snippets: string[]): boolean {
  const normalizedQuote = normalizeWhitespace(quote);
  return snippets.some((snippet) =>
    normalizeWhitespace(snippet).includes(normalizedQuote)
  );
}

function toIsoString(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new VerifiedStoreError(`无效的时间：${String(value)}`);
  }
  return date.toISOString();
}

export interface ConfirmOptions {
  id: string;
  quote: string;
  note?: string;
  by: string;
  now?: Date | string | number;
}

export interface ConfirmResult {
  item: WoolItem;
  record: VerifiedRecord;
  warnings: string[];
}

/** 确认条目；返回写入的记录与（非阻断的）证据比对警告。 */
export function confirmItem(
  options: ConfirmOptions,
  paths: VerificationPaths = defaultVerificationPaths()
): ConfirmResult {
  const itemId = options.id.trim();
  if (!itemId) throw new VerifiedStoreError('缺少 --id');

  const items = loadWoolItems(paths.woolPath);
  const item = findWoolItem(items, itemId);
  if (!item) {
    throw new VerifiedStoreError(`wool.json 中不存在条目：${itemId}`);
  }
  if (!item.sourceUrl.trim()) {
    throw new VerifiedStoreError(`条目 ${itemId} 没有官方链接（sourceUrl），无法确认`);
  }

  const quote = options.quote.replace(/\s+/g, ' ').trim();
  if (quote.replace(/\s+/g, '').length < 10) {
    throw new VerifiedStoreError('quote 去空白后必须至少 10 个字符');
  }
  const confirmedBy = options.by.trim();
  if (!confirmedBy) throw new VerifiedStoreError('缺少 --by 确认人');

  const nowIso = toIsoString(options.now ?? new Date());
  const document = loadVerifiedDocument(paths.verifiedPath);

  const duplicate = document.records.some(
    (record) =>
      isVerifiedRecordShape(record) &&
      record.itemId === itemId &&
      isRecordValid(record, item, nowIso)
  );
  if (duplicate) {
    throw new VerifiedStoreError(
      `条目 ${itemId} 已有有效确认记录，拒绝重复添加；如需重新确认请先 --revoke`
    );
  }

  const record: VerifiedRecord = {
    itemId,
    titleSnapshot: item.title,
    officialUrl: item.sourceUrl,
    quote,
    note: (options.note ?? '').trim(),
    confirmedAt: nowIso,
    confirmedBy,
    revokedAt: null,
  };

  const reason = getVerificationInvalidReason(record, item, nowIso);
  if (reason) {
    throw new VerifiedStoreError(`新记录未通过有效性校验：${reason}`);
  }

  const warnings: string[] = [];
  const snippets = getEvidenceSnippets(itemId, paths.evidencePath);
  if (snippets.length === 0) {
    warnings.push('evidence.json 中没有该条目的摘录，quote 无法比对（仅警告）');
  } else if (!isQuoteInSnippets(quote, snippets)) {
    warnings.push('quote 未出现在 evidence.json 的任何摘录中（仅警告，不阻止写入）');
  }

  document.records.push(record);
  writeVerifiedDocument(document, paths.verifiedPath);
  return { item, record, warnings };
}

export interface RevokeResult {
  records: VerifiedRecord[];
}

/** 撤销条目下所有未撤销的记录，只设置 revokedAt，不删除记录。 */
export function revokeItem(
  itemId: string,
  reason: string,
  paths: VerificationPaths = defaultVerificationPaths(),
  now: Date | string | number = new Date()
): RevokeResult {
  const id = itemId.trim();
  if (!id) throw new VerifiedStoreError('缺少 --revoke 条目 ID');
  if (!reason.trim()) throw new VerifiedStoreError('缺少 --reason 撤销原因');

  const document = loadVerifiedDocument(paths.verifiedPath);
  const nowIso = toIsoString(now);
  const revoked: VerifiedRecord[] = [];

  document.records = document.records.map((value) => {
    if (
      isVerifiedRecordShape(value) &&
      value.itemId === id &&
      value.revokedAt === null
    ) {
      const updated: VerifiedRecord = { ...value, revokedAt: nowIso };
      revoked.push(updated);
      return updated;
    }
    return value;
  });

  if (revoked.length === 0) {
    throw new VerifiedStoreError(`条目 ${id} 没有可撤销的确认记录`);
  }

  writeVerifiedDocument(document, paths.verifiedPath);
  return { records: revoked };
}

export interface ListedRecord {
  /** 结构合法的记录；null 表示格式无效。 */
  record: VerifiedRecord | null;
  raw: unknown;
  item: WoolItem | null;
  /** null 表示记录有效。 */
  reason: VerificationInvalidReason | null;
}

export function listVerifiedRecords(
  paths: VerificationPaths = defaultVerificationPaths(),
  now: Date | string | number = new Date()
): ListedRecord[] {
  const nowIso = toIsoString(now);
  const items = loadWoolItems(paths.woolPath);
  const document = loadVerifiedDocument(paths.verifiedPath);

  return document.records.map((raw) => {
    if (!isVerifiedRecordShape(raw)) {
      return { record: null, raw, item: null, reason: '记录格式无效' };
    }
    const item = findWoolItem(items, raw.itemId) ?? null;
    return {
      record: raw,
      raw,
      item,
      reason: getVerificationInvalidReason(raw, item, nowIso),
    };
  });
}
