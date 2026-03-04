/**
 * [INPUT]: 依赖 express、factoryController
 * [OUTPUT]: 对外提供内容工厂 API 路由
 * [POS]: routes 路由层，定义内容工厂模块的 API 端点
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Router } from 'express';
import {
  startAnalysis,
  listAnalysis,
  getAnalysis,
  removeAnalysis,
  getAnalysisProgress,
  getKeywordHistory,
  generateInsightsController,
  webSearch,
  createArticleController,
  listArticles,
  getArticle,
  updateArticleController,
  removeArticle,
  createWechatAccountController,
  listWechatAccounts,
  updateWechatAccountController,
  removeWechatAccount,
  createXiaohongshuAccountController,
  listXiaohongshuAccounts,
  updateXiaohongshuAccountController,
  removeXiaohongshuAccount,
  publishToWechat,
  publishToXiaohongshu,
  getPublishStats,
  getSettings,
  getSettingsStatus,
  updateSettings,
} from '../controllers/factoryController';

const router = Router();

// ========================================
// 选题分析 API
// ========================================

// 启动分析
router.post('/analysis', startAnalysis);

// 获取分析列表
router.get('/analysis', listAnalysis);

// 获取历史关键词
router.get('/keywords', getKeywordHistory);

// 获取分析进度
router.get('/analysis/:id/progress', getAnalysisProgress);

// ========================================
// 搜一搜 API
// ========================================

// 搜一搜 - 即时搜索公众号文章
router.post('/search', webSearch);

// 生成 AI 洞察（手动触发）
router.post('/analysis/:id/insights', generateInsightsController);

// 获取分析详情
router.get('/analysis/:id', getAnalysis);

// 删除分析报告
router.delete('/analysis/:id', removeAnalysis);

// ========================================
// 内容创作 API
// ========================================

// 创建文章
router.post('/articles', createArticleController);

// 获取文章列表
router.get('/articles', listArticles);

// 获取文章详情
router.get('/articles/:id', getArticle);

// 更新文章
router.put('/articles/:id', updateArticleController);

// 删除文章
router.delete('/articles/:id', removeArticle);

// ========================================
// 发布管理 API
// ========================================

// 发布到公众号
router.post('/publish/wechat', publishToWechat);

// 发布到小红书
router.post('/publish/xiaohongshu', publishToXiaohongshu);

// 获取统计数据
router.get('/stats', getPublishStats);

// ========================================
// 账号管理 API
// ========================================

// 公众号账号
router.post('/accounts/wechat', createWechatAccountController);
router.get('/accounts/wechat', listWechatAccounts);
router.put('/accounts/wechat/:id', updateWechatAccountController);
router.delete('/accounts/wechat/:id', removeWechatAccount);

// 小红书账号
router.post('/accounts/xiaohongshu', createXiaohongshuAccountController);
router.get('/accounts/xiaohongshu', listXiaohongshuAccounts);
router.put('/accounts/xiaohongshu/:id', updateXiaohongshuAccountController);
router.delete('/accounts/xiaohongshu/:id', removeXiaohongshuAccount);

// ========================================
// 设置 API（API Key 配置）
// ========================================

router.get('/settings', getSettings);
router.get('/settings/status', getSettingsStatus);
router.put('/settings', updateSettings);

export default router;
