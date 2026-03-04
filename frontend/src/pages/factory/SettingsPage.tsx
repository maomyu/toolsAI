/**
 * [INPUT]: 依赖 React、factoryApi
 * [OUTPUT]: 对外提供设置页面组件
 * [POS]: pages/factory 页面层，展示 API Key 配置
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../../services/factoryApi';
import { KeyRound, Bot, Eye, EyeOff } from 'lucide-react';

export function SettingsPage() {
  const [qwenApiKey, setQwenApiKey] = useState('');
  const [jizhiApiKey, setJizhiApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showQwenKey, setShowQwenKey] = useState(false);
  const [showJizhiKey, setShowJizhiKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await getSettings();
      setQwenApiKey(settings.qwen_api_key || '');
      setJizhiApiKey(settings.jizhi_api_key || '');
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      await updateSettings({
        qwen_api_key: qwenApiKey,
        jizhi_api_key: jizhiApiKey,
      });
      setMessage({ type: 'success', text: '设置已保存' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">系统设置</h1>
        <p className="text-gray-500 mt-1">配置 API Key 以启用各项功能</p>
      </div>

      {/* 千问 API Key */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-800">通义千问 API Key</h2>
            <p className="text-sm text-gray-500">用于 AI 内容生成和选题分析</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <div className="relative">
            <input
              type={showQwenKey ? 'text' : 'password'}
              value={qwenApiKey}
              onChange={(e) => setQwenApiKey(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxx"
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="button"
              onClick={() => setShowQwenKey(!showQwenKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showQwenKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            获取地址：{' '}
            <a
              href="https://bailian.console.aliyun.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              阿里云百炼控制台
            </a>
          </p>
        </div>
      </div>

      {/* 极致数据 API Key */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-800">极致数据 API Key</h2>
            <p className="text-sm text-gray-500">用于获取公众号文章数据</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <div className="relative">
            <input
              type={showJizhiKey ? 'text' : 'password'}
              value={jizhiApiKey}
              onChange={(e) => setJizhiApiKey(e.target.value)}
              placeholder="请输入极致数据 API Key"
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="button"
              onClick={() => setShowJizhiKey(!showJizhiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showJizhiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            用于获取公众号文章数据（标题、阅读量、点赞数等）
          </p>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? '保存中...' : '保存设置'}
        </button>

        {message && (
          <span
            className={`text-sm ${
              message.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {message.text}
          </span>
        )}
      </div>

      {/* 说明 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-yellow-800 mb-2">注意事项</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• API Key 保存在本地数据库，不会上传到外部服务器</li>
          <li>• 请勿将含有 API Key 的数据库文件分享给他人</li>
        </ul>
      </div>
    </div>
  );
}
