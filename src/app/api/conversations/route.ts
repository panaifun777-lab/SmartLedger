import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/conversations - List conversations with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      db.conversation.findMany({
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
        include: {
          _count: {
            select: { messages: true },
          },
        },
      }),
      db.conversation.count(),
    ]);

    const formatted = conversations.map((c) => ({
      ...c,
      tags: JSON.parse(c.tags),
      messageCount: c._count.messages,
      _count: undefined,
    }));

    return NextResponse.json({
      conversations: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('List conversations error:', error);
    return NextResponse.json(
      { error: 'Failed to list conversations' },
      { status: 500 }
    );
  }
}

// POST /api/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, tags } = body as {
      title?: string;
      tags?: string[];
    };

    const conversation = await db.conversation.create({
      data: {
        title: title || 'New Conversation',
        tags: JSON.stringify(tags || []),
      },
    });

    return NextResponse.json({
      ...conversation,
      tags: JSON.parse(conversation.tags),
    }, { status: 201 });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
