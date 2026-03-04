/**
 * [INPUT]: 依赖 React Router、zustand、lucide-react
 * [OUTPUT]: 对外提供内容工厂布局组件
 * [POS]: components/factory 组件层，定义内容工厂的左右布局
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useFactoryStore } from '../../store/factoryStore';
import {
  BarChart3,
  PenTool,
  Send,
  Users,
  TrendingUp,
  Settings,
  ChevronLeft,
  Layers
} from 'lucide-react';

interface FactoryLayoutProps {
  children: ReactNode;
}

const menuItems = [
  { key: 'analysis', label: '选题分析', icon: BarChart3, path: '/factory/analysis' },
  { key: 'creation', label: '内容创作', icon: PenTool, path: '/factory/creation' },
  // { key: 'publish', label: '发布管理', icon: Send, path: '/factory/publish' },
  // { key: 'accounts', label: '账号管理', icon: Users, path: '/factory/accounts' },
  // { key: 'stats', label: '数据统计', icon: TrendingUp, path: '/factory/stats' },
  { key: 'settings', label: '系统设置', icon: Settings, path: '/factory/settings' },
];

export function FactoryLayout({ children }: FactoryLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveMenu } = useFactoryStore();

  useEffect(() => {
    const currentMenu = menuItems.find((item) => location.pathname.startsWith(item.path));
    if (currentMenu) {
      setActiveMenu(currentMenu.key);
    }
  }, [location.pathname, setActiveMenu]);

  const handleMenuClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
      {/* 侧边栏 - 苹果风格 */}
      <aside className="w-60 bg-white/80 backdrop-blur-xl border-r border-gray-200/50 flex flex-col flex-shrink-0">
        {/* Logo 区域 */}
        <div className="p-6 border-b border-gray-100">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25 group-hover:shadow-orange-500/40 transition-shadow">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 tracking-tight">内容工厂</h1>
              <p className="text-xs text-gray-400">AI 驱动的创作平台</p>
            </div>
          </Link>
        </div>

        {/* 导航菜单 - 苹果风格 */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <button
                key={item.key}
                onClick={() => handleMenuClick(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all duration-200 ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 底部区域 */}
        <div className="p-4 border-t border-gray-100">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 text-center">
            <div className="w-16 h-16 bg-white rounded-xl mx-auto mb-3 flex items-center justify-center shadow-sm">
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
            </div>
            <p className="text-xs text-gray-500 font-medium">扫码关注公众号</p>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部栏 - 苹果风格 */}
        <header className="h-14 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 flex items-center px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </Link>
            <span className="text-sm text-gray-400">/</span>
            <span className="text-sm text-gray-600 font-medium">AI 工具集</span>
          </div>
        </header>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
