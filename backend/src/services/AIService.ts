/**
 * [INPUT]: 依赖 axios 和 通义千问配置
 * [OUTPUT]: 对外提供 AIService 类
 * [POS]: services服务层，负责AI二创功能
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 * 参考：replica.ai 的 wechatReplicator.ts 实现
 */

import axios from 'axios';
import { config } from '../config';
import { getQwenApiKey } from './SettingsService';
import { RecreateOptions, ImageContext, AbstractStyleRules, DecorationDescriptor, HtmlTemplates } from '../types';

/**
 * 获取 API Key（优先从数据库读取，其次环境变量）
 */
function getApiKey(): string {
  const dbKey = getQwenApiKey();
  if (dbKey) {
    return dbKey;
  }
  return getApiKey();
}

export class AIService {
  /**
   * 标题生成 - 生成5个爆款标题
   * 参考：replica.ai 的 generateTitleOptions 实现
   */
  async generateTitleOptions(htmlContent: string, count: number = 5): Promise<string[]> {
    try {
      // 从HTML中提取纯文本内容（用于生成标题）
      const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
      let textContent = '';

      if (tempDiv) {
        // 浏览器环境
        tempDiv.innerHTML = htmlContent;
        textContent = tempDiv.textContent || tempDiv.innerText || '';
      } else {
        // Node.js环境 - 简单提取文本
        textContent = htmlContent
          .replace(/<[^>]*>/g, '') // 移除HTML标签
          .replace(/&nbsp;/g, ' ')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .trim();
      }

      // 只取前800字用于生成标题
      const contentForTitle = textContent.substring(0, 800);

      console.log('[标题生成] 提取的纯文本长度:', textContent.length, '字符');
      console.log('[标题生成] 用于生成标题的内容长度:', contentForTitle.length, '字符');
      console.log('[标题生成] 内容预览:', contentForTitle.substring(0, 100));

      const response = await axios.post(
        config.dashscope.apiUrl,
        {
          model: config.dashscope.model,
          messages: [
            {
              role: 'system',
              content: '你是一位精通公众号爆款标题的专家。请根据文章内容生成吸引人的标题。',
            },
            {
              role: 'user',
              content: `请根据以下文章内容，生成${count}个爆款标题。要求：
1. 标题要吸引点击，但不夸大其词
2. 使用数字、疑问、对比等技巧
3. 标题长度在15-25字之间
4. 符合公众号标题的风格
5. **重要**：标题必须与文章内容相关，体现文章的核心观点

文章内容：
${contentForTitle}

请直接返回${count}个标题，每行一个，不要有任何其他文字。`,
            },
          ],
          temperature: 0.8,
          max_tokens: 500,
        },
        {
          headers: {
            'Authorization': `Bearer ${getApiKey()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const text = response.data.choices[0].message.content;
      const titles = text
        .split('\n')
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 0)
        .slice(0, count);

      console.log('[标题生成] 生成的标题:', titles);

      return titles;
    } catch (error: any) {
      console.error('标题生成失败:', error.response?.data || error.message);
      throw new Error('标题生成失败: ' + (error.response?.data?.message || error.message));
    }
  }

  /**
   * 从参考样式HTML中提取样式信息（100%深度复刻版本）
   */
  private extractStyleInfo(referenceStyleHtml: string): string {
    let styleInfo = '\n【参考样式100%深度复刻分析】\n';

    // 1. 提取容器(section)完整样式
    styleInfo += '\n========== 1. 容器完整样式 ==========\n';
    const sectionMatches = [...referenceStyleHtml.matchAll(/<section[^>]*style="([^"]*)"[^>]*>/gi)];
    if (sectionMatches.length > 0) {
      // 去重并提取最常见的容器样式
      const uniqueSections = [...new Set(sectionMatches.map(m => m[1]))];
      uniqueSections.slice(0, 2).forEach((sectionStyle, i) => {
        styleInfo += `\n容器样式 ${i + 1}:\n`;
        styleInfo += `<section style="${sectionStyle}">\n`;
        styleInfo += `  内容占位\n`;
        styleInfo += `</section>\n\n`;

        // 分析容器样式的各个属性
        styleInfo += `详细属性分析:\n`;
        const props = sectionStyle.split(';').filter(p => p.trim());
        props.forEach(prop => {
          if (prop.trim()) {
            styleInfo += `  - ${prop.trim()}\n`;
          }
        });
      });
    }

    // 2. 提取所有段落的完整样式（按使用频率排序）
    styleInfo += '\n========== 2. 段落完整样式（按使用频率） ==========\n';

    // 更宽松的正则匹配段落,支持多种HTML结构
    // 匹配<p>标签及其完整style属性
    const allParagraphs = [
      ...referenceStyleHtml.matchAll(/<p[^>]*style="([^"]*)"[^>]*>/gi),
      ...referenceStyleHtml.matchAll(/<p[^>]*style='([^']*)'[^>]*>/gi)
    ];

    console.log('[样式提取] 找到的段落标签数量:', allParagraphs.length);

    // 统计段落样式使用频率
    const paragraphStyleMap = new Map<string, { count: number, example: string }>();

    allParagraphs.forEach(match => {
      const style = match[1];
      // 提取段落标签后面的部分作为示例(如果有内容的话)
      const fullTag = match[0];
      const contentMatch = fullTag.match(/>([^<]{5,50})/);
      const text = contentMatch ? contentMatch[1].trim() : '段落内容示例';

      if (paragraphStyleMap.has(style)) {
        paragraphStyleMap.get(style)!.count++;
      } else {
        paragraphStyleMap.set(style, { count: 1, example: text });
      }
    });

    // 按使用频率排序
    const sortedParagraphs = Array.from(paragraphStyleMap.entries())
      .sort((a, b) => b[1].count - a[1].count);

    // 输出前5个最常用的段落样式
    styleInfo += `\n最常用的段落样式（完整复制）:\n\n`;
    sortedParagraphs.slice(0, 5).forEach(([style, info], index) => {
      styleInfo += `样式 ${index + 1} (使用${info.count}次):\n`;
      styleInfo += `<p style="${style}">${info.example.substring(0, 50)}...</p>\n\n`;

      // 详细属性分析
      styleInfo += `详细属性:\n`;
      const props = style.split(';').filter(p => p.trim());
      props.forEach(prop => {
        if (prop.trim()) {
          styleInfo += `  ${prop.trim()}\n`;
        }
      });
      styleInfo += '\n';
    });

    // 3. 提取所有段落的间距信息
    styleInfo += '\n========== 3. 段落间距详细分析 ==========\n';
    const marginMap = new Map<string, number>();
    allParagraphs.forEach(match => {
      const style = match[1];
      const marginMatch = style.match(/margin:\s*([^;]+)/i);
      if (marginMatch) {
        const margin = marginMatch[1].trim();
        marginMap.set(margin, (marginMap.get(margin) || 0) + 1);
      }
    });

    const sortedMargins = Array.from(marginMap.entries()).sort((a, b) => b[1] - a[1]);
    styleInfo += '\n段落margin使用频率:\n';
    sortedMargins.slice(0, 5).forEach(([margin, count]) => {
      styleInfo += `  margin: ${margin} (使用${count}次)\n`;
    });

    // 4. 提取字间距(letter-spacing)信息
    styleInfo += '\n========== 4. 字间距详细分析 ==========\n';
    const letterSpacingMap = new Map<string, number>();
    allParagraphs.forEach(match => {
      const style = match[1];
      const lsMatch = style.match(/letter-spacing:\s*([^;]+)/i);
      if (lsMatch) {
        const ls = lsMatch[1].trim();
        letterSpacingMap.set(ls, (letterSpacingMap.get(ls) || 0) + 1);
      }
    });

    const sortedLetterSpacing = Array.from(letterSpacingMap.entries()).sort((a, b) => b[1] - a[1]);
    styleInfo += '\n段落letter-spacing使用频率:\n';
    sortedLetterSpacing.slice(0, 5).forEach(([ls, count]) => {
      styleInfo += `  letter-spacing: ${ls} (使用${count}次)\n`;
    });

    // 5. 提取行高(line-height)信息
    styleInfo += '\n========== 5. 行高详细分析 ==========\n';
    const lineHeightMap = new Map<string, number>();
    allParagraphs.forEach(match => {
      const style = match[1];
      const lhMatch = style.match(/line-height:\s*([^;]+)/i);
      if (lhMatch) {
        const lh = lhMatch[1].trim();
        lineHeightMap.set(lh, (lineHeightMap.get(lh) || 0) + 1);
      }
    });

    const sortedLineHeight = Array.from(lineHeightMap.entries()).sort((a, b) => b[1] - a[1]);
    styleInfo += '\n段落line-height使用频率:\n';
    sortedLineHeight.slice(0, 5).forEach(([lh, count]) => {
      styleInfo += `  line-height: ${lh} (使用${count}次)\n`;
    });

    // 6. 提取颜色使用模式
    styleInfo += '\n========== 6. 颜色使用模式分析 ==========\n';

    // 提取带颜色的段落及其内容
    const coloredSections = [...referenceStyleHtml.matchAll(/<p[^>]*style="[^"]*color:\s*([^;"]+)[^"]*"[^>]*>([^<]{20,200})<\/p>/gi)];
    if (coloredSections.length > 0) {
      styleInfo += '\n原文中使用特殊颜色的段落类型:\n';

      // 分析不同颜色对应的内容特征
      const colorPatterns = new Map<string, string[]>();

      coloredSections.forEach(match => {
        const color = match[1];
        const text = match[2].trim();

        // 判断内容类型
        let contentType = '普通段落';
        if (/^\d+[\u4e00-\u9fa5]/.test(text) || /[\u4e00-\u9fa5]\d+/.test(text)) {
          contentType = '包含数字的数据陈述';
        } else if (/[!?！?]/.test(text.slice(-10))) {
          contentType = '感叹/强调句';
        } else if (text.includes('说') || text.includes('认为') || text.includes('表示')) {
          contentType = '引用/观点';
        } else if (text.length < 50) {
          contentType = '短句（可能是重点）';
        }

        if (!colorPatterns.has(color)) {
          colorPatterns.set(color, []);
        }
        colorPatterns.get(color)!.push(`${contentType}: "${text.substring(0, 30)}..."`);
      });

      // 输出颜色使用模式
      colorPatterns.forEach((examples, color) => {
        styleInfo += `\n颜色 ${color} 用于:\n`;
        examples.slice(0, 3).forEach(example => {
          styleInfo += `  · ${example}\n`;
        });
      });
    }

    // 统计有颜色和无颜色的段落数量
    let coloredCount = 0;
    let normalCount = 0;
    allParagraphs.forEach(match => {
      if (match[1].includes('color:')) {
        coloredCount++;
      } else {
        normalCount++;
      }
    });

    const total = coloredCount + normalCount;
    styleInfo += `\n颜色使用统计:\n`;
    styleInfo += `  有颜色的段落: ${coloredCount} (${((coloredCount / total) * 100).toFixed(1)}%)\n`;
    styleInfo += `  普通段落: ${normalCount} (${((normalCount / total) * 100).toFixed(1)}%)\n`;

    // 7. 提取其他元素样式（strong、h2、h3等）
    styleInfo += '\n========== 7. 其他元素样式 ==========\n';

    // strong 样式
    const strongMatches = [...referenceStyleHtml.matchAll(/<strong[^>]*style="([^"]*)"[^>]*>([^<]{5,50})<\/strong>/gi)];
    if (strongMatches.length > 0) {
      styleInfo += '\n<strong> 加粗样式:\n';
      const uniqueStrongStyles = [...new Set(strongMatches.map(m => m[1]))];
      uniqueStrongStyles.slice(0, 2).forEach((strongStyle, i) => {
        styleInfo += `  样式${i + 1}: <strong style="${strongStyle}">示例文本</strong>\n`;
      });
    }

    // h2 样式
    const h2Matches = [...referenceStyleHtml.matchAll(/<h2[^>]*style="([^"]*)"[^>]*>/gi)];
    if (h2Matches.length > 0) {
      styleInfo += '\n<h2> 标题样式:\n';
      const uniqueH2Styles = [...new Set(h2Matches.map(m => m[1]))];
      uniqueH2Styles.slice(0, 2).forEach((h2Style, i) => {
        styleInfo += `  样式${i + 1}: <h2 style="${h2Style}">标题示例</h2>\n`;
      });
    }

    // h3 样式
    const h3Matches = [...referenceStyleHtml.matchAll(/<h3[^>]*style="([^"]*)"[^>]*>/gi)];
    if (h3Matches.length > 0) {
      styleInfo += '\n<h3> 副标题样式:\n';
      const uniqueH3Styles = [...new Set(h3Matches.map(m => m[1]))];
      uniqueH3Styles.slice(0, 2).forEach((h3Style, i) => {
        styleInfo += `  样式${i + 1}: <h3 style="${h3Style}">副标题示例</h3>\n`;
      });
    }

    // 8. 提取完整的HTML示例模板
    styleInfo += '\n========== 8. 完整HTML示例模板（直接复制使用） ==========\n';
    styleInfo += '\n以下是从参考文章中提取的真实HTML结构，请100%复刻这些样式:\n\n';

    // 提取一个完整的section示例
    const fullSectionMatch = referenceStyleHtml.match(/<section[^>]*style="[^"]*"[^>]*>([\s\S]{500,2000})<\/section>/gi);
    if (fullSectionMatch && fullSectionMatch.length > 0) {
      styleInfo += '完整HTML示例（前1000字符）:\n';
      styleInfo += '```html\n';
      styleInfo += fullSectionMatch[0].substring(0, 1000);
      styleInfo += '\n...\n```\n';
    }

    return styleInfo;
  }

  // ============================================================================
  // 抽象样式规则提取（样式迁移模式）
  // 核心原则：只提取"视觉属性"，不提取"HTML结构"
  // ============================================================================

  /**
   * 标准化颜色格式（#fff → #ffffff）
   */
  private normalizeColor(color: string): string {
    const hex = color.replace('#', '');
    if (hex.length === 3) {
      return '#' + hex.split('').map(c => c + c).join('');
    }
    return '#' + hex.toLowerCase();
  }

  /**
   * 判断颜色是否接近灰色（饱和度低于 15%）
   */
  private isNearGray(hexColor: string): boolean {
    const hex = hexColor.replace('#', '');
    if (hex.length !== 6) return true; // 非标准格式视为灰色
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;

    return saturation < 0.15;
  }

  /**
   * [主题色提取] 从 HTML 中统计所有颜色，识别主题色
   * 核心逻辑：统计 color/background-color/border-color → 排除正文色 → 取最高频彩色
   */
  private extractThemeColor(html: string, bodyTextColor: string): string | null {
    const colorStats = new Map<string, number>();

    // 调试：输出 HTML 片段
    console.log('[主题色提取] HTML片段预览:', html.substring(0, 300).replace(/\n/g, ' '));

    // ========================================
    // 统计 color 属性（使用更宽松的正则）
    // ========================================
    const colorMatches = [...html.matchAll(/color\s*:\s*(#[0-9a-fA-F]{3,6})/gi)];
    console.log('[主题色提取] color 匹配数:', colorMatches.length, '示例:', colorMatches.slice(0, 3).map(m => m[1]));
    colorMatches.forEach(m => {
      const color = this.normalizeColor(m[1]);
      colorStats.set(color, (colorStats.get(color) || 0) + 1);
    });

    // ========================================
    // 统计 background-color 属性
    // ========================================
    const bgMatches = [...html.matchAll(/background-color\s*:\s*(#[0-9a-fA-F]{3,6})/gi)];
    console.log('[主题色提取] background-color 匹配数:', bgMatches.length, '示例:', bgMatches.slice(0, 3).map(m => m[1]));
    bgMatches.forEach(m => {
      const color = this.normalizeColor(m[1]);
      colorStats.set(color, (colorStats.get(color) || 0) + 1);
    });

    // ========================================
    // 统计 border 颜色
    // ========================================
    const borderMatches = [...html.matchAll(/border(?:-left|-right|-top|-bottom)?(?:-color)?\s*:\s*\d+px\s+solid\s+(#[0-9a-fA-F]{3,6})/gi)];
    console.log('[主题色提取] border 匹配数:', borderMatches.length);
    borderMatches.forEach(m => {
      const color = this.normalizeColor(m[1]);
      colorStats.set(color, (colorStats.get(color) || 0) + 1);
    });

    // 输出原始统计结果
    console.log('[主题色提取] 原始颜色统计:', [...colorStats.entries()].slice(0, 10));

    // ========================================
    // 排除正文颜色（灰黑色系）
    // ========================================
    const excludedColors = new Set([
      '#333', '#333333', '#3f3f3f', '#3f3f3f',
      '#666', '#666666', '#999', '#999999',
      '#000', '#000000', '#222', '#222222',
      '#444', '#444444', '#555', '#555555',
      '#777', '#777777', '#888', '#888888',
      '#fff', '#ffffff', '#f5f5f5', '#fafafa', // 白色系也排除
      bodyTextColor?.toLowerCase(),
    ]);

    // ========================================
    // 过滤 + 排序，取最高频彩色
    // ========================================
    const sortedColors = [...colorStats.entries()]
      .filter(([color]) => !excludedColors.has(color.toLowerCase()))
      .filter(([color]) => !this.isNearGray(color))
      .sort((a, b) => b[1] - a[1]);

    console.log('[主题色提取] 过滤后颜色:', sortedColors.slice(0, 5));

    return sortedColors[0]?.[0] || null;
  }

  /**
   * 从 style 字符串中提取指定属性的值
   */
  private extractStyleValue(styleStr: string, prop: string): string | undefined {
    const m = styleStr.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i'));
    return m ? m[1].trim() : undefined;
  }

  /**
   * 提取主标题样式（优先检测彩色背景块）
   * 改进：支持 rgb() 颜色格式和更多样式属性
   */
  private extractMainTitleStyle(html: string): AbstractStyleRules['mainTitle'] {
    // 优先级 1：彩色背景块标题（支持 #hex 和 rgb() 格式）
    const colorBlockPatterns = [
      // #hex 格式
      /<section[^>]*style="([^"]*background-color\s*:\s*(#[0-9a-fA-F]{3,6})[^"]*)"[^>]*>/i,
      // rgb() 格式
      /<section[^>]*style="([^"]*background-color\s*:\s*(rgb\([^)]+\))[^"]*)"[^>]*>/i,
    ];

    for (const pattern of colorBlockPatterns) {
      const match = html.match(pattern);
      if (match) {
        const fullStyle = match[1];
        const bgColor = this.normalizeColor(match[2]);
        console.log('[样式提取] 找到彩色背景块主标题，背景色:', bgColor, '完整样式长度:', fullStyle.length);

        return {
          fontSize: this.extractStyleValue(fullStyle, 'font-size') || '16px',
          color: this.extractStyleValue(fullStyle, 'color') || '#ffffff',
          backgroundColor: bgColor,
          textAlign: this.extractStyleValue(fullStyle, 'text-align') || 'center',
          padding: this.extractStyleValue(fullStyle, 'padding') || '8px 15px',
          borderRadius: this.extractStyleValue(fullStyle, 'border-radius') || '4px',
          fontWeight: this.extractStyleValue(fullStyle, 'font-weight') || 'bold',
          margin: this.extractStyleValue(fullStyle, 'margin') || '10px auto',
          decorationType: 'color-block',
          fullStyle,
        };
      }
    }

    // 优先级 2：居中 + padding 的 section（常见标题样式）
    const centerPaddingMatch = html.match(
      /<section[^>]*style="([^"]*text-align\s*:\s*center[^"]*padding\s*:[^"]*)"[^>]*>/i
    );
    if (centerPaddingMatch) {
      const fullStyle = centerPaddingMatch[1];
      console.log('[样式提取] 找到居中+padding主标题样式');
      return {
        fontSize: this.extractStyleValue(fullStyle, 'font-size') || '16px',
        color: this.extractStyleValue(fullStyle, 'color') || '#333',
        textAlign: 'center',
        padding: this.extractStyleValue(fullStyle, 'padding') || '10px',
        fontWeight: this.extractStyleValue(fullStyle, 'font-weight') || 'bold',
        margin: this.extractStyleValue(fullStyle, 'margin'),
        decorationType: 'none',
        fullStyle,
      };
    }

    // 优先级 3：大字体居中标题
    const bigFontMatch = html.match(
      /<(?:p|section)[^>]*style="[^"]*font-size\s*:\s*(\d{2,})px[^"]*"[^>]*>/i
    );

    if (bigFontMatch) {
      return {
        fontSize: `${bigFontMatch[1]}px`,
        color: '#333',
        textAlign: 'center',
        fontWeight: 'bold',
        decorationType: 'none',
      };
    }

    // Fallback
    return {
      fontSize: '18px',
      color: '#333',
      textAlign: 'center',
      fontWeight: 'bold',
      decorationType: 'none',
    };
  }

  /**
   * 【核心新增】四方向边框检测方法
   * 检测 border-left/right/top/bottom，提取完整样式
   */
  private extractBorderDecorations(html: string): DecorationDescriptor[] {
    const decorations: DecorationDescriptor[] = [];

    // 左边框检测
    const leftMatches = [...html.matchAll(/border-left:\s*(\d+px\s+\w+\s+#[0-9a-fA-F]{3,6})/gi)];
    leftMatches.forEach((m, i) => {
      const borderValue = m[1];
      // 尝试获取完整的 style
      const contextMatch = html.match(new RegExp(`<[^>]*style="[^"]*border-left:\\s*${this.escapeRegex(borderValue)}[^"]*"[^>]*>`, 'i'));
      decorations.push({
        name: `left-bar-${i + 1}`,
        position: 'left',
        fullStyle: contextMatch ? contextMatch[0].match(/style="([^"]*)"/i)?.[1] || `border-left: ${borderValue}; padding-left: 12px;` : `border-left: ${borderValue}; padding-left: 12px;`,
        cssProperties: { borderLeft: borderValue },
        htmlExample: `<section style="border-left: ${borderValue}; padding-left: 12px;"><p>标题内容</p></section>`
      });
    });

    // 右边框检测【新增】
    const rightMatches = [...html.matchAll(/border-right:\s*(\d+px\s+\w+\s+#[0-9a-fA-F]{3,6})/gi)];
    rightMatches.forEach((m, i) => {
      const borderValue = m[1];
      const contextMatch = html.match(new RegExp(`<[^>]*style="[^"]*border-right:\\s*${this.escapeRegex(borderValue)}[^"]*"[^>]*>`, 'i'));
      decorations.push({
        name: `right-bar-${i + 1}`,
        position: 'right',
        fullStyle: contextMatch ? contextMatch[0].match(/style="([^"]*)"/i)?.[1] || `border-right: ${borderValue}; padding-right: 12px;` : `border-right: ${borderValue}; padding-right: 12px;`,
        cssProperties: { borderRight: borderValue },
        htmlExample: `<section style="border-right: ${borderValue}; padding-right: 12px;"><p>标题内容</p></section>`
      });
    });

    // 顶部边框检测【新增】
    const topMatches = [...html.matchAll(/border-top:\s*(\d+px\s+\w+\s+#[0-9a-fA-F]{3,6})/gi)];
    topMatches.forEach((m, i) => {
      const borderValue = m[1];
      decorations.push({
        name: `top-bar-${i + 1}`,
        position: 'top',
        fullStyle: `border-top: ${borderValue}; padding-top: 8px;`,
        cssProperties: { borderTop: borderValue },
        htmlExample: `<section style="border-top: ${borderValue}; padding-top: 8px;"><p>内容</p></section>`
      });
    });

    // 底部边框检测【新增】
    const bottomMatches = [...html.matchAll(/border-bottom:\s*(\d+px\s+\w+\s+#[0-9a-fA-F]{3,6})/gi)];
    bottomMatches.forEach((m, i) => {
      const borderValue = m[1];
      decorations.push({
        name: `bottom-bar-${i + 1}`,
        position: 'bottom',
        fullStyle: `border-bottom: ${borderValue}; padding-bottom: 8px;`,
        cssProperties: { borderBottom: borderValue },
        htmlExample: `<section style="border-bottom: ${borderValue}; padding-bottom: 8px;"><p>内容</p></section>`
      });
    });

    // 阴影装饰检测【新增】
    const shadowMatches = [...html.matchAll(/box-shadow:\s*([^;]+)/gi)];
    shadowMatches.forEach((m, i) => {
      const shadowValue = m[1].trim();
      if (shadowValue && shadowValue !== 'none') {
        decorations.push({
          name: `shadow-${i + 1}`,
          position: 'background',
          fullStyle: `box-shadow: ${shadowValue};`,
          cssProperties: { boxShadow: shadowValue },
          htmlExample: `<section style="box-shadow: ${shadowValue}; padding: 15px;"><p>带阴影的内容</p></section>`
        });
      }
    });

    console.log(`[四方向边框检测] 发现 ${decorations.length} 个装饰元素`);
    return decorations;
  }

  /**
   * 辅助方法：转义正则特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 提取副标题样式（检测左/右边框装饰）
   */
  private extractSubTitleStyle(html: string): AbstractStyleRules['subTitle'] {
    // 收集所有装饰
    const decorations: DecorationDescriptor[] = [];

    // 左边框检测模式（支持 #hex 和 rgb() 格式）
    const leftBarPatterns = [
      // #hex 格式
      /<section[^>]*style="([^"]*border-left\s*:\s*(\d+px\s+solid\s+#[0-9a-fA-F]{3,6})[^"]*)"[^>]*>/i,
      // rgb() 格式
      /<section[^>]*style="([^"]*border-left\s*:\s*(\d+px\s+solid\s+rgb\([^)]+\))[^"]*)"[^>]*>/i,
    ];

    // 右边框检测模式（支持 #hex 和 rgb() 格式）
    const rightBarPatterns = [
      // #hex 格式
      /<section[^>]*style="([^"]*border-right\s*:\s*(\d+px\s+\w+\s+#[0-9a-fA-F]{3,6})[^"]*)"[^>]*>/i,
      // rgb() 格式
      /<section[^>]*style="([^"]*border-right\s*:\s*(\d+px\s+\w+\s+rgb\([^)]+\))[^"]*)"[^>]*>/i,
    ];

    // 优先左边框
    for (const pattern of leftBarPatterns) {
      const leftBarMatch = html.match(pattern);
      if (leftBarMatch) {
        const fullStyle = leftBarMatch[1];
        const borderLeft = leftBarMatch[2];
        console.log('[样式提取] 找到左边框副标题，边框:', borderLeft, '完整样式长度:', fullStyle.length);

        // 添加装饰描述符
        decorations.push({
          name: 'left-bar',
          position: 'left',
          fullStyle,
          cssProperties: { borderLeft },
          htmlExample: `<section style="${fullStyle}"><p>标题内容</p></section>`
        });

        // 提取颜色（支持 #hex 和 rgb）
        const colorMatch = borderLeft.match(/#[0-9a-fA-F]{3,6}/i) || borderLeft.match(/rgb\([^)]+\)/i);

        return {
          fontSize: this.extractStyleValue(fullStyle, 'font-size') || '16px',
          color: this.extractStyleValue(fullStyle, 'color') || '#333',
          borderLeft,
          borderLeftColor: colorMatch?.[0],
          fontWeight: this.extractStyleValue(fullStyle, 'font-weight') || 'bold',
          padding: this.extractStyleValue(fullStyle, 'padding') || '0 0 0 12px',
          textAlign: this.extractStyleValue(fullStyle, 'text-align') || 'left',
          margin: this.extractStyleValue(fullStyle, 'margin'),
          decorationType: 'left-bar',
          fullStyle,
          decorations,
        };
      }
    }

    // 右边框检测
    for (const pattern of rightBarPatterns) {
      const rightBarMatch = html.match(pattern);
      if (rightBarMatch) {
        const fullStyle = rightBarMatch[1];
        const borderRight = rightBarMatch[2];
        console.log('[样式提取] 找到右边框副标题，边框:', borderRight, '完整样式长度:', fullStyle.length);

        decorations.push({
          name: 'right-bar',
          position: 'right',
          fullStyle,
          cssProperties: { borderRight },
          htmlExample: `<section style="${fullStyle}"><p>标题内容</p></section>`
        });

        const colorMatch = borderRight.match(/#[0-9a-fA-F]{3,6}/i) || borderRight.match(/rgb\([^)]+\)/i);

        return {
          fontSize: this.extractStyleValue(fullStyle, 'font-size') || '16px',
          color: this.extractStyleValue(fullStyle, 'color') || '#333',
          borderRight,
          borderRightColor: colorMatch?.[0],
          fontWeight: this.extractStyleValue(fullStyle, 'font-weight') || 'bold',
          padding: this.extractStyleValue(fullStyle, 'padding') || '0 12px 0 0',
          textAlign: this.extractStyleValue(fullStyle, 'text-align') || 'right',
          margin: this.extractStyleValue(fullStyle, 'margin'),
          decorationType: 'right-bar',
          fullStyle,
          decorations,
        };
      }
    }

    // Fallback
    return {
      fontSize: '16px',
      color: '#333',
      fontWeight: 'bold',
      decorationType: 'none',
      decorations: [],
    };
  }

  /**
   * 【新增】用 AI 分析参考样式 HTML，提取颜色和样式信息
   * 比正则表达式更智能、更健壮
   */
  async analyzeStyleWithAI(referenceHtml: string): Promise<Partial<AbstractStyleRules>> {
    console.log('[AI样式分析] 开始分析，HTML长度:', referenceHtml.length);

    // 截取 HTML（避免太长）
    const maxLen = 12000;
    const htmlForAnalysis = referenceHtml.length > maxLen
      ? referenceHtml.substring(0, maxLen) + '\n... (已截断)'
      : referenceHtml;

    const prompt = `你是微信公众号样式分析专家。请分析参考HTML，识别**所有可复用的视觉样式**。

## 🎯 核心任务

1. **自主发现组件**：不局限于固定类型，识别所有独特的视觉模式
2. **完整提取装饰**：检测左/右/上/下四个方向的边框装饰
3. **保留原始样式**：必须输出 fullStyle（完整 style 字符串）

## ⚠️ 关键要求
- 必须提取**完整的 style 属性字符串**（fullStyle 字段）
- **右边框 (border-right) 也要检测！**
- **阴影 (box-shadow)、渐变 (linear-gradient) 也是装饰！**
- 装饰元素可以是数组，支持多种样式

## 提取要求

### 1. mainTitle（主标题）
- fullStyle: 完整 style 字符串
- decorationType: 自命名装饰类型（如 color-block/left-bar/gradient-bg）
- decorations: 装饰描述符数组（如果有多个装饰）

### 2. subTitle（副标题）- 四方向边框都要检测！
- fullStyle: 完整 style 字符串
- borderLeft: 左边框样式（如 "4px solid #c30503"）
- borderRight: 右边框样式【重要】
- borderTop: 顶部边框样式
- borderBottom: 底部边框样式
- decorationType: 自命名（left-bar/right-bar/top-line/bottom-line 等）
- decorations: 装饰描述符数组

### 3. paragraph（正文）
- fullStyle: 完整 style 字符串
- fontSize, lineHeight, color, textAlign, margin

### 4. emphasis（强调文字）
- color, fontWeight, backgroundColor

### 5. decoration（装饰元素）- 可以有多个！
- elements: 装饰描述符数组
  - name: 自命名（如 'left-red-bar', 'dashed-divider'）
  - position: 'left' | 'right' | 'top' | 'bottom' | 'background'
  - fullStyle: 完整样式字符串
  - cssProperties: { borderLeft, borderRight, boxShadow, background 等 }

### 6. themeColor: 主题色

## 输出格式（只输出 JSON）
{
  "mainTitle": {
    "fullStyle": "background-color: #c30503; padding: 10px 20px; border-radius: 6px; text-align: center;",
    "backgroundColor": "#c30503",
    "color": "#ffffff",
    "fontSize": "16px",
    "decorationType": "color-block",
    "decorations": []
  },
  "subTitle": {
    "fullStyle": "border-left: 4px solid #c30503; padding-left: 12px;",
    "borderLeft": "4px solid #c30503",
    "borderRight": null,
    "borderLeftColor": "#c30503",
    "decorationType": "left-bar",
    "decorations": [
      { "name": "left-red-bar", "position": "left", "fullStyle": "border-left: 4px solid #c30503; padding-left: 12px;" }
    ]
  },
  "paragraph": {
    "fullStyle": "font-size: 15px; line-height: 1.75; color: #3f3f3f; text-align: justify;",
    "fontSize": "15px",
    "lineHeight": "1.75"
  },
  "emphasis": { "color": "#c30503", "fontWeight": "bold" },
  "decoration": {
    "elements": [
      { "name": "solid-divider", "position": "top", "fullStyle": "border-top: 1px solid #eee; margin: 20px 0;" },
      { "name": "shadow-box", "position": "background", "fullStyle": "box-shadow: 0 2px 8px rgba(0,0,0,0.1);" }
    ]
  },
  "themeColor": "#c30503"
}

HTML内容：
${htmlForAnalysis}`;

    try {
      const response = await axios.post(
        config.dashscope.apiUrl,
        {
          model: config.dashscope.model,
          messages: [
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        },
        {
          headers: {
            'Authorization': `Bearer ${getApiKey()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data?.choices?.[0]?.message?.content || '';
      console.log('[AI样式分析] AI返回内容:', content.substring(0, 500));

      // 提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[AI样式分析] 解析结果:', JSON.stringify(parsed, null, 2));
        return parsed;
      }

      console.warn('[AI样式分析] 未找到 JSON');
      return {};
    } catch (error: any) {
      console.error('[AI样式分析] 失败:', error.message);
      return {};
    }
  }

  /**
   * 从参考样式 HTML 中提取抽象样式规则
   * 用于"样式迁移"模式：学习视觉属性，应用到任意内容结构
   *
   * @param referenceStyleHtml 参考样式的完整 HTML
   * @returns 抽象样式规则对象（只包含视觉属性）
   */
  extractAbstractStyleRules(referenceStyleHtml: string): AbstractStyleRules {
    console.log('[样式提取] 开始提取抽象样式规则，HTML长度:', referenceStyleHtml.length);

    // ========================================
    // 1. 提取段落样式（统计最常见的）
    // ========================================
    const paragraphStyleStats = new Map<string, { count: number; style: Record<string, string> }>();

    // 匹配所有 <p> 标签的 style 属性
    const pMatches = [...referenceStyleHtml.matchAll(/<p[^>]*style="([^"]*)"[^>]*>/gi)];
    console.log('[样式提取] 找到段落数量:', pMatches.length);

    pMatches.forEach(match => {
      const styleStr = match[1];

      // 提取关键属性
      const extractProp = (prop: string): string | undefined => {
        const m = styleStr.match(new RegExp(`${prop}:\\s*([^;]+)`, 'i'));
        return m ? m[1].trim() : undefined;
      };

      const styleObj: Record<string, string> = {};
      const fontSize = extractProp('font-size');
      const lineHeight = extractProp('line-height');
      const color = extractProp('color');
      const letterSpacing = extractProp('letter-spacing');
      const textAlign = extractProp('text-align');
      const margin = extractProp('margin');

      if (fontSize) styleObj.fontSize = fontSize;
      if (lineHeight) styleObj.lineHeight = lineHeight;
      if (color) styleObj.color = color;
      if (letterSpacing) styleObj.letterSpacing = letterSpacing;
      if (textAlign) styleObj.textAlign = textAlign;
      if (margin) styleObj.margin = margin;

      // 创建样式签名用于统计
      const signature = `${fontSize || ''}|${lineHeight || ''}|${color || ''}`;

      if (paragraphStyleStats.has(signature)) {
        paragraphStyleStats.get(signature)!.count++;
      } else {
        paragraphStyleStats.set(signature, { count: 1, style: styleObj });
      }
    });

    // 找出最常见的段落样式
    const mostCommonParagraph = [...paragraphStyleStats.entries()]
      .sort((a, b) => b[1].count - a[1].count)[0];

    const paragraphStyle: AbstractStyleRules['paragraph'] = {
      fontSize: mostCommonParagraph?.[1].style.fontSize || '15px',
      lineHeight: mostCommonParagraph?.[1].style.lineHeight || '1.75',
      color: mostCommonParagraph?.[1].style.color || '#3f3f3f',
      letterSpacing: mostCommonParagraph?.[1].style.letterSpacing || '0.5px',
      textAlign: mostCommonParagraph?.[1].style.textAlign || 'justify',
      margin: mostCommonParagraph?.[1].style.margin || '10px 0',
    };

    console.log('[样式提取] 最常见段落样式:', paragraphStyle);

    // ========================================
    // 2. 【核心改动】提取主题色
    // ========================================
    const themeColor = this.extractThemeColor(referenceStyleHtml, paragraphStyle.color || '#3f3f3f');
    console.log('[样式提取] 提取的主题色:', themeColor);

    // ========================================
    // 3. 提取标题样式（通过字体大小、加粗、居中等特征判断）
    // ========================================
    const headingCandidates: Array<{ fontSize: number; style: Record<string, string>; rawStyle: string }> = [];

    // 匹配所有带 style 的 section/p/div 标签
    const allStyledElements = [
      ...referenceStyleHtml.matchAll(/<(section|p|div|h[2-6])[^>]*style="([^"]*)"[^>]*>/gi),
    ];

    allStyledElements.forEach(match => {
      const styleStr = match[2];
      const fontSizeMatch = styleStr.match(/font-size:\s*(\d+(?:\.\d+)?)\s*px/i);

      if (fontSizeMatch) {
        const fontSize = parseFloat(fontSizeMatch[1]);
        const isBold = /font-weight:\s*(bold|700|800|900)/i.test(styleStr);
        const isCenter = /text-align:\s*center/i.test(styleStr);
        const hasColor = /color:\s*#[0-9a-fA-F]{3,6}/i.test(styleStr);

        // 字体 > 16px 且有加粗或居中，可能是标题
        if (fontSize > 16 && (isBold || isCenter || hasColor)) {
          const extractProp = (prop: string): string | undefined => {
            const m = styleStr.match(new RegExp(`${prop}:\\s*([^;]+)`, 'i'));
            return m ? m[1].trim() : undefined;
          };

          headingCandidates.push({
            fontSize,
            rawStyle: styleStr,
            style: {
              fontSize: `${fontSize}px`,
              fontWeight: extractProp('font-weight') || 'bold',
              color: extractProp('color') || '#333',
              textAlign: extractProp('text-align') || 'center',
              marginBottom: extractProp('margin-bottom') || extractProp('margin')?.split(/\s+/)[0] || '15px',
            },
          });
        }
      }
    });

    // 取最大的字体样式作为标题样式
    const headingCandidate = headingCandidates.sort((a, b) => b.fontSize - a.fontSize)[0];

    // ========================================
    // 3. 识别装饰类型（分析HTML特征）
    // ========================================
    let decorationType: AbstractStyleRules['heading']['decoration'] = 'none';
    let decorationColor: string | undefined;

    // 检测彩色块装饰（有背景色的section且内容较短）
    if (/section[^>]*style="[^"]*background-color:\s*#[0-9a-fA-F]{3,6}/i.test(referenceStyleHtml)) {
      const bgMatch = referenceStyleHtml.match(/background-color:\s*(#[0-9a-fA-F]{3,6})/i);
      if (bgMatch && /text-align:\s*center/i.test(referenceStyleHtml)) {
        decorationType = 'color-block';
        decorationColor = bgMatch[1];
      }
    }

    // 检测年份装饰
    if (/\d{4}年/.test(referenceStyleHtml)) {
      decorationType = 'year-badge';
    }

    // 检测左边框装饰
    if (/border-left:\s*\d+px\s+solid/i.test(referenceStyleHtml)) {
      decorationType = 'left-bar';
      const borderMatch = referenceStyleHtml.match(/border-left:\s*\d+px\s+solid\s+(#[0-9a-fA-F]{3,6})/i);
      if (borderMatch) decorationColor = borderMatch[1];
    }

    // 检测下划线装饰
    if (/border-bottom:\s*\d+px\s+solid/i.test(referenceStyleHtml) || /text-decoration:\s*underline/i.test(referenceStyleHtml)) {
      decorationType = 'underline';
    }

    // 【核心改动】标题颜色优先使用主题色
    const headingStyle: AbstractStyleRules['heading'] = {
      fontSize: headingCandidate?.style.fontSize || '18px',
      fontWeight: headingCandidate?.style.fontWeight || 'bold',
      color: themeColor || headingCandidate?.style.color || '#333',
      textAlign: headingCandidate?.style.textAlign || 'center',
      marginBottom: headingCandidate?.style.marginBottom || '15px',
      decoration: decorationType,
      decorationColor: themeColor || decorationColor,
    };

    console.log('[样式提取] 提取的标题样式:', headingStyle);

    // ========================================
    // 4. 提取强调样式（高亮颜色）
    // ========================================
    const emphasisColors: string[] = [];
    const strongMatches = [...referenceStyleHtml.matchAll(/<(strong|span)[^>]*style="[^"]*color:\s*(#[0-9a-fA-F]{3,6})[^"]*"[^>]*>/gi)];
    strongMatches.forEach(m => {
      if (m[2] && m[2] !== paragraphStyle.color) {
        emphasisColors.push(m[2]);
      }
    });

    // 统计最常见的强调颜色
    const emphasisColorMap = new Map<string, number>();
    emphasisColors.forEach(c => {
      emphasisColorMap.set(c, (emphasisColorMap.get(c) || 0) + 1);
    });
    // 【核心改动】强调颜色优先使用主题色，移除硬编码 #ff6b6b
    const emphasisColorFromHtml = [...emphasisColorMap.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    const emphasisColor = themeColor || emphasisColorFromHtml || '#ff6b6b';

    const emphasisStyle: AbstractStyleRules['emphasis'] = {
      color: emphasisColor,
      fontWeight: 'bold',
    };

    console.log('[样式提取] 强调颜色:', emphasisColor, '(主题色:', themeColor, ', HTML提取:', emphasisColorFromHtml, ')');

    // ========================================
    // 5. 提取引用/金句样式
    // ========================================
    let quoteStyle: AbstractStyleRules['quote'] | undefined = undefined;

    // 检测引用块样式
    if (/border-left:\s*\d+px/i.test(referenceStyleHtml) || /<blockquote/i.test(referenceStyleHtml)) {
      const borderMatch = referenceStyleHtml.match(/border-left:\s*(\d+px\s+solid\s+#[0-9a-fA-F]{3,6})/i);
      quoteStyle = {
        fontSize: '14px',
        color: '#666',
        fontStyle: 'italic',
        borderLeft: borderMatch?.[1] || '3px solid #ddd',
        padding: '10px 15px',
        backgroundColor: '#f9f9f9',
      };
    }

    // ========================================
    // 6. 推断整体风格描述
    // ========================================
    let styleDescription = '简约清新';

    if (decorationType === 'color-block') {
      styleDescription = '活力时尚';
    } else if (decorationType === 'year-badge') {
      styleDescription = '复古文艺';
    } else if (decorationType === 'left-bar') {
      styleDescription = '商务专业';
    } else if (headingStyle.textAlign === 'center') {
      styleDescription = '居中对称';
    }

    // ========================================
    // 7. 【新增】提取主标题和副标题样式
    // ========================================
    const mainTitleStyle = this.extractMainTitleStyle(referenceStyleHtml);
    const subTitleStyle = this.extractSubTitleStyle(referenceStyleHtml);

    // 从主标题/副标题/强调样式中提取主题色
    const finalThemeColor = mainTitleStyle.backgroundColor ||
                            this.extractStyleValue(subTitleStyle.borderLeft || '', 'solid')?.split(' ')[2] ||
                            emphasisColor ||
                            themeColor;

    // ========================================
    // 8. 构建返回结果（包含新的 mainTitle 和 subTitle）
    // ========================================
    const result: AbstractStyleRules = {
      mainTitle: mainTitleStyle,
      subTitle: subTitleStyle,
      container: {
        textAlign: 'center',
        maxWidth: '100%',
      },
      heading: headingStyle,
      paragraph: paragraphStyle,
      emphasis: emphasisStyle,
      quote: quoteStyle,
      decoration: {
        type: decorationType as any,
        color: decorationColor,
      },
      themeColor: finalThemeColor || undefined,
      styleDescription,
    };

    console.log('[样式提取] 最终提取的抽象样式规则:', JSON.stringify(result, null, 2));

    return result;
  }

  /**
   * 内容二创并应用样式
   * 参考：replica.ai 的 recreateContentWithStyle 实现
   * 包含 70% 相似度控制和样式学习
   * @param imageContexts 原文图片的位置上下文，AI会根据这些信息在合适位置插入 [IMG_N] 占位符
   */
  async recreateContentWithStyle(
    originalContent: string,
    newTitle: string,
    referenceStyleHtml: string,
    options: RecreateOptions,
    creativityLevel: number = 7, // 1-10，数字越高自由度越低
    inputMethod: 'url' | 'paste' = 'url', // 输入方式：url=爬取文章，paste=用户粘贴
    imageContexts: ImageContext[] = [], // 原文图片的位置上下文
    abstractStyleRules?: AbstractStyleRules, // 提取的样式规则
    articleStructure?: { hasMainTitle: boolean; hasSubTitle: boolean; hasQuote: boolean; hasList: boolean; hasDivider: boolean; hasEmphasis: boolean }, // 结构信息
    htmlTemplates?: HtmlTemplates // 【第二阶段】可直接使用的 HTML 模板
  ): Promise<string> {
    const { type, style, targetLength } = options;

    // ========================================
    // 代码块占位符方案：提取代码块，AI 处理完后恢复
    // 这样可以保证代码内容 100% 不被修改
    // ========================================
    const codeBlocks: { original: string; content: string }[] = [];

    // 提取代码块，用占位符替代
    const extractCodeBlocks = (html: string): { html: string; count: number } => {
      let processed = html;
      let count = 0;

      // 1. 先匹配复杂的 <section><span><pre><code>...</code></pre></section> 结构（微信专用格式）
      processed = processed.replace(
        /<section[^>]*>(?:<span[^>]*>)?<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>(?:<\/span>)?<\/section>/gi,
        (match, codeContent) => {
          const cleanContent = codeContent
            .replace(/<span[^>]*>/gi, '')
            .replace(/<\/span>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&nbsp;/g, ' ')
            .trim();
          codeBlocks.push({ original: match, content: cleanContent });
          return `__CODE_BLOCK_${count++}__`;
        }
      );

      // 2. 匹配 <pre><code>...</code></pre> 结构
      processed = processed.replace(
        /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
        (match, codeContent) => {
          const cleanContent = codeContent
            .replace(/<span[^>]*>/gi, '')
            .replace(/<\/span>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&nbsp;/g, ' ')
            .trim();
          codeBlocks.push({ original: match, content: cleanContent });
          return `__CODE_BLOCK_${count++}__`;
        }
      );

      // 3. 匹配单独的 <code> 标签（较长的是代码块）
      processed = processed.replace(
        /<code[^>]*>([\s\S]*?)<\/code>/gi,
        (match, codeContent) => {
          const cleanContent = codeContent
            .replace(/<span[^>]*>/gi, '')
            .replace(/<\/span>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&nbsp;/g, ' ')
            .trim();

          // 超过 50 字符或有换行，视为代码块
          if (cleanContent.length > 50 || cleanContent.includes('\n')) {
            codeBlocks.push({ original: match, content: cleanContent });
            return `__CODE_BLOCK_${count++}__`;
          }
          // 短的是行内代码，用反引号标记
          return `\`${cleanContent}\``;
        }
      );

      console.log('[代码块提取] 提取到', count, '个代码块');
      return { html: processed, count };
    };

    // 微信公众号专用代码块样式（深色主题）
    const generateWechatCodeBlockHtml = (codeContent: string): string => {
      // 转义 HTML 特殊字符
      const escapedContent = codeContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      return `<section style="color: rgb(0, 0, 0);font-family: PingFang SC;font-size: medium;font-style: normal;font-variant-ligatures: normal;font-variant-caps: normal;font-weight: 400;letter-spacing: normal;orphans: 2;text-align: start;text-indent: 0px;text-transform: none;widows: 2;word-spacing: 0px;-webkit-text-stroke-width: 0px;white-space: normal;text-decoration-thickness: initial;text-decoration-style: initial;text-decoration-color: initial;margin-top: 12px;background-color: rgb(40, 44, 52);margin-bottom: 12px;border-radius: 5px;"><span style="display: block;height: 30px;background-color: rgb(40, 44, 52);border-top-left-radius: 5px;border-top-right-radius: 5px;margin: 0px;"></span><pre style="margin: 0px;"><code style="color: rgb(171, 178, 191);background: rgb(40, 44, 52);padding: 4px 15px 15px;display: block;overflow-x: auto;border-bottom-left-radius: 5px;border-bottom-right-radius: 5px;font-family: Consolas, Monaco, Menlo, monospace;font-size: 14px;line-height: 1.5;">${escapedContent}</code></pre></section>`;
    };

    // 恢复代码块，应用微信样式
    const restoreCodeBlocksWithStyle = (html: string): string => {
      let result = html;
      codeBlocks.forEach((block, i) => {
        const styledBlock = generateWechatCodeBlockHtml(block.content);
        result = result.replace(`__CODE_BLOCK_${i}__`, styledBlock);
      });
      return result;
    };

    // 从 HTML 中提取纯文本内容（代码块已用占位符替代）
    const extractTextContent = (html: string): string => {
      return html
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // 先提取代码块
    const { html: htmlWithPlaceholders } = extractCodeBlocks(originalContent);
    const originalText = extractTextContent(htmlWithPlaceholders);

    // 移除参考样式中的图片标签，避免AI将参考文章的图片复制到生成内容中
    const removeImagesFromHtml = (html: string): string => {
      return html.replace(/<img[^>]*>/gi, '');
    };

    // 移除参考样式中的图片，只保留排版样式
    const referenceStyleWithoutImages = removeImagesFromHtml(referenceStyleHtml);
    const referenceText = extractTextContent(referenceStyleWithoutImages);

    // ========================================
    // 限制样式长度避免 API 超时
    // ========================================
    const maxStyleLength = 15000;
    const styleHtmlTrimmed = referenceStyleWithoutImages.length > maxStyleLength
      ? referenceStyleWithoutImages.substring(0, maxStyleLength) + '\n... (样式已截断)'
      : referenceStyleWithoutImages;
    console.log('[AI二创] 样式HTML长度:', referenceStyleWithoutImages.length, '→ 截取后:', styleHtmlTrimmed.length);

    // ========================================
    // 关键修复：使用纯文本长度计算目标字数，而不是HTML长度
    // 之前的bug：originalContent.length 是HTML长度（含标签），
    // 导致目标字数被设置得很大，AI会疯狂扩展内容
    // ========================================
    const originalTextLength = originalText.length;

    // 根据类型和自由度计算目标字数范围
    let minTargetLength: number;
    let maxTargetLength: number;

    // 自由度 >= 9 时，严格保持原文长度，不允许扩展或缩减
    if (creativityLevel >= 9) {
      minTargetLength = Math.floor(originalTextLength * 0.95);
      maxTargetLength = Math.ceil(originalTextLength * 1.05);
    } else {
      switch (type) {
        case 'expand':
          minTargetLength = Math.floor(originalTextLength * 1.2);
          maxTargetLength = Math.floor(originalTextLength * 1.5);
          break;
        case 'condense':
          minTargetLength = Math.floor(originalTextLength * 0.6);
          maxTargetLength = Math.floor(originalTextLength * 0.8);
          break;
        case 'refactor':
        default:
          minTargetLength = Math.floor(originalTextLength * 0.8);
          maxTargetLength = Math.floor(originalTextLength * 1.2);
          break;
      }
    }

    console.log('[AI二创] 提取的原文纯文本长度:', originalTextLength, '字符');
    console.log('[AI二创] 提取的参考样式纯文本长度:', referenceText.length, '字符');
    console.log('[AI二创] 输入方式:', inputMethod, '自由度:', creativityLevel);
    console.log('[AI二创] 目标字数范围:', minTargetLength, '-', maxTargetLength, '(基于纯文本长度)');
    console.log('[AI二创] 原文媒体数量:', imageContexts.length);

    // 统计媒体类型
    const imageCount = imageContexts.filter(c => c.mediaType === 'image' || !c.mediaType).length;
    const gifCount = imageContexts.filter(c => c.mediaType === 'gif').length;
    const videoCount = imageContexts.filter(c => c.mediaType === 'video').length;
    console.log('[AI二创] 媒体类型 - 图片:', imageCount, 'GIF:', gifCount, '视频:', videoCount);

    // ========================================
    // 构建媒体位置提示词
    // ========================================
    let imagePromptSection = '';
    let imageInstructionSection = '';

    if (imageContexts.length > 0) {
      imagePromptSection = `\n## 原文媒体位置（必须保留）
原文中有 ${imageContexts.length} 个媒体（${imageCount}张图片, ${gifCount}个GIF动图, ${videoCount}个视频）。
你必须在输出HTML的对应语义位置插入以下占位符，每个占位符单独占一行：`;

      imageContexts.forEach((ctx, idx) => {
        const typeLabel = ctx.mediaType === 'gif' ? 'GIF' : ctx.mediaType === 'video' ? '视频' : '图片';
        imagePromptSection += `\n${idx + 1}. [IMG_${idx + 1}] (${typeLabel}) 原文上下文："${ctx.beforeText.slice(-25)}..." → "...${ctx.afterText.slice(0, 25)}"`;
      });

      imageInstructionSection = `

## 🔴🔴🔴 最重要规则：媒体占位符 🔴🔴🔴
你输出的HTML中必须包含所有 ${imageContexts.length} 个 [IMG_N] 占位符！
- 占位符格式：[IMG_1] [IMG_2] [IMG_3] 等，每个单独一行
- 插入位置：根据"原文上下文"找到语义最相似的段落后插入
- 这是强制要求，不插入占位符会导致图片丢失！`;
    }

    // ========================================
    // 构建样式提示词（第二阶段：模板化）
    // 优先使用 HTML 模板，没有模板则降级到样式规则描述
    // ========================================
    let styleGuideSection = '';
    if (htmlTemplates) {
      styleGuideSection = this.buildStyleTemplatesSection(htmlTemplates, articleStructure);
      console.log('[AI二创] 模板化样式提示词已生成，长度:', styleGuideSection.length);
    } else if (abstractStyleRules && articleStructure) {
      styleGuideSection = this.buildStyleGuideSection(abstractStyleRules, articleStructure);
      console.log('[AI二创] 样式提示词已生成（降级模式），长度:', styleGuideSection.length);
    }

    // 根据输入方式和自由度生成不同的提示词
    let systemPrompt: string;
    let userPrompt: string;

    // ========================================
    // 关键判断：自由度 >= 9 时，仅排版模式
    // 自由度 < 9 时，二创改写模式
    // URL 和 粘贴模式的唯一区别是内容来源，其他逻辑完全相同
    // ========================================
    const useLayoutOnlyMode = creativityLevel >= 9;

    if (useLayoutOnlyMode) {
      // ========== 仅排版模式（自由度 >= 9）==========
      console.log('[AI二创] 仅排版模式（自由度 >= 9）');

      systemPrompt = `你是公众号HTML排版专家。

## 任务
- 仅排版：不扩展内容，只修正错别字标点
- 100%复制参考样式的CSS和HTML结构

## 🚫 严格禁止（最重要）
- **禁止虚构**：不能添加原文没有的任何内容
- **禁止编造**：不能凭空想象事实、数据、案例
- **保留原意**：只改表达方式，不改内容本身

## 代码处理规则（重要）
- 原文中的 __CODE_BLOCK_N__ 是代码块标记，**必须原样保留**，不能删除、不能移动、不能修改
- 原文中的 \`代码\` 是行内代码，输出时用 <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;font-family:monospace;">包裹</code>
- **绝对禁止**：修改任何代码内容，代码块已提前提取，你只负责保留标记位置
- **禁止使用方括号**：输出中不要使用 [[ ]] 或 [ ] 符号表示任何内容

## 排版规则
- 完整复制参考HTML的style属性（不自己编造）
- 复制装饰结构：彩色标题块、背景色块、年份装饰、斜线装饰
- 保留布局属性：text-align、display、justify-content（决定居中对齐）
- 保留段落间距：参考HTML中的空section、br换行都要复制，形成呼吸感
- 用section嵌套实现装饰效果，不只是复制style

## 输出要求
- 格式：\`\`\`html 开头和结尾，中间纯HTML
- 标签：section/div/p/h2/h3/strong/span/table
- 禁止：Markdown语法、img标签、h1标签
- 表格用HTML table标签，不用Markdown
- 字数：严格${minTargetLength}-${maxTargetLength}，不增不减
${imageInstructionSection}`;

      userPrompt = `## 参考样式HTML
${styleHtmlTrimmed}
${styleGuideSection ? `\n## 📐 样式复刻指南（精确复刻以下样式）\n${styleGuideSection}` : ''}

## 原文（仅排版，不扩展内容）
标题：${newTitle}
内容：${originalText}${imagePromptSection}

## ⚠️ 核心要求
- 仅排版，不添加任何新内容
- 修正错别字和标点符号
- 保持原文的事实、数据、观点不变

## 执行步骤
1. 分析参考HTML的装饰结构：彩色标题块？背景色块？年份装饰？居中布局？
2. 分析原文写作风格：语气、口吻、节奏
3. 仅修正错别字标点，保持原有风格
4. 用参考样式排版，复制完整HTML结构（不只是style属性）`;

    } else {
      // ========== 二创改写模式（自由度 < 9）==========
      console.log('[AI二创] 二创改写模式（自由度 < 9）');

      const similarityTarget = creativityLevel <= 3 ? '30%' : creativityLevel <= 5 ? '45%' : creativityLevel <= 7 ? '60%' : '80%';

      // 深度改写等级描述
      const rewriteDepthMap: Record<string, string> = {
        '1-3': '深度重构：完全打散原文结构，全新叙述逻辑，几乎不保留原句式',
        '4-5': '中度改写：保留核心论点，重组段落结构，重写大部分句子',
        '6-8': '轻度改写：调整句式和词汇，保持原有结构框架',
      };
      const level = creativityLevel <= 3 ? '1-3' : creativityLevel <= 5 ? '4-5' : '6-8';

      systemPrompt = `你是公众号爆款内容创作专家，负责对文章进行**深度结构改写**并生成HTML。

## 🎯 核心目标
- 保留原文的**核心主题与逻辑框架**
- 保留**主要信息点和内容结构**（如分点结构、数据、结论）
- **彻底重写表达方式**，避免句式重复
- 提升逻辑清晰度与阅读流畅度
- 语言成熟、有思考感，避免口水话和模板句

## ⚠️ 防抄袭硬性要求（最高优先级）
- **禁止连续8个字以上与原文重复**
- **禁止简单同义词替换**（把"重要"换成"关键"这种不算改写）
- **禁止仅打乱段落顺序**
- **禁止保留原句式结构**（如原文是"A导致B"，不能写成"A使得B发生"）
- **必须彻底重构句子**：换主语、换视角、换叙述顺序

## 📝 深度改写技巧（必须执行）
1. **换叙述视角**：原文说"研究表明"，你写"从数据来看"；原文说"我们应该"，你写"值得思考的是"
2. **拆分重组**：把长句拆短句，短句合成长句；把因果句改成转折句
3. **增加过渡**：段落之间加入逻辑衔接词，形成更流畅的阅读体验
4. **强化冲突**：在平铺直叙处加入反问或对比，增加张力
5. **调整节奏**：原文三段式，你可以改成两段+总结；原文先结论后论证，你可以先现象后分析

## 🎨 风格要求
- 保持公众号爆款风格
- 语气理性但有张力
- 有冲突、有反差、有思考
- 不使用原文中的比喻或原句式
- 不照搬原文的段落节奏
- 可优化结构，但不改变核心信息

## ✅ 内容增强（允许）
- 可补充逻辑过渡句
- 可增强分析深度
- 可优化小标题，使其更具吸引力
- 可让结尾更有思考性或行动引导

## 🚫 严格禁止
- 不允许虚构事实、数据、案例、人名、地名
- 不允许添加原文没有的核心观点
- 不允许改变原文的核心立场和结论
- 核心信息必须来自原文，只能改变表达方式

## 代码处理规则
- 原文中的 __CODE_BLOCK_N__ 是代码块标记，**必须原样保留**
- 原文中的 \`代码\` 是行内代码，用 <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;font-family:monospace;">包裹</code>
- **绝对禁止**：修改任何代码内容

## 排版规则
- 完整复制参考HTML的style属性（不自己编造）
- 复制装饰结构：彩色标题块、背景色块、年份装饰、斜线装饰
- 保留布局属性：text-align、display、justify-content
- 保留段落间距：参考HTML中的空section、br换行都要复制
- 用section嵌套实现装饰效果

## 输出要求
- 格式：\`\`\`html 开头和结尾，中间纯HTML
- 标签：section/div/p/h2/h3/strong/span/table
- 禁止：Markdown语法、img标签、h1标签
- 表格用HTML table标签
- 字数：${minTargetLength}-${maxTargetLength}
${imageInstructionSection}`;

      userPrompt = `## 参考样式HTML
${styleHtmlTrimmed}
${styleGuideSection ? `\n## 📐 样式复刻指南（精确复刻以下样式）\n${styleGuideSection}` : ''}

## 原文（目标相似度：${similarityTarget}，改写深度：${rewriteDepthMap[level]}）
标题：${newTitle}
内容：${originalText}${imagePromptSection}

## ⚠️ 执行检查清单（改写前必读）
- [ ] 我是否理解了原文的核心论点？
- [ ] 我准备用什么新视角来重新叙述？
- [ ] 哪些句子需要完全重写？（答案：几乎全部）
- [ ] 我是否在用同义词偷懒？（答案：禁止）

## 执行步骤
1. **理解原文**：提取核心论点、关键数据、主要结论
2. **规划重构**：决定新的叙述顺序和视角
3. **逐句改写**：每句话都要重新组织，确保没有连续8字重复
4. **润色增强**：添加过渡句、强化逻辑、提升可读性
5. **样式排版**：用参考HTML的样式结构进行排版

## 输出提醒
- 输出的是改写后的HTML，不是改写说明
- 直接输出\`\`\`html包裹的HTML代码
- 确保每段话都与原文表达方式不同`;
    }

    try {
      console.log('[AI二创] 调试信息:');
      console.log('[AI二创] 原始内容长度:', originalContent.length, '字符');
      console.log('[AI二创] 参考样式HTML长度:', referenceStyleHtml.length, '字符');
      console.log('[AI二创] userPrompt长度:', userPrompt.length, '字符');
      console.log('[AI二创] 目标字数范围:', minTargetLength, '-', maxTargetLength);

      // 调试：打印图片相关提示词
      if (imageContexts.length > 0) {
        console.log('[AI二创] imagePromptSection 预览:', imagePromptSection.substring(0, 500));
        console.log('[AI二创] imageInstructionSection 预览:', imageInstructionSection.substring(0, 300));
      }

      // ========================================
      // 根据二创自由度动态调整 temperature
      // creativityLevel: 1=高自由度, 10=低自由度(几乎不变)
      // temperature: 高=随机性高, 低=确定性高
      // ========================================
      const dynamicTemperature = Math.max(0.1, Math.min(1.0, 1.1 - creativityLevel * 0.1));
      // 1 -> 1.0 (高随机,高自由度)
      // 5 -> 0.6 (中等)
      // 10 -> 0.1 (低随机,低自由度,几乎不变)

      console.log('[AI二创] 二创自由度:', creativityLevel, '→ temperature:', dynamicTemperature.toFixed(2));

      const response = await axios.post(
        config.dashscope.apiUrl,
        {
          model: config.dashscope.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: dynamicTemperature,
        },
        {
          headers: {
            'Authorization': `Bearer ${getApiKey()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // 详细记录API响应结构
      console.log('[AI二创] API响应状态:', response.status);
      console.log('[AI二创] 响应数据结构:', JSON.stringify(response.data, null, 2).substring(0, 1000));

      // 安全访问响应内容
      let generatedHTML = '';
      try {
        if (response.data?.choices?.[0]?.message?.content) {
          generatedHTML = response.data.choices[0].message.content;
        } else {
          console.error('[AI二创] 响应结构异常，无法提取content');
          console.error('[AI二创] 完整响应:', JSON.stringify(response.data, null, 2));
          throw new Error('AI API返回的数据格式不正确');
        }
      } catch (error: any) {
        console.error('[AI二创] 提取content失败:', error.message);
        throw error;
      }

      console.log('[AI二创] AI返回原始内容长度:', generatedHTML.length, '字符');

      // 清理AI生成的HTML
      generatedHTML = this.cleanGeneratedHTML(generatedHTML);

      // 恢复代码块，应用微信专用样式
      generatedHTML = restoreCodeBlocksWithStyle(generatedHTML);
      console.log('[AI二创] 恢复代码块后HTML长度:', generatedHTML.length, '字符');

      console.log('[AI二创] 清理后HTML长度:', generatedHTML.length, '字符');

      return generatedHTML;
    } catch (error: any) {
      console.error('AI二创失败:', error.response?.data || error.message);
      throw new Error('AI二创失败: ' + (error.response?.data?.message || error.message));
    }
  }

  // ============================================================================
  // 样式示例提取方法（精确复刻模式）
  // 核心思路：从参考HTML中提取典型样式示例，让AI直接复制而非"学习后重实现"
  // ============================================================================

  /**
   * 从参考 HTML 中提取典型样式示例
   * 用于让 AI 直接复制样式，而非"学习后重实现"
   */
  private extractStyleExamples(referenceHtml: string): {
    mainTitle: string;
    subTitle: string;
    decoration: string[];
    paragraph: string;
  } {
    const examples = {
      mainTitle: '',
      subTitle: '',
      decoration: [] as string[],
      paragraph: ''
    };

    if (!referenceHtml) {
      console.log('[样式示例提取] 参考HTML为空');
      return examples;
    }

    console.log('[样式示例提取] 参考HTML长度:', referenceHtml.length);
    console.log('[样式示例提取] HTML片段预览:', referenceHtml.substring(0, 500).replace(/\n/g, ' '));

    // 1. 提取主标题示例（带 background-color 的 section，或带 text-align: center 的 section）
    // 改进的匹配：不要求完整的闭合标签，匹配开头标签+内容片段
    const mainTitlePatterns = [
      // 模式1：带 background-color 的 section（标题块样式）
      /<section[^>]*style="[^"]*background-color:\s*#[0-9a-fA-F]{3,6}[^"]*"[^>]*>(?:<[^>]*>){0,5}[^<]{2,80}/gi,
      // 模式2：带 background-color: rgb 的 section
      /<section[^>]*style="[^"]*background-color:\s*rgb\([^)]+\)[^"]*"[^>]*>(?:<[^>]*>){0,5}[^<]{2,80}/gi,
      // 模式3：带 text-align: center 和 padding 的 section（常见标题格式）
      /<section[^>]*style="[^"]*text-align:\s*center[^"]*padding:[^"]*"[^>]*>(?:<[^>]*>){0,5}[^<]{2,80}/gi,
      // 模式4：带 text-align: center 和大 font-size 的 section
      /<section[^>]*style="[^"]*text-align:\s*center[^"]*font-size:\s*(1[6-9]|2[0-9])px[^"]*"[^>]*>(?:<[^>]*>){0,5}[^<]{2,80}/gi,
      // 模式5：带 box-sizing 和 margin 的居中 section
      /<section[^>]*style="[^"]*text-align:\s*center[^"]*box-sizing:[^"]*"[^>]*>(?:<[^>]*>){0,5}[^<]{2,80}/gi,
    ];

    for (const pattern of mainTitlePatterns) {
      const matches = [...referenceHtml.matchAll(pattern)];
      if (matches.length > 0) {
        examples.mainTitle = matches[0][0];
        console.log('[样式示例提取] 找到主标题示例，长度:', examples.mainTitle.length);
        break;
      }
    }

    // 2. 提取副标题示例（带 border-left/right/top/bottom 的 section）
    // 改进：匹配更多样式的边框装饰
    const subTitlePatterns = [
      // 模式1：带 border-left + solid（彩色左边框）
      /<section[^>]*style="[^"]*border-left:\s*\d+px\s+solid\s+#[0-9a-fA-F]{3,6}[^"]*"[^>]*>(?:<[^>]*>){0,5}[^<]{2,80}/gi,
      // 模式2：带 border-left + rgb 颜色
      /<section[^>]*style="[^"]*border-left:\s*\d+px\s+solid\s+rgb\([^)]+\)[^"]*"[^>]*>(?:<[^>]*>){0,5}[^<]{2,80}/gi,
      // 模式3：带 border-left（通用）
      /<section[^>]*style="[^"]*border-left:[^"]*"[^>]*>(?:<[^>]*>){0,5}[^<]{2,80}/gi,
      // 模式4：带 border-right（右边框装饰）
      /<section[^>]*style="[^"]*border-right:[^"]*"[^>]*>(?:<[^>]*>){0,5}[^<]{2,80}/gi,
      // 模式5：带 border-top（顶部装饰线）
      /<section[^>]*style="[^"]*border-top:[^"]*"[^>]*>(?:<[^>]*>){0,5}[^<]{2,80}/gi,
      // 模式6：带 border-bottom（底部装饰线）
      /<section[^>]*style="[^"]*border-bottom:\s*\d+px\s+solid[^"]*"[^>]*>(?:<[^>]*>){0,5}[^<]{2,80}/gi,
      // 模式7：带 padding-left + font-weight（可能是左边框样式）
      /<section[^>]*style="[^"]*padding-left:[^"]*font-weight:[^"]*"[^>]*>(?:<[^>]*>){0,5}[^<]{2,80}/gi,
    ];

    for (const pattern of subTitlePatterns) {
      const matches = [...referenceHtml.matchAll(pattern)];
      if (matches.length > 0) {
        examples.subTitle = matches[0][0];
        console.log('[样式示例提取] 找到副标题示例，长度:', examples.subTitle.length);
        break;
      }
    }

    // 3. 提取分割线示例（height: 1px 或 background 带透明度的 section）
    const dividerPatterns = [
      // 模式1：height: 1px 的空 section
      /<section[^>]*style="[^"]*height:\s*1px[^"]*"[^>]*>\s*<\/section>/gi,
      // 模式2：带 background-color 且内容为空的 section
      /<section[^>]*style="[^"]*background-color:\s*rgba\([^)]+\.\d+\)[^"]*height:[^"]*"[^>]*>\s*<\/section>/gi,
    ];

    for (const pattern of dividerPatterns) {
      const matches = [...referenceHtml.matchAll(pattern)];
      for (let i = 0; i < Math.min(matches.length, 2); i++) {
        if (!examples.decoration.includes(matches[i][0])) {
          examples.decoration.push(matches[i][0]);
        }
      }
    }
    if (examples.decoration.length > 0) {
      console.log('[样式示例提取] 找到分割线示例:', examples.decoration.filter(d => d.includes('height')).length, '个');
    }

    // 4. 提取引用块示例（带 rgba 背景色且 padding 的 section）
    const quotePatterns = [
      // 模式1：带 rgba 背景色和 padding 的 section
      /<section[^>]*style="[^"]*background-color:\s*rgba\([^)]+\.\d+\)[^"]*padding:[^"]*"[^>]*>(?:<[^>]*>){0,3}[^<]{10,}/gi,
      // 模式2：带浅色背景的 section
      /<section[^>]*style="[^"]*background-color:\s*rgba\([^)]+\.\d+\)[^"]*"[^>]*>(?:<[^>]*>){0,3}[^<]{10,}/gi,
    ];

    for (const pattern of quotePatterns) {
      const matches = [...referenceHtml.matchAll(pattern)];
      if (matches.length > 0) {
        const match = matches[0][0];
        if (!examples.decoration.includes(match)) {
          examples.decoration.push(match);
          console.log('[样式示例提取] 找到引用块示例，长度:', match.length);
        }
        break;
      }
    }

    // 5. 提取段落示例（带 font-size 的 p 标签或 section）
    const paragraphPatterns = [
      // 模式1：带 font-size 的 p 标签
      /<p[^>]*style="[^"]*font-size:\s*\d+px[^"]*"[^>]*>[^<]{20,}/gi,
      // 模式2：带 line-height 的 section
      /<section[^>]*style="[^"]*line-height:[^"]*"[^>]*>(?:<[^>]*>){0,1}[^<]{20,}/gi,
      // 模式3：带 text-align: justify 的 section
      /<section[^>]*style="[^"]*text-align:\s*justify[^"]*"[^>]*>(?:<[^>]*>){0,1}[^<]{20,}/gi,
    ];

    for (const pattern of paragraphPatterns) {
      const matches = [...referenceHtml.matchAll(pattern)];
      if (matches.length > 0) {
        examples.paragraph = matches[0][0];
        console.log('[样式示例提取] 找到段落示例，长度:', examples.paragraph.length);
        break;
      }
    }

    console.log('[样式示例提取] 提取结果: mainTitle=', !!examples.mainTitle,
                ', subTitle=', !!examples.subTitle,
                ', decoration=', examples.decoration.length,
                ', paragraph=', !!examples.paragraph);

    return examples;
  }

  // ============================================================================
  // 抽象样式迁移方法（样式迁移模式）
  // 核心差异：只学习"视觉属性"，不学习"HTML结构"
  // ============================================================================

  /**
   * 使用抽象样式规则进行内容二创（样式迁移模式）
   *
   * 核心原则：
   * - 参考样式只定义"形容词"（颜色、字体、间距、对齐）
   * - 原文内容定义"名词"（标题数量、段落结构、信息层次）
   * - 最终输出 = 原文结构 + 参考样式的视觉属性
   *
   * @param originalContent 原文内容（纯文本或HTML）
   * @param newTitle 新标题
   * @param styleRules 抽象样式规则（从参考样式提取）
   * @param options 二创选项
   * @param creativityLevel 二创自由度（1-10）
   * @param inputMethod 输入方式
   * @param referenceHtml 参考样式HTML（用于学习视觉样式）
   */
  async recreateContentWithAbstractStyle(
    originalContent: string,
    newTitle: string,
    styleRules: AbstractStyleRules,
    options: RecreateOptions,
    creativityLevel: number = 7,
    inputMethod: 'url' | 'paste' = 'url',
    referenceHtml: string = '',  // 参考样式HTML
    imageCount: number = 3       // 配图数量（动态）
  ): Promise<string> {
    const { type } = options;

    console.log('[样式迁移] 开始二创，自由度:', creativityLevel);
    console.log('[样式迁移] 样式规则:', JSON.stringify(styleRules, null, 2));
    console.log('[样式迁移] 参考HTML长度:', referenceHtml.length);

    // ========================================
    // 代码块占位符方案：提取代码块，AI 处理完后恢复
    // 这样可以保证代码内容 100% 不被修改
    // ========================================
    const codeBlocks: { original: string; content: string }[] = [];

    const extractCodeBlocks = (html: string): { html: string; count: number } => {
      let processed = html;
      let count = 0;

      // 1. 先匹配复杂的 <section><span><pre><code>...</code></pre></section> 结构（微信专用格式）
      processed = processed.replace(
        /<section[^>]*>(?:<span[^>]*>)?<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>(?:<\/span>)?<\/section>/gi,
        (match, codeContent) => {
          const cleanContent = codeContent
            .replace(/<span[^>]*>/gi, '')
            .replace(/<\/span>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&nbsp;/g, ' ')
            .trim();
          codeBlocks.push({ original: match, content: cleanContent });
          return `__CODE_BLOCK_${count++}__`;
        }
      );

      // 2. 匹配 <pre><code>...</code></pre> 结构
      processed = processed.replace(
        /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
        (match, codeContent) => {
          const cleanContent = codeContent
            .replace(/<span[^>]*>/gi, '')
            .replace(/<\/span>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&nbsp;/g, ' ')
            .trim();
          codeBlocks.push({ original: match, content: cleanContent });
          return `__CODE_BLOCK_${count++}__`;
        }
      );

      // 3. 匹配单独的 <code> 标签（较长的是代码块）
      processed = processed.replace(
        /<code[^>]*>([\s\S]*?)<\/code>/gi,
        (match, codeContent) => {
          const cleanContent = codeContent
            .replace(/<span[^>]*>/gi, '')
            .replace(/<\/span>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&nbsp;/g, ' ')
            .trim();

          // 超过 50 字符或有换行，视为代码块
          if (cleanContent.length > 50 || cleanContent.includes('\n')) {
            codeBlocks.push({ original: match, content: cleanContent });
            return `__CODE_BLOCK_${count++}__`;
          }
          // 短的是行内代码，用反引号标记
          return `\`${cleanContent}\``;
        }
      );

      console.log('[样式迁移-代码块提取] 提取到', count, '个代码块');
      return { html: processed, count };
    };

    // 微信公众号专用代码块样式（深色主题）
    const generateWechatCodeBlockHtml = (codeContent: string): string => {
      const escapedContent = codeContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      return `<section style="color: rgb(0, 0, 0);font-family: PingFang SC;font-size: medium;font-style: normal;font-variant-ligatures: normal;font-variant-caps: normal;font-weight: 400;letter-spacing: normal;orphans: 2;text-align: start;text-indent: 0px;text-transform: none;widows: 2;word-spacing: 0px;-webkit-text-stroke-width: 0px;white-space: normal;text-decoration-thickness: initial;text-decoration-style: initial;text-decoration-color: initial;margin-top: 12px;background-color: rgb(40, 44, 52);margin-bottom: 12px;border-radius: 5px;"><span style="display: block;height: 30px;background-color: rgb(40, 44, 52);border-top-left-radius: 5px;border-top-right-radius: 5px;margin: 0px;"></span><pre style="margin: 0px;"><code style="color: rgb(171, 178, 191);background: rgb(40, 44, 52);padding: 4px 15px 15px;display: block;overflow-x: auto;border-bottom-left-radius: 5px;border-bottom-right-radius: 5px;font-family: Consolas, Monaco, Menlo, monospace;font-size: 14px;line-height: 1.5;">${escapedContent}</code></pre></section>`;
    };

    // 恢复代码块，应用微信样式
    const restoreCodeBlocksWithStyle = (html: string): string => {
      let result = html;
      codeBlocks.forEach((block, i) => {
        const styledBlock = generateWechatCodeBlockHtml(block.content);
        result = result.replace(`__CODE_BLOCK_${i}__`, styledBlock);
      });
      return result;
    };

    // ========================================
    // 提取纯文本内容（代码块已用占位符替代）
    // ========================================
    const extractTextContent = (html: string): string => {
      return html
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // 先提取代码块
    const { html: htmlWithPlaceholders } = extractCodeBlocks(originalContent);
    const originalText = extractTextContent(htmlWithPlaceholders);
    const originalTextLength = originalText.length;

    console.log('[样式迁移] 原文纯文本长度:', originalTextLength);
    console.log('[样式迁移] 代码块数量:', codeBlocks.length);

    // ========================================
    // 计算目标字数范围
    // ========================================
    let minTargetLength: number;
    let maxTargetLength: number;

    if (creativityLevel >= 9) {
      minTargetLength = Math.floor(originalTextLength * 0.95);
      maxTargetLength = Math.ceil(originalTextLength * 1.05);
    } else {
      switch (type) {
        case 'expand':
          minTargetLength = Math.floor(originalTextLength * 1.2);
          maxTargetLength = Math.floor(originalTextLength * 1.5);
          break;
        case 'condense':
          minTargetLength = Math.floor(originalTextLength * 0.6);
          maxTargetLength = Math.floor(originalTextLength * 0.8);
          break;
        case 'refactor':
        default:
          minTargetLength = Math.floor(originalTextLength * 0.8);
          maxTargetLength = Math.floor(originalTextLength * 1.2);
          break;
      }
    }

    console.log('[样式迁移] 原文纯文本长度:', originalTextLength);
    console.log('[样式迁移] 目标字数范围:', minTargetLength, '-', maxTargetLength);

    // ========================================
    // 构建装饰元素说明（支持四方向边框）
    // ========================================
    let decorationInstruction = '';

    // 【新增】使用 decorations 数组动态构建指令
    if (styleRules.subTitle?.decorations && styleRules.subTitle.decorations.length > 0) {
      decorationInstruction = styleRules.subTitle.decorations.map(d => `
- ${d.name}（${d.position}方向装饰）：
- 完整样式：style="${d.fullStyle}"
- HTML示例：${d.htmlExample || `<section style="${d.fullStyle}"><p>标题内容</p></section>`}
`).join('');
    } else if (styleRules.heading.decoration && styleRules.heading.decoration !== 'none') {
      // 向后兼容：旧的 decoration 字段
      const decorationType = styleRules.heading.decoration;
      const decorationColor = styleRules.heading.decorationColor || '#3498db';

      switch (decorationType) {
        case 'color-block':
          decorationInstruction = `
- 彩色背景块装饰：在标题前添加 <section style="background-color: ${decorationColor}; padding: 8px 15px; border-radius: 4px; display: inline-block;"> 标签
- 示例：<section style="background-color: ${decorationColor}; padding: 8px 15px; border-radius: 4px;"><span style="color: #fff; font-weight: bold;">标题文字</span></section>`;
          break;
        case 'left-bar':
          decorationInstruction = `
- 左边框装饰：在标题前添加左边框样式
- 示例：<section style="border-left: 4px solid ${decorationColor}; padding-left: 12px;"><p style="font-size: ${styleRules.heading.fontSize}; font-weight: bold; color: ${styleRules.heading.color};">标题文字</p></section>`;
          break;
        case 'right-bar':  // 【新增】右边框装饰
          decorationInstruction = `
- 右边框装饰：在标题后添加右边框样式
- 示例：<section style="border-right: 4px solid ${decorationColor}; padding-right: 12px; text-align: right;"><p style="font-size: ${styleRules.heading.fontSize}; font-weight: bold; color: ${styleRules.heading.color};">标题文字</p></section>`;
          break;
        case 'underline':
          decorationInstruction = `
- 下划线装饰：在标题下方添加分割线
- 示例：<section style="border-bottom: 2px solid ${decorationColor}; padding-bottom: 8px; margin-bottom: 15px;"><p style="font-size: ${styleRules.heading.fontSize}; font-weight: bold;">标题文字</p></section>`;
          break;
        case 'top-line':  // 【新增】顶部装饰线
          decorationInstruction = `
- 顶部装饰线：在标题上方添加装饰线
- 示例：<section style="border-top: 3px solid ${decorationColor}; padding-top: 10px; margin-top: 20px;"><p style="font-size: ${styleRules.heading.fontSize}; font-weight: bold;">标题文字</p></section>`;
          break;
        case 'year-badge':
          decorationInstruction = `
- 年份装饰：在标题旁添加年份标签
- 示例：<section style="display: flex; align-items: center; gap: 10px;"><span style="background-color: ${decorationColor}; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 12px;">2024</span><p style="font-size: ${styleRules.heading.fontSize}; font-weight: bold;">标题文字</p></section>`;
          break;
        default:
          // 未知装饰类型，直接使用 decorationColor
          decorationInstruction = `
- 自定义装饰（${decorationType}）：
- 根据装饰类型智能应用样式`;
      }
    }

    // 【新增】从 decoration.elements 构建更多装饰指令
    if (styleRules.decoration?.elements && styleRules.decoration.elements.length > 0) {
      const extraDecorations = styleRules.decoration.elements.map(d => `
### ${d.name}（${d.position}方向装饰）
- 完整样式：style="${d.fullStyle}"
- HTML示例：${d.htmlExample || `<section style="${d.fullStyle}">内容</section>`}
`).join('\n');

      decorationInstruction += '\n## 额外装饰元素\n' + extraDecorations;
    }

    // ========================================
    // 构建系统提示词（核心：强调"学习样式"vs"模仿结构"）
    // ========================================

    // 【核心改进】提取参考文章的典型样式示例，让 AI 直接复制
    const styleExamples = this.extractStyleExamples(referenceHtml);

    // 截取参考HTML（避免太长）
    const maxRefLength = 12000;
    const refHtmlTrimmed = referenceHtml.length > maxRefLength
      ? referenceHtml.substring(0, maxRefLength) + '\n... (已截断)'
      : referenceHtml;

    const systemPrompt = `你是公众号排版专家。

## 核心任务
1. 二创原文内容，保持核心信息和逻辑
2. **100% 精确复刻参考HTML的视觉样式**（直接复制 style 属性）
3. **不要模仿参考HTML的内容结构**（标题数量、段落划分）

## 🎯 样式复刻方法论（最重要）

**核心原则**：从下面的"参考样式示例"中找到相似元素，**直接复制其 style 属性**，不要自己编写样式！

${styleExamples.mainTitle ? `### 📋 主标题样式示例（直接复制这个 section 的 style）
\`\`\`html
${styleExamples.mainTitle}
\`\`\`
**使用方法**：复制上面的 style 属性值，应用到你的主标题 section 中
` : ''}

${styleExamples.subTitle ? `### 📋 副标题样式示例（直接复制这个 section 的 style）
\`\`\`html
${styleExamples.subTitle}
\`\`\`
**使用方法**：复制上面的 style 属性值，应用到你的副标题 section 中
` : ''}

${styleExamples.decoration.length > 0 ? `### 📋 装饰元素示例（直接复制这些 section 的 style）
${styleExamples.decoration.map((d, i) => `
#### 装饰元素 ${i + 1}
\`\`\`html
${d}
\`\`\`
`).join('\n')}
**使用方法**：复制上面的 style 属性值，应用到分割线/引用块中
` : ''}

${styleExamples.paragraph ? `### 📋 段落样式示例（直接复制这个 p 的 style）
\`\`\`html
${styleExamples.paragraph}
\`\`\`
**使用方法**：复制上面的 style 属性值，应用到你的段落 p 标签中
` : ''}

## ⚠️ 什么是"学习样式"vs"模仿结构"

✅ 学习样式（正确）：
- **直接复制参考示例的 style 属性**，不要自己编写
- 参考HTML有彩色背景块 → 你也用相同样式
- 参考HTML有左边框装饰 → 你也用相同样式

❌ 模仿结构（错误）：
- 参考HTML有5个标题 → 你也写5个标题（错！应该根据原文内容决定）
- 参考HTML第一段是引言 → 你第一段也写引言（错！应该根据原文逻辑）

## 📌 核心规则（必须遵守）
1. **视觉样式 = 100%复制参考示例**（直接复制 style 属性值）
2. **内容结构 = 100%原文**（标题数量、段落逻辑、信息层次）
3. **不要自己编写 style**，从参考示例中复制！

## 代码处理规则（重要）
- 原文中的 __CODE_BLOCK_N__ 是代码块标记，**必须原样保留**，不能删除、不能移动、不能修改
- 原文中的 \`代码\` 是行内代码，输出时用 <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;font-family:monospace;">包裹</code>
- **绝对禁止**：修改任何代码内容，代码块已提前提取，你只负责保留标记位置
- **禁止使用方括号**：输出中不要使用 [[ ]] 或 [ ] 符号表示任何内容

## 🎨 参考样式规则（备选：如果上面没有示例，使用这些规则）

### 主标题样式（用于文章最重要的标题）
${(() => {
  // 核心修复：当 decorationType === 'color-block' 时，强制合并 backgroundColor
  let mainTitleMergedStyle = styleRules.mainTitle.fullStyle || '';
  if (styleRules.mainTitle.decorationType === 'color-block' &&
      styleRules.mainTitle.backgroundColor &&
      !mainTitleMergedStyle.includes('background-color')) {
    mainTitleMergedStyle = `${mainTitleMergedStyle} background-color: ${styleRules.mainTitle.backgroundColor};`.trim();
  }
  return mainTitleMergedStyle ? `
- ⚠️ **完整样式**（直接复制）：style="${mainTitleMergedStyle}"
- HTML示例：<section style="${mainTitleMergedStyle}"><span style="color: ${styleRules.mainTitle.color || '#ffffff'}; font-weight: bold;">标题文字</span></section>
` : styleRules.mainTitle.decorationType === 'color-block' ? `
- 使用**彩色背景块**装饰！
- 背景色：${styleRules.mainTitle.backgroundColor || '#3498db'}
- 文字色：${styleRules.mainTitle.color || '#ffffff'}
- 内边距：${styleRules.mainTitle.padding || '8px 15px'}
- 圆角：${styleRules.mainTitle.borderRadius || '4px'}
- 对齐：${styleRules.mainTitle.textAlign || 'center'}
- HTML示例：<section style="background-color: ${styleRules.mainTitle.backgroundColor || '#3498db'}; padding: ${styleRules.mainTitle.padding || '8px 15px'}; border-radius: ${styleRules.mainTitle.borderRadius || '4px'}; text-align: ${styleRules.mainTitle.textAlign || 'center'};"><span style="color: ${styleRules.mainTitle.color || '#ffffff'}; font-weight: bold; font-size: ${styleRules.mainTitle.fontSize};">标题文字</span></section>
` : `- 字体：${styleRules.mainTitle.fontSize}，颜色：${styleRules.mainTitle.color}，对齐：${styleRules.mainTitle.textAlign}`;
})()}

### 副标题样式（用于段落小标题）
${(() => {
  // 核心修复：当 decorationType === 'left-bar' 时，强制合并 borderLeft
  let subTitleMergedStyle = styleRules.subTitle.fullStyle || '';
  if (styleRules.subTitle.decorationType === 'left-bar' &&
      styleRules.subTitle.borderLeft &&
      !subTitleMergedStyle.includes('border-left')) {
    subTitleMergedStyle = `${subTitleMergedStyle} border-left: ${styleRules.subTitle.borderLeft};`.trim();
  }
  return subTitleMergedStyle ? `
- ⚠️ **完整样式**（直接复制）：style="${subTitleMergedStyle}"
- HTML示例：<section style="${subTitleMergedStyle}"><p style="font-size: ${styleRules.subTitle.fontSize}; font-weight: bold; color: ${styleRules.subTitle.color};">标题文字</p></section>
` : styleRules.subTitle.decorationType === 'left-bar' ? `
- 使用**左边框**装饰！
- 边框：${styleRules.subTitle.borderLeft || '4px solid #333'}
- 内边距：${styleRules.subTitle.padding || '0 0 0 12px'}
- HTML示例：<section style="border-left: ${styleRules.subTitle.borderLeft || '4px solid #333'}; padding: ${styleRules.subTitle.padding || '0 0 0 12px'};"><p style="font-size: ${styleRules.subTitle.fontSize}; font-weight: ${styleRules.subTitle.fontWeight || 'bold'}; color: ${styleRules.subTitle.color};">标题文字</p></section>
` : `- 字体：${styleRules.subTitle.fontSize}，颜色：${styleRules.subTitle.color}，加粗：${styleRules.subTitle.fontWeight || 'bold'}`;
})()}

### 正文样式
${styleRules.paragraph.fullStyle ? `
- ⚠️ **完整样式**（直接复制）：style="${styleRules.paragraph.fullStyle}"
` : `
- 字体大小：${styleRules.paragraph.fontSize || '15px'}
- 行高：${styleRules.paragraph.lineHeight || '1.75'}
- 文字颜色：${styleRules.paragraph.color || '#3f3f3f'}
- 字间距：${styleRules.paragraph.letterSpacing || '0.5px'}
- 对齐：${styleRules.paragraph.textAlign || 'justify'}
`}

### 强调文字样式
- 颜色：${styleRules.emphasis.color || '#ff6b6b'}
- 加粗：${styleRules.emphasis.fontWeight || 'bold'}

### 装饰元素（⚠️ 必须使用！参考样式有这些装饰就要用）
${styleRules.decoration?.divider?.fullStyle ? `
#### 1. 分割线（用于分隔章节）
- **使用时机**：在每个主要章节之间、或 2-3 个段落后插入分割线
- **完整样式**：style="${styleRules.decoration.divider.fullStyle}"
- **HTML示例**：<section style="${styleRules.decoration.divider.fullStyle}"></section>
- ⚠️ 注意：分割线是**空标签**，内容为空，用于视觉分隔
` : ''}
${styleRules.decoration?.quoteBlock?.fullStyle ? `
#### 2. 引用块（用于突出金句/重点）
- **使用时机**：文章中的金句、名人名言、重要观点、关键结论
- **完整样式**：style="${styleRules.decoration.quoteBlock.fullStyle}"
- **HTML示例**：<section style="${styleRules.decoration.quoteBlock.fullStyle}"><p style="font-style: italic;">引用内容放这里</p></section>
- ⚠️ 注意：引用块用于强调重要内容，增加文章层次感
` : ''}
${!styleRules.decoration?.divider?.fullStyle && !styleRules.decoration?.quoteBlock?.fullStyle ? `
- 参考样式中没有明显的装饰元素，你可以根据需要添加简单的分割线
` : ''}

### 容器样式
${styleRules.container?.fullStyle ? `
- 容器样式（直接复制）：style="${styleRules.container.fullStyle}"
` : styleRules.container?.textAlign ? `
- 对齐：${styleRules.container.textAlign}
` : ''}

${referenceHtml ? `## 📄 参考样式HTML（只学习视觉样式，不要模仿结构！）
\`\`\`html
${refHtmlTrimmed}
\`\`\`
` : ''}
## 输出要求
- 格式：\`\`\`html 开头，\`\`\` 结尾，中间纯HTML
- 标签：section/div/p/strong/span（不要用h1/h2标签，用p+样式代替）
- 禁止：Markdown语法、img标签、[[或]]符号、任何形式的图片标记
- 字数：${minTargetLength}-${maxTargetLength}
- **⚠️ 结构铁律**：每个小标题后必须紧跟至少1段正文内容（禁止空标题、禁止连续标题）
- **正确示例**：<section>小标题</section><section><p>正文内容...</p></section>
- **错误示例**：<section>小标题1</section><section>小标题2</section>（❌ 中间没有正文）`;

    // ========================================
    // 构建用户提示词
    // ========================================
    const similarityTarget = creativityLevel <= 3 ? '50%' : creativityLevel <= 5 ? '60%' : creativityLevel <= 7 ? '70%' : '90%';

    // 根据改写自由度生成具体的改写指导
    const rewriteGuide = creativityLevel <= 3
      ? `**大幅改写模式**：
- 重新组织段落结构，打乱原有顺序
- 用完全不同的表达方式重述观点
- 增加过渡句和连接词，使文章更流畅
- 可以合并或拆分段落，优化阅读节奏
- 用更生动、口语化的语言替换生硬表达`
      : creativityLevel <= 6
      ? `**中度改写模式**：
- 保持原有段落结构，优化语句表达
- 替换重复用词，丰富词汇变化
- 调整句子长度，长短句交替增加节奏感
- 适当增加举例说明，让内容更易懂
- 优化开头和结尾，增强吸引力`
      : `**轻度改写模式**：
- 基本保持原文结构和表达
- 只做必要的语句润色
- 修正不通顺的表达
- 主要是应用排版样式`;

    const userPrompt = `## 原文内容（目标字数：${minTargetLength}-${maxTargetLength}）

标题：${newTitle}

内容：
${originalText}

## 📝 改写指导（自由度：${creativityLevel}/10，目标相似度：${similarityTarget}）
${rewriteGuide}

## ⚠️ 核心要求
1. **必须进行内容改写**，不能直接复制原文
2. 保持原文的核心信息和观点不变
3. 根据原文内容智能决定小标题数量（不要参考任何外部文章的结构）
4. **每个小标题后必须写正文**（至少50字），禁止只写标题不写内容

## 执行步骤
1. **改写内容**：按照改写指导重新表达原文
2. **组织结构**：根据改写后的内容确定小标题
3. **应用样式**：把样式规则中的字体、颜色、间距应用到HTML
4. **输出HTML**：使用 section/div/p/strong 标签`;

    try {
      // 动态调整 temperature
      const dynamicTemperature = Math.max(0.1, Math.min(1.0, 1.1 - creativityLevel * 0.1));

      console.log('[样式迁移] temperature:', dynamicTemperature.toFixed(2));

      const response = await axios.post(
        config.dashscope.apiUrl,
        {
          model: config.dashscope.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: dynamicTemperature,
        },
        {
          headers: {
            'Authorization': `Bearer ${getApiKey()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      let generatedHTML = response.data.choices[0].message.content;
      console.log('[样式迁移] AI返回原始内容长度:', generatedHTML.length);

      // 清理HTML
      generatedHTML = this.cleanGeneratedHTML(generatedHTML);

      // 恢复代码块，应用微信专用样式
      generatedHTML = restoreCodeBlocksWithStyle(generatedHTML);
      console.log('[样式迁移] 恢复代码块后HTML长度:', generatedHTML.length);

      console.log('[样式迁移] 清理后HTML长度:', generatedHTML.length);

      return generatedHTML;
    } catch (error: any) {
      console.error('[样式迁移] 失败:', error.response?.data || error.message);
      throw new Error('样式迁移失败: ' + (error.response?.data?.message || error.message));
    }
  }

  /**
   * 核心原则：移除所有左右间距，让公众号编辑器自己处理
   */
  private cleanGeneratedHTML(html: string): string {
    let cleaned = html;

    console.log('[清理HTML] 原始内容预览:', cleaned.substring(0, 200));

    // 0. 清理所有可能的图片占位符（AI 可能自行生成）
    cleaned = this.cleanAllPlaceholders(cleaned);

    // 1. 移除markdown代码块标记
    cleaned = cleaned.replace(/```html\s*/gi, '');
    cleaned = cleaned.replace(/```\s*$/gi, '');

    // 2. 移除可能的前言说明
    const sectionMatch = cleaned.match(/<section[^>]*>/i);
    if (sectionMatch && sectionMatch.index !== undefined && sectionMatch.index > 0) {
      const beforeSection = cleaned.substring(0, sectionMatch.index);
      if (!beforeSection.includes('<')) {
        cleaned = cleaned.substring(sectionMatch.index);
      }
    }

    // 3. 空内容检查
    const textContent = cleaned.replace(/<[^>]*>/g, '').trim();
    if (textContent.length === 0) {
      console.warn('[清理HTML] 警告：清理后的内容为空！');
    }

    // ========================================
    // 3.5 移除垃圾结构（公众号排版工具的占位符）
    // ========================================

    // 移除零宽度的 SVG 占位符
    cleaned = cleaned.replace(/<svg[^>]*width:\s*0[^>]*>.*?<\/svg>/gi, '');
    cleaned = cleaned.replace(/<svg[^>]*width="0"[^>]*>.*?<\/svg>/gi, '');

    // 递归移除真正空的 section 标签（无内容、无style、无br）
    // 注意：保留带br的section作为段落间距，保留带style的空section作为装饰
    let prevLength = 0;
    while (prevLength !== cleaned.length) {
      prevLength = cleaned.length;
      // 只移除完全空白且无style属性的section
      cleaned = cleaned.replace(/<section(?![^>]*style=)[^>]*>\s*<\/section>/gi, '');
    }

    // 移除真正空的 p 标签（无内容、无br）
    // 保留带br的p标签，这是有意义的空行
    cleaned = cleaned.replace(/<p[^>]*>\s*<\/p>/gi, '');

    // ========================================
    // 4. 表格结构彻底重建（公众号兼容）
    // AI 经常生成极度畸形的表格：<table><th><tr><th><tr><th>...</th></tr></thead>
    // 解决方案：提取所有单元格文本，完全重建表格结构
    // ========================================

    cleaned = cleaned.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_match: string, tableContent: string) => {
      // 标准样式定义
      const tableStyle = 'width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 14px;';
      const thStyle = 'border: 1px solid #ddd; padding: 8px 12px; text-align: left; background-color: #f5f5f5; font-weight: bold;';
      const tdStyle = 'border: 1px solid #ddd; padding: 8px 12px; text-align: left;';

      // 提取单元格：使用非贪婪匹配，只匹配标签内的纯文本内容
      // 模式：<th...>文本内容</th> 或 <td...>文本内容</td>
      // 文本内容不能包含 < 或 >，避免匹配嵌套的畸形标签
      const thCells: string[] = [];
      const tdCells: string[] = [];

      // 匹配 th 单元格（只提取纯文本）
      const thPattern = /<th[^>]*>([^<>]+?)<\/th>/gi;
      let thMatch;
      while ((thMatch = thPattern.exec(tableContent)) !== null) {
        const content = thMatch[1].trim();
        if (content) {
          thCells.push(content);
        }
      }

      // 匹配 td 单元格（只提取纯文本）
      const tdPattern = /<td[^>]*>([^<>]+?)<\/td>/gi;
      let tdMatch;
      while ((tdMatch = tdPattern.exec(tableContent)) !== null) {
        const content = tdMatch[1].trim();
        if (content) {
          tdCells.push(content);
        }
      }

      console.log('[表格重建] 提取到 th:', thCells.length, '个, td:', tdCells.length, '个');
      if (thCells.length > 0) {
        console.log('[表格重建] 表头内容:', thCells);
      }

      // 如果没有提取到任何单元格，返回空表格
      if (thCells.length === 0 && tdCells.length === 0) {
        return '';
      }

      // 开始构建正确的表格结构
      let result = `<table style="${tableStyle}">`;

      // 构建表头行
      if (thCells.length > 0) {
        result += '<thead><tr style="background-color: #f5f5f5;">';
        for (const content of thCells) {
          result += `<th style="${thStyle}">${content}</th>`;
        }
        result += '</tr></thead>';
      }

      // 构建数据行
      if (tdCells.length > 0) {
        result += '<tbody>';

        // 推断列数：如果有表头，列数=表头数量；否则尝试推断
        const colCount = thCells.length > 0 ? thCells.length : Math.max(2, Math.ceil(Math.sqrt(tdCells.length)));

        let currentCol = 0;
        let rowCount = 0;

        for (let i = 0; i < tdCells.length; i++) {
          if (currentCol === 0) {
            // 开始新行
            rowCount++;
            const rowBg = rowCount % 2 === 0 ? ' style="background-color: #fafafa;"' : '';
            result += `<tr${rowBg}>`;
          }

          result += `<td style="${tdStyle}">${tdCells[i]}</td>`;
          currentCol++;

          if (currentCol >= colCount) {
            // 当前行结束
            result += '</tr>';
            currentCol = 0;
          }
        }

        // 如果最后一行没填满，补齐并关闭
        if (currentCol > 0) {
          while (currentCol < colCount) {
            result += `<td style="${tdStyle}"></td>`;
            currentCol++;
          }
          result += '</tr>';
        }

        result += '</tbody>';
      }

      result += '</table>';
      console.log('[表格重建] 重建后的表格:', result.substring(0, 300));
      return result;
    });

    // ========================================
    // 5. 样式清理（保守策略：只移除会与公众号冲突的属性）
    // 保留：padding-top/bottom、margin-top/bottom、width、背景色、装饰属性
    // 移除：padding-left/right、margin-left/right（公众号编辑器控制左右边距）
    // ========================================

    // 清理 section 标签：只移除左右间距，保留上下间距和装饰属性
    cleaned = cleaned.replace(/<section([^>]*)style="([^"]*)"([^>]*)>/gi, (match, before, style, after) => {
      let newStyle = style
        // 只移除左右 padding 和 margin
        .replace(/padding-left:\s*[^;]+;?/gi, '')
        .replace(/padding-right:\s*[^;]+;?/gi, '')
        .replace(/margin-left:\s*[^;]+;?/gi, '')
        .replace(/margin-right:\s*[^;]+;?/gi, '')
        // 清理格式
        .replace(/\s+/g, ' ')
        .replace(/;\s*;/g, ';')
        .trim();

      if (newStyle) {
        return `<section style="${newStyle}">`;
      }
      return `<section>`;
    });

    // 如果没有 section 标签，添加一个干净的
    if (!cleaned.includes('<section')) {
      cleaned = `<section>${cleaned}</section>`;
    }

    // 清理 p 标签：只移除左右间距和首行缩进
    cleaned = cleaned.replace(/<p([^>]*)style="([^"]*)"([^>]*)>/gi, (match, before, style, after) => {
      let newStyle = style
        .replace(/padding-left:\s*[^;]+;?/gi, '')
        .replace(/padding-right:\s*[^;]+;?/gi, '')
        .replace(/margin-left:\s*[^;]+;?/gi, '')
        .replace(/margin-right:\s*[^;]+;?/gi, '')
        .replace(/text-indent:\s*[^;]+;?/gi, '')
        .replace(/\s+/g, ' ')
        .replace(/;\s*;/g, ';')
        .trim();

      if (newStyle) {
        return `<p style="${newStyle}">`;
      }
      return `<p>`;
    });

    // 清理其他标签（h1-h6, div, span 等）：只移除左右间距
    cleaned = cleaned.replace(/<(h[1-6]|div|span|blockquote|ul|li)([^>]*)style="([^"]*)"([^>]*)>/gi, (match, tag, before, style, after) => {
      let newStyle = style
        .replace(/padding-left:\s*[^;]+;?/gi, '')
        .replace(/padding-right:\s*[^;]+;?/gi, '')
        .replace(/margin-left:\s*[^;]+;?/gi, '')
        .replace(/margin-right:\s*[^;]+;?/gi, '')
        .replace(/\s+/g, ' ')
        .replace(/;\s*;/g, ';')
        .trim();

      if (newStyle) {
        return `<${tag} style="${newStyle}">`;
      }
      return `<${tag}>`;
    });

    // 5. 清理开头所有空白和<br>（更彻底）
    // 移除 section 标签后的所有空白和<br>，直到遇到第一个有效内容
    cleaned = cleaned.replace(/(<section[^>]*>)\s*(<br\s*\/?>\s*)*/gi, '$1');

    // 移除第一个 p 标签前的所有空白和<br>
    cleaned = cleaned.replace(/(<section[^>]*>)(\s|<br\s*\/?>)*<p/gi, '$1<p');

    // 移除每个 p 标签内部开头的空白和<br>
    cleaned = cleaned.replace(/(<p[^>]*>)\s*(<br\s*\/?>\s*)*/gi, '$1');

    // 6. 清理结尾空白
    cleaned = cleaned.replace(/\s*(<br\s*\/?>)*\s*(<\/p>)/gi, '$2');
    cleaned = cleaned.replace(/\s*(<br\s*\/?>)*\s*(<\/section>)/gi, '$2');

    // 7. 压缩连续 <br>
    cleaned = cleaned.replace(/(<br\s*\/?>\s*){2,}/gi, '<br/>');

    // 8. 移除段落间多余空白
    cleaned = cleaned.replace(/<\/p>\s*(<br\s*\/?>)*\s*<p/gi, '</p><p');

    // 9. 清理真正空的段落（无任何内容，包括无br）
    // 注意：保留 <p><br/></p> 作为段落间距
    cleaned = cleaned.replace(/<p[^>]*>\s*<\/p>/gi, '');
    // 递归清理完全空的段落
    let prevLen = 0;
    while (prevLen !== cleaned.length) {
      prevLen = cleaned.length;
      cleaned = cleaned.replace(/<p[^>]*>\s*<\/p>/gi, '');
    }

    // 10. 清理公众号编辑器添加的属性
    cleaned = cleaned.replace(/\s*leaf="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\s*visibility:\s*visible;?/gi, '');

    // 11. 修复样式属性格式错误（如 "min- height" → "min-height"）
    cleaned = cleaned.replace(/([a-z])-\s+([a-z])/gi, '$1-$2');
    cleaned = cleaned.replace(/border-\s*border-/gi, 'border-');

    // 12. 移除多余空行
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');

    // 11. 最终表格验证日志
    const firstTableMatch = cleaned.match(/<table[^>]*>[\s\S]{0,500}/i);
    if (firstTableMatch) {
      console.log('[清理HTML] 最终表格预览:', firstTableMatch[0].substring(0, 300));
    }

    console.log('[清理HTML] 清理后内容预览:', cleaned.substring(0, 200));
    console.log('[清理HTML] 清理后内容长度:', cleaned.length);

    return cleaned.trim();
  }

  /**
   * 构建样式复刻指南
   * 根据提取的样式规则和结构信息，生成精确的样式提示词
   */
  private buildStyleGuideSection(
    rules: AbstractStyleRules,
    structure: { hasMainTitle: boolean; hasSubTitle: boolean; hasQuote: boolean; hasList: boolean; hasDivider: boolean; hasEmphasis: boolean }
  ): string {
    const parts: string[] = [];

    // 智能分配提示
    parts.push('**重要**：根据原文内容智能决定各元素的数量，不是复制参考文章的数量！\n');

    // 主标题样式
    if (structure.hasMainTitle && rules.mainTitle) {
      const title = rules.mainTitle;
      parts.push(`### 主标题样式${title.decorationType === 'colorBlock' ? '（彩色背景块）' : ''}`);
      if (title.fullStyle) {
        parts.push(`完整样式：\`${title.fullStyle.substring(0, 300)}\``);
      } else {
        if (title.fontSize) parts.push(`- 字号：${title.fontSize}`);
        if (title.color) parts.push(`- 颜色：${title.color}`);
        if (title.backgroundColor) parts.push(`- 背景色：${title.backgroundColor}`);
        if (title.textAlign) parts.push(`- 对齐：${title.textAlign}`);
      }
      parts.push('');
    }

    // 副标题样式
    if (structure.hasSubTitle && rules.subTitle) {
      const sub = rules.subTitle;
      parts.push(`### 副标题样式${sub.decorationType === 'leftBorder' ? '（左边框装饰）' : sub.decorationType === 'rightBorder' ? '（右边框装饰）' : ''}`);
      if (sub.fullStyle) {
        parts.push(`完整样式：\`${sub.fullStyle.substring(0, 300)}\``);
      } else {
        if (sub.fontSize) parts.push(`- 字号：${sub.fontSize}`);
        if (sub.borderLeft) parts.push(`- 左边框：${sub.borderLeft}`);
        if (sub.borderRight) parts.push(`- 右边框：${sub.borderRight}`);
        if (sub.padding) parts.push(`- 内边距：${sub.padding}`);
      }
      parts.push('');
    }

    // 段落样式
    if (rules.paragraph) {
      parts.push('### 段落样式');
      if (rules.paragraph.lineHeight) parts.push(`- 行高：${rules.paragraph.lineHeight}`);
      if (rules.paragraph.fontSize) parts.push(`- 字号：${rules.paragraph.fontSize}`);
      if (rules.paragraph.color) parts.push(`- 颜色：${rules.paragraph.color}`);
      if (rules.paragraph.textIndent) parts.push(`- 首行缩进：${rules.paragraph.textIndent}`);
      if (rules.paragraph.fullStyle) {
        parts.push(`完整样式：\`${rules.paragraph.fullStyle.substring(0, 200)}\``);
      }
      parts.push('');
    }

    // 引用块样式
    if (structure.hasQuote && rules.quote) {
      const quote = rules.quote;
      parts.push('### 引用块样式（用于突出重要观点/金句）');
      if (quote.fullStyle) {
        parts.push(`完整样式：\`${quote.fullStyle.substring(0, 300)}\``);
      } else {
        if (quote.borderLeft) parts.push(`- 左边框：${quote.borderLeft}`);
        if (quote.backgroundColor) parts.push(`- 背景色：${quote.backgroundColor}`);
        if (quote.fontStyle) parts.push(`- 字体样式：${quote.fontStyle}`);
        if (quote.padding) parts.push(`- 内边距：${quote.padding}`);
      }
      parts.push('- 使用场景：文章中的重要观点、金句、引用内容');
      parts.push('');
    }

    // 分割线
    if (structure.hasDivider && rules.decoration?.dividers?.length) {
      parts.push('### 分割线样式（用于分隔段落）');
      const divider = rules.decoration.dividers[0];
      if (divider.fullStyle) {
        parts.push(`完整样式：\`${divider.fullStyle.substring(0, 150)}\``);
      }
      parts.push('');
    }

    // 主题色
    if (rules.themeColor) {
      parts.push(`### 主题色：${rules.themeColor}`);
      parts.push('- 用于强调文字颜色、边框颜色、背景色等');
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * 【第二阶段】构建模板化样式指南
   * 直接提供 HTML 模板，AI 只需填充内容
   */
  private buildStyleTemplatesSection(
    templates: HtmlTemplates,
    structure: { hasMainTitle: boolean; hasSubTitle: boolean; hasQuote: boolean; hasList: boolean; hasDivider: boolean; hasEmphasis: boolean } | undefined
  ): string {
    const parts: string[] = [];

    // 强调：必须使用模板
    parts.push('🔴 **必须使用以下模板，不要自己编造 HTML 结构！**\n');

    // 主标题模板
    parts.push('### 主标题模板');
    parts.push('```html');
    parts.push(templates.mainTitleTemplate);
    parts.push('```');
    parts.push('- 用法：将 `{TITLE}` 替换为标题文字');
    parts.push('- 文章开头使用一次\n');

    // 🔴 副标题模板（强制使用！）
    parts.push('### 🔴 副标题模板（必须使用！）');
    parts.push('```html');
    parts.push(templates.subTitleTemplate);
    parts.push('```');
    parts.push('- **强制要求**：原文内容超过 300 字时，必须使用副标题组织结构');
    parts.push('- 用法：将 `{TITLE}` 替换为章节标题（从原文内容中提取主题）');
    parts.push('- 插入位置：在主题转换、内容转折、新章节开始处');
    parts.push('- 数量要求：每 3-5 个段落必须使用一个副标题分隔');
    parts.push('- **绝对禁止**：让读者面对一大块没有结构的连续文字\n');

    // 段落模板
    parts.push('### 段落模板');
    parts.push('```html');
    parts.push(templates.paragraphTemplate);
    parts.push('```');
    parts.push('- 用法：将 `{CONTENT}` 替换为段落内容');
    parts.push('- 所有正文段落都使用此模板\n');

    // 引用块模板（如果参考文章有引用块）
    if (structure?.hasQuote) {
      parts.push('### 引用块模板（用于突出重要观点/金句）');
      parts.push('```html');
      parts.push(templates.quoteTemplate);
      parts.push('```');
      parts.push('- 用法：将 `{QUOTE}` 替换为引用内容');
      parts.push('- 当原文有重要观点、金句时使用此模板');
      parts.push('- 智能决定是否需要引用块\n');
    }

    // 分割线模板
    if (structure?.hasDivider) {
      parts.push('### 分割线模板（用于分隔章节）');
      parts.push('```html');
      parts.push(templates.dividerTemplate);
      parts.push('```');
      parts.push('- 用法：直接插入，无需修改');
      parts.push('- 在不同章节之间插入，增加呼吸感\n');
    }

    // 强调文字模板
    parts.push('### 强调文字模板');
    parts.push('```html');
    parts.push(templates.emphasisTemplate);
    parts.push('```');
    parts.push('- 用法：将 `{TEXT}` 替换为需要强调的文字');
    parts.push('- 用于突出关键词、重要信息\n');

    // 主题色
    parts.push(`### 主题色：${templates.themeColor}`);
    parts.push('- 如需额外颜色，优先使用主题色\n');

    // 智能分配要求（强调副标题）
    parts.push('---');
    parts.push('### 🔴 智能分配要求（强制执行）');
    parts.push('');
    parts.push('**副标题使用规则（最重要）**：');
    parts.push('- 🔴 根据原文内容智能提取章节主题，**必须**用副标题组织内容');
    parts.push('- 🔴 原文有多个论点/主题/章节时，**每个主题前必须加副标题**');
    parts.push('- 🔴 长文章（>300字）**必须至少使用 2-3 个副标题**');
    parts.push('- 🔴 不要输出"一整块文字"，必须有结构分隔');
    parts.push('');
    parts.push('**其他规则**：');
    parts.push('- 原文有重要观点/金句时，使用引用块模板突出');
    parts.push('- 章节之间可插入分割线增加阅读体验');

    return parts.join('\n');
  }

  /**
   * AI智能分析文章，找出最佳图片插入位置和每个位置的主题
   * @param articleHtml 文章HTML内容
   * @param imageCount 需要插入的图片数量
   * @returns 插入位置信息数组（percent 为 0-100 的百分比）
   */
  async analyzeImageInsertPoints(
    articleHtml: string,
    imageCount: number
  ): Promise<Array<{ percent: number; theme: string; context: string }>> {
    try {
      // 提取纯文本并分段
      const textContent = articleHtml
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '\n')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // 分段（按句号、感叹号、问号等分割）
      const paragraphs = textContent
        .split(/[。！？\n]+/)
        .map(p => p.trim())
        .filter(p => p.length > 20); // 过滤太短的段落

      const contentForAnalysis = paragraphs.slice(0, 20).join('\n'); // 取前20段分析

      console.log(`[智能配图] 分析文章，共${paragraphs.length}段，需要${imageCount}张配图`);

      const response = await axios.post(
        config.dashscope.apiUrl,
        {
          model: config.dashscope.model,
          messages: [
            {
              role: 'system',
              content: '你是一位资深编辑，擅长分析文章结构并为配图选择最佳插入位置。',
            },
            {
              role: 'user',
              content: `请分析以下文章，为 ${imageCount} 张配图选择最佳插入位置。

## 文章内容
${contentForAnalysis}

## 任务
1. 找出 ${imageCount} 个最适合插入配图的位置
2. 位置用百分比表示（0-100，0=文章开头，100=文章结尾）
3. 为每个位置生成简短的主题描述
4. 选择原则：
   - 优先选择内容转折、场景变化、情感起伏的位置
   - 位置要相对均匀分布（避免全部集中在前/后半部分）
   - 第一张图位置 >= 20%，最后一张图位置 <= 80%

## 输出格式（严格JSON）
[
  {"percent": 25, "theme": "技术突破", "context": "描述该位置前后的内容主题"},
  {"percent": 55, "theme": "未来展望", "context": "描述该位置前后的内容主题"}
]

只返回JSON数组，不要其他文字。`,
            },
          ],
          temperature: 0.3,
        },
        {
          headers: {
            'Authorization': `Bearer ${getApiKey()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = response.data.choices[0].message.content.trim();
      console.log('[智能配图] AI分析结果:', result);

      // 解析JSON
      const insertPoints = JSON.parse(result);

      // 验证格式
      if (!Array.isArray(insertPoints)) {
        throw new Error('AI返回格式错误');
      }

      // 确保数量准确：如果 AI 返回的数量不足，用均匀分布补足
      if (insertPoints.length < imageCount) {
        console.warn(`[智能配图] AI返回${insertPoints.length}个位置，需要${imageCount}个，补足中...`);

        const existingPercents = new Set(insertPoints.map((p: any) => p.percent));

        for (let i = insertPoints.length; i < imageCount; i++) {
          // 计算均匀分布的百分比（10%-90% 范围内）
          const fallbackPercent = Math.round(10 + (i + 1) * 80 / (imageCount + 1));
          if (!existingPercents.has(fallbackPercent)) {
            insertPoints.push({
              percent: fallbackPercent,
              theme: '概念图解',
              context: '补充配图位置'
            });
            existingPercents.add(fallbackPercent);
          }
        }
      }

      return insertPoints.slice(0, imageCount);
    } catch (error: any) {
      console.error('[智能配图] 分析失败:', error.message);
      // 降级方案：均匀分布（使用百分比）
      return Array.from({ length: imageCount }, (_, i) => {
        const percent = Math.round(10 + (i + 1) * 80 / (imageCount + 1));
        return {
          percent,
          theme: '抽象科技',
          context: '文章配图',
        };
      });
    }
  }

  /**
   * 根据主题生成匹配的图片提示词（白板手绘风格 + 卡通人物）
   * [INPUT]: 依赖 dashscope API 的文生图能力
   * [OUTPUT]: 生成智能配图的 prompt 字符串
   * [POS]: AIService 的配图提示词生成器，被 generateSmartImages 调用
   * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
   */
  async generateThemeImagePrompt(theme: string, context: string): Promise<string> {
    // 随机选择一个点缀色
    const spotColors = ['light blue', 'light yellow', 'light green', 'light orange'];
    const spotColor = spotColors[Math.floor(Math.random() * spotColors.length)];

    // 根据主题选择合适的简笔画图标
    const iconMap: Record<string, string[]> = {
      '技术': ['gear', 'circuit board', 'computer chip'],
      '数据': ['bar chart', 'line graph', 'magnifying glass'],
      '时间': ['calendar', 'clock', 'hourglass'],
      '成长': ['upward arrow', 'growing plant', 'stairs'],
      '团队': ['people icons', 'handshake', 'network nodes'],
      '创新': ['lightbulb', 'rocket', 'spark'],
      '安全': ['shield', 'lock', 'checkmark'],
      '金融': ['coins', 'piggy bank', 'dollar sign'],
      '教育': ['book', 'graduation cap', 'pencil'],
      '默认': ['star', 'circle', 'box with shadow'],
    };

    // ========================================
    // 卡通人物映射表（与主题匹配）
    // 风格：扁平卡通（flat cartoon），与白板手绘风格融合
    // ========================================
    const personMap: Record<string, {
      style: string;
      action: string;
      expression: string;
      outfit: string;
    }> = {
      '技术': {
        style: 'tech person character',
        action: 'typing on keyboard, coding at workstation',
        expression: 'focused expression with determined eyes',
        outfit: 'casual hoodie and glasses'
      },
      '数据': {
        style: 'data analyst character',
        action: 'pointing at charts, examining data visualization',
        expression: 'curious expression with raised eyebrow',
        outfit: 'professional shirt with headset'
      },
      '时间': {
        style: 'planner character',
        action: 'checking calendar, organizing schedule',
        expression: 'calm expression with confident smile',
        outfit: 'business casual attire with watch'
      },
      '成长': {
        style: 'achiever character',
        action: 'climbing stairs upward, celebrating success',
        expression: 'happy expression with big smile',
        outfit: 'sporty outfit with sneakers'
      },
      '团队': {
        style: 'team members characters',
        action: 'high-fiving together, collaborating',
        expression: 'friendly expressions with smiles',
        outfit: 'matching team t-shirts'
      },
      '创新': {
        style: 'creative thinker character',
        action: 'holding glowing lightbulb, having bright idea',
        expression: 'excited expression with sparkly eyes',
        outfit: 'creative outfit with colorful scarf'
      },
      '安全': {
        style: 'guardian character',
        action: 'holding shield protectively, guarding data',
        expression: 'serious expression with alert eyes',
        outfit: 'security uniform with badge'
      },
      '金融': {
        style: 'investor character',
        action: 'analyzing coins, checking growth chart',
        expression: 'thoughtful expression with slight smile',
        outfit: 'formal suit with tie'
      },
      '教育': {
        style: 'teacher student character',
        action: 'reading book, presenting concept',
        expression: 'engaged expression, attentive',
        outfit: 'smart casual with backpack'
      },
      '默认': {
        style: 'presenter character',
        action: 'explaining concept, gesturing welcome',
        expression: 'confident expression with welcoming smile',
        outfit: 'professional business attire'
      }
    };

    // 匹配图标和人物
    let icons = iconMap['默认'];
    let person = personMap['默认'];
    for (const [key, value] of Object.entries(iconMap)) {
      if (theme.includes(key) || context.includes(key)) {
        icons = value;
        person = personMap[key] || personMap['默认'];
        break;
      }
    }

    // ========================================
    // 构建白板手绘 + 卡通人物融合风格提示词
    // 关键修复：移除所有中文词，避免 AI 把文字画到图片上
    // ========================================
    const prompt = `A hand-drawn whiteboard concept diagram for business article.
- Minimalist sketch style with black marker lines on clean white background
- Very subtle ${spotColor} spot color highlights for emphasis only
- Simple doodle icons: ${icons.join(', ')} connected by hand-drawn arrows
- A cute flat cartoon character ${person.action}, ${person.style}
- The character has ${person.expression}, wearing ${person.outfit}
- Character size is proportionate to icons, integrated naturally into the diagram
- Use ${spotColor} accent color on character's accessory or clothing detail
- Short motion lines around icons and character to suggest action or emphasis
- Clean, educational, logical top-down layout with plenty of white space
- CRITICAL: NO text, NO words, NO letters, NO characters of ANY language
- NO watermarks, NO logos, NO signatures
- Professional illustration style suitable for business article`;

    console.log(`[智能配图] 白板风格提示词: ${prompt}`);
    return prompt;
  }

  /**
   * 智能生成配图并插入到HTML中（简化版）
   * [INPUT]: 依赖 dashscope 文生图 API
   * [OUTPUT]: 返回包含配图的 HTML 和图片 URL 数组
   * [POS]: AIService 的智能配图核心方法，被 recreateController/recreateWorker 调用
   * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
   *
   * 核心改进（2024重构）：
   * 1. 删除复杂的智能定位，改用简单的 section 均匀分布
   * 2. 只在 </section> 后插入，永远不打断标签
   * 3. 使用统一清理函数清理所有格式占位符
   */
  async generateSmartImages(
    articleHtml: string,
    imageCount: number
  ): Promise<{ html: string; images: string[] }> {
    console.log(`[智能配图] 开始生成 ${imageCount} 张配图`);

    // 清理所有占位符
    let html = this.cleanAllPlaceholders(articleHtml);
    console.log('[智能配图] 已清理所有占位符');

    if (imageCount <= 0) {
      return { html, images: [] };
    }

    // ========================================
    // Step 1: 串行生成图片（带重试 + 限流保护）
    // ========================================
    const images: string[] = [];
    const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

    // 重试等待时间：10s, 30s, 60s（针对通义千问 API 限流优化）
    const retryDelays = [10000, 30000, 60000];

    for (let i = 0; i < imageCount; i++) {
      // 非第一张图片，先等待 20 秒（限流保护）
      if (i > 0) {
        console.log(`[智能配图] 等待 20s 后生成下一张图片...`);
        await new Promise(resolve => setTimeout(resolve, 20000));
      }

      // 带重试的图片生成
      let imageUrl: string | null = null;
      for (let retry = 0; retry < 3; retry++) {
        try {
          console.log(`[智能配图] 🔄 生成第 ${i + 1}/${imageCount} 张 (尝试 ${retry + 1}/3)`);
          const prompt = await this.generateThemeImagePrompt('配图', textContent);
          imageUrl = await this.generateImage(prompt);
          console.log(`[智能配图] ✅ 第 ${i + 1} 张成功`);
          break;
        } catch (e: any) {
          console.error(`[智能配图] ❌ 第 ${i + 1} 张尝试 ${retry + 1}/3 失败:`, e.message);
          if (retry < 2) {
            const waitTime = retryDelays[retry] || 60000;
            console.log(`[智能配图] 等待 ${waitTime / 1000}s 后重试...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      if (imageUrl) {
        images.push(imageUrl);
      } else {
        console.error(`[智能配图] 第 ${i + 1} 张所有重试均失败，跳过`);
      }
    }

    if (images.length === 0) {
      console.warn('[智能配图] 所有图片生成失败');
      return { html, images: [] };
    }

    // ========================================
    // Step 2: 使用简单的均匀分布插入图片
    // 核心原则：只在 </section> 后插入，永远不打断标签
    // ========================================
    const resultHtml = this.insertImagesEvenly(html, images);

    // ========================================
    // Step 3: 统一清理所有占位符
    // ========================================
    const finalHtml = this.cleanAllPlaceholders(resultHtml);

    console.log(`[智能配图] 🎉 完成，成功 ${images.length}/${imageCount} 张`);
    return { html: finalHtml, images };
  }

  /**
   * 找到"一级子 section"的边界位置
   * 核心逻辑：找到直接作为最外层 section 子元素的 section 结束位置
   * 这些才是真正的"主要章节"分隔点，不是深层嵌套的 section
   */
  private findChapterBoundaries(html: string): number[] {
    const boundaries: number[] = [];
    let depth = 0;
    let i = 0;

    while (i < html.length) {
      if (html.slice(i, i + 8).toLowerCase() === '<section') {
        depth++;
        const closeIdx = html.indexOf('>', i);
        if (closeIdx === -1) break;
        i = closeIdx + 1;
        continue;
      }

      if (html.slice(i, i + 10).toLowerCase() === '</section>') {
        // 在 depth=2 时（一级子 section 结束）记录边界
        // 这是真正的章节分隔点
        if (depth === 2) {
          boundaries.push(i + 10);
        }
        depth--;
        i += 10;
        continue;
      }

      i++;
    }

    console.log(`[图片插入] 找到 ${boundaries.length} 个一级子 section 边界 (depth=2)`);
    return boundaries;
  }

  /**
   * 按一阶子 section 边界均匀分布插入图片
   * 核心改进：在主要章节之间插入，而不是追加到文章末尾
   */
  private insertImagesEvenly(html: string, images: string[]): string {
    if (images.length === 0) return html;

    // 1. 找到主要章节 section 的边界位置
    const boundaries = this.findChapterBoundaries(html);

    console.log(`[图片插入] 找到 ${boundaries.length} 个章节边界`);

    if (boundaries.length === 0) {
      // 没有 section，在末尾追加
      console.log(`[图片插入] 无章节边界，末尾追加`);
      return html + images.map(url => this.createImageHtml(url)).join('');
    }

    // 2. 如果边界数量少于图片数量，每个边界后插入一张，剩余追加末尾
    if (boundaries.length < images.length) {
      console.log(`[图片插入] 边界(${boundaries.length}) < 图片(${images.length})，部分追加末尾`);
    }

    // 3. 计算均匀分布的插入点（跳过第一个边界，避免图片出现在开头）
    const usableBoundaries = boundaries.slice(1); // 跳过第一个边界
    const insertPositions: number[] = [];

    if (usableBoundaries.length === 0) {
      // 只有一个边界，追加末尾
      return html + images.map(url => this.createImageHtml(url)).join('');
    }

    const step = Math.max(1, Math.floor(usableBoundaries.length / images.length));

    for (let i = 0; i < images.length; i++) {
      const idx = Math.min(step * i, usableBoundaries.length - 1);
      insertPositions.push(usableBoundaries[idx]);
    }

    console.log(`[图片插入] 插入位置:`, insertPositions);

    // 4. 从后往前插入（避免位置偏移）
    let result = html;
    const uniquePositions = [...new Set(insertPositions)].sort((a, b) => b - a);

    for (const pos of uniquePositions) {
      // 找到这个位置对应的所有图片
      const imagesForPos = images.filter((_, idx) => insertPositions[idx] === pos);
      for (const imageUrl of imagesForPos.reverse()) {
        const imageHtml = this.createImageHtml(imageUrl);
        result = result.slice(0, pos) + imageHtml + result.slice(pos);
        console.log(`[图片插入] 在位置 ${pos} 插入图片`);
      }
    }

    return result;
  }

  /**
   * 创建图片 HTML 元素
   */
  private createImageHtml(url: string): string {
    return `\n<section style="text-align: center; margin: 20px 0;">
  <img src="${url}" alt="AI配图" style="max-width: 100%; height: auto; border-radius: 8px;" />
</section>\n`;
  }

  /**
   * 使用通义千问文生图API生成图片
   * @param prompt 图片提示词（≤800字符）
   * @param size 图片尺寸：'1664*928'(16:9)、'1472*1104'(4:3)、'1328*1328'(1:1)
   * @returns 图片URL
   */
  async generateImage(
    prompt: string,
    size: '1024*576' | '1664*928' | '1472*1104' | '1328*1328' = '1024*576' // 默认使用更小尺寸避免超过1MB
  ): Promise<string> {
    try {
      console.log('[配图] 正在调用通义千问文生图API...');
      console.log('[配图] 提示词:', prompt);
      console.log('[配图] 图片尺寸:', size);

      const response = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
        {
          model: 'qwen-image-max', // 使用最高质量的模型
          input: {
            messages: [
              {
                role: 'user',
                content: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          },
          parameters: {
            size: size,
            prompt_extend: true, // 自动优化提示词
            watermark: false, // 不添加水印
            negative_prompt: '文字,水印,标志,商标,低质量,模糊,变形,丑陋', // 负面提示词
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${getApiKey()}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60秒超时
        }
      );

      // 提取图片URL
      const imageUrl = response.data.output.choices[0].message.content[0].image;
      console.log('[配图] ✅ 图片生成成功:', imageUrl);
      console.log('[配图] ⚠️  注意：图片URL有效期24小时');

      return imageUrl;
    } catch (error: any) {
      console.error('[配图] ❌ 图片生成失败:', error.response?.data || error.message);
      throw new Error('图片生成失败: ' + (error.response?.data?.message || error.message));
    }
  }

  /**
   * 统一清理所有占位符格式
   * 支持：[[IMAGE_1]], [[IMAGE_PLACEHOLDER_1]], [IMG_1], IMAGE_PLACEHOLDER_1 等
   */
  cleanAllPlaceholders(html: string): string {
    console.log('[清理占位符] 输入长度:', html.length);

    // 检查输入中是否包含占位符关键词
    const hasPlaceholder = html.includes('IMAGE_PLACEHOLDER') ||
                           html.includes('[[IMAGE') ||
                           html.includes('[IMG_');
    console.log('[清理占位符] 输入包含占位符:', hasPlaceholder);

    // 同时匹配所有可能的占位符格式
    const patterns = [
      /\[\[IMAGE[_.\s\w]*\d+\]\]/gi,    // [[IMAGE_1]], [[IMAGE_PLACEHOLDER_1]]
      /\[IMG_\d+\]/gi,                   // [IMG_1]
      /:?\[\[IMAGE[_.\s\w]*\d+\]\]/gi,  // :[[IMAGE_1]]
      /IMAGE_PLACEHOLDER_\d+/gi,         // IMAGE_PLACEHOLDER_1（无括号）
    ];

    let cleaned = html;
    let matchCount = 0;

    patterns.forEach((pattern, idx) => {
      const matches = cleaned.match(pattern);
      if (matches) {
        matchCount += matches.length;
        console.log(`[清理占位符] 模式${idx + 1}匹配到:`, matches.slice(0, 5).join(', ') + (matches.length > 5 ? `... 共${matches.length}个` : ''));
      }
      cleaned = cleaned.replace(pattern, '');
    });

    // 验证清理后是否还有残留
    const stillHasPlaceholder = cleaned.includes('IMAGE_PLACEHOLDER') ||
                                cleaned.includes('[[IMAGE') ||
                                cleaned.includes('[IMG_');
    if (stillHasPlaceholder) {
      console.error('[清理占位符] ⚠️ 警告：清理后仍有残留占位符！');
      // 输出残留位置的上下文
      const residualMatch = cleaned.match(/.{50}(IMAGE_PLACEHOLDER|\[\[IMAGE|\[IMG_).{50}/i);
      if (residualMatch) {
        console.error('[清理占位符] 残留上下文:', residualMatch[0]);
      }
    }

    console.log('[清理占位符] 共清理', matchCount, '个占位符，清理后长度:', cleaned.length);
    return cleaned;
  }

  // ========================================
  // 选题洞察 AI 方法
  // ========================================

  /**
   * 分析单篇文章，提取结构化摘要
   */
  async analyzeArticleSummary(article: {
    title: string;
    content: string;
    read_count: number;
    like_count: number;
  }): Promise<{
    theme: string;
    keyPoints: string[];
    keywords: string[];
    highlights: string[];
    targetAudience: string;
  }> {
    const contentPreview = article.content?.replace(/<[^>]*>/g, '').substring(0, 500) || '';

    const response = await axios.post(
      config.dashscope.apiUrl,
      {
        model: config.dashscope.model,
        messages: [
          {
            role: 'system',
            content: '你是一个内容分析专家。请分析公众号文章，提取关键信息。只输出 JSON，不要其他文字。',
          },
          {
            role: 'user',
            content: `请分析以下公众号文章，提取关键信息：

文章标题：${article.title}
文章内容：${contentPreview}
阅读量：${article.read_count}
点赞数：${article.like_count}

请以纯 JSON 格式输出（不要 markdown 代码块）：
{
  "theme": "核心主题（一句话概括）",
  "keyPoints": ["关键信息点1", "关键信息点2", "关键信息点3"],
  "keywords": ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"],
  "highlights": ["内容亮点1", "内容亮点2"],
  "targetAudience": "目标受众描述"
}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      },
      {
        headers: {
          'Authorization': `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = response.data.choices[0].message.content;
    // 清理可能的 markdown 代码块标记
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      return JSON.parse(jsonStr);
    } catch {
      console.error('[文章摘要] JSON 解析失败:', jsonStr);
      return {
        theme: article.title,
        keyPoints: [],
        keywords: [],
        highlights: [],
        targetAudience: '',
      };
    }
  }

  /**
   * 基于文章摘要生成选题洞察
   */
  async generateTopicInsights(params: {
    keyword: string;
    articleSummaries: Array<{
      theme: string;
      keyPoints: string[];
      keywords: string[];
      highlights: string[];
      targetAudience: string;
    }>;
    stats: {
      totalArticles: number;
      avgReadCount: number;
      topKeywords: string[];
    };
  }): Promise<Array<{
    category: string;
    title: string;
    description: string;
    evidence: string[];
    suggestion?: string;
  }>> {
    const summariesText = params.articleSummaries
      .map((s, i) => `${i + 1}. 主题: ${s.theme}\n   关键词: ${s.keywords.join(', ')}\n   亮点: ${s.highlights.join('; ')}`)
      .join('\n\n');

    const response = await axios.post(
      config.dashscope.apiUrl,
      {
        model: config.dashscope.model,
        messages: [
          {
            role: 'system',
            content: `你是一个新媒体运营专家，擅长分析内容趋势和选题策略。
请生成结构化的选题洞察，帮助创作者了解话题热点和创作方向。
输出必须是纯 JSON 数组，不要 markdown 代码块。`,
          },
          {
            role: 'user',
            content: `基于以下文章分析数据，生成选题洞察：

搜索关键词：${params.keyword}
文章总数：${params.stats.totalArticles}
平均阅读量：${params.stats.avgReadCount}
高频关键词：${params.stats.topKeywords.join(', ')}

文章摘要列表：
${summariesText}

请生成至少5条结构化的选题洞察，每条包含：
- category: 分类，必须是以下之一："趋势"、"痛点"、"策略"、"机会"
- title: 洞察标题（简洁有力）
- description: 详细描述（2-3句话）
- evidence: 支撑证据数组（引用具体数据或案例）
- suggestion: 可选的行动建议

输出格式（纯 JSON，不要代码块）：
[
  {
    "category": "趋势",
    "title": "xxx",
    "description": "xxx",
    "evidence": ["证据1", "证据2"],
    "suggestion": "建议"
  }
]`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      },
      {
        headers: {
          'Authorization': `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = response.data.choices[0].message.content;
    // 清理可能的 markdown 代码块标记
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const insights = JSON.parse(jsonStr);
      return Array.isArray(insights) ? insights : [];
    } catch {
      console.error('[选题洞察] JSON 解析失败:', jsonStr);
      // 返回默认洞察
      return [
        {
          category: '趋势',
          title: `${params.keyword}话题持续受到关注`,
          description: `共分析 ${params.stats.totalArticles} 篇相关文章，平均阅读量 ${params.stats.avgReadCount}`,
          evidence: [`高频关键词: ${params.stats.topKeywords.slice(0, 3).join(', ')}`],
        },
      ];
    }
  }
}

// 导出单例
export const aiService = new AIService();
