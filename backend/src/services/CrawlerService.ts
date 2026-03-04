/**
 * [INPUT]: 依赖 Playwright
 * [OUTPUT]: 对外提供 CrawlerService 类
 * [POS]: services服务层，负责爬虫功能
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { CrawlerResult, ContentSegment } from '../types';

export class CrawlerService {
  private browser: any = null;

  /**
   * 初始化浏览器
   */
  async init(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
  }

  /**
   * 爬取网页内容（支持任意网页）
   * 参考：replica.ai 的 scrapeWechatArticle 实现
   */
  async crawlWechatArticle(url: string): Promise<CrawlerResult> {
    // URL验证：检查是否为有效的HTTP/HTTPS URL
    if (!url || typeof url !== 'string') {
      console.error('[爬虫内容] 无效的URL:', url);
      throw new Error('网页链接不能为空');
    }

    // 基本的URL格式验证
    const urlPattern = /^https?:\/\/.+/i;
    if (!urlPattern.test(url.trim())) {
      console.error('[爬虫内容] URL格式无效:', url);
      throw new Error('网页链接格式无效，请输入完整的网址（如：https://example.com/article）');
    }

    // 检查是否包含明显的错误信息（防止用户粘贴错误日志）
    if (url.includes('Failed to load') || url.includes('API请求失败') || url.includes('Network Error')) {
      console.error('[爬虫内容] 检测到错误信息而非URL:', url);
      throw new Error('网页链接包含错误信息，请检查输入');
    }

    await this.init();

    if (!this.browser) {
      throw new Error('浏览器初始化失败');
    }

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    try {
      console.log('[爬虫内容] 开始访问URL:', url);

      // 访问URL并等待加载
      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 600000,
      });

      console.log('[爬虫内容] 页面响应状态:', response?.status());

      // 检查页面是否加载成功
      if (response && !response.ok()) {
        throw new Error(`页面加载失败，状态码: ${response.status()}`);
      }

      // 等待3秒确保动态内容加载完成
      await page.waitForTimeout(3000);

      // 检查是否需要登录或有反爬提示
      const pageContent = await page.content();
      console.log('[爬虫内容] 页面内容长度:', pageContent.length);

      // 打印页面标题帮助调试
      const pageTitle = await page.title();
      console.log('[爬虫内容] 页面标题:', pageTitle);

      if (pageContent.includes('该内容已被发布者删除') ||
          pageContent.includes('该公众号已被封禁') ||
          pageContent.includes('内容无法查看') ||
          pageContent.includes('系统出错') ||
          pageContent.includes('页面不存在')) {
        throw new Error('文章内容无法访问，可能已被删除或需要登录');
      }

      // 在浏览器上下文中提取内容
      const article = await page.evaluate(() => {
        // 提取标题（兼容多种选择器）
        const titleElement = document.querySelector('#activity-name') ||
                             document.querySelector('.rich_media_title') ||
                             document.querySelector('h1');
        const title = titleElement?.textContent?.trim() || '';

        // 提取作者
        const authorElement = document.querySelector('#meta_content > .rich_media_meta_text') ||
                              document.querySelector('.rich_media_meta_text');
        const author = authorElement?.textContent?.trim() || '';

        // 提取正文内容
        const contentElement = document.querySelector('#js_content') ||
                               document.querySelector('.rich_media_content');

        if (!contentElement) {
          return {
            title,
            author,
            content: '',
            html: '',
            publishDate: '',
            url: window.location.href,
          };
        }

        // 克隆节点并移除script和style标签
        const clone = contentElement.cloneNode(true) as any;
        clone.querySelectorAll('script, style').forEach((el: any) => el.remove());

        // 提取纯文本内容
        const paragraphs = clone.querySelectorAll('p, section, div');
        const contentArray: string[] = [];

        paragraphs.forEach((p: any) => {
          const text = p.textContent?.trim();
          if (text && text.length > 0) {
            contentArray.push(text);
          }
        });

        const content = contentArray.join('\n\n');
        const html = contentElement.innerHTML;

        // 提取发布时间
        const publishDateElement = document.querySelector('#publish_time') ||
                                    document.querySelector('.publish_time');
        const publishDate = publishDateElement?.textContent?.trim() || '';

        return {
          title,
          author,
          content,
          html,
          publishDate,
          url: window.location.href,
        };
      });

      // 使用cheerio处理HTML提取图片及上下文
      const $ = cheerio.load(article.html);
      const allMedia: { url: string; priority: number; beforeText: string; afterText: string; originalIndex: number; mediaType: 'image' | 'gif' | 'video' }[] = [];
      const seenUrls = new Set<string>(); // 去重

      // 获取全文纯文本用于提取上下文
      const fullText = article.content;

      // ========================================
      // 提取上下文的辅助函数
      // ========================================
      const extractContext = (elem: any): { beforeText: string; afterText: string } => {
        let beforeText = '';
        let afterText = '';

        const parent = $(elem).parent();
        const prevSibling = parent.prev();
        const nextSibling = parent.next();

        if (prevSibling.length > 0) {
          beforeText = prevSibling.text().trim().slice(-80);
        }
        if (nextSibling.length > 0) {
          afterText = nextSibling.text().trim().slice(0, 80);
        }

        if (beforeText.length < 30) {
          const grandParent = parent.parent();
          const prevSection = grandParent.prev();
          if (prevSection.length > 0) {
            const prevText = prevSection.text().trim();
            if (prevText.length > 0) {
              beforeText = prevText.slice(-80);
            }
          }
        }

        if (afterText.length < 30) {
          const grandParent = parent.parent();
          const nextSection = grandParent.next();
          if (nextSection.length > 0) {
            const nextText = nextSection.text().trim();
            if (nextText.length > 0) {
              afterText = nextText.slice(0, 80);
            }
          }
        }

        return { beforeText: beforeText.slice(-50), afterText: afterText.slice(0, 50) };
      };

      // ========================================
      // 1. 提取所有图片（包括 gif）
      // ========================================
      $('img').each((imgIndex, elem) => {
        let src = $(elem).attr('data-src') ||
                  $(elem).attr('src') ||
                  $(elem).attr('data-imgsrc') || '';

        if (src && src.startsWith('http')) {
          if (!seenUrls.has(src)) {
            seenUrls.add(src);

            if (src.startsWith('//')) {
              src = 'https:' + src;
            }

            const urlLower = src.toLowerCase();
            let priority = 5;
            let mediaType: 'image' | 'gif' | 'video' = 'image';

            // 判断媒体类型
            if (urlLower.includes('mmbiz_gif') || urlLower.endsWith('.gif')) {
              priority = 8; // GIF 动图，较高优先级（不要过滤掉！）
              mediaType = 'gif';
            } else if (urlLower.includes('mmbiz_jpg') || urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) {
              priority = 10;
              mediaType = 'image';
            } else if (urlLower.includes('mmbiz_png') || urlLower.endsWith('.png')) {
              // PNG 可能是大图，检查尺寸
              priority = src.includes('640?') ? 7 : 3;
              mediaType = 'image';
            }

            // 检查尺寸参数
            if (src.includes('640?') || src.includes('wx_fmt')) {
              priority += 2;
            }

            // 排除明显的表情包/装饰图
            if (src.includes('emoji') || src.includes('face') || src.includes('icon')) {
              priority = -50;
            }

            if (priority > 0) {
              const context = extractContext(elem);
              allMedia.push({
                url: src,
                priority,
                beforeText: context.beforeText,
                afterText: context.afterText,
                originalIndex: imgIndex,
                mediaType
              });
            }
          }
        }
      });

      // ========================================
      // 2. 提取视频（mpvideo）
      // ========================================
      $('mp-video, video, [data-src*="mpvideo"], [src*="mpvideo"]').each((videoIndex, elem) => {
        let src = $(elem).attr('data-src') || $(elem).attr('src') || '';

        if (!src) {
          // 尝试从其他属性获取
          src = $(elem).attr('data-mpvideo') || '';
        }

        if (src && (src.includes('mpvideo') || src.includes('video'))) {
          if (src.startsWith('//')) {
            src = 'https:' + src;
          }

          if (!seenUrls.has(src)) {
            seenUrls.add(src);
            const context = extractContext(elem);
            allMedia.push({
              url: src,
              priority: 9, // 视频优先级较高
              beforeText: context.beforeText,
              afterText: context.afterText,
              originalIndex: 1000 + videoIndex, // 视频排在图片后面
              mediaType: 'video'
            });
          }
        }
      });

      // ========================================
      // 3. 从 HTML 中直接查找 mpvideo 链接
      // ========================================
      const mpvideoPattern = /https?:\/\/[^\s"'<>]*mpvideo[^\s"'<>]*/gi;
      const mpvideoMatches = article.html.match(mpvideoPattern) || [];
      mpvideoMatches.forEach((videoUrl: string, idx: number) => {
        if (!seenUrls.has(videoUrl)) {
          seenUrls.add(videoUrl);
          allMedia.push({
            url: videoUrl,
            priority: 9,
            beforeText: '',
            afterText: '',
            originalIndex: 2000 + idx,
            mediaType: 'video'
          });
        }
      });

      // ========================================
      // 按原文顺序排序，筛选高质量媒体
      // ========================================
      allMedia.sort((a, b) => a.originalIndex - b.originalIndex);

      // 选择高优先级媒体，保持原文顺序（不限制数量）
      const highPriorityMedia = allMedia.filter(m => m.priority >= 5);
      const selectedMedia = highPriorityMedia;  // 移除 slice(0, 10) 限制

      const images = selectedMedia.map(m => m.url);
      const imageContexts = selectedMedia.map((m, idx) => ({
        url: m.url,
        beforeText: m.beforeText,
        afterText: m.afterText,
        index: idx,
        mediaType: m.mediaType
      }));

      // 统计各类型数量
      const gifCount = selectedMedia.filter(m => m.mediaType === 'gif').length;
      const videoCount = selectedMedia.filter(m => m.mediaType === 'video').length;
      const imageCount = selectedMedia.filter(m => m.mediaType === 'image').length;

      console.log('[爬虫] 调试信息:');
      console.log('[爬虫] 标题:', article.title);
      console.log('[爬虫] 作者:', article.author);
      console.log('[爬虫] HTML长度:', article.html.length, '字符');
      console.log('[爬虫] 纯文本内容长度:', article.content.length, '字符');
      console.log('[爬虫] 媒体统计 - 图片:', imageCount, 'GIF:', gifCount, '视频:', videoCount);
      console.log('[爬虫] 原始媒体数量:', seenUrls.size, '筛选后:', selectedMedia.length);

      if (imageContexts.length > 0) {
        console.log('[爬虫] 媒体上下文示例:');
        imageContexts.slice(0, 3).forEach((ctx, i) => {
          const typeLabel = ctx.mediaType === 'gif' ? 'GIF' : ctx.mediaType === 'video' ? '视频' : '图片';
          console.log(`  [${i+1}][${typeLabel}] 前文: "${ctx.beforeText.slice(-20)}..." -> 后文: "${ctx.afterText.slice(0, 20)}..."`);
        });
      }

      // ========================================
      // 4. 提取内容片段（用于分阶段二创）
      // ========================================
      const segments = this.extractSegments($, selectedMedia);
      console.log('[爬虫] 内容片段数量:', segments.length);

      // 如果没有爬取到有效内容，抛出错误
      if (!article.title && article.content.length < 100) {
        console.error('[爬虫内容] 未能获取有效内容，可能是反爬机制或需要登录');
        throw new Error('无法获取文章内容，请检查链接是否有效，或尝试使用"粘贴文本"方式输入');
      }

      return {
        html: article.html,
        title: article.title,
        author: article.author,
        images,
        imageContexts,
        segments,
        publishTime: article.publishDate ? new Date(article.publishDate) : new Date(),
      };
    } finally {
      await context.close();
    }
  }

  /**
   * 爬取网页样式（支持任意网页）
   * 参考：replica.ai 的 scrapeWechatStyle 实现
   * 返回 outerHTML 以保留所有内联样式
   */
  async crawlWechatStyle(url: string): Promise<{
    html: string;
    fullHtml: string;
  }> {
    // URL验证：检查是否为有效的HTTP/HTTPS URL
    if (!url || typeof url !== 'string') {
      console.error('[爬虫样式] 无效的URL:', url);
      throw new Error('样式链接不能为空');
    }

    // 基本的URL格式验证
    const urlPattern = /^https?:\/\/.+/i;
    if (!urlPattern.test(url.trim())) {
      console.error('[爬虫样式] URL格式无效:', url);
      throw new Error('样式链接格式无效，请输入完整的网址');
    }

    // 检查是否包含明显的错误信息（防止用户粘贴错误日志）
    if (url.includes('Failed to load') || url.includes('API请求失败') || url.includes('Network Error')) {
      console.error('[爬虫样式] 检测到错误信息而非URL:', url);
      throw new Error('样式链接包含错误信息，请检查输入');
    }

    await this.init();

    if (!this.browser) {
      throw new Error('浏览器初始化失败');
    }

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    try {
      // 访问URL并等待加载
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 600000,
      });

      // 等待3秒确保动态内容加载完成
      await page.waitForTimeout(3000);

      // 在浏览器上下文中提取样式HTML
      const styleData = await page.evaluate(() => {
        const contentElement = document.querySelector('#js_content') ||
                               document.querySelector('.rich_media_content');

        if (!contentElement) {
          return {
            html: '',
            fullHtml: '',
          };
        }

        // innerHTML - 仅内容部分
        const html = contentElement.innerHTML;

        // outerHTML - 包含容器本身，保留所有内联样式
        const fullHtml = contentElement.outerHTML;

        return {
          html,
          fullHtml,
        };
      });

      return styleData;
    } finally {
      await context.close();
    }
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 提取内容片段（用于分阶段二创）
   * 按图片/视频位置分割原文，形成 [文本段, 媒体段, 文本段, ...] 的结构
   *
   * 核心策略：直接遍历 DOM 树，遇到图片就分割
   */
  private extractSegments(
    $: cheerio.CheerioAPI,
    mediaList: { url: string; originalIndex: number; mediaType: 'image' | 'gif' | 'video' }[]
  ): ContentSegment[] {
    const segments: ContentSegment[] = [];
    const contentContainer = $('#js_content, .rich_media_content');

    if (!contentContainer.length) {
      return segments;
    }

    // 如果没有媒体，返回整段文本
    if (mediaList.length === 0) {
      const fullText = contentContainer.text().trim();
      if (fullText) {
        segments.push({ type: 'text', content: fullText, index: 0 });
      }
      return segments;
    }

    // ========================================
    // 新策略：直接遍历 DOM，遇到图片就分割
    // ========================================
    let currentText = '';
    let segmentIndex = 0;
    const processedMediaUrls = new Set<string>();

    // 遍历内容区域的所有子元素（section, p, div 等）
    contentContainer.children().each((_, elem) => {
      const $elem = $(elem);
      const tagName = elem.tagName?.toLowerCase() || '';

      // 跳过空元素
      const elemText = $elem.text().trim();
      const hasImgs = $elem.find('img').length > 0;

      if (!elemText && !hasImgs) {
        return; // 跳过空元素
      }

      // 检查这个元素是否包含图片
      if (hasImgs) {
        // 元素内有图片，需要分割
        $elem.find('img').each((__, imgElem) => {
          const imgSrc = $(imgElem).attr('data-src') || $(imgElem).attr('src') || '';
          const matchedMedia = mediaList.find(m => m.url === imgSrc);

          if (matchedMedia && !processedMediaUrls.has(imgSrc)) {
            // 先输出累积的文本
            if (currentText.trim()) {
              segments.push({ type: 'text', content: currentText.trim(), index: segmentIndex++ });
              currentText = '';
            }
            // 输出图片
            segments.push({ type: matchedMedia.mediaType, content: matchedMedia.url, index: segmentIndex++ });
            processedMediaUrls.add(imgSrc);
          }
        });

        // 获取元素中的非图片文本（移除图片后获取文本）
        const textWithoutImgs = $elem.clone().find('img').remove().end().text().trim();
        if (textWithoutImgs) {
          currentText += (currentText ? '\n' : '') + textWithoutImgs;
        }
      } else {
        // 纯文本元素，累积文本
        if (elemText) {
          currentText += (currentText ? '\n' : '') + elemText;
        }
      }
    });

    // 输出最后剩余的文本
    if (currentText.trim()) {
      segments.push({ type: 'text', content: currentText.trim(), index: segmentIndex++ });
    }

    // 检查是否有遗漏的媒体（在末尾追加）
    mediaList.forEach(media => {
      if (!processedMediaUrls.has(media.url)) {
        console.log('[爬虫] 警告：媒体未被处理，追加到末尾', media.url.slice(0, 50));
        segments.push({ type: media.mediaType, content: media.url, index: segmentIndex++ });
      }
    });

    // 输出分段结果
    console.log('[爬虫] 分段结果:');
    console.log('[爬虫] 原文媒体数量:', mediaList.length, '已处理:', processedMediaUrls.size);
    segments.forEach((seg, i) => {
      const preview = seg.type === 'text'
        ? seg.content.slice(0, 30) + '...'
        : `[${seg.type}] ${seg.content.slice(0, 50)}...`;
      console.log(`  [${i}] ${seg.type}: ${preview}`);
    });

    return segments;
  }
}

// 导出单例
export const crawlerService = new CrawlerService();
