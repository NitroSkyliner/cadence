import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { STATUS, PLATFORMS } from '../core/types.js'
import { startOfWeek, sameDay } from '../core/dates.js'
import StatusPill from './StatusPill.jsx'
import { useCategories } from '../core/useCategories.js'

const DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const EDITABLE = new Set([STATUS.DRAFT, STATUS.SCHEDULED, STATUS.FAILED])

const CHIP = {
  [STATUS.DRAFT]:      'border-line bg-elevated text-muted',
  [STATUS.SCHEDULED]:  'border-coral/40 bg-coral/12 text-coral',
  [STATUS.PUBLISHING]: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  [STATUS.PUBLISHED]:  'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  [STATUS.FAILED]:     'border-red-500/40 bg-red-500/10 text-red-400',
}

const short = (t) => {
  const platform = t.includes(':') ? t.split(':')[0] : t
  return PLATFORMS[platform]?.short ?? platform
}
const dayKey = (d) => d.toDateString()
const hhmm = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
const monthLabel = (d) => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

export default function Calendar({ posts, onReschedule }) {
  const [mode, setMode] = useState('week')     // week | month | list
  const [anchor, setAnchor] = useState(new Date())
  const [dragId, setDragId] = useState(null)
  const [overKey, setOverKey] = useState(null)
  const { categories } = useCategories()
  const catColor = (id) => categories.find((c) => c.id === id)?.color
  const today = new Date()

  const postsFor = (day) =>
    posts.filter((p) => sameDay(new Date(p.scheduledAt), day))
         .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))

  const reschedule = (day) => {
    setOverKey(null)
    const post = posts.find((p) => p.id === dragId)
    setDragId(null)
    if (!post || !onReschedule) return
    const orig = new Date(post.scheduledAt)
    if (sameDay(orig, day)) return
    const nd = new Date(day)
    nd.setHours(orig.getHours(), orig.getMinutes(), 0, 0)
    onReschedule(post.id, { scheduledAt: nd.toISOString() })
  }

  const shift = (dir) => {
    const d = new Date(anchor)
    if (mode === 'month') d.setMonth(d.getMonth() + dir)
    else d.setDate(d.getDate() + dir * 7)
    setAnchor(d)
  }

  const weekDays = () => {
    const s = startOfWeek(anchor)
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d })
  }
  const monthDays = () => {
    const s = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d })
  }
  const listGroups = () => {
    const sorted = [...posts].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    const groups = []; let cur = null
    for (const p of sorted) {
      const d = new Date(p.scheduledAt); const k = d.toDateString()
      if (!cur || cur.key !== k) { cur = { key: k, date: d, items: [] }; groups.push(cur) }
      cur.items.push(p)
    }
    return groups
  }

  const label = mode === 'month' ? monthLabel(anchor) : monthLabel(startOfWeek(anchor))

  const Chip = ({ p }) => {
    const editable = EDITABLE.has(p.status)
    return (
      <div title={p.text} draggable={editable}
        onDragStart={() => editable && setDragId(p.id)}
        onDragEnd={() => { setDragId(null); setOverKey(null) }}
        className={`rounded border px-1.5 py-1 font-mono text-[10px] leading-tight ${CHIP[p.status] ?? CHIP[STATUS.DRAFT]} ${editable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragId === p.id ? 'opacity-40' : ''}`}>
        <div className="flex items-center gap-1">
          {catColor(p.category) && (
            <span className="h-2.5 w-0.5 shrink-0 rounded-full" style={{ background: catColor(p.category) }} />
          )}
          <span className="truncate">{hhmm(p.scheduledAt)} · {p.platforms.map(short).join(' ')}</span>
        </div>
      </div>
    )
  }

  const DayCell = ({ day, compact }) => {
    const isToday = sameDay(day, today)
    const inMonth = day.getMonth() === anchor.getMonth()
    const isOver = overKey === dayKey(day)
    const dayPosts = postsFor(day)
    const shown = compact ? dayPosts.slice(0, 3) : dayPosts
    return (
      <div
        onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverKey(dayKey(day)) } }}
        onDragLeave={() => setOverKey((v) => (v === dayKey(day) ? null : v))}
        onDrop={() => reschedule(day)}
        className={`flex ${compact ? 'min-h-24' : 'min-h-32'} flex-col rounded-lg border p-2 transition
          ${isOver ? 'border-coral bg-coral/5' : isToday ? 'border-coral/40' : 'border-line'}
          ${compact && !inMonth ? 'opacity-40' : ''}`}>
        <div className="mb-2 flex justify-end">
          <span className={`font-mono text-xs ${isToday ? 'text-coral' : 'text-muted'}`}>{day.getDate()}</span>
        </div>
        <div className="flex flex-col gap-1">
          {shown.map((p) => <Chip key={p.id} p={p} />)}
          {compact && dayPosts.length > 3 && (
            <span className="font-mono text-[10px] text-muted">+{dayPosts.length - 3} more</span>
          )}
        </div>
      </div>
    )
  }

  const DowHeader = () => (
    <div className="mb-2 grid grid-cols-7 gap-2">
      {DOW.map((d) => <span key={d} className="px-1 font-mono text-[10px] tracking-wider text-muted">{d}</span>)}
    </div>
  )

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-line p-0.5">
          {['week', 'month', 'list'].map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 font-mono text-[11px] uppercase transition ${mode === m ? 'bg-coral text-white' : 'text-muted hover:text-fg'}`}>
              {m}
            </button>
          ))}
        </div>
        {mode !== 'list' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-fg">{label}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => shift(-1)} className="grid h-7 w-7 place-items-center rounded-lg border border-line text-muted transition hover:border-coral/40 hover:text-fg">
                <ChevronLeft size={15} strokeWidth={1.75} />
              </button>
              <button onClick={() => setAnchor(new Date())} className="rounded-lg border border-line px-2 py-1 font-mono text-[11px] text-muted transition hover:border-coral/40 hover:text-fg">
                TODAY
              </button>
              <button onClick={() => shift(1)} className="grid h-7 w-7 place-items-center rounded-lg border border-line text-muted transition hover:border-coral/40 hover:text-fg">
                <ChevronRight size={15} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        )}
      </div>

      {mode === 'week' && (
        <>
          <DowHeader />
          <div className="grid grid-cols-7 gap-2">
            {weekDays().map((d, i) => <DayCell key={i} day={d} />)}
          </div>
          <p className="mt-3 font-mono text-[11px] text-muted">Drag a scheduled post to another day to reschedule — its time stays the same.</p>
        </>
      )}

      {mode === 'month' && (
        <>
          <DowHeader />
          <div className="grid grid-cols-7 gap-2">
            {monthDays().map((d, i) => <DayCell key={i} day={d} compact />)}
          </div>
          <p className="mt-3 font-mono text-[11px] text-muted">Drag to reschedule across any day in view — its time stays the same.</p>
        </>
      )}

      {mode === 'list' && (
        <div className="flex flex-col">
          {listGroups().length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Nothing scheduled yet.</p>
          ) : listGroups().map((g) => (
            <div key={g.key}>
              <div className="mb-2 mt-4 font-mono text-[11px] tracking-wider text-muted first:mt-0">
                {g.date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              <div className="flex flex-col gap-2">
                {g.items.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border border-line bg-elevated px-3 py-2.5">
                    <span className="w-12 shrink-0 font-mono text-xs text-muted">{hhmm(p.scheduledAt)}</span>
                    <span className="flex-1 truncate text-sm text-fg">{p.text}</span>
                    <span className="flex shrink-0 gap-1">
                      {p.platforms.map((t) => (
                        <span key={t} className="rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] text-muted">{short(t)}</span>
                      ))}
                    </span>
                    <StatusPill status={p.status} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}