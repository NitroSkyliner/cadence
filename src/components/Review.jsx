import { useState, useEffect, useCallback } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { API } from '../core/api.js'
import { PLATFORMS } from '../core/types.js'

const short = (t) => PLATFORMS[t.includes(':') ? t.split(':')[0] : t]?.short ?? t

export default function Review({ onChange }) {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    try { setPending(await (await fetch(`${API}/posts/pending`)).json()) }
    catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const approve = async (id) => {
    setBusy(id)
    await fetch(`${API}/posts/${id}/approve`, { method: 'POST' })
    setBusy(null); load(); onChange?.()
  }
  const reject = async (id) => {
    const reason = prompt('Reason for rejection (optional)') ?? ''
    setBusy(id)
    await fetch(`${API}/posts/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
    setBusy(null); load(); onChange?.()
  }

  if (loading) return <p className="py-8 text-center text-sm text-muted">Loading review queue…</p>

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-4 font-mono text-xs tracking-wider text-muted">AWAITING REVIEW · {pending.length}</p>
      {pending.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Nothing to review. Members' posts land here before they publish.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {pending.map((p) => (
            <div key={p.id} className="rounded-xl border border-line bg-surface p-4">
              <p className="text-sm text-fg">{p.text}</p>
              <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-muted">
                <span>{new Date(p.scheduledAt).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="flex gap-1">{p.platforms.map((t) => <span key={t} className="rounded bg-elevated px-1.5 py-0.5">{short(t)}</span>)}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => approve(p.id)} disabled={busy === p.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-coral px-3 py-1.5 text-sm font-medium text-white transition duration-100 enabled:hover:-translate-y-1 disabled:opacity-40">
                  {busy === p.id ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Check size={14} strokeWidth={2} />} Approve & schedule
                </button>
                <button onClick={() => reject(p.id)} disabled={busy === p.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-40">
                  <X size={14} strokeWidth={2} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}