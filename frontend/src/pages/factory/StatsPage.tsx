/**
 * [INPUT]: 依赖 React、zustand
 * [OUTPUT]: 对外提供数据统计页面组件
 * [POS]: pages/factory 页面层，展示数据统计功能
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect } from 'react';
import { useFactoryStore } from '../../store/factoryStore';
import { Trophy } from 'lucide-react';

export function StatsPage() {
  const { stats, fetchStats } = useFactoryStore();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statCards = [
    { label: '总发布数', value: stats?.total_published || 0, change: '+12%', color: 'bg-blue-500' },
    { label: '总阅读量', value: stats?.total_read_count || 0, change: '+25%', color: 'bg-green-500' },
    { label: '总点赞数', value: stats?.total_like_count || 0, change: '+18%', color: 'bg-orange-500' },
    { label: '平均互动率', value: `${((stats?.avg_engagement_rate || 0) * 100).toFixed(1)}%`, change: '+0.5%', color: 'bg-purple-500' },
  ];

  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w';
    }
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">数据统计</h1>
          <p className="text-gray-500 mt-1">查看发布数据和内容表现</p>
        </div>
        <select className="px-4 py-2 border border-gray-300 rounded-lg bg-white">
          <option>近7天</option>
          <option>近30天</option>
          <option>近90天</option>
        </select>
      </div>

      {/* 数据卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <div key={index} className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{card.label}</span>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                {card.change}
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-800">
              {typeof card.value === 'number' ? formatNumber(card.value) : card.value}
            </div>
            <div className={`mt-3 h-1 ${card.color} rounded-full`} style={{ width: '60%' }} />
          </div>
        ))}
      </div>

      {/* 发布趋势 */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-medium text-gray-800 mb-4">发布趋势</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">公众号</span>
              <span className="text-gray-800 font-medium">{stats?.total_published || 0} 篇</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: '60%' }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">小红书</span>
              <span className="text-gray-800 font-medium">{stats?.total_published || 0} 篇</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full"
                style={{ width: '40%' }}
              />
            </div>
          </div>
        </div>

        {/* 模拟图表 */}
        <div className="mt-6 h-48 bg-gray-50 rounded-lg flex items-end justify-around p-4">
          {['一', '二', '三', '四', '五', '六', '日'].map((day, index) => (
            <div key={index} className="flex flex-col items-center gap-2">
              <div
                className="w-8 bg-primary/80 rounded-t"
                style={{ height: `${Math.random() * 100 + 40}px` }}
              />
              <span className="text-xs text-gray-500">周{day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 热门文章 TOP5 */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-800 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> 热门文章 TOP5</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {[1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="p-4 flex items-center gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-medium">
                {index}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">
                  示例文章标题 {index}：如何利用AI工具提升工作效率
                </p>
                <div className="flex gap-4 mt-1 text-sm text-gray-500">
                  <span>公众号</span>
                  <span>阅读 1.2k</span>
                  <span>点赞 156</span>
                  <span>互动率 4.9%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
