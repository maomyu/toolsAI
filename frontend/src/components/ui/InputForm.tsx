/**
 * [INPUT]: 依赖 React、useRecreateStore
 * [OUTPUT]: 对外提供 InputForm 组件
 * [POS]: components UI组件，被工具页面使用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRecreateStore } from '../../store/recreateStore';

export function InputForm() {
  const store = useRecreateStore();
  const {
    inputMethod,
    contentUrl,
    contentText,
    styleUrl,
    imageOption,
    aiImageCount,
    creativityLevel,
    setInputMethod,
    setContentUrl,
    setContentText,
    setStyleUrl,
    setImageOption,
    setAiImageCount,
    setCreativityLevel,
    setIsProcessing,
    setCurrentStep,
    setProgressMessage,
    setResult,
    setError,
    isProcessing,
  } = store;

  const [isValid, setIsValid] = useState(false);

  // 验证输入格式
  const validateInput = () => {
    let contentValid = false;

    if (inputMethod === 'url') {
      // URL模式：需要内容URL
      contentValid = contentUrl.trim().length > 0;
    } else {
      // 粘贴模式：需要文本内容
      contentValid = contentText.trim().length > 0;
    }

    // 样式链接可选，为空时使用默认值
    const valid = contentValid;
    setIsValid(valid);
    return valid;
  };

  // 当输入变化时自动验证
  useEffect(() => {
    validateInput();
  }, [inputMethod, contentUrl, contentText, styleUrl]);

  const handleContentUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContentUrl(e.target.value);
  };

  const handleContentTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContentText(e.target.value);
  };

  const handleStyleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStyleUrl(e.target.value);
  };

  const handleSubmit = async () => {
    if (!isValid) return;

    setIsProcessing(true);
    setError(null);
    setCurrentStep(1);
    setProgressMessage('正在创建任务...');

    try {
      // 动态导入API服务
      const { recreateArticleAsync } = await import('../../services/api');

      // 构建API请求
      const request: any = {
        styleUrl: styleUrl.trim() || '', // 为空时使用默认样式
        imageOption: imageOption, // 'none' | 'original' | 'ai'
        aiImageCount: aiImageCount, // AI配图数量
        creativityLevel: creativityLevel, // 1-10，数字越高自由度越低
        options: {
          type: 'refactor',
          style: 'casual',
          aiImageCount: aiImageCount,
        },
      };

      // 根据输入方式添加内容
      if (inputMethod === 'url') {
        request.contentUrl = contentUrl.trim();
      } else {
        request.contentText = contentText.trim();
      }

      // 调用异步API（带进度回调）
      const result = await recreateArticleAsync(request, (status) => {
        // 更新进度消息
        setProgressMessage(status.message);
        // 根据进度更新步骤 (0-100 -> 1-5)
        const step = Math.min(5, Math.max(1, Math.floor(status.progress / 20) + 1));
        setCurrentStep(step);
      });

      setCurrentStep(5);
      setProgressMessage('处理完成！');
      setResult(result);
    } catch (error: any) {
      setError(error.message || '处理失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      {/* 输入方式选择 */}
      <div>
        <label className="block text-sm font-medium text-dark mb-2">
          内容来源
        </label>
        <div className="flex gap-4">
          <label
            className={`flex items-center px-4 py-3 border rounded-lg cursor-pointer transition-smooth ${
              inputMethod === 'url'
                ? 'border-primary bg-primary/5'
                : 'border-light-gray hover:border-mid-gray'
            }`}
          >
            <input
              type="radio"
              name="inputMethod"
              value="url"
              checked={inputMethod === 'url'}
              onChange={(e) => setInputMethod(e.target.value as 'url' | 'paste')}
              disabled={isProcessing}
              className="mr-2"
            />
            <span className="text-sm">URL链接</span>
          </label>
          <label
            className={`flex items-center px-4 py-3 border rounded-lg cursor-pointer transition-smooth ${
              inputMethod === 'paste'
                ? 'border-primary bg-primary/5'
                : 'border-light-gray hover:border-mid-gray'
            }`}
          >
            <input
              type="radio"
              name="inputMethod"
              value="paste"
              checked={inputMethod === 'paste'}
              onChange={(e) => setInputMethod(e.target.value as 'url' | 'paste')}
              disabled={isProcessing}
              className="mr-2"
            />
            <span className="text-sm">粘贴文本</span>
          </label>
        </div>
      </div>

      {/* 内容输入区域 */}
      {inputMethod === 'url' ? (
        <div>
          <label className="block text-sm font-medium text-dark mb-2">
            内容链接
          </label>
          <input
            type="url"
            value={contentUrl}
            onChange={handleContentUrlChange}
            placeholder="输入任意网页链接（支持公众号、博客、新闻等）"
            className="w-full px-4 py-3 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-light"
            disabled={isProcessing}
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-dark mb-2">
            文章内容
          </label>
          <textarea
            value={contentText}
            onChange={handleContentTextChange}
            placeholder="粘贴您的文章内容..."
            rows={10}
            className="w-full px-4 py-3 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none bg-light"
            disabled={isProcessing}
          />
          <p className="text-xs text-mid-gray mt-1">
            字符数: {contentText.length.toLocaleString()}
          </p>
        </div>
      )}

      {/* 样式参考链接 */}
      <div>
        <label className="block text-sm font-medium text-dark mb-2">
          样式参考
        </label>
        <input
          type="url"
          value={styleUrl}
          onChange={handleStyleUrlChange}
          placeholder="输入参考样式的网页链接（可选，留空使用默认样式）"
          className="w-full px-4 py-3 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-light"
          disabled={isProcessing}
        />
        <p className="text-xs text-mid-gray mt-1">
          支持任意网页作为样式参考，留空则使用默认样式模板
        </p>
      </div>

      {/* 配图选项 */}
      <div>
        <label className="block text-sm font-medium text-dark mb-2">
          配图方式
        </label>
        <div className="flex gap-4 flex-wrap">
          {/* 无配图选项 */}
          <label
            className={`flex items-center px-4 py-3 border rounded-lg cursor-pointer transition-smooth ${
              imageOption === 'none'
                ? 'border-primary bg-primary/5'
                : 'border-light-gray hover:border-mid-gray'
            }`}
          >
            <input
              type="radio"
              name="imageOption"
              value="none"
              checked={imageOption === 'none'}
              onChange={(e) => setImageOption(e.target.value as 'none' | 'ai')}
              disabled={isProcessing}
              className="mr-2"
            />
            <span className="text-sm">无配图</span>
          </label>

          {/* AI智能配图 */}
          <label
            className={`flex items-center px-4 py-3 border rounded-lg cursor-pointer transition-smooth ${
              imageOption === 'ai'
                ? 'border-primary bg-primary/5'
                : 'border-light-gray hover:border-mid-gray'
            }`}
          >
            <input
              type="radio"
              name="imageOption"
              value="ai"
              checked={imageOption === 'ai'}
              onChange={(e) => setImageOption(e.target.value as 'none' | 'ai')}
              disabled={isProcessing}
              className="mr-2"
            />
            <span className="text-sm">AI智能配图</span>
          </label>
        </div>

        {/* AI配图数量选择 - 只在选择AI配图时显示 */}
        {imageOption === 'ai' && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-mid-gray">配图数量：</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setAiImageCount(num)}
                  disabled={isProcessing}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-smooth ${
                    aiImageCount === num
                      ? 'bg-primary text-white'
                      : 'bg-light-gray text-dark hover:bg-mid-gray/30'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <span className="text-xs text-mid-gray">AI将智能分析文章并选择最佳插入位置</span>
          </div>
        )}
      </div>

      {/* 改写自由度 */}
      <div>
        <label className="block text-sm font-medium text-dark mb-2">
          改写自由度
        </label>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="10"
              value={creativityLevel}
              onChange={(e) => setCreativityLevel(Number(e.target.value))}
              disabled={isProcessing}
              className="flex-1 h-2 bg-light-gray rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <input
              type="number"
              min="1"
              max="10"
              value={creativityLevel}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value >= 1 && value <= 10) {
                  setCreativityLevel(value);
                }
              }}
              disabled={isProcessing}
              className="w-16 px-2 py-1 border border-light-gray rounded text-center focus:outline-none focus:ring-2 focus:ring-primary/50 bg-light"
            />
          </div>
          <div className="flex justify-between text-xs text-mid-gray">
            <span>1 - 高度改写（大幅创新）</span>
            <span>10 - 几乎不变（仅润色）</span>
          </div>
          <p className="text-xs text-mid-gray mt-1">
            当前值: {creativityLevel} {creativityLevel <= 3 ? '- 高自由度，内容会有较大改动' : creativityLevel >= 8 ? '- 低自由度，保持原意结构' : '- 中等自由度，平衡改动与保留'}
          </p>
        </div>
      </div>

      {/* 处理按钮 */}
      <button
        onClick={handleSubmit}
        disabled={!isValid || isProcessing}
        className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
          isValid
            ? 'bg-primary text-light hover:bg-primary-hover'
            : 'bg-light-gray text-mid-gray cursor-not-allowed'
        }`}
      >
        {isProcessing ? '处理中...' : '开始处理'}
      </button>
    </motion.div>
  );
}
