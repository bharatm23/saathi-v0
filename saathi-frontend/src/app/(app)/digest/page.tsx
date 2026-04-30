"use client";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownWithCallouts } from "@/components/MarkdownWithCallouts";
import { createClient } from "@/lib/supabase";
import { fetchDigest } from "@/lib/api";

type Period = 7 | 14 | 30;
type Member = { id: string; name: string; relation: string; isSelf?: boolean };

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function DigestPage() {
  const [period,    setPeriod]    = useState<Period>(7);
  const [loading,   setLoading]   = useState(true);
  const [content,   setContent]   = useState<string | null>(null);
  const [error,     setError]     = useState("");
  const [members,   setMembers]   = useState<Member[]>([]);
  const [forMember, setForMember] = useState<Member | null>(null);
  const [reportCount,   setReportCount]   = useState(0);
  const [wearableCount, setWearableCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const name = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "You";
      const self: Member = { id: user.id, name, relation: "Self", isSelf: true };
      const { data: fam } = await supabase.from("family_members").select("*").eq("owner_id", user.id).order("created_at");
      const all: Member[] = [self, ...(fam ?? []).map(m => ({ id: m.id, name: m.name, relation: m.relation }))];
      setMembers(all);
      setForMember(self);

      const { count: rc } = await supabase.from("lab_reports").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      const { count: wc } = await supabase.from("wearable_snapshots").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      setReportCount(rc ?? 0);
      setWearableCount(wc ?? 0);
    }
    init();
  }, []);

  async function load(p: Period) {
    setLoading(true); setContent(null); setError("");
    try {
      const data = await fetchDigest(p);
      setContent(data.digest);
    } catch (e: any) {
      setError(e.message ?? "Could not load digest.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (forMember) load(period); }, [period, forMember]);

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
      {/* Member selector */}
      {members.length > 1 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-[12px] text-gray-400 uppercase tracking-wide font-medium mr-1">FOR</span>
          {members.map(m => (
            <button key={m.id} onClick={() => setForMember(m)}
              className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border text-[13px] transition-colors",
                forMember?.id === m.id
                  ? "border-navy bg-navy text-white font-medium"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              )}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                style={{ background: forMember?.id === m.id ? "rgba(255,255,255,0.3)" : "#9CA3AF", color: "white" }}>
                {initials(m.name)}
              </span>
              {m.name}
              <span className={cn("text-[11px]", forMember?.id === m.id ? "text-blue-200" : "text-gray-400")}>
                · {m.isSelf ? "You" : m.relation}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Period selector */}
      <div className="flex gap-2 mb-5">
        {([7, 14, 30] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={cn("text-[13px] px-4 py-2 rounded-full border transition-colors",
              p === period ? "bg-navy text-white border-navy" : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
            )}>
            {p} days
          </button>
        ))}
      </div>

      <Card className="px-8 py-7 min-h-[300px]">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={24} className="text-navy animate-spin" />
            <div className="text-[14px] text-gray-700">Reading your health data…</div>
            <div className="text-[12px] text-gray-400">
              {reportCount} report{reportCount !== 1 ? "s" : ""} · {period} days wearable
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
