/**
 * Admin API: restart the avatar-agent container.
 *
 * POST /api/admin/restart — triggers a container restart by exiting the
 * Node.js process. Docker's `restart: always` policy will recreate the
 * container, which re-reads .env (including any keys updated via
 * POST /api/admin/keys).
 *
 * Why process.exit instead of `docker compose`? Because the container
 * doesn't have docker CLI installed, and giving it socket access is a
 * security risk. process.exit(0) is the cleanest way: Docker sees the
 * container exit and restarts it within ~5 seconds.
 *
 * Security: requires authenticated session.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Schedule exit after the response is sent (1.5s delay)
    // so the client receives the JSON before the connection drops.
    setTimeout(() => {
      console.log('[Admin] Restart requested, exiting process. Docker will recreate the container.');
      process.exit(0);
    }, 1500);

    return NextResponse.json({
      success: true,
      message: '容器重启中,大约 10-20 秒后服务恢复。请稍后刷新页面。',
      restarting: true,
    });
  } catch (error) {
    console.error('Restart error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to restart' },
      { status: 500 }
    );
  }
}
