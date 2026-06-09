import { NextRequest } from "next/server";
import { runAnalysis } from "@/lib/orchestrator";
import type { StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5분

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { ticker?: string };
  const symbol = (body.ticker ?? "").toUpperCase().trim();

  if (!symbol || !/^[A-Z.\-]{1,10}$/.test(symbol)) {
    return new Response(JSON.stringify({ error: "유효한 미국 주식 티커를 입력하세요." }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt: StreamEvent) => {
        const data = `data: ${JSON.stringify(evt)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      // SSE 초기 keep-alive
      controller.enqueue(encoder.encode(": connected\n\n"));

      try {
        await runAnalysis({ ticker: symbol, emit: send });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
