import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('fetch-source.yml 不读写 verified.json，人工确认记录不会被抓取覆盖', () => {
  const workflow = readFileSync('.github/workflows/fetch-source.yml', 'utf8');
  assert.equal(
    workflow.includes('verified.json'),
    false,
    '抓取工作流不得包含 verified.json'
  );
  assert.match(workflow, /DATA_FILES="[^"]*wool\.json/);
});
