import { NextRequest } from "next/server";
import { fetchQuote } from "@/lib/data/quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim();
  if (!symbol) {
    return Response.json(
      {
        error: "symbol 파라미터가 필요합니다.",
        status: "no_data",
      },
      { status: 400 },
    );
  }

  const quote = await fetchQuote(symbol);
  const httpStatus = quote.freshness.status === "no_data" ? 404 : 200;
  return Response.json(quote, { status: httpStatus });
}
