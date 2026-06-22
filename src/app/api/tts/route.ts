import { NextRequest, NextResponse } from 'next/server';
import { getAI } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'tongtong', speed = 1.0 } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // TTS has a 1024 character limit per request
    const inputText = text.trim().substring(0, 1024);

    const ai = await getAI();
    const response = await ai.audio.tts.create({
      input: inputText,
      voice: voice,
      speed: Math.max(0.5, Math.min(2.0, speed)),
      response_format: 'mp3',
      stream: false,
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to generate speech';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
