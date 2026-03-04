/**
 * [INPUT]: 依赖 bull、ioredis、uuid
 * [OUTPUT]: 对外提供任务队列服务
 * [POS]: services服务层，管理异步任务队列
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import Queue from 'bull';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { RecreateRequest } from '../types';

// ========================================
// 类型定义
// ========================================
export interface TaskStatus {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;  // 0-100
  message: string;
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt?: number;
}

// ========================================
// Redis 配置
// ========================================
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

// ========================================
// 任务队列（Bull）
// ========================================
export const taskQueue = new Queue('recreate-tasks', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 2,           // 失败重试 2 次
    timeout: 600000,       // 10 分钟超时
    removeOnComplete: 100, // 保留最近 100 条完成记录
    removeOnFail: 50,      // 保留最近 50 条失败记录
  },
});

// ========================================
// 任务状态存储（Redis 直接存储）
// ========================================
export const taskStatusRedis = new Redis(redisConfig);

// ========================================
// 核心方法
// ========================================

/**
 * 创建任务
 * @param data 任务数据
 * @param userId 用户ID（用于配额扣除）
 */
export async function createTask(data: RecreateRequest, userId?: string): Promise<string> {
  const taskId = uuidv4();

  // 初始化任务状态
  const initialStatus: TaskStatus = {
    taskId,
    status: 'pending',
    progress: 0,
    message: '任务已创建，等待处理...',
    createdAt: Date.now(),
  };

  // 存储状态到 Redis（24小时过期）
  await taskStatusRedis.set(
    `task:${taskId}`,
    JSON.stringify(initialStatus),
    'EX',
    86400
  );

  // 添加到队列（包含 userId 用于配额扣除）
  await taskQueue.add({ taskId, ...data, userId });

  console.log(`[队列] 任务已创建: ${taskId}, userId: ${userId || '匿名'}`);
  return taskId;
}

/**
 * 获取任务状态
 */
export async function getTaskStatus(taskId: string): Promise<TaskStatus | null> {
  const data = await taskStatusRedis.get(`task:${taskId}`);
  if (!data) {
    return null;
  }
  return JSON.parse(data);
}

/**
 * 更新任务状态
 */
export async function updateTaskStatus(
  taskId: string,
  update: Partial<TaskStatus>
): Promise<void> {
  const current = await getTaskStatus(taskId);
  if (!current) {
    console.error(`[队列] 任务不存在: ${taskId}`);
    return;
  }

  const updated: TaskStatus = {
    ...current,
    ...update,
    updatedAt: Date.now(),
  };

  // 保持 24 小时过期
  await taskStatusRedis.set(
    `task:${taskId}`,
    JSON.stringify(updated),
    'EX',
    86400
  );

  console.log(`[队列] 任务状态更新: ${taskId} -> ${updated.status} (${updated.progress}%)`);
}

/**
 * 删除任务（清理）
 */
export async function deleteTask(taskId: string): Promise<void> {
  await taskStatusRedis.del(`task:${taskId}`);
  console.log(`[队列] 任务已删除: ${taskId}`);
}

/**
 * 获取队列统计信息
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const [waiting, active, completed, failed] = await Promise.all([
    taskQueue.getWaitingCount(),
    taskQueue.getActiveCount(),
    taskQueue.getCompletedCount(),
    taskQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

/**
 * 清理过期任务（可定时执行）
 */
export async function cleanOldJobs(): Promise<void> {
  // Bull 会根据 removeOnComplete/removeOnFail 自动清理
  // 这里可以额外清理 Redis 中的过期状态
  console.log('[队列] 清理任务完成');
}
