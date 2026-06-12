import { promises as fs } from "node:fs";
import path from "node:path";
import { getRecent13F, fetchInfoTable, type RawHolding } from "./edgar";
import { findManager } from "./managers";
import type { ChangeType, ExitedHolding, Holding, ThirteenFResult } from "./types";

export { MANAGERS } from "./managers";

const CACHE_DIR = path.join(process.cwd(), "data", "thirteenf");
const TTL_MS = 12 * 60 * 60 * 1000; // 12시간

/** 같은 종목(cusip+클래스+풋콜)을 합산. */
function aggregate(rows: RawHolding[]): Map<string, RawHolding> {
  const map = new Map<string, RawHolding>();
  for (const r of rows) {
    const key = `${r.cusip}|${r.titleOfClass}|${r.putCall ?? ""}`;
    const cur = map.get(key);
    if (cur) {
      cur.value += r.value;
      cur.shares += r.shares;
    } else {
      map.set(key, { ...r });
    }
  }
  return map;
}

function classify(shares: number, prev: number | null): ChangeType {
  if (prev == null || prev === 0) return "new";
  if (shares > prev * 1.01) return "add";
  if (shares < prev * 0.99) return "reduce";
  return "unchanged";
}

async function readCache(cik: string): Promise<ThirteenFResult | null> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(CACHE_DIR, `${cik}.json`), "utf8")) as {
      expiresAt: string;
      result: ThirteenFResult;
    };
    return new Date(raw.expiresAt).getTime() > Date.now() ? raw.result : null;
  } catch {
    return null;
  }
}

async function writeCache(cik: string, result: ThirteenFResult): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(
      path.join(CACHE_DIR, `${cik}.json`),
      JSON.stringify({ expiresAt: new Date(Date.now() + TTL_MS).toISOString(), result }),
      "utf8",
    );
  } catch {
    /* 무시 */
  }
}

export async function get13F(cikInput: string): Promise<ThirteenFResult> {
  const cik = String(Number(cikInput));
  if (!/^\d+$/.test(cik)) throw new Error("유효한 CIK가 아닙니다.");

  const cached = await readCache(cik);
  if (cached) return cached;

  const filings = await getRecent13F(cik);
  if (filings.length === 0) throw new Error("이 기관의 13F-HR 신고를 찾을 수 없습니다.");

  const latest = filings[0];
  const prev = filings[1] ?? null;

  const curRows = await fetchInfoTable(cik, latest.accession);
  const curAgg = aggregate(curRows);
  const prevAgg = prev ? aggregate(await fetchInfoTable(cik, prev.accession)) : new Map<string, RawHolding>();

  const totalValue = [...curAgg.values()].reduce((a, b) => a + b.value, 0);

  const holdings: Holding[] = [...curAgg.entries()]
    .map(([key, r]) => {
      const prevShares = prevAgg.get(key)?.shares ?? null;
      const change = classify(r.shares, prevShares);
      const deltaSharesPct =
        prevShares != null && prevShares > 0 ? ((r.shares - prevShares) / prevShares) * 100 : null;
      return {
        issuer: r.issuer,
        cusip: r.cusip,
        titleOfClass: r.titleOfClass,
        putCall: r.putCall,
        value: r.value,
        shares: r.shares,
        pct: totalValue > 0 ? (r.value / totalValue) * 100 : 0,
        change,
        prevShares,
        deltaSharesPct,
      } satisfies Holding;
    })
    .sort((a, b) => b.value - a.value)
    .map((h, i) => ({ ...h, rank: i + 1 }));

  // 직전 분기엔 있었으나 이번엔 사라진(전량 청산) 종목
  const exited: ExitedHolding[] = [...prevAgg.entries()]
    .filter(([key, r]) => r.value > 0 && !curAgg.has(key))
    .map(([, r]) => ({ issuer: r.issuer, cusip: r.cusip, prevValue: r.value }))
    .sort((a, b) => b.prevValue - a.prevValue)
    .slice(0, 12);

  const manager = findManager(cik);
  const result: ThirteenFResult = {
    ok: true,
    cik,
    manager: manager?.label ?? `CIK ${cik}`,
    reportDate: latest.reportDate,
    prevReportDate: prev?.reportDate ?? null,
    filedAt: latest.filedAt,
    totalValue,
    positions: holdings.length,
    holdings,
    exited,
    generatedAt: new Date().toISOString(),
    source: "SEC EDGAR 13F-HR",
  };

  await writeCache(cik, result);
  return result;
}
