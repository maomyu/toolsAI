/**
 * [INPUT]: 依赖 QueueService、BrowserPool、CrawlerService、AIService
 * [OUTPUT]: 对外提供 startWorker 函数
 * [POS]: workers工作进程，后台异步处理任务
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { taskQueue, updateTaskStatus } from '../services/QueueService';
import { browserPool } from '../services/BrowserPool';
import { crawlerService } from '../services/CrawlerService';
import { aiService } from '../services/AIService';
import { RecreateRequest, GenerateResult, AbstractStyleRules } from '../types';
import { preprocessText } from '../utils/textProcessor';

// ========================================
// Worker 状态
// ========================================
let isRunning = false;

// ========================================
// 任务处理函数
// ========================================
async function processTask(job: any): Promise<void> {
  const { taskId, contentUrl, contentText, styleUrl, options, imageOption, aiImageCount, creativityLevel, userId } = job.data as RecreateRequest & { taskId: string; userId?: string };

  console.log(`[Worker] 开始处理任务: ${taskId}, userId: ${userId || '匿名'}`);

  try {
    // ========================================
    // Step 1: 更新状态 - 处理中
    // ========================================
    await updateTaskStatus(taskId, {
      status: 'processing',
      progress: 5,
      message: '正在准备处理...',
    });

    // ========================================
    // Step 2: 获取内容
    // ========================================
    let contentHtml: string;
    let contentTitle: string = '';

    if (contentUrl) {
      await updateTaskStatus(taskId, {
        progress: 10,
        message: '正在读取网页内容...',
      });

      const contentResult = await crawlerService.crawlWechatArticle(contentUrl);
      contentHtml = contentResult.html;
      contentTitle = contentResult.title;

      console.log(`[Worker] 内容读取完成: ${taskId}, 标题: ${contentTitle}`);
    } else {
      // 粘贴模式：预处理文本，合并短句为完整段落
      console.log(`[Worker] 预处理粘贴文本...`);
      contentHtml = preprocessText(contentText || '');
      contentTitle = '用户提供的内容';
      console.log(`[Worker] 文本预处理完成，HTML长度: ${contentHtml.length}`);
    }

    // ========================================
    // Step 3: 获取样式
    // ========================================
    await updateTaskStatus(taskId, {
      progress: 30,
      message: '正在分析样式...',
    });

    let styleResult;
    const finalStyleUrl = styleUrl || 'https://mp.weixin.qq.com/s/m4pxv_GSbsLSo7E38kYMVQ';

    try {
      styleResult = await crawlerService.crawlWechatStyle(finalStyleUrl);
    } catch (e: any) {
      console.warn(`[Worker] 样式获取失败，使用默认: ${e.message}`);
      styleResult = {
        html: '',
        fullHtml: '<div class="default-style"></div>',
      };
    }

    // ========================================
    // Step 3.5: 提取样式规则（与本地模式一致：AI分析 + 正则提取）
    // ========================================
    let abstractStyleRules: AbstractStyleRules | undefined;

    if (styleResult.fullHtml) {
      // 先用正则提取作为基础
      abstractStyleRules = aiService.extractAbstractStyleRules(styleResult.fullHtml);
      console.log(`[Worker] 正则样式提取完成，主题色: ${abstractStyleRules.themeColor}`);

      // 用 AI 分析样式（带超时保护，10分钟）
      try {
        const aiStyleAnalysisPromise = aiService.analyzeStyleWithAI(styleResult.fullHtml);
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('AI样式分析超时')), 600000)
        );

        const aiStyleAnalysis = await Promise.race([aiStyleAnalysisPromise, timeoutPromise]) as any;

        if (aiStyleAnalysis) {
          console.log(`[Worker] AI样式分析完成，用AI结果覆盖正则结果`);

          // 覆盖 mainTitle（主标题样式）
          if (aiStyleAnalysis.mainTitle) {
            const aiMainTitle = aiStyleAnalysis.mainTitle;
            if (aiMainTitle.fullStyle) abstractStyleRules.mainTitle.fullStyle = aiMainTitle.fullStyle;
            if (aiMainTitle.backgroundColor) {
              abstractStyleRules.mainTitle.backgroundColor = aiMainTitle.backgroundColor;
              abstractStyleRules.mainTitle.decorationType = 'color-block';
            }
            if (aiMainTitle.color) abstractStyleRules.mainTitle.color = aiMainTitle.color;
            if (aiMainTitle.fontSize) abstractStyleRules.mainTitle.fontSize = aiMainTitle.fontSize;
            if (aiMainTitle.padding) abstractStyleRules.mainTitle.padding = aiMainTitle.padding;
            if (aiMainTitle.margin) abstractStyleRules.mainTitle.margin = aiMainTitle.margin;
            if (aiMainTitle.decorationType) abstractStyleRules.mainTitle.decorationType = aiMainTitle.decorationType;
          }

          // 覆盖 subTitle（副标题样式）
          if (aiStyleAnalysis.subTitle) {
            const aiSubTitle = aiStyleAnalysis.subTitle;
            if (aiSubTitle.fullStyle) abstractStyleRules.subTitle.fullStyle = aiSubTitle.fullStyle;
            if (aiSubTitle.borderLeft) abstractStyleRules.subTitle.borderLeft = aiSubTitle.borderLeft;
            if (aiSubTitle.borderLeftColor) {
              abstractStyleRules.subTitle.borderLeft = `4px solid ${aiSubTitle.borderLeftColor}`;
              abstractStyleRules.subTitle.borderLeftColor = aiSubTitle.borderLeftColor;
              abstractStyleRules.subTitle.decorationType = 'left-bar';
            }
            if (aiSubTitle.color) abstractStyleRules.subTitle.color = aiSubTitle.color;
            if (aiSubTitle.fontSize) abstractStyleRules.subTitle.fontSize = aiSubTitle.fontSize;
            if (aiSubTitle.padding) abstractStyleRules.subTitle.padding = aiSubTitle.padding;
            if (aiSubTitle.margin) abstractStyleRules.subTitle.margin = aiSubTitle.margin;
            if (aiSubTitle.decorationType) abstractStyleRules.subTitle.decorationType = aiSubTitle.decorationType;
          }

          // 覆盖 paragraph（正文样式）
          if (aiStyleAnalysis.paragraph) {
            const aiParagraph = aiStyleAnalysis.paragraph;
            if (aiParagraph.fullStyle) abstractStyleRules.paragraph.fullStyle = aiParagraph.fullStyle;
            if (aiParagraph.fontSize) abstractStyleRules.paragraph.fontSize = aiParagraph.fontSize;
            if (aiParagraph.lineHeight) abstractStyleRules.paragraph.lineHeight = aiParagraph.lineHeight;
            if (aiParagraph.color) abstractStyleRules.paragraph.color = aiParagraph.color;
            if (aiParagraph.textAlign) abstractStyleRules.paragraph.textAlign = aiParagraph.textAlign;
          }

          // 覆盖 themeColor（主题色）
          if (aiStyleAnalysis.themeColor) {
            abstractStyleRules.themeColor = aiStyleAnalysis.themeColor;
          }

          console.log(`[Worker] 最终样式: mainTitle.decorationType=${abstractStyleRules.mainTitle.decorationType}, themeColor=${abstractStyleRules.themeColor}`);
        }
      } catch (e: any) {
        console.warn(`[Worker] AI样式分析失败或超时，使用正则结果: ${e.message}`);
      }
    }

    // ========================================
    // Step 4: 生成标题
    // ========================================
    await updateTaskStatus(taskId, {
      progress: 40,
      message: '正在生成标题...',
    });

    const titleOptions = await aiService.generateTitleOptions(contentHtml);
    const selectedTitle = titleOptions[0] || contentTitle;

    // ========================================
    // Step 5: AI 改写
    // ========================================
    await updateTaskStatus(taskId, {
      progress: 50,
      message: '正在AI改写...',
    });

    const finalCreativityLevel = creativityLevel || 7;
    const inputMethod = contentUrl ? 'url' : 'paste';
    const finalImageOption = imageOption || 'none';
    const finalAiImageCount = finalImageOption === 'none' ? 0 : (aiImageCount || 3);

    let finalHtml: string;

    // 使用抽象样式迁移方法（与本地模式一致）
    finalHtml = await aiService.recreateContentWithAbstractStyle(
      contentHtml,
      selectedTitle,
      abstractStyleRules!,
      options || { type: 'refactor', style: 'casual' },
      finalCreativityLevel,
      inputMethod,
      styleResult.fullHtml,
      finalAiImageCount  // 传递配图数量
    );

    // ========================================
    // Step 6: 处理配图
    // ========================================
    await updateTaskStatus(taskId, {
      progress: 85,
      message: '正在处理配图...',
    });

    let finalImages: string[] = [];
    let finalHtmlWithImages = finalHtml;

    if (finalImageOption === 'none') {
      // 🔧 修复：无配图模式下清理所有占位符
      finalHtmlWithImages = aiService.cleanAllPlaceholders(finalHtml);
      console.log('[Worker] 无配图模式，已清理占位符');
      finalImages = [];
    } else {
      // 'ai' - AI智能配图
      const smartResult = await aiService.generateSmartImages(finalHtml, finalAiImageCount);
      finalHtmlWithImages = smartResult.html;
      finalImages = smartResult.images;
    }

    // ========================================
    // Step 7: 完成
    // ========================================

    // 🔧 防御性清理：最终返回前再次确保无占位符
    finalHtmlWithImages = aiService.cleanAllPlaceholders(finalHtmlWithImages);

    const result: GenerateResult = {
      html: finalHtmlWithImages,
      title: selectedTitle,
      summary: '处理完成',
      images: finalImages,
      source: contentUrl || '用户粘贴内容',
      disclaimer: '本内容由AI生成，仅供参考。使用者需确保不侵犯他人版权。',
      meta: {
        processingTime: Date.now() - job.timestamp,
        tokensUsed: 0,
      },
    };

    await updateTaskStatus(taskId, {
      status: 'completed',
      progress: 100,
      message: '处理完成！',
      result,
    });

    console.log(`[Worker] 任务完成: ${taskId}`);
  } catch (error: any) {
    console.error(`[Worker] 任务失败: ${taskId}`, error);

    await updateTaskStatus(taskId, {
      status: 'failed',
      progress: 0,
      message: error.message || '处理失败',
      error: error.message,
    });
  }
}

// ========================================
// 启动 Worker
// ========================================
export async function startWorker(): Promise<void> {
  if (isRunning) {
    console.log('[Worker] 已在运行中，跳过');
    return;
  }

  console.log('[Worker] 正在启动...');

  // 预热浏览器池
  await browserPool.init();

  // 设置并发数
  const concurrency = parseInt(process.env.MAX_CONCURRENT_TASKS || '3');

  // 开始处理任务
  taskQueue.process(concurrency, processTask);

  isRunning = true;
  console.log(`[Worker] 已启动，并发数: ${concurrency}`);

  // 监听事件
  taskQueue.on('completed', (job) => {
    console.log(`[Worker] 任务完成: ${job.id}`);
  });

  taskQueue.on('failed', (job, err) => {
    console.error(`[Worker] 任务失败: ${job?.id}`, err.message);
  });

  taskQueue.on('error', (error) => {
    console.error('[Worker] 队列错误:', error);
  });
}

// ========================================
// 停止 Worker
// ========================================
export async function stopWorker(): Promise<void> {
  if (!isRunning) {
    return;
  }

  console.log('[Worker] 正在停止...');

  // 关闭队列
  await taskQueue.close();

  // 关闭浏览器池
  await browserPool.closeAll();

  isRunning = false;
  console.log('[Worker] 已停止');
}

// ========================================
// 获取 Worker 状态
// ========================================
export function getWorkerStatus(): { isRunning: boolean; browserPool: any } {
  return {
    isRunning,
    browserPool: browserPool.getStatus(),
  };
}
