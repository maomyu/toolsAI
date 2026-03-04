-- ============================================================
-- ZPAY 交易记录表
-- [INPUT]: 依赖 profiles 表
-- [OUTPUT]: 存储支付交易记录
-- [POS]: 数据库 Schema，Supabase PostgreSQL
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-- ============================================================

-- ZPAY 交易记录表
CREATE TABLE IF NOT EXISTS zpay_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- 订单信息
  out_trade_no VARCHAR(64) NOT NULL UNIQUE,  -- 商户订单号
  zpay_trade_no VARCHAR(64),                  -- ZPAY 订单号

  -- 商品信息
  plan_type VARCHAR(32) NOT NULL,             -- 套餐类型: free/basic/pro
  billing_cycle VARCHAR(32) NOT NULL,         -- 周期: monthly/yearly
  amount DECIMAL(10,2) NOT NULL,              -- 支付金额

  -- 支付信息
  payment_method VARCHAR(32) NOT NULL,        -- 支付方式: alipay/wechat
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending/paid/failed/refunded

  -- 时间戳
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束
  CONSTRAINT valid_status CHECK (status IN ('pending', 'paid', 'failed', 'refunded'))
);

-- ============================================================
-- 索引优化
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_zpay_user_id ON zpay_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_zpay_out_trade_no ON zpay_transactions(out_trade_no);
CREATE INDEX IF NOT EXISTS idx_zpay_status ON zpay_transactions(status);
CREATE INDEX IF NOT EXISTS idx_zpay_created_at ON zpay_transactions(created_at);

-- ============================================================
-- 更新时间触发器
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_zpay_transactions_updated_at ON zpay_transactions;
CREATE TRIGGER update_zpay_transactions_updated_at
  BEFORE UPDATE ON zpay_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS 策略
-- ============================================================
ALTER TABLE zpay_transactions ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的交易记录
CREATE POLICY "Users can view own transactions" ON zpay_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- 服务端 Admin 可以完全访问（通过 Service Role Key）
