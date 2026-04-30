"use client";
import { useState, useEffect } from "react";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Copy, Download } from "lucide-react";
import { appointmentTypes } from "@/mocks/generated";
import { cn } from "@/lib/utils";
import { MarkdownWithCallouts } from "@/components/MarkdownWithCallouts";
import { createClient } from "@/lib/supabase";
import { fetchBrief } from "@/lib/api";

type Member = { id: string; name: string; relation: string; isSelf?: boolean };

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function BriefPage() {
  const [members,  setMembers]  = useState<Member[]>([]);
  const [forMember, setForMember] = useState<Member | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [brief,    setBrief]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [reportCount, setReportCount] = useState(0);
  const [wearableCount, setWearableCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
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
    load();
  }, []);

  async function generate() {
    if (!selected) return;
    setLoading(true); setError("");
    try {
      const data = await fetchBrief(selected);
      setBrief(data.brief);
    } catch (e: any) {
      setError(e.message ?? "Could not generate brief.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!brief) return;
    await navigator.clipboard.writeText(brief);
  }

  function download() {
    if (!brief) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([brief], { type: "text/markdown" }));
    a.download = `saathi-brief-${Date.now()}.md`;
    a.click();
  }

  return (
    <PageShell title="Appointment brief">
      {!brief && (
        <>
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

          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-3">Appointment type</div>
          <div className="grid grid-cols-2 gap-3">
            {appointmentTypes.map(t => (
              <button key={t} onClick={() => setSelected(t)}
                className={cn("text-left text-[14px] px-4 py-3 rounded-xl border transition-colors",
                  t === selected ? "border-blue bg-blue/[0.06] text-blue font-medium" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                )}>
                {t}
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mt-3">{error}</p>}

          <Button size="lg" className="mt-6" disabled={!selected || loading} onClick={generate}>
            {loading ? "Generating…" : "Generate brief"}
          </Button>
          <div className="text-[12px] text-gray-400 text-center mt-3">
            {reportCount > 0 || wearableCount > 0
              ? `${reportCount} report${reportCount !== 1 ? "s" : ""} · ${wearableCount} days wearable`
              : "Upload reports or connect a wearable to get started."}
          </div>
        </>
      )}

      {brief && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] text-gray-400">
              {forMember?.name} · {reportCount} report{reportCount !== 1 ? "s" : ""} · {wearableCount} days wearable
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={copy}><Copy size={14} /> Copy</Button>
              <Button variant="ghost" size="sm" onClick={download}><Download size={14} /> Download</Button>
            </div>
          </div>
          <Card className="px-8 py-7">
            <MarkdownWithCallouts>{brief}</MarkdownWithCallouts>
          </Card>
          <div className="flex justify-center mt-4">
            <button onClick={() => setBrief(null)} className="text-[13px] text-gray-400 hover:text-gray-600 underline">
              Generate another brief
            </button>
          </div>
          <div className="text-[11px] text-gray-400 text-center mt-3">Saathi shows your data · not medical advice</div>
        </>
      )}
    </PageShell>
  );
}
