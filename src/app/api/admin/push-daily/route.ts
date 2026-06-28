/**
 * Daily Push API — 每日定时推送 AI 新闻
 *
 * POST /api/admin/push-daily
 *   触发一次每日推送: 搜索 AI 新闻 + 数字资产 + 代码库 + 大V言论
 *   生成摘要 + 存为记忆 + (未来)推送到 Telegram/飞书
 *
 * 这个端点设计为被 cron 定时调用(每天 12:00),也可手动触发。
 *
 * 流程:
 *   1. 用 web_search 搜索 4 个分类
 *   2. 用 GLM-4-Flash 生成综合摘要
 *   3. 把摘要存为 event 类型记忆(带 embedding)
 *   4. 返回摘要给调用者
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAI } from '@/lib/ai';
import { createMemoryWithEmbedding } from '@/lib/memory-engine';

interface NewsCategory {
  name: string;
  query: string;
  icon: string;
}

const DAILY_CATEGORIES: NewsCategory[] = [
  { name: 'AI 新闻', query: 'AI artificial intelligence news today 2026', icon: '🤖' },
  { name: '数字资产', query: 'crypto bitcoin ethereum digital asset news today', icon: '💰' },
  { name: '新型代码库', query: 'new github trending repository AI blockchain 2026', icon: '📦' },
  { name: '大V言论', query: 'AI influencer opinion twitter today tech leader', icon: '🐦' },
];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ai = await getAI();
    const results: Array<{ category: string; icon: string; items: Array<{ name: string; snippet: string; url: string }> }> = [];

    // 1. 搜索每个分类
    for (const cat of DAILY_CATEGORIES) {
      try {
        const searchResults = await ai.functions.invoke('web_search', {
          query: cat.query,
          num: 5,
        });
        results.push({
          category: cat.name,
          icon: cat.icon,
          items: (searchResults as Array<{ name: string; snippet: string; url: string }>).slice(0, 5),
        });
      } catch (err) {
        console.error(`[DailyPush] Search failed for ${cat.name}:`, err);
        results.push({ category: cat.name, icon: cat.icon, items: [] });
      }
    }

    // 2. 用 LLM 生成综合摘要
    const searchContext = results
      .map((cat) => `${cat.icon} ${cat.category}:\n${cat.items.map((item, i) => `${i + 1}. ${item.name}: ${item.snippet} (${item.url})`).join('\n')}`)
      .join('\n\n');

    const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

    let summary = '';
    try {
      const completion = await ai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: '你是一个科技新闻编辑。根据搜索结果生成一份简洁的每日推送摘要。每个分类 3-5 条要点,每条一行,包含关键信息和来源链接。用中文输出。',
          },
          {
            role: 'user',
            content: `今天是 ${today}。请根据以下搜索结果,生成一份每日 AI 新闻推送摘要:\n\n${searchContext}\n\n格式:\n## 📰 每日推送 - ${today}\n\n### 🤖 AI 新闻\n- 要点1 (来源)\n- 要点2\n\n### 💰 数字资产\n...\n\n### 📦 新型代码库\n...\n\n### 🐦 大V言论\n...`,
          },
        ],
        stream: false,
      });
      summary = completion?.choices?.[0]?.message?.content || '';
    } catch (err) {
      console.error('[DailyPush] LLM summary failed:', err);
      summary = `## 📰 每日推送 - ${today}\n\n${searchContext}`;
    }

    // 3. 存为记忆(event 类型)
    const memoryContent = `每日推送 ${today}: ${summary.substring(0, 500)}...`;
    try {
      await createMemoryWithEmbedding({
        content: memoryContent,
        memoryType: 'event',
        importance: 0.6,
        confidence: 0.9,
        sourceType: 'tool',
        metadata: { category: 'daily_push', date: today, fullSummary: summary.substring(0, 2000) },
      });
    } catch (err) {
      console.error('[DailyPush] Failed to save memory:', err);
    }

    return NextResponse.json({
      success: true,
      date: today,
      summary,
      categories: results.map((r) => ({ name: r.category, icon: r.icon, count: r.items.length })),
      memorySaved: true,
    });
  } catch (error) {
    console.error('Daily push error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Daily push failed' },
      { status: 500 }
    );
  }
}
