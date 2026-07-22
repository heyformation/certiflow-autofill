import { NextResponse } from 'next/server';

export async function GET() {
  const envKey = process.env.CLAUDE_API_KEY || '';
  const hasEnvKey = Boolean(envKey.trim());
  const maskedKey = hasEnvKey
    ? `${envKey.slice(0, 14)}...${envKey.slice(-8)}`
    : '';

  return NextResponse.json({
    hasEnvKey,
    maskedKey,
    autoConnected: hasEnvKey,
  });
}
