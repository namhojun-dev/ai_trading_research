import { getKfinHealthReport } from "@/lib/data/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await getKfinHealthReport();
  return Response.json(report, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
