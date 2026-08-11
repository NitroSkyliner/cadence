import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { Upload, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { API } from '../core/api.js'
import { createPost, STATUS, REPEAT, PLATFORMS } from '../core/types.js'

const TEMPLATE = 'text,platforms,date,repeat,category\n"Oat flat white is back ☕",bluesky mastodon,2026-08-10 09:00,weekly,Promo\n"Behind the counter this week",mastodon,2026-08-11 12:30,,\n'

function parseDate(s) {
  if (!s) return null
  const iso = s.trim().replace(' ', 'T')
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

export default function Import({ accounts, categories, onImported }) {
  const [rows, setRows] = useState([])       // [{ raw, post, errors }]
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const fileRef = useRef(null)

  // Map a token (connection id, handle, or platform id) to a connection id.
  const resolveTargets = (field) => {
    const tokens = (field || '').split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean)
    const ids = []
    const bad = []
    for (const tok of tokens) {
      const byId = accounts.find((a) => a.id === tok)
      const byHandle = accounts.find((a) => a.handle.replace(/^@/, '') === tok.replace(/^@/, ''))
      const byPlatform = accounts.filter((a) => a.platform === tok.toLowerCase())
      if (byId) ids.push(byId.id)
      else if (byHandle) ids.push(byHandle.id)
      else if (byPlatform.length) byPlatform.forEach((a) => ids.push(a.id))
      else bad.push(tok)
    }
    return { ids: [...new Set(ids)], bad }
  }

  const catId = (name) => categories.find((c) => c.name.toLowerCase() === (name || '').trim().toLowerCase())?.id || null

  const onFile = (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setDone(null)
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const parsed = res.data.map((raw) => {
          const errors = []
          const text = (raw.text || '').trim()
          if (!text) errors.push('missing text')
          const { ids, bad } = resolveTargets(raw.platforms)
          if (!ids.length) errors.push('no valid platforms')
          if (bad.length) errors.push(`unknown: ${bad.join(', ')}`)
          const date = parseDate(raw.date)
          if (!date) errors.push('bad date')
          const repeat = Object.values(REPEAT).includes((raw.repeat || '').trim()) ? raw.repeat.trim() : REPEAT.NONE
          const limit = ids.length ? Math.min(...ids.map((id) => accounts.find((a) => a.id === id)?.maxLen ?? 500)) : null
          if (limit != null && text.length > limit) errors.push(`over ${limit} chars`)
          return {
            raw, errors,
            post: errors.length ? null : createPost({
              text, platforms: ids, scheduledAt: date.toISOString(), repeat,
              status: STATUS.SCHEDULED, category: catId(raw.category),
            }),
          }
        })
        setRows(parsed)
      },
    })
  }

  const validCount = rows.filter((r) => !r.errors.length).length

  const runImport = async () => {
    setBusy(true)
    let ok = 0
    for (const r of rows) {
      if (!r.post) continue
      try {
        const res = await fetch(`${API}/posts`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r.post),
        })
        if (res.ok) ok++
      } catch (err) { console.error('Import row failed:', err) }
    }
    setBusy(false); setDone(ok); setRows([]); onImported?.()
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'cadence-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-xs tracking-wider text-muted">BULK IMPORT</p>
        <button onClick={downloadTemplate} className="font-mono text-[11px] text-muted transition hover:text-coral">
          DOWNLOAD TEMPLATE
        </button>
      </div>

      {accounts.length === 0 && (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 font-mono text-[11px] text-amber-400">
          Connect at least one account first — imports need a target platform.
        </p>
      )}

      <button onClick={() => fileRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface py-8 text-sm text-muted transition hover:border-coral/40 hover:text-fg">
        <Upload size={18} strokeWidth={1.75} /> Choose a CSV file
      </button>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
      <p className="mt-2 font-mono text-[11px] text-muted">
        Columns: text, platforms, date, repeat (opt), category (opt). Platforms = handles or platform names, space-separated.
      </p>

      {done != null && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-mono text-xs text-emerald-400">
          <Check size={14} strokeWidth={2} /> Imported {done} post{done === 1 ? '' : 's'}.
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs text-muted">{validCount} of {rows.length} rows valid</span>
            <button onClick={runImport} disabled={busy || validCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition duration-100 enabled:hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40">
              {busy && <Loader2 size={15} strokeWidth={2} className="animate-spin" />}
              {busy ? 'Importing…' : `Import ${validCount} post${validCount === 1 ? '' : 's'}`}
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {rows.map((r, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${r.errors.length ? 'border-red-500/40 bg-red-500/5' : 'border-line bg-elevated'}`}>
                <span className="mt-0.5 shrink-0">
                  {r.errors.length
                    ? <AlertTriangle size={14} strokeWidth={1.75} className="text-red-400" />
                    : <Check size={14} strokeWidth={2} className="text-emerald-400" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{r.raw.text || <span className="text-muted">(no text)</span>}</p>
                  <p className="font-mono text-[10px] text-muted">
                    {r.raw.date} · {r.raw.platforms}{r.raw.repeat ? ` · ${r.raw.repeat}` : ''}
                  </p>
                  {r.errors.length > 0 && <p className="font-mono text-[10px] text-red-400">{r.errors.join(' · ')}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}