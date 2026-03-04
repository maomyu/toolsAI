/**
 * [INPUT]: 依赖 database.ts、AIService
 * [OUTPUT]: 对外提供选题分析相关服务
 * [POS]: services 服务层，处理选题分析业务逻辑
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { db, generateId } from '../models/database';
import type {
  AnalysisReport,
  AnalysisReportRow,
  SourceArticle,
  WordCloudItem,
  AnalysisStatus,
  ProgressInfo,
  InsightsStatus
} from '../types/factory';

// ========================================
// 选题分析服务
// ========================================

/**
 * 创建新的分析任务
 */
export function createAnalysis(keyword: string): string {
  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO analysis_reports (id, keyword, status)
    VALUES (?, ?, 'pending')
  `);
  stmt.run(id, keyword);
  return id;
}

/**
 * 获取分析报告列表
 */
export function getAnalysisList(limit = 20): AnalysisReport[] {
  const stmt = db.prepare(`
    SELECT * FROM analysis_reports
    ORDER BY created_at DESC
    LIMIT ?
  `);
  const rows = stmt.all(limit) as AnalysisReportRow[];
  return rows.map(rowToReport);
}

/**
 * 获取单个分析报告
 */
export function getAnalysisById(id: string): AnalysisReport | null {
  const stmt = db.prepare('SELECT * FROM analysis_reports WHERE id = ?');
  const row = stmt.get(id) as AnalysisReportRow | undefined;
  if (!row) return null;

  const report = rowToReport(row);
  // 加载所有素材文章
  report.articles = getSourceArticles(id);
  return report;
}

/**
 * 更新分析状态
 */
export function updateAnalysisStatus(id: string, status: AnalysisStatus): void {
  const stmt = db.prepare('UPDATE analysis_reports SET status = ? WHERE id = ?');
  stmt.run(status, id);
}

/**
 * 更新分析进度
 */
export function updateProgress(id: string, progressInfo: ProgressInfo): void {
  // 根据步骤确定状态
  let status: AnalysisStatus = 'analyzing';
  if (progressInfo.step === 'completed') {
    status = 'completed';
  } else if (progressInfo.step === 'failed') {
    status = 'failed';
  }

  const stmt = db.prepare(`
    UPDATE analysis_reports
    SET progress_info = ?, status = ?
    WHERE id = ?
  `);
  stmt.run(JSON.stringify(progressInfo), status, id);
}

/**
 * 获取分析进度
 */
export function getProgress(id: string): ProgressInfo | null {
  const stmt = db.prepare('SELECT progress_info, status FROM analysis_reports WHERE id = ?');
  const row = stmt.get(id) as { progress_info: string | null; status: string } | undefined;

  if (!row) return null;

  if (row.progress_info) {
    try {
      return JSON.parse(row.progress_info);
    } catch {
      return null;
    }
  }

  // 兼容旧数据：根据 status 返回基本进度
  const statusToProgress: Record<string, ProgressInfo> = {
    pending: { step: 'pending', progress: 10, message: '等待分析...', completedSteps: [] },
    analyzing: { step: 'processing', progress: 50, message: '正在分析...', completedSteps: [] },
    completed: { step: 'completed', progress: 100, message: '分析完成', completedSteps: [] },
    failed: { step: 'failed', progress: 0, message: '分析失败', completedSteps: [] },
  };

  return statusToProgress[row.status] || null;
}

/**
 * 保存分析结果
 */
export function saveAnalysisResult(
  id: string,
  data: {
    articleCount: number;
    topLiked: SourceArticle[];
    topEngagement: SourceArticle[];
    wordCloud: WordCloudItem[];
    insights: any[];  // 支持 string[] 或 TopicInsight[]
    readDistribution?: any;
    timeDistribution?: any;
  }
): void {
  const stmt = db.prepare(`
    UPDATE analysis_reports
    SET status = 'completed',
        article_count = ?,
        top_liked = ?,
        top_engagement = ?,
        word_cloud = ?,
        insights = ?,
        read_distribution = ?,
        time_distribution = ?,
        completed_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(
    data.articleCount,
    JSON.stringify(data.topLiked),
    JSON.stringify(data.topEngagement),
    JSON.stringify(data.wordCloud),
    JSON.stringify(data.insights),
    JSON.stringify(data.readDistribution || {}),
    JSON.stringify(data.timeDistribution || {}),
    id
  );
}

/**
 * 删除分析报告
 */
export function deleteAnalysis(id: string): boolean {
  const stmt = db.prepare('DELETE FROM analysis_reports WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * 删除指定关键词的所有报告（重新分析前调用）
 */
export function deleteAnalysisByKeyword(keyword: string): number {
  const stmt = db.prepare('DELETE FROM analysis_reports WHERE keyword = ?');
  const result = stmt.run(keyword);
  return result.changes;
}

/**
 * 保存素材文章
 */
export function saveSourceArticles(reportId: string, articles: Omit<SourceArticle, 'id' | 'report_id' | 'created_at'>[]): void {
  const stmt = db.prepare(`
    INSERT INTO source_articles (id, report_id, title, content, read_count, like_count, share_count, engagement_rate, summary, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: typeof articles) => {
    for (const article of items) {
      stmt.run(
        generateId(),
        reportId,
        article.title,
        article.content,
        article.read_count,
        article.like_count,
        article.share_count,
        article.engagement_rate,
        article.summary || null,
        article.url
      );
    }
  });

  insertMany(articles);
}

/**
 * 获取报告的素材文章
 */
export function getSourceArticles(reportId: string): SourceArticle[] {
  const stmt = db.prepare('SELECT * FROM source_articles WHERE report_id = ? ORDER BY like_count DESC');
  return stmt.all(reportId) as SourceArticle[];
}

/**
 * 标记分析失败
 */
export function markAnalysisFailed(id: string, error: string): void {
  const stmt = db.prepare(`
    UPDATE analysis_reports
    SET status = 'failed',
        insights = ?
    WHERE id = ?
  `);
  stmt.run(JSON.stringify([error]), id);
}

/**
 * 更新洞察生成状态
 */
export function updateInsightsStatus(id: string, status: string): void {
  const stmt = db.prepare(`
    UPDATE analysis_reports SET insights_status = ? WHERE id = ?
  `);
  stmt.run(status, id);
}

/**
 * 保存洞察结果
 */
export function saveInsights(id: string, insights: any[]): void {
  const stmt = db.prepare(`
    UPDATE analysis_reports
    SET insights = ?, insights_status = 'completed', status = 'completed',
        progress_info = ?
    WHERE id = ?
  `);
  // 设置完成的进度信息
  const completedProgress = JSON.stringify({
    step: 'completed',
    progress: 100,
    message: '洞察生成完成',
    completedSteps: ['fetching', 'processing', 'ranking', 'wordcloud', 'ai_analyzing', 'insights'],
  });
  stmt.run(JSON.stringify(insights), completedProgress, id);
}

// ========================================
// 辅助函数
// ========================================

function rowToReport(row: AnalysisReportRow): AnalysisReport {
  return {
    id: row.id,
    keyword: row.keyword,
    status: row.status,
    article_count: row.article_count,
    top_liked: parseJSON(row.top_liked, []),
    top_engagement: parseJSON(row.top_engagement, []),
    word_cloud: parseJSON(row.word_cloud, []),
    insights: parseJSON(row.insights, []),
    insights_status: (row.insights_status as InsightsStatus) || 'none',
    read_distribution: parseJSON(row.read_distribution ?? null, undefined),
    time_distribution: parseJSON(row.time_distribution ?? null, undefined),
    created_at: row.created_at,
    completed_at: row.completed_at,
  };
}

function parseJSON<T>(str: string | null, defaultValue: T): T {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}
