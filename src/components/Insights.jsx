import { useState } from 'react'
import { RefreshCw, Heart, Repeat2, MessageCircle } from 'lucide-react'
import { STATUS } from '../core/types.js'
import { isThisWeek } from '../core/dates.js'

function sumEngagement(posts) {
  return posts.reduce((acc, p) => {
    for (const m of Object.values(p.metrics || {})) {
      acc.likes += m.likes || 0
      acc.reposts += m.reposts || 0
      acc.replies += m.replies || 0
    }
    return acc
  }, { likes: 0, reposts: 0, replies: 0 })
}

export default function Insights({ posts, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false)

  const week = posts.filter((p) => isThisWeek(p.scheduledAt))
  const count = (s) => week.filter((p) => p.status === s).length
  const failed = count(STATUS.FAILED)
  const onTrack = failed === 0

  const published = week.filter((p) => p.status === STATUS.PUBLISHED)
  const eng = sumEngagement(published)

  const statusStats = [
    { label: 'scheduled', value: count(STATUS.SCHEDULED), tone: 'text-fg' },
    { label: 'published', value: count(STATUS.PUBLISHED), tone: 'text-emerald-400' },
    { label: 'failed',    value: failed, tone: failed ? 'text-red-400' : 'text-fg' },
  ]
  const engStats = [
    { label: 'likes',   value: eng.likes },
    { label: 'reposts', value: eng.reposts },
    { label: 'replies', value: eng.replies },
  ]

  const refresh = async () => {
    setRefreshing(true)
    try { await onRefresh() } finally { setRefreshing(false) }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-base font-medium tracking-tight">This week</h2>
            <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${
              onTrack ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-400'}`}>
              {onTrack ? 'On track' : 'Needs attention'}
            </span>
          </div>
          <div className="flex gap-10">
            {statusStats.map((s) => (
              <div key={s.label}>
                <div className={`font-mono text-3xl ${s.tone}`}>{s.value}</div>
                <div className="mt-1 text-xs text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-base font-medium tracking-tight">Engagement</h2>
            <button onClick={refresh} disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 font-mono text-[11px] text-muted transition hover:border-coral/40 hover:text-fg disabled:opacity-40">
              <RefreshCw size={13} strokeWidth={1.75} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'SYNCING' : 'REFRESH'}
            </button>
          </div>
          <div className="flex gap-10">
            {engStats.map((s) => (
              <div key={s.label}>
                <div className="font-mono text-3xl text-fg">{s.value}</div>
                <div className="mt-1 text-xs text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <p className="mb-4 font-mono text-xs tracking-wider text-muted">PUBLISHED · THIS WEEK</p>
        {published.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nothing published yet this week.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {published.map((p) => {
              const m = sumEngagement([p])
              return (
                <li key={p.id}
                  className="flex items-center gap-4 rounded-lg border border-line bg-elevated px-3 py-2.5">
                  <span className="flex-1 truncate text-sm text-fg">{p.text}</span>
                  <span className="flex items-center gap-1 font-mono text-xs text-muted"><Heart size={12} strokeWidth={1.75} /> {m.likes}</span>
                  <span className="flex items-center gap-1 font-mono text-xs text-muted"><Repeat2 size={12} strokeWidth={1.75} /> {m.reposts}</span>
                  <span className="flex items-center gap-1 font-mono text-xs text-muted"><MessageCircle size={12} strokeWidth={1.75} /> {m.replies}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}