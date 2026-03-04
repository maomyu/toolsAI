/**
 * [INPUT]: 依赖服务层、请求/响应类型、中间件
 * [OUTPUT]: 对外提供 recreate 函数
 * [POS]: controllers控制器层，处理API请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 * 参考：replica.ai 的 replicateWechatArticle 流程
 */

import { Request, Response } from 'express';
import { crawlerService } from '../services/CrawlerService';
import { aiService } from '../services/AIService';
import { RecreateRequest, GenerateResult, ApiResponse } from '../types';
import { preprocessText } from '../utils/textProcessor';

// ========================================
// 图片插入辅助函数（简化版）
// ========================================

/**
 * 创建图片 HTML 元素
 */
function createImageHtml(url: string): string {
  return `\n<section style="text-align: center; margin: 20px 0;">
  <img src="${url}" alt="AI配图" style="max-width: 100%; height: auto; border-radius: 8px;" />
</section>\n`;
}

/**
 * 找到"一级子 section"的边界位置
 * 核心逻辑：找到直接作为最外层 section 子元素的 section 结束位置
 * 这些才是真正的"主要章节"分隔点，不是深层嵌套的 section
 */
function findChapterBoundaries(html: string): number[] {
  const boundaries: number[] = [];
  let depth = 0;
  let i = 0;

  while (i < html.length) {
    if (html.slice(i, i + 8).toLowerCase() === '<section') {
      depth++;
      // 在 depth=2 时（一级子 section 开始），记录这个位置用于后续判断
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
function insertImagesEvenly(html: string, images: string[]): string {
  if (images.length === 0) return html;

  // 1. 找到主要章节 section 的边界位置
  const boundaries = findChapterBoundaries(html);

  console.log(`[图片插入] 找到 ${boundaries.length} 个章节边界`);

  if (boundaries.length === 0) {
    // 没有 section，在末尾追加
    console.log(`[图片插入] 无章节边界，末尾追加`);
    return html + images.map(url => createImageHtml(url)).join('');
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
    return html + images.map(url => createImageHtml(url)).join('');
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
      const imageHtml = createImageHtml(imageUrl);
      result = result.slice(0, pos) + imageHtml + result.slice(pos);
      console.log(`[图片插入] 在位置 ${pos} 插入图片`);
    }
  }

  return result;
}

/**
 * 一键复刻公众号接口
 * 参考：replica.ai 的完整复刻流程
 */
export async function recreate(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  try {
    const { contentUrl, contentText, styleUrl, options } = req.body as RecreateRequest;

    // 参数验证：至少需要提供 contentUrl 或 contentText 其中之一
    const hasContent = contentUrl || contentText;
    if (!hasContent) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: '请提供内容链接或粘贴的文章内容',
        },
      };
      res.status(400).json(response);
      return;
    }

    // 判断配图模式：只支持 'none'（无配图）和 'ai'（AI配图）
    const imageOption = (req.body as any).imageOption || 'none';

    // 样式链接：总是需要样式链接
    const DEFAULT_STYLE_URL = 'https://mp.weixin.qq.com/s/m4pxv_GSbsLSo7E38kYMVQ';
    const finalStyleUrl = styleUrl || DEFAULT_STYLE_URL;

    console.log('[复刻] 开始处理请求');
    if (contentUrl) {
      console.log('[复刻] 输入方式: URL链接');
      console.log('[复刻] 内容URL:', contentUrl);
    } else {
      console.log('[复刻] 输入方式: 粘贴文本');
      console.log('[复刻] 文本长度:', contentText?.length, '字符');
    }
    console.log('[复刻] 配图模式:', imageOption);
    console.log('[复刻] 样式链接:', finalStyleUrl);

    // ========================================
    // 1+2. 并行获取内容和样式（核心优化：串行 → 并行）
    // 预期收益：节省 ~20s
    // ========================================
    let contentHtml: string;
    let contentTitle: string = '';
    let styleResult: { html: string; fullHtml: string };

    console.log('[复刻] 🚀 开始并行爬取内容和样式...');

    if (contentUrl) {
      // URL模式：并行爬取内容文章和样式参考
      const [contentResult, styleResultRaw] = await Promise.allSettled([
        crawlerService.crawlWechatArticle(contentUrl),
        crawlerService.crawlWechatStyle(finalStyleUrl)
      ]);

      // 处理内容爬取结果
      if (contentResult.status === 'fulfilled') {
        console.log('[复刻] ✅ 内容文章爬取完成');
        contentHtml = contentResult.value.html;
        contentTitle = contentResult.value.title;
      } else {
        throw new Error('内容爬取失败: ' + (contentResult as any).reason?.message);
      }

      // 处理样式爬取结果（失败时使用默认样式）
      if (styleResultRaw.status === 'fulfilled') {
        console.log('[复刻] ✅ 样式分析完成');
        styleResult = styleResultRaw.value;
      } else {
        console.warn('[复刻] ⚠️ 样式分析失败，使用默认样式:', (styleResultRaw as any).reason?.message);
        styleResult = {
          html: '',
          fullHtml: '<div class="default-style"></div>',
        };
      }
    } else {
      // 粘贴模式：只需爬取样式
      console.log('[复刻] 正在预处理文本内容...');
      contentHtml = preprocessText(contentText!);
      contentTitle = '用户提供的文章';
      console.log('[复刻] ✅ 文本预处理完成');

      try {
        styleResult = await crawlerService.crawlWechatStyle(finalStyleUrl);
        console.log('[复刻] ✅ 样式分析完成');
      } catch (styleError: any) {
        console.warn('[复刻] ⚠️ 样式分析失败，使用默认样式:', styleError.message);
        styleResult = {
          html: '',
          fullHtml: '<div class="default-style"></div>',
        };
      }
    }

    // ========================================
    // 3+4. 并行生成标题和分析样式（核心优化：串行 → 并行）
    // 预期收益：节省 ~10s
    // ========================================
    console.log('[复刻] 🚀 开始并行生成标题和分析样式...');
    const creativityLevel = (req.body as any).creativityLevel || 7;
    const inputMethod = contentUrl ? 'url' : 'paste';
    console.log('[复刻] 输入方式:', inputMethod, '二创自由度:', creativityLevel, '配图模式:', imageOption);

    const [titleOptions, aiStyleAnalysis] = await Promise.all([
      aiService.generateTitleOptions(contentHtml),
      aiService.analyzeStyleWithAI(styleResult.fullHtml)
    ]);

    const selectedTitle = titleOptions[0] || contentTitle;
    console.log('[复刻] ✅ 标题生成完成:', selectedTitle);
    console.log('[复刻] ✅ AI样式分析完成');
    console.log('[复刻] AI分析的样式:', JSON.stringify(aiStyleAnalysis, null, 2));

    // 正则提取作为基础（备选）
    const abstractRules = aiService.extractAbstractStyleRules(styleResult.fullHtml);

    // ========================================
    // 用 AI 分析结果完整覆盖正则提取的结果
    // 核心改进：优先使用 fullStyle（完整样式字符串）
    // ========================================

    // 覆盖 mainTitle（主标题样式）
    if (aiStyleAnalysis.mainTitle) {
      const aiMainTitle = aiStyleAnalysis.mainTitle as any;
      if (aiMainTitle.fullStyle) {
        abstractRules.mainTitle.fullStyle = aiMainTitle.fullStyle;
      }
      if (aiMainTitle.backgroundColor) {
        abstractRules.mainTitle.backgroundColor = aiMainTitle.backgroundColor;
        abstractRules.mainTitle.decorationType = 'color-block';
      }
      if (aiMainTitle.color) {
        abstractRules.mainTitle.color = aiMainTitle.color;
      }
      if (aiMainTitle.fontSize) {
        abstractRules.mainTitle.fontSize = aiMainTitle.fontSize;
      }
      if (aiMainTitle.padding) {
        abstractRules.mainTitle.padding = aiMainTitle.padding;
      }
      if (aiMainTitle.borderRadius) {
        abstractRules.mainTitle.borderRadius = aiMainTitle.borderRadius;
      }
      if (aiMainTitle.textAlign) {
        abstractRules.mainTitle.textAlign = aiMainTitle.textAlign;
      }
      if (aiMainTitle.margin) {
        abstractRules.mainTitle.margin = aiMainTitle.margin;
      }
      if (aiMainTitle.decorationType) {
        abstractRules.mainTitle.decorationType = aiMainTitle.decorationType;
      }
    }

    // 覆盖 subTitle（副标题样式）
    if (aiStyleAnalysis.subTitle) {
      const aiSubTitle = aiStyleAnalysis.subTitle as any;
      if (aiSubTitle.fullStyle) {
        abstractRules.subTitle.fullStyle = aiSubTitle.fullStyle;
      }
      if (aiSubTitle.borderLeft) {
        abstractRules.subTitle.borderLeft = aiSubTitle.borderLeft;
      }
      if (aiSubTitle.borderLeftColor) {
        abstractRules.subTitle.borderLeft = `4px solid ${aiSubTitle.borderLeftColor}`;
        abstractRules.subTitle.borderLeftColor = aiSubTitle.borderLeftColor;
        abstractRules.subTitle.decorationType = 'left-bar';
      }
      if (aiSubTitle.color) {
        abstractRules.subTitle.color = aiSubTitle.color;
      }
      if (aiSubTitle.fontSize) {
        abstractRules.subTitle.fontSize = aiSubTitle.fontSize;
      }
      if (aiSubTitle.padding) {
        abstractRules.subTitle.padding = aiSubTitle.padding;
      }
      if (aiSubTitle.textAlign) {
        abstractRules.subTitle.textAlign = aiSubTitle.textAlign;
      }
      if (aiSubTitle.margin) {
        abstractRules.subTitle.margin = aiSubTitle.margin;
      }
      if (aiSubTitle.decorationType) {
        abstractRules.subTitle.decorationType = aiSubTitle.decorationType;
      }
    }

    // 覆盖 paragraph（正文样式）
    if (aiStyleAnalysis.paragraph) {
      const aiParagraph = aiStyleAnalysis.paragraph as any;
      if (aiParagraph.fullStyle) {
        abstractRules.paragraph.fullStyle = aiParagraph.fullStyle;
      }
      if (aiParagraph.fontSize) {
        abstractRules.paragraph.fontSize = aiParagraph.fontSize;
      }
      if (aiParagraph.lineHeight) {
        abstractRules.paragraph.lineHeight = aiParagraph.lineHeight;
      }
      if (aiParagraph.color) {
        abstractRules.paragraph.color = aiParagraph.color;
      }
      if (aiParagraph.letterSpacing) {
        abstractRules.paragraph.letterSpacing = aiParagraph.letterSpacing;
      }
      if (aiParagraph.textAlign) {
        abstractRules.paragraph.textAlign = aiParagraph.textAlign;
      }
      if (aiParagraph.margin) {
        abstractRules.paragraph.margin = aiParagraph.margin;
      }
    }

    // 覆盖 emphasis（强调样式）
    if (aiStyleAnalysis.emphasis) {
      const aiEmphasis = aiStyleAnalysis.emphasis as any;
      if (aiEmphasis.color) {
        abstractRules.emphasis.color = aiEmphasis.color;
      }
      if (aiEmphasis.fontWeight) {
        abstractRules.emphasis.fontWeight = aiEmphasis.fontWeight;
      }
    }

    // 覆盖 decoration（装饰元素）
    if (aiStyleAnalysis.decoration) {
      const aiDecoration = aiStyleAnalysis.decoration as any;
      if (!abstractRules.decoration) {
        abstractRules.decoration = { type: 'none' };
      }
      if (aiDecoration.divider) {
        abstractRules.decoration.divider = aiDecoration.divider;
      }
      if (aiDecoration.quote) {
        abstractRules.decoration.quoteBlock = aiDecoration.quote;
      }
    }

    // 覆盖 container（容器样式）
    if (aiStyleAnalysis.container) {
      const aiContainer = aiStyleAnalysis.container as any;
      if (aiContainer.textAlign) {
        abstractRules.container.textAlign = aiContainer.textAlign;
      }
      if (aiContainer.padding) {
        abstractRules.container.padding = aiContainer.padding;
      }
      if (aiContainer.fullStyle) {
        abstractRules.container.fullStyle = aiContainer.fullStyle;
      }
    }

    // 覆盖 themeColor（主题色）
    if (aiStyleAnalysis.themeColor) {
      abstractRules.themeColor = aiStyleAnalysis.themeColor;
      // 同步更新强调颜色（如果没有单独设置）
      if (!aiStyleAnalysis.emphasis?.color) {
        abstractRules.emphasis.color = aiStyleAnalysis.themeColor;
      }
    }

    console.log('[复刻] 最终样式规则:', JSON.stringify(abstractRules, null, 2));

    // 计算配图数量（提前定义）
    const aiImageCount = imageOption === 'none' ? 0 : ((req.body as any).aiImageCount || 3);

    // 使用抽象样式迁移方法
    let finalHtml: string;
    finalHtml = await aiService.recreateContentWithAbstractStyle(
      contentHtml,
      selectedTitle,
      abstractRules,
      options || { type: 'expand', style: 'casual' },
      creativityLevel,
      inputMethod,
      styleResult.fullHtml,
      aiImageCount  // 传递配图数量
    );

    console.log('[复刻] ✅ 二创完成');

    // 5. 处理配图选项
    let finalImages: string[] = [];
    let finalHtmlWithImages = finalHtml;
    const userOptions = options || { type: 'expand', style: 'casual' };

    if (imageOption === 'none') {
      console.log('[复刻] 无配图模式');
      finalHtml = aiService.cleanAllPlaceholders(finalHtml);  // 清理可能残留的占位符
      finalImages = [];
    } else {
      // 'ai' - AI智能配图
      console.log('[复刻] 正在使用AI智能配图...');
      // 使用智能配图：AI分析文章 + 生成匹配图片 + 插入最佳位置
      const smartResult = await aiService.generateSmartImages(finalHtml, aiImageCount);
      finalHtmlWithImages = smartResult.html; // 已经插入图片的HTML
      finalImages = smartResult.images;
      console.log('[复刻] ✅ AI智能配图完成，生成', finalImages.length, '张图片');
    }

    // 防御性清理：确保无任何占位符残留
    finalHtmlWithImages = aiService.cleanAllPlaceholders(finalHtmlWithImages);

    // 6. 返回结果
    const processingTime = Date.now() - startTime;
    const result: GenerateResult = {
      html: finalHtmlWithImages, // 返回包含配图的HTML
      title: selectedTitle,
      summary: `已完成二创，耗时${Math.round(processingTime / 1000)}秒`,
      images: finalImages,
      // 来源声明和免责声明（合规要求）
      source: contentUrl || '用户粘贴内容',
      disclaimer: '本内容由AI生成，仅供参考。使用者需确保不侵犯他人版权。',
      meta: {
        processingTime,
        tokensUsed: 0, // TODO: 从API响应中获取
      },
    };

    const response: ApiResponse<GenerateResult> = {
      success: true,
      data: result,
    };

    console.log('[复刻] ✅ 复刻完成，总耗时:', Math.round(processingTime / 1000), '秒');
    res.json(response);
  } catch (error: any) {
    console.error('处理失败:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error.message || '处理失败，请稍后重试',
      },
    };
    res.status(500).json(response);
  }
}

/**
 * 健康检查接口
 */
export async function healthCheck(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * SSE 流式复刻接口（核心优化：感知延迟 8min → 2s）
 *
 * 事件流格式：
 * 1. title - 标题生成完成
 * 2. content - 内容二创完成（图片位置显示占位符）
 * 3. image - 单张图片生成完成（增量推送）
 * 4. done - 全部完成
 * 5. error - 错误信息
 */
export async function recreateStream(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  // ========================================
  // 设置 SSE headers
  // ========================================
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲

  // SSE 辅助函数
  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  // 心跳保活
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // 清理函数
  const cleanup = () => {
    clearInterval(heartbeat);
  };

  try {
    const { contentUrl, contentText, styleUrl, options } = req.body as RecreateRequest;

    // 参数验证
    const hasContent = contentUrl || contentText;
    if (!hasContent) {
      sendEvent('error', { code: 'INVALID_PARAMS', message: '请提供内容链接或粘贴的文章内容' });
      cleanup();
      res.end();
      return;
    }

    const imageOption = (req.body as any).imageOption || 'none';
    const DEFAULT_STYLE_URL = 'https://mp.weixin.qq.com/s/m4pxv_GSbsLSo7E38kYMVQ';
    const finalStyleUrl = styleUrl || DEFAULT_STYLE_URL;
    const creativityLevel = (req.body as any).creativityLevel || 7;
    const aiImageCount = (req.body as any).aiImageCount || 3;

    console.log('[流式复刻] 开始处理请求');

    // ========================================
    // 1+2. 并行爬取内容和样式
    // ========================================
    let contentHtml: string;
    let contentTitle: string = '';
    let styleResult: { html: string; fullHtml: string };

    if (contentUrl) {
      const [contentResult, styleResultRaw] = await Promise.allSettled([
        crawlerService.crawlWechatArticle(contentUrl),
        crawlerService.crawlWechatStyle(finalStyleUrl)
      ]);

      if (contentResult.status === 'fulfilled') {
        contentHtml = contentResult.value.html;
        contentTitle = contentResult.value.title;
      } else {
        throw new Error('内容爬取失败');
      }

      styleResult = styleResultRaw.status === 'fulfilled'
        ? styleResultRaw.value
        : { html: '', fullHtml: '<div class="default-style"></div>' };
    } else {
      contentHtml = preprocessText(contentText!);
      contentTitle = '用户提供的文章';
      try {
        styleResult = await crawlerService.crawlWechatStyle(finalStyleUrl);
      } catch {
        styleResult = { html: '', fullHtml: '<div class="default-style"></div>' };
      }
    }

    // ========================================
    // 3+4. 并行生成标题和分析样式
    // ========================================
    const [titleOptions, aiStyleAnalysis] = await Promise.all([
      aiService.generateTitleOptions(contentHtml),
      aiService.analyzeStyleWithAI(styleResult.fullHtml)
    ]);

    const selectedTitle = titleOptions[0] || contentTitle;
    const abstractRules = aiService.extractAbstractStyleRules(styleResult.fullHtml);

    // 合并 AI 分析结果
    if (aiStyleAnalysis.mainTitle) {
      Object.assign(abstractRules.mainTitle, aiStyleAnalysis.mainTitle);
    }
    if (aiStyleAnalysis.subTitle) {
      Object.assign(abstractRules.subTitle, aiStyleAnalysis.subTitle);
    }
    if (aiStyleAnalysis.paragraph) {
      Object.assign(abstractRules.paragraph, aiStyleAnalysis.paragraph);
    }

    // 🚀 立即推送标题
    sendEvent('title', { title: selectedTitle });

    // ========================================
    // 5. AI 内容二创
    // ========================================
    const inputMethod = contentUrl ? 'url' : 'paste';
    let finalHtml = await aiService.recreateContentWithAbstractStyle(
      contentHtml,
      selectedTitle,
      abstractRules,
      options || { type: 'expand', style: 'casual' },
      creativityLevel,
      inputMethod,
      styleResult.fullHtml,
      0  // 不再让 AI 生成占位符，由后端智能定位
    );

    // 🔧 核心修复：在任何处理前先清理占位符（AI 可能自行生成）
    finalHtml = aiService.cleanAllPlaceholders(finalHtml);
    console.log('[流式复刻] 已预先清理所有占位符');

    // 🚀 推送内容
    if (imageOption === 'none') {
      sendEvent('content', { html: finalHtml, images: [] });
      sendEvent('done', {
        processingTime: Date.now() - startTime,
        message: '复刻完成'
      });
    } else {
      // 先发送内容（不带图片）
      sendEvent('content', { html: finalHtml, images: [], imageLoading: true });

      // ========================================
      // 6. 简化图片处理：并行生成 + 均匀分布插入
      // 核心改进：删除复杂的智能定位，改用简单的 section 索引分布
      // ========================================

      console.log(`[流式复刻] 开始生成 ${aiImageCount} 张配图`);

      // 带重试的图片生成函数
      // 针对通义千问 API 限流优化：增加重试间隔
      const generateImageWithRetry = async (index: number, maxRetries: number = 3): Promise<string | null> => {
        const textContent = finalHtml
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 500);

        // 重试等待时间：10s, 30s, 60s（针对 API 限流优化）
        const retryDelays = [10000, 30000, 60000];

        for (let retry = 0; retry < maxRetries; retry++) {
          try {
            const prompt = await aiService.generateThemeImagePrompt('配图', textContent);
            const imageUrl = await aiService.generateImage(prompt);
            console.log(`[流式复刻] 图片 ${index + 1} 生成成功 (尝试 ${retry + 1}/${maxRetries})`);
            return imageUrl;
          } catch (error: any) {
            console.error(`[流式复刻] 图片 ${index + 1} 尝试 ${retry + 1}/${maxRetries} 失败:`, error.message);
            if (retry < maxRetries - 1) {
              const waitTime = retryDelays[retry] || 60000;
              console.log(`[流式复刻] 等待 ${waitTime / 1000}s 后重试...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        }
        return null;
      };

      // 串行生成图片（带限流保护）
      // 每张图片之间间隔 20 秒，避免 API 限流
      const images: string[] = [];
      for (let i = 0; i < aiImageCount; i++) {
        // 非第一张图片，先等待 20 秒
        if (i > 0) {
          console.log(`[流式复刻] 等待 20s 后生成下一张图片...`);
          await new Promise(resolve => setTimeout(resolve, 20000));
        }

        const imageUrl = await generateImageWithRetry(i, 3);

        if (imageUrl) {
          images.push(imageUrl);

          // 🚀 增量推送单张图片
          sendEvent('image', {
            index: i,
            url: imageUrl,
            percent: Math.round((i + 1) / aiImageCount * 100),
            theme: '配图'
          });

          console.log(`[流式复刻] 图片 ${i + 1}/${aiImageCount} 完成`);
        } else {
          console.error(`[流式复刻] 图片 ${i + 1} 所有重试均失败，跳过`);
        }
      }

      console.log(`[流式复刻] 成功生成 ${images.length}/${aiImageCount} 张图片`);

      // ========================================
      // 使用简单的均匀分布插入图片
      // 核心原则：只在 </section> 后插入，永远不打断标签
      // ========================================
      let resultHtml = finalHtml;

      if (images.length > 0) {
        resultHtml = insertImagesEvenly(finalHtml, images);
        console.log('[流式复刻] 图片已均匀插入到 section 之间');
      }

      // ========================================
      // 统一清理所有占位符格式（防御性清理）
      // ========================================
      resultHtml = aiService.cleanAllPlaceholders(resultHtml);
      console.log('[流式复刻] 已清理所有占位符');

      // 推送完成事件
      sendEvent('done', {
        html: resultHtml,
        images,
        processingTime: Date.now() - startTime,
        message: '复刻完成'
      });
    }

    console.log('[流式复刻] ✅ 完成，总耗时:', Math.round((Date.now() - startTime) / 1000), '秒');

  } catch (error: any) {
    console.error('[流式复刻] 处理失败:', error);
    sendEvent('error', {
      code: 'PROCESSING_ERROR',
      message: error.message || '处理失败，请稍后重试'
    });
  } finally {
    cleanup();
    res.end();
  }
}
