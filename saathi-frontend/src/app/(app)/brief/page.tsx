"use client";
import { useState, useEffect } from "react";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Copy, Download } from "lucide-react";
import { appointmentTypes } from "@/mocks/generated";
import { cn } from "@/lib/utils";
import { MarkdownWithCallouts } from "@/components/MarkdownWithCallouts";
import { useMember } from "@/lib/member-context";
import { fetchBrief } from "@/lib/api";

export default function BriefPage() {
  const { selected: forMember, reportCount } = useMember();
  const [selected, setSelected] = useState<string | null>(null);
  const [brief,    setBrief]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function generate() {
    if (!selected) return;
    setLoading(true); setError("");
    try {
      const data = await fetchBrief(selected, forMember?.isSelf ? undefined : forMember?.id)
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

  const name = forMember?.name.split(" ")[0] ?? "You";

  return (
    <PageShell title="Appointment brief">
      {!brief && (
        <>
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-3">
            Appointment type
          </div>
          <div className="grid grid-cols-2 gap-3">
            {appointmentTypes.map((t) => (
              <button
                key={t}
                onClick={() => setSelected(t)}
                className={cn(
                  "text-left text-[14px] px-4 py-3 rounded-xl border transition-colors",
                  t === selected
                    ? "border-blue bg-blue/[0.06] text-blue font-medium"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mt-3">{error}</p>}

          <Button size="lg" className="mt-6" disabled={!selected || loading} onClick={generate}>
            {loading ? `Generating brief for ${name}…` : "Generate brief"}
          </Button>
          <div className="text-[12px] text-gray-400 text-center mt-3">
            {reportCount > 0
              ? `${reportCount} report${reportCount !== 1 ? "s" : ""} for ${name}`
              : "Upload reports to get started."}
          </div>
        </>
      )}

      {brief && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] text-gray-400">
              {name} · {reportCount} report{reportCount !== 1 ? "s" : ""}
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
