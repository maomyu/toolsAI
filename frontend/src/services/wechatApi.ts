/**
 * [INPUT]: 依赖 axios
 * [OUTPUT]: 对外提供微信公众号API调用函数
 * [POS]: services API层，负责与后端通信，由后端代理微信API
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * 保存文章到公众号草稿箱
 * @param appid 公众号AppID
 * @param secret 公众号AppSecret
 * @param title 文章标题
 * @param content 文章HTML内容
 * @param firstImageUrl 第一张图片URL（可选，用于作为封面图）
 * @returns 草稿media_id
 */
export async function saveToWechatDraft(
  appid: string,
  secret: string,
  title: string,
  content: string,
  firstImageUrl?: string
): Promise<string> {
  try {
    console.log('[公众号] 正在保存到草稿箱（通过后端代理）...');

    const response = await axios.post(`${API_BASE_URL}/wechat/save-draft`, {
      appid,
      secret,
      title,
      content,
      firstImageUrl,
    });

    const data = response.data;

    if (!data.success) {
      throw new Error(data.error?.message || '保存草稿失败');
    }

    console.log('[公众号] ✅ 草稿保存成功');
    console.log('[公众号] media_id:', data.data.media_id);

    if (data.data.has_cover) {
      console.log('[公众号] ✅ 封面图已设置');
    } else {
      console.warn('[公众号] ⚠️  未设置封面图');
    }

    return data.data.media_id;
  } catch (error: any) {
    console.error('[公众号] ❌ 保存草稿失败:', error);

    if (error.response?.data?.error) {
      throw new Error(error.response.data.error.message);
    }

    throw error;
  }
}
