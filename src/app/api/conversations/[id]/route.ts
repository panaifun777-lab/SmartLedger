import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/conversations/[id] - Get conversation with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const conversation = await db.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...conversation,
      tags: JSON.parse(conversation.tags),
      messages: conversation.messages.map((m) => ({
        ...m,
        toolsCalled: JSON.parse(m.toolsCalled),
        memoryRefs: JSON.parse(m.memoryRefs),
        metadata: JSON.parse(m.metadata),
      })),
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to get conversation' },
      { status: 500 }
    );
  }
}

// PATCH /api/conversations/[id] - Update conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, tags, isPinned, summary } = body as {
      title?: string;
      tags?: string[];
      isPinned?: boolean;
      summary?: string;
    };

    // Check existence
    const existing = await db.conversation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);
    if (isPinned !== undefined) updateData.isPinned = isPinned;
    if (summary !== undefined) updateData.summary = summary;

    const conversation = await db.conversation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...conversation,
      tags: JSON.parse(conversation.tags),
    });
  } catch (error) {
    console.error('Update conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

// DELETE /api/conversations/[id] - Delete conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check existence
    const existing = await db.conversation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    await db.conversation.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
