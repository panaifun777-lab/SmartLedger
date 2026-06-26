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

    if (!imageBase64) {
      // Some providers return url instead of base64
      const url = response.data[0].url;
      if (url) {
        // Return a redirect to the URL, or proxy the image
        // For simplicity, return the URL directly
        return NextResponse.json({
          success: true,
          imageUrl: url,
          prompt: prompt.trim(),
          size: size,
        });
      }
      return NextResponse.json(
        { error: 'No image data returned from AI provider' },
        { status: 500 }
      );
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(imageBase64, 'base64');

    // Detect image format from the first few bytes
    // JPEG: ff d8 ff
    // PNG:  89 50 4e 47
    // WebP: 52 49 46 46 ... 57 45 42 50
    let contentType = 'image/png'; // default
    if (buffer.length >= 3) {
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        contentType = 'image/jpeg';
      } else if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        contentType = 'image/png';
      } else if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
                 buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        contentType = 'image/webp';
      }
    }

    // Also save to public/generated/ for backward compatibility
    // (this allows direct URL access if Next.js static serving picks it up)
    try {
      const filename = `img_${Date.now()}.${contentType.split('/')[1]}`;
      const publicDir = path.join(process.cwd(), 'public', 'generated');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      const filepath = path.join(publicDir, filename);
      fs.writeFileSync(filepath, buffer);
    } catch (writeErr) {
      console.error('Failed to save image to disk (non-fatal):', writeErr);
    }

    // Return the image directly as base64 data URL — this is the most
    // reliable way to display in browser, no dependency on Next.js static
    // serving of runtime-generated files.
    const dataUrl = `data:${contentType};base64,${imageBase64}`;

    return NextResponse.json({
      success: true,
      imageUrl: dataUrl,
      prompt: prompt.trim(),
      size: size,
      contentType,
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
