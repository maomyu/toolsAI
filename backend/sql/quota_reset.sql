-- ============================================================
-- 配额月度重置字段
-- [INPUT]: 依赖 profiles 表
-- [OUTPUT]: 支持月度配额重置
-- [POS]: 数据库迁移脚本，Supabase PostgreSQL
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-- ============================================================

-- 添加配额重置时间字段
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS quota_reset_at TIMESTAMPTZ DEFAULT NOW();

-- 初始化现有用户的配额重置时间
UPDATE profiles
SET quota_reset_at = NOW()
WHERE quota_reset_at IS NULL;

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_profiles_quota_reset
ON profiles(quota_reset_at);

-- 添加注释
COMMENT ON COLUMN profiles.quota_reset_at IS '配额上次重置时间，用于月度重置检测';
