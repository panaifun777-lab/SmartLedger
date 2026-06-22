import { NextRequest, NextResponse } from 'next/server';
import { getAI } from '@/lib/ai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const ALLOWED_AUDIO_TYPES = [
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/flac',
  'audio/ogg',
  'audio/webm',
];

const ALLOWED_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.webm'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // Validate content-type before parsing FormData
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data or application/x-www-form-urlencoded' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const audioBase64 = formData.get('audio_base64') as string | null;

    let base64Audio: string;

    if (audioFile) {
      // Validate file type
      const fileType = audioFile.type;
      const fileName = audioFile.name.toLowerCase();
      const ext = path.extname(fileName);

      if (!ALLOWED_AUDIO_TYPES.includes(fileType) && !ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `Unsupported audio format: ${fileType || ext}. Supported: WAV, MP3, M4A, FLAC, OGG, WebM` },
          { status: 400 }
        );
      }

      // Validate file size
      if (audioFile.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File too large: ${(audioFile.size / (1024 * 1024)).toFixed(2)}MB (max 100MB)` },
          { status: 400 }
        );
      }

      // Save to temp file
      const buffer = Buffer.from(await audioFile.arrayBuffer());
      const hash = crypto.createHash('md5').update(buffer).digest('hex').substring(0, 12);
      const safeName = `${hash}_${audioFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const uploadDir = path.join(process.cwd(), 'public', 'upload');

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      tempFilePath = path.join(uploadDir, safeName);
      fs.writeFileSync(tempFilePath, buffer);

      base64Audio = buffer.toString('base64');
    } else if (audioBase64) {
      // Use base64 directly
      base64Audio = audioBase64;
    } else {
      return NextResponse.json(
        { error: 'No audio provided. Send an audio file or audio_base64 field.' },
        { status: 400 }
      );
    }

    // Transcribe using ASR
    const ai = await getAI();
    const response = await ai.audio.asr.create({
      file_base64: base64Audio,
    });

    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }

    const transcriptionText = response.text || '';

    if (!transcriptionText.trim()) {
      return NextResponse.json(
        { error: 'Empty transcription result. The audio may not contain clear speech.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: transcriptionText,
      language: 'zh',
      duration: null,
    });
  } catch (error) {
    console.error('ASR API error:', error);

    // Clean up temp file on error
    if (tempFilePath) {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch {
        // Ignore cleanup errors
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to transcribe audio',
      },
      { status: 500 }
    );
  }
}
