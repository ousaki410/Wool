/**
 * 安全上下文 API 的降级辅助函数。
 * 某些 API（如 clipboard）仅在安全上下文（HTTPS/localhost）可用，
 * 非安全上下文（HTTP 局域网 IP）调用时会抛出错误或静默失败。
 */

export interface CopyResult {
  success: boolean;
  method: 'clipboard' | 'textarea' | 'none';
  error?: string;
}

/**
 * 尝试将文本复制到剪贴板。
 * 优先使用 Clipboard API，不可用时回退到 textarea 选中方式。
 * 两者均失败时返回失败结果，不抛出异常。
 */
export function copyToClipboard(text: string): CopyResult {
  // 优先使用现代 Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      navigator.clipboard.writeText(text);
      return { success: true, method: 'clipboard' };
    } catch {
      // 继续尝试 textarea 兜底
    }
  }

  // 兜底：创建隐藏 textarea，选中后执行 execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) {
        return { success: true, method: 'textarea' };
      }
    } catch {
      // 继续尝试下一步
    }
  }

  return { success: false, method: 'none', error: '剪贴板不可用' };
}

/**
 * 生成稳定的唯一 ID。
 * 不依赖 crypto.randomUUID（该 API 仅在安全上下文可用，局域网 HTTP 可能不可用）。
 * 使用 djb2 哈希对输入字符串确定性计算，用于条目去重。
 */
export function stableId(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, '0');
}
