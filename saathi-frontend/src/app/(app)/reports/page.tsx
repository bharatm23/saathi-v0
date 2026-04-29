'use client'

import { useEffect, useRef, useState } from 'react'
import { PageShell } from '@/components/PageShell'
import { Card } from '@/components/Card'
import { Pill } from '@/components/Pill'
import { Upload, FileText, CheckCircle2, AlertTriangle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { uploadReport, fetchLabReports } from '@/lib/api'
import { cn } from '@/lib/utils'

type ReportRow = {
  id: string
  file_name: string
  lab_name: string | null
  report_date: string | null
  structured_data: any
  uploaded_at: string
  source: string
}

type UploadingRow = {
  id: string
  file_name: string
  status: 'uploading' | 'error'
  error?: string
}

type Row = ReportRow | UploadingRow

function isUploading(r: Row): r is UploadingRow {
  return 'status' in r
}

function MetricPills({ structured_data }: { structured_data: any }) {
  const [expanded, setExpanded] = useState(false)
  const sd = typeof structured_data === 'string' ? JSON.parse(structured_data) : structured_data
  const labs = sd?.labs ?? sd?.metrics ?? {}
  const keys = Object.keys(labs)
  const abnormal = keys.filter(k => {
    const f = labs[k]?.flag
    return f && !['Normal', 'Negative', 'Absent', 'Nil', null].includes(f)
  })
  const shown = expanded ? keys : keys.slice(0, 6)

  return (
    <div className="mt-2 space-y-1.5">
      {abnormal.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {abnormal.slice(0, 4).map(k => (
            <Pill key={k} tone={labs[k].flag === 'H' ? 'red' : 'amber'}>
              {k}: {labs[k].value} {labs[k].unit ?? ''}
            </Pill>
          ))}
          {abnormal.length > 4 && (
            <Pill tone="gray">+{abnormal.length - 4} abnormal</Pill>
          )}
        </div>
      )}
      {expanded && (
        <div className="flex flex-wrap gap-1 mt-1">
          {shown.map(k => (
            <span key={k} className="text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded px-1.5 py-0.5">
              {k}
            </span>
          ))}
        </div>
      )}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
      >
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {expanded ? 'Hide' : `${keys.length} metrics`}
      </button>
    </div>
  )
}

export default function ReportsPage() {
  const [reports,   setReports]   = useState<ReportRow[]>([])
  const [uploading, setUploading] = useState<UploadingRow[]>([])
  const [dragging,  setDragging]  = useState(false)
  const [loadErr,   setLoadErr]   = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchLabReports()
      .then(setReports)
      .catch(e => setLoadErr(e.message))
  }, [])

  function onFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach(async file => {
      const tempId = `up-${Date.now()}-${Math.random()}`
      const row: UploadingRow = { id: tempId, file_name: file.name, status: 'uploading' }
      setUploading(prev => [row, ...prev])
      try {
        const result = await uploadReport(file)
        if (result.success) {
          // Remove from uploading, refresh from DB
          setUploading(prev => prev.filter(r => r.id !== tempId))
          fetchLabReports().then(setReports).catch(() => {})
        } else {
          setUploading(prev => prev.map(r =>
            r.id === tempId ? { ...r, status: 'error', error: result.error } : r
          ))
        }
      } catch (e: any) {
        setUploading(prev => prev.map(r =>
          r.id === tempId ? { ...r, status: 'error', error: e.message } : r
        ))
      }
    })
  }

  const totalRows = uploading.length + reports.length

  return (
    <PageShell title="Lab reports" meta={`${reports.length} report${reports.length !== 1 ? 's' : ''}`}>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-2xl py-10 px-6 text-center cursor-pointer transition-colors',
          dragging ? 'border-blue bg-blue/[0.06]' : 'border-gray-300 bg-white hover:border-gray-400'
        )}
      >
        <Upload className={cn('mx-auto mb-3', dragging ? 'text-blue' : 'text-gray-400')} size={28} strokeWidth={1.6} />
        <div className="text-[14px] font-medium text-gray-900">
          {dragging ? 'Drop to upload' : 'Drop PDFs or images'}
        </div>
        <div className="text-[12px] text-gray-400 mt-1">or click to choose · max 10MB</div>
        <input ref={inputRef} type="file" accept="application/pdf,image/*" multiple hidden
          onChange={e => onFiles(e.target.files)} />
      </div>

      {/* Notice */}
      <div className="mt-3 flex items-start gap-2 text-[12px] text-amber">
        <AlertTriangle size={14} className="mt-[2px] shrink-0" />
        <span>Handwritten reports can't be parsed yet — please upload printed PDFs.</span>
      </div>

      {loadErr && (
        <div className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{loadErr}</div>
      )}

      {/* List */}
      {totalRows > 0 && (
        <div className="mt-6 space-y-2">
          {/* Uploading rows */}
          {uploading.map(r => (
            <Card key={r.id} className="px-4 py-3 flex items-start gap-4">
              <FileText className="text-gray-400 shrink-0 mt-0.5" size={18} strokeWidth={1.6} />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-gray-900 truncate">{r.file_name}</div>
                {r.status === 'uploading' && (
                  <div className="flex items-center gap-1.5 mt-1 text-[12px] text-blue">
                    <Loader2 size={12} className="animate-spin" />
                    Extracting metrics…
                  </div>
                )}
                {r.status === 'error' && (
                  <div className="text-[12px] text-amber mt-1">{r.error ?? 'Upload failed.'}</div>
                )}
              </div>
            </Card>
          ))}

          {/* Stored reports */}
          {reports.map(r => {
            const sd = typeof r.structured_data === 'string'
              ? JSON.parse(r.structured_data) : r.structured_data
            const labs = sd?.labs ?? sd?.metrics ?? {}
            const count = Object.keys(labs).length
            const impressions: string[] = sd?.impressions ?? []

            return (
              <Card key={r.id} className="px-4 py-3">
                <div className="flex items-center gap-4">
                  <FileText className="text-gray-400 shrink-0" size={18} strokeWidth={1.6} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-gray-900 font-medium truncate">
                      {r.file_name}
                    </div>
                    <div className="text-[12px] text-gray-400 mt-0.5">
                      {r.lab_name ?? 'Unknown lab'}{r.report_date ? ` · ${r.report_date}` : ''}
                      {r.source === 'whatsapp' ? ' · via WhatsApp' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[12px] text-gray-400">{count} metrics</span>
                    <CheckCircle2 size={16} className="text-teal" strokeWidth={1.8} />
                  </div>
                </div>

                {impressions.length > 0 && (
                  <div className="mt-2 ml-8 pl-0">
                    {impressions.map((imp, i) => (
                      <p key={i} className="text-[12px] text-gray-600">• {imp}</p>
                    ))}
                  </div>
                )}

                {count > 0 && (
                  <div className="ml-8">
                    <MetricPills structured_data={sd} />
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {totalRows === 0 && !loadErr && (
        <div className="mt-10 text-center text-[14px] text-gray-400">
          No reports yet. Upload your first lab report above.
        </div>
      )}
    </PageShell>
  )
}
