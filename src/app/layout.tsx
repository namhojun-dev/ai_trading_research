import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Compete · 멀티 LLM 주식 포지션 분석",
  description:
    "GPT · Gemini · Claude가 3 라운드 토론으로 미국 주식 포지션을 제시하고, Perplexity가 실시간 서치로 최종 종합합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="bg-radial-glow pointer-events-none fixed inset-0" />
        <div className="relative">{children}</div>
      </body>
    </html>
  );
}
