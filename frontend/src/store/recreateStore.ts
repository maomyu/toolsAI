/**
 * [INPUT]: 依赖 zustand
 * [OUTPUT]: 对外提供 useRecreateStore hook
 * [POS]: store状态管理层，管理工具页面状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { create } from 'zustand';
import type { RecreateResponse } from '../services/api';
import { recreateArticleStream } from '../services/api';

interface WechatConfig {
  appid: string;
  secret: string;
}

// ========================================
// 流式处理相关类型
// ========================================
export type StreamStatus = 'idle' | 'loading' | 'content' | 'images' | 'done' | 'error';

export interface LoadedImage {
  index: number;
  url: string;
  percent: number;
  theme: string;
}

// 从 localStorage 读取最近使用的样式URL
const getSavedStyleUrl = (): string => {
  try {
    return localStorage.getItem('last_style_url') || '';
  } catch {
    return '';
  }
};

// 从 localStorage 读取公众号配置
const getSavedWechatConfig = (): WechatConfig => {
  try {
    const appid = localStorage.getItem('wechat_appid') || '';
    const secret = localStorage.getItem('wechat_secret') || '';
    return { appid, secret };
  } catch {
    return { appid: '', secret: '' };
  }
};

interface RecreateState {
  // 输入状态
  inputMethod: 'url' | 'paste'; // 内容输入方式：URL链接 vs 直接粘贴
  contentUrl: string;
  contentText: string; // 直接粘贴的文本内容
  styleUrl: string;
  imageOption: 'none' | 'ai'; // 配图选项
  aiImageCount: number; // AI配图数量
  creativityLevel: number; // 二创自由度 1-10，数字越高自由度越低（10=几乎不变）

  // UI状态
  isProcessing: boolean;
  currentStep: number;
  progressMessage: string;
  showConfigModal: boolean; // 是否显示配置模态框

  // 🚀 流式处理状态（新增）
  streamStatus: StreamStatus;
  loadedImages: LoadedImage[];
  streamTitle: string; // 流式返回的标题
  streamHtml: string; // 流式返回的 HTML
  imageLoading: boolean; // 图片是否正在加载

  // 结果状态
  result: RecreateResponse | null;
  error: string | null;

  // 编辑状态
  editedTitle: string; // 编辑后的标题
  editedHtml: string; // 编辑后的HTML内容
  isEditMode: boolean; // 是否处于编辑模式
  hasUnsavedChanges: boolean; // 是否有未保存的修改

  // 公众号配置
  wechatConfig: WechatConfig;

  // Actions
  setInputMethod: (method: 'url' | 'paste') => void;
  setContentUrl: (url: string) => void;
  setContentText: (text: string) => void;
  setStyleUrl: (url: string) => void;
  setImageOption: (option: 'none' | 'ai') => void;
  setAiImageCount: (count: number) => void;
  setCreativityLevel: (level: number) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setCurrentStep: (step: number | ((prev: number) => number)) => void;
  setProgressMessage: (message: string) => void;
  setResult: (result: RecreateResponse | null) => void;
  setError: (error: string | null) => void;
  setShowConfigModal: (show: boolean) => void;
  setWechatConfig: (config: WechatConfig) => void;
  setEditedTitle: (title: string) => void;
  setEditedHtml: (html: string) => void;
  setIsEditMode: (isEdit: boolean) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  reset: () => void;

  // 🚀 流式处理 Actions（新增）
  setStreamStatus: (status: StreamStatus) => void;
  addLoadedImage: (image: LoadedImage) => void;
  setStreamTitle: (title: string) => void;
  setStreamHtml: (html: string) => void;
  setImageLoading: (loading: boolean) => void;
  startStreamRecreate: (userId?: string) => Promise<void>;
}

const steps = [
  { id: 1, label: '准备中' },
  { id: 2, label: '读取内容' },
  { id: 3, label: 'AI处理' },
  { id: 4, label: '分析样式' },
  { id: 5, label: '准备预览' },
];

export const useRecreateStore = create<RecreateState>((set, get) => ({
  // 初始状态
  inputMethod: 'url', // 默认使用URL链接
  contentUrl: '',
  contentText: '',
  styleUrl: getSavedStyleUrl(), // 从 localStorage 读取最近使用的样式URL
  imageOption: 'none', // 默认无配图
  aiImageCount: 3, // 默认AI配图数量为3张
  creativityLevel: 7, // 默认二创自由度为7
  isProcessing: false,
  currentStep: 0,
  progressMessage: '',
  showConfigModal: false,

  // 🚀 流式处理初始状态
  streamStatus: 'idle',
  loadedImages: [],
  streamTitle: '',
  streamHtml: '',
  imageLoading: false,

  result: null,
  error: null,
  editedTitle: '',
  editedHtml: '',
  isEditMode: false,
  hasUnsavedChanges: false,
  wechatConfig: getSavedWechatConfig(), // 从 localStorage 读取公众号配置

  // Actions
  setInputMethod: (method) => set({
    inputMethod: method,
    // 根据输入方式设置默认自由度：URL模式7，粘贴模式9
    creativityLevel: method === 'url' ? 7 : 9,
  }),
  setContentUrl: (url) => set({ contentUrl: url }),
  setContentText: (text) => set({ contentText: text }),
  setStyleUrl: (url) => {
    // 保存到 localStorage
    try {
      localStorage.setItem('last_style_url', url);
    } catch {
      // 忽略 localStorage 错误
    }
    set({ styleUrl: url });
  },
  setImageOption: (option) => set({ imageOption: option }),
  setAiImageCount: (count) => set({ aiImageCount: count }),
  setCreativityLevel: (level) => set({ creativityLevel: level }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setCurrentStep: (step) => set((state) => ({
    currentStep: typeof step === 'function' ? step(state.currentStep) : step
  })),
  setProgressMessage: (message) => set({ progressMessage: message }),
  setResult: (result) => set({
    result,
    // 当新结果生成时,初始化编辑状态
    editedTitle: result?.title || '',
    editedHtml: result?.html || '',
    hasUnsavedChanges: false,
    isEditMode: false,
  }),
  setError: (error) => set({ error }),
  setShowConfigModal: (show) => set({ showConfigModal: show }),
  setWechatConfig: (config) => set({ wechatConfig: config }),
  setEditedTitle: (title) => set({ editedTitle: title, hasUnsavedChanges: true }),
  setEditedHtml: (html) => set({ editedHtml: html, hasUnsavedChanges: true }),
  setIsEditMode: (isEdit) => set({ isEditMode: isEdit }),
  setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),

  // 🚀 流式处理 Actions
  setStreamStatus: (status) => set({ streamStatus: status }),
  addLoadedImage: (image) => set((state) => ({
    loadedImages: [...state.loadedImages, image]
  })),
  setStreamTitle: (title) => set({ streamTitle: title }),
  setStreamHtml: (html) => set({ streamHtml: html }),
  setImageLoading: (loading) => set({ imageLoading: loading }),

  // 🚀 启动流式复刻
  startStreamRecreate: async (userId?: string) => {
    const state = get();

    // 重置状态
    set({
      isProcessing: true,
      streamStatus: 'loading',
      loadedImages: [],
      streamTitle: '',
      streamHtml: '',
      imageLoading: false,
      error: null,
      result: null,
      currentStep: 1,
      progressMessage: '正在连接服务器...',
    });

    try {
      await recreateArticleStream(
        {
          contentUrl: state.inputMethod === 'url' ? state.contentUrl : undefined,
          contentText: state.inputMethod === 'paste' ? state.contentText : undefined,
          styleUrl: state.styleUrl,
          imageOption: state.imageOption,           // 配图选项
          aiImageCount: state.aiImageCount,         // AI配图数量
          creativityLevel: state.creativityLevel,   // 二创自由度
          options: {
            type: 'expand',
            style: 'casual',
          },
        },
        {
          // 标题回调
          onTitle: (title) => {
            set({
              streamTitle: title,
              currentStep: 2,
              progressMessage: '标题生成完成，正在创作内容...',
            });
          },

          // 内容回调
          onContent: (html, _images, imageLoading) => {
            set({
              streamHtml: html,
              streamStatus: imageLoading ? 'images' : 'content',
              imageLoading: imageLoading || false,
              currentStep: 3,
              progressMessage: imageLoading ? '内容完成，正在生成配图...' : '内容创作完成',
            });
          },

          // 图片增量回调
          onImage: (index, url, percent, theme) => {
            const state = get();
            set({
              loadedImages: [...state.loadedImages, { index, url, percent, theme }],
              progressMessage: `配图 ${index + 1}/${state.aiImageCount} 生成完成`,
            });
          },

          // 完成回调
          onDone: (result) => {
            set({
              isProcessing: false,
              streamStatus: 'done',
              imageLoading: false,
              currentStep: 5,
              progressMessage: '完成！',
              result: result.html ? {
                html: result.html,
                title: get().streamTitle,
                summary: `处理完成，耗时 ${Math.round((result.processingTime || 0) / 1000)} 秒`,
                images: result.images || [],
                meta: {
                  processingTime: result.processingTime || 0,
                  tokensUsed: 0,
                },
              } : null,
            });
          },

          // 错误回调
          onError: (code, message) => {
            set({
              isProcessing: false,
              streamStatus: 'error',
              error: `${code}: ${message}`,
            });
          },
        },
        userId
      );
    } catch (error: any) {
      set({
        isProcessing: false,
        streamStatus: 'error',
        error: error.message || '请求失败',
      });
    }
  },

  reset: () => set({
    inputMethod: 'url',
    contentUrl: '',
    contentText: '',
    styleUrl: getSavedStyleUrl(), // 保留最近使用的样式URL
    imageOption: 'none',
    creativityLevel: 7,
    isProcessing: false,
    currentStep: 0,
    progressMessage: '',
    streamStatus: 'idle',
    loadedImages: [],
    streamTitle: '',
    streamHtml: '',
    imageLoading: false,
    result: null,
    error: null,
    editedTitle: '',
    editedHtml: '',
    isEditMode: false,
    hasUnsavedChanges: false,
  }),
}));

// 导出步骤配置供UI使用
export { steps };
