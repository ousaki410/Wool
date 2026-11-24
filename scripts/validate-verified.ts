#!/usr/bin/env npx tsx
/**
 * 校验 public/data/verified.json：
 * - 根格式、version、records 数组以及每条记录的字段类型错误 → exit 1；
 * - 记录本身与 wool.json 不一致（条目不存在、域名不符）→ exit 1；
 * - 记录本身格式正确但自然失效（标题变化、过期、撤销、quote 过短等）→ 只警告。
 *
 * 该脚本会加入 npm test 和 lint，保证仓库中的 verified.json 始终可解析。
 */

import { readFileSync } from 'fs';

import {
  getVerificationInvalidReason,
  isVerifiedRecordShape,
  VERIFIED_JSON_VERSION,
  type VerificationInvalidReason,
} from '../src/data/verified';
import type { WoolItem } from '../src/data/woolData';
import {
  defaultVerificationPaths,
  loadWoolItems,
} from './verified-store';

export interface VerifiedValidationResult {
  formatErrors: string[];
  warnings: string[];
  total: number;
}

/**
 * 纯校验函数：格式问题及与 wool.json 不一致的记录进入 formatErrors；
 * 业务失效进入 warnings。
 * 缺失记录（null）按格式错误处理，因为仓库必须提交 verified.json。
 */
export function validateVerifiedDocument(
  data: unknown,
  items: WoolItem[],
  now: Date | string | number = new Date()
): VerifiedValidationResult {
  const formatErrors: string[] = [];
  const warnings: string[] = [];
  let records: unknown[] = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    formatErrors.push('verified.json 根节点必须是对象');
  } else {
    const root = data as Record<string, unknown>;
    if (root.version !== VERIFIED_JSON_VERSION) {
      formatErrors.push(`version 必须是 ${VERIFIED_JSON_VERSION}`);
    }
    if (!Array.isArray(root.records)) {
      formatErrors.push('records 必须是数组');
    } else {
      records = root.records;
    }
  }

  const itemsById = new Map(items.map((item) => [item.id, item]));

  records.forEach((raw, index) => {
    if (!isVerifiedRecordShape(raw)) {
      formatErrors.push(`第 ${index + 1} 条记录字段缺失或类型错误`);
      return;
    }
    const item = itemsById.get(raw.itemId) ?? null;
    const reason: VerificationInvalidReason | null = getVerificationInvalidReason(
      raw,
      item,
      now
    );
    if (reason) {
      // 条目不存在或域名不符，说明记录本身与 wool.json 不一致，属于配置错误，
      // 而非自然失效（如过期、撤销、标题变化），应直接阻断提交。
      if (reason === '条目不存在' || reason === '域名不符') {
        formatErrors.push(
          `第 ${index + 1} 条记录（${raw.itemId}）与 wool.json 不一致：${reason}`
        );
        return;
      }
      warnings.push(
        `第 ${index + 1} 条记录（${raw.itemId}）已失效：${reason}`
      );
    }
  });

  return { formatErrors, warnings, total: records.length };
}

export function validateVerifiedFile(
  verifiedPath = defaultVerificationPaths().verifiedPath,
  woolPath = defaultVerificationPaths().woolPath,
  now: Date | string | number = new Date()
): VerifiedValidationResult {
  const items = loadWoolItems(woolPath);

  let text: string;
  try {
    text = readFileSync(verifiedPath, 'utf8');
  } catch {
    return {
      formatErrors: [`无法读取 ${verifiedPath}`],
      warnings: [],
      total: 0,
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch (error) {
    return {
      formatErrors: [
        `verified.json 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`,
      ],
      warnings: [],
      total: 0,
    };
  }

  return validateVerifiedDocument(data, items, now);
}

function main(): void {
  const paths = defaultVerificationPaths();
  let result: VerifiedValidationResult;
  try {
    result = validateVerifiedFile(paths.verifiedPath, paths.woolPath);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[validate-verified] 失败：${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  for (const warning of result.warnings) {
    // eslint-disable-next-line no-console
    console.warn(`[validate-verified] 警告：${warning}`);
  }
  for (const error of result.formatErrors) {
    // eslint-disable-next-line no-console
    console.error(`[validate-verified] 格式错误：${error}`);
  }

  if (result.formatErrors.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[validate-verified] 失败：${result.formatErrors.length} 个格式错误，${result.warnings.length} 条失效警告`
    );
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(
    `[validate-verified] 通过：${result.total} 条记录，${result.warnings.length} 条失效警告`
  );
}

if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].endsWith('validate-verified.ts')
) {
  try {
    main();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[validate-verified] 失败：${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}
