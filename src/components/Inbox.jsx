import { useState, useEffect, useCallback } from 'react'
import { Reply, Loader2, RefreshCw, AtSign, MessageCircle } from 'lucide-react'
import { API } from '../core/api.js'
import { PLATFORMS } from '../core/types.js'

function ago(ms) {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export default function Inbox() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [replyTo, setReplyTo] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setItems(await (await fetch(`${API}/inbox`)).json()) }
    catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const open = (it) => { setReplyTo(it.id); setDraft(it.platform === 'mastodon' ? `@${it.author} ` : '') }

  const send = async (it) => {
    if (!draft.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`${API}/inbox/reply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conn_id: it.conn_id, reply_ctx: it.reply_ctx, text: draft.trim() }),
      })
      if (res.ok) { setReplyTo(null); setDraft('') }
    } finally { setBusy(false) }
  }

  if (loading) return <p className="py-8 text-center text-sm text-muted">Loading inbox…</p>

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-xs tracking-wider text-muted">INBOX · {items.length}</p>
        <button onClick={() => { setLoading(true); load() }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 font-mono text-[11px] text-muted transition hover:border-coral/40 hover:text-fg">
          <RefreshCw size={13} strokeWidth={1.75} /> REFRESH
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No mentions or replies across your connected accounts.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((it) => {
            const Icon = it.reason === 'mention' ? AtSign : MessageCircle
            const canReply = it.reply_ctx && Object.keys(it.reply_ctx).length > 0
            return (
              <div key={`${it.conn_id}-${it.id}`} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center gap-2">
                  <Icon size={14} strokeWidth={1.75} className="text-muted" />
                  <span className="text-sm font-medium text-fg">{it.author_name}</span>
                  <span className="font-mono text-[11px] text-muted">@{it.author}</span>
                  <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted">{PLATFORMS[it.platform]?.short ?? it.platform}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted/60">{ago(it.created_at)}</span>
                </div>
                {it.text && <p className="mt-2 whitespace-pre-wrap text-sm text-fg">{it.text}</p>}

                {canReply && (replyTo === it.id ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} autoFocus
                      className="w-full resize-none rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg outline-none transition focus:border-coral" />
                    <div className="flex gap-2">
                      <button onClick={() => send(it)} disabled={busy || !draft.trim()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-coral px-3 py-1.5 text-sm font-medium text-white transition duration-100 enabled:hover:-translate-y-1 disabled:opacity-40">
                        {busy ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Reply size={14} strokeWidth={2} />} Reply
                      </button>
                      <button onClick={() => { setReplyTo(null); setDraft('') }}
                        className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition hover:text-fg">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => open(it)} className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] text-muted transition hover:text-coral">
                    <Reply size={12} strokeWidth={2} /> REPLY
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}