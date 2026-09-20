import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { fetchAllRecords } from '@/lib/analytics-queries';
import { createBiSession } from '@/lib/bi-tools';
import { validateChatRequest } from '@/lib/bi-contract';
import { runAnalyst } from '@/lib/chat-runtime';
import type { UploadRecord } from '@/lib/types';

export const maxDuration = 120;
const rateWindow = new Map<string, { count: number; until: number }>();

async function boundedJson(request: NextRequest) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new Error('Send a JSON request.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty request.');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.length;
    if (bytes > 100000) { await reader.cancel(); throw new Error('Conversation too long. Start a new chat.'); }
    chunks.push(next.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: 'Cross-origin chat requests are not allowed.' }, { status: 403 });
  // Best-effort per-instance abuse control, not a substitute for production authentication/WAF.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  for (const [key, entry] of rateWindow) if (entry.until < start) rateWindow.delete(key);
  const entry = rateWindow.get(ip) ?? { count: 0, until: start + 600000 };
  if (entry.count >= 30 || rateWindow.size > 10000) return NextResponse.json({ error: 'Chat request limit reached. Please wait a few minutes.' }, { status: 429 });
  entry.count++; rateWindow.set(ip, entry);
  let body;
  try { body = validateChatRequest(await boundedJson(request)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request.' }, { status: 400 }); }
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'The AI analyst is not configured.' }, { status: 503 });
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 105000);
  try {
    const records = await fetchAllRecords(controller.signal);
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: uploads, error } = await supabase.from('uploads').select('id,filename,rows_inserted,rows_replaced,status,error_message,uploaded_at').order('uploaded_at', { ascending: false }).limit(20).abortSignal(controller.signal);
    if (error && body.report.path === '/upload') throw new Error('Upload history is temporarily unavailable.');
    const session = createBiSession(records, body.filters, body.report, error ? null : (uploads ?? []) as UploadRecord[]);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 100000, maxRetries: 0 });
    const result = await runAnalyst(client, session, body.messages, controller.signal);
    return NextResponse.json({ ...result, meta: { ...result.meta, latencyMs: Date.now() - start } });
  } catch (error) {
    const apiError = error as { status?: number; code?: string };
    console.error('[AI analyst]', { status: apiError.status, code: apiError.code, aborted: controller.signal.aborted });
    const message = controller.signal.aborted ? 'The analysis timed out. Please narrow the question or try again.'
      : apiError.status === 429 ? 'The AI service is busy or its usage limit was reached. Please try later.'
      : apiError.status ? 'The configured AI model is unavailable. Please contact the dashboard administrator.'
      : 'The analysis could not be completed reliably. Please try a more specific question.';
    return NextResponse.json({ error: message }, { status: controller.signal.aborted ? 504 : 502 });
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
  }
}
