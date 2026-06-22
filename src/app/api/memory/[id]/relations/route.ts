import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/memory/[id]/relations - Get all relations for a memory
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify memory exists
    const memory = await db.memoryItem.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!memory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    const [outgoing, incoming] = await Promise.all([
      db.memoryRelation.findMany({
        where: { fromMemoryId: id },
        include: {
          toMemory: { select: { id: true, content: true, memoryType: true, status: true } },
        },
      }),
      db.memoryRelation.findMany({
        where: { toMemoryId: id },
        include: {
          fromMemory: { select: { id: true, content: true, memoryType: true, status: true } },
        },
      }),
    ]);

    const relations = [
      ...outgoing.map((r) => ({
        id: r.id,
        relationType: r.relationType,
        weight: r.weight,
        metadata: JSON.parse(r.metadata),
        direction: 'outgoing' as const,
        relatedMemory: r.toMemory,
        createdAt: r.createdAt,
      })),
      ...incoming.map((r) => ({
        id: r.id,
        relationType: r.relationType,
        weight: r.weight,
        metadata: JSON.parse(r.metadata),
        direction: 'incoming' as const,
        relatedMemory: r.fromMemory,
        createdAt: r.createdAt,
      })),
    ];

    return NextResponse.json({
      relations,
      total: relations.length,
    });
  } catch (error) {
    console.error('Get memory relations error:', error);
    return NextResponse.json(
      { error: 'Failed to get memory relations' },
      { status: 500 }
    );
  }
}

// POST /api/memory/[id]/relations - Create a new relation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { toMemoryId, relationType, weight = 0.5, metadata = {} } = body as {
      toMemoryId: string;
      relationType: string;
      weight?: number;
      metadata?: Record<string, unknown>;
    };

    if (!toMemoryId || !relationType) {
      return NextResponse.json(
        { error: 'toMemoryId and relationType are required' },
        { status: 400 }
      );
    }

    const validRelationTypes = ['related_to', 'supports', 'contradicts', 'derived_from'];
    if (!validRelationTypes.includes(relationType)) {
      return NextResponse.json(
        { error: `Invalid relationType. Must be one of: ${validRelationTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (id === toMemoryId) {
      return NextResponse.json(
        { error: 'Cannot create a relation from a memory to itself' },
        { status: 400 }
      );
    }

    // Verify both memories exist
    const [fromMemory, toMemory] = await Promise.all([
      db.memoryItem.findUnique({ where: { id } }),
      db.memoryItem.findUnique({ where: { id: toMemoryId } }),
    ]);

    if (!fromMemory) {
      return NextResponse.json(
        { error: 'Source memory not found' },
        { status: 404 }
      );
    }
    if (!toMemory) {
      return NextResponse.json(
        { error: 'Target memory not found' },
        { status: 404 }
      );
    }

    // Check for duplicate
    const existing = await db.memoryRelation.findFirst({
      where: {
        fromMemoryId: id,
        toMemoryId,
        relationType,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This relation already exists' },
        { status: 409 }
      );
    }

    const relation = await db.memoryRelation.create({
      data: {
        fromMemoryId: id,
        toMemoryId,
        relationType,
        weight: Math.min(1, Math.max(0, weight)),
        metadata: JSON.stringify(metadata),
      },
      include: {
        toMemory: { select: { id: true, content: true, memoryType: true } },
      },
    });

    return NextResponse.json({
      ...relation,
      metadata: JSON.parse(relation.metadata),
    }, { status: 201 });
  } catch (error) {
    console.error('Create memory relation error:', error);
    return NextResponse.json(
      { error: 'Failed to create memory relation' },
      { status: 500 }
    );
  }
}
