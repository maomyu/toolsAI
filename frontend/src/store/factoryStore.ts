/**
 * [INPUT]: 依赖 zustand、factoryApi
 * [OUTPUT]: 对外提供 useFactoryStore hook
 * [POS]: store 状态管理层，管理内容工厂页面状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from 'zustand';
import * as factoryApi from '../services/factoryApi';
import type {
  AnalysisReport,
  SourceArticle,
  CreatedArticle,
  WechatAccount,
  XiaohongshuAccount,
  PublishStats,
  KeywordHistoryItem,
  ProgressInfo,
  InsightsStatus,
  SearchedArticle,
} from '../services/factoryApi';

// ========================================
// 状态类型定义
// ========================================

interface FactoryState {
  // 选题分析
  analysisList: AnalysisReport[];
  currentReport: (AnalysisReport & { articles: SourceArticle[] }) | null;
  analysisProgress: (ProgressInfo & { id: string; keyword?: string; status: string; insights_status: InsightsStatus; article_count: number }) | null;
  isAnalyzing: boolean;
  insightsLoading: boolean;  // AI 洞察生成中
  keywordHistory: KeywordHistoryItem[];

  // 内容创作
  articleList: CreatedArticle[];
  articleCounts: Record<string, number>;
  currentArticle: CreatedArticle | null;
  isCreating: boolean;
  creationProgress: { progress: number; message: string } | null;

  // 账号管理
  wechatAccounts: WechatAccount[];
  xiaohongshuAccounts: XiaohongshuAccount[];

  // 统计
  stats: PublishStats | null;

  // UI 状态
  activeMenu: string;
  isLoading: boolean;
  error: string | null;

  // 搜一搜
  searchResults: SearchedArticle[];
  isSearching: boolean;
  searchCost: { cost_money: number; remain_money: number } | null;

  // Actions - 选题分析
  setActiveMenu: (menu: string) => void;
  fetchAnalysisList: () => Promise<void>;
  fetchAnalysisById: (id: string) => Promise<void>;
  startAnalysis: (keyword: string, period?: number) => Promise<string>;
  pollAnalysisProgress: (id: string) => Promise<void>;
  deleteAnalysis: (id: string) => Promise<void>;
  fetchKeywordHistory: () => Promise<void>;
  generateInsights: (id: string) => Promise<void>;  // 生成 AI 洞察

  // Actions - 内容创作
  fetchArticleList: (status?: string) => Promise<void>;
  fetchArticleById: (id: string) => Promise<void>;
  createArticle: (params: {
    report_id?: string;
    theme: string;
    style?: string;
    length?: string;
    image_count?: number;
  }) => Promise<string>;
  updateArticle: (id: string, params: Partial<CreatedArticle>) => Promise<void>;
  deleteArticle: (id: string) => Promise<void>;

  // Actions - 发布
  publishToWechat: (articleId: string, accountId: string, mode: 'draft' | 'publish') => Promise<void>;
  publishToXiaohongshu: (articleId: string, accountId: string) => Promise<void>;

  // Actions - 账号管理
  fetchWechatAccounts: () => Promise<void>;
  createWechatAccount: (params: { name: string; app_id: string; app_secret: string }) => Promise<void>;
  updateWechatAccount: (id: string, params: Partial<WechatAccount>) => Promise<void>;
  deleteWechatAccount: (id: string) => Promise<void>;

  fetchXiaohongshuAccounts: () => Promise<void>;
  createXiaohongshuAccount: (params: { name: string; cookie: string }) => Promise<void>;
  updateXiaohongshuAccount: (id: string, params: Partial<XiaohongshuAccount>) => Promise<void>;
  deleteXiaohongshuAccount: (id: string) => Promise<void>;

  // Actions - 统计
  fetchStats: () => Promise<void>;

  // 通用
  setError: (error: string | null) => void;
  reset: () => void;

  // Actions - 搜一搜
  doSearch: (keyword: string, options?: { timeType?: number; sortType?: number }) => Promise<void>;
  clearSearch: () => void;
}

// ========================================
// 初始状态
// ========================================

const initialState = {
  analysisList: [],
  currentReport: null,
  analysisProgress: null,
  isAnalyzing: false,
  insightsLoading: false,
  keywordHistory: [],

  articleList: [],
  articleCounts: { draft: 0, pending: 0, published: 0 },
  currentArticle: null,
  isCreating: false,
  creationProgress: null,

  wechatAccounts: [],
  xiaohongshuAccounts: [],

  stats: null,

  activeMenu: 'analysis',
  isLoading: false,
  error: null,

  searchResults: [],
  isSearching: false,
  searchCost: null,
};

// ========================================
// Store 定义
// ========================================

export const useFactoryStore = create<FactoryState>((set, get) => ({
  ...initialState,

  // ----- 选题分析 -----

  setActiveMenu: (menu) => set({ activeMenu: menu }),

  fetchAnalysisList: async () => {
    set({ isLoading: true, error: null });
    try {
      const list = await factoryApi.getAnalysisList();
      set({ analysisList: list, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchAnalysisById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const report = await factoryApi.getAnalysisById(id);
      set({ currentReport: report, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  startAnalysis: async (keyword, period = 7) => {
    set({ isAnalyzing: true, error: null });
    try {
      const result = await factoryApi.startAnalysis(keyword, period);
      // 开始轮询进度
      get().pollAnalysisProgress(result.id);
      return result.id;
    } catch (error: any) {
      set({ error: error.message, isAnalyzing: false });
      throw error;
    }
  },

  pollAnalysisProgress: async (id) => {
    const poll = async () => {
      try {
        const progress = await factoryApi.getAnalysisProgress(id);
        set({ analysisProgress: progress });

        if (progress.status === 'completed' || progress.status === 'failed') {
          set({ isAnalyzing: false });
          // 刷新列表
          get().fetchAnalysisList();
          // 如果是失败，显示错误信息
          if (progress.status === 'failed') {
            set({ error: progress.message });
          }
          // 如果是完成，加载详情
          if (progress.status === 'completed') {
            get().fetchAnalysisById(id);
          }
        } else {
          // 继续轮询
          setTimeout(poll, 1500);
        }
      } catch (error: any) {
        set({ error: error.message, isAnalyzing: false });
      }
    };
    poll();
  },

  deleteAnalysis: async (id) => {
    try {
      await factoryApi.deleteAnalysis(id);
      set((state) => ({
        analysisList: state.analysisList.filter((r) => r.id !== id),
        currentReport: state.currentReport?.id === id ? null : state.currentReport,
      }));
      // 刷新关键词历史
      get().fetchKeywordHistory();
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  fetchKeywordHistory: async () => {
    try {
      const history = await factoryApi.getKeywordHistory();
      set({ keywordHistory: history });
    } catch (error: any) {
      console.error('获取关键词历史失败:', error);
    }
  },

  generateInsights: async (id) => {
    set({ insightsLoading: true, error: null });
    try {
      await factoryApi.generateInsights(id);
      // 立即刷新列表，显示 "AI分析中..." 状态
      await get().fetchAnalysisList();
      // 轮询进度
      const poll = async () => {
        try {
          const progress = await factoryApi.getAnalysisProgress(id);
          // 更新进度显示
          set({ analysisProgress: progress });

          if (progress.status === 'completed' && progress.insights_status === 'completed') {
            const report = await factoryApi.getAnalysisById(id);
            set({ currentReport: report, insightsLoading: false, analysisProgress: null });
            get().fetchAnalysisList();
          } else if (progress.insights_status === 'failed') {
            set({ error: 'AI 洞察生成失败', insightsLoading: false, analysisProgress: null });
            get().fetchAnalysisList();
          } else {
            // 继续轮询
            setTimeout(poll, 1500);
          }
        } catch (e) {
          console.error('轮询进度失败:', e);
          setTimeout(poll, 2000);
        }
      };
      setTimeout(poll, 1500);
    } catch (error: any) {
      set({ error: error.message, insightsLoading: false });
    }
  },

  // ----- 内容创作 -----

  fetchArticleList: async (status) => {
    set({ isLoading: true, error: null });
    try {
      const result = await factoryApi.getArticleList({ status });
      set({ articleList: result.articles, articleCounts: result.counts, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchArticleById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const article = await factoryApi.getArticleById(id);
      set({ currentArticle: article, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createArticle: async (params) => {
    set({ isCreating: true, error: null });
    try {
      const result = await factoryApi.createArticle(params);
      // 刷新列表
      get().fetchArticleList();
      set({ isCreating: false });
      return result.id;
    } catch (error: any) {
      set({ error: error.message, isCreating: false });
      throw error;
    }
  },

  updateArticle: async (id, params) => {
    try {
      await factoryApi.updateArticle(id, params);
      // 更新本地状态
      set((state) => ({
        articleList: state.articleList.map((a) =>
          a.id === id ? { ...a, ...params } : a
        ),
        currentArticle:
          state.currentArticle?.id === id
            ? { ...state.currentArticle, ...params }
            : state.currentArticle,
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteArticle: async (id) => {
    try {
      await factoryApi.deleteArticle(id);
      set((state) => ({
        articleList: state.articleList.filter((a) => a.id !== id),
        currentArticle: state.currentArticle?.id === id ? null : state.currentArticle,
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // ----- 发布 -----

  publishToWechat: async (articleId, accountId, mode) => {
    try {
      await factoryApi.publishToWechat({
        article_id: articleId,
        account_id: accountId,
        mode,
      });
      // 刷新文章列表
      get().fetchArticleList();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  publishToXiaohongshu: async (articleId, accountId) => {
    try {
      await factoryApi.publishToXiaohongshu({
        article_id: articleId,
        account_id: accountId,
      });
      // 刷新文章列表
      get().fetchArticleList();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  // ----- 账号管理 -----

  fetchWechatAccounts: async () => {
    try {
      const accounts = await factoryApi.getWechatAccounts();
      set({ wechatAccounts: accounts });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  createWechatAccount: async (params) => {
    try {
      await factoryApi.createWechatAccount(params);
      get().fetchWechatAccounts();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  updateWechatAccount: async (id, params) => {
    try {
      await factoryApi.updateWechatAccount(id, params);
      get().fetchWechatAccounts();
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteWechatAccount: async (id) => {
    try {
      await factoryApi.deleteWechatAccount(id);
      set((state) => ({
        wechatAccounts: state.wechatAccounts.filter((a) => a.id !== id),
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  fetchXiaohongshuAccounts: async () => {
    try {
      const accounts = await factoryApi.getXiaohongshuAccounts();
      set({ xiaohongshuAccounts: accounts });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  createXiaohongshuAccount: async (params) => {
    try {
      await factoryApi.createXiaohongshuAccount(params);
      get().fetchXiaohongshuAccounts();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  updateXiaohongshuAccount: async (id, params) => {
    try {
      await factoryApi.updateXiaohongshuAccount(id, params);
      get().fetchXiaohongshuAccounts();
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteXiaohongshuAccount: async (id) => {
    try {
      await factoryApi.deleteXiaohongshuAccount(id);
      set((state) => ({
        xiaohongshuAccounts: state.xiaohongshuAccounts.filter((a) => a.id !== id),
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // ----- 统计 -----

  fetchStats: async () => {
    try {
      const stats = await factoryApi.getPublishStats();
      set({ stats });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // ----- 通用 -----

  setError: (error) => set({ error }),

  reset: () => set(initialState),

  // ----- 搜一搜 -----

  doSearch: async (keyword, options = {}) => {
    set({ isSearching: true, error: null });
    try {
      const result = await factoryApi.webSearch({
        keyword,
        publish_time_type: options.timeType as 0 | 1 | 2 | 3,
        sort_type: options.sortType as 0 | 1 | 2,
      });
      set({
        searchResults: result.articles,
        searchCost: { cost_money: result.cost_money, remain_money: result.remain_money },
        isSearching: false,
      });
    } catch (error: any) {
      set({ error: error.message, isSearching: false });
    }
  },

  clearSearch: () => set({ searchResults: [], searchCost: null }),
}));
