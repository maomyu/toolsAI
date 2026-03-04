/**
 * [INPUT]: 依赖 axios 或 fetch
 * [OUTPUT]: 对外提供内容工厂 API 调用函数
 * [POS]: services 服务层，封装内容工厂相关的 API 请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const API_BASE = '/api/factory';

// ========================================
// 类型定义
// ========================================

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
}

export interface WordCloudItem {
  word: string;
  count: number;
}

export interface ReadDistribution {
  ranges: Array<{
    label: string;
    count: number;
    percentage: number;
  }>;
  avg: number;
  max: number;
  min: number;
}

export interface TimeDistribution {
  byDate: Array<{
    date: string;
    count: number;
  }>;
  byHour: Array<{
    hour: number;
    count: number;
  }>;
  byDayOfWeek: Array<{
    day: string;
    count: number;
  }>;
}

// AI 洞察类型
export interface TopicInsight {
  category: string;  // '趋势' | '痛点' | '策略' | '机会'
  title: string;
  description: string;
  evidence: string[];
  suggestion?: string;
}

// 进度信息类型
export type AnalysisStep = 'pending' | 'fetching' | 'processing' | 'ranking' | 'wordcloud' | 'ai_analyzing' | 'insights' | 'saving' | 'completed' | 'failed';

export interface ProgressInfo {
  step: AnalysisStep;
  progress: number;
  message: string;
  completedSteps: AnalysisStep[];
  partialData?: {
    articleCount?: number;
    topLiked?: SourceArticle[];
    topEngagement?: SourceArticle[];
    wordCloud?: WordCloudItem[];
    aiProgress?: { current: number; total: number };
  };
}

export type InsightsStatus = 'none' | 'analyzing' | 'completed' | 'failed';

export interface AnalysisReport {
  id: string;
  keyword: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  article_count: number;
  top_liked: SourceArticle[];
  top_engagement: SourceArticle[];
  articles?: SourceArticle[];  // 全部文章（仅在详情中返回）
  word_cloud: WordCloudItem[];
  insights: TopicInsight[];  // 结构化洞察
  insights_status?: InsightsStatus;  // AI 洞察生成状态
  read_distribution?: ReadDistribution;
  time_distribution?: TimeDistribution;
  created_at: string;
  completed_at?: string;
}

export interface CreatedArticle {
  id: string;
  report_id?: string;
  title: string;
  content: string;
  cover_image?: string;
  images: string[];
  status: 'draft' | 'pending' | 'published';
  wechat_account_id?: string;
  wechat_status: 'none' | 'draft' | 'pending' | 'published' | 'failed';
  wechat_post_id?: string;
  wechat_published_at?: string;
  wechat_read_count?: number;
  wechat_like_count?: number;
  xiaohongshu_account_id?: string;
  xiaohongshu_status: 'none' | 'draft' | 'pending' | 'published' | 'failed';
  xiaohongshu_post_id?: string;
  xiaohongshu_published_at?: string;
  xiaohongshu_read_count?: number;
  xiaohongshu_like_count?: number;
  created_at: string;
  updated_at: string;
}

export interface WechatAccount {
  id: string;
  name: string;
  app_id: string;
  app_secret: string;
  status: 'pending' | 'active' | 'expired';
  created_at: string;
}

export interface XiaohongshuAccount {
  id: string;
  name: string;
  cookie: string;
  status: 'pending' | 'active' | 'expired';
  created_at: string;
}

export interface PublishStats {
  total_published: number;
  total_drafts: number;
  total_pending: number;
  total_read_count: number;
  total_like_count: number;
  avg_engagement_rate: number;
}

// ========================================
// 搜一搜类型定义
// ========================================

export interface WebSearchRequest {
  keyword: string;
  publish_time_type?: 0 | 1 | 2 | 3;  // 0=不限 1=1天 2=7天 3=半年
  sort_type?: 0 | 1 | 2;               // 0=综合 1=最新 2=最热
  currentPage?: number;
}

export interface SearchedArticle {
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

export interface WebSearchResult {
  articles: SearchedArticle[];
  cost_money: number;
  remain_money: number;
}

// ========================================
// 选题分析 API
// ========================================

export async function startAnalysis(keyword: string, period: number = 7): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword, period }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export interface KeywordHistoryItem {
  keyword: string;
  last_analyzed: string;
  article_count: number;
  status: string;
}

export async function getKeywordHistory(): Promise<KeywordHistoryItem[]> {
  const res = await fetch(`${API_BASE}/keywords`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function getAnalysisList(): Promise<AnalysisReport[]> {
  const res = await fetch(`${API_BASE}/analysis`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function getAnalysisById(id: string): Promise<AnalysisReport & { articles: SourceArticle[] }> {
  const res = await fetch(`${API_BASE}/analysis/${id}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function getAnalysisProgress(id: string): Promise<ProgressInfo & {
  id: string;
  keyword: string;
  status: string;
  insights_status: InsightsStatus;
  article_count: number;
}> {
  const res = await fetch(`${API_BASE}/analysis/${id}/progress`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function deleteAnalysis(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/analysis/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function generateInsights(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/analysis/${id}/insights`, { method: 'POST' });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

// ========================================
// 内容创作 API
// ========================================

export async function createArticle(params: {
  report_id?: string;
  theme: string;
  style?: string;
  length?: string;
  image_count?: number;
}): Promise<{ id: string; title: string }> {
  const res = await fetch(`${API_BASE}/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function getArticleList(params?: {
  status?: string;
  limit?: number;
}): Promise<{ articles: CreatedArticle[]; counts: Record<string, number> }> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.limit) query.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/articles?${query}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function getArticleById(id: string): Promise<CreatedArticle> {
  const res = await fetch(`${API_BASE}/articles/${id}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function updateArticle(id: string, params: Partial<CreatedArticle>): Promise<void> {
  const res = await fetch(`${API_BASE}/articles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function deleteArticle(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/articles/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

// ========================================
// 发布管理 API
// ========================================

export async function publishToWechat(params: {
  article_id: string;
  account_id: string;
  mode: 'draft' | 'publish';
}): Promise<{ post_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/publish/wechat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function publishToXiaohongshu(params: {
  article_id: string;
  account_id: string;
}): Promise<{ post_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/publish/xiaohongshu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function getPublishStats(): Promise<PublishStats> {
  const res = await fetch(`${API_BASE}/stats`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// ========================================
// 账号管理 API
// ========================================

export async function getWechatAccounts(): Promise<WechatAccount[]> {
  const res = await fetch(`${API_BASE}/accounts/wechat`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function createWechatAccount(params: {
  name: string;
  app_id: string;
  app_secret: string;
}): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/accounts/wechat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function updateWechatAccount(id: string, params: Partial<WechatAccount>): Promise<void> {
  const res = await fetch(`${API_BASE}/accounts/wechat/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function deleteWechatAccount(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/accounts/wechat/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function getXiaohongshuAccounts(): Promise<XiaohongshuAccount[]> {
  const res = await fetch(`${API_BASE}/accounts/xiaohongshu`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function createXiaohongshuAccount(params: {
  name: string;
  cookie: string;
}): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/accounts/xiaohongshu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function updateXiaohongshuAccount(id: string, params: Partial<XiaohongshuAccount>): Promise<void> {
  const res = await fetch(`${API_BASE}/accounts/xiaohongshu/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

export async function deleteXiaohongshuAccount(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/accounts/xiaohongshu/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

// ========================================
// 设置 API
// ========================================

export async function getSettings(): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/settings`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function getSettingsStatus(): Promise<{ qwen: boolean; jizhi: boolean }> {
  const res = await fetch(`${API_BASE}/settings/status`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export async function updateSettings(params: {
  qwen_api_key?: string;
  jizhi_api_key?: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

// ========================================
// 搜一搜 API
// ========================================

export async function webSearch(params: WebSearchRequest): Promise<WebSearchResult> {
  const res = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyword: params.keyword,
      publish_time_type: params.publish_time_type ?? 2,  // 默认7天
      sort_type: params.sort_type ?? 2,                  // 默认最热
      currentPage: params.currentPage ?? 1,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}
