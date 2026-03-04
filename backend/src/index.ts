/**
 * [INPUT]: 依赖 Express 和配置
 * [OUTPUT]: 启动后端服务器
 * [POS]: 应用入口，导出给启动脚本
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import express from 'express';
import cors from 'cors';
import { config } from './config';
import routes from './routes';
import queueRoutes from './routes/queue';
import { startWorker, stopWorker } from './workers/recreateWorker';
import { closeDatabase } from './models/database'; // 初始化 SQLite 数据库

const app = express();

// 中间件
// CORS: 支持多个 origin（本地开发 + 线上生产）
const allowedOrigins = config.cors.origin.split(',').map(o => o.trim());
console.log('[CORS] 允许的 origins:', allowedOrigins);
app.use(cors({
  origin: (origin, callback) => {
    // 允许无 origin 的请求（如 curl、服务器间调用）
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('[CORS] 拒绝 origin:', origin);
      callback(null, false);  // 返回 false 而不是抛出错误
    }
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api', routes);
app.use('/api/queue', queueRoutes);  // 任务队列路由

// 错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: err.message || '服务器内部错误',
    },
  });
});

// ============================================================
// 启动服务器
// ============================================================
const server = app.listen(config.port, async () => {
  console.log(`🚀 服务器运行在 http://localhost:${config.port}`);
  console.log(`📝 环境: ${config.nodeEnv}`);

  // 启动 Worker（异步任务处理器）
  try {
    await startWorker();
    console.log('✅ Worker 已启动');
  } catch (error) {
    console.error('❌ Worker 启动失败:', error);
    console.log('⚠️  服务将继续运行，但异步任务将不可用');
  }
});

// AI二创耗时较长(3-5分钟)，需要设置足够长的超时
server.timeout = 600000;       // 10分钟
server.keepAliveTimeout = 650000;

// ============================================================
// 优雅关闭
// ============================================================
async function gracefulShutdown(signal: string) {
  console.log(`\n👋 收到 ${signal} 信号，正在关闭...`);

  // 1. 停止接受新请求
  server.close(() => {
    console.log('✅ HTTP 服务器已关闭');
  });

  // 2. 停止 Worker
  try {
    await stopWorker();
    console.log('✅ Worker 已停止');
  } catch (error) {
    console.error('❌ Worker 停止失败:', error);
  }

  // 3. 关闭数据库连接
  try {
    closeDatabase();
    console.log('✅ 数据库连接已关闭');
  } catch (error) {
    console.error('❌ 数据库关闭失败:', error);
  }

  // 4. 退出进程
  console.log('👋 服务器已完全关闭');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
