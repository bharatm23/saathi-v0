"use client";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownWithCallouts } from "@/components/MarkdownWithCallouts";
import { useMember } from "@/lib/member-context";
import { fetchDigest } from "@/lib/api";

type Period = 7 | 30 | 90

export default function DigestPage() {
  const { selected: forMember, reportCount } = useMember();
  const [period,  setPeriod]  = useState<Period>(7);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string | null>(null);
  const [error,   setError]   = useState("");

  const PERIODS = [
    { value: 7,  label: '7 days',  pro: false },
    { value: 30, label: '30 days', pro: true  },
    { value: 90, label: '1 year',  pro: true  },
  ] as const

  async function load(p: Period) {
    setLoading(true); setContent(null); setError("");
    try {
      const data = await fetchDigest(p, forMember?.isSelf ? undefined : forMember?.id ?? undefined)
      setContent(data.digest);
    } catch (e: any) {
      setError(e.message ?? "Could not load digest.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(period); }, [period, forMember?.id]);

  const name = forMember?.name.split(" ")[0] ?? "You";

  return (
    <PageShell
      title="Health digest"
      actions={
        <button onClick={() => load(period)}
          className={cn("w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50", loading && "text-blue")}
          aria-label="Refresh">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      }
    >
      {/* Period selector */}
      <div className="flex gap-2 mb-5">
        {PERIODS.map(p => (
          <div key={p.value} className="relative group">
            <button
              onClick={() => !p.pro && setPeriod(p.value as Period)}
              className={cn(
                "text-[13px] px-4 py-2 rounded-full border transition-colors",
                p.pro
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : p.value === period
                  ? "bg-navy text-white border-navy"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
              )}
            >
              {p.label}
              {p.pro && <span className="ml-1.5 text-[10px] font-medium text-gray-400">Pro</span>}
            </button>
            {p.pro && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                  Upgrade to Pro
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <Card className="px-8 py-7 min-h-[300px]">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={24} className="text-navy animate-spin" />
            <div className="text-[14px] text-gray-700">Reading {name}&apos;s health data…</div>
            <div className="text-[12px] text-gray-400">
              {reportCount} report{reportCount !== 1 ? "s" : ""} · {period} days
            </div>
          </div>
        )}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-[14px] text-gray-500">{error}</p>
            <p className="text-[12px] text-gray-400">Upload reports or connect a wearable to get started.</p>
          </div>
        )}
        {!loading && content && <MarkdownWithCallouts>{content}</MarkdownWithCallouts>}
      </Card>
      <div className="text-[11px] text-gray-400 text-center mt-3">Saathi shows your data · not medical advice</div>
    </PageShell>
  );
}
