/**
 * [INPUT]: 依赖 dotenv
 * [OUTPUT]: 对外提供环境变量配置
 * [POS]: config配置模块，被所有模块使用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  dashscope: {
    apiKey: process.env.DASHSCOPE_API_KEY || '',
    model: process.env.DASHSCOPE_MODEL || 'qwen3.5-plus',
    // OpenAI 兼容格式 API（qwen3.5-plus 需要）
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174',
  },
  // Redis 配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  // 并发配置
  concurrency: {
    maxTasks: parseInt(process.env.MAX_CONCURRENT_TASKS || '3'),
    browserPoolSize: parseInt(process.env.BROWSER_POOL_SIZE || '3'),
  },
};
