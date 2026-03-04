/**
 * [INPUT]: 依赖 CrawlerService、cheerio
 * [OUTPUT]: 对外提供 StyleService 类，完整的样式提取功能
 * [POS]: services服务层，负责样式提取、结构分析和模板生成
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import * as cheerio from 'cheerio';
import { crawlerService } from './CrawlerService';
import { StyleResult, AbstractStyleRules, DecorationDescriptor, HtmlTemplates } from '../types';

// ============================================================================
// 文章结构信息（用于智能分配）
// ============================================================================
export interface ArticleStructure {
  hasMainTitle: boolean;       // 是否有主标题
  hasSubTitle: boolean;        // 是否有副标题
  hasQuote: boolean;           // 是否有引用块
  hasList: boolean;            // 是否有列表
  hasDivider: boolean;         // 是否有分割线
  hasEmphasis: boolean;        // 是否有强调元素
}

export class StyleService {
  /**
   * 从参考文章中提取样式
   */
  async extractFromUrl(url: string): Promise<StyleResult> {
    // 爬取参考文章
    const crawled = await crawlerService.crawlWechatArticle(url);

    // 提取样式
    const $ = cheerio.load(crawled.html);

    // 提取CSS样式
    const css = this.extractCSS($);

    // 生成HTML模板
    const htmlTemplate = this.generateTemplate($);

    return {
      css,
      htmlTemplate,
      images: crawled.images,
    };
  }

  /**
   * 提取完整的抽象样式规则
   * 用于样式迁移模式：提取视觉属性，AI智能应用到新内容
   */
  extractAbstractStyleRules(html: string): AbstractStyleRules {
    const $ = cheerio.load(html);

    return {
      // 主标题样式（彩色背景块等）
      mainTitle: this.extractMainTitleStyle($),

      // 副标题样式（左/右边框装饰）
      subTitle: this.extractSubTitleStyle($),

      // 段落样式
      paragraph: this.extractParagraphStyle($),

      // 容器样式
      container: this.extractContainerStyle($),

      // 标题样式（兼容旧版）
      heading: this.extractHeadingStyle($),

      // 强调样式
      emphasis: this.extractEmphasisStyle($),

      // 引用块样式
      quote: this.extractQuoteStyle($),

      // 装饰元素
      decoration: this.extractDecorationElements($),

      // 主题色
      themeColor: this.extractThemeColor($),

      // 整体风格描述
      styleDescription: this.describeStyle($),
    };
  }

  /**
   * 提取文章结构信息
   * 用于告诉 AI 参考文章有哪些元素类型
   */
  extractStructure(html: string): ArticleStructure {
    const $ = cheerio.load(html);

    return {
      hasMainTitle: this.detectMainTitle($),
      hasSubTitle: this.detectSubTitle($),
      hasQuote: this.detectQuote($),
      hasList: this.detectList($),
      hasDivider: this.detectDivider($),
      hasEmphasis: this.detectEmphasis($),
    };
  }

  // ============================================================================
  // 私有方法：样式提取
  // ============================================================================

  /**
   * 提取CSS样式（基础版）
   */
  private extractCSS($: cheerio.CheerioAPI): string {
    const styles: string[] = [];

    // 提取内联样式
    $('*[style]').each((i, elem) => {
      const style = $(elem).attr('style');
      if (style) {
        styles.push(style);
      }
    });

    // 返回基础样式规则
    return `
      .rich_media_content {
        font-size: 16px;
        line-height: 1.8;
        color: #333;
      }
      .rich_media_content p {
        margin: 10px 0;
      }
      .rich_media_content img {
        max-width: 100%;
        height: auto;
      }
    `;
  }

  /**
   * 生成HTML模板
   */
  private generateTemplate($: cheerio.CheerioAPI): string {
    return `
      <section class="rich_media_content">
        <!-- 内容将插入这里 -->
      </section>
    `;
  }

  /**
   * 提取主标题样式
   * 检测：大字号、彩色背景、居中对齐
   */
  private extractMainTitleStyle($: cheerio.CheerioAPI): AbstractStyleRules['mainTitle'] {
    // 查找大字号元素
    let mainTitleStyle: AbstractStyleRules['mainTitle'] = {
      fontSize: '24px',
      color: '#333333',
      decorationType: 'none',
    };

    // 检测 h1 或大字号 section
    $('h1, section, p').each((i, elem) => {
      const $elem = $(elem);
      const style = $elem.attr('style') || '';
      const text = $elem.text().trim();

      // 跳过太短或太长的文本
      if (text.length < 3 || text.length > 50) return;

      // 检测大字号
      const fontSizeMatch = style.match(/font-size:\s*(\d+)px/i);
      if (fontSizeMatch && parseInt(fontSizeMatch[1]) >= 20) {
        // 检测是否有背景色（彩色标题块）
        const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/i);

        mainTitleStyle = {
          fontSize: fontSizeMatch[1] + 'px',
          color: this.extractColorFromStyle(style) || '#333333',
          backgroundColor: bgMatch ? bgMatch[1].trim() : undefined,
          textAlign: style.includes('text-align: center') ? 'center' : 'left',
          fontWeight: style.includes('font-weight: bold') || style.includes('font-weight: 700') ? 'bold' : undefined,
          fullStyle: style,
          decorationType: bgMatch ? 'colorBlock' : 'none',
          decorations: bgMatch ? [{
            name: 'title-bg-block',
            position: 'background',
            fullStyle: `background-color: ${bgMatch[1].trim()}`,
            htmlExample: `<section style="${style}"><span>${text}</span></section>`,
          }] : undefined,
        };

        return false; // 找到后停止
      }
    });

    return mainTitleStyle;
  }

  /**
   * 提取副标题样式
   * 检测：中等字号、左/右边框装饰
   */
  private extractSubTitleStyle($: cheerio.CheerioAPI): AbstractStyleRules['subTitle'] {
    let subStyle: AbstractStyleRules['subTitle'] = {
      fontSize: '18px',
      color: '#333333',
      decorationType: 'none',
    };

    // 检测 h2、h3 或带边框的 section
    $('h2, h3, section').each((i, elem) => {
      const $elem = $(elem);
      const style = $elem.attr('style') || '';
      const text = $elem.text().trim();

      if (text.length < 3 || text.length > 30) return;

      // 检测边框装饰
      const borderLeftMatch = style.match(/border-left:\s*([^;]+)/i);
      const borderRightMatch = style.match(/border-right:\s*([^;]+)/i);

      if (borderLeftMatch || borderRightMatch) {
        const fontSizeMatch = style.match(/font-size:\s*(\d+)px/i);

        subStyle = {
          fontSize: fontSizeMatch ? fontSizeMatch[1] + 'px' : '18px',
          color: this.extractColorFromStyle(style) || '#333333',
          borderLeft: borderLeftMatch ? borderLeftMatch[1].trim() : undefined,
          borderLeftColor: borderLeftMatch ? this.extractBorderColor(borderLeftMatch[1]) : undefined,
          borderRight: borderRightMatch ? borderRightMatch[1].trim() : undefined,
          borderRightColor: borderRightMatch ? this.extractBorderColor(borderRightMatch[1]) : undefined,
          fontWeight: style.includes('font-weight: bold') ? 'bold' : undefined,
          padding: this.extractPaddingFromStyle(style),
          fullStyle: style,
          decorationType: borderLeftMatch ? 'leftBorder' : borderRightMatch ? 'rightBorder' : 'none',
          decorations: [{
            name: borderLeftMatch ? 'left-border' : 'right-border',
            position: borderLeftMatch ? 'left' : 'right',
            fullStyle: borderLeftMatch ? `border-left: ${borderLeftMatch[1]}` : `border-right: ${borderRightMatch![1]}`,
            htmlExample: `<section style="${style}"><span>${text}</span></section>`,
          }],
        };

        return false;
      }
    });

    return subStyle;
  }

  /**
   * 提取段落样式
   */
  private extractParagraphStyle($: cheerio.CheerioAPI): AbstractStyleRules['paragraph'] {
    // 统计最常见的段落样式
    const styleStats: Map<string, number> = new Map();

    $('p, section').each((i, elem) => {
      const $elem = $(elem);
      const style = $elem.attr('style') || '';
      const text = $elem.text().trim();

      // 跳过太短的文本
      if (text.length < 20) return;

      // 提取关键样式属性
      const lineHeight = style.match(/line-height:\s*([^;]+)/i);
      const fontSize = style.match(/font-size:\s*(\d+)px/i);
      const color = this.extractColorFromStyle(style);
      const letterSpacing = style.match(/letter-spacing:\s*([^;]+)/i);
      const textAlign = style.match(/text-align:\s*([^;]+)/i);
      const textIndent = style.match(/text-indent:\s*([^;]+)/i);

      const key = [
        lineHeight?.[1] || '',
        fontSize?.[1] || '',
        color || '',
      ].join('|');

      styleStats.set(key, (styleStats.get(key) || 0) + 1);
    });

    // 找出最常见的样式
    let mostCommon = { key: '', count: 0 };
    styleStats.forEach((count, key) => {
      if (count > mostCommon.count) {
        mostCommon = { key, count };
      }
    });

    const [lineHeight, fontSize, color] = mostCommon.key.split('|');

    return {
      fontSize: fontSize || '16px',
      lineHeight: lineHeight || '1.8',
      color: color || '#4a4a4a',
      letterSpacing: undefined,
      textAlign: undefined,
      textIndent: undefined,
    };
  }

  /**
   * 提取容器样式
   */
  private extractContainerStyle($: cheerio.CheerioAPI): AbstractStyleRules['container'] {
    const $container = $('#js_content, .rich_media_content, section').first();
    const style = $container.attr('style') || '';

    return {
      textAlign: style.match(/text-align:\s*([^;]+)/i)?.[1],
      maxWidth: style.match(/max-width:\s*([^;]+)/i)?.[1],
      backgroundColor: style.match(/background(?:-color)?:\s*([^;]+)/i)?.[1],
      padding: this.extractPaddingFromStyle(style),
    };
  }

  /**
   * 提取标题样式（兼容旧版）
   */
  private extractHeadingStyle($: cheerio.CheerioAPI): AbstractStyleRules['heading'] {
    return {
      fontSize: '18px',
    };
  }

  /**
   * 提取强调样式
   */
  private extractEmphasisStyle($: cheerio.CheerioAPI): AbstractStyleRules['emphasis'] {
    let emphasisStyle: AbstractStyleRules['emphasis'] = {};

    // 检测 strong 或标记颜色的元素
    $('strong, [style*="color"]').each((i, elem) => {
      const $elem = $(elem);
      const style = $elem.attr('style') || '';

      if (style.includes('color')) {
        const colorMatch = style.match(/(?:^|;)\s*color:\s*([^;]+)/i);
        if (colorMatch) {
          emphasisStyle.color = colorMatch[1].trim();
          return false;
        }
      }
    });

    return emphasisStyle;
  }

  /**
   * 提取引用块样式
   */
  private extractQuoteStyle($: cheerio.CheerioAPI): AbstractStyleRules['quote'] | undefined {
    let quoteStyle: AbstractStyleRules['quote'] | undefined;

    // 检测 blockquote 或带左边框的元素
    $('blockquote, [style*="border-left"]').each((i, elem) => {
      const $elem = $(elem);
      const style = $elem.attr('style') || '';
      const text = $elem.text().trim();

      if (text.length < 10) return;

      const borderLeftMatch = style.match(/border-left:\s*([^;]+)/i);
      const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/i);
      const fontSizeMatch = style.match(/font-size:\s*(\d+)px/i);

      quoteStyle = {
        fontSize: fontSizeMatch ? fontSizeMatch[1] + 'px' : '15px',
        color: this.extractColorFromStyle(style) || '#666666',
        fontStyle: style.includes('font-style: italic') ? 'italic' : undefined,
        borderLeft: borderLeftMatch ? borderLeftMatch[1].trim() : undefined,
        backgroundColor: bgMatch ? bgMatch[1].trim() : undefined,
        padding: this.extractPaddingFromStyle(style),
        fullStyle: style,
      };

      return false;
    });

    return quoteStyle;
  }

  /**
   * 提取装饰元素
   */
  private extractDecorationElements($: cheerio.CheerioAPI): AbstractStyleRules['decoration'] {
    const elements: DecorationDescriptor[] = [];
    const dividers: DecorationDescriptor[] = [];
    const quoteBlocks: DecorationDescriptor[] = [];

    // 检测分割线（高度很小的色块）
    $('section, div').each((i, elem) => {
      const $elem = $(elem);
      const style = $elem.attr('style') || '';
      const text = $elem.text().trim();

      // 分割线：高度小、有背景色、无文字
      if (text.length === 0) {
        const heightMatch = style.match(/height:\s*(\d+)px/i);
        const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/i);

        if (heightMatch && parseInt(heightMatch[1]) <= 5 && bgMatch) {
          dividers.push({
            name: 'divider',
            position: 'custom',
            fullStyle: style,
            htmlExample: `<section style="${style}"></section>`,
          });
        }
      }

      // 引用块装饰
      if (style.includes('border-left') && text.length > 10) {
        const borderMatch = style.match(/border-left:\s*([^;]+)/i);
        if (borderMatch) {
          quoteBlocks.push({
            name: 'quote-block',
            position: 'left',
            fullStyle: style,
            cssProperties: {
              borderLeft: borderMatch[1].trim(),
            },
            htmlExample: `<section style="${style}">${text.substring(0, 30)}...</section>`,
          });
        }
      }
    });

    return {
      elements,
      dividers,
      quoteBlocks,
    };
  }

  /**
   * 提取主题色
   */
  private extractThemeColor($: cheerio.CheerioAPI): string {
    // 收集所有颜色
    const colors: string[] = [];

    $('*').each((i, elem) => {
      const style = $(elem).attr('style') || '';

      // 提取颜色
      const colorMatch = style.match(/(?:^|;)\s*color:\s*([^;]+)/i);
      const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/i);
      const borderMatch = style.match(/border-(?:left|right|top|bottom)(?:-color)?:\s*([^;]+)/i);

      if (colorMatch) colors.push(colorMatch[1].trim());
      if (bgMatch && !bgMatch[1].includes('transparent') && !bgMatch[1].includes('fff')) {
        colors.push(bgMatch[1].trim());
      }
      if (borderMatch) colors.push(borderMatch[1].trim());
    });

    // 统计最常见的非黑白灰颜色
    const colorCount: Map<string, number> = new Map();
    colors.forEach(color => {
      // 过滤黑白灰
      if (color.match(/#fff|white|black|#000|gray|rgb\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/i)) {
        return;
      }
      const normalized = color.toLowerCase();
      colorCount.set(normalized, (colorCount.get(normalized) || 0) + 1);
    });

    // 返回最常见的颜色
    let maxColor = '#d97757'; // 默认主题色
    let maxCount = 0;
    colorCount.forEach((count, color) => {
      if (count > maxCount) {
        maxCount = count;
        maxColor = color;
      }
    });

    return maxColor;
  }

  /**
   * 描述整体风格
   */
  private describeStyle($: cheerio.CheerioAPI): string {
    // 简单的风格描述
    return '微信公众号风格';
  }

  // ============================================================================
  // 私有方法：结构检测
  // ============================================================================

  private detectMainTitle($: cheerio.CheerioAPI): boolean {
    let found = false;
    $('h1, section, p').each((i, elem) => {
      const style = $(elem).attr('style') || '';
      const fontSizeMatch = style.match(/font-size:\s*(\d+)px/i);
      if (fontSizeMatch && parseInt(fontSizeMatch[1]) >= 20) {
        found = true;
        return false;
      }
    });
    return found;
  }

  private detectSubTitle($: cheerio.CheerioAPI): boolean {
    return $('h2, h3').length > 0 ||
           $('[style*="border-left"], [style*="border-right"]').length > 0;
  }

  private detectQuote($: cheerio.CheerioAPI): boolean {
    return $('blockquote').length > 0 ||
           $('[style*="border-left"][style*="background"]').length > 0;
  }

  private detectList($: cheerio.CheerioAPI): boolean {
    return $('ul, ol, li').length > 0;
  }

  private detectDivider($: cheerio.CheerioAPI): boolean {
    let found = false;
    $('section, div, hr').each((i, elem) => {
      const style = $(elem).attr('style') || '';
      const text = $(elem).text().trim();
      const heightMatch = style.match(/height:\s*(\d+)px/i);
      if (text.length === 0 && heightMatch && parseInt(heightMatch[1]) <= 5) {
        found = true;
        return false;
      }
    });
    return found;
  }

  private detectEmphasis($: cheerio.CheerioAPI): boolean {
    return $('strong, em, [style*="font-weight: bold"], [style*="color"]').length > 0;
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private extractColorFromStyle(style: string): string | undefined {
    const match = style.match(/(?:^|;)\s*color:\s*([^;]+)/i);
    return match ? match[1].trim() : undefined;
  }

  private extractBorderColor(borderStyle: string): string {
    const match = borderStyle.match(/#\w+|rgb\([^)]+\)|rgba\([^)]+\)/i);
    return match ? match[0] : '#333333';
  }

  private extractPaddingFromStyle(style: string): string | undefined {
    const match = style.match(/padding:\s*([^;]+)/i);
    return match ? match[1].trim() : undefined;
  }

  /**
   * 应用样式到内容
   */
  applyStyle(content: string, style: StyleResult): string {
    const $ = cheerio.load(style.htmlTemplate);
    $('.rich_media_content').html(content);
    return $.html();
  }

  // ============================================================================
  // 第二阶段：模板化（从"描述性"改为"模板化"）
  // ============================================================================

  /**
   * 生成可直接使用的 HTML 模板
   * AI 只需填充内容，不自己编造结构
   */
  generateHtmlTemplates(rules: AbstractStyleRules): HtmlTemplates {
    const themeColor = rules.themeColor || '#d97757';

    // ========================================
    // 主标题模板
    // ========================================
    let mainTitleTemplate: string;
    if (rules.mainTitle?.fullStyle) {
      // 有完整样式，直接使用
      mainTitleTemplate = `<section style="${rules.mainTitle.fullStyle}"><strong>{TITLE}</strong></section>`;
    } else if (rules.mainTitle?.backgroundColor) {
      // 彩色背景块标题
      const style = this.buildStyleString({
        'font-size': rules.mainTitle.fontSize || '24px',
        'color': rules.mainTitle.color || '#fff',
        'background-color': rules.mainTitle.backgroundColor,
        'text-align': rules.mainTitle.textAlign || 'center',
        'padding': rules.mainTitle.padding || '10px 20px',
        'font-weight': rules.mainTitle.fontWeight || 'bold',
      });
      mainTitleTemplate = `<section style="${style}"><strong>{TITLE}</strong></section>`;
    } else {
      // 普通标题
      const style = this.buildStyleString({
        'font-size': rules.mainTitle?.fontSize || '24px',
        'color': rules.mainTitle?.color || '#333',
        'text-align': rules.mainTitle?.textAlign || 'center',
        'font-weight': 'bold',
        'margin': '20px 0 10px',
      });
      mainTitleTemplate = `<section style="${style}"><strong>{TITLE}</strong></section>`;
    }

    // ========================================
    // 副标题模板
    // ========================================
    let subTitleTemplate: string;
    if (rules.subTitle?.fullStyle) {
      subTitleTemplate = `<section style="${rules.subTitle.fullStyle}"><strong>{TITLE}</strong></section>`;
    } else if (rules.subTitle?.borderLeft) {
      // 左边框装饰
      const style = this.buildStyleString({
        'font-size': rules.subTitle.fontSize || '18px',
        'color': rules.subTitle.color || '#333',
        'border-left': rules.subTitle.borderLeft,
        'padding': rules.subTitle.padding || '5px 10px',
        'font-weight': rules.subTitle.fontWeight || 'bold',
        'margin': '15px 0',
      });
      subTitleTemplate = `<section style="${style}"><strong>{TITLE}</strong></section>`;
    } else if (rules.subTitle?.borderRight) {
      // 右边框装饰
      const style = this.buildStyleString({
        'font-size': rules.subTitle.fontSize || '18px',
        'color': rules.subTitle.color || '#333',
        'border-right': rules.subTitle.borderRight,
        'padding': rules.subTitle.padding || '5px 10px',
        'font-weight': rules.subTitle.fontWeight || 'bold',
        'margin': '15px 0',
      });
      subTitleTemplate = `<section style="${style}"><strong>{TITLE}</strong></section>`;
    } else {
      // 普通副标题
      const style = this.buildStyleString({
        'font-size': rules.subTitle?.fontSize || '18px',
        'color': rules.subTitle?.color || '#333',
        'font-weight': 'bold',
        'margin': '15px 0',
      });
      subTitleTemplate = `<section style="${style}"><strong>{TITLE}</strong></section>`;
    }

    // ========================================
    // 段落模板
    // ========================================
    let paragraphTemplate: string;
    if (rules.paragraph?.fullStyle) {
      paragraphTemplate = `<p style="${rules.paragraph.fullStyle}">{CONTENT}</p>`;
    } else {
      const style = this.buildStyleString({
        'font-size': rules.paragraph?.fontSize || '16px',
        'line-height': rules.paragraph?.lineHeight || '1.8',
        'color': rules.paragraph?.color || '#4a4a4a',
        'text-align': rules.paragraph?.textAlign || 'justify',
        'text-indent': rules.paragraph?.textIndent || '2em',
        'margin': rules.paragraph?.margin || '10px 0',
      });
      paragraphTemplate = `<p style="${style}">{CONTENT}</p>`;
    }

    // ========================================
    // 引用块模板
    // ========================================
    let quoteTemplate: string;
    if (rules.quote?.fullStyle) {
      quoteTemplate = `<section style="${rules.quote.fullStyle}">{QUOTE}</section>`;
    } else if (rules.quote?.borderLeft) {
      const style = this.buildStyleString({
        'font-size': rules.quote.fontSize || '15px',
        'color': rules.quote.color || '#666',
        'font-style': rules.quote.fontStyle || 'italic',
        'border-left': rules.quote.borderLeft,
        'background-color': rules.quote.backgroundColor || '#f8f8f8',
        'padding': rules.quote.padding || '10px 15px',
        'margin': '15px 0',
      });
      quoteTemplate = `<section style="${style}">{QUOTE}</section>`;
    } else {
      // 默认引用块（使用主题色）
      const style = this.buildStyleString({
        'font-size': '15px',
        'color': '#666',
        'font-style': 'italic',
        'border-left': `4px solid ${themeColor}`,
        'background-color': '#f8f8f8',
        'padding': '10px 15px',
        'margin': '15px 0',
      });
      quoteTemplate = `<section style="${style}">{QUOTE}</section>`;
    }

    // ========================================
    // 分割线模板
    // ========================================
    let dividerTemplate: string;
    if (rules.decoration?.dividers?.length && rules.decoration.dividers[0]?.fullStyle) {
      dividerTemplate = `<section style="${rules.decoration.dividers[0].fullStyle}"></section>`;
    } else {
      // 默认分割线（使用主题色）
      dividerTemplate = `<section style="height: 2px; background-color: ${themeColor}; margin: 20px 0;"></section>`;
    }

    // ========================================
    // 强调文字模板
    // ========================================
    let emphasisTemplate: string;
    if (rules.emphasis?.fullStyle) {
      emphasisTemplate = `<strong style="${rules.emphasis.fullStyle}">{TEXT}</strong>`;
    } else if (rules.emphasis?.color) {
      emphasisTemplate = `<strong style="color: ${rules.emphasis.color};">{TEXT}</strong>`;
    } else {
      emphasisTemplate = `<strong style="color: ${themeColor};">{TEXT}</strong>`;
    }

    return {
      mainTitleTemplate,
      subTitleTemplate,
      paragraphTemplate,
      quoteTemplate,
      dividerTemplate,
      emphasisTemplate,
      themeColor,
    };
  }

  /**
   * 工具方法：从对象构建 style 字符串
   */
  private buildStyleString(styles: Record<string, string | undefined>): string {
    return Object.entries(styles)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
  }

  /**
   * 生成样式复刻的 prompt 片段
   * 告诉 AI 如何精确复刻样式
   */
  generateStylePrompt(rules: AbstractStyleRules, structure: ArticleStructure): string {
    const parts: string[] = [];

    // 主标题样式
    if (structure.hasMainTitle && rules.mainTitle) {
      parts.push(`\n【主标题样式】${rules.mainTitle.decorationType === 'colorBlock' ? '彩色背景块标题' : '普通标题'}`);
      if (rules.mainTitle.fontSize) parts.push(`- 字号：${rules.mainTitle.fontSize}`);
      if (rules.mainTitle.color) parts.push(`- 颜色：${rules.mainTitle.color}`);
      if (rules.mainTitle.backgroundColor) parts.push(`- 背景色：${rules.mainTitle.backgroundColor}`);
      if (rules.mainTitle.textAlign) parts.push(`- 对齐：${rules.mainTitle.textAlign}`);
      if (rules.mainTitle.fullStyle) parts.push(`- 完整样式：${rules.mainTitle.fullStyle.substring(0, 200)}`);
    }

    // 副标题样式
    if (structure.hasSubTitle && rules.subTitle) {
      parts.push(`\n【副标题样式】${rules.subTitle.decorationType === 'leftBorder' ? '左边框装饰' : rules.subTitle.decorationType === 'rightBorder' ? '右边框装饰' : '普通副标题'}`);
      if (rules.subTitle.fontSize) parts.push(`- 字号：${rules.subTitle.fontSize}`);
      if (rules.subTitle.borderLeft) parts.push(`- 左边框：${rules.subTitle.borderLeft}`);
      if (rules.subTitle.borderRight) parts.push(`- 右边框：${rules.subTitle.borderRight}`);
      if (rules.subTitle.fullStyle) parts.push(`- 完整样式：${rules.subTitle.fullStyle.substring(0, 200)}`);
    }

    // 段落样式
    if (rules.paragraph) {
      parts.push(`\n【段落样式】`);
      if (rules.paragraph.lineHeight) parts.push(`- 行高：${rules.paragraph.lineHeight}`);
      if (rules.paragraph.fontSize) parts.push(`- 字号：${rules.paragraph.fontSize}`);
      if (rules.paragraph.color) parts.push(`- 颜色：${rules.paragraph.color}`);
      if (rules.paragraph.textIndent) parts.push(`- 首行缩进：${rules.paragraph.textIndent}`);
    }

    // 引用块样式
    if (structure.hasQuote && rules.quote) {
      parts.push(`\n【引用块样式】（用于突出重要观点）`);
      if (rules.quote.borderLeft) parts.push(`- 左边框：${rules.quote.borderLeft}`);
      if (rules.quote.backgroundColor) parts.push(`- 背景色：${rules.quote.backgroundColor}`);
      if (rules.quote.fontStyle) parts.push(`- 字体样式：${rules.quote.fontStyle}`);
      if (rules.quote.fullStyle) parts.push(`- 完整样式：${rules.quote.fullStyle.substring(0, 200)}`);
    }

    // 分割线
    if (structure.hasDivider && rules.decoration?.dividers?.length) {
      parts.push(`\n【分割线样式】（用于分隔内容段落）`);
      const divider = rules.decoration.dividers[0];
      parts.push(`- 样式：${divider.fullStyle.substring(0, 100)}`);
    }

    // 主题色
    if (rules.themeColor) {
      parts.push(`\n【主题色】${rules.themeColor}（用于强调、装饰等）`);
    }

    return parts.join('\n');
  }
}

// 导出单例
export const styleService = new StyleService();
