/**
 * [INPUT]: 依赖 express、QueueService
 * [OUTPUT]: 对外提供任务队列路由
 * [POS]: routes路由层，处理任务提交和状态查询
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Router, Response } from 'express';
import { createTask, getTaskStatus, getQueueStats } from '../services/QueueService';

const router = Router();

// ========================================
// 创建任务
// ========================================
router.post('/recreate', async (req: any, res: Response) => {
  try {
    const { contentUrl, contentText, styleUrl, options, imageOption, aiImageCount, creativityLevel } = req.body;

    // 参数验证
    if (!contentUrl && !contentText) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: '请提供内容链接或粘贴的文章内容',
        },
      });
    }

    // 创建任务
    const taskId = await createTask({
      contentUrl,
      contentText,
      styleUrl,
      options,
      imageOption,
      aiImageCount,
      creativityLevel,
    });

    res.json({
      success: true,
      data: {
        taskId,
        message: '任务已创建，请轮询查询状态',
        pollUrl: `/api/queue/task/${taskId}`,
      },
    });
  } catch (error: any) {
    console.error('[队列路由] 创建任务失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_TASK_ERROR',
        message: error.message || '创建任务失败',
      },
    });
  }
});

// ========================================
// 查询任务状态
// ========================================
router.get('/task/:id', async (req: any, res: Response) => {
  try {
    const { id: taskId } = req.params;

    const status = await getTaskStatus(taskId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TASK_NOT_FOUND',
          message: '任务不存在或已过期',
        },
      });
    }

    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('[队列路由] 查询任务失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_TASK_ERROR',
        message: error.message || '查询任务失败',
      },
    });
  }
});

// ========================================
// 获取队列统计
// ========================================
router.get('/stats', async (req, res) => {
  try {
    const stats = await getQueueStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('[队列路由] 获取统计失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_STATS_ERROR',
        message: error.message || '获取统计失败',
      },
    });
  }
});

export default router;
