/**
 * [INPUT]: 依赖纯文本输入
 * [OUTPUT]: 对外提供 preprocessText 函数
 * [POS]: utils工具层，文本预处理
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

/**
 * 预处理粘贴的文本
 * - 统一换行符
 * - 识别 Markdown 格式（标题、列表、引用、表格、分隔线）
 * - 合并连续短句为完整段落
 * - 输出 HTML 结构
 */
export function preprocessText(text: string): string {
  // 1. 统一换行符
  let lines = text.replace(/\r\n/g, '\n').split('\n');

  // 2. 识别特殊行（标题、列表、引用、表格、分隔线）
  const isSpecialLine = (line: string): { isSpecial: boolean; html: string } => {
    const trimmed = line.trim();

    // 空行
    if (!trimmed) {
      return { isSpecial: true, html: '' };
    }

    // Markdown 标题 (# 开头)
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      if (level === 1) {
        return { isSpecial: true, html: `<h1>${content}</h1>` };
      } else if (level === 2) {
        return { isSpecial: true, html: `<h2>${content}</h2>` };
      } else {
        return { isSpecial: true, html: `<h3>${content}</h3>` };
      }
    }

    // Markdown 引用 (> 开头)
    if (trimmed.startsWith('> ')) {
      return { isSpecial: true, html: `<blockquote>${trimmed.slice(2)}</blockquote>` };
    }

    // Markdown 列表 (- 或 * 或数字. 开头)
    if (/^[-*]\s+/.test(trimmed)) {
      return { isSpecial: true, html: `<li>${trimmed.replace(/^[-*]\s+/, '')}</li>` };
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      return { isSpecial: true, html: `<li>${trimmed.replace(/^\d+\.\s+/, '')}</li>` };
    }

    // Markdown 分隔线
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      return { isSpecial: true, html: '<hr/>' };
    }

    // Markdown 表格行（包含 |）
    if (trimmed.includes('|') && trimmed.split('|').length >= 3) {
      // 跳过表格分隔行 (|---|---|)
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        return { isSpecial: true, html: '' };
      }
      const cells = trimmed.split('|').filter(c => c.trim());
      const isHeader = cells.some(c => /\*\*.+\*\*/.test(c));
      const cellHtml = cells.map(c => {
        const content = c.trim().replace(/\*\*/g, '');
        return isHeader ? `<th>${content}</th>` : `<td>${content}</td>`;
      }).join('');
      return { isSpecial: true, html: `<tr>${cellHtml}</tr>` };
    }

    return { isSpecial: false, html: '' };
  };

  // 3. 处理每一行，合并普通文本
  const result: string[] = [];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const merged = currentParagraph.join('');
      if (merged.trim()) {
        result.push(`<p>${merged}</p>`);
      }
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    const { isSpecial, html } = isSpecialLine(line);

    if (isSpecial) {
      // 遇到特殊行，先输出当前段落
      flushParagraph();
      if (html) {
        result.push(html);
      }
    } else {
      // 普通文本行
      const trimmed = line.trim();
      if (trimmed) {
        // 移除 Markdown 加粗标记
        const cleaned = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        currentParagraph.push(cleaned);
      }
    }
  }

  // 输出最后一个段落
  flushParagraph();

  // 4. 包装表格
  let html = result.join('\n');

  // 将连续的 <tr> 包装成 <table>
  html = html.replace(/(<tr>.*?<\/tr>\n?)+/g, (match) => {
    return `<table><tbody>${match}</tbody></table>`;
  });

  // 将连续的 <li> 包装成 <ul>
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, (match) => {
    return `<ul>${match}</ul>`;
  });

  console.log('[预处理] 原始行数:', lines.length, '处理后段落数:', result.length);

  return html;
}
