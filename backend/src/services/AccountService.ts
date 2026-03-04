/**
 * [INPUT]: 依赖 database.ts
 * [OUTPUT]: 对外提供账号管理相关服务
 * [POS]: services 服务层，处理账号管理业务逻辑
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { db, generateId } from '../models/database';
import type { WechatAccount, XiaohongshuAccount, AccountStatus } from '../types/factory';

// ========================================
// 公众号账号服务
// ========================================

export function createWechatAccount(data: {
  name: string;
  app_id: string;
  app_secret: string;
}): string {
  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO wechat_accounts (id, name, app_id, app_secret, status)
    VALUES (?, ?, ?, ?, 'pending')
  `);
  stmt.run(id, data.name, data.app_id, data.app_secret);
  return id;
}

export function getWechatAccounts(): WechatAccount[] {
  const stmt = db.prepare('SELECT * FROM wechat_accounts ORDER BY created_at DESC');
  return stmt.all() as WechatAccount[];
}

export function getWechatAccountById(id: string): WechatAccount | null {
  const stmt = db.prepare('SELECT * FROM wechat_accounts WHERE id = ?');
  const row = stmt.get(id);
  return row as WechatAccount | null;
}

export function updateWechatAccount(
  id: string,
  data: { name?: string; app_id?: string; app_secret?: string; status?: AccountStatus }
): boolean {
  const fields: string[] = [];
  const values: string[] = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.app_id !== undefined) {
    fields.push('app_id = ?');
    values.push(data.app_id);
  }
  if (data.app_secret !== undefined) {
    fields.push('app_secret = ?');
    values.push(data.app_secret);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
  }

  if (fields.length === 0) return false;

  values.push(id);
  const stmt = db.prepare(`UPDATE wechat_accounts SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

export function deleteWechatAccount(id: string): boolean {
  const stmt = db.prepare('DELETE FROM wechat_accounts WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ========================================
// 小红书账号服务
// ========================================

export function createXiaohongshuAccount(data: { name: string; cookie: string }): string {
  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO xiaohongshu_accounts (id, name, cookie, status)
    VALUES (?, ?, ?, 'pending')
  `);
  stmt.run(id, data.name, data.cookie);
  return id;
}

export function getXiaohongshuAccounts(): XiaohongshuAccount[] {
  const stmt = db.prepare('SELECT * FROM xiaohongshu_accounts ORDER BY created_at DESC');
  return stmt.all() as XiaohongshuAccount[];
}

export function getXiaohongshuAccountById(id: string): XiaohongshuAccount | null {
  const stmt = db.prepare('SELECT * FROM xiaohongshu_accounts WHERE id = ?');
  const row = stmt.get(id);
  return row as XiaohongshuAccount | null;
}

export function updateXiaohongshuAccount(
  id: string,
  data: { name?: string; cookie?: string; status?: AccountStatus }
): boolean {
  const fields: string[] = [];
  const values: string[] = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.cookie !== undefined) {
    fields.push('cookie = ?');
    values.push(data.cookie);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
  }

  if (fields.length === 0) return false;

  values.push(id);
  const stmt = db.prepare(`UPDATE xiaohongshu_accounts SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

export function deleteXiaohongshuAccount(id: string): boolean {
  const stmt = db.prepare('DELETE FROM xiaohongshu_accounts WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}
