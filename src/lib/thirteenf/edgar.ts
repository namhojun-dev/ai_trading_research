import { fetchWithTimeout } from "@/lib/data/fetch";

/** SEC 는 식별 가능한 User-Agent 를 요구한다(없으면 403). */
function ua(): string {
  return process.env.SEC_USER_AGENT?.trim() || "ai-trading-research research contact@example.com";
}

async function edgar(url: string, asText = false): Promise<string> {
  const res = await fetchWithTimeout(
    url,
    { headers: { "User-Agent": ua(), Accept: "application/json, */*" } },
    12000,
  );
  if (!res.ok) throw new Error(`EDGAR HTTP ${res.status} — ${url}`);
  return asText ? res.text() : res.text();
}

export type FilingRef = { accession: string; reportDate: string; filedAt: string };

/** 한 기관의 13F-HR 신고 목록(최신순). */
export async function getRecent13F(cik: string): Promise<FilingRef[]> {
  const c = String(Number(cik)).padStart(10, "0");
  const data = JSON.parse(await edgar(`https://data.sec.gov/submissions/CIK${c}.json`)) as {
    filings: { recent: { form: string[]; accessionNumber: string[]; reportDate: string[]; filingDate: string[] } };
  };
  const f = data.filings.recent;
  const out: FilingRef[] = [];
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] === "13F-HR") {
      out.push({
        accession: f.accessionNumber[i].replace(/-/g, ""),
        reportDate: f.reportDate[i],
        filedAt: f.filingDate[i],
      });
    }
  }
  return out;
}

export type RawHolding = {
  issuer: string;
  cusip: string;
  titleOfClass: string;
  putCall: string | null;
  value: number;
  shares: number;
};

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<(?:\\w+:)?${name}>([^<]*)</(?:\\w+:)?${name}>`).exec(block);
  return m ? m[1].trim() : null;
}

function parseInfoTable(xml: string): RawHolding[] {
  const re = /<(?:\w+:)?infoTable>([\s\S]*?)<\/(?:\w+:)?infoTable>/g;
  const out: RawHolding[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    const issuer = tag(b, "nameOfIssuer") ?? "(unknown)";
    const cusip = (tag(b, "cusip") ?? "").toUpperCase();
    const titleOfClass = tag(b, "titleOfClass") ?? "";
    const putCall = tag(b, "putCall");
    const value = Number(tag(b, "value") ?? 0); // 2023-Q3+ 부터 달러 단위
    const sshMatch = /<(?:\w+:)?sshPrnamt>([^<]*)</.exec(b);
    const shares = Number(sshMatch?.[1] ?? 0);
    if (Number.isFinite(value)) {
      out.push({ issuer, cusip, titleOfClass, putCall, value, shares });
    }
  }
  return out;
}

/** 한 신고(accession)의 보유내역 정보표(infoTable XML)를 받아 파싱. */
export async function fetchInfoTable(cik: string, accession: string): Promise<RawHolding[]> {
  const cikNum = String(Number(cik));
  const base = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accession}`;
  const index = JSON.parse(await edgar(`${base}/index.json`)) as {
    directory?: { item?: { name: string }[] };
  };
  const names = (index.directory?.item ?? []).map((it) => it.name);
  const xmlName = names.find(
    (n) => /\.xml$/i.test(n) && n.toLowerCase() !== "primary_doc.xml",
  );
  if (!xmlName) throw new Error("13F 정보표(XML)를 찾을 수 없습니다.");
  const xml = await edgar(`${base}/${xmlName}`, true);
  return parseInfoTable(xml);
}
