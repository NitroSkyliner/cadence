import { STATUS } from '../core/types.js'

const STYLES = {
  [STATUS.DRAFT]:      { label: 'Draft',      cls: 'border-line text-muted' },
  [STATUS.SCHEDULED]:  { label: 'Scheduled',  cls: 'border-coral/40 bg-coral/12 text-coral' },
  [STATUS.PUBLISHING]: { label: 'Publishing', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-400' },
  [STATUS.PUBLISHED]:  { label: 'Published',  cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
  [STATUS.FAILED]:     { label: 'Failed',     cls: 'border-red-500/40 bg-red-500/10 text-red-400' },
  [STATUS.PENDING]:  { label: 'Pending',  cls: 'border-amber-500/40 bg-amber-500/10 text-amber-400' },
  [STATUS.REJECTED]: { label: 'Rejected', cls: 'border-red-500/40 bg-red-500/10 text-red-400' },
}

export default function StatusPill({ status }) {
  const s = STYLES[status] ?? STYLES[STATUS.DRAFT]
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${s.cls}`}>
      {s.label}
    </span>
  )
}