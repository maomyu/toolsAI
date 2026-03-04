-- ============================================================
-- 添加订阅过期时间字段
-- [INPUT]: 依赖 profiles 表
-- [OUTPUT]: 支持订阅有效期管理
-- [POS]: 数据库迁移脚本，Supabase PostgreSQL
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-- ============================================================

-- 添加订阅过期时间字段
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_expires
ON profiles(subscription_expires_at);

-- 添加注释
COMMENT ON COLUMN profiles.subscription_expires_at IS '订阅过期时间，用于续费堆叠计算';
