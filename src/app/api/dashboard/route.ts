import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/dashboard - Get overview statistics
export async function GET() {
  try {
    // Run all queries in parallel for performance
    const [
      totalMemories,
      memoriesByTypeRaw,
      totalConversations,
      totalMessages,
      recentRuns,
      runsByStatusRaw,
      avgDurationResult,
    ] = await Promise.all([
      // Total active memories
      db.memoryItem.count({ where: { status: 'active' } }),

      // Memories by type
      db.memoryItem.groupBy({
        by: ['memoryType'],
        where: { status: 'active' },
        _count: { memoryType: true },
      }),

      // Total conversations
      db.conversation.count(),

      // Total messages
      db.message.count(),

      // Recent 10 agent runs
      db.agentRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),

      // Runs by status
      db.agentRun.groupBy({
        by: ['status'],
        _count: { status: true },
      }),

      // Average duration of completed runs
      db.agentRun.aggregate({
        _avg: { duration: true },
        where: {
          status: { in: ['success', 'failed'] },
          duration: { not: null },
        },
      }),
    ]);

    // Format memories by type
    const memoriesByType: Record<string, number> = {};
    for (const item of memoriesByTypeRaw) {
      memoriesByType[item.memoryType] = item._count.memoryType;
    }

    // Format runs by status
    const runsByStatus: Record<string, number> = {};
    let totalRuns = 0;
    let successfulRuns = 0;
    for (const item of runsByStatusRaw) {
      runsByStatus[item.status] = item._count.status;
      totalRuns += item._count.status;
      if (item.status === 'success') {
        successfulRuns = item._count.status;
      }
    }

    // Calculate success rate
    const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;

    // Format recent runs
    const formattedRecentRuns = recentRuns.map((r) => ({
      ...r,
      toolsUsed: JSON.parse(r.toolsUsed),
      metadata: JSON.parse(r.metadata),
    }));

    // Get memories by importance distribution
    const highImportance = await db.memoryItem.count({
      where: { status: 'active', importance: { gte: 0.8 } },
    });
    const mediumImportance = await db.memoryItem.count({
      where: { status: 'active', importance: { gte: 0.4, lt: 0.8 } },
    });
    const lowImportance = await db.memoryItem.count({
      where: { status: 'active', importance: { lt: 0.4 } },
    });

    return NextResponse.json({
      totalMemories,
      memoriesByType,
      memoriesByImportance: {
        high: highImportance,
        medium: mediumImportance,
        low: lowImportance,
      },
      totalConversations,
      totalMessages,
      recentRuns: formattedRecentRuns,
      runsByStatus,
      totalRuns,
      successRate,
      avgDuration: avgDurationResult._avg.duration
        ? Math.round(avgDurationResult._avg.duration)
        : null,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get dashboard statistics' },
      { status: 500 }
    );
  }
}
