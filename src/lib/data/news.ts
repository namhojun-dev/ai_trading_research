import { XMLParser } from "fast-xml-parser";
import type { DataEnvelope, NewsItem } from "@/lib/types";
import { fetchWithTimeout } from "./fetch";

const NEWS_FEEDS = [
  {
    source: "MarketWatch Top Stories",
    url: "https://feeds.marketwatch.com/marketwatch/topstories/",
  },
  {
    source: "Investing.com Market News",
    url: "https://www.investing.com/rss/news_25.rss",
  },
];

interface ParsedRssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  guid?: string | { "#text"?: string };
}

interface ParsedRss {
  rss?: {
    channel?: {
      item?: ParsedRssItem | ParsedRssItem[];
    };
  };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

export async function fetchMarketNews(limit = 12): Promise<DataEnvelope<NewsItem[]>> {
  const fetchedAt = new Date().toISOString();
  const errors: string[] = [];
  const items: NewsItem[] = [];

  for (const feed of NEWS_FEEDS) {
    try {
      const res = await fetchWithTimeout(feed.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; K-Fin-Terminal/0.1; +https://local.dev)",
          Accept: "application/rss+xml, application/xml, text/xml",
        },
        next: { revalidate: 180 },
      }, 5000);

      if (!res.ok) {
        errors.push(`${feed.source}: HTTP ${res.status}`);
        continue;
      }

      const xml = await res.text();
      const parsed = parser.parse(xml) as ParsedRss;
      const rawItems = normalizeArray(parsed.rss?.channel?.item);
      for (const item of rawItems) {
        const title = cleanText(item.title);
        const url = cleanText(item.link);
        if (!title || !url) continue;

        items.push({
          id: stableNewsId(feed.source, item.guid, url, title),
          title,
          url,
          source: feed.source,
          publishedAt: parseDate(item.pubDate),
          summary: cleanText(item.description),
        });
      }
    } catch (err) {
      errors.push(`${feed.source}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const deduped = dedupeNews(items)
    .sort((a, b) => dateValue(b.publishedAt) - dateValue(a.publishedAt))
    .slice(0, limit);

  if (deduped.length > 0) {
    return {
      status: "actual",
      source: NEWS_FEEDS.map((feed) => feed.source).join(" / "),
      fetchedAt,
      message: errors.length > 0 ? `일부 공급자 오류: ${errors.join("; ")}` : undefined,
      data: deduped,
    };
  }

  return {
    status: errors.length > 0 ? "error" : "no_data",
    source: NEWS_FEEDS.map((feed) => feed.source).join(" / "),
    fetchedAt,
    message: errors.length > 0 ? errors.join("; ") : "뉴스 항목이 없습니다.",
    data: [],
  };
}

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/giu, (_, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    })
    .replace(/&#(\d+);/gu, (_, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    })
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function parseDate(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stableNewsId(source: string, guid: ParsedRssItem["guid"], url: string, title: string) {
  const guidText = typeof guid === "object" ? guid?.["#text"] : guid;
  return `${source}:${guidText || url || title}`;
}

function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const item of items) {
    const key = item.url || item.title;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function dateValue(value: string | null): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}
