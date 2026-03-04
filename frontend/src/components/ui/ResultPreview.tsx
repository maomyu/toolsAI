/**
 * [INPUT]: 依赖 React 和 useRecreateStore
 * [OUTPUT]: 对外提供 ResultPreview 组件
 * [POS]: components UI组件，显示结果并提供复制功能
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 * 参考：replica.ai 的富文本复制实现
 */

import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { useRecreateStore } from '../../store/recreateStore';
import { WechatConfigModal } from './WechatConfigModal';
import { AlertTriangle, Link2, X } from 'lucide-react';


export function ResultPreview() {
  const {
    result,
    error,
    reset,
    imageOption,
    wechatConfig,
    setShowConfigModal,
    editedTitle,
    editedHtml,
    isEditMode,
    hasUnsavedChanges,
    setEditedTitle,
    setEditedHtml,
    setIsEditMode,
    setHasUnsavedChanges,
  } = useRecreateStore();
  const [copied, setCopied] = useState(false);
  const [savedToDraft, setSavedToDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // 保存中状态
  const [showSource, setShowSource] = useState(false); // 源码模式
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null); // 预览区域ref
  const editorInitializedRef = useRef(false); // 追踪编辑器是否已初始化

  // 调试：输出当前状态
  useEffect(() => {
    console.log('[ResultPreview] 状态变化:');
    console.log('  - imageOption:', imageOption);
    console.log('  - result?.images?.length:', result?.images?.length);
    console.log('  - hasUnsavedChanges:', hasUnsavedChanges);
  }, [imageOption, result?.images, hasUnsavedChanges]);

  // 使用编辑后的内容(如果有修改),否则使用原始内容
  const displayTitle = (hasUnsavedChanges ? editedTitle : result?.title) || '';
  const displayHtml = (hasUnsavedChanges ? editedHtml : result?.html) || '';

  // 当进入编辑模式时,初始化编辑器内容（仅在首次进入编辑模式时执行）
  useLayoutEffect(() => {
    if (isEditMode && contentEditableRef.current && editedHtml && !editorInitializedRef.current) {
      contentEditableRef.current.innerHTML = editedHtml;
      editorInitializedRef.current = true;
      console.log('[编辑模式] 初始化编辑器内容，长度:', editedHtml.length);
    }
    // 退出编辑模式时重置初始化标记
    if (!isEditMode) {
      editorInitializedRef.current = false;
    }
  }, [isEditMode, editedHtml]);

  // 富文本编辑器命令
  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    contentEditableRef.current?.focus();
    // 执行格式化命令后标记为已修改
    setHasUnsavedChanges(true);
  };

  // 强制设置对齐方式（覆盖内联样式）
  const forceAlign = (alignment: 'left' | 'center' | 'right' | 'justify') => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // 查找选中的最外层块级元素
    let container = range.commonAncestorContainer as HTMLElement;

    // 如果是文本节点，获取父元素
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement as HTMLElement;
    }

    // 向上查找块级元素（p, div, section, h1-h6 等）
    while (container && container !== contentEditableRef.current) {
      const tagName = container.tagName?.toLowerCase();
      if (['p', 'div', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'li'].includes(tagName)) {
        break;
      }
      container = container.parentElement as HTMLElement;
    }

    if (container && container !== contentEditableRef.current) {
      // 获取现有样式
      const existingStyle = container.getAttribute('style') || '';

      // 移除现有的 text-align 属性
      let newStyle = existingStyle.replace(/text-align:\s*[^;]+;?/gi, '').trim();

      // 添加新的对齐方式
      if (newStyle && !newStyle.endsWith(';')) {
        newStyle += ';';
      }
      newStyle += ` text-align: ${alignment};`;

      container.setAttribute('style', newStyle);
      console.log('[编辑器] 设置对齐方式:', alignment, '元素:', container.tagName);

      // 标记为已修改
      setHasUnsavedChanges(true);

      // 触发重新渲染
      if (contentEditableRef.current) {
        setEditedHtml(contentEditableRef.current.innerHTML);
      }
    }
  };

  // 设置文字颜色
  const setTextColor = () => {
    const color = prompt('请输入颜色值（如：#ff0000 或 red）:', '#c30503');
    if (color) {
      document.execCommand('foreColor', false, color);
      setHasUnsavedChanges(true);
    }
  };

  // 设置背景色
  const setBackgroundColor = () => {
    const color = prompt('请输入背景色（如：#fff5f5 或 yellow）:', '#fff5f5');
    if (color) {
      document.execCommand('hiliteColor', false, color);
      setHasUnsavedChanges(true);
    }
  };

  // 插入分隔线
  const insertDivider = () => {
    const divider = '<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />';
    document.execCommand('insertHTML', false, divider);
    setHasUnsavedChanges(true);
  };

  // 处理内容输入变化
  const handleInput = () => {
    // 实时保存编辑内容到状态
    if (contentEditableRef.current) {
      setEditedHtml(contentEditableRef.current.innerHTML);
    }
    // 标记为已修改
    setHasUnsavedChanges(true);
  };

  // 保存编辑内容
  const saveEditContent = () => {
    if (contentEditableRef.current) {
      setEditedHtml(contentEditableRef.current.innerHTML);
    }
    setIsEditMode(false);
    setHasUnsavedChanges(true);
  };

  // 根据配图选项处理HTML
  const processedHtml = useMemo(() => {
    if (!displayHtml) return '';

    console.log('[预览] imageOption:', imageOption);
    console.log('[预览] result.images:', result?.images?.length || 0);
    console.log('[预览] displayHtml长度:', displayHtml.length);

    // AI智能配图：后端已将图片插入HTML，无需前端处理
    // 无配图：无需处理
    return displayHtml;
  }, [displayHtml, result, imageOption]);

  // 处理预览区域中的图片防盗链问题（必须在 processedHtml 定义之后）
  useEffect(() => {
    if (previewContentRef.current) {
      const images = previewContentRef.current.querySelectorAll('img');
      images.forEach((img) => {
        img.referrerPolicy = 'no-referrer';
      });
      console.log('[预览] 已为', images.length, '张图片设置 referrerPolicy');
    }
  }, [processedHtml]);

  if (!result && !error) return null;

  /**
   * 富文本复制功能
   * 支持：text/html 和 text/plain 同时复制
   * 仅复制正文内容（含配图），不包含标题
   * 源码模式下复制纯文本源码
   */
  const handleCopy = async () => {
    if (!result) return;

    try {
      if (showSource) {
        // 源码模式：复制纯文本源码
        await navigator.clipboard.writeText(processedHtml);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }

      // 预览模式：复制富文本
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';

      // 仅使用处理后的HTML（包含配图），不包含标题
      tempDiv.innerHTML = processedHtml;
      document.body.appendChild(tempDiv);

      // 获取HTML和纯文本内容
      const htmlContent = tempDiv.innerHTML;
      const textContent = tempDiv.innerText || tempDiv.textContent || '';

      try {
        // 使用Clipboard API复制富文本（保留格式）
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
          'text/plain': new Blob([textContent], { type: 'text/plain' }),
        });

        await navigator.clipboard.write([clipboardItem]);

        // 清理临时div
        document.body.removeChild(tempDiv);

        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('[复制] Clipboard API失败，尝试降级方案:', err);

        // 降级方案：使用传统方法
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand('copy');
        selection?.removeAllRanges();

        // 清理临时div
        document.body.removeChild(tempDiv);

        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error('[复制] 完全失败:', error);
      alert('复制失败，请手动复制HTML源码');
    }
  };

  /**
   * 保存到公众号草稿箱
   */
  const handleSaveToDraft = async () => {
    if (!result) return;

    // 检查是否已配置公众号信息
    if (!wechatConfig.appid || !wechatConfig.secret) {
      alert('请先配置公众号AppID和Secret');
      setShowConfigModal(true);
      return;
    }

    setIsSaving(true); // 开始保存
    try {
      // 动态导入保存到草稿的API
      const { saveToWechatDraft } = await import('../../services/wechatApi');

      await saveToWechatDraft(
        wechatConfig.appid,
        wechatConfig.secret,
        displayTitle,  // 使用编辑后的标题
        processedHtml,  // 使用编辑后的内容
        result?.images?.[0] || ''  // 传递第一张图片作为封面图
      );

      setSavedToDraft(true);
      setTimeout(() => setSavedToDraft(false), 3000);

      alert('已成功保存到公众号草稿箱！\n\n请登录微信公众平台查看草稿');
    } catch (error: any) {
      console.error('[保存草稿] 失败:', error);
      alert(`保存失败: ${error.message || '未知错误'}\n\n请检查：\n1. AppID和Secret是否正确\n2. 网络连接是否正常\n3. 公众号权限是否足够`);
    } finally {
      setIsSaving(false); // 结束保存
    }
  };

  const handleReset = () => {
    reset();
  };

  // 错误状态
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto mt-6"
      >
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="ml-3 text-lg font-semibold text-red-900">生成失败</h3>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <button onClick={handleReset} className="btn btn-secondary">
            重新尝试
          </button>
        </div>
      </motion.div>
    );
  }

  // 成功状态
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col"
    >
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-mid-gray">
          {processedHtml.length.toLocaleString()} 字符
          {result?.images && result.images.length > 0 && (
            <span className="ml-2 text-mid-gray">
              · {result.images.length} 张配图
              {imageOption === 'ai' && ' (AI生成)'}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm bg-light-gray text-dark rounded-lg hover:bg-light-gray transition-smooth"
          >
            重置
          </button>
          {!isEditMode ? (
            <>
              <button
                onClick={() => setShowSource(!showSource)}
                className={`px-4 py-2 text-sm rounded-lg transition-smooth ${
                  showSource
                    ? 'bg-primary text-white'
                    : 'bg-light-gray text-dark hover:bg-mid-gray/30'
                }`}
              >
                {showSource ? '预览' : '源码'}
              </button>
              <button
                onClick={() => setIsEditMode(true)}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-smooth flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                编辑
              </button>
              <button
                onClick={handleCopy}
                className={`px-4 py-2 text-sm rounded-lg transition-smooth ${
                  copied
                    ? 'bg-primary-active text-white'
                    : 'bg-primary text-white hover:bg-primary-hover'
                }`}
              >
                {copied ? '已复制' : '复制'}
              </button>
              <button
                onClick={handleSaveToDraft}
                disabled={isSaving}
                className={`px-4 py-2 text-sm rounded-lg transition-smooth flex items-center gap-2 ${
                  isSaving
                    ? 'bg-mid-gray text-white cursor-wait'
                    : savedToDraft
                    ? 'bg-primary-active text-white'
                    : 'bg-primary text-white hover:bg-primary-hover'
                }`}
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    保存中...
                  </>
                ) : savedToDraft ? '已保存' : '保存'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setIsEditMode(false);
                  // 取消编辑,恢复原始内容
                  setEditedTitle(result?.title || '');
                  setEditedHtml(result?.html || '');
                  setHasUnsavedChanges(false);
                }}
                className="px-4 py-2 text-sm bg-light-gray text-dark rounded-lg hover:bg-light-gray transition-smooth"
              >
                取消
              </button>
              <button
                onClick={saveEditContent}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-smooth"
              >
                完成
              </button>
            </>
          )}
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-4 py-2 text-sm bg-light-gray text-dark rounded-lg hover:bg-light-gray transition-smooth flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            配置
          </button>
        </div>
      </div>

      {/* 预览区域 */}
      <div className="flex-1 border border-light-gray rounded-lg overflow-hidden bg-white">
        {isEditMode ? (
          // 编辑模式 - 所见即所得富文本编辑器
          <div className="w-full h-full overflow-y-auto p-4">
            <div className="max-w-4xl mx-auto space-y-4">
              {/* 标题编辑 */}
              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  文章标题
                </label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => {
                    setEditedTitle(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-4 py-3 border border-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                  placeholder="输入文章标题..."
                />
              </div>

              {/* 富文本编辑器工具栏 */}
              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  文章内容
                </label>

                {/* 格式化工具栏 */}
                <div className="border border-light-gray border-b-0 rounded-t-lg bg-light p-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => execCommand('bold')}
                    className="px-3 py-1.5 text-sm font-bold bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="加粗"
                  >
                    <strong>B</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => execCommand('italic')}
                    className="px-3 py-1.5 text-sm italic bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="斜体"
                  >
                    <em>I</em>
                  </button>
                  <button
                    type="button"
                    onClick={() => execCommand('underline')}
                    className="px-3 py-1.5 text-sm underline bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="下划线"
                  >
                    <u>U</u>
                  </button>
                  <div className="w-px bg-gray-300 mx-1"></div>
                  <button
                    type="button"
                    onClick={() => execCommand('formatBlock', '<h2>')}
                    className="px-3 py-1.5 text-sm bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="标题"
                  >
                    H2
                  </button>
                  <button
                    type="button"
                    onClick={() => execCommand('formatBlock', '<h3>')}
                    className="px-3 py-1.5 text-sm bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="副标题"
                  >
                    H3
                  </button>
                  <div className="w-px bg-gray-300 mx-1"></div>
                  <button
                    type="button"
                    onClick={() => execCommand('insertUnorderedList')}
                    className="px-3 py-1.5 text-sm bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="无序列表"
                  >
                    • 列表
                  </button>
                  <button
                    type="button"
                    onClick={() => execCommand('insertOrderedList')}
                    className="px-3 py-1.5 text-sm bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="有序列表"
                  >
                    1. 列表
                  </button>
                  <div className="w-px bg-gray-300 mx-1"></div>
                  <button
                    type="button"
                    onClick={() => forceAlign('left')}
                    className="px-3 py-1.5 text-sm bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="左对齐"
                  >
                    ⬅
                  </button>
                  <button
                    type="button"
                    onClick={() => forceAlign('center')}
                    className="px-3 py-1.5 text-sm bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="居中"
                  >
                    ≡
                  </button>
                  <button
                    type="button"
                    onClick={() => forceAlign('right')}
                    className="px-3 py-1.5 text-sm bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="右对齐"
                  >
                    ➡
                  </button>
                  <button
                    type="button"
                    onClick={() => forceAlign('justify')}
                    className="px-3 py-1.5 text-sm bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="两端对齐"
                  >
                    ☰
                  </button>
                  <div className="w-px bg-gray-300 mx-1"></div>
                  <button
                    type="button"
                    onClick={setTextColor}
                    className="px-3 py-1.5 text-sm bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="文字颜色"
                  >
                    <span style={{ color: '#c30503' }}>A</span>
                  </button>
                  <button
                    type="button"
                    onClick={setBackgroundColor}
                    className="px-3 py-1.5 text-sm bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="背景色"
                  >
                    <span style={{ backgroundColor: '#fff5f5', padding: '0 2px' }}>A</span>
                  </button>
                  <button
                    type="button"
                    onClick={insertDivider}
                    className="px-3 py-1.5 text-sm bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="分隔线"
                  >
                    —
                  </button>
                  <div className="w-px bg-gray-300 mx-1"></div>
                  <button
                    type="button"
                    onClick={() => {
                      const url = prompt('请输入链接地址:');
                      if (url) execCommand('createLink', url);
                    }}
                    className="px-3 py-1.5 text-sm bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="插入链接"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => execCommand('removeFormat')}
                    className="px-3 py-1.5 text-sm bg-white border border-light-gray rounded hover:bg-light-gray transition-smooth"
                    title="清除格式"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 可编辑区域 */}
                <div
                  ref={contentEditableRef}
                  contentEditable={true}
                  onInput={handleInput}
                  className="min-h-[500px] max-h-[600px] overflow-y-auto p-4 border border-light-gray border-t-0 rounded-b-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  style={{ scrollbarWidth: 'thin' }}
                  suppressContentEditableWarning={true}
                />
              </div>

              {/* 提示信息 */}
              <div className="bg-light border border-light-gray rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-dark mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-dark mb-1">编辑提示</h4>
                    <ul className="text-xs text-dark space-y-1">
                      <li>• 使用工具栏添加格式:加粗、斜体、标题、列表等</li>
                      <li>• 像编辑Word文档一样直接编辑文本</li>
                      <li>• 点击"完成"按钮保存修改</li>
                      <li>• 点击"取消"按钮放弃修改</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : showSource ? (
          // 源码模式
          <div className="w-full h-full overflow-auto p-4 bg-gray-900">
            <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap break-all">
              {processedHtml}
            </pre>
          </div>
        ) : (
          // 预览模式
          <div
            className="w-full h-full overflow-y-auto overflow-x-hidden p-4"
            style={{
              maxWidth: '677px',
              margin: '0 auto',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", sans-serif',
              fontSize: '16px',
              lineHeight: '1.8',
              color: '#333',
              scrollbarWidth: 'thin',
              scrollbarColor: '#9CA3AF #F3F4F6'
            }}
          >
            {/* 全局样式重置：确保公众号HTML在浏览器中正确显示 */}
            <style>{`
              /* 确保所有内容可见 */
              .preview-content * {
                max-height: none !important;
                overflow: visible !important;
                white-space: normal !important;
                word-wrap: break-word !important;
                word-break: break-word !important;
              }
              /* 保留预格式化文本的样式 */
              .preview-content pre, .preview-content code {
                white-space: pre-wrap !important;
              }
            `}</style>
            <div className="preview-content" ref={previewContentRef}>
            {/* 预览时显示标题 - 轻量样式 */}
            <h1 style={{ fontSize: '20px', fontWeight: '500', marginBottom: '16px', color: '#1f2937' }}>
              {displayTitle}
            </h1>
            <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
            </div>
          </div>
        )}
      </div>

      {/* 公众号配置模态框 */}
      <WechatConfigModal />
    </motion.div>
  );
}
