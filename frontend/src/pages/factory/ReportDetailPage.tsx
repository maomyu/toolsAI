/**
 * [INPUT]: 依赖 React、react-router-dom、zustand
 * [OUTPUT]: 对外提供分析报告详情页面组件
 * [POS]: pages/factory 页面层，展示选题分析报告详情
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFactoryStore } from '../../store/factoryStore';
import { Cloud, PenTool, Download, Flame, MessageCircle, Lightbulb, ClipboardList } from 'lucide-react';

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentReport, isLoading, fetchAnalysisById, createArticle } = useFactoryStore();

  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (id) {
      fetchAnalysisById(id);
    }
  }, [id, fetchAnalysisById]);

  const handleCreateArticle = async () => {
    if (!currentReport) return;

    setIsCreating(true);
    try {
      // 获取第一个洞察的主题或使用关键词
      const firstInsight = currentReport.insights[0];
      const theme = typeof firstInsight === 'string' ? firstInsight : (firstInsight?.title || currentReport.keyword);

      await createArticle({
        report_id: currentReport.id,
        theme,
        style: '轻松幽默',
        length: 'medium',
        image_count: 3,
      });
      navigate(`/factory/publish`);
    } catch (e) {
      // 错误已在 store 中处理
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!currentReport) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">报告不存在</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 返回按钮和标题 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/factory/analysis')}
          className="text-gray-500 hover:text-gray-700"
        >
          ← 返回
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">分析报告: {currentReport.keyword}</h1>
          <p className="text-sm text-gray-500">
            {new Date(currentReport.created_at).toLocaleString('zh-CN')}
          </p>
        </div>
      </div>

      {/* 排行榜 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 点赞TOP5 */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2"><Flame className="w-5 h-5 text-orange-500" /> 点赞TOP5</h2>
          <div className="space-y-3">
            {currentReport.top_liked.map((article, index) => (
              <div key={article.id} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{article.title}</p>
                  <p className="text-xs text-gray-500">{article.like_count.toLocaleString()} 赞</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 互动率TOP5 */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-blue-500" /> 互动率TOP5</h2>
          <div className="space-y-3">
            {currentReport.top_engagement.map((article, index) => (
              <div key={article.id} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{article.title}</p>
                  <p className="text-xs text-gray-500">
                    {(article.engagement_rate * 100).toFixed(1)}% 互动率
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 词云 */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2"><Cloud className="w-5 h-5 text-gray-500" /> 高频词云</h2>
        <div className="flex flex-wrap gap-2">
          {currentReport.word_cloud.slice(0, 30).map((item, index) => {
            const size = Math.max(12, Math.min(24, 12 + item.count / 5));
            return (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 rounded text-gray-700"
                style={{ fontSize: `${size}px` }}
              >
                {item.word}
              </span>
            );
          })}
        </div>
      </div>

      {/* 选题洞察 */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-amber-500" /> 选题洞察</h2>
        <div className="space-y-3">
          {currentReport.insights.map((insight, index) => {
            // 兼容旧数据：字符串格式
            if (typeof insight === 'string') {
              return (
                <div key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <p className="text-gray-700">{insight}</p>
                </div>
              );
            }
            // 结构化洞察
            return (
              <div key={index} className="p-3 rounded border bg-gray-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{insight.category}</span>
                  <span className="font-medium text-gray-800">{insight.title}</span>
                </div>
                <p className="text-sm text-gray-600">{insight.description}</p>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={handleCreateArticle}
            disabled={isCreating}
            className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {isCreating ? '创作中...' : <><PenTool className="w-4 h-4 inline mr-1" /> 基于此洞察创作文章</>}
          </button>
          <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
            <Download className="w-4 h-4 inline mr-1" /> 导出报告
          </button>
        </div>
      </div>

      {/* 素材文章列表 */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-gray-500" />
            素材文章 ({currentReport.articles?.length || 0}篇)
          </h2>
        </div>
        <div className="divide-y divide-gray-200 max-h-96 overflow-auto">
          {(currentReport.articles || []).slice(0, 20).map((article) => (
            <div key={article.id} className="p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm text-gray-800 truncate">{article.title}</p>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    <span>阅读 {article.read_count.toLocaleString()}</span>
                    <span>点赞 {article.like_count.toLocaleString()}</span>
                    <span>互动率 {(article.engagement_rate * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <button className="text-sm text-primary hover:underline">查看概要</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
