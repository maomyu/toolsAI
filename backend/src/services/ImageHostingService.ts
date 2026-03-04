/**
 * [INPUT]: 依赖 axios, form-data, fs, path
 * [OUTPUT]: 对外提供图床上传功能
 * [POS]: services服务层，负责图片托管
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

/**
 * 图片托管服务
 * 下载微信图片到本地，解决防盗链问题
 */
class ImageHostingService {
  private readonly imagesDir: string;
  private readonly baseUrl: string;

  constructor() {
    this.imagesDir = path.join(process.cwd(), 'public', 'images');
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    this.ensureImagesDir();
  }

  /**
   * 确保图片目录存在
   */
  private async ensureImagesDir(): Promise<void> {
    try {
      await fs.access(this.imagesDir);
    } catch {
      await fs.mkdir(this.imagesDir, { recursive: true });
      console.log('[图床] 创建图片目录:', this.imagesDir);
    }
  }

  /**
   * 下载图片到本地
   * @param imageUrl 图片URL
   * @returns 本地访问URL
   */
  async downloadImage(imageUrl: string, index: number): Promise<string> {
    try {
      console.log(`[图床] 正在下载第 ${index + 1} 张图片...`);

      // 下载图片
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      // 生成本地文件名（使用时间戳和索引）
      const timestamp = Date.now();
      const ext = this.getImageExtension(response.headers['content-type']);
      const filename = `img_${timestamp}_${index}${ext}`;
      const localPath = path.join(this.imagesDir, filename);

      // 保存到本地
      await fs.writeFile(localPath, Buffer.from(response.data));

      // 返回公共访问URL
      const publicUrl = `${this.baseUrl}/images/${filename}`;
      console.log(`[图床] ✅ 第 ${index + 1} 张图片下载成功:`, publicUrl);

      return publicUrl;
    } catch (error: any) {
      console.error(`[图床] ❌ 第 ${index + 1} 张图片下载失败:`, error.message);
      return imageUrl; // 失败返回原URL
    }
  }

  /**
   * 批量下载图片到本地
   * @param imageUrls 图片URL数组
   * @returns 本地访问URL数组
   */
  async downloadMultipleImages(imageUrls: string[]): Promise<string[]> {
    if (!imageUrls || imageUrls.length === 0) {
      console.log('[图床] 没有图片需要下载');
      return [];
    }

    console.log(`[图床] 开始批量下载 ${imageUrls.length} 张图片`);

    const localUrls: string[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < imageUrls.length; i++) {
      const oldUrl = imageUrls[i];

      const newUrl = await this.downloadImage(oldUrl, i);

      if (newUrl !== oldUrl) {
        successCount++;
      } else {
        failCount++;
      }

      localUrls.push(newUrl);

      // 避免请求过快，添加延迟
      if (i < imageUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[图床] 批量下载完成: 成功 ${successCount} 张，失败 ${failCount} 张`);

    return localUrls;
  }

  /**
   * 根据Content-Type获取图片扩展名
   */
  private getImageExtension(contentType: string | undefined): string {
    if (!contentType) return '.jpg';

    const typeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/bmp': '.bmp',
    };

    return typeMap[contentType] || '.jpg';
  }

  /**
   * 清理旧图片（可选）
   * @param maxAge 最大保留时间（毫秒）
   */
  async cleanOldImages(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const files = await fs.readdir(this.imagesDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.imagesDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          console.log('[图床] 清理旧图片:', file);
        }
      }
    } catch (error) {
      console.error('[图床] 清理旧图片失败:', error);
    }
  }
}

export const imageHostingService = new ImageHostingService();
