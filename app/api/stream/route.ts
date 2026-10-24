import { memBus } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events used in DEMO (in-memory) mode. Sends a bare "refresh" ping;
 * the kitchen then refetches its (authenticated) list. In Supabase mode the
 * kitchen uses Realtime broadcast instead, which also works across serverless instances.
 */
export async function GET(req: Request) {
  const hotelId = new URL(req.url).searchParams.get('hotelId') ?? '';
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const bus = memBus();
      const ping = () => controller.enqueue(enc.encode('data: refresh\n\n'));
      bus.on(hotelId, ping);
      const keepAlive = setInterval(() => controller.enqueue(enc.encode(': keep-alive\n\n')), 25000);
      cleanup = () => {
        bus.off(hotelId, ping);
        clearInterval(keepAlive);
      };
      req.signal.addEventListener('abort', () => {
        cleanup();
        try { controller.close(); } catch { /* already closed */ }
      });
      controller.enqueue(enc.encode('retry: 3000\n\n'));
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  });
}
