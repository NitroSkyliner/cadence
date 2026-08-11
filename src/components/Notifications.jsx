import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { API } from '../core/api.js'

const ICON = {
  published: { Icon: CheckCircle2, cls: 'text-emerald-400' },
  failed:    { Icon: AlertTriangle, cls: 'text-red-400' },
  pending:   { Icon: Clock, cls: 'text-amber-400' },
}

function ago(ms) {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function Notifications() {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const load = useCallback(async () => {
    try {
      const data = await (await fetch(`${API}/notifications`)).json()
      setItems(data.items || []); setUnread(data.unread || 0)
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t) }, [load])

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const toggle = async () => {
    const next = !open; setOpen(next)
    if (next && unread) { await fetch(`${API}/notifications/read`, { method: 'POST' }); setUnread(0) }
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} className="relative grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-elevated hover:text-fg">
        <Bell size={18} strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 font-mono text-[9px] text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-line bg-surface shadow-2xl">
          <p className="border-b border-line px-4 py-3 font-mono text-xs tracking-wider text-muted">NOTIFICATIONS</p>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => {
                const { Icon, cls } = ICON[n.kind] || ICON.published
                return (
                  <li key={n.id} className="flex items-start gap-3 border-b border-line/60 px-4 py-3 last:border-0">
                    <Icon size={16} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${cls}`} />
                    <div className="min-w-0">
                      <p className="text-sm text-fg">{n.title}</p>
                      <p className="truncate text-xs text-muted">{n.body}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted/60">{ago(n.created_at)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}