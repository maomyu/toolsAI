/**
 * [INPUT]: 依赖 database.ts
 * [OUTPUT]: 对外提供内容创作相关服务
 * [POS]: services 服务层，处理文章 CRUD 业务逻辑
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { db, generateId } from '../models/database';
import type {
  CreatedArticle,
  CreatedArticleRow,
  ArticleStatus,
  PublishStatus,
} from '../types/factory';

// ========================================
// 文章服务
// ========================================

/**
 * 创建新文章
 */
export function createArticle(data: {
  report_id?: string;
  title: string;
  content: string;
  cover_image?: string;
  images?: string[];
}): string {
  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO created_articles (
      id, report_id, title, content, cover_image, images, status,
      wechat_status, xiaohongshu_status
    )
    VALUES (?, ?, ?, ?, ?, ?, 'draft', 'none', 'none')
  `);
  stmt.run(
    id,
    data.report_id || null,
    data.title,
    data.content,
    data.cover_image || null,
    JSON.stringify(data.images || [])
  );
  return id;
}

/**
 * 获取文章列表
 */
export function getArticleList(options?: {
  status?: ArticleStatus;
  limit?: number;
  offset?: number;
}): CreatedArticle[] {
  let sql = 'SELECT * FROM created_articles';
  const params: (string | number)[] = [];

  if (options?.status) {
    sql += ' WHERE status = ?';
    params.push(options.status);
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  if (options?.offset) {
    sql += ' OFFSET ?';
    params.push(options.offset);
  }

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as CreatedArticleRow[];
  return rows.map(rowToArticle);
}

/**
 * 获取单篇文章
 */
export function getArticleById(id: string): CreatedArticle | null {
  const stmt = db.prepare('SELECT * FROM created_articles WHERE id = ?');
  const row = stmt.get(id) as CreatedArticleRow | undefined;
  return row ? rowToArticle(row) : null;
}

/**
 * 更新文章
 */
export function updateArticle(
  id: string,
  data: {
    title?: string;
    content?: string;
    cover_image?: string;
    images?: string[];
    status?: ArticleStatus;
  }
): boolean {
  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (data.title !== undefined) {
    fields.push('title = ?');
    values.push(data.title);
  }
  if (data.content !== undefined) {
    fields.push('content = ?');
    values.push(data.content);
  }
  if (data.cover_image !== undefined) {
    fields.push('cover_image = ?');
    values.push(data.cover_image);
  }
  if (data.images !== undefined) {
    fields.push('images = ?');
    values.push(JSON.stringify(data.images));
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
  }

  if (fields.length === 0) return false;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(`UPDATE created_articles SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

/**
 * 删除文章
 */
export function deleteArticle(id: string): boolean {
  const stmt = db.prepare('DELETE FROM created_articles WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * 更新文章发布状态
 */
export function updatePublishStatus(
  id: string,
  platform: 'wechat' | 'xiaohongshu',
  data: {
    account_id?: string;
    status: PublishStatus;
    post_id?: string;
    read_count?: number;
    like_count?: number;
  }
): boolean {
  const prefix = platform === 'wechat' ? 'wechat' : 'xiaohongshu';
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.account_id !== undefined) {
    fields.push(`${prefix}_account_id = ?`);
    values.push(data.account_id);
  }
  fields.push(`${prefix}_status = ?`);
  values.push(data.status);
  if (data.post_id !== undefined) {
    fields.push(`${prefix}_post_id = ?`);
    values.push(data.post_id);
  }
  if (data.read_count !== undefined) {
    fields.push(`${prefix}_read_count = ?`);
    values.push(data.read_count);
  }
  if (data.like_count !== undefined) {
    fields.push(`${prefix}_like_count = ?`);
    values.push(data.like_count);
  }
  if (data.status === 'published') {
    fields.push(`${prefix}_published_at = datetime('now')`);
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(`UPDATE created_articles SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

/**
 * 获取统计文章数量
 */
export function getArticleCountByStatus(): Record<ArticleStatus, number> {
  const stmt = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM created_articles
    GROUP BY status
  `);
  const rows = stmt.all() as { status: ArticleStatus; count: number }[];
  const result: Record<ArticleStatus, number> = {
    draft: 0,
    pending: 0,
    published: 0,
  };
  for (const row of rows) {
    result[row.status] = row.count;
  }
  return result;
}

// ========================================
// 辅助函数
// ========================================

function rowToArticle(row: CreatedArticleRow): CreatedArticle {
  return {
    id: row.id,
    report_id: row.report_id,
    title: row.title,
    content: row.content,
    cover_image: row.cover_image,
    images: parseJSON(row.images, []),
    status: row.status,
    wechat_account_id: row.wechat_account_id,
    wechat_status: row.wechat_status,
    wechat_post_id: row.wechat_post_id,
    wechat_published_at: row.wechat_published_at,
    wechat_read_count: row.wechat_read_count,
    wechat_like_count: row.wechat_like_count,
    xiaohongshu_account_id: row.xiaohongshu_account_id,
    xiaohongshu_status: row.xiaohongshu_status,
    xiaohongshu_post_id: row.xiaohongshu_post_id,
    xiaohongshu_published_at: row.xiaohongshu_published_at,
    xiaohongshu_read_count: row.xiaohongshu_read_count,
    xiaohongshu_like_count: row.xiaohongshu_like_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseJSON<T>(str: string | null, defaultValue: T): T {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}
