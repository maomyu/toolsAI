/**
 * [INPUT]: 依赖 Express、控制器
 * [OUTPUT]: 对外提供路由配置
 * [POS]: routes路由层，定义API端点
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Router } from 'express';
import { recreate, healthCheck, recreateStream } from '../controllers/recreateController';
import { saveToWechatDraft } from '../controllers/wechatController';
import factoryRoutes from './factory';

const router = Router();

// 健康检查
router.get('/health', healthCheck);

// 一键复刻公众号（无需配额检查）
router.post('/recreate', recreate);

// 流式复刻接口（SSE）
router.post('/recreate/stream', recreateStream);

// 微信公众号相关API
router.post('/wechat/save-draft', saveToWechatDraft);

// 内容工厂 API
router.use('/factory', factoryRoutes);

export default router;
