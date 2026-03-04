/**
 * [INPUT]: 依赖 playwright
 * [OUTPUT]: 对外提供 BrowserPool 类和 browserPool 单例
 * [POS]: services服务层，管理浏览器连接池
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { chromium, Browser, BrowserContext } from 'playwright';

// ========================================
// 浏览器连接池
// ========================================
export class BrowserPool {
  private pool: Browser[] = [];
  private contextPool: BrowserContext[] = [];
  private maxSize: number;
  private maxContexts: number;
  private creating = false;
  private initialized = false;

  constructor(maxSize = 3, maxContexts = 10) {
    this.maxSize = maxSize;
    this.maxContexts = maxContexts;
  }

  /**
   * 初始化浏览器池（预热）
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log(`[浏览器池] 开始初始化，目标大小: ${this.maxSize}`);

    // 预热 1 个浏览器实例（减少内存占用）
    try {
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
        ],
      });
      this.pool.push(browser);
      console.log(`[浏览器池] 预热完成，当前池大小: ${this.pool.length}`);
    } catch (error) {
      console.error('[浏览器池] 预热失败:', error);
    }

    this.initialized = true;
  }

  /**
   * 获取浏览器实例
   */
  async acquire(): Promise<Browser> {
    // 优先从池中获取
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }

    // 池空了，创建新的
    if (!this.creating) {
      this.creating = true;
      try {
        console.log('[浏览器池] 创建新浏览器实例');
        const browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
          ],
        });
        return browser;
      } finally {
        this.creating = false;
      }
    }

    // 等待有可用的
    await new Promise((resolve) => setTimeout(resolve, 100));
    return this.acquire();
  }

  /**
   * 释放浏览器实例回池中
   */
  async release(browser: Browser): Promise<void> {
    if (this.pool.length < this.maxSize) {
      this.pool.push(browser);
      console.log(`[浏览器池] 浏览器已归还，当前池大小: ${this.pool.length}`);
    } else {
      // 池已满，关闭浏览器
      await browser.close();
      console.log('[浏览器池] 池已满，浏览器已关闭');
    }
  }

  /**
   * 创建浏览器上下文（轻量级，推荐使用）
   */
  async createContext(): Promise<BrowserContext> {
    // 复用现有上下文
    if (this.contextPool.length > 0) {
      return this.contextPool.pop()!;
    }

    // 获取浏览器并创建上下文
    const browser = await this.acquire();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // 保存浏览器引用以便后续释放
    (context as any).__browser__ = browser;

    return context;
  }

  /**
   * 释放浏览器上下文
   */
  async releaseContext(context: BrowserContext): Promise<void> {
    try {
      // 关闭上下文中的所有页面
      const pages = context.pages();
      await Promise.all(pages.map((page) => page.close()));

      // 复用上下文（限制数量）
      if (this.contextPool.length < this.maxContexts) {
        this.contextPool.push(context);
      } else {
        await context.close();
        // 释放关联的浏览器
        const browser = (context as any).__browser__;
        if (browser) {
          await this.release(browser);
        }
      }
    } catch (error) {
      console.error('[浏览器池] 释放上下文失败:', error);
    }
  }

  /**
   * 关闭所有浏览器
   */
  async closeAll(): Promise<void> {
    console.log('[浏览器池] 关闭所有浏览器...');

    // 关闭所有上下文
    for (const context of this.contextPool) {
      try {
        await context.close();
      } catch (error) {
        // 忽略关闭错误
      }
    }
    this.contextPool = [];

    // 关闭所有浏览器
    for (const browser of this.pool) {
      try {
        await browser.close();
      } catch (error) {
        // 忽略关闭错误
      }
    }
    this.pool = [];

    this.initialized = false;
    console.log('[浏览器池] 所有浏览器已关闭');
  }

  /**
   * 获取池状态
   */
  getStatus(): { browsers: number; contexts: number; maxSize: number } {
    return {
      browsers: this.pool.length,
      contexts: this.contextPool.length,
      maxSize: this.maxSize,
    };
  }
}

// ========================================
// 单例导出
// ========================================
export const browserPool = new BrowserPool(
  parseInt(process.env.BROWSER_POOL_SIZE || '3'),
  parseInt(process.env.MAX_CONTEXTS || '10')
);
