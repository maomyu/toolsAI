-- ============================================================
-- increment_usage 函数
-- 用于增加用户的使用次数
-- ============================================================

CREATE OR REPLACE FUNCTION increment_usage(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET used_quota = used_quota + 1,
      updated_at = NOW()
  WHERE id = user_id;
END;
$$;

-- 授权
GRANT EXECUTE ON FUNCTION increment_usage(UUID) TO service_role;
