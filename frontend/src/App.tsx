/**
 * [INPUT]: 依赖 React Router 和页面组件
 * [OUTPUT]: 对外提供 App 根组件
 * [POS]: 应用入口，导出给main.tsx
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WechatRecreatePage } from './pages/WechatRecreatePage';
import { FactoryLayout } from './components/factory/FactoryLayout';
import { AnalysisPage } from './pages/factory/AnalysisPage';
import { ReportDetailPage } from './pages/factory/ReportDetailPage';
import { CreationPage } from './pages/factory/CreationPage';
import { PublishPage } from './pages/factory/PublishPage';
import { AccountsPage } from './pages/factory/AccountsPage';
import { StatsPage } from './pages/factory/StatsPage';
import { SettingsPage } from './pages/factory/SettingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 根路径重定向到内容工厂 */}
        <Route path="/" element={<Navigate to="/factory/analysis" replace />} />

        {/* 复刻工具页面 */}
        <Route path="/tools/wechat" element={<WechatRecreatePage />} />

        {/* 内容工厂 - 主界面 */}
        <Route path="/factory/*" element={<FactoryLayout><Routes>
          <Route index element={<Navigate to="analysis" replace />} />
          <Route path="analysis" element={<AnalysisPage />} />
          <Route path="analysis/:id" element={<ReportDetailPage />} />
          <Route path="creation" element={<CreationPage />} />
          <Route path="publish" element={<PublishPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Routes></FactoryLayout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
