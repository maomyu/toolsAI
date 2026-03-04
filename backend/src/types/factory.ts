/**
 * [INPUT]: 无外部依赖
 * [OUTPUT]: 对外提供内容工厂相关的 TypeScript 类型定义
 * [POS]: types 类型层，定义内容工厂模块的数据结构
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// ========================================
// 关键词模板
// ========================================

export interface KeywordTemplate {
  id: string;
  keyword: string;
  created_at: string;
}

// ========================================
// 账号管理
// ========================================

export type AccountStatus = 'pending' | 'active' | 'expired';

export interface WechatAccount {
  id: string;
  name: string;
  app_id: string;
  app_secret: string;
  status: AccountStatus;
  created_at: string;
}

export interface XiaohongshuAccount {
  id: string;
  name: string;
  cookie: string;
  status: AccountStatus;
  created_at: string;
}

// ========================================
// 选题分析
// ========================================

export type AnalysisStatus = 'pending' | 'analyzing' | 'completed' | 'failed';

export interface SourceArticle {
  id: string;
  report_id: string;
  title: string;
  content: string;
  read_count: number;
  like_count: number;
  share_count: number;  // 实际存储"再看数"(looking)，API 未返回分享数
  engagement_rate: number;
  summary?: string;
  url: string;
  created_at: string;
}

export interface WordCloudItem {
  word: string;
  count: number;
}

// 阅读量分布
export interface ReadDistribution {
  ranges: Array<{
    label: string;  // 如 "0-1000", "1001-5000"
    count: number;
    percentage: number;
  }>;
  avg: number;
  max: number;
  min: number;
}

// 发布时间分布
export interface TimeDistribution {
  byDate: Array<{
    date: string;  // YYYY-MM-DD
    count: number;
  }>;
  byHour: Array<{
    hour: number;  // 0-23
    count: number;
  }>;
  byDayOfWeek: Array<{
    day: string;  // 周一、周二...
    count: number;
  }>;
}

export type InsightsStatus = 'none' | 'analyzing' | 'completed' | 'failed';

export interface AnalysisReport {
  id: string;
  keyword: string;
  status: AnalysisStatus;
  article_count: number;
  top_liked: SourceArticle[];
  top_engagement: SourceArticle[];
  articles?: SourceArticle[];  // 全部文章（仅在详情中返回）
  word_cloud: WordCloudItem[];
  insights: string[];
  insights_status?: InsightsStatus;  // AI 洞察生成状态
  read_distribution?: ReadDistribution;
  time_distribution?: TimeDistribution;
  created_at: string;
  completed_at?: string;
}

// 数据库存储格式
export interface AnalysisReportRow {
  id: string;
  keyword: string;
  status: AnalysisStatus;
  article_count: number;
  top_liked: string; // JSON
  top_engagement: string; // JSON
  word_cloud: string; // JSON
  insights: string; // JSON
  insights_status?: string;
  read_distribution?: string; // JSON
  time_distribution?: string; // JSON
  created_at: string;
  completed_at?: string;
}

// ========================================
// 内容创作
// ========================================

export type ArticleStatus = 'draft' | 'pending' | 'published';
export type PublishStatus = 'none' | 'draft' | 'pending' | 'published' | 'failed';

export interface CreatedArticle {
  id: string;
  report_id?: string;
  title: string;
  content: string;
  cover_image?: string;
  images: string[];
  status: ArticleStatus;

  // 公众号发布信息
  wechat_account_id?: string;
  wechat_status: PublishStatus;
  wechat_post_id?: string;
  wechat_published_at?: string;
  wechat_read_count?: number;
  wechat_like_count?: number;

  // 小红书发布信息
  xiaohongshu_account_id?: string;
  xiaohongshu_status: PublishStatus;
  xiaohongshu_post_id?: string;
  xiaohongshu_published_at?: string;
  xiaohongshu_read_count?: number;
  xiaohongshu_like_count?: number;

  created_at: string;
  updated_at: string;
}

// 数据库存储格式
export interface CreatedArticleRow {
  id: string;
  report_id?: string;
  title: string;
  content: string;
  cover_image?: string;
  images: string; // JSON
  status: ArticleStatus;

  wechat_account_id?: string;
  wechat_status: PublishStatus;
  wechat_post_id?: string;
  wechat_published_at?: string;
  wechat_read_count?: number;
  wechat_like_count?: number;

  xiaohongshu_account_id?: string;
  xiaohongshu_status: PublishStatus;
  xiaohongshu_post_id?: string;
  xiaohongshu_published_at?: string;
  xiaohongshu_read_count?: number;
  xiaohongshu_like_count?: number;

  created_at: string;
  updated_at: string;
}

// ========================================
// API 请求/响应类型
// ========================================

// 选题分析
export interface StartAnalysisRequest {
  keyword: string;
}

export interface AnalysisProgress {
  id: string;
  keyword: string;
  status: AnalysisStatus;
  progress: number; // 0-100
  message: string;
  article_count: number;
}

// 内容创作
export interface CreateArticleRequest {
  report_id?: string;
  theme: string;
  style?: string;
  length?: 'short' | 'medium' | 'long';
  image_count?: number;
}

// 发布
export interface PublishToWechatRequest {
  article_id: string;
  account_id: string;
  mode: 'draft' | 'publish';
}

export interface PublishToXiaohongshuRequest {
  article_id: string;
  account_id: string;
}

// 统计
export interface PublishStats {
  total_published: number;
  total_read_count: number;
  total_like_count: number;
  avg_engagement_rate: number;
  wechat_count: number;
  xiaohongshu_count: number;
}

export interface ArticleStats {
  id: string;
  title: string;
  platform: 'wechat' | 'xiaohongshu';
  read_count: number;
  like_count: number;
  engagement_rate: number;
  published_at: string;
}

// ========================================
// AI 洞察相关类型
// ========================================

export type InsightCategory = '趋势' | '痛点' | '策略' | '机会';

export interface TopicInsight {
  category: string;  // '趋势' | '痛点' | '策略' | '机会'
  title: string;
  description: string;
  evidence: string[];
  suggestion?: string;
}

export interface ArticleSummary {
  theme: string;
  keyPoints: string[];
  keywords: string[];
  highlights: string[];
  targetAudience: string;
}

// ========================================
// 进度信息类型
// ========================================

export type AnalysisStep = 'pending' | 'fetching' | 'processing' | 'ranking' | 'wordcloud' | 'ai_analyzing' | 'insights' | 'saving' | 'completed' | 'failed';

export interface ProgressInfo {
  step: AnalysisStep;           // 当前步骤
  progress: number;             // 0-100
  message: string;              // 用户可见消息
  completedSteps: AnalysisStep[]; // 已完成步骤
  partialData?: {               // 部分结果（增量展示用）
    articleCount?: number;
    topLiked?: SourceArticle[];
    topEngagement?: SourceArticle[];
    wordCloud?: WordCloudItem[];
    aiProgress?: { current: number; total: number };
  };
}
