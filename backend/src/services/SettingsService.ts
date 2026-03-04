/**
 * [INPUT]: 依赖 database.ts
 * [OUTPUT]: 对外提供设置相关服务
 * [POS]: services 服务层，处理系统设置（API Key 等）
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { db } from '../models/database';

// ========================================
// 设置服务
// ========================================

/**
 * 获取设置值
 */
export function getSetting(key: string): string | null {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value || null;
}

/**
 * 保存设置值
 */
export function setSetting(key: string, value: string): void {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now')
  `);
  stmt.run(key, value);
}

/**
 * 获取所有设置
 */
export function getAllSettings(): Record<string, string> {
  const stmt = db.prepare('SELECT key, value FROM settings');
  const rows = stmt.all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

/**
 * 删除设置
 */
export function deleteSetting(key: string): boolean {
  const stmt = db.prepare('DELETE FROM settings WHERE key = ?');
  const result = stmt.run(key);
  return result.changes > 0;
}

// ========================================
// API Key 相关便捷函数
// ========================================

/**
 * 获取通义千问 API Key
 */
export function getQwenApiKey(): string | null {
  return getSetting('qwen_api_key');
}

/**
 * 保存通义千问 API Key
 */
export function setQwenApiKey(apiKey: string): void {
  setSetting('qwen_api_key', apiKey);
}

/**
 * 获取极致数据 API Key
 */
export function getJizhiApiKey(): string | null {
  return getSetting('jizhi_api_key');
}

/**
 * 保存极致数据 API Key
 */
export function setJizhiApiKey(apiKey: string): void {
  setSetting('jizhi_api_key', apiKey);
}

/**
 * 检查 API Key 是否已配置
 */
export function hasApiKeys(): { qwen: boolean; jizhi: boolean } {
  return {
    qwen: !!getQwenApiKey(),
    jizhi: !!getJizhiApiKey(),
  };
}
