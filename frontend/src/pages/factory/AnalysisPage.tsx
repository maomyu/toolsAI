/**
 * [INPUT]: 依赖 React、zustand、factoryApi
 * [OUTPUT]: 对外提供选题分析页面组件
 * [POS]: pages/factory 页面层，展示选题分析功能
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState, useEffect } from 'react';
import { useFactoryStore } from '../../store/factoryStore';
import { Eye, Heart, BarChart3, TrendingUp, Cloud, ThumbsUp, Flame, Clock, Lightbulb, Loader2, Check, Circle, Target, MessageCircle, AlertCircle, BookOpen, Search } from 'lucide-react';

export function AnalysisPage() {
  const {
    analysisList,
    analysisProgress,
    isAnalyzing,
    isLoading,
    error,
    keywordHistory,
    fetchAnalysisList,
    startAnalysis,
    deleteAnalysis,
    fetchAnalysisById,
    currentReport,
    fetchKeywordHistory,
    setError,
    generateInsights,
    insightsLoading,
    // 搜一搜
    searchResults,
    isSearching,
    searchCost,
    doSearch,
    clearSearch,
  } = useFactoryStore();

  const [keyword, setKeyword] = useState('');
  const [period, setPeriod] = useState(7);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Tab 切换
  const [activeTab, setActiveTab] = useState<'analysis' | 'search'>('analysis');

  // 搜一搜表单状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchTimeType, setSearchTimeType] = useState(2);  // 默认7天
  const [searchSortType, setSearchSortType] = useState(2);  // 默认最热

  useEffect(() => {
    fetchAnalysisList();
    fetchKeywordHistory();
  }, [fetchAnalysisList, fetchKeywordHistory]);

  // 当有正在分析的任务时，轮询进度
  useEffect(() => {
    const analyzing = analysisList.find(r => r.status === 'analyzing' || r.status === 'pending');
    if (analyzing) {
      setSelectedReportId(analyzing.id);
    }
  }, [analysisList]);

  const handleStartAnalysis = async (kw?: string) => {
    const keywordToUse = kw || keyword;
    if (!keywordToUse.trim()) {
      setError('请输入关键词');
      return;
    }
    try {
      const id = await startAnalysis(keywordToUse.trim(), period);
      if (!kw) setKeyword(''); // 只在手动输入时清空
      setSelectedReportId(id);
    } catch (e) {
      // 错误已在 store 中处理
    }
  };

  const handleOpenReport = async (id: string) => {
    setSelectedReportId(id);
    if (!currentReport || currentReport.id !== id) {
      await fetchAnalysisById(id);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedReportId(null);
  };

  const handleDeleteReport = async (id: string) => {
    if (confirm('确定要删除这个分析报告吗？')) {
      await deleteAnalysis(id);
      if (selectedReportId === id) {
        setSelectedReportId(null);
      }
    }
  };

  const handleReanalyze = (kw: string) => {
    handleStartAnalysis(kw);
  };

  const handleGenerateInsights = async (id: string) => {
    await generateInsights(id);
  };

  const handleKeywordTagClick = (kw: string) => {
    setKeyword(kw);
  };

  // 搜一搜
  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      setError('请输入搜索关键词');
      return;
    }
    await doSearch(searchKeyword.trim(), { timeType: searchTimeType, sortType: searchSortType });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      analyzing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      pending: '等待中',
      analyzing: '分析中',
      completed: '已完成',
      failed: '失败',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="flex h-full">
      {/* 主内容区域 */}
      <div className={`flex-1 overflow-auto transition-all duration-300`}>
        <div className="space-y-6 p-1">
          {/* 页面标题 */}
          <div>
            <h1 className="text-2xl font-bold text-gray-800">选题分析</h1>
            <p className="text-gray-500 mt-1">输入关键词，获取公众号文章分析与选题洞察</p>
          </div>

          {/* Tab 切换 */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'analysis'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              新建分析
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'search'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Search className="w-4 h-4" />
              搜一搜
            </button>
          </div>

          {/* Tab 内容区 */}
          {activeTab === 'analysis' ? (
            <>
              {/* 历史关键词标签云 */}
              {keywordHistory.length > 0 && (
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-gray-700">历史关键词</span>
                    <span className="text-xs text-gray-400">点击快速填入</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {keywordHistory.map((item) => (
                      <button
                        key={item.keyword}
                        onClick={() => handleKeywordTagClick(item.keyword)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-primary/10 text-gray-700 hover:text-primary rounded-full text-sm transition-colors"
                      >
                        <span>{item.keyword}</span>
                        <span className="text-xs text-gray-400">({item.article_count}篇)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 新建分析 */}
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h2 className="text-lg font-medium text-gray-800 mb-4">新建分析</h2>
                <div className="flex gap-4 flex-wrap">
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStartAnalysis()}
                    placeholder="输入关键词，如：AI工具、跨境电商、新媒体运营..."
                    className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    disabled={isAnalyzing}
                  />
                  <select
                    value={period}
                    onChange={(e) => setPeriod(Number(e.target.value))}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    disabled={isAnalyzing}
                  >
                    <option value={7}>最近 7 天</option>
                    <option value={30}>最近 30 天</option>
                    <option value={90}>最近 90 天</option>
                    <option value={180}>最近 180 天</option>
                    <option value={365}>最近 1 年</option>
                  </select>
                  <button
                    onClick={() => handleStartAnalysis()}
                    disabled={isAnalyzing}
                    className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAnalyzing ? '分析中...' : '开始分析'}
                  </button>
                </div>

                {/* 分析进度 */}
                {analysisProgress && (
                  <div className="mt-4 space-y-3">
                    {/* 进度条 */}
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span className="font-medium">{analysisProgress.message}</span>
                      <span>{analysisProgress.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${analysisProgress.progress}%` }}
                      />
                    </div>

                    {/* 步骤指示器 */}
                    {analysisProgress.step === 'ai_analyzing' || analysisProgress.step === 'insights' || analysisProgress.completedSteps?.includes('ai_analyzing') ? (
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <StepIndicator
                          label="AI文章分析"
                          step="ai_analyzing"
                          current={analysisProgress.step}
                          completed={analysisProgress.completedSteps}
                          extra={analysisProgress.partialData?.aiProgress ? `${analysisProgress.partialData.aiProgress.current}/${analysisProgress.partialData.aiProgress.total}` : undefined}
                        />
                        <StepIndicator
                          label="生成洞察"
                          step="insights"
                          current={analysisProgress.step}
                          completed={analysisProgress.completedSteps}
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <StepIndicator
                          label="获取文章"
                          step="fetching"
                          current={analysisProgress.step}
                          completed={analysisProgress.completedSteps}
                          extra={analysisProgress.partialData?.articleCount ? `${analysisProgress.partialData.articleCount}篇` : undefined}
                        />
                        <StepIndicator
                          label="排行榜"
                          step="ranking"
                          current={analysisProgress.step}
                          completed={analysisProgress.completedSteps}
                        />
                        <StepIndicator
                          label="词云"
                          step="wordcloud"
                          current={analysisProgress.step}
                          completed={analysisProgress.completedSteps}
                        />
                      </div>
                    )}

                    {/* 部分结果预览 */}
                    {analysisProgress.partialData && (
                      <div className="mt-4 p-3 bg-gray-50 rounded border">
                        {analysisProgress.partialData.wordCloud && analysisProgress.partialData.wordCloud.length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Cloud className="w-3 h-3" /> 词云预览</div>
                            <div className="flex flex-wrap gap-1">
                              {analysisProgress.partialData.wordCloud.slice(0, 15).map((item, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 bg-white rounded text-xs text-gray-600 border"
                                  style={{ fontSize: `${Math.min(14, 10 + item.count / 3)}px` }}
                                >
                                  {item.word} <span className="text-gray-400">({item.count})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {analysisProgress.partialData.topLiked && analysisProgress.partialData.topLiked.length > 0 && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> 点赞 TOP3 预览</div>
                            <div className="space-y-1">
                              {analysisProgress.partialData.topLiked.slice(0, 3).map((article, idx) => (
                                <div key={idx} className="text-xs text-gray-600 flex justify-between">
                                  <span className="truncate flex-1">{idx + 1}. {article.title}</span>
                                  <span className="text-gray-400 ml-2 flex items-center gap-1"><Heart className="w-3 h-3" /> {article.like_count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* 搜一搜 Tab */
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-medium text-gray-800 mb-4">搜一搜</h2>

              {/* 搜索表单 */}
              <div className="flex gap-4 flex-wrap">
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="输入关键词搜索公众号文章..."
                  className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={isSearching}
                />
                <select
                  value={searchTimeType}
                  onChange={(e) => setSearchTimeType(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={isSearching}
                >
                  <option value={0}>不限时间</option>
                  <option value={1}>最近1天</option>
                  <option value={2}>最近7天</option>
                  <option value={3}>最近半年</option>
                </select>
                <select
                  value={searchSortType}
                  onChange={(e) => setSearchSortType(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={isSearching}
                >
                  <option value={0}>综合排序</option>
                  <option value={1}>最新发布</option>
                  <option value={2}>最热优先</option>
                </select>
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      搜索中...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      搜索
                    </>
                  )}
                </button>
              </div>

              {/* 费用提示 */}
              {searchCost && (
                <div className="mt-3 text-sm text-gray-500">
                  本次消耗 ¥{searchCost.cost_money.toFixed(2)}，余额 ¥{searchCost.remain_money.toFixed(2)}
                </div>
              )}

              {/* 搜索结果 */}
              {searchResults.length > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium text-gray-700 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      搜索结果 ({searchResults.length}篇)
                    </h3>
                    <button
                      onClick={clearSearch}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      清空结果
                    </button>
                  </div>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {searchResults.map((article, idx) => (
                      <a
                        key={idx}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 line-clamp-2">{stripHtml(article.title)}</div>
                            <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                              <span>{article.wx_name}</span>
                              {article.is_original === 1 && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">原创</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-3 text-xs text-gray-500 shrink-0">
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {formatNumber(article.read)}</span>
                            <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {article.praise}</span>
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {article.looking}</span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* 空状态 */}
              {searchResults.length === 0 && !isSearching && searchKeyword === '' && (
                <div className="mt-6 p-8 text-center text-gray-400">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>输入关键词搜索公众号文章</p>
                  <p className="text-sm mt-1">默认搜索近7天最热文章</p>
                </div>
              )}
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
            </div>
          )}

          {/* 历史报告列表 */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-800">分析报告</h2>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-gray-500">加载中...</div>
            ) : analysisList.length === 0 ? (
              <div className="p-8 text-center text-gray-500">暂无分析报告，请输入关键词开始分析</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {analysisList.map((report) => (
                  <div key={report.id}>
                    <div
                      className={`p-4 flex items-center justify-between hover:bg-gray-50 ${
                        report.status === 'completed' ? 'cursor-pointer' : ''
                      } ${selectedReportId === report.id ? 'bg-blue-50' : ''}`}
                      onClick={() => report.status === 'completed' && handleOpenReport(report.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-800">{report.keyword}</span>
                          {getStatusBadge(report.status)}
                          {report.status === 'completed' && (
                            <span className="text-sm text-gray-500">
                              {report.article_count} 篇文章
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {report.created_at && new Date(report.created_at).toLocaleString('zh-CN')}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        {report.status === 'completed' && (
                          <>
                            {(!report.insights_status || report.insights_status === 'none') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGenerateInsights(report.id);
                                }}
                                disabled={insightsLoading}
                                className="px-3 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded disabled:opacity-50"
                              >
                                生成AI洞察
                              </button>
                            )}
                            {report.insights_status === 'analyzing' && (
                              <span className="px-3 py-1 text-sm text-blue-600 flex items-center gap-1">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                AI分析中...
                                {analysisProgress?.id === report.id && analysisProgress.partialData?.aiProgress && (
                                  <span className="text-xs text-blue-500">
                                    ({analysisProgress.partialData.aiProgress.current}/{analysisProgress.partialData.aiProgress.total})
                                  </span>
                                )}
                              </span>
                            )}
                            {report.insights_status === 'completed' && (
                              <span className="px-3 py-1 text-sm text-green-600">已洞察</span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReanalyze(report.keyword);
                              }}
                              className="px-3 py-1 text-sm text-primary hover:bg-primary/10 rounded"
                            >
                              重新分析
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteReport(report.id);
                          }}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右侧抽屉 */}
      <div
        className={`h-full bg-white border-l border-gray-200 shadow-xl flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
          selectedReportId ? 'w-[600px] opacity-100' : 'w-0 opacity-0'
        }`}
      >
        {selectedReportId && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-medium text-gray-800">分析报告详情</h2>
              <button
                onClick={handleCloseDrawer}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ReportDetail reportId={selectedReportId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ========================================
// 步骤指示器组件
// ========================================

const STEP_ORDER = ['fetching', 'processing', 'ranking', 'wordcloud', 'ai_analyzing', 'insights', 'saving', 'completed', 'failed'];

function StepIndicator({
  label,
  step,
  current,
  completed,
  extra,
}: {
  label: string;
  step: string;
  current?: string;
  completed?: string[];
  extra?: string;
}) {
  const isCompleted = completed?.includes(step) || (current === 'completed' && STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf('completed'));
  const isCurrent = current === step;

  return (
    <div className={`p-2 rounded ${isCompleted ? 'bg-green-50 text-green-700' : isCurrent ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-400'}`}>
      <div className="flex items-center justify-center gap-1">
        {isCompleted ? <Check className="w-3 h-3" /> : isCurrent ? <Loader2 className="w-3 h-3 animate-spin" /> : <Circle className="w-3 h-3" />}
        <span>{label}</span>
      </div>
      {extra && <div className="text-xs opacity-75">{extra}</div>}
    </div>
  );
}

// ========================================
// 辅助函数
// ========================================

function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toLocaleString('zh-CN');
}

/**
 * 去除 HTML 标签，只保留纯文本
 */
function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

// ========================================
// 全部文章展示组件
// ========================================

interface SourceArticle {
  id?: string;
  title: string;
  url: string;
  read_count: number;
  like_count: number;
  engagement_rate?: number;
}

function AllArticlesSection({ articles }: { articles: SourceArticle[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayCount = 10;

  // 按点赞数排序
  const sortedArticles = [...articles].sort((a, b) => b.like_count - a.like_count);
  const displayArticles = showAll ? sortedArticles : sortedArticles.slice(0, displayCount);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1">
          <BookOpen className="w-4 h-4" />
          全部文章 ({articles.length}篇)
          {showAll && <span className="ml-2 text-xs text-gray-400">显示 {displayArticles.length} 篇</span>}
        </h3>
        {!showAll && articles.length > displayCount && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-primary hover:underline"
          >
            展开更多 ({articles.length - displayCount}篇)
          </button>
        )}
        {showAll && (
          <button
            onClick={() => setShowAll(false)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            收起
          </button>
        )}
      </div>
      <div className={`bg-white rounded border overflow-y-auto ${showAll ? 'max-h-[600px]' : 'max-h-80'}`}>
        <div className="divide-y divide-gray-100">
          {displayArticles.map((article, idx) => (
            <a
              key={article.id || idx}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
            >
              <span className="w-6 text-center text-xs text-gray-400 font-medium shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-800 line-clamp-1">{article.title}</div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {formatNumber(article.read_count)}</span>
                <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {article.like_count}</span>
                {article.engagement_rate !== undefined && (
                  <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {(article.engagement_rate * 100).toFixed(1)}%</span>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========================================
// 洞察分类展示组件
// ========================================

interface TopicInsight {
  category: string;
  title: string;
  description: string;
  evidence: string[];
  suggestion?: string;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; bgColor: string }> = {
  '趋势': { icon: TrendingUp, color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  '痛点': { icon: AlertCircle, color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
  '策略': { icon: Target, color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  '机会': { icon: Lightbulb, color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
};

function InsightCategories({ insights }: { insights: (string | TopicInsight)[] }) {
  // 兼容旧数据：如果是字符串数组，直接显示
  if (typeof insights[0] === 'string') {
    return (
      <div className="space-y-2">
        {(insights as string[]).map((insight, idx) => (
          <div key={idx} className="flex gap-2 items-start bg-white p-3 rounded border">
            <span className="text-primary font-bold">{idx + 1}.</span>
            <span className="text-sm text-gray-700">{insight}</span>
          </div>
        ))}
      </div>
    );
  }

  // 结构化洞察：按分类分组
  const typedInsights = insights as TopicInsight[];
  const grouped = typedInsights.reduce((acc, insight) => {
    const cat = insight.category || '其他';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(insight);
    return acc;
  }, {} as Record<string, TopicInsight[]>);

  const categoryOrder = ['趋势', '痛点', '策略', '机会'];

  return (
    <div className="space-y-4">
      {categoryOrder.map((category) => {
        const items = grouped[category];
        if (!items || items.length === 0) return null;

        const config = CATEGORY_CONFIG[category] || { icon: BarChart3, color: 'text-gray-700', bgColor: 'bg-gray-50 border-gray-200' };

        const IconComponent = config.icon;

        return (
          <div key={category}>
            <div className="flex items-center gap-2 mb-2">
              <IconComponent className="w-4 h-4" />
              <span className={`font-medium ${config.color}`}>{category}</span>
              <span className="text-xs text-gray-400">({items.length})</span>
            </div>
            <div className="space-y-2">
              {items.map((insight, idx) => (
                <div key={idx} className={`p-3 rounded border ${config.bgColor}`}>
                  <div className="font-medium text-gray-800 mb-1">{insight.title}</div>
                  <div className="text-sm text-gray-600 mb-2">{insight.description}</div>
                  {insight.evidence && insight.evidence.length > 0 && (
                    <div className="text-xs text-gray-500 mb-2">
                      <span className="font-medium">证据：</span>
                      {insight.evidence.join('；')}
                    </div>
                  )}
                  {insight.suggestion && (
                    <div className="text-xs text-primary bg-white/50 px-2 py-1 rounded inline-flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {insight.suggestion}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ========================================
// 报告详情组件
// ========================================

function ReportDetail({ reportId }: { reportId: string }) {
  const { currentReport, fetchAnalysisById } = useFactoryStore();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!currentReport || currentReport.id !== reportId) {
      setIsLoading(true);
      fetchAnalysisById(reportId).finally(() => setIsLoading(false));
    }
  }, [reportId, currentReport, fetchAnalysisById]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">加载报告详情...</div>;
  }

  if (!currentReport || currentReport.id !== reportId) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-6">
      {/* TOP5 排行榜 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 点赞 TOP5 */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><ThumbsUp className="w-4 h-4" /> 点赞 TOP5</h3>
          <div className="space-y-2">
            {currentReport.top_liked?.slice(0, 5).map((article, idx) => (
              <a
                key={article.id || idx}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white p-3 rounded border hover:border-primary transition-colors"
              >
                <div className="text-sm font-medium text-gray-800 line-clamp-1">{article.title}</div>
                <div className="text-xs text-gray-500 mt-1 flex gap-3">
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {article.like_count}</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {article.read_count}</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* 互动率 TOP5 */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><Flame className="w-4 h-4 text-orange-500" /> 互动率 TOP5</h3>
          <div className="space-y-2">
            {currentReport.top_engagement?.slice(0, 5).map((article, idx) => (
              <a
                key={article.id || idx}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white p-3 rounded border hover:border-primary transition-colors"
              >
                <div className="text-sm font-medium text-gray-800 line-clamp-1">{article.title}</div>
                <div className="text-xs text-gray-500 mt-1 flex gap-3">
                  <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {((article.engagement_rate || 0) * 100).toFixed(2)}%</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {article.read_count}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* 全部文章 */}
      {currentReport.articles && currentReport.articles.length > 0 && (
        <AllArticlesSection articles={currentReport.articles} />
      )}

      {/* 高频词云 */}
      {currentReport.word_cloud && currentReport.word_cloud.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><Cloud className="w-4 h-4" /> 高频关键词</h3>
          <div className="flex flex-wrap gap-2">
            {currentReport.word_cloud.slice(0, 30).map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded border text-gray-700 hover:border-primary transition-colors"
                style={{
                  fontSize: `${Math.min(16, 10 + item.count / 2)}px`,
                }}
              >
                <span>{item.word}</span>
                <span className="text-xs text-gray-400">({item.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 阅读量分布 */}
      {currentReport.read_distribution && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><BarChart3 className="w-4 h-4" /> 阅读量分布</h3>
          <div className="bg-white rounded border p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-center">
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-500">平均阅读</div>
                <div className="text-lg font-bold text-primary">{formatNumber(currentReport.read_distribution.avg)}</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-500">最高阅读</div>
                <div className="text-lg font-bold text-green-600">{formatNumber(currentReport.read_distribution.max)}</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-500">最低阅读</div>
                <div className="text-lg font-bold text-orange-600">{formatNumber(currentReport.read_distribution.min)}</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-500">文章总数</div>
                <div className="text-lg font-bold text-gray-700">{currentReport.article_count}</div>
              </div>
            </div>
            <div className="space-y-2">
              {currentReport.read_distribution.ranges?.map((range, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-20 text-xs text-gray-600 shrink-0">{range.label}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, range.percentage)}%` }}
                    />
                  </div>
                  <div className="w-16 text-xs text-gray-500 text-right">
                    {range.count}篇 ({range.percentage.toFixed(1)}%)
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 发布时间分布 */}
      {currentReport.time_distribution && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><Clock className="w-4 h-4" /> 发布时间分布</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 按小时分布 */}
            {currentReport.time_distribution.byHour && currentReport.time_distribution.byHour.length > 0 && (
              <div className="bg-white rounded border p-4">
                <h4 className="text-xs font-medium text-gray-600 mb-3">按时段分布</h4>
                <div className="flex items-end gap-1 h-24">
                  {currentReport.time_distribution.byHour.map((item, idx) => {
                    const maxCount = Math.max(...currentReport.time_distribution!.byHour.map(i => i.count));
                    const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    return (
                      <div
                        key={idx}
                        className="flex-1 bg-primary/30 hover:bg-primary/50 rounded-t transition-colors group relative"
                        style={{ height: `${Math.max(4, height)}%` }}
                        title={`${item.hour}:00 - ${item.count}篇`}
                      >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {item.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0时</span>
                  <span>6时</span>
                  <span>12时</span>
                  <span>18时</span>
                  <span>24时</span>
                </div>
              </div>
            )}

            {/* 按星期分布 */}
            {currentReport.time_distribution.byDayOfWeek && currentReport.time_distribution.byDayOfWeek.length > 0 && (
              <div className="bg-white rounded border p-4">
                <h4 className="text-xs font-medium text-gray-600 mb-3">按星期分布</h4>
                <div className="space-y-2">
                  {currentReport.time_distribution.byDayOfWeek.map((item, idx) => {
                    const maxCount = Math.max(...currentReport.time_distribution!.byDayOfWeek.map(i => i.count));
                    const width = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-10 text-xs text-gray-600">{item.day}</div>
                        <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-primary/50 to-primary h-full rounded transition-all flex items-center justify-end pr-2"
                            style={{ width: `${Math.max(20, width)}%` }}
                          >
                            <span className="text-xs text-white font-medium">{item.count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 选题洞察 */}
      {currentReport.insights && currentReport.insights.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><Lightbulb className="w-4 h-4" /> 选题洞察</h3>
          <InsightCategories insights={currentReport.insights} />
        </div>
      )}
      {(!currentReport.insights || currentReport.insights.length === 0) && (
        <div className="text-sm text-gray-400 p-4 bg-white rounded border text-center">
          暂无洞察，请在列表中点击"生成AI洞察"按钮
        </div>
      )}
    </div>
  );
}
