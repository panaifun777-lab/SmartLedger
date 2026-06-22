import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/memory/[id]/versions - Get all versions of a memory
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

    const versions = await db.memoryVersion.findMany({
      where: { memoryItemId: id },
      orderBy: { versionNo: 'desc' },
    });

    return NextResponse.json({
      versions: versions.map((v) => ({
        ...v,
        metadata: JSON.parse(v.metadata),
      })),
      total: versions.length,
    });
  } catch (error) {
    console.error('Get memory versions error:', error);
    return NextResponse.json(
      { error: 'Failed to get memory versions' },
      { status: 500 }
    );
  }
}
