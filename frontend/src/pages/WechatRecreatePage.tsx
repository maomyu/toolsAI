/**
 * [INPUT]: 依赖 React、React Router、UI组件
 * [OUTPUT]: 对外提供 WechatRecreatePage 页面组件
 * [POS]: pages页面组件，被App.tsx路由使用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Link } from 'react-router-dom';
import { InputForm } from '../components/ui/InputForm';
import { ProgressIndicator } from '../components/ui/ProgressIndicator';
import { ResultPreview } from '../components/ui/ResultPreview';
import { WechatConfigModal } from '../components/ui/WechatConfigModal';

export function WechatRecreatePage() {
  return (
    <div className="min-h-screen bg-light">
      <div className="container h-screen flex flex-col">
        {/* 顶部导航 */}
        <div className="flex items-center py-4 px-6 border-b border-light-gray">
          <Link
            to="/"
            className="flex items-center gap-2 text-dark hover:text-primary transition-smooth"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">AI内容助手</span>
          </Link>
        </div>

        {/* 主要内容 - 左右布局 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧：操作区 - 透明细滚动条 */}
          <style>{`
            .thin-scrollbar::-webkit-scrollbar {
              width: 4px;
            }
            .thin-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .thin-scrollbar::-webkit-scrollbar-thumb {
              background: rgba(0, 0, 0, 0.1);
              border-radius: 2px;
            }
            .thin-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(0, 0, 0, 0.2);
            }
          `}</style>
          <div className="w-1/2 max-w-xl overflow-y-auto p-6 border-r border-light-gray thin-scrollbar">
            <InputForm />
            <ProgressIndicator />
          </div>

          {/* 右侧：结果展示区 */}
          <div className="flex-1 overflow-y-auto p-6 bg-light">
            <ResultPreview />
          </div>
        </div>
      </div>

      {/* 公众号配置模态框 */}
      <WechatConfigModal />
    </div>
  );
}
