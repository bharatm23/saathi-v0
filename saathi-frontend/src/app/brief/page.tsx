"use client";
import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Copy, Download } from "lucide-react";
import { appointmentTypes } from "@/mocks/generated";
import { cn } from "@/lib/utils";
import { MarkdownWithCallouts } from "@/components/MarkdownWithCallouts";
import { fetchBrief } from "@/lib/api"

export default function BriefPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!selected) return;
    setLoading(true);
    try {
      const data = await fetchBrief(selected)
      setBrief(data.brief)
    } catch {
      setBrief("Could not generate brief. Make sure you have lab reports uploaded.")
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!brief) return;
    await navigator.clipboard.writeText(brief);
    // TODO: toast replacement — per brief, no toasts in Phase 0; inline confirm later.
  }

  function download() {
    if (!brief) return;
    const blob = new Blob([brief], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saathi-brief-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageShell title="Appointment brief">
      {!brief && (
        <>
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-3">
            Appointment type
          </div>
          <div className="grid grid-cols-2 gap-3">
            {appointmentTypes.map((t) => {
              const sel = t === selected;
              return (
                <button
                  key={t}
                  onClick={() => setSelected(t)}
                  className={cn(
                    "text-left text-[14px] px-4 py-3 rounded-xl border transition-colors",
                    sel
                      ? "border-blue bg-blue/[0.06] text-blue font-medium"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <Button
            size="lg"
            className="mt-6"
            disabled={!selected || loading}
            onClick={generate}
          >
            {loading ? "Generating…" : "Generate brief"}
          </Button>
          <div className="text-[12px] text-gray-400 text-center mt-3">
            We&apos;ll pull your last 3 reports + 28 days of wearable data.
          </div>
        </>
      )}

      {brief && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] text-gray-400">3 reports · 28 days wearable</div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={copy}>
                <Copy size={14} /> Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={download}>
                <Download size={14} /> Download
              </Button>
            </div>
          </div>
          <Card className="px-8 py-7">
            <MarkdownWithCallouts>{brief}</MarkdownWithCallouts>
          </Card>
          <div className="text-[11px] text-gray-400 text-center mt-3">
            Saathi shows your data · not medical advice
          </div>
        </>
      )}
    </PageShell>
  );
}
