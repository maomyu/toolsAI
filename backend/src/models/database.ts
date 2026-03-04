/**
 * [INPUT]: 依赖 better-sqlite3
 * [OUTPUT]: 对外提供 db 数据库实例、数据库操作函数
 * [POS]: models 数据层，管理 SQLite 数据库连接和表结构
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import Database from 'better-sqlite3';
import path from 'path';

// ========================================
// 数据库初始化
// ========================================

const dbPath = path.join(__dirname, '../../data/factory.db');
export const db = new Database(dbPath);

// 启用 WAL 模式，提升并发性能
db.pragma('journal_mode = WAL');

// ========================================
// 表结构定义
// ========================================

const createTables = db.transaction(() => {
  // 关键词模板表
  db.exec(`
    CREATE TABLE IF NOT EXISTS keyword_templates (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 公众号账号表
  db.exec(`
    CREATE TABLE IF NOT EXISTS wechat_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      app_id TEXT NOT NULL,
      app_secret TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 小红书账号表
  db.exec(`
    CREATE TABLE IF NOT EXISTS xiaohongshu_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cookie TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 分析报告表
  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_reports (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      article_count INTEGER DEFAULT 0,
      top_liked TEXT,
      top_engagement TEXT,
      word_cloud TEXT,
      insights TEXT,
      read_distribution TEXT,
      time_distribution TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )
  `);

  // 素材文章表
  db.exec(`
    CREATE TABLE IF NOT EXISTS source_articles (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      read_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      share_count INTEGER DEFAULT 0,
      engagement_rate REAL DEFAULT 0,
      summary TEXT,
      url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES analysis_reports(id) ON DELETE CASCADE
    )
  `);

  // 创作文章表
  db.exec(`
    CREATE TABLE IF NOT EXISTS created_articles (
      id TEXT PRIMARY KEY,
      report_id TEXT,
      title TEXT NOT NULL,
      content TEXT,
      cover_image TEXT,
      images TEXT,
      status TEXT DEFAULT 'draft',
      wechat_account_id TEXT,
      wechat_status TEXT DEFAULT 'none',
      wechat_post_id TEXT,
      wechat_published_at DATETIME,
      wechat_read_count INTEGER,
      wechat_like_count INTEGER,
      xiaohongshu_account_id TEXT,
      xiaohongshu_status TEXT DEFAULT 'none',
      xiaohongshu_post_id TEXT,
      xiaohongshu_published_at DATETIME,
      xiaohongshu_read_count INTEGER,
      xiaohongshu_like_count INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES analysis_reports(id) ON DELETE SET NULL
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_source_articles_report_id ON source_articles(report_id);
    CREATE INDEX IF NOT EXISTS idx_created_articles_status ON created_articles(status);
    CREATE INDEX IF NOT EXISTS idx_analysis_reports_status ON analysis_reports(status);
  `);

  // 系统设置表（存储 API Key 等）
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 数据库迁移：添加新列（如果不存在）
  try {
    db.exec(`ALTER TABLE analysis_reports ADD COLUMN read_distribution TEXT`);
  } catch (e) { /* 列已存在，忽略 */ }
  try {
    db.exec(`ALTER TABLE analysis_reports ADD COLUMN time_distribution TEXT`);
  } catch (e) { /* 列已存在，忽略 */ }
  try {
    db.exec(`ALTER TABLE analysis_reports ADD COLUMN progress_info TEXT`);
  } catch (e) { /* 列已存在，忽略 */ }
  try {
    db.exec(`ALTER TABLE analysis_reports ADD COLUMN insights_status TEXT DEFAULT 'none'`);
  } catch (e) { /* 列已存在，忽略 */ }
});

// 执行建表
createTables();

console.log('✅ SQLite 数据库初始化完成');

// ========================================
// 工具函数
// ========================================

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  db.close();
}
