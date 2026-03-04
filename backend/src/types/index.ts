/**
 * [INPUT]: 无依赖
 * [OUTPUT]: 对外提供TypeScript类型定义
 * [POS]: types类型定义模块，被所有模块使用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// ============================================================================
// 装饰描述符（用数据结构描述装饰，替代枚举）
// 核心思想：AI自主发现，四方向边框全覆盖
// ============================================================================
export interface DecorationDescriptor {
  name: string;           // AI自命名：'left-red-bar', 'glowing-edge'
  position: 'left' | 'right' | 'top' | 'bottom' | 'background' | 'custom';
  fullStyle: string;      // 完整style字符串
  cssProperties?: {
    borderLeft?: string;
    borderRight?: string;  // 【新增】右边框
    borderTop?: string;    // 【新增】顶部边框
    borderBottom?: string;
    backgroundColor?: string;
    boxShadow?: string;    // 阴影装饰
    background?: string;   // 渐变背景
  };
  htmlExample: string;     // 完整HTML示例（供AI复制）
}

// ============================================================================
// 组件描述符（AI自主发现的样式组件）
// ============================================================================
export interface ComponentDescriptor {
  name: string;           // AI自命名：'fancy-title', 'quote-block'
  role?: string;          // 可选角色：'mainTitle', 'subTitle', 'paragraph'
  fullStyle: string;      // 完整style字符串
  htmlExample: string;     // 完整HTML示例
}

// ============================================================================
// 抽象样式规则（只包含视觉属性，不包含HTML结构）
// 用于样式迁移模式：学习参考样式的视觉特征，应用到原文内容结构
// ============================================================================
export interface AbstractStyleRules {
  // 主标题样式（如：彩色背景块标题）
  mainTitle: {
    fontSize: string;
    color: string;
    backgroundColor?: string;  // 彩色背景
    textAlign?: string;
    padding?: string;
    borderRadius?: string;
    fontWeight?: string;
    margin?: string;           // 外边距
    fullStyle?: string;        // 完整的 style 字符串
    decorationType: string;    // 改为 string，开放扩展
    decorations?: DecorationDescriptor[];  // 【新增】装饰描述符数组
  };

  // 副标题样式（如：左边框标题）
  subTitle: {
    fontSize: string;
    color: string;
    borderLeft?: string;       // 左边框完整样式
    borderLeftColor?: string;  // 左边框颜色
    borderRight?: string;      // 【新增】右边框完整样式
    borderRightColor?: string; // 【新增】右边框颜色
    fontWeight?: string;
    padding?: string;
    textAlign?: string;
    margin?: string;           // 外边距
    fullStyle?: string;        // 完整的 style 字符串
    decorationType: string;    // 改为 string，开放扩展
    decorations?: DecorationDescriptor[];  // 【新增】装饰描述符数组
  };

  // 容器样式（保留向后兼容）
  container: {
    textAlign?: string;     // 对齐方式：'center' | 'left' | 'justify'
    maxWidth?: string;      // 最大宽度
    backgroundColor?: string; // 背景色
    padding?: string;       // 内边距
    fullStyle?: string;     // 【新增】完整的 style 字符串
  };

  // 标题样式（保留向后兼容，用于旧代码）
  heading: {
    fontSize: string;       // 字体大小：'18px'
    fontWeight?: string;    // 字体粗细：'bold' | '700'
    color?: string;         // 文字颜色：'#333'
    textAlign?: string;     // 对齐方式：'center' | 'left'
    marginBottom?: string;  // 下边距：'15px'
    decoration?: string;    // 改为 string，开放扩展
    decorationColor?: string; // 装饰颜色
  };

  // 正文样式
  paragraph: {
    fontSize?: string;      // 字体大小：'15px'
    lineHeight?: string;    // 行高：'1.75' | '2em'
    color?: string;         // 文字颜色：'#3f3f3f'
    letterSpacing?: string; // 字间距：'0.5px'
    textAlign?: string;     // 对齐方式：'justify' | 'left'
    margin?: string;        // 段落间距：'10px 0'
    textIndent?: string;    // 首行缩进：'2em'
    fullStyle?: string;     // 【新增】完整的 style 字符串
  };

  // 强调样式（用于重点内容）
  emphasis: {
    color?: string;         // 高亮颜色：'#ff6b6b'
    fontWeight?: string;    // 字体粗细
    backgroundColor?: string; // 背景色
    fullStyle?: string;     // 完整的 style 字符串
  };

  // 引用/金句样式
  quote?: {
    fontSize?: string;      // 字体大小
    color?: string;         // 文字颜色
    fontStyle?: string;     // 字体样式：'italic'
    borderLeft?: string;    // 左边框
    padding?: string;       // 内边距
    backgroundColor?: string; // 背景色
    fullStyle?: string;     // 完整的 style 字符串
  };

  // 装饰元素配置（扩展为更详细的结构）
  decoration?: {
    type?: string;          // 改为 string，开放扩展
    color?: string;         // 装饰主色
    style?: string;         // 具体样式字符串
    // 【核心改动】动态装饰数组（AI自主发现）
    elements?: DecorationDescriptor[];  // 所有装饰元素
    dividers?: DecorationDescriptor[];  // 分割线（可多种样式）
    quoteBlocks?: DecorationDescriptor[];  // 引用块
    // 【向后兼容】保留旧字段
    divider?: {
      fullStyle?: string;
      color?: string;
    };
    quoteBlock?: {
      fullStyle?: string;
      backgroundColor?: string;
      borderLeft?: string;
    };
  };

  // 【新增】AI发现的组件列表
  components?: ComponentDescriptor[];

  // 主题色（用于强调和装饰的默认颜色）
  themeColor?: string;

  // 整体风格描述
  styleDescription?: string; // 如：'简约清新' | '商务专业' | '文艺复古'
}

// 图片上下文信息
export interface ImageContext {
  url: string;
  beforeText: string;  // 图片前的文字片段（50字）
  afterText: string;   // 图片后的文字片段（50字）
  index: number;       // 图片在原文中的顺序
  mediaType?: 'image' | 'gif' | 'video';  // 媒体类型
}

// 内容片段（用于分阶段二创）
export interface ContentSegment {
  type: 'text' | 'image' | 'gif' | 'video';
  content: string;   // 文本内容或媒体URL
  index: number;     // 在原文中的顺序
}

// 爬虫结果
export interface CrawlerResult {
  html: string;
  title: string;
  images: string[];
  imageContexts: ImageContext[];  // 图片位置上下文
  segments: ContentSegment[];     // 分割后的内容片段（用于分阶段二创）
  author: string;
  publishTime: Date;
}

// AI二创选项
export interface RecreateOptions {
  type: 'expand' | 'condense' | 'refactor';
  style: 'formal' | 'casual' | 'professional';
  targetLength?: number;
  useAIImages?: boolean; // 是否使用AI自动配图
  aiImageCount?: number; // AI配图数量，默认3张
}

// AI二创结果
export interface RecreateResult {
  title: string;
  content: string;
  summary: string;
}

// ============================================================================
// HTML 模板（可直接使用的样式模板）
// 用于第二阶段：从"描述性"改为"模板化"
// ============================================================================
export interface HtmlTemplates {
  // 主标题模板（包含完整装饰）
  mainTitleTemplate: string;
  // 副标题模板（包含边框装饰）
  subTitleTemplate: string;
  // 段落模板
  paragraphTemplate: string;
  // 引用块模板（用于突出重要观点）
  quoteTemplate: string;
  // 分割线模板
  dividerTemplate: string;
  // 强调文字模板
  emphasisTemplate: string;
  // 主题色
  themeColor: string;
}

// 样式提取结果
export interface StyleResult {
  css: string;
  htmlTemplate: string;
  images: string[];
}

// 最终生成结果
export interface GenerateResult {
  html: string;
  title: string;
  summary: string;
  images: string[]; // 图片URL数组
  imageContexts?: ImageContext[]; // 图片上下文信息（用于智能插入）
  source?: string; // 来源URL（合规声明）
  disclaimer?: string; // 免责声明（合规要求）
  meta: {
    processingTime: number;
    tokensUsed: number;
  };
}

// API请求体
export interface RecreateRequest {
  contentUrl?: string; // 可选：内容URL链接
  contentText?: string; // 可选：直接粘贴的文本内容
  styleUrl?: string; // 样式参考链接（可选）
  options?: RecreateOptions;
  imageOption?: 'none' | 'ai'; // 配图方式：无配图 或 AI配图
  aiImageCount?: number; // AI配图数量
  creativityLevel?: number; // 改写自由度 1-10
}

// API响应
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
