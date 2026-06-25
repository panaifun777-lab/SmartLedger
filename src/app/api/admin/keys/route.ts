/**
 * Admin API: manage AI API keys at runtime.
 *
 * GET  /api/admin/keys         — return which keys are configured (no values)
 * POST /api/admin/keys         — update one or more keys
 *   body: { zhipu_api_key?: string, openai_api_key?: string, deepseek_api_key?: string }
 *
 * The keys are written to /opt/avatar-agent/deploy/.env on the VPS.
 * After updating, the caller should restart avatar-agent container:
 *   docker compose -f /opt/avatar-agent/deploy/docker-compose.yml up -d --force-recreate avatar-agent
 *
 * Security: this endpoint requires an authenticated session (proxy.ts enforces).
 * Only the authenticated user can read/write keys.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const ENV_FILE = process.env.ENV_FILE_PATH || '/opt/avatar-agent/deploy/.env';

/** Read .env file as key-value map. */
function readEnvFile(): Record<string, string> {
  try {
    if (!fs.existsSync(ENV_FILE)) return {};
    const content = fs.readFileSync(ENV_FILE, 'utf-8');
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

/** Write a key back to .env, preserving comments and other keys. */
function updateEnvKey(key: string, value: string): void {
  if (!fs.existsSync(ENV_FILE)) {
    // Create new file with just this key
    fs.writeFileSync(ENV_FILE, `${key}=${value}\n`, 'utf-8');
    return;
  }
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  const lines = content.split('\n');
  let found = false;
  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) return line; // skip comments
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) return line;
    const k = trimmed.substring(0, eqIdx).trim();
    if (k === key) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    newLines.push(`${key}=${value}`);
  }
  fs.writeFileSync(ENV_FILE, newLines.join('\n'), 'utf-8');
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const env = readEnvFile();
    return NextResponse.json({
      // Only return whether keys are set, not the actual values
      keys: {
        DEEPSEEK_API_KEY: !!env.DEEPSEEK_API_KEY,
        ZHIPU_API_KEY: !!env.ZHIPU_API_KEY,
        OPENAI_API_KEY: !!env.OPENAI_API_KEY,
      },
      // Show first 8 chars + last 4 chars for verification
      previews: {
        DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY
          ? `${env.DEEPSEEK_API_KEY.substring(0, 8)}...${env.DEEPSEEK_API_KEY.substring(env.DEEPSEEK_API_KEY.length - 4)}`
          : '',
        ZHIPU_API_KEY: env.ZHIPU_API_KEY
          ? `${env.ZHIPU_API_KEY.substring(0, 8)}...${env.ZHIPU_API_KEY.substring(env.ZHIPU_API_KEY.length - 4)}`
          : '',
        OPENAI_API_KEY: env.OPENAI_API_KEY
          ? `${env.OPENAI_API_KEY.substring(0, 8)}...${env.OPENAI_API_KEY.substring(env.OPENAI_API_KEY.length - 4)}`
          : '',
      },
    });
  } catch (error) {
    console.error('Get keys error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read keys' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { zhipu_api_key, openai_api_key, deepseek_api_key } = body as {
      zhipu_api_key?: string;
      openai_api_key?: string;
      deepseek_api_key?: string;
    };

    const updated: string[] = [];
    if (typeof zhipu_api_key === 'string' && zhipu_api_key.trim()) {
      updateEnvKey('ZHIPU_API_KEY', zhipu_api_key.trim());
      updated.push('ZHIPU_API_KEY');
    }
    if (typeof openai_api_key === 'string' && openai_api_key.trim()) {
      updateEnvKey('OPENAI_API_KEY', openai_api_key.trim());
      updated.push('OPENAI_API_KEY');
    }
    if (typeof deepseek_api_key === 'string' && deepseek_api_key.trim()) {
      updateEnvKey('DEEPSEEK_API_KEY', deepseek_api_key.trim());
      updated.push('DEEPSEEK_API_KEY');
    }

    if (updated.length === 0) {
      return NextResponse.json(
        { error: 'No keys provided. Send zhipu_api_key, openai_api_key, or deepseek_api_key in the request body.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `已更新 ${updated.length} 个 Key: ${updated.join(', ')}。需要重启容器才能生效。`,
      updated,
      needsRestart: true,
    });
  } catch (error) {
    console.error('Update keys error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update keys' },
      { status: 500 }
    );
  }
}
