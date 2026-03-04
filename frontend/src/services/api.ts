/**
 * [INPUT]: 依赖 axios
 * [OUTPUT]: 对外提供 API 请求函数
 * [POS]: services API层，负责与后端通信
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// AI二创耗时较长(3-5分钟)，创建带长超时的axios实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10分钟超时
});

export type RecreateRequest = {
  contentUrl?: string; // 可选：内容URL链接
  contentText?: string; // 可选：直接粘贴的文本内容
  styleUrl?: string; // 可选：样式参考链接，为空时使用默认样式
  imageOption?: 'none' | 'ai'; // 配图选项
  aiImageCount?: number; // AI配图数量
  creativityLevel?: number; // 二创自由度 1-10
  options?: {
    type?: 'expand' | 'condense' | 'refactor';
    style?: 'formal' | 'casual' | 'professional';
    targetLength?: number;
    useAIImages?: boolean; // 是否使用AI自动配图
    aiImageCount?: number; // AI配图数量
  };
};

// 图片上下文信息
export type ImageContext = {
  url: string;
  beforeText: string;  // 图片前的文字片段
  afterText: string;   // 图片后的文字片段
  index: number;       // 图片在原文中的顺序
  mediaType?: 'image' | 'gif' | 'video';  // 媒体类型
};

export type RecreateResponse = {
  html: string;
  title: string;
  summary: string;
  images: string[]; // 图片链接数组
  imageContexts?: ImageContext[]; // 图片上下文信息（用于智能插入）
  meta: {
    processingTime: number;
    tokensUsed: number;
  };
};

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};

/**
 * AI内容处理
 */
export async function recreateArticle(
  request: RecreateRequest,
  userId?: string
): Promise<RecreateResponse> {
  try {
    const response = await apiClient.post<ApiResponse<RecreateResponse>>(
      '/recreate',
      request,
      {
        headers: userId ? { 'X-User-Id': userId } : undefined
      }
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      throw new Error(response.data.error?.message || '请求失败');
    }
  } catch (error: any) {
    console.error('API请求失败:', error);
    throw new Error(error.response?.data?.error?.message || error.message || '网络请求失败');
  }
}

/**
 * 健康检查
 */
export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  try {
    const response = await apiClient.get<ApiResponse<{ status: string; timestamp: string }>>(
      '/health'
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      throw new Error('健康检查失败');
    }
  } catch (error: any) {
    console.error('健康检查失败:', error);
    throw new Error('服务器连接失败');
  }
}

// ========================================
// 任务队列相关类型和函数
// ========================================

export type TaskStatus = {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;  // 0-100
  message: string;
  result?: RecreateResponse;
  error?: string;
  createdAt: number;
  updatedAt?: number;
};

/**
 * 提交异步任务
 */
export async function submitTask(request: RecreateRequest, userId?: string): Promise<string> {
  try {
    const response = await apiClient.post<ApiResponse<{ taskId: string }>>(
      '/queue/recreate',
      request,
      {
        headers: userId ? { 'X-User-Id': userId } : undefined
      }
    );

    if (response.data.success && response.data.data) {
      return response.data.data.taskId;
    } else {
      throw new Error(response.data.error?.message || '创建任务失败');
    }
  } catch (error: any) {
    console.error('提交任务失败:', error);
    throw new Error(error.response?.data?.error?.message || error.message || '网络请求失败');
  }
}

/**
 * 查询任务状态
 */
export async function getTaskStatus(taskId: string, userId?: string): Promise<TaskStatus> {
  try {
    const response = await apiClient.get<ApiResponse<TaskStatus>>(
      `/queue/task/${taskId}`,
      {
        headers: userId ? { 'X-User-Id': userId } : undefined
      }
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      throw new Error(response.data.error?.message || '查询任务失败');
    }
  } catch (error: any) {
    console.error('查询任务失败:', error);
    throw new Error(error.response?.data?.error?.message || error.message || '网络请求失败');
  }
}

/**
 * 轮询任务状态直到完成
 * @param taskId 任务ID
 * @param onProgress 进度回调
 * @param interval 轮询间隔（毫秒）
 * @param userId 用户ID（用于认证）
 */
export async function pollTaskStatus(
  taskId: string,
  onProgress: (status: TaskStatus) => void,
  interval = 2000,
  userId?: string
): Promise<TaskStatus> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await getTaskStatus(taskId, userId);
        onProgress(status);

        if (status.status === 'completed') {
          resolve(status);
        } else if (status.status === 'failed') {
          reject(new Error(status.error || status.message || '任务失败'));
        } else {
          // 继续轮询
          setTimeout(poll, interval);
        }
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}

/**
 * 使用任务队列处理文章（推荐方式）
 * 自动提交任务并轮询获取结果
 * @param request 请求参数
 * @param onProgress 进度回调
 * @param userId 用户ID（用于认证）
 */
export async function recreateArticleAsync(
  request: RecreateRequest,
  onProgress?: (status: TaskStatus) => void,
  userId?: string
): Promise<RecreateResponse> {
  // 1. 提交任务
  const taskId = await submitTask(request, userId);

  // 2. 轮询获取结果
  const finalStatus = await pollTaskStatus(taskId, (status) => {
    onProgress?.(status);
  }, 2000, userId);

  // 3. 返回结果
  if (finalStatus.result) {
    return finalStatus.result;
  } else {
    throw new Error('任务完成但无结果');
  }
}

// ========================================
// SSE 流式接口（核心优化：感知延迟 8min → 2s）
// ========================================

export type StreamEvent = {
  type: 'title' | 'content' | 'image' | 'done' | 'error';
  data: any;
};

export type StreamCallbacks = {
  onTitle?: (title: string) => void;
  onContent?: (html: string, images: string[], imageLoading?: boolean) => void;
  onImage?: (index: number, url: string, percent: number, theme: string) => void;
  onDone?: (result: { html?: string; images?: string[]; processingTime: number }) => void;
  onError?: (code: string, message: string) => void;
};

/**
 * 🚀 流式复刻文章（推荐方式）
 *
 * 用户体验：2 秒内看到内容，图片逐步加载
 *
 * @param request 请求参数
 * @param callbacks 事件回调
 * @param userId 用户ID（用于认证）
 */
export async function recreateArticleStream(
  request: RecreateRequest,
  callbacks: StreamCallbacks,
  userId?: string
): Promise<void> {
  const url = `${API_BASE_URL}/recreate/stream`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 解析 SSE 事件
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // 保留未完成的部分

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event: StreamEvent = JSON.parse(line.slice(6));

            switch (event.type) {
              case 'title':
                callbacks.onTitle?.(event.data.title);
                break;

              case 'content':
                callbacks.onContent?.(
                  event.data.html,
                  event.data.images || [],
                  event.data.imageLoading
                );
                break;

              case 'image':
                callbacks.onImage?.(
                  event.data.index,
                  event.data.url,
                  event.data.percent,
                  event.data.theme
                );
                break;

              case 'done':
                callbacks.onDone?.(event.data);
                break;

              case 'error':
                callbacks.onError?.(event.data.code, event.data.message);
                break;
            }
          } catch (parseError) {
            console.warn('解析 SSE 事件失败:', parseError);
          }
        }
      }
    }
  } catch (error: any) {
    console.error('流式请求失败:', error);
    callbacks.onError?.('NETWORK_ERROR', error.message || '网络请求失败');
  }
}

// ========================================
// 手机号验证码登录（Authing）
// ========================================

/**
 * 发送短信验证码
 */
export async function sendSmsCode(phone: string): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      '/auth/sms/send',
      { phone }
    );

    return {
      success: response.data.success,
      message: response.data.data?.message || response.data.error?.message,
    };
  } catch (error: any) {
    console.error('发送验证码失败:', error);
    return {
      success: false,
      message: error.response?.data?.error || '发送验证码失败',
    };
  }
}

/**
 * 验证短信验证码并登录
 */
export async function verifySmsCode(
  phone: string,
  code: string
): Promise<{ success: boolean; email?: string; password?: string; message?: string }> {
  try {
    const response = await apiClient.post<ApiResponse<{ email: string; password: string; message: string }>>(
      '/auth/sms/verify',
      { phone, code }
    );

    return {
      success: response.data.success,
      email: response.data.data?.email,
      password: response.data.data?.password,
      message: response.data.error?.message,
    };
  } catch (error: any) {
    console.error('验证登录失败:', error);
    return {
      success: false,
      message: error.response?.data?.error || '验证登录失败',
    };
  }
}
