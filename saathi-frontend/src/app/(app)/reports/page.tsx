"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { Upload, FileText, CheckCircle2, AlertTriangle, Loader2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { uploadReport } from "@/lib/api";
import { useMember } from "@/lib/member-context";

type Member = { id: string; name: string; relation: string; isSelf?: boolean };
type SupabaseReport = {
  id: string; file_name: string; lab_name: string | null;
  report_date: string | null; structured_data: any; uploaded_at: string;
  member_id?: string | null;
};

type UploadingRow = { 
  id: string; file_name: string; 
  status: 'processing' | 'uploading' | 'error'  // processing = before storage upload
  error?: string 
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function MemberChip({ member, active, onClick }: { member: Member; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors text-[13px]",
        active ? "border-navy bg-navy/[0.06] font-medium text-navy" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
      )}>
      <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0")}
        style={{ background: active ? "#0F2D52" : "#9CA3AF" }}>
        {initials(member.name)}
      </span>
      {member.name}
      {member.isSelf && <span className="text-gray-400 text-[11px]">· You</span>}
    </button>
  );
}

function ReportRow({ report }: { report: SupabaseReport }) {
  const [expanded, setExpanded] = useState(false);
  const sd = typeof report.structured_data === "string"
    ? JSON.parse(report.structured_data) : report.structured_data;
  const labs = sd?.labs ?? sd?.metrics ?? {};
  const keys = Object.keys(labs);
  const abnormal = keys.filter(k => labs[k]?.flag && !["Normal", "Negative", "Absent", "Nil", null].includes(labs[k]?.flag));
  const shown = keys.slice(0, 6);
  const impressions: string[] = sd?.impressions ?? [];

  return (
    <Card className="px-4 py-3">
      <div className="flex items-center gap-4">
        <FileText className="text-gray-400 shrink-0" size={18} strokeWidth={1.6} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-gray-900 truncate">{report.file_name}</div>
          <div className="text-[12px] text-gray-400 mt-0.5">
            {report.lab_name ?? "Lab report"}{report.report_date ? ` · ${report.report_date}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {abnormal.length > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#FEF3C7", color: "#92400E" }}>
              {abnormal.length} flagged
            </span>
          )}
          <span className="text-[12px] text-gray-400">{keys.length} metrics</span>
          <CheckCircle2 size={16} className="text-teal" strokeWidth={1.8} />
        </div>
      </div>

      {impressions.length > 0 && (
        <div className="mt-2 ml-8 space-y-0.5">
          {impressions.map((imp, i) => <p key={i} className="text-[12px] text-gray-600">• {imp}</p>)}
        </div>
      )}

      {keys.length > 0 && (
        <div className="ml-8 mt-2">
          <div className="flex flex-wrap gap-1">
            {shown.map(k => (
              <Pill key={k} tone={labs[k]?.flag === "H" ? "red" : labs[k]?.flag === "L" ? "amber" : "blue"}>
                {k}
              </Pill>
            ))}
            {keys.length > 6 && !expanded && (
              <span className="text-[12px] text-gray-400">+{keys.length - 6} more</span>
            )}
            {expanded && keys.slice(6).map(k => (
              <Pill key={k} tone="blue">{k}</Pill>
            ))}
          </div>
          {keys.length > 6 && (
            <button onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 mt-1">
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {expanded ? "Hide" : "Show all"}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ReportsPage() {
  const [members,   setMembers]   = useState<Member[]>([]);
  const [selected,  setSelected]  = useState<Member | null>(null);
  const [reports,   setReports]   = useState<SupabaseReport[]>([]);
  const [uploading, setUploading] = useState<UploadingRow[]>([]);
  const [filter,    setFilter]    = useState<string>("all");
  const [dragging,  setDragging]  = useState(false);
  const [loadErr,   setLoadErr]   = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { refreshCount } = useMember()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const name = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "You";
      const self: Member = { id: user.id, name, relation: "Self", isSelf: true };

      const { data: fam } = await supabase.from("family_members").select("*").eq("owner_id", user.id).order("created_at");
      const allMembers: Member[] = [self, ...(fam ?? []).map(m => ({ id: m.id, name: m.name, relation: m.relation }))];
      setMembers(allMembers);
      setSelected(self);

      const { data, error } = await supabase.from("lab_reports")
        .select("id, file_name, lab_name, report_date, structured_data, uploaded_at, member_id")
        .eq("user_id", user.id)
        .order("report_date", { ascending: false })
        .limit(50);
      if (error) { setLoadErr(error.message); return; }
      setReports(data ?? []);
      refreshCount()
    }
    load();
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!selected) return;
    const tempId = `up-${Date.now()}`;
     // Phase 1: processing
    setUploading(prev => [{ id: tempId, file_name: file.name, status: 'processing' }, ...prev])
    await new Promise(r => setTimeout(r, 2000))

    const result = await uploadReport(file, selected?.isSelf ? undefined : selected?.id)
    setUploading(prev => prev.map(r => r.id === tempId ? { ...r, status: 'uploading' } : r))
    // setUploading(prev => [{ id: tempId, file_name: file.name, status: "uploading" }, ...prev]);
    try {
      const result = await uploadReport(file);
      setUploading(prev => prev.filter(r => r.id !== tempId));
      if (result.success) {
        // Refresh reports from DB
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("lab_reports")
          .select("id, file_name, lab_name, report_date, structured_data, uploaded_at, member_id")
          .eq("user_id", user.id).order("report_date", { ascending: false }).limit(50);
        setReports(data ?? []);
        refreshCount()
      } else {
        setUploading(prev => prev.map(r => r.id === tempId ? { ...r, status: "error", error: result.error } : r));
      }
    } catch (e: any) {
      setUploading(prev => prev.map(r => r.id === tempId ? { ...r, status: "error", error: e.message } : r));
    }
  }, [selected]);

  function onFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(handleFile);
  }

  const filteredReports = filter === "all" ? reports : reports.filter(r => {
    if (filter === "self") return !r.member_id;
    return r.member_id === filter;
  });

  const reportCounts = members.reduce((acc, m) => {
    acc[m.id] = m.isSelf
      ? reports.filter(r => !r.member_id).length
      : reports.filter(r => r.member_id === m.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <PageShell
      title="Lab reports"
      meta={`${members.length} member${members.length !== 1 ? "s" : ""} · ${reports.length} report${reports.length !== 1 ? "s" : ""}`}
    >
      {/* Member selector + upload target */}
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] text-gray-500">Whose report is this?</p>
          <a href="/settings" className="text-[13px] font-medium text-navy flex items-center gap-1 hover:opacity-80">
            <Plus size={14} /> New family member
          </a>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {members.map(m => (
            <button key={m.id} onClick={() => setSelected(m)}
              className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors",
                selected?.id === m.id ? "border-navy bg-navy/[0.04]" : "border-gray-200 bg-white hover:border-gray-300"
              )}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                style={{ background: selected?.id === m.id ? "#0F2D52" : "#9CA3AF" }}>
                {initials(m.name)}
              </span>
              <div className="min-w-0">
                <p className={cn("text-[14px] font-medium truncate", selected?.id === m.id ? "text-navy" : "text-gray-900")}>{m.name}</p>
                <p className="text-[12px] text-gray-400">{m.isSelf ? "You" : m.relation} · {reportCounts[m.id] ?? 0} report{reportCounts[m.id] !== 1 ? "s" : ""}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Dropzone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={cn("border-2 border-dashed rounded-2xl py-8 px-6 text-center cursor-pointer transition-colors",
            dragging ? "border-blue bg-blue/[0.06]" : "border-gray-200 bg-gray-50 hover:border-blue/50"
          )}>
          <Upload className={cn("mx-auto mb-2", dragging ? "text-blue" : "text-gray-400")} size={22} strokeWidth={1.6} />
          <div className="text-[14px] font-medium text-gray-900">
            Drop a report for{" "}
            <span className="text-navy">{selected?.name ?? "…"}</span>
          </div>
          <div className="text-[12px] text-gray-400 mt-0.5">PDF or image · max 20MB</div>
          <input ref={inputRef} type="file" accept="application/pdf,image/*" multiple hidden onChange={e => onFiles(e.target.files)} />
        </div>
      </Card>

      {/* Amber notice */}
      <div className="flex items-start gap-2 text-[12px] text-amber mb-5">
        <AlertTriangle size={14} className="mt-[2px] shrink-0" />
        <span>Handwritten reports can&apos;t be parsed yet — please upload printed PDFs.</span>
      </div>

      {loadErr && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-4">{loadErr}</p>}

      {/* Filter bar */}
      {reports.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mr-1">ALL REPORTS</span>
          <div className="flex-1" />
          <span className="text-[12px] text-gray-400 mr-1">Filter:</span>
          {[{ id: "all", label: "All" }, ...members.map(m => ({ id: m.isSelf ? "self" : m.id, label: m.name.split(" ")[0] }))].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={cn("text-[12px] px-3 py-1 rounded-full border transition-colors",
                filter === f.id ? "bg-navy text-white border-navy" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              )}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Uploading rows */}
      {uploading.map(r => (
        <Card key={r.id} className="px-4 py-3 flex items-center gap-4 mb-2">
          <FileText className="text-gray-400 shrink-0" size={18} strokeWidth={1.6} />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] text-gray-900 truncate">{r.file_name}</div>
            {r.status === 'processing' && (
              <div className="flex items-center gap-1.5 mt-0.5 text-[12px] text-gray-500">
                <Loader2 size={11} className="animate-spin" /> Processing report...
              </div>
            )}
            {r.status === 'uploading' && (
              <div className="flex items-center gap-1.5 mt-0.5 text-[12px] text-blue">
                <Loader2 size={11} className="animate-spin" /> Extracting metrics…
              </div>
            )}
            {r.status === "uploading" && (
              <div className="flex items-center gap-1.5 mt-0.5 text-[12px] text-blue">
                <Loader2 size={11} className="animate-spin" /> Extracting metrics…
              </div>
            )}
            {r.status === "error" && <div className="text-[12px] text-amber mt-0.5">{r.error ?? "Upload failed"}</div>}
          </div>
        </Card>
      ))}

      {/* Reports list */}
      <div className="space-y-2">
        {filteredReports.map(r => <ReportRow key={r.id} report={r} />)}
        {filteredReports.length === 0 && uploading.length === 0 && (
          <div className="text-center py-10 text-[14px] text-gray-400">
            No reports yet. Upload the first one above.
          </div>
        )}
      </div>
    </PageShell>
  );
}
