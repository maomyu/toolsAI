# 无配图模式下 AI 二创完整流程

## 一、整体数据流

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   用户输入   │ → │   预处理    │ → │  生成标题   │ → │  样式分析   │ → │  AI二创    │
│  URL/文本   │    │  HTML转换   │    │  5选1爆款   │    │  6大组件    │    │  内容生成   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                  ↓
                                                          ┌─────────────┐
                                                          │  清理输出   │
                                                          │  最终HTML   │
                                                          └─────────────┘
```

---

## 二、详细步骤分解

### Step 1: 输入预处理

**入口文件**: `backend/src/controllers/recreateController.ts:176-204`

#### 1.1 URL 模式（爬取公众号文章）

```typescript
const crawlResult = await crawlerService.crawlWechatArticle(contentUrl);
// 返回: { html, title, images, imageContexts, segments }
```

**爬取流程**:
1. Puppeteer 启动无头浏览器
2. 访问微信文章 URL，等待页面加载
3. 提取正文 HTML 结构
4. 收集所有图片 URL 及其上下文
5. 将文章分段（用于后续处理）

#### 1.2 粘贴模式（用户直接输入文本）

```typescript
const preprocessResult = preprocessText(contentText);
// 返回: { html, title: "用户提供的文章", images: [], segments }
```

**预处理逻辑**:

| 处理项 | 说明 |
|--------|------|
| 换行符统一 | `\r\n` → `\n` |
| Markdown 标题识别 | `# / ## / ###` → `<h1>/<h2>/<h3>` |
| Markdown 列表识别 | `- / * / 1.` → `<ul>/<ol>` |
| Markdown 引用识别 | `>` → `<blockquote>` |
| Markdown 表格识别 | `｜` 分隔 → `<table>` |
| 短句合并 | 多个短句合并为完整段落 |
| HTML 转换 | 生成结构化 HTML |

---

### Step 2: 生成爆款标题

**入口函数**: `AIService.ts:generateTitleOptions()`

```typescript
const titleOptions = await generateTitleOptions(contentHtml, 5);
const finalTitle = titleOptions[0]; // 选择第一个
```

#### 2.1 标题生成 Prompt 设计

**系统提示词**:
```
你是专业的公众号标题大师，擅长创作吸引眼球、激发点击欲望的爆款标题。
```

**用户提示词**:
```
请根据以下文章内容，生成5个爆款标题选项。

文章内容摘要：
{从HTML提取的前800字纯文本}

要求：
1. 标题长度15-25字
2. 使用数字、疑问句、悬念等技巧
3. 避免标题党，保持内容相关性
4. 适合公众号传播特性
```

#### 2.2 API 调用参数

| 参数 | 值 | 说明 |
|------|-----|------|
| model | qwen-plus | 通义千问模型 |
| temperature | 0.8 | 高创造性 |
| max_tokens | 500 | 足够生成5个标题 |

---

### Step 3: 样式参考获取（无配图模式专属）

**入口文件**: `recreateController.ts:206-240`

无配图模式下，需要从外部链接获取样式参考：

```typescript
// 用户可选择提供样式参考链接，或使用默认链接
const finalStyleUrl = styleUrl || DEFAULT_STYLE_REFERENCE_URL;

// 爬取样式参考文章
const styleResult = await crawlerService.crawlWechatStyle(finalStyleUrl);
// 返回: { fullHtml, css, images }
```

**与有配图模式的区别**:

| 模式 | 样式来源 | 图片处理 |
|------|----------|----------|
| **无配图** | 外部样式链接的 AI 分析 | 不传递图片上下文 |
| **有配图** | 原文 HTML 的完整复制 | 传递 `imageContexts` 给 AI |

---

### Step 4: 样式分析与规则提取

**入口函数**: `AIService.ts:analyzeStyleWithAI()`

#### 4.1 AI 分析参考 HTML

**系统提示词**:
```
你是专业的微信公众号样式分析专家。
分析参考HTML，提取可复用的样式规则。
```

**用户提示词**:
```
请分析以下微信公众号文章的HTML结构和样式：

{referenceHtml}

请提取以下6大样式组件，输出JSON格式：
1. mainTitle: 主标题样式（彩色背景块）
2. subTitle: 副标题样式（左边框装饰）
3. paragraph: 正文样式（字体、行高、颜色）
4. emphasis: 强调文字样式
5. decoration: 装饰元素（分割线、引用块）
6. container: 容器样式
```

#### 4.2 样式提取结果结构

```typescript
interface AbstractStyleRules {
  mainTitle: {
    backgroundColor: string;
    color: string;
    padding: string;
    fontSize: string;
    fontWeight: string;
    textAlign: string;
    borderRadius: string;
    marginBottom: string;
  };
  subTitle: {
    borderLeft: string;
    paddingLeft: string;
    color: string;
    fontSize: string;
    fontWeight: string;
    marginBottom: string;
  };
  paragraph: {
    fontSize: string;
    lineHeight: string;
    color: string;
    marginBottom: string;
    textAlign: string;
  };
  emphasis: {
    color: string;
    fontWeight: string;
    backgroundColor: string;
    padding: string;
  };
  decoration: {
    dividerColor: string;
    dividerStyle: string;
    blockquoteStyle: string;
  };
  container: {
    padding: string;
    maxWidth: string;
    backgroundColor: string;
  };
  themeColor: string;
}
```

#### 4.3 备选方案（正则表达式提取）

如果 AI 分析失败，使用 `extractAbstractStyleRules()` 正则提取：

```typescript
// 从 style 属性中提取关键样式
const styleRegex = /style="([^"]*)"/g;
// 解析并归类到6大组件
```

---

### Step 5: AI 二创核心逻辑

**入口函数**: `AIService.ts:recreateContentWithAbstractStyle()`

这是无配图模式最核心的函数，分为以下子步骤：

#### 5.1 代码块预处理

**目的**: 保护代码块不被 AI 修改

```typescript
// 1. 提取代码块，用占位符替代
const codeBlocks: string[] = [];
let processedHtml = originalHtml;

// 识别三种代码格式
const patterns = {
  // 微信专用格式
  wechat: /<section[^>]*><span[^>]*><pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre><\/span><\/section>/g,
  // 标准格式
  standard: /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/g,
  // 行内代码（长于50字符或有换行）
  inline: /<code[^>]*>([^<]{50,}|\n[^<]*)<\/code>/g
};

// 替换为占位符
processedHtml = processedHtml.replace(patterns.wechat, (match) => {
  codeBlocks.push(match);
  return `[CODE_BLOCK_${codeBlocks.length - 1}]`;
});
```

#### 5.2 目标字数计算

**基于纯文本长度（非 HTML 长度）**:

```typescript
const plainTextLength = extractPlainText(originalHtml).length;

const multipliers = {
  expand: { min: 1.2, max: 1.5 },    // 扩写模式
  condense: { min: 0.6, max: 0.8 },  // 缩写模式
  refactor: { min: 0.8, max: 1.2 }   // 重写模式
};

// 自由度≥9时，严格保持95%-105%长度
if (creativityLevel >= 9) {
  targetMin = Math.floor(plainTextLength * 0.95);
  targetMax = Math.ceil(plainTextLength * 1.05);
}
```

#### 5.3 动态相似度控制

```typescript
const similarityTarget =
  creativityLevel <= 3 ? '50%' :
  creativityLevel <= 5 ? '60%' :
  creativityLevel <= 7 ? '70%' : '90%';
```

| 自由度 | 相似度 | 说明 |
|--------|--------|------|
| 1-3 | 50% | 大幅改写，保留核心信息 |
| 4-5 | 60% | 中等改写 |
| 6-7 | 70% | 轻度改写 |
| 8-10 | 90% | 高度还原 |

#### 5.4 样式示例提取

```typescript
function extractStyleExamples(referenceHtml: string): string {
  // 从参考HTML中提取带style属性的元素示例
  // 供AI直接复制使用
  return `
主标题示例: <section style="background: #FF6B6B; color: white; padding: 15px; text-align: center;">
副标题示例: <section style="border-left: 4px solid #FF6B6B; padding-left: 12px;">
正文示例: <p style="font-size: 16px; line-height: 1.8; color: #333;">
强调示例: <strong style="color: #FF6B6B; background: rgba(255,107,107,0.1);">
  `;
}
```

#### 5.5 AI 提示词构建

**系统提示词（核心分离原则）**:

```
你是专业的内容创作专家，擅长进行高质量的内容二创。

【核心原则】
1. 100%精确复刻参考HTML的视觉样式
2. 不要模仿参考HTML的内容结构（标题数量、段落划分等）
3. 直接复制style属性，不要自己编写CSS
4. 严格遵循原文的信息点和逻辑结构

【禁止事项】
- 不要改变原文的核心观点和数据
- 不要添加原文没有的信息
- 不要使用markdown格式
- 不要输出前言或说明文字
```

**用户提示词结构**:

```
## 参考样式示例
{extractStyleExamples() 提取的样式示例}

## 原文内容（目标字数：{targetMin}-{targetMax}）
标题：{newTitle}
内容：
{originalText}

## 二创参数
- 二创类型：{recreateType} (expand/condense/refactor)
- 自由度：{creativityLevel}/10
- 相似度目标：{similarityTarget}

## ⚠️ 再次强调
1. 根据原文内容智能决定小标题数量，不要参考样式示例的标题数量
2. 把样式规则100%应用到输出HTML中
3. 保持原文核心信息和逻辑不变

## 执行步骤
1. 分析原文：提取关键信息点和逻辑结构
2. 二创内容：用{similarityTarget}相似度改写每个段落
3. 应用样式：把样式规则应用到HTML标签的style属性
4. 输出HTML：使用 section/div/p/strong 标签，直接输出，不要代码块包裹
```

#### 5.6 AI 调用参数

```typescript
const response = await dashscope.chat({
  model: 'qwen-plus',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  temperature: 1.1 - creativityLevel * 0.1,  // 0.1-1.0 动态调整
  max_tokens: 8000,
  top_p: 0.9
});
```

| 自由度 | Temperature | 说明 |
|--------|-------------|------|
| 1 | 1.0 | 最高创造性 |
| 5 | 0.6 | 平衡 |
| 10 | 0.1 | 最高稳定性 |

---

### Step 6: 后处理与清理

**入口函数**: `cleanGeneratedHTML()`

#### 6.1 清理流程

```typescript
function cleanGeneratedHTML(html: string): string {
  let result = html;

  // 1. 移除 markdown 代码块标记
  result = result.replace(/```html\n?/g, '');
  result = result.replace(/```\n?/g, '');

  // 2. 移除 AI 前言说明
  result = result.replace(/^(这是|以下是|根据|基于).*?\n\n/s, '');

  // 3. 清理多余空白
  result = result.trim();

  // 4. 确保根元素是 section
  if (!result.startsWith('<section')) {
    result = `<section>${result}</section>`;
  }

  return result;
}
```

#### 6.2 代码块恢复

```typescript
// 恢复代码块占位符，应用微信深色主题样式
let finalHtml = cleanedHtml;

codeBlocks.forEach((codeBlock, index) => {
  // 应用微信专用深色主题
  const styledCodeBlock = codeBlock.replace(
    /<code([^>]*)>/,
    '<code$1 style="background: #1e1e1e; color: #d4d4d4; display: block; padding: 16px; border-radius: 8px; overflow-x: auto; font-family: Consolas, Monaco, monospace;">'
  );

  finalHtml = finalHtml.replace(`[CODE_BLOCK_${index}]`, styledCodeBlock);
});
```

---

## 三、无配图 vs 有配图模式对比

| 特性 | 无配图模式 | 有配图模式 |
|------|------------|------------|
| **样式来源** | 外部样式链接的 AI 分析 | 原文 HTML 的完整复制 |
| **图片处理** | 不传递图片上下文 | 传递 `imageContexts` 给 AI |
| **占位符** | 无 `[IMG_N]` 占位符 | 在语义位置插入 `[IMG_N]` |
| **二创策略** | 抽象样式迁移 | 保持原文样式结构 |
| **适用场景** | 纯文字文章、技术教程 | 图文并茂的原创文章 |

---

## 四、关键文件索引

| 文件 | 职责 |
|------|------|
| `backend/src/controllers/recreateController.ts` | API 入口，流程编排 |
| `backend/src/services/AIService.ts` | AI 调用、Prompt 构建、样式分析 |
| `backend/src/services/CrawlerService.ts` | 公众号爬取、样式参考获取 |
| `backend/src/types/index.ts` | 类型定义 |

---

## 五、设计精髓总结

1. **内容与样式分离**: AI 专注内容二创，样式通过规则提取实现精确复刻
2. **动态参数调节**: 自由度、温度、相似度三者联动，实现可控的创作
3. **代码块保护**: 预处理提取 → 占位符替换 → 后处理恢复，确保技术内容不被篡改
4. **Prompt 工程**: 核心分离原则（100%复制样式 + 100%遵循原文逻辑）是整个系统的灵魂
