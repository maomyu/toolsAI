# toolsAI - AI工具集

> 用AI技术提升各行各业工作效率，打造最实用的AI工具集

## 项目简介

toolsAI 是一个个人AI工具作品集网站，展示如何利用AI技术提升各行各业工作效率。首个功能为"一键复刻公众号"，通过AI二创文章+智能排版，帮助内容创作者快速生成高质量公众号文章。

## 项目特点

- ✨ **AI驱动**: 使用通义千问大模型进行智能内容二创
- 🎨 **Apple风格**: 现代化、丝滑的用户体验
- ⚡ **高效快捷**: 60秒完成文章二创+排版，效率提升10倍
- 🎯 **精准智能**: 深度理解内容，生成高质量二创文章

## 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **构建**: Vite
- **样式**: Tailwind CSS
- **动画**: Framer Motion
- **路由**: React Router

### 后端
- **运行时**: Node.js 18+
- **框架**: Express
- **语言**: TypeScript
- **爬虫**: Puppeteer
- **AI**: 通义千问API

## 项目结构

```
toolsAI/
├── frontend/              # 前端项目
│   ├── src/
│   │   ├── components/   # 组件
│   │   │   ├── layout/  # 布局组件
│   │   │   └── ui/      # UI组件
│   │   ├── pages/        # 页面
│   │   ├── store/        # 状态管理
│   │   ├── services/     # API服务
│   │   ├── lib/          # 工具函数
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend/              # 后端项目
│   ├── src/
│   │   ├── config/       # 配置
│   │   ├── controllers/  # 控制器
│   │   ├── services/     # 业务逻辑
│   │   ├── routes/       # 路由
│   │   ├── types/        # 类型定义
│   │   └── index.ts      # 入口文件
│   ├── package.json
│   └── tsconfig.json
├── PRD.md                # 产品需求文档
└── README.md             # 本文件
```

## 快速开始

### 前置要求

- Node.js 18+
- npm 或 yarn

### 1. 克隆项目

```bash
git clone <repository-url>
cd toolsAI
```

### 2. 安装依赖

```bash
# 安装前端依赖
cd frontend
npm install

# 安装后端依赖
cd ../backend
npm install
```

### 3. 配置环境变量

进入后端目录，复制并配置环境变量：

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，填写通义千问API密钥：

```env
DASHSCOPE_API_KEY=your_api_key_here
```

### 4. 启动服务

**启动后端**（在 backend 目录）:

```bash
npm run dev
```

后端将运行在 `http://localhost:3001`

**启动前端**（在 frontend 目录）:

```bash
npm run dev
```

前端将运行在 `http://localhost:5173`

### 5. 访问应用

打开浏览器访问 `http://localhost:5173`

## 核心功能

### 一键复刻公众号

输入两个链接：
1. **内容链接**: 需要二创的文章
2. **样式链接**: 排版参考的文章

系统自动完成：
- 🕷️ 爬取文章内容和样式
- 🤖 AI智能二创文章
- 🎨 提取并应用样式
- 📋 生成可直接粘贴的HTML

## 使用教程

### 1️⃣ 访问工具页面

打开浏览器访问：`http://localhost:5173/tools/wechat`

### 2️⃣ 输入链接

- **内容来源链接**: 粘贴需要进行二创的公众号文章链接
- **样式参考链接**: 粘贴排版样式参考的公众号文章链接

### 3️⃣ 选择选项

- **二创类型**:
  - `扩展内容`: 在原有基础上增加细节和说明
  - `精简内容`: 提炼核心观点，缩短篇幅
  - `重构表达`: 保持原意，换种表达方式

- **写作风格**:
  - `轻松活泼`: 适合日常分享
  - `正式专业`: 适合商务场景
  - `权威深度`: 适合专业分析

### 4️⃣ 生成文章

点击"✨ 一键生成"按钮，等待30-60秒：

1. 🕷️ 爬取文章内容和样式
2. 🤖 AI进行智能二创
3. 🎨 提取并应用样式
4. 📋 生成可直接粘贴的HTML

### 5️⃣ 复制使用

- 点击"📋 复制HTML"按钮
- 打开微信公众号编辑器
- 直接粘贴（Ctrl+V / Cmd+V）
- 完成发布！

## 开发指南

### 前端开发

```bash
cd frontend
npm run dev        # 开发服务器
npm run build      # 构建生产版本
npm run preview    # 预览构建结果
```

### 后端开发

```bash
cd backend
npm run dev        # 开发服务器（热重载）
npm run build      # 编译TypeScript
npm start          # 启动生产服务器
```

### 添加新功能

1. 在 `PRD.md` 中定义需求
2. 在 `backend/src/services/` 添加业务逻辑
3. 在 `backend/src/controllers/` 添加API端点
4. 在 `frontend/src/pages/` 创建前端页面
5. 在 `frontend/src/components/` 添加UI组件

## API文档

### POST /api/recreate

一键复刻公众号文章

**请求**:
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

## 未来规划

- [ ] AI小红书笔记生成器
- [ ] AI文档总结器
- [ ] AI金句提取器
- [ ] AI竞品分析报告
- [ ] 用户系统和历史记录
- [ ] 更多AI工具...

## 贡献指南

本项目为个人作品集，暂不接受外部贡献。

## 许可证

MIT License

## 联系方式

- 📧 Email: contact@example.com
- 💬 微信: your-wechat-id
- 🌐 GitHub: [your-github]

---

**注意**: 本项目仅用于技术展示，请勿用于商业用途。使用时请遵守相关法律法规和平台服务条款。
