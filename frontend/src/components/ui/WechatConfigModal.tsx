/**
 * [INPUT]: 依赖 React 和 useRecreateStore
 * [OUTPUT]: 对外提供 WechatConfigModal 组件
 * [POS]: components UI组件，配置公众号信息
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRecreateStore } from '../../store/recreateStore';

export function WechatConfigModal() {
  const {
    showConfigModal,
    setShowConfigModal,
    wechatConfig,
    setWechatConfig,
  } = useRecreateStore();

  const [appid, setAppid] = useState('');
  const [secret, setSecret] = useState('');

  // 每次打开模态框时，从 store 读取最新配置
  useEffect(() => {
    if (showConfigModal) {
      setAppid(wechatConfig.appid);
      setSecret(wechatConfig.secret);
    }
  }, [showConfigModal, wechatConfig]);

  const handleSave = () => {
    // 保存配置
    setWechatConfig({ appid: appid.trim(), secret: secret.trim() });

    // 保存到localStorage
    localStorage.setItem('wechat_appid', appid.trim());
    localStorage.setItem('wechat_secret', secret.trim());

    // 关闭模态框
    setShowConfigModal(false);
  };

  const handleCancel = () => {
    // 恢复原来的值
    setAppid(wechatConfig.appid);
    setSecret(wechatConfig.secret);
    setShowConfigModal(false);
  };

  return (
    <AnimatePresence>
      {showConfigModal && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfigModal(false)}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            {/* 模态框内容 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-light rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
            >
              {/* 标题 */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-dark mb-2">
                  配置公众号信息
                </h2>
                <p className="text-sm text-mid-gray">
                  配置公众号AppID和Secret后，可直接保存文章到草稿箱
                </p>
              </div>

              {/* 表单 */}
              <div className="space-y-4 pt-2">
                {/* AppID */}
                <div>
                  <label className="block text-sm font-medium text-dark mb-2">
                    AppID
                  </label>
                  <input
                    type="text"
                    value={appid}
                    onChange={(e) => setAppid(e.target.value)}
                    placeholder="wx1234567890abcdef"
                    className="w-full px-4 py-3 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                  />
                  <p className="text-xs text-mid-gray mt-1">
                    在微信公众平台 &gt; 开发 &gt; 基本配置中获取
                  </p>
                </div>

                {/* Secret */}
                <div>
                  <label className="block text-sm font-medium text-dark mb-2">
                    AppSecret
                  </label>
                  <input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="您的AppSecret"
                    className="w-full px-4 py-3 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                  />
                  <p className="text-xs text-mid-gray mt-1">
                    仅在微信公众平台显示一次，请妥善保管
                  </p>
                </div>

                {/* 警告提示 */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <svg
                      className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="text-xs text-yellow-800">
                      <p className="font-medium mb-1">安全提示</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>配置信息仅保存在本地浏览器中</li>
                        <li>不会上传到任何服务器</li>
                        <li>请勿在公共电脑上保存</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 按钮 */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2.5 bg-light-gray text-dark rounded-lg hover:bg-mid-gray/30 transition-smooth font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={!appid.trim() || !secret.trim()}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-smooth ${
                    appid.trim() && secret.trim()
                      ? 'bg-primary text-white hover:bg-primary-hover'
                      : 'bg-light-gray text-mid-gray cursor-not-allowed'
                  }`}
                >
                  保存配置
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
