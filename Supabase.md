
## Supabase 集成：从零实现 Google 登录

> 把我当傻子，一步步教我连接 Supabase 并实现 Google OAuth 登录。假设我从未用过 Supabase，从注册账号开始讲起。

---

### 第一阶段：Supabase 项目创建

#### 1.1 注册 & 创建项目
- 访问 https://supabase.com 注册账号
- 点击 "New Project"
- 填写 Project Name、Database Password（务必保存）
- Region 选择离用户最近的节点
- 等待 2 分钟初始化完成

#### 1.2 获取 API 凭证
进入 Project Settings → API，复制以下两个值：
- `Project URL`（格式：https://xxxxx.supabase.co）
- `anon public key`（以 eyJ 开头的长字符串）

---

### 第二阶段：前端项目配置

#### 2.1 安装 Supabase 客户端
```bash
npm install @supabase/supabase-js
```

#### 2.2 创建环境变量文件
在项目根目录创建 `.env`：
```env
VITE_SUPABASE_URL=你的_Project_URL
VITE_SUPABASE_ANON_KEY=你的_anon_public_key
```


#### 2.3 初始化 Supabase 客户端
创建 `src/lib/supabase.js`：
```javascript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

---

### 第三阶段：Google Cloud Console 配置

#### 3.1 创建 OAuth 凭证
- 访问 https://console.cloud.google.com
- 创建新项目或选择已有项目
- 进入 APIs & Services → Credentials
- 点击 "Create Credentials" → "OAuth client ID"
- Application type 选择 "Web application"

#### 3.2 配置授权域名
在 OAuth 客户端设置中添加：
```
Authorized JavaScript origins:
  - http://localhost:5173（本地开发）
  - https://你的生产域名

Authorized redirect URIs:
  - https://你的Project_URL.supabase.co/auth/v1/callback
```

#### 3.3 复制凭证
保存生成的：
- `Client ID`
- `Client Secret`

---

### 第四阶段：Supabase 后台配置 Google Provider

#### 4.1 启用 Google 登录
- 回到 Supabase Dashboard
- 进入 Authentication → Providers
- 找到 Google，点击启用
- 填入刚才获取的 Client ID 和 Client Secret
- 保存

#### 4.2 配置重定向 URL
进入 Authentication → URL Configuration：
```
Site URL: http://localhost:5173（开发环境）
Redirect URLs: 
  - http://localhost:5173
  - https://你的生产域名
```

---

### 第五阶段：前端登录逻辑实现

#### 5.1 创建 Auth 工具函数
创建 `src/lib/auth.js`：
```javascript
import { supabase } from './supabase'

// Google 登录
export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  })
  if (error) console.error('登录失败:', error.message)
  return { data, error }
}

// 登出
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) console.error('登出失败:', error.message)
  return { error }
}

// 获取当前用户
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
```

#### 5.2 创建 Auth Context（全局状态）
创建 `src/contexts/AuthContext.jsx`：
```javascript
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 获取初始会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // 监听登录状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

#### 5.3 包裹 App
修改 `src/main.jsx`：
```javascript
import { AuthProvider } from './contexts/AuthContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
)
```

---

### 第六阶段：登录组件实现（完全用我的设计系统实现）

在header制作登录按钮，点击后弹出登录modal。

```

---

### 检查清单

| 步骤 | 验证方式 |
|------|----------|
| Supabase 项目创建 | Dashboard 可访问 |
| 环境变量配置 | `console.log(import.meta.env.VITE_SUPABASE_URL)` 有输出 |
| Google Cloud 配置 | OAuth 凭证状态为"已启用" |
| Supabase Google Provider | Provider 状态显示绿色 |
| 前端登录测试 | 点击按钮能跳转 Google 授权页 |
| 登录回调 | 授权后能正确返回应用并显示用户信息 |

---

### 常见踩坑

| 问题 | 解决方案 |
|------|----------|
| 登录后白屏 | 检查 Redirect URL 是否包含当前域名 |
| 无限重定向 | Site URL 与实际访问地址不一致 |
| CORS 错误 | Authorized JavaScript origins 未添加当前域名 |
| 用户信息为空 | 使用 `user.user_metadata` 而非 `user.email` |

教导我一步步完成，成功实现登录后等待下一步指令。

---

### GEB 分形文档检查

完成 Supabase 集成后，**必须执行**以下文档同步：

```
L3 检查 → 新创建的文件（supabase.js, auth.js, AuthContext.jsx）头部是否添加 [INPUT]/[OUTPUT]/[POS] 注释？
L2 检查 → lib/CLAUDE.md 和 contexts/CLAUDE.md 是否记录新增文件？
L1 检查 → 项目根目录 CLAUDE.md 是否更新技术栈（添加 Supabase）和目录说明？
```

确保代码与文档同构，完成后等待下一步指令。
