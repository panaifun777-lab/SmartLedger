import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/bot-connections/[id] - Get a single bot connection
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const connection = await db.botConnection.findUnique({
      where: { id },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Bot connection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...connection,
      metadata: connection.metadata ? JSON.parse(connection.metadata) : null,
    });
  } catch (error) {
    console.error('Get bot connection error:', error);
    return NextResponse.json(
      { error: 'Failed to get bot connection' },
      { status: 500 }
    );
  }
}

// PATCH /api/bot-connections/[id] - Update a bot connection
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { platform, name, webhookUrl, botToken, chatId, enabled, status, metadata } = body as {
      platform?: string;
      name?: string;
      webhookUrl?: string;
      botToken?: string;
      chatId?: string;
      enabled?: boolean;
      status?: string;
      metadata?: Record<string, unknown>;
    };

    // Check existence
    const existing = await db.botConnection.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Bot connection not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (platform !== undefined) updateData.platform = platform;
    if (name !== undefined) updateData.name = name;
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl;
    if (botToken !== undefined) updateData.botToken = botToken;
    if (chatId !== undefined) updateData.chatId = chatId;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (status !== undefined) updateData.status = status;
    if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);

    const connection = await db.botConnection.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...connection,
      metadata: connection.metadata ? JSON.parse(connection.metadata) : null,
    });
  } catch (error) {
    console.error('Update bot connection error:', error);
    return NextResponse.json(
      { error: 'Failed to update bot connection' },
      { status: 500 }
    );
  }
}

// DELETE /api/bot-connections/[id] - Delete a bot connection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check existence
    const existing = await db.botConnection.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Bot connection not found' },
        { status: 404 }
      );
    }

    await db.botConnection.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Delete bot connection error:', error);
    return NextResponse.json(
      { error: 'Failed to delete bot connection' },
      { status: 500 }
    );
  }
}
