# toolsAI - AI工具集

> 用AI技术提升各行各业工作效率，打造最实用的AI工具集

## 项目简介

toolsAI 是一个个人AI工具作品集网站，展示如何利用AI技术提升各行各业工作效率。核心功能包括「一键复刻公众号」和「内容工厂」。

## 功能特性

### 🔄 一键复刻公众号
通过AI二创文章+智能排版，帮助内容创作者快速生成高质量公众号文章。

### 🏭 内容工厂
- **选题分析**：输入关键词，分析公众号热门文章
- **搜一搜**：实时搜索公众号文章，支持时间范围和排序筛选
- **内容创作**：基于分析结果创作新文章（开发中）

## 技术栈

### 前端
- React 18 + TypeScript
- Vite + Tailwind CSS
- Zustand 状态管理

### 后端
- Node.js 18+ / Express
- TypeScript
- SQLite (better-sqlite3)
- Puppeteer 爬虫
- 通义千问 API

## 快速开始

### 前置要求

- Node.js 18+
- npm 或 yarn

### 1. 克隆项目

```bash
git clone https://github.com/maomyu/toolsAI.git
cd toolsAI
```

### 2. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 3. 配置环境变量

后端环境变量（可选）：

```bash
cd backend
cp .env.example .env
```

`.env` 文件默认配置即可，无需修改。

### 4. 启动服务

**启动后端**（在 backend 目录）：

```bash
npm run dev
```

后端将运行在 `http://localhost:3001`

> 首次启动会自动创建 SQLite 数据库文件 `backend/data/factory.db`

**启动前端**（在 frontend 目录）：

```bash
npm run dev
```

前端将运行在 `http://localhost:5173`

### 5. 配置 API Key

打开浏览器访问 `http://localhost:5173/factory/settings`，在「系统设置」页面配置：

1. **通义千问 API Key**：用于 AI 内容生成和选题分析
   - 获取地址：[阿里云百炼控制台](https://bailian.console.aliyun.com/)

2. **极致数据 API Key**：用于获取公众号文章数据（阅读量、点赞数等）
   - 获取地址：[大家查](https://www.dajiala.com/)

## 使用指南

### 一键复刻公众号

访问 `http://localhost:5173/tools/wechat`

1. 输入**内容链接**（需要二创的文章）
2. 输入**样式链接**（排版参考的文章）
3. 选择二创类型和写作风格
4. 点击「一键生成」，等待 30-60 秒
5. 复制 HTML，粘贴到微信公众号编辑器

### 内容工厂 - 选题分析

访问 `http://localhost:5173/factory/analysis`

1. 点击「搜一搜」Tab
2. 输入关键词（如「AI」「副业」）
3. 选择时间范围和排序方式
4. 点击搜索，查看热门文章列表
5. 分析文章数据（阅读量、点赞数等）

## 项目结构

```
toolsAI/
├── frontend/              # 前端项目
│   ├── src/
│   │   ├── components/   # UI组件
│   │   ├── pages/        # 页面
│   │   ├── store/        # Zustand状态管理
│   │   └── services/     # API调用
├── backend/              # 后端项目
│   ├── src/
│   │   ├── controllers/  # API控制器
│   │   ├── services/     # 业务逻辑
│   │   ├── routes/       # 路由定义
│   │   └── models/       # 数据库模型
│   └── data/             # SQLite数据库文件（自动创建）
└── README.md
```

## API 接口

| Method | Path | 描述 |
|--------|------|------|
| POST | `/api/recreate` | 一键复刻公众号文章 |
| POST | `/api/factory/search` | 搜索公众号文章 |
| GET | `/api/factory/settings` | 获取系统设置 |
| POST | `/api/factory/settings` | 更新系统设置 |

## 开发命令

```bash
# 前端
cd frontend
npm run dev        # 开发服务器
npm run build      # 构建生产版本

# 后端
cd backend
npm run dev        # 开发服务器（热重载）
npm run build      # 编译 TypeScript
npm start          # 生产模式
```

## 许可证

MIT License

**免责声明**：
- 本项目仅供学习交流使用，不得用于商业用途
- 使用本项目所涉及的 API 服务需遵守相关平台的服务条款
- 爬取公众号文章内容请遵守相关法律法规，尊重原创者版权
- 因使用本项目产生的任何问题，作者不承担相关责任
