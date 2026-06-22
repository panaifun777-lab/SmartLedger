import { NextRequest, NextResponse } from 'next/server';
import { getAI } from '@/lib/ai';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { prompt, size = '1024x1024' } = await request.json();

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const ai = await getAI();
    const response = await ai.images.generations.create({
      prompt: prompt.trim(),
      size: size,
    });

    const imageBase64 = response.data[0].base64;

    // Save image to public directory
    const filename = `img_${Date.now()}.png`;
    const publicDir = path.join(process.cwd(), 'public', 'generated');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    const filepath = path.join(publicDir, filename);
    const buffer = Buffer.from(imageBase64, 'base64');
    fs.writeFileSync(filepath, buffer);

    return NextResponse.json({
      success: true,
      imageUrl: `/generated/${filename}`,
      prompt: prompt.trim(),
      size: size,
    });
  } catch (error) {
    console.error('Image generation error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to generate image';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
