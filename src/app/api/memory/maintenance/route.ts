import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/memory/maintenance - Run memory maintenance tasks (decay & promotion)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const task = body.task || 'all'; // 'decay', 'promotion', or 'all'

    const results: Record<string, unknown> = {};

    if (task === 'decay' || task === 'all') {
      results.decay = await runDecay();
    }

    if (task === 'promotion' || task === 'all') {
      results.promotion = await runPromotion();
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Memory maintenance error:', error);
    return NextResponse.json(
      { error: 'Failed to run maintenance' },
      { status: 500 }
    );
  }
}

// PATCH /api/memory/maintenance - Update memory access count
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { memoryId } = body as { memoryId: string };

    if (!memoryId) {
      return NextResponse.json(
        { error: 'memoryId is required' },
        { status: 400 }
      );
    }

    const memory = await db.memoryItem.findUnique({
      where: { id: memoryId },
    });

    if (!memory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    const currentMeta = typeof memory.metadata === 'string'
      ? JSON.parse(memory.metadata)
      : (memory.metadata || {});

    const accessCount = (currentMeta.accessCount || 0) + 1;

    await db.memoryItem.update({
      where: { id: memoryId },
      data: {
        metadata: JSON.stringify({
          ...currentMeta,
          accessCount,
          lastAccessedAt: new Date().toISOString(),
        }),
      },
    });

    return NextResponse.json({ success: true, accessCount });
  } catch (error) {
    console.error('Memory access update error:', error);
    return NextResponse.json(
      { error: 'Failed to update access count' },
      { status: 500 }
    );
  }
}

// Decay logic
async function runDecay() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Protected types from auto-archival
  const protectedTypes = ['fact', 'preference', 'rule'];

  let decayed = 0;
  let archived = 0;

  // Get all active memories
  const activeMemories = await db.memoryItem.findMany({
    where: { status: 'active' },
  });

  for (const memory of activeMemories) {
    const meta = typeof memory.metadata === 'string'
      ? JSON.parse(memory.metadata)
      : (memory.metadata || {});

    const lastAccessed = meta.lastAccessedAt
      ? new Date(meta.lastAccessedAt)
      : memory.updatedAt;

    const accessCount = meta.accessCount || 0;

    // Decay: Memories not accessed for 30+ days reduce importance by 0.05
    if (lastAccessed < thirtyDaysAgo && accessCount < 3) {
      const newImportance = Math.max(0, memory.importance - 0.05);
      await db.memoryItem.update({
        where: { id: memory.id },
        data: {
          importance: newImportance,
          metadata: JSON.stringify({ ...meta, decayed: true, lastDecayedAt: now.toISOString() }),
        },
      });
      decayed++;
    }

    // Archive: Memories with importance < 0.2 and no access for 90+ days
    // Protected types are exempt
    if (
      memory.importance < 0.2 &&
      lastAccessed < ninetyDaysAgo &&
      !protectedTypes.includes(memory.memoryType)
    ) {
      await db.memoryItem.update({
        where: { id: memory.id },
        data: { status: 'archived' },
      });
      archived++;
    }
  }

  return { decayed, archived };
}

// Promotion logic
async function runPromotion() {
  const promoted = 0;
  let coreMarked = 0;

  // Get all active memories with their access counts
  const activeMemories = await db.memoryItem.findMany({
    where: { status: 'active' },
  });

  for (const memory of activeMemories) {
    const meta = typeof memory.metadata === 'string'
      ? JSON.parse(memory.metadata)
      : (memory.metadata || {});

    const accessCount = meta.accessCount || 0;

    // Promotion: Memories referenced 3+ times increase importance by 0.1 (max 1.0)
    if (accessCount >= 3 && memory.importance < 1.0) {
      const newImportance = Math.min(1.0, memory.importance + 0.1);
      await db.memoryItem.update({
        where: { id: memory.id },
        data: {
          importance: newImportance,
          metadata: JSON.stringify({ ...meta, promoted: true }),
        },
      });
    }

    // Core marking: High confidence and importance > 0.8
    if (memory.confidence > 0.8 && memory.importance > 0.8 && !meta.core) {
      await db.memoryItem.update({
        where: { id: memory.id },
        data: {
          metadata: JSON.stringify({ ...meta, core: true }),
        },
      });
      coreMarked++;
    }
  }

  return { promoted, coreMarked };
}
