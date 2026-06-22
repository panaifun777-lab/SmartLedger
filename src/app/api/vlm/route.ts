import { NextRequest, NextResponse } from 'next/server';
import { getAI } from '@/lib/ai';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/bmp',
];

const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };
  return mimeMap[ext] || 'image/jpeg';
}

export async function POST(request: NextRequest) {
  try {
    let imageUrl: string;
    let question: string;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData with file upload or base64 image
      const formData = await request.formData();
      const imageFile = formData.get('image') as File | null;
      const imageBase64 = formData.get('image_base64') as string | null;
      question = (formData.get('question') as string) || '描述这张图片';

      if (imageFile) {
        // Validate file type
        const fileType = imageFile.type;
        const fileName = imageFile.name.toLowerCase();
        const ext = path.extname(fileName);

        if (!ALLOWED_IMAGE_TYPES.includes(fileType) && !ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
          return NextResponse.json(
            { error: `Unsupported image format: ${fileType || ext}. Supported: PNG, JPEG, GIF, WebP, BMP` },
            { status: 400 }
          );
        }

        // Validate file size
        if (imageFile.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `File too large: ${(imageFile.size / (1024 * 1024)).toFixed(2)}MB (max 20MB)` },
            { status: 400 }
          );
        }

        // Convert to base64 data URL
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        const mimeType = fileType || getMimeType(fileName);
        const base64 = buffer.toString('base64');
        imageUrl = `data:${mimeType};base64,${base64}`;
      } else if (imageBase64) {
        // Use base64 directly - construct data URL
        // Check if already a data URL
        if (imageBase64.startsWith('data:')) {
          imageUrl = imageBase64;
        } else {
          imageUrl = `data:image/png;base64,${imageBase64}`;
        }
      } else {
        return NextResponse.json(
          { error: 'No image provided. Send an image file or image_base64 field.' },
          { status: 400 }
        );
      }
    } else {
      // Handle JSON body with base64 or URL
      const body = await request.json();
      const { image, image_base64, question: q } = body as {
        image?: string;
        image_base64?: string;
        question?: string;
      };

      question = q || '描述这张图片';

      if (image_base64) {
        if (image_base64.startsWith('data:')) {
          imageUrl = image_base64;
        } else {
          imageUrl = `data:image/png;base64,${image_base64}`;
        }
      } else if (image) {
        // Could be a URL or already a data URL
        imageUrl = image;
      } else {
        return NextResponse.json(
          { error: 'No image provided. Send image (URL), image_base64, or upload a file.' },
          { status: 400 }
        );
      }
    }

    // Analyze using VLM
    const ai = await getAI();
    const response = await ai.chat.completions.createVision({
      model: 'glm-4v-plus',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: question },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    });

    const analysis = response.choices?.[0]?.message?.content || '';

    if (!analysis.trim()) {
      return NextResponse.json(
        { error: 'Empty analysis result from VLM.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      analysis,
      model: 'vlm',
    });
  } catch (error) {
    console.error('VLM API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to analyze image',
      },
      { status: 500 }
    );
  }
}
