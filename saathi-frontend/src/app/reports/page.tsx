"use client";
import { useRef, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { Upload, FileText, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { mockReports, type Report } from "@/mocks/reports";
import { cn } from "@/lib/utils";
import { uploadReport } from "@/lib/api"

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFiles(files: FileList | null) {
    if (!files) return;
    const added: Report[] = Array.from(files).map((f, i) => ({
      id: `new-${Date.now()}-${i}`,
      filename: f.name,
      kind: "Uploading",
      date: "just now",
      status: "processing" as const,
      metrics: [],
    }))
    setReports((prev) => [...added, ...prev])

    // Upload each file and update status on completion
    Array.from(files).forEach(async (f, i) => {
      const tempId = added[i].id
      try {
        const result = await uploadReport(f)
        setReports((prev) => prev.map((r) =>
          r.id !== tempId ? r : {
            ...r,
            status: result.success ? "ok" as const : "error" as const,
            kind: result.lab_name ?? "Lab report",
            date: result.report_date ?? "just now",
            errorMessage: result.error,
            metrics: (result.metrics_extracted ?? []).slice(0, 8).map((name: string) => ({
              name,
              value: "",
              unit: "",
              status: "ok" as const,
            })),
          }
        ))
      } catch (e: any) {
        setReports((prev) => prev.map((r) =>
          r.id !== tempId ? r : {
            ...r,
            status: "error" as const,
            errorMessage: e?.message ?? "Upload failed. Try a clearer image or typed PDF.",
          }
        ))
      }
    })
  }

  return (
    <PageShell title="Lab reports" meta={`Priya · ${reports.length} reports`}>
      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl py-10 px-6 text-center cursor-pointer transition-colors",
          dragging ? "border-blue bg-blue/[0.06]" : "border-gray-300 bg-white hover:border-gray-400"
        )}
      >
        <Upload className={cn("mx-auto mb-3", dragging ? "text-blue" : "text-gray-400")} size={28} strokeWidth={1.6} />
        <div className="text-[14px] font-medium text-gray-900">
          {dragging ? "Drop to upload" : "Drop PDFs or images"}
        </div>
        <div className="text-[12px] text-gray-400 mt-1">or click to choose · max 20MB</div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {/* Inline amber notice (quiet, not dismissible) */}
      <div className="mt-3 flex items-start gap-2 text-[12px] text-amber">
        <AlertTriangle size={14} className="mt-[2px] shrink-0" />
        <span>Handwritten reports can&apos;t be parsed yet — please upload printed PDFs.</span>
      </div>

      {/* List */}
      <div className="mt-6 space-y-2">
        {reports.map((r) => (
          <ReportRow key={r.id} report={r} />
        ))}
      </div>
    </PageShell>
  );
}

function ReportRow({ report }: { report: Report }) {
  return (
    <Card className="px-4 py-3 flex items-center gap-4">
      <FileText className="text-gray-400 shrink-0" size={20} strokeWidth={1.6} />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] text-gray-900 truncate">{report.filename}</div>
        <div className="text-[12px] text-gray-400 mt-0.5">
          {report.kind} · {report.date}
        </div>
      </div>

      {report.status === "ok" && (
        <div className="flex items-center gap-1.5 flex-wrap max-w-[40%] justify-end">
          {report.metrics.slice(0, 6).map((m) => (
            <Pill key={m.name} tone={m.status === "borderline" ? "amber" : "blue"}>
              {m.name}
            </Pill>
          ))}
          {report.metrics.length > 6 && (
            <span className="text-[12px] text-gray-400">+{report.metrics.length - 6} more</span>
          )}
          <CheckCircle2 size={18} className="text-teal ml-2" strokeWidth={1.8} />
        </div>
      )}

      {report.status === "processing" && (
        <div className="flex items-center gap-2 text-[12px] text-blue">
          <Loader2 size={14} className="animate-spin" />
          Extracting…
        </div>
      )}

      {report.status === "error" && (
        <div className="text-[12px] text-amber max-w-[40%] text-right">
          {report.errorMessage}
        </div>
      )}
    </Card>
  );
}
