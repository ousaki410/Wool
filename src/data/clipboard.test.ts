import test from 'node:test';
import assert from 'node:assert/strict';
import { copyToClipboard } from '../../src/utils/clipboard';

function mockClipboard(writeTextImpl: () => Promise<void>) {
  const originalClipboard = (globalThis as any).navigator?.clipboard;
  Object.defineProperty((globalThis as any).navigator, 'clipboard', {
    value: { writeText: writeTextImpl },
    configurable: true,
  });
  return () => {
    if (originalClipboard) {
      Object.defineProperty((globalThis as any).navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true,
      });
    } else {
      delete (globalThis as any).navigator.clipboard;
    }
  };
}

function mockDocument(mockDoc: any) {
  const originalDocument = (globalThis as any).document;
  Object.defineProperty(globalThis, 'document', {
    value: mockDoc,
    configurable: true,
  });
  return () => {
    if (originalDocument !== undefined) {
      Object.defineProperty(globalThis, 'document', {
        value: originalDocument,
        configurable: true,
      });
    } else {
      delete (globalThis as any).document;
    }
  };
}

test('copyToClipboard: clipboard 接受时返回 success=true 方法为 clipboard', async () => {
  const restore = mockClipboard(async () => {});

  const result = await copyToClipboard('test text');
  assert.equal(result.success, true);
  assert.equal(result.method, 'clipboard');

  restore();
});

test('copyToClipboard: clipboard 拒绝时走 textarea 兜底，success 反映兜底结果', async () => {
  const restoreClipboard = mockClipboard(async () => {
    throw new Error('Clipboard permission denied');
  });

  const textareaMock = {
    value: '',
    style: {},
    focus: () => {},
    select: () => {},
  };

  const restoreDocument = mockDocument({
    createElement: () => textareaMock,
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
    execCommand: () => true,
  });

  const result = await copyToClipboard('test text');
  assert.equal(result.success, true);
  assert.equal(result.method, 'textarea');

  restoreDocument();
  restoreClipboard();
});

test('copyToClipboard: clipboard 和 textarea 都失败时 success 为 false', async () => {
  const restoreClipboard = mockClipboard(async () => {
    throw new Error('Permission denied');
  });

  const restoreDocument = mockDocument({
    createElement: () => ({
      value: '',
      style: {},
      focus: () => {},
      select: () => {},
    }),
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
    execCommand: () => false,
  });

  const result = await copyToClipboard('test text');
  assert.equal(result.success, false);
  assert.equal(result.method, 'none');

  restoreDocument();
  restoreClipboard();
});
