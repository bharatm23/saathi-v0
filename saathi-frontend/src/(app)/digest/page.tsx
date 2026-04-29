"use client";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownWithCallouts } from "@/components/MarkdownWithCallouts";
import { fetchDigest } from "@/lib/api"

type Period = 7 | 14 | 30;

export default function DigestPage() {
  const [period, setPeriod] = useState<Period>(7);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string | null>(null);

  async function load(p: Period) {
    setLoading(true);
    setContent(null);
    try {
      const data = await fetchDigest(p)
      setContent(data.digest)
    } catch {
      setContent("Could not load digest. Upload lab reports or connect a wearable first.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(period); }, [period]);

  const periods: Period[] = [7, 14, 30];

  return (
    <PageShell
      title="Health digest"
      actions={
        <button
          onClick={() => load(period)}
          className={cn(
            "w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
            loading && "text-blue"
          )}
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      }
    >
      <div className="flex gap-2 mb-5">
        {periods.map((p) => {
          const sel = p === period;
          return (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "text-[13px] px-4 py-2 rounded-full border transition-colors",
                sel
                  ? "bg-navy text-white border-navy"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
              )}
            >
              {p} days
            </button>
          );
        })}
      </div>

      <Card className="px-8 py-7 min-h-[300px]">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={24} className="text-navy animate-spin" />
            <div className="text-[14px] text-gray-700">Reading your health data…</div>
            <div className="text-[12px] text-gray-400">3 reports · {period} days wearable</div>
          </div>
        )}
        {!loading && content && <MarkdownWithCallouts>{content}</MarkdownWithCallouts>}
      </Card>
      <div className="text-[11px] text-gray-400 text-center mt-3">
        Saathi shows your data · not medical advice
      </div>
    </PageShell>
  );
}
