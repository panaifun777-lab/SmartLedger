import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/memory - List/search memories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;
    const memoryType = searchParams.get('type') || undefined;
    const status = searchParams.get('status') || 'active';
    const search = searchParams.get('search') || undefined;
    const sourceType = searchParams.get('sourceType') || undefined;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (memoryType) where.memoryType = memoryType;
    if (sourceType) where.sourceType = sourceType;
    if (search) {
      where.content = { contains: search };
    }

    const [memories, total] = await Promise.all([
      db.memoryItem.findMany({
        where,
        orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
        include: {
          _count: {
            select: { versions: true, relationsFrom: true, relationsTo: true },
          },
        },
      }),
      db.memoryItem.count({ where }),
    ]);

    const formatted = memories.map((m) => ({
      ...m,
      metadata: JSON.parse(m.metadata),
      versionCount: m._count.versions,
      relationCount: m._count.relationsFrom + m._count.relationsTo,
      _count: undefined,
    }));

    return NextResponse.json({
      memories: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('List memories error:', error);
    return NextResponse.json(
      { error: 'Failed to list memories' },
      { status: 500 }
    );
  }
}

// POST /api/memory - Create new memory
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      memoryType,
      content,
      importance = 0.5,
      confidence = 0.5,
      sourceType = 'api',
      sourceId,
      metadata = {},
      scope = 'private',
      expiresAt,
    } = body as {
      memoryType: string;
      content: string;
      importance?: number;
      confidence?: number;
      sourceType?: string;
      sourceId?: string;
      metadata?: Record<string, unknown>;
      scope?: string;
      expiresAt?: string;
    };

    if (!memoryType || !content) {
      return NextResponse.json(
        { error: 'memoryType and content are required' },
        { status: 400 }
      );
    }

    const validTypes = ['fact', 'preference', 'skill', 'context', 'rule', 'event'];
    if (!validTypes.includes(memoryType)) {
      return NextResponse.json(
        { error: `Invalid memoryType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const memory = await db.memoryItem.create({
      data: {
        memoryType,
        content,
        importance: Math.min(1, Math.max(0, importance)),
        confidence: Math.min(1, Math.max(0, confidence)),
        sourceType,
        sourceId: sourceId || null,
        scope,
        status: 'active',
        metadata: JSON.stringify(metadata),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        versions: {
          create: {
            versionNo: 1,
            content,
            metadata: JSON.stringify(metadata),
            changeReason: 'Initial creation',
          },
        },
      },
      include: {
        versions: true,
      },
    });

    return NextResponse.json({
      ...memory,
      metadata: JSON.parse(memory.metadata),
      versions: memory.versions.map((v) => ({
        ...v,
        metadata: JSON.parse(v.metadata),
      })),
    }, { status: 201 });
  } catch (error) {
    console.error('Create memory error:', error);
    return NextResponse.json(
      { error: 'Failed to create memory' },
      { status: 500 }
    );
  }
}
