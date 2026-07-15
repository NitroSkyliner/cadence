import { STATUS } from '../core/types.js'
import { isThisWeek } from '../core/dates.js'

export default function Insights({ posts }) {
  const week = posts.filter((p) => isThisWeek(p.scheduledAt))
  const count = (s) => week.filter((p) => p.status === s).length

  const failed = count(STATUS.FAILED)
  const onTrack = failed === 0

  const stats = [
    { label: 'scheduled', value: count(STATUS.SCHEDULED), tone: 'text-fg' },
    { label: 'published', value: count(STATUS.PUBLISHED), tone: 'text-emerald-400' },
    { label: 'failed',    value: failed, tone: failed ? 'text-red-400' : 'text-fg' },
  ]

  return (
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
          {stats.map((s) => (
            <div key={s.label}>
              <div className={`font-mono text-3xl ${s.tone}`}>{s.value}</div>
              <div className="mt-1 text-xs text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}