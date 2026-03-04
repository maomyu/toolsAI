/**
 * [INPUT]: 依赖 React、zustand
 * [OUTPUT]: 对外提供账号管理页面组件
 * [POS]: pages/factory 页面层，展示账号管理功能
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState, useEffect } from 'react';
import { useFactoryStore } from '../../store/factoryStore';
import { MessageCircle } from 'lucide-react';

export function AccountsPage() {
  const {
    wechatAccounts,
    xiaohongshuAccounts,
    fetchWechatAccounts,
    fetchXiaohongshuAccounts,
    createWechatAccount,
    deleteWechatAccount,
    createXiaohongshuAccount,
    deleteXiaohongshuAccount,
  } = useFactoryStore();

  const [wechatModal, setWechatModal] = useState(false);
  const [xiaohongshuModal, setXiaohongshuModal] = useState(false);

  const [wechatForm, setWechatForm] = useState({ name: '', app_id: '', app_secret: '' });
  const [xhsForm, setXhsForm] = useState({ name: '', cookie: '' });

  useEffect(() => {
    fetchWechatAccounts();
    fetchXiaohongshuAccounts();
  }, [fetchWechatAccounts, fetchXiaohongshuAccounts]);

  const handleCreateWechat = async () => {
    if (!wechatForm.name || !wechatForm.app_id || !wechatForm.app_secret) {
      alert('请填写完整信息');
      return;
    }
    try {
      await createWechatAccount(wechatForm);
      setWechatModal(false);
      setWechatForm({ name: '', app_id: '', app_secret: '' });
    } catch (e) {
      // 错误已在 store 中处理
    }
  };

  const handleCreateXhs = async () => {
    if (!xhsForm.name || !xhsForm.cookie) {
      alert('请填写完整信息');
      return;
    }
    try {
      await createXiaohongshuAccount(xhsForm);
      setXiaohongshuModal(false);
      setXhsForm({ name: '', cookie: '' });
    } catch (e) {
      // 错误已在 store 中处理
    }
  };

  const handleDeleteWechat = async (id: string) => {
    if (confirm('确定要删除这个公众号账号吗？')) {
      await deleteWechatAccount(id);
    }
  };

  const handleDeleteXhs = async (id: string) => {
    if (confirm('确定要删除这个小红书账号吗？')) {
      await deleteXiaohongshuAccount(id);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      pending: '待授权',
      active: '已授权',
      expired: '已过期',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">账号管理</h1>
        <p className="text-gray-500 mt-1">管理公众号和小红书账号</p>
      </div>

      {/* 公众号账号 */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            公众号账号
          </h2>
          <button
            onClick={() => setWechatModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            + 添加账号
          </button>
        </div>

        {wechatAccounts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暂无公众号账号</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {wechatAccounts.map((account) => (
              <div key={account.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-800">{account.name}</span>
                    {getStatusBadge(account.status)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">AppID: {account.app_id}</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 text-sm text-primary hover:bg-primary/10 rounded">
                    测试
                  </button>
                  <button
                    onClick={() => handleDeleteWechat(account.id)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 小红书账号 */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-red-500 flex-shrink-0" />
            小红书账号
          </h2>
          <button
            onClick={() => setXiaohongshuModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            + 添加账号
          </button>
        </div>

        {xiaohongshuAccounts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暂无小红书账号</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {xiaohongshuAccounts.map((account) => (
              <div key={account.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-800">{account.name}</span>
                    {getStatusBadge(account.status)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Cookie: {account.cookie.slice(0, 20)}...
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 text-sm text-primary hover:bg-primary/10 rounded">
                    测试
                  </button>
                  <button
                    onClick={() => handleDeleteXhs(account.id)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 公众号添加弹窗 */}
      {wechatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium text-gray-800 mb-4">添加公众号账号</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">账号名称</label>
                <input
                  type="text"
                  value={wechatForm.name}
                  onChange={(e) => setWechatForm({ ...wechatForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="如：科技前沿观察"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">AppID</label>
                <input
                  type="text"
                  value={wechatForm.app_id}
                  onChange={(e) => setWechatForm({ ...wechatForm, app_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="wx..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">AppSecret</label>
                <input
                  type="password"
                  value={wechatForm.app_secret}
                  onChange={(e) => setWechatForm({ ...wechatForm, app_secret: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="请输入 AppSecret"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setWechatModal(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateWechat}
                  className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 小红书添加弹窗 */}
      {xiaohongshuModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium text-gray-800 mb-4">添加小红书账号</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">账号名称</label>
                <input
                  type="text"
                  value={xhsForm.name}
                  onChange={(e) => setXhsForm({ ...xhsForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="如：效率工具推荐"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cookie</label>
                <textarea
                  value={xhsForm.cookie}
                  onChange={(e) => setXhsForm({ ...xhsForm, cookie: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg h-24"
                  placeholder="请从浏览器中复制小红书的 Cookie"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setXiaohongshuModal(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateXhs}
                  className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
