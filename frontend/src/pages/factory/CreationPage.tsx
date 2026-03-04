/**
 * [INPUT]: 依赖 React、zustand、factoryApi、ResultPreview
 * [OUTPUT]: 对外提供内容创作页面组件
 * [POS]: pages/factory 页面层，展示内容创作功能
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState, useEffect } from 'react';
import { useFactoryStore } from '../../store/factoryStore';
import { useRecreateStore } from '../../store/recreateStore';
import { ResultPreview } from '../../components/ui/ResultPreview';
import { WechatConfigModal } from '../../components/ui/WechatConfigModal';
import { Eye, Heart } from 'lucide-react';
import type { TopicInsight, SourceArticle } from '../../services/factoryApi';

export function CreationPage() {
  const {
    analysisList,
    currentReport,
    isCreating,
    error,
    fetchArticleList,
    fetchAnalysisList,
    fetchAnalysisById,
    setError,
  } = useFactoryStore();

  // 复刻 store（用于 ResultPreview）
  const {
    result: recreateResult,
    setResult: setRecreateResult,
    reset: resetRecreate,
    setImageOption: setRecreateImageOption,
    setEditedTitle,
  } = useRecreateStore();

  // 报告选择
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  // 输入方式：选择文章 或 粘贴文本
  const [inputMethod, setInputMethod] = useState<'select' | 'paste'>('paste');
  // 源文章
  const [selectedArticleUrl, setSelectedArticleUrl] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<SourceArticle | null>(null);
  // 粘贴的文本内容
  const [contentText, setContentText] = useState('');
  // 创作参数
  const [styleUrl, setStyleUrl] = useState('');
  // 配图模式
  const [imageMode, setImageMode] = useState<'none' | 'ai'>('ai');
  // AI配图数量 1-5
  const [aiImageCount, setAiImageCount] = useState(3);
  // 改写自由度 1-10
  const [creativityLevel, setCreativityLevel] = useState(7);
  // 处理状态
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteProgress, setRewriteProgress] = useState('');

  // 加载数据
  useEffect(() => {
    fetchArticleList();
    fetchAnalysisList();
  }, [fetchArticleList, fetchAnalysisList]);

  // 选择报告后加载详情
  useEffect(() => {
    if (selectedReportId) {
      fetchAnalysisById(selectedReportId);
    }
  }, [selectedReportId, fetchAnalysisById]);

  // 获取可用的文章列表（合并 top_liked 和 top_engagement，去重）
  const availableArticles: SourceArticle[] = currentReport
    ? [...new Map(
        [...(currentReport.top_liked || []), ...(currentReport.top_engagement || [])].map(a => [a.url, a])
      ).values()]
    : [];

  // 按时间倒序排列的分析报告
  const sortedAnalysisList = [...analysisList].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // 选择文章
  const handleArticleSelect = (url: string) => {
    setSelectedArticleUrl(url);
    const article = availableArticles.find(a => a.url === url);
    setSelectedArticle(article || null);
  };

  // 开始创作
  const handleCreate = async () => {
    // 验证输入
    if (inputMethod === 'select' && !selectedArticleUrl) {
      setError('请选择要改写的文章');
      return;
    }
    if (inputMethod === 'paste' && !contentText.trim()) {
      setError('请粘贴要改写的文章内容');
      return;
    }

    setIsRewriting(true);
    setRewriteProgress('正在连接服务器...');

    // 重置之前的结果
    resetRecreate();

    // 设置配图模式（ResultPreview 需要这个状态）
    setRecreateImageOption(imageMode);

    // 临时保存标题和HTML
    let currentTitle = '';
    let currentHtml = '';
    let currentImages: string[] = [];

    try {
      // 使用流式接口（SSE）获取实时进度
      const { recreateArticleStream } = await import('../../services/api');

      // 根据输入方式构建请求参数
      const requestParams = {
        contentUrl: inputMethod === 'select' ? selectedArticleUrl : undefined,
        contentText: inputMethod === 'paste' ? contentText.trim() : undefined,
        styleUrl: styleUrl || undefined,
        imageOption: imageMode,
        aiImageCount: imageMode === 'ai' ? aiImageCount : 0,
        creativityLevel: creativityLevel,
        options: {
          type: 'refactor' as const,
          style: 'casual' as const,
        },
      };

      await recreateArticleStream(requestParams,
        {
          // 标题生成完成
          onTitle: (title) => {
            currentTitle = title; // 保存标题
            setEditedTitle(title); // 同步到 store
            setRewriteProgress(`标题生成完成: ${title.slice(0, 20)}...`);
          },
          // 内容二创完成
          onContent: (html, images, imageLoading) => {
            currentHtml = html; // 保存 HTML
            currentImages = images || []; // 保存图片
            if (imageLoading) {
              setRewriteProgress('内容创作完成，正在生成配图...');
            } else {
              setRewriteProgress('内容创作完成！');
            }
          },
          // 单张图片生成完成
          onImage: (index, _url, _percent, _theme) => {
            setRewriteProgress(`配图 ${index + 1}/${aiImageCount} 生成完成`);
          },
          // 全部完成
          onDone: (result) => {
            setRewriteProgress(`改写完成！耗时 ${Math.round((result.processingTime || 0) / 1000)} 秒`);

            // 将结果同步到 recreateStore，让 ResultPreview 可以显示
            // 注意：result.html 是最终带图片的HTML，currentHtml 是占位符HTML
            const finalHtml = (result as any).html || currentHtml;
            const finalImages = result.images || currentImages;

            if (finalHtml) {
              setRecreateResult({
                html: finalHtml, // 使用最终带图片的 HTML
                title: currentTitle, // 使用保存的标题
                summary: `改写完成，耗时 ${Math.round((result.processingTime || 0) / 1000)} 秒`,
                images: finalImages, // 图片数组
                meta: {
                  processingTime: result.processingTime || 0,
                  tokensUsed: 0,
                },
              });
            }

            // 刷新文章列表
            fetchArticleList();

            // 2秒后清除进度消息
            setTimeout(() => {
              setRewriteProgress('');
              setIsRewriting(false);
            }, 2000);
          },
          // 错误处理
          onError: (code, message) => {
            setError(`${code}: ${message}`);
            setIsRewriting(false);
          },
        }
      );
    } catch (e: any) {
      setError(e.message || '改写失败');
      setIsRewriting(false);
    }
  };

  const isDisabled = isCreating || isRewriting;

  return (
    <div className="flex gap-6">
      {/* 左侧：输入区域 */}
      <div className="w-[420px] min-w-[380px] flex-shrink-0 p-5 border border-gray-200 rounded-lg bg-white shadow-sm">
        <div className="space-y-5">
          {/* 页面标题 */}
          <div>
            <h1 className="text-xl font-bold text-gray-800">内容创作</h1>
            <p className="text-gray-500 text-sm mt-1">改写文章，生成原创内容</p>
          </div>

          {/* 输入方式选择 */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">内容来源</label>
            <div className="flex gap-2">
              <button
                onClick={() => setInputMethod('paste')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm border ${
                  inputMethod === 'paste'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
                disabled={isDisabled}
              >
                粘贴文本
              </button>
              <button
                onClick={() => setInputMethod('select')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm border ${
                  inputMethod === 'select'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
                disabled={isDisabled}
              >
                选择文章
              </button>
            </div>
          </div>

          {/* 粘贴文本模式 */}
          {inputMethod === 'paste' && (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">文章内容</label>
              <textarea
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                placeholder="粘贴您要改写的文章内容..."
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                disabled={isDisabled}
              />
              <p className="text-xs text-gray-400 mt-1">
                字符数: {contentText.length.toLocaleString()}
              </p>
            </div>
          )}

          {/* 选择文章模式 */}
          {inputMethod === 'select' && (
            <>
              {/* 选择分析报告 */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">选择分析报告</label>
                <select
                  value={selectedReportId}
                  onChange={(e) => setSelectedReportId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  disabled={isDisabled}
                >
                  <option value="">-- 请选择 --</option>
                  {sortedAnalysisList
                    .filter(r => r.status === 'completed')
                    .map((report) => (
                      <option key={report.id} value={report.id}>
                        {report.keyword} ({report.article_count}篇)
                      </option>
                    ))}
                </select>

                {/* 洞察预览 */}
                {currentReport && selectedReportId && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
                    <div className="text-xs font-medium text-gray-500 mb-1">洞察预览</div>
                    {currentReport.insights && currentReport.insights.length > 0 ? (
                      <div className="space-y-1">
                        {currentReport.insights.slice(0, 3).map((insight: TopicInsight, idx: number) => (
                          <div key={idx} className="text-xs text-gray-600">
                            <span className="text-primary font-medium">{insight.category}</span>: {insight.title}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">暂无洞察</div>
                    )}
                  </div>
                )}
              </div>

              {/* 选择源文章 */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">选择源文章</label>
                {availableArticles.length > 0 ? (
                  <>
                    <select
                      value={selectedArticleUrl}
                      onChange={(e) => handleArticleSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                      disabled={isDisabled}
                    >
                      <option value="">-- 请选择 --</option>
                      {availableArticles.map((article, idx) => (
                        <option key={article.id || idx} value={article.url}>
                          TOP{idx + 1} - {article.title.slice(0, 25)}...
                        </option>
                      ))}
                    </select>
                    {selectedArticle && (
                      <div className="mt-2 text-xs text-gray-500 flex gap-4">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {selectedArticle.read_count.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5" />
                          {selectedArticle.like_count}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-gray-400 py-2">
                    {selectedReportId ? '该报告暂无文章' : '请先选择分析报告'}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 创作设置 */}
          <div className="bg-white rounded-lg p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-medium text-gray-700">创作设置</h3>

            {/* 改写自由度 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">改写自由度</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={creativityLevel}
                  onChange={(e) => setCreativityLevel(Number(e.target.value))}
                  disabled={isDisabled}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-sm font-medium w-6 text-center">{creativityLevel}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>高度改写</span>
                <span>几乎不变</span>
              </div>
            </div>

            {/* 样式参考链接 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">样式参考链接（可选）</label>
              <input
                type="text"
                value={styleUrl}
                onChange={(e) => setStyleUrl(e.target.value)}
                placeholder="公众号文章链接"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={isDisabled}
              />
            </div>

            {/* 配图模式 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">配图模式</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setImageMode('none')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm border ${
                    imageMode === 'none'
                      ? 'bg-gray-100 text-gray-800 border-gray-400'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                  disabled={isDisabled}
                >
                  无配图
                </button>
                <button
                  onClick={() => setImageMode('ai')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm border ${
                    imageMode === 'ai'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                  disabled={isDisabled}
                >
                  AI配图
                </button>
              </div>
            </div>

            {/* AI配图数量选择 */}
            {imageMode === 'ai' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">配图数量</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      onClick={() => setAiImageCount(num)}
                      className={`flex-1 py-2 px-2 rounded-lg text-sm border ${
                        aiImageCount === num
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                      disabled={isDisabled}
                    >
                      {num}张
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 进度显示 */}
          {(isRewriting || rewriteProgress) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                {isRewriting && (
                  <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span className="text-sm text-blue-700">{rewriteProgress}</span>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
            </div>
          )}

          {/* 开始按钮 */}
          <button
            onClick={handleCreate}
            disabled={isDisabled || (inputMethod === 'select' && !selectedArticleUrl) || (inputMethod === 'paste' && !contentText.trim())}
            className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRewriting ? '改写中...' : '开始改写'}
          </button>
        </div>
      </div>

      {/* 右侧：结果展示区 */}
      <div className="flex-1 min-w-0 bg-gray-50 rounded-lg border border-gray-200 p-5 shadow-sm">
        {recreateResult ? (
          <ResultPreview />
        ) : (
          <div className="min-h-[400px] flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>选择文章并点击"开始改写"</p>
              <p className="text-sm mt-1">改写结果将在这里显示</p>
            </div>
          </div>
        )}
      </div>

      {/* 公众号配置模态框 */}
      <WechatConfigModal />
    </div>
  );
}
