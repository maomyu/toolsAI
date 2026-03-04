/**
 * [INPUT]: 依赖 AnalysisService、express
 * [OUTPUT]: 对外提供选题分析 API 控制器
 * [POS]: controllers 控制器层，处理选题分析 HTTP 请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Request, Response } from 'express';
import { db } from '../models/database';
import {
  createAnalysis,
  getAnalysisList,
  getAnalysisById,
  deleteAnalysis,
  deleteAnalysisByKeyword,
  updateAnalysisStatus,
  saveAnalysisResult,
  saveSourceArticles,
  getSourceArticles,
  markAnalysisFailed,
  updateProgress,
  getProgress,
  updateInsightsStatus,
  saveInsights,
} from '../services/AnalysisService';
import type { SourceArticle, WordCloudItem, TopicInsight, ProgressInfo, AnalysisStep } from '../types/factory';
import { aiService } from '../services/AIService';

// ========================================
// 极致数据 API 获取公众号文章
// ========================================

interface JizhiApiResponse {
  code: number;
  cost_money: number;
  data: JizhiArticle[];
  data_number: number;
  msg: string;
  page: number;
  total: number;
  total_page: number;
}

interface JizhiArticle {
  title: string;
  content: string;
  read: number;
  praise: number;
  looking: number;
  url: string;
  wx_name: string;
  publish_time: number;
  is_original: number;
}

// ========================================
// 搜一搜 API 响应类型
// ========================================

// web_search API 返回的原始数据结构
interface WebSearchRawItem {
  date?: number;
  desc?: string;
  doc_url?: string;
  title?: string;
  source?: {
    dateTime?: string;
    title?: string;
  };
  profeLabels?: Array<{ title: string }>;
}

interface WebSearchRawArticle {
  items?: WebSearchRawItem[];
}

interface WebSearchApiResponse {
  code: number;
  cost_money: number;
  remain_money: number;
  data?: WebSearchRawArticle[];
}

async function fetchArticlesByKeyword(keyword: string, period: number = 7): Promise<JizhiArticle[]> {
  // 从设置中获取极致数据 API Key
  const apiKey = getSetting('jizhi_api_key');
  if (!apiKey) {
    throw new Error('请先在系统设置中配置极致数据 API Key');
  }

  const allArticles: JizhiArticle[] = [];
  const targetCount = 50; // 目标文章数
  let page = 1;
  const maxPages = 3;

  console.log(`[极致数据] 搜索关键词: ${keyword}, 时间范围: ${period}天`);

  while (page <= maxPages && allArticles.length < targetCount) {
    try {
      const response = await fetch('https://www.dajiala.com/fbmain/monitor/v3/kw_search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kw: keyword,
          sort_type: 1,      // 按阅读数排序
          mode: 1,           // 搜索标题
          period: period,    // 时间范围（由用户选择）
          page: page,
          key: apiKey,
          any_kw: '',
          ex_kw: '',
          verifycode: '',
          type: 1,
        }),
      });

      const result: JizhiApiResponse = await response.json();
      console.log(`[极致数据] page=${page}, total=${result.total}, 本页=${result.data?.length || 0}`);

      if (result.code !== 0 && result.code !== 200) {
        throw new Error(result.msg || `API错误: ${result.code}`);
      }

      if (!result.data || result.data.length === 0) {
        break;
      }

      // 去重添加
      for (const article of result.data) {
        if (!allArticles.some(a => a.url === article.url)) {
          allArticles.push(article);
        }
      }

      if (page >= result.total_page) {
        break;
      }

      page++;
    } catch (error) {
      console.error(`获取第 ${page} 页失败:`, error);
      throw error;
    }
  }

  console.log(`[极致数据] 总共获取 ${allArticles.length} 篇文章`);
  return allArticles;
}

// ========================================
// 搜一搜 - 即时搜索公众号文章
// ========================================

// web_search API 返回的原始数据结构
interface WebSearchRawItem {
  date?: number;
  desc?: string;
  doc_url?: string;
  title?: string;
  source?: {
    dateTime?: string;
    title?: string;
  };
  profeLabels?: Array<{ title: string }>;
}

interface WebSearchRawArticle {
  items?: WebSearchRawItem[];
}

interface WebSearchApiResponse {
  code: number;
  cost_money: number;
  remain_money: number;
  data?: WebSearchRawArticle[];
}

/**
 * 搜一搜 - 实时搜索公众号文章
 * POST /api/factory/search
 */
export async function webSearch(req: Request, res: Response): Promise<void> {
  try {
    const { keyword, publish_time_type = 2, sort_type = 2, currentPage = 1 } = req.body;

    if (!keyword || typeof keyword !== 'string') {
      res.status(400).json({ error: '关键词不能为空' });
      return;
    }

    const kw = keyword.trim();
    const apiKey = getSetting('jizhi_api_key');
    if (!apiKey) {
      res.status(400).json({ error: '请先在系统设置中配置极致数据 API Key' });
      return;
    }

    console.log(`[搜一搜] 搜索: ${kw}, 时间: ${publish_time_type}, 排序: ${sort_type}`);

    const response = await fetch('https://www.dajiala.com/fbmain/monitor/v3/web_search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 1,
        keyword: kw,
        search_type: 1,           // 1=文章
        publish_time_type,        // 0=不限 1=1天 2=7天 3=半年
        sort_type,                // 0=综合 1=最新 2=最热
        currentPage,
        offset: 0,                // 第一页为0
        cookies_buffer: '',       // 第一页不需要
        key: apiKey,
        verifycode: '',
      }),
    });

    const result: WebSearchApiResponse = await response.json();
    console.log(`[搜一搜] 返回 ${result.data?.length || 0} 条结果, 消费 ¥${result.cost_money}`);

    if (result.code !== 0) {
      res.status(400).json({ error: `搜索失败: ${result.code}` });
      return;
    }

    // 转换数据结构：web_search 返回嵌套结构，需要展平
    const articles: JizhiArticle[] = [];
    if (result.data) {
      for (const rawArticle of result.data) {
        if (rawArticle.items) {
          for (const item of rawArticle.items) {
            articles.push({
              title: item.title || '',
              content: item.desc || '',
              read: 0,           // web_search 不返回阅读数
              praise: 0,         // web_search 不返回点赞数
              looking: 0,        // web_search 不返回再看数
              url: item.doc_url || '',
              wx_name: item.source?.title || '',
              publish_time: item.date || 0,
              is_original: 0,
            });
          }
        }
      }
    }

    console.log(`[搜一搜] 转换后共 ${articles.length} 篇文章`);

    res.json({
      success: true,
      data: {
        articles,
        cost_money: result.cost_money,
        remain_money: result.remain_money,
      },
    });
  } catch (error) {
    console.error('搜一搜失败:', error);
    res.status(500).json({ error: '搜索失败' });
  }
}

// ========================================
// 控制器函数
// ========================================

/**
 * 启动选题分析
 * POST /api/factory/analysis
 */
export async function startAnalysis(req: Request, res: Response): Promise<void> {
  try {
    const { keyword, period } = req.body;

    if (!keyword || typeof keyword !== 'string') {
      res.status(400).json({ error: '关键词不能为空' });
      return;
    }

    const kw = keyword.trim();
    // 时间范围：默认7天，最大720天（标题搜索）
    const periodDays = Math.min(Math.max(Number(period) || 7, 1), 720);

    // 删除该关键词的旧报告（覆盖而非新增）
    const deleted = deleteAnalysisByKeyword(kw);
    if (deleted > 0) {
      console.log(`[分析] 删除旧报告: ${kw} (${deleted}条)`);
    }

    // 创建分析任务
    const id = createAnalysis(kw);

    // 异步执行分析（不阻塞响应）
    runAnalysisAsync(id, kw, periodDays);

    res.json({
      success: true,
      data: { id, keyword: kw, status: 'pending' },
    });
  } catch (error) {
    console.error('启动分析失败:', error);
    res.status(500).json({ error: '启动分析失败' });
  }
}

/**
 * 异步执行分析任务
 */
async function runAnalysisAsync(id: string, keyword: string, period: number = 7): Promise<void> {
  const completedSteps: AnalysisStep[] = [];

  const setProgress = (step: AnalysisStep, progress: number, message: string, partialData?: ProgressInfo['partialData']) => {
    completedSteps.push(step);
    updateProgress(id, {
      step,
      progress,
      message,
      completedSteps: [...completedSteps],
      partialData,
    });
    console.log(`[进度] ${progress}% - ${message}`);
  };

  try {
    // 步骤1：获取文章
    setProgress('fetching', 10, '正在获取文章...');

    const rawArticles = await fetchArticlesByKeyword(keyword, period);

    if (rawArticles.length === 0) {
      console.log(`[分析] 未找到文章，标记完成: ${keyword}`);
      saveAnalysisResult(id, {
        articleCount: 0,
        topLiked: [],
        topEngagement: [],
        wordCloud: [],
        insights: [{ category: '提示', title: '未找到相关文章', description: '请尝试其他关键词或扩大时间范围', evidence: [], suggestion: '使用更通用的关键词' }],
        readDistribution: { ranges: [], avg: 0, max: 0, min: 0 },
        timeDistribution: { byDate: [], byHour: [], byDayOfWeek: [] },
      });
      setProgress('completed', 100, '分析完成（未找到文章）');
      return;
    }

    setProgress('processing', 25, `获取到 ${rawArticles.length} 篇文章，正在处理...`, {
      articleCount: rawArticles.length,
    });

    // 步骤2：计算互动率并转换格式
    const articles: SourceArticle[] = rawArticles.map((a) => ({
      id: '',
      report_id: id,
      title: a.title,
      content: a.content,
      read_count: a.read || 0,
      like_count: a.praise || 0,
      share_count: a.looking || 0,  // 实际存储"再看数"(looking)，API 未返回分享数
      engagement_rate: a.read > 0 ? ((a.praise || 0) + (a.looking || 0)) / a.read : 0,  // (点赞+再看)/阅读
      url: a.url,
      created_at: a.publish_time ? new Date(a.publish_time * 1000).toISOString() : new Date().toISOString(),
    }));

    // 步骤3：保存素材文章
    setProgress('processing', 35, '保存素材文章...');
    saveSourceArticles(id, articles.map((a) => ({
      title: a.title,
      content: a.content,
      read_count: a.read_count,
      like_count: a.like_count,
      share_count: a.share_count,
      engagement_rate: a.engagement_rate,
      summary: '',
      url: a.url,
    })));

    // 步骤4：生成排行榜
    setProgress('ranking', 40, '生成排行榜...');
    const sortedByLikes = [...articles].sort((a, b) => b.like_count - a.like_count);
    const sortedByEngagement = [...articles].sort((a, b) => b.engagement_rate - a.engagement_rate);

    const topLiked = sortedByLikes.slice(0, 5);
    const topEngagement = sortedByEngagement.slice(0, 5);

    setProgress('ranking', 45, '排行榜生成完成', {
      articleCount: articles.length,
      topLiked,
      topEngagement,
    });

    // 步骤5：生成词云
    setProgress('wordcloud', 48, '生成词云...');
    const wordCloud = generateWordCloud(articles);

    setProgress('wordcloud', 50, '词云生成完成', {
      articleCount: articles.length,
      topLiked,
      topEngagement,
      wordCloud,
    });

    // 保存结果（不包含 AI 洞察，用户可手动触发）
    setProgress('saving', 95, '保存分析结果...');
    const readDistribution = calculateReadDistribution(articles);
    const timeDistribution = calculateTimeDistribution(articles);

    saveAnalysisResult(id, {
      articleCount: articles.length,
      topLiked,
      topEngagement,
      wordCloud,
      insights: [],  // 初始为空，用户手动触发 AI 分析后填充
      readDistribution,
      timeDistribution,
    });

    setProgress('completed', 100, '分析完成');
    console.log(`✅ 分析完成: ${keyword}（AI 洞察待生成）`);
  } catch (error) {
    console.error(`❌ 分析失败: ${keyword}`, error);
    markAnalysisFailed(id, (error as Error).message);
  }
}

/**
 * 异步生成 AI 洞察
 */
export async function generateInsightsAsync(id: string): Promise<void> {
  const report = getAnalysisById(id);
  if (!report) {
    throw new Error('报告不存在');
  }

  if (report.article_count === 0) {
    throw new Error('该报告没有文章，无法生成洞察');
  }

  updateInsightsStatus(id, 'analyzing');
  console.log(`[AI洞察] 开始为 ${report.keyword} 生成洞察...`);

  // 更新进度的辅助函数
  const updateInsightsProgress = (current: number, total: number, message: string) => {
    updateProgress(id, {
      step: 'ai_analyzing',
      progress: 50 + Math.round((current / total) * 40),
      message,
      completedSteps: ['fetching', 'processing', 'ranking', 'wordcloud'],
      partialData: {
        articleCount: report.article_count,
        aiProgress: { current, total },
      },
    });
  };

  try {
    // 获取 TOP 文章用于分析
    const topArticlesForInsight = [...new Map(
      [...(report.top_liked || []), ...(report.top_engagement || [])].map(a => [a.url, a])
    ).values()] as SourceArticle[];

    const totalArticles = topArticlesForInsight.length;
    console.log(`[AI洞察] 分析 ${totalArticles} 篇 TOP 文章...`);
    const articleSummaries = [];

    // 更新初始进度
    updateInsightsProgress(0, totalArticles, `开始分析 ${totalArticles} 篇文章...`);

    for (let i = 0; i < topArticlesForInsight.length; i++) {
      const article = topArticlesForInsight[i];
      console.log(`[AI洞察] 分析文章 ${i + 1}/${totalArticles}: ${article.title.slice(0, 20)}...`);

      // 更新进度
      updateInsightsProgress(i + 1, totalArticles, `分析文章 ${i + 1}/${totalArticles}: ${article.title.slice(0, 20)}...`);

      try {
        const summary = await aiService.analyzeArticleSummary({
          title: article.title,
          content: article.content,
          read_count: article.read_count,
          like_count: article.like_count,
        });
        articleSummaries.push(summary);
      } catch (e) {
        console.error(`[AI洞察] 分析失败: ${article.title}`, e);
      }
    }

    // 生成选题洞察
    let insights: TopicInsight[] = [];

    if (articleSummaries.length > 0) {
      // 更新进度：生成洞察
      updateProgress(id, {
        step: 'insights',
        progress: 90,
        message: '生成选题洞察...',
        completedSteps: ['fetching', 'processing', 'ranking', 'wordcloud', 'ai_analyzing'],
        partialData: {
          articleCount: report.article_count,
          aiProgress: { current: totalArticles, total: totalArticles },
        },
      });

      console.log(`[AI洞察] 生成选题洞察...`);
      try {
        insights = await aiService.generateTopicInsights({
          keyword: report.keyword,
          articleSummaries,
          stats: {
            totalArticles: report.article_count,
            avgReadCount: Math.round(
              (report.read_distribution?.avg || 0)
            ),
            topKeywords: (report.word_cloud || []).slice(0, 10).map(w => w.word),
          },
        });
        console.log(`[AI洞察] 生成完成，共 ${insights.length} 条洞察`);
      } catch (e) {
        console.error(`[AI洞察] 生成失败:`, e);
        insights = [{
          category: '趋势',
          title: `${report.keyword}话题分析`,
          description: `共分析 ${report.article_count} 篇文章，AI 洞察生成失败`,
          evidence: [`高频词: ${(report.word_cloud || []).slice(0, 3).map(w => w.word).join(', ')}`],
        }];
      }
    }

    // 保存洞察结果
    saveInsights(id, insights);
    console.log(`✅ AI 洞察生成完成: ${report.keyword}`);
  } catch (error) {
    console.error(`❌ AI 洞察生成失败: ${report.keyword}`, error);
    updateInsightsStatus(id, 'failed');
    throw error;
  }
}

/**
 * 手动触发 AI 洞察生成
 * POST /api/factory/analysis/:id/insights
 */
export async function generateInsightsController(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;

  try {
    const report = getAnalysisById(id);
    if (!report) {
      res.status(404).json({ success: false, error: '报告不存在' });
      return;
    }

    if (report.status !== 'completed') {
      res.status(400).json({ success: false, error: '报告尚未完成分析' });
      return;
    }

    if (report.insights_status === 'analyzing') {
      res.status(400).json({ success: false, error: 'AI 洞察正在生成中' });
      return;
    }

    // 异步执行
    generateInsightsAsync(id).catch(e => {
      console.error('[AI洞察] 后台生成失败:', e);
    });

    res.json({ success: true, message: 'AI 洞察生成已开始' });
  } catch (error) {
    console.error('启动 AI 洞察生成失败:', error);
    res.status(500).json({ success: false, error: '启动失败' });
  }
}

/**
 * 生成词云数据（带停用词过滤）
 */
function generateWordCloud(articles: SourceArticle[]): WordCloudItem[] {
  // 中文停用词表
  const stopWords = new Set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这',
    '那', '什么', '他', '她', '它', '们', '这个', '那个', '这些', '那些', '这里', '那里', '哪个', '哪些', '哪里', '怎么', '怎样', '如何', '为什么', '因为', '所以', '但是', '如果', '虽然', '然而', '或者', '而且', '以及', '还是', '只是', '就是', '可以', '可能', '应该', '需要', '能够', '已经', '正在', '将', '会', '能', '想', '让', '把', '被', '比', '更', '最', '非常', '太', '真', '好', '坏', '对', '错',
    '公众号', '微信', '文章', '内容', '大家', '朋友', '时间', '时候', '今天', '昨天', '明天', '现在', '以后', '之前', '一种', '一些', '一定', '一样', '一直', '一起', '一下', '一点', '一下', '关于', '通过', '进行', '实现', '使用', '包括', '以及', '或者', '但是', '因为', '所以', '如果', '虽然', '还是', '而且',
    '10', '20', '30', '40', '50', '100', '2023', '2024', '2025',
  ]);

  const wordCount: Record<string, number> = {};

  for (const article of articles) {
    const text = article.title + ' ' + (article.content || '');
    const words = text
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !stopWords.has(w));

    for (const word of words) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  }

  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word, count]) => ({ word, count }));
}

/**
 * 计算阅读量分布
 */
function calculateReadDistribution(articles: SourceArticle[]) {
  if (articles.length === 0) {
    return { ranges: [], avg: 0, max: 0, min: 0 };
  }

  const readCounts = articles.map(a => a.read_count).filter(c => c > 0);
  const avg = readCounts.length > 0 ? Math.round(readCounts.reduce((a, b) => a + b, 0) / readCounts.length) : 0;
  const max = readCounts.length > 0 ? Math.max(...readCounts) : 0;
  const min = readCounts.length > 0 ? Math.min(...readCounts) : 0;

  // 定义区间
  const ranges = [
    { label: '0-1千', min: 0, max: 1000 },
    { label: '1千-5千', min: 1000, max: 5000 },
    { label: '5千-1万', min: 5000, max: 10000 },
    { label: '1万-5万', min: 10000, max: 50000 },
    { label: '5万-10万', min: 50000, max: 100000 },
    { label: '10万+', min: 100000, max: Infinity },
  ];

  const distribution = ranges.map(range => {
    const count = articles.filter(a => a.read_count >= range.min && a.read_count < range.max).length;
    return {
      label: range.label,
      count,
      percentage: Math.round((count / articles.length) * 100),
    };
  });

  return { ranges: distribution, avg, max, min };
}

/**
 * 计算发布时间分布
 */
function calculateTimeDistribution(articles: SourceArticle[]) {
  if (articles.length === 0) {
    return { byDate: [], byHour: [], byDayOfWeek: [] };
  }

  // 按日期分布（最近7天）
  const dateCount: Record<string, number> = {};
  const hourCount: Record<number, number> = {};
  const dayOfWeekCount: Record<number, number> = {};

  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  for (const article of articles) {
    const date = new Date(article.created_at);
    const dateStr = date.toISOString().split('T')[0];
    const hour = date.getHours();
    const dayOfWeek = date.getDay();

    dateCount[dateStr] = (dateCount[dateStr] || 0) + 1;
    hourCount[hour] = (hourCount[hour] || 0) + 1;
    dayOfWeekCount[dayOfWeek] = (dayOfWeekCount[dayOfWeek] || 0) + 1;
  }

  // 按日期排序
  const byDate = Object.entries(dateCount)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14) // 最近14天
    .map(([date, count]) => ({ date, count }));

  // 按小时排序
  const byHour = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourCount[i] || 0,
  }));

  // 按星期排序（从周一开始）
  const byDayOfWeek = [1, 2, 3, 4, 5, 6, 0].map(day => ({
    day: dayNames[day],
    count: dayOfWeekCount[day] || 0,
  }));

  return { byDate, byHour, byDayOfWeek };
}

/**
 * 获取分析列表
 * GET /api/factory/analysis
 */
export function listAnalysis(req: Request, res: Response): void {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const list = getAnalysisList(limit);
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('获取分析列表失败:', error);
    res.status(500).json({ error: '获取分析列表失败' });
  }
}

/**
 * 获取历史关键词列表
 * GET /api/factory/keywords
 */
export function getKeywordHistory(_req: Request, res: Response): void {
  try {
    const stmt = db.prepare(`
      SELECT
        keyword,
        MAX(created_at) as last_analyzed,
        article_count,
        status
      FROM analysis_reports
      GROUP BY keyword
      ORDER BY last_analyzed DESC
      LIMIT 50
    `);
    const rows = stmt.all() as Array<{
      keyword: string;
      last_analyzed: string;
      article_count: number;
      status: string;
    }>;
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取关键词历史失败:', error);
    res.status(500).json({ error: '获取关键词历史失败' });
  }
}

/**
 * 获取分析详情
 * GET /api/factory/analysis/:id
 */
export function getAnalysis(req: Request, res: Response): void {
  try {
    const id = req.params.id as string;
    const report = getAnalysisById(id);

    if (!report) {
      res.status(404).json({ error: '报告不存在' });
      return;
    }

    // 获取素材文章
    const articles = getSourceArticles(id);

    res.json({
      success: true,
      data: {
        ...report,
        articles,
      },
    });
  } catch (error) {
    console.error('获取分析详情失败:', error);
    res.status(500).json({ error: '获取分析详情失败' });
  }
}

/**
 * 删除分析报告
 * DELETE /api/factory/analysis/:id
 */
export function removeAnalysis(req: Request, res: Response): void {
  try {
    const id = req.params.id as string;
    const success = deleteAnalysis(id);

    if (!success) {
      res.status(404).json({ error: '报告不存在' });
      return;
    }

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除分析失败:', error);
    res.status(500).json({ error: '删除分析失败' });
  }
}

/**
 * 获取分析进度
 * GET /api/factory/analysis/:id/progress
 */
export function getAnalysisProgress(req: Request, res: Response): void {
  try {
    const id = req.params.id as string;
    const report = getAnalysisById(id);

    if (!report) {
      res.status(404).json({ error: '报告不存在' });
      return;
    }

    // 获取详细进度信息
    const progressInfo = getProgress(id);

    // 构建响应
    const response: {
      id: string;
      keyword: string;
      status: string;
      insights_status: string;
      progress: number;
      message: string;
      article_count: number;
      step?: string;
      completedSteps?: string[];
      partialData?: ProgressInfo['partialData'];
    } = {
      id,
      keyword: report.keyword,
      status: report.status,
      insights_status: report.insights_status || 'none',
      progress: progressInfo?.progress ?? (report.status === 'completed' ? 100 : report.status === 'failed' ? 0 : 10),
      message: progressInfo?.message ?? (report.status === 'completed' ? '分析完成' : report.status === 'failed' ? '分析失败' : '准备中...'),
      article_count: report.article_count,
    };

    // 如果有详细进度信息，添加到响应中
    if (progressInfo) {
      response.step = progressInfo.step;
      response.completedSteps = progressInfo.completedSteps;
      response.partialData = progressInfo.partialData;
    }

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('获取分析进度失败:', error);
    res.status(500).json({ error: '获取分析进度失败' });
  }
}

// ========================================
// 内容创作控制器
// ========================================

import {
  createArticle as createArticleInDb,
  getArticleList,
  getArticleById,
  updateArticle,
  deleteArticle,
  getArticleCountByStatus,
} from '../services/ArticleService';
import type { CreateArticleRequest } from '../types/factory';

/**
 * 创建文章
 * POST /api/factory/articles
 */
export async function createArticleController(req: Request, res: Response): Promise<void> {
  try {
    const { report_id, theme, style, length, image_count } = req.body as CreateArticleRequest;

    if (!theme) {
      res.status(400).json({ error: '主题不能为空' });
      return;
    }

    // TODO: 调用 AI 生成文章内容
    const generatedContent = await generateArticleContent(theme, style, length);
    const images = await fetchUnsplashImages(theme, image_count || 3);

    const id = createArticleInDb({
      report_id,
      title: generatedContent.title,
      content: generatedContent.content,
      images,
    });

    res.json({
      success: true,
      data: { id, title: generatedContent.title },
    });
  } catch (error) {
    console.error('创建文章失败:', error);
    res.status(500).json({ error: '创建文章失败' });
  }
}

/**
 * 获取文章列表
 * GET /api/factory/articles
 */
export function listArticles(req: Request, res: Response): void {
  try {
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const articles = getArticleList({
      status: status as any,
      limit,
      offset,
    });

    const counts = getArticleCountByStatus();

    res.json({
      success: true,
      data: {
        articles,
        counts,
      },
    });
  } catch (error) {
    console.error('获取文章列表失败:', error);
    res.status(500).json({ error: '获取文章列表失败' });
  }
}

/**
 * 获取文章详情
 * GET /api/factory/articles/:id
 */
export function getArticle(req: Request, res: Response): void {
  try {
    const id = req.params.id as string;
    const article = getArticleById(id);

    if (!article) {
      res.status(404).json({ error: '文章不存在' });
      return;
    }

    res.json({ success: true, data: article });
  } catch (error) {
    console.error('获取文章详情失败:', error);
    res.status(500).json({ error: '获取文章详情失败' });
  }
}

/**
 * 更新文章
 * PUT /api/factory/articles/:id
 */
export function updateArticleController(req: Request, res: Response): void {
  try {
    const id = req.params.id as string;
    const { title, content, cover_image, images, status } = req.body;

    const success = updateArticle(id, { title, content, cover_image, images, status });

    if (!success) {
      res.status(404).json({ error: '文章不存在' });
      return;
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新文章失败:', error);
    res.status(500).json({ error: '更新文章失败' });
  }
}

/**
 * 删除文章
 * DELETE /api/factory/articles/:id
 */
export function removeArticle(req: Request, res: Response): void {
  try {
    const id = req.params.id as string;
    const success = deleteArticle(id);

    if (!success) {
      res.status(404).json({ error: '文章不存在' });
      return;
    }

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除文章失败:', error);
    res.status(500).json({ error: '删除文章失败' });
  }
}

// ========================================
// AI 生成相关（模拟实现）
// ========================================

async function generateArticleContent(
  theme: string,
  style?: string,
  length?: string
): Promise<{ title: string; content: string }> {
  // TODO: 调用真实的 AI 服务
  const wordCount = length === 'long' ? 2000 : length === 'short' ? 800 : 1500;

  return {
    title: `${theme}：全面解析与实践指南`,
    content: `<h1>${theme}</h1><p>这是一篇关于${theme}的${style || '专业'}风格文章，共约${wordCount}字...</p>`,
  };
}

async function fetchUnsplashImages(theme: string, count: number): Promise<string[]> {
  // TODO: 调用真实的 Unsplash API
  return Array(count).fill('').map((_, i) =>
    `https://picsum.photos/800/400?random=${Date.now() + i}`
  );
}

// ========================================
// 账号管理控制器
// ========================================

import {
  createWechatAccount,
  getWechatAccounts,
  getWechatAccountById,
  updateWechatAccount,
  deleteWechatAccount,
  createXiaohongshuAccount,
  getXiaohongshuAccounts,
  getXiaohongshuAccountById,
  updateXiaohongshuAccount,
  deleteXiaohongshuAccount,
} from '../services/AccountService';

// ----- 公众号账号 -----

export function createWechatAccountController(req: Request, res: Response): void {
  try {
    const { name, app_id, app_secret } = req.body;

    if (!name || !app_id || !app_secret) {
      res.status(400).json({ error: '参数不完整' });
      return;
    }

    const id = createWechatAccount({ name, app_id, app_secret });
    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('创建公众号账号失败:', error);
    res.status(500).json({ error: '创建公众号账号失败' });
  }
}

export function listWechatAccounts(_req: Request, res: Response): void {
  try {
    const accounts = getWechatAccounts();
    res.json({ success: true, data: accounts });
  } catch (error) {
    console.error('获取公众号账号列表失败:', error);
    res.status(500).json({ error: '获取公众号账号列表失败' });
  }
}

export function updateWechatAccountController(req: Request, res: Response): void {
  try {
    const id = req.params.id as string;
    const { name, app_id, app_secret, status } = req.body;

    const success = updateWechatAccount(id, { name, app_id, app_secret, status });

    if (!success) {
      res.status(404).json({ error: '账号不存在' });
      return;
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新公众号账号失败:', error);
    res.status(500).json({ error: '更新公众号账号失败' });
  }
}

export function removeWechatAccount(req: Request, res: Response): void {
  try {
    const id = req.params.id as string;
    const success = deleteWechatAccount(id);

    if (!success) {
      res.status(404).json({ error: '账号不存在' });
      return;
    }

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除公众号账号失败:', error);
    res.status(500).json({ error: '删除公众号账号失败' });
  }
}

// ----- 小红书账号 -----

export function createXiaohongshuAccountController(req: Request, res: Response): void {
  try {
    const { name, cookie } = req.body;

    if (!name || !cookie) {
      res.status(400).json({ error: '参数不完整' });
      return;
    }

    const id = createXiaohongshuAccount({ name, cookie });
    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('创建小红书账号失败:', error);
    res.status(500).json({ error: '创建小红书账号失败' });
  }
}

export function listXiaohongshuAccounts(_req: Request, res: Response): void {
  try {
    const accounts = getXiaohongshuAccounts();
    res.json({ success: true, data: accounts });
  } catch (error) {
    console.error('获取小红书账号列表失败:', error);
    res.status(500).json({ error: '获取小红书账号列表失败' });
  }
}

export function updateXiaohongshuAccountController(req: Request, res: Response): void {
  try {
    const id = req.params.id as string;
    const { name, cookie, status } = req.body;

    const success = updateXiaohongshuAccount(id, { name, cookie, status });

    if (!success) {
      res.status(404).json({ error: '账号不存在' });
      return;
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新小红书账号失败:', error);
    res.status(500).json({ error: '更新小红书账号失败' });
  }
}

export function removeXiaohongshuAccount(req: Request, res: Response): void {
  try {
    const id = req.params.id as string;
    const success = deleteXiaohongshuAccount(id);

    if (!success) {
      res.status(404).json({ error: '账号不存在' });
      return;
    }

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除小红书账号失败:', error);
    res.status(500).json({ error: '删除小红书账号失败' });
  }
}

// ========================================
// 发布管理控制器
// ========================================

import { updatePublishStatus } from '../services/ArticleService';
import type { PublishToWechatRequest, PublishToXiaohongshuRequest } from '../types/factory';

/**
 * 发布到公众号
 * POST /api/factory/publish/wechat
 */
export async function publishToWechat(req: Request, res: Response): Promise<void> {
  try {
    const { article_id, account_id, mode } = req.body as PublishToWechatRequest;

    if (!article_id || !account_id) {
      res.status(400).json({ error: '参数不完整' });
      return;
    }

    // TODO: 调用真实的公众号发布 API
    const postId = `wechat_${Date.now()}`;

    // 更新发布状态
    updatePublishStatus(article_id, 'wechat', {
      account_id,
      status: mode === 'draft' ? 'draft' : 'published',
      post_id: postId,
    });

    res.json({
      success: true,
      data: {
        post_id: postId,
        status: mode === 'draft' ? '草稿已保存' : '发布成功',
      },
    });
  } catch (error) {
    console.error('发布到公众号失败:', error);
    res.status(500).json({ error: '发布到公众号失败' });
  }
}

/**
 * 发布到小红书
 * POST /api/factory/publish/xiaohongshu
 */
export async function publishToXiaohongshu(req: Request, res: Response): Promise<void> {
  try {
    const { article_id, account_id } = req.body as PublishToXiaohongshuRequest;

    if (!article_id || !account_id) {
      res.status(400).json({ error: '参数不完整' });
      return;
    }

    // TODO: 调用真实的小红书发布 API
    const postId = `xhs_${Date.now()}`;

    // 更新发布状态
    updatePublishStatus(article_id, 'xiaohongshu', {
      account_id,
      status: 'published',
      post_id: postId,
    });

    res.json({
      success: true,
      data: {
        post_id: postId,
        status: '发布成功',
      },
    });
  } catch (error) {
    console.error('发布到小红书失败:', error);
    res.status(500).json({ error: '发布到小红书失败' });
  }
}

/**
 * 获取发布统计数据
 * GET /api/factory/stats
 */
export function getPublishStats(_req: Request, res: Response): void {
  try {
    const counts = getArticleCountByStatus();

    // TODO: 计算更详细的统计数据
    const stats = {
      total_published: counts.published,
      total_drafts: counts.draft,
      total_pending: counts.pending,
      total_read_count: 0,
      total_like_count: 0,
      avg_engagement_rate: 0,
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
}

// ========================================
// 设置 API（API Key 配置）
// ========================================

import {
  getSetting,
  setSetting,
  getAllSettings,
  hasApiKeys,
} from '../services/SettingsService';

/**
 * 获取设置
 * GET /api/factory/settings
 */
export function getSettings(_req: Request, res: Response): void {
  try {
    const settings = getAllSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('获取设置失败:', error);
    res.status(500).json({ error: '获取设置失败' });
  }
}

/**
 * 获取 API Key 配置状态
 * GET /api/factory/settings/status
 */
export function getSettingsStatus(_req: Request, res: Response): void {
  try {
    const status = hasApiKeys();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('获取设置状态失败:', error);
    res.status(500).json({ error: '获取设置状态失败' });
  }
}

/**
 * 更新设置
 * PUT /api/factory/settings
 */
export function updateSettings(req: Request, res: Response): void {
  try {
    const { qwen_api_key, jizhi_api_key } = req.body;

    if (qwen_api_key !== undefined) {
      setSetting('qwen_api_key', qwen_api_key);
    }
    if (jizhi_api_key !== undefined) {
      setSetting('jizhi_api_key', jizhi_api_key);
    }

    res.json({ success: true, message: '设置已保存' });
  } catch (error) {
    console.error('保存设置失败:', error);
    res.status(500).json({ error: '保存设置失败' });
  }
}
