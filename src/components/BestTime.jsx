import { useMemo } from 'react'
import { STATUS } from '../core/types.js'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const engOf = (m) => (m.likes || 0) + (m.reposts || 0) + (m.replies || 0)
const postEng = (p) => Object.values(p.metrics || {}).reduce((s, m) => s + engOf(m), 0)

export default function BestTime({ posts }) {
  const published = useMemo(() => posts.filter((p) => p.status === STATUS.PUBLISHED), [posts])

  // Aggregate engagement + count into a 7 (day) × 24 (hour) grid.
  const { grid, maxAvg, best, hourTotals, count } = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ sum: 0, n: 0 })))
    const hourTotals = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }))
    for (const p of published) {
      const d = new Date(p.scheduledAt)
      const dow = (d.getDay() + 6) % 7          // Mon=0
      const hr = d.getHours()
      const e = postEng(p)
      grid[dow][hr].sum += e; grid[dow][hr].n += 1
      hourTotals[hr].sum += e; hourTotals[hr].n += 1
    }
    let maxAvg = 0, best = null
    for (let d = 0; d < 7; d++)
      for (let h = 0; h < 24; h++) {
        const cell = grid[d][h]
        if (!cell.n) continue
        const avg = cell.sum / cell.n
        if (avg > maxAvg) { maxAvg = avg; best = { d, h, avg, n: cell.n } }
      }
    return { grid, maxAvg, best, hourTotals, count: published.length }
  }, [published])

  const fmtHour = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`
  // Show a sensible daytime band unless data extends outside it.
  const hours = Array.from({ length: 18 }, (_, i) => i + 6)   // 6am–11pm

  const cellColor = (cell) => {
    if (!cell.n) return 'transparent'
    const t = maxAvg ? (cell.sum / cell.n) / maxAvg : 0
    return `rgba(255, 92, 56, ${0.12 + t * 0.78})`            // coral intensity by avg engagement
  }

  if (count < 3) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <p className="text-sm text-muted">Not enough history yet. Best-time needs a handful of published posts — keep posting and this fills in.</p>
        <p className="mt-1 font-mono text-[11px] text-muted/60">{count} published so far.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {best && (
        <section className="rounded-xl border border-coral/40 bg-coral/5 p-5">
          <p className="mb-1 font-mono text-xs tracking-wider text-coral">YOUR BEST WINDOW</p>
          <p className="text-lg font-medium text-fg">
            {DOW[best.d]} around {fmtHour(best.h)}
          </p>
          <p className="mt-1 text-sm text-muted">
            Posts then averaged {Math.round(best.avg).toLocaleString()} engagements
            {best.n < 3 ? ` (only ${best.n} post${best.n === 1 ? '' : 's'} — still thin)` : ''}.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-5">
        <p className="mb-4 font-mono text-xs tracking-wider text-muted">ENGAGEMENT BY DAY × HOUR</p>
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="flex">
              <div className="w-10 shrink-0" />
              {hours.map((h) => (
                <div key={h} className="flex-1 text-center font-mono text-[9px] text-muted/60">{h % 3 === 0 ? fmtHour(h) : ''}</div>
              ))}
            </div>
            {grid.map((row, d) => (
              <div key={d} className="flex items-center">
                <div className="w-10 shrink-0 font-mono text-[10px] text-muted">{DOW[d]}</div>
                {hours.map((h) => {
                  const cell = row[h]
                  return (
                    <div key={h} className="flex-1 px-0.5">
                      <div title={cell.n ? `${DOW[d]} ${fmtHour(h)} · avg ${Math.round(cell.sum / cell.n)} (${cell.n} post${cell.n === 1 ? '' : 's'})` : `${DOW[d]} ${fmtHour(h)} · no posts`}
                        className="h-6 rounded border border-line/50"
                        style={{ background: cellColor(cell) }} />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted/60">Darker = higher average engagement. Empty = you haven't posted then.</p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <p className="mb-4 font-mono text-xs tracking-wider text-muted">BEST HOURS OVERALL</p>
        <div className="flex flex-col gap-2">
          {hourTotals
            .map((t, h) => ({ h, avg: t.n ? t.sum / t.n : 0, n: t.n }))
            .filter((x) => x.n)
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 5)
            .map((x) => {
              const top = Math.max(1, ...hourTotals.map((t) => (t.n ? t.sum / t.n : 0)))
              return (
                <div key={x.h}>
                  <div className="mb-1 flex items-center justify-between font-mono text-xs">
                    <span className="text-fg">{fmtHour(x.h)}</span>
                    <span className="text-muted">{Math.round(x.avg).toLocaleString()} avg</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-elevated">
                    <div className="h-full rounded-full bg-coral/70" style={{ width: `${(x.avg / top) * 100}%` }} />
                  </div>
                </div>
              )
            })}
        </div>
      </section>
    </div>
  )
}