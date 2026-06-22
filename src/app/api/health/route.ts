/**
 * Health check endpoint — exempted from auth middleware so Docker
 * HEALTHCHECK can probe it without a session cookie.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
