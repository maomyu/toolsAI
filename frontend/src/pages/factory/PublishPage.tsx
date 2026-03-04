/**
 * [INPUT]: 依赖 React、zustand
 * [OUTPUT]: 对外提供发布管理页面组件
 * [POS]: pages/factory 页面层，展示发布管理功能
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState, useEffect } from 'react';
import { useFactoryStore } from '../../store/factoryStore';

export function PublishPage() {
  const {
    articleList,
    articleCounts,
    wechatAccounts,
    xiaohongshuAccounts,
    fetchArticleList,
    fetchWechatAccounts,
    fetchXiaohongshuAccounts,
    publishToWechat,
    publishToXiaohongshu,
    deleteArticle,
  } = useFactoryStore();

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [publishModal, setPublishModal] = useState<{
    open: boolean;
    articleId: string;
    platform: 'wechat' | 'xiaohongshu';
  } | null>(null);

  useEffect(() => {
    fetchArticleList(statusFilter || undefined);
    fetchWechatAccounts();
    fetchXiaohongshuAccounts();
  }, [statusFilter, fetchArticleList, fetchWechatAccounts, fetchXiaohongshuAccounts]);

  const handlePublish = async (accountId: string, mode: 'draft' | 'publish') => {
    if (!publishModal) return;

    try {
      if (publishModal.platform === 'wechat') {
        await publishToWechat(publishModal.articleId, accountId, mode);
      } else {
        await publishToXiaohongshu(publishModal.articleId, accountId);
      }
      setPublishModal(null);
    } catch (e) {
      // 错误已在 store 中处理
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这篇文章吗？')) {
      await deleteArticle(id);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      none: 'bg-gray-100 text-gray-600',
      draft: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-blue-100 text-blue-800',
      published: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      none: '-',
      draft: '草稿',
      pending: '待发布',
      published: '已发布',
      failed: '失败',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const tabs = [
    { key: '', label: `全部`, count: Object.values(articleCounts).reduce((a, b) => a + b, 0) },
    { key: 'draft', label: `草稿`, count: articleCounts.draft },
    { key: 'pending', label: `待发布`, count: articleCounts.pending },
    { key: 'published', label: `已发布`, count: articleCounts.published },
  ];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">发布管理</h1>
        <p className="text-gray-500 mt-1">管理文章发布到各平台</p>
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === tab.key
                ? 'bg-primary text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* 文章列表 */}
      <div className="bg-white rounded-lg shadow-sm">
        {articleList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暂无文章</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {articleList.map((article) => (
              <div key={article.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="font-medium text-gray-800 truncate">{article.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      创建时间: {new Date(article.created_at).toLocaleString('zh-CN')}
                    </p>

                    {/* 平台发布状态 */}
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">公众号:</span>
                        {getStatusBadge(article.wechat_status)}
                        {article.wechat_read_count !== undefined && (
                          <span className="text-xs text-gray-500">
                            阅读 {article.wechat_read_count}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">小红书:</span>
                        {getStatusBadge(article.xiaohongshu_status)}
                        {article.xiaohongshu_read_count !== undefined && (
                          <span className="text-xs text-gray-500">
                            阅读 {article.xiaohongshu_read_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setPublishModal({ open: true, articleId: article.id, platform: 'wechat' })
                      }
                      className="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded border border-green-200"
                    >
                      发布公众号
                    </button>
                    <button
                      onClick={() =>
                        setPublishModal({ open: true, articleId: article.id, platform: 'xiaohongshu' })
                      }
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded border border-red-200"
                    >
                      发布小红书
                    </button>
                    <button
                      onClick={() => handleDelete(article.id)}
                      className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
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

      {/* 发布弹窗 */}
      {publishModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium text-gray-800 mb-4">
              发布到{publishModal.platform === 'wechat' ? '公众号' : '小红书'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择账号</label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  id="account-select"
                >
                  {publishModal.platform === 'wechat' ? (
                    wechatAccounts.length === 0 ? (
                      <option value="">暂无公众号账号</option>
                    ) : (
                      wechatAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))
                    )
                  ) : xiaohongshuAccounts.length === 0 ? (
                    <option value="">暂无小红书账号</option>
                  ) : (
                    xiaohongshuAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setPublishModal(null)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                {publishModal.platform === 'wechat' && (
                  <button
                    onClick={() => {
                      const select = document.getElementById('account-select') as HTMLSelectElement;
                      handlePublish(select.value, 'draft');
                    }}
                    className="flex-1 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                  >
                    存为草稿
                  </button>
                )}
                <button
                  onClick={() => {
                    const select = document.getElementById('account-select') as HTMLSelectElement;
                    handlePublish(select.value, 'publish');
                  }}
                  className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  发布
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
