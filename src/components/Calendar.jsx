import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { STATUS, PLATFORMS } from '../core/types.js'
import { startOfWeek, sameDay } from '../core/dates.js'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

const CHIP = {
  [STATUS.DRAFT]:      'border-line bg-elevated text-muted',
  [STATUS.SCHEDULED]:  'border-coral/40 bg-coral/12 text-coral',
  [STATUS.PUBLISHING]: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  [STATUS.PUBLISHED]:  'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  [STATUS.FAILED]:     'border-red-500/40 bg-red-500/10 text-red-400',
}

export default function Calendar({ posts }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const today = new Date()

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const label = weekStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const shift = (weeks) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + weeks * 7)
    setWeekStart(d)
  }

  const postsFor = (day) =>
    posts
      .filter((p) => sameDay(new Date(p.scheduledAt), day))
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-xs tracking-wider text-muted">CALENDAR</p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-fg">{label}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)}
              className="grid h-7 w-7 place-items-center rounded-lg border border-line text-muted transition hover:border-coral/40 hover:text-fg">
              <ChevronLeft size={15} strokeWidth={1.75} />
            </button>
            <button onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="rounded-lg border border-line px-2 py-1 font-mono text-[11px] text-muted transition hover:border-coral/40 hover:text-fg">
              TODAY
            </button>
            <button onClick={() => shift(1)}
              className="grid h-7 w-7 place-items-center rounded-lg border border-line text-muted transition hover:border-coral/40 hover:text-fg">
              <ChevronRight size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const isToday = sameDay(day, today)
          return (
            <div key={i}
              className={`flex min-h-32 flex-col rounded-lg border p-2 ${isToday ? 'border-coral/40' : 'border-line'}`}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-mono text-[10px] tracking-wider text-muted">{DAYS[i]}</span>
                <span className={`font-mono text-xs ${isToday ? 'text-coral' : 'text-muted'}`}>{day.getDate()}</span>
              </div>
              <div className="flex flex-col gap-1">
                {postsFor(day).map((p) => {
                  const time = new Date(p.scheduledAt).toLocaleTimeString(undefined, {
                    hour: '2-digit', minute: '2-digit', hour12: false,
                  })
                  const shorts = p.platforms.map((id) => PLATFORMS[id]?.short ?? id).join(' ')
                  return (
                    <div key={p.id} title={p.text}
                      className={`rounded border px-1.5 py-1 font-mono text-[10px] leading-tight ${CHIP[p.status] ?? CHIP[STATUS.DRAFT]}`}>
                      {time} · {shorts}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}