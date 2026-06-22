import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const VALID_PLATFORMS = ['feishu', 'wechat', 'telegram'];

const DEFAULT_CONNECTIONS = [
  { platform: 'feishu', name: '飞书机器人' },
  { platform: 'wechat', name: '微信机器人' },
  { platform: 'telegram', name: 'Telegram Bot' },
];

// Auto-seed default bot connections if none exist
async function ensureDefaultConnections() {
  const count = await db.botConnection.count();
  if (count === 0) {
    await db.botConnection.createMany({
      data: DEFAULT_CONNECTIONS.map((c) => ({
        platform: c.platform,
        name: c.name,
        enabled: false,
        status: 'disconnected',
      })),
    });
  }
}

// GET /api/bot-connections - List all bot connections
export async function GET(request: NextRequest) {
  try {
    // Ensure default connections exist (auto-seed on first load)
    await ensureDefaultConnections();

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const enabled = searchParams.get('enabled');

    const where: Record<string, unknown> = {};
    if (platform) {
      where.platform = platform;
    }
    if (enabled !== null) {
      where.enabled = enabled === 'true';
    }

    const connections = await db.botConnection.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }],
    });

    const formatted = connections.map((c) => ({
      ...c,
      metadata: c.metadata ? JSON.parse(c.metadata) : null,
    }));

    return NextResponse.json({ connections: formatted, total: formatted.length });
  } catch (error) {
    console.error('List bot connections error:', error);
    return NextResponse.json(
      { error: 'Failed to list bot connections' },
      { status: 500 }
    );
  }
}

// POST /api/bot-connections - Create a new bot connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, name, webhookUrl, botToken, chatId, enabled, metadata } = body as {
      platform: string;
      name: string;
      webhookUrl?: string;
      botToken?: string;
      chatId?: string;
      enabled?: boolean;
      metadata?: Record<string, unknown>;
    };

    // Validate required fields
    if (!platform || !name) {
      return NextResponse.json(
        { error: 'platform and name are required' },
        { status: 400 }
      );
    }

    if (!VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` },
        { status: 400 }
      );
    }

    const connection = await db.botConnection.create({
      data: {
        platform,
        name,
        webhookUrl: webhookUrl || null,
        botToken: botToken || null,
        chatId: chatId || null,
        enabled: enabled ?? false,
        status: 'disconnected',
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    return NextResponse.json({
      ...connection,
      metadata: connection.metadata ? JSON.parse(connection.metadata) : null,
    }, { status: 201 });
  } catch (error) {
    console.error('Create bot connection error:', error);
    return NextResponse.json(
      { error: 'Failed to create bot connection' },
      { status: 500 }
    );
  }
}
