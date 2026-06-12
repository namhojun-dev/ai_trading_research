import { promises as fs } from "node:fs";
import path from "node:path";
import { fetchWithTimeout } from "@/lib/data/fetch";

/**
 * CUSIP → 티커 매핑(OpenFIGI, 무료). 한 번 조회한 CUSIP은 영구 공유 캐시에 저장해
 * 모든 기관·재요청에서 재사용한다. 키 없으면 분당 25요청 제한이라 한 번에 상위
 * MAX_LOOKUP개만 조회(평가액순) — 나머지는 후속 호출/캐시로 점진 보강된다.
 */

const CACHE_FILE = path.join(process.cwd(), "data", "thirteenf", "_cusip_map.json");
let mem: Record<string, string | null> | null = null;

async function loadMap(): Promise<Record<string, string | null>> {
  if (mem) return mem;
  try {
    mem = JSON.parse(await fs.readFile(CACHE_FILE, "utf8")) as Record<string, string | null>;
  } catch {
    mem = {};
  }
  return mem;
}

async function saveMap(): Promise<void> {
  if (!mem) return;
  try {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(mem), "utf8");
  } catch {
    /* 무시 */
  }
}

type FigiData = { ticker?: string; exchCode?: string };

function pickTicker(jobs: FigiData[]): string | null {
  if (!jobs || jobs.length === 0) return null;
  const us = jobs.find((d) => d.exchCode === "US" && d.ticker);
  return (us?.ticker ?? jobs[0].ticker) ?? null;
}

const MAX_LOOKUP = 150;

/** CUSIP 배열을 티커로 매핑. 입력 순서(=평가액순)대로 상위부터 조회. */
export async function resolveTickers(cusips: string[]): Promise<Record<string, string | null>> {
  const map = await loadMap();
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const c of cusips) {
    const cc = (c ?? "").toUpperCase();
    if (/^[A-Z0-9]{9}$/.test(cc) && !seen.has(cc)) {
      seen.add(cc);
      uniq.push(cc);
    }
  }

  const missing = uniq.filter((c) => !(c in map)).slice(0, MAX_LOOKUP);
  const key = process.env.OPENFIGI_API_KEY?.trim();
  const batchSize = key ? 100 : 10;
  let dirty = false;

  for (let i = 0; i < missing.length; i += batchSize) {
    const chunk = missing.slice(i, i + batchSize);
    try {
      const res = await fetchWithTimeout(
        "https://api.openfigi.com/v3/mapping",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(key ? { "X-OPENFIGI-APIKEY": key } : {}),
          },
          body: JSON.stringify(chunk.map((c) => ({ idType: "ID_CUSIP", idValue: c }))),
        },
        12000,
      );
      if (res.status === 429) break; // 레이트리밋 → 중단, 가진 것만 사용
      if (!res.ok) continue;
      const arr = (await res.json()) as { data?: FigiData[] }[];
      chunk.forEach((c, j) => {
        map[c] = pickTicker(arr[j]?.data ?? []);
        dirty = true;
      });
    } catch {
      /* 청크 스킵 */
    }
    if (!key && i + batchSize < missing.length) {
      await new Promise((r) => setTimeout(r, 300)); // 무료 한도 예의
    }
  }

  if (dirty) await saveMap();

  const out: Record<string, string | null> = {};
  for (const c of uniq) out[c] = map[c] ?? null;
  return out;
}
