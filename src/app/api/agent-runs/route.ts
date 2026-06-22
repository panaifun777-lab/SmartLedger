import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/agent-runs - List agent runs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;
    const status = searchParams.get('status') || undefined;
    const taskName = searchParams.get('taskName') || undefined;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (taskName) where.taskName = taskName;

    const [runs, total] = await Promise.all([
      db.agentRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      db.agentRun.count({ where }),
    ]);

    const formatted = runs.map((r) => ({
      ...r,
      toolsUsed: JSON.parse(r.toolsUsed),
      metadata: JSON.parse(r.metadata),
    }));

    return NextResponse.json({
      runs: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('List agent runs error:', error);
    return NextResponse.json(
      { error: 'Failed to list agent runs' },
      { status: 500 }
    );
  }
}

// POST /api/agent-runs - Create agent run entry (called internally)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentId = 'avatar-agent',
      userId = 'default-user',
      taskId,
      taskName,
      status = 'running',
      inputText,
      outputText,
      errorMessage,
      toolsUsed = [],
      duration,
      metadata = {},
    } = body as {
      agentId?: string;
      userId?: string;
      taskId?: string;
      taskName?: string;
      status?: string;
      inputText?: string;
      outputText?: string;
      errorMessage?: string;
      toolsUsed?: string[];
      duration?: number;
      metadata?: Record<string, unknown>;
    };

    const run = await db.agentRun.create({
      data: {
        agentId,
        userId,
        taskId,
        taskName,
        status,
        inputText,
        outputText,
        errorMessage,
        toolsUsed: JSON.stringify(toolsUsed),
        duration,
        metadata: JSON.stringify(metadata),
        startedAt: new Date(),
        endedAt: status !== 'running' ? new Date() : null,
      },
    });

    return NextResponse.json({
      ...run,
      toolsUsed: JSON.parse(run.toolsUsed),
      metadata: JSON.parse(run.metadata),
    }, { status: 201 });
  } catch (error) {
    console.error('Create agent run error:', error);
    return NextResponse.json(
      { error: 'Failed to create agent run' },
      { status: 500 }
    );
  }
}
