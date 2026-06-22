import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/memory/[id] - Get memory with versions and relations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const memory = await db.memoryItem.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNo: 'desc' } },
        relationsFrom: {
          include: {
            toMemory: { select: { id: true, content: true, memoryType: true } },
          },
        },
        relationsTo: {
          include: {
            fromMemory: { select: { id: true, content: true, memoryType: true } },
          },
        },
      },
    });

    if (!memory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    const relations = [
      ...memory.relationsFrom.map((r) => ({
        id: r.id,
        relationType: r.relationType,
        weight: r.weight,
        metadata: JSON.parse(r.metadata),
        direction: 'from' as const,
        relatedMemory: r.toMemory,
        createdAt: r.createdAt,
      })),
      ...memory.relationsTo.map((r) => ({
        id: r.id,
        relationType: r.relationType,
        weight: r.weight,
        metadata: JSON.parse(r.metadata),
        direction: 'to' as const,
        relatedMemory: r.fromMemory,
        createdAt: r.createdAt,
      })),
    ];

    return NextResponse.json({
      ...memory,
      metadata: JSON.parse(memory.metadata),
      versions: memory.versions.map((v) => ({
        ...v,
        metadata: JSON.parse(v.metadata),
      })),
      relations,
      relationsFrom: undefined,
      relationsTo: undefined,
    });
  } catch (error) {
    console.error('Get memory error:', error);
    return NextResponse.json(
      { error: 'Failed to get memory' },
      { status: 500 }
    );
  }
}

// PATCH /api/memory/[id] - Update memory (creates new version)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      content,
      importance,
      confidence,
      status,
      metadata,
      changeReason,
      scope,
      memoryType,
      expiresAt,
    } = body as {
      content?: string;
      importance?: number;
      confidence?: number;
      status?: string;
      metadata?: Record<string, unknown>;
      changeReason?: string;
      scope?: string;
      memoryType?: string;
      expiresAt?: string;
    };

    // Check existence
    const existing = await db.memoryItem.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (importance !== undefined) updateData.importance = Math.min(1, Math.max(0, importance));
    if (confidence !== undefined) updateData.confidence = Math.min(1, Math.max(0, confidence));
    if (status !== undefined) updateData.status = status;
    if (scope !== undefined) updateData.scope = scope;
    if (memoryType !== undefined) updateData.memoryType = memoryType;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);

    // If content changed, create a new version
    const contentChanged = content !== undefined && content !== existing.content;
    if (contentChanged) {
      updateData.content = content;
    }

    const memory = await db.memoryItem.update({
      where: { id },
      data: updateData,
    });

    // Create new version if content changed
    if (contentChanged) {
      const latestVersion = existing.versions[0];
      const nextVersionNo = latestVersion ? latestVersion.versionNo + 1 : 1;

      await db.memoryVersion.create({
        data: {
          memoryItemId: id,
          versionNo: nextVersionNo,
          content: content,
          metadata: metadata !== undefined ? JSON.stringify(metadata) : existing.metadata,
          changeReason: changeReason || `Updated to version ${nextVersionNo}`,
        },
      });
    }

    // Fetch updated memory with versions
    const updated = await db.memoryItem.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNo: 'desc' } },
      },
    });

    return NextResponse.json({
      ...updated,
      metadata: JSON.parse(updated!.metadata),
      versions: updated!.versions.map((v) => ({
        ...v,
        metadata: JSON.parse(v.metadata),
      })),
    });
  } catch (error) {
    console.error('Update memory error:', error);
    return NextResponse.json(
      { error: 'Failed to update memory' },
      { status: 500 }
    );
  }
}

// DELETE /api/memory/[id] - Delete memory (cascades versions and relations)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check existence
    const existing = await db.memoryItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    // Delete cascades automatically via Prisma schema
    await db.memoryItem.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Delete memory error:', error);
    return NextResponse.json(
      { error: 'Failed to delete memory' },
      { status: 500 }
    );
  }
}
