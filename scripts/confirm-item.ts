#!/usr/bin/env npx tsx
/**
 * 人工确认命令行工具：维护 public/data/verified.json。
 *
 * 确认：
 *   npx tsx scripts/confirm-item.ts --id fli-xxxx --quote "官方原文" --note "核对说明" --by 你的名字
 * 撤销（只写 revokedAt，保留记录）：
 *   npx tsx scripts/confirm-item.ts --revoke fli-xxxx --reason "原因"
 * 列表：
 *   npx tsx scripts/confirm-item.ts --list
 *
 * 本工具不会修改 wool.json 或 evidence.json，也不会影响抓取工作流。
 */

import {
  confirmItem,
  defaultVerificationPaths,
  findWoolItem,
  getEvidenceSnippets,
  listVerifiedRecords,
  loadWoolItems,
  revokeItem,
  VerifiedStoreError,
} from './verified-store';

interface Args {
  [key: string]: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      throw new VerifiedStoreError(`无法识别的参数：${token}`);
    }
    const key = token.slice(2);
    if (key === 'list' || key === 'help') {
      args[key] = 'true';
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new VerifiedStoreError(`参数 --${key} 缺少值`);
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function printUsage(): void {
  // eslint-disable-next-line no-console
  console.log(`用法：
  确认：npx tsx scripts/confirm-item.ts --id fli-xxxx --quote "官方原文" --note "核对说明" --by 你的名字
  撤销：npx tsx scripts/confirm-item.ts --revoke fli-xxxx --reason "原因"
  列表：npx tsx scripts/confirm-item.ts --list`);
}

function runList(): void {
  const rows = listVerifiedRecords();
  // eslint-disable-next-line no-console
  console.log(`verified.json 共 ${rows.length} 条记录`);
  if (rows.length === 0) {
    // eslint-disable-next-line no-console
    console.log('（空记录）');
    return;
  }
  rows.forEach((row, index) => {
    if (!row.record) {
      // eslint-disable-next-line no-console
      console.log(`\n${index + 1}. [记录格式无效] ${JSON.stringify(row.raw)}`);
      return;
    }
    const status = row.reason ? `失效：${row.reason}` : '有效';
    // eslint-disable-next-line no-console
    console.log(`\n${index + 1}. ${row.record.itemId} · ${status}`);
    // eslint-disable-next-line no-console
    console.log(`   标题：${row.record.titleSnapshot}`);
    // eslint-disable-next-line no-console
    console.log(
      `   确认：${row.record.confirmedAt} · ${row.record.confirmedBy}${
        row.record.revokedAt ? ` · 撤销于 ${row.record.revokedAt}` : ''
      }`
    );
    // eslint-disable-next-line no-console
    console.log(`   官方链接：${row.record.officialUrl}`);
    // eslint-disable-next-line no-console
    console.log(`   原文：${row.record.quote}`);
    if (row.record.note) {
      // eslint-disable-next-line no-console
      console.log(`   说明：${row.record.note}`);
    }
  });
}

function runConfirm(args: Args): void {
  if (!args.id) throw new VerifiedStoreError('缺少 --id');
  if (!args.quote) throw new VerifiedStoreError('缺少 --quote');
  if (!args.by) throw new VerifiedStoreError('缺少 --by');

  const snippets = getEvidenceSnippets(args.id);
  const item = findWoolItem(
    loadWoolItems(defaultVerificationPaths().woolPath),
    args.id
  );
  if (!item) throw new VerifiedStoreError(`wool.json 中不存在条目：${args.id}`);

  // eslint-disable-next-line no-console
  console.log('[confirm-item] 待确认条目：');
  // eslint-disable-next-line no-console
  console.log(`  标题：${item.title}`);
  // eslint-disable-next-line no-console
  console.log(`  官方链接：${item.sourceUrl}`);
  // eslint-disable-next-line no-console
  console.log(`  evidence 摘录：${snippets.length} 条`);
  snippets.forEach((snippet, index) => {
    // eslint-disable-next-line no-console
    console.log(`  ${index + 1}. ${snippet}`);
  });

  const result = confirmItem({
    id: args.id,
    quote: args.quote,
    note: args.note,
    by: args.by,
  });

  // eslint-disable-next-line no-console
  console.log('\n[confirm-item] 已写入 verified.json：');
  // eslint-disable-next-line no-console
  console.log(`  条目：${result.record.itemId}`);
  // eslint-disable-next-line no-console
  console.log(`  标题快照：${result.record.titleSnapshot}`);
  // eslint-disable-next-line no-console
  console.log(`  官方链接：${result.record.officialUrl}`);
  // eslint-disable-next-line no-console
  console.log(`  确认时间：${result.record.confirmedAt}`);
  // eslint-disable-next-line no-console
  console.log(`  确认人：${result.record.confirmedBy}`);
  for (const warning of result.warnings) {
    // eslint-disable-next-line no-console
    console.warn(`[confirm-item] 警告：${warning}`);
  }
}

function runRevoke(args: Args): void {
  const reason = args.reason ?? '';
  if (!args.revoke) throw new VerifiedStoreError('缺少 --revoke 条目 ID');
  if (!reason.trim()) throw new VerifiedStoreError('缺少 --reason 撤销原因');

  const result = revokeItem(args.revoke, reason);
  // eslint-disable-next-line no-console
  console.log(`[confirm-item] 已撤销 ${result.records.length} 条记录：`);
  for (const record of result.records) {
    // eslint-disable-next-line no-console
    console.log(
      `  ${record.itemId} · 确认于 ${record.confirmedAt} · 撤销于 ${record.revokedAt} · 原因：${reason}`
    );
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (args.list) {
    runList();
    return;
  }
  if (args.revoke) {
    runRevoke(args);
    return;
  }
  if (!args.id && !args.quote && !args.by) {
    printUsage();
    return;
  }
  runConfirm(args);
}

if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].endsWith('confirm-item.ts')
) {
  try {
    main();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[confirm-item] 失败：${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}
