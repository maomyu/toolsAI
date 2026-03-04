import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * [INPUT]: 依赖 clsx 和 tailwind-merge 的样式合并功能
 * [OUTPUT]: 对外提供 cn() 函数，用于合并Tailwind CSS类名
 * [POS]: lib/工具函数模块，被所有组件使用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
