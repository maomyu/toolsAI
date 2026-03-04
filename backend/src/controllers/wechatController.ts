/**
 * [INPUT]: 依赖 Express 和 axios
 * [OUTPUT]: 对外提供微信公众号API代理控制器
 * [POS]: controllers控制器层，处理微信相关请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Request, Response } from 'express';
import axios from 'axios';

/**
 * 获取微信公众号access_token
 */
export async function getAccessToken(req: Request, res: Response) {
  try {
    const { appid, secret } = req.body;

    if (!appid || !secret) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: '缺少 AppID 或 Secret',
        },
      });
    }

    const url = 'https://api.weixin.qq.com/cgi-bin/token';
    const params = {
      grant_type: 'client_credential',
      appid,
      secret,
    };

    const response = await axios.get(url, { params });
    const data = response.data;

    if (data.errcode) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WECHAT_API_ERROR',
          message: data.errmsg,
          errcode: data.errcode,
        },
      });
    }

    res.json({
      success: true,
      data: {
        access_token: data.access_token,
        expires_in: data.expires_in,
      },
    });
  } catch (error: any) {
    console.error('[微信API] 获取access_token失败:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || '获取access_token失败',
      },
    });
  }
}

/**
 * 完整流程：获取token + 上传封面 + 保存草稿
 */
export async function saveToWechatDraft(req: Request, res: Response) {
  try {
    const { appid, secret, title, content, firstImageUrl: inputImageUrl } = req.body;

    if (!appid || !secret || !title || !content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: '缺少必要参数',
        },
      });
    }

    console.log('[微信API] ===== 开始保存到草稿 =====');

    // 1. 获取access_token
    console.log('[微信API] 步骤 1/3: 获取access_token...');
    const tokenUrl = 'https://api.weixin.qq.com/cgi-bin/token';
    const tokenResponse = await axios.get(tokenUrl, {
      params: {
        grant_type: 'client_credential',
        appid,
        secret,
      },
    });

    if (tokenResponse.data.errcode) {
      throw new Error(`获取access_token失败: ${tokenResponse.data.errmsg} (错误码: ${tokenResponse.data.errcode})`);
    }

    const accessToken = tokenResponse.data.access_token;
    console.log('[微信API] ✅ access_token获取成功');

    // 如果没有提供图片，自动生成AI封面图
    let firstImageUrl = inputImageUrl; // Use mutable variable
    if (!firstImageUrl) {
      console.log('[微信API] 检测到文章没有配图，自动生成AI封面图...');

      try {
        // 从标题生成提示词
        const prompt = `微信公众号封面图，"${title}"主题，简约现代风格，高质量，16:9比例`;

        // 调用AI生成图片（使用较小尺寸确保不超过1MB）
        const { aiService } = await import('../services/AIService');
        const generatedImageUrl = await aiService.generateImage(prompt, '1024*576'); // 使用更小尺寸

        console.log('[微信API] ✅ AI封面图生成成功:', generatedImageUrl);
        firstImageUrl = generatedImageUrl;
      } catch (error: any) {
        console.error('[微信API] ❌ AI封面图生成失败:', error.message);

        // 如果AI生成失败，返回友好错误
        throw new Error(
          '文章没有配图，且AI封面图生成失败，无法保存草稿。\n\n' +
          '建议：\n' +
          '1. 使用原文配图模式\n' +
          '2. 或手动添加一张图片后重试\n\n' +
          '错误详情: ' + error.message
        );
      }
    }

    // 2. 上传封面图
    let thumbMediaId = '';
    console.log('[微信API] 步骤 2/3: 上传封面图...');
    console.log('[微信API] 封面图URL:', firstImageUrl);

    try {
      // 移除 URL 中的 hash（#imgIndex=0 等）
      const cleanImageUrl = firstImageUrl.split('#')[0];
      console.log('[微信API] 清理后的URL:', cleanImageUrl);

      // 下载图片
      console.log('[微信API] 正在下载图片...');
      const imageResponse = await axios.get(cleanImageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://mp.weixin.qq.com/',
        },
      });
      const imageBuffer = Buffer.from(imageResponse.data);
      console.log('[微信API] 图片下载成功，大小:', imageBuffer.length, '字节');

      // 检查图片大小（微信限制：thumb类型最大1MB）
      if (imageBuffer.length > 1024 * 1024) {
        throw new Error(`图片太大: ${Math.round(imageBuffer.length / 1024)}KB（超过1MB限制）`);
      }

      // 创建FormData
      console.log('[微信API] 正在上传到微信素材库...');
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('media', imageBuffer, {
        filename: 'cover.jpg',
        contentType: 'image/jpeg',
      });
      formData.append('type', 'thumb');

      // 上传为永久素材
      const uploadUrl = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=thumb`;
      const uploadResponse = await axios.post(uploadUrl, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      console.log('[微信API] 上传响应:', JSON.stringify(uploadResponse.data));

      // 微信API成功时返回 { media_id, url }，没有errcode
      // 失败时才返回 { errcode, errmsg }
      if (uploadResponse.data.media_id) {
        thumbMediaId = uploadResponse.data.media_id;
        console.log('[微信API] ✅ 封面图上传成功, media_id:', thumbMediaId);
      } else {
        throw new Error(`微信API错误: ${uploadResponse.data.errmsg} (错误码: ${uploadResponse.data.errcode})`);
      }
    } catch (error: any) {
      console.error('[微信API] ❌ 封面图上传失败:', error.message);
      if (error.response) {
        console.error('[微信API] 错误响应:', JSON.stringify(error.response.data));
      }
      throw new Error(`封面图上传失败: ${error.message}`);
    }

    // 3. 保存到草稿箱
    console.log('[微信API] 步骤 3/3: 保存到草稿箱...');

    // 生成摘要
    const plainText = stripHtmlTags(content);
    const digest = plainText.substring(0, 100).trim() + '...';

    const draftData = {
      articles: [
        {
          title: title,
          author: 'AI助手',
          digest: digest,
          content: content,
          content_source_url: '',
          thumb_media_id: thumbMediaId,
          show_cover_pic: 1, // 有 thumbMediaId 时显示封面
          need_open_comment: 1,
          only_fans_can_comment: 0,
        },
      ],
    };

    const draftUrl = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`;
    const draftResponse = await axios.post(draftUrl, draftData);

    if (draftResponse.data.errcode) {
      const errorMap: Record<number, string> = {
        40001: 'AppID或AppSecret错误',
        40002: '不合法的凭证类型',
        40013: '不合法的AppID',
        40164: '调用接口的IP地址不在白名单中',
        45009: '接口调用次数超限',
        45011: 'API频率限制',
        61071: '草稿箱已满（最多100篇）',
        40007: 'thumb_media_id无效或不存在',
      };

      const errcode = draftResponse.data.errcode;
      const errmsg = draftResponse.data.errmsg;
      let errorMsg = `保存草稿失败: ${errmsg}`;

      if (errorMap[errcode]) {
        errorMsg += `\n\n详细说明: ${errorMap[errcode]}`;
      }

      throw new Error(errorMsg);
    }

    console.log('[微信API] ✅ 草稿保存成功');
    console.log('[微信API] media_id:', draftResponse.data.media_id);
    console.log('[微信API] ===== 保存完成 =====');

    res.json({
      success: true,
      data: {
        media_id: draftResponse.data.media_id,
        has_cover: !!thumbMediaId,
      },
    });
  } catch (error: any) {
    console.error('[微信API] ❌ 保存失败:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'SAVE_FAILED',
        message: error.message || '保存到草稿失败',
      },
    });
  }
}

/**
 * 工具函数：去除HTML标签
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
}
