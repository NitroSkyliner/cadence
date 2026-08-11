import { useState, useEffect } from 'react'
import { API } from '../core/api.js'
import { PLATFORMS } from '../core/types.js'

export default function LinkStats() {
  const [rows, setRows] = useState([])
  useEffect(() => {
    (async () => {
      try { setRows(await (await fetch(`${API}/links/stats`)).json()) }
      catch (err) { console.error('Failed to load link stats:', err) }
    })()
  }, [])

  if (rows.length === 0)
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <p className="text-sm text-muted">No tracked links yet. Set LINKS → “Track clicks” in the composer and post a link.</p>
      </div>
    )

  const total = rows.reduce((s, r) => s + r.clicks, 0)
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-coral/40 bg-coral/5 p-4">
        <div className="font-mono text-2xl text-coral">{total.toLocaleString()}</div>
        <div className="mt-1 text-xs text-muted">total clicks</div>
      </div>
      <section className="rounded-xl border border-line bg-surface p-5">
        <p className="mb-4 font-mono text-xs tracking-wider text-muted">TRACKED LINKS</p>
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border border-line bg-elevated px-3 py-2">
              <span className="rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] text-muted">{PLATFORMS[r.platform]?.short ?? r.platform}</span>
              <span className="flex-1 truncate font-mono text-xs text-muted">{r.url}</span>
              <span className="font-mono text-sm text-fg">{r.clicks.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}