# toolsAI Backend

AI工具集后端服务，提供文章二创和样式提取功能。

## 技术栈

- **运行时**: Node.js 18+
- **框架**: Express
- **语言**: TypeScript
- **爬虫**: Puppeteer
- **AI**: 通义千问API

## 目录结构

```
backend/
├── src/
│   ├── config/         # 配置文件
│   ├── controllers/    # 控制器
│   ├── services/       # 业务逻辑
│   ├── routes/         # 路由定义
│   ├── types/          # TypeScript类型
│   ├── utils/          # 工具函数
│   └── index.ts        # 入口文件
├── package.json
├── tsconfig.json
└── .env                # 环境变量
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 通义千问API密钥（必填）
DASHSCOPE_API_KEY=your_api_key_here
```

### 3. 启动开发服务器

```bash
npm run dev
```

服务器将运行在 `http://localhost:3001`

### 4. 构建生产版本

```bash
npm run build
npm start
```

## API文档

### POST /api/recreate

一键复刻公众号文章

**请求体**:
```json
{
  "contentUrl": "https://mp.weixin.qq.com/s/xxx",
  "styleUrl": "https://mp.weixin.qq.com/s/yyy",
  "options": {
    "type": "expand",
    "style": "casual",
    "targetLength": 2000
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "html": "<section>...</section>",
    "title": "二创后的标题",
    "summary": "已扩展至2000字",
    "meta": {
      "processingTime": 45000,
      "tokensUsed": 2500
    }
  }
}
```

### GET /api/health

健康检查

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-02-07T13:00:00.000Z"
  }
}
```

## 开发指南

### 添加新服务

在 `src/services/` 创建新服务类：

```typescript
export class NewService {
  async doSomething() {
    // 业务逻辑
  }
}

export const newService = new NewService();
```

### 添加新API

1. 在 `src/controllers/` 添加控制器函数
2. 在 `src/routes/` 注册路由
3. 在 `src/types/` 添加类型定义

## 依赖说明

### Puppeteer

用于爬取动态网页内容，特别是微信公众号文章。

### Cheerio

用于解析和操作HTML，提取样式和内容。

### 通义千问API

阿里云的大语言模型API，用于文章二创。

## 注意事项

1. **API密钥**: 确保正确配置通义千问API密钥
2. **爬虫限制**: 添加适当延迟避免被反爬
3. **错误处理**: 所有异步操作都应包含错误处理
4. **内存管理**: 使用完毕后关闭浏览器实例

## 故障排除

### Puppeteer安装失败

```bash
# 跳过Chromium下载
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install puppeteer
```

### 通义千问API调用失败

检查：
1. API密钥是否正确
2. 网络连接是否正常
3. API余额是否充足

## 许可证

MIT
