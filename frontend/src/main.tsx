/**
 * [INPUT]: 依赖 React、App 组件
 * [OUTPUT]: 对外提供 React 应用入口
 * [POS]: 应用根入口，挂载到 DOM
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
