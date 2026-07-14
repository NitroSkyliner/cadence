import { PenSquare, ListChecks, CalendarDays, BarChart3 } from 'lucide-react'
import { Logo } from './components/Logo.jsx'
import Composer from './components/Composer.jsx'
import Queue from './components/Queue.jsx'
import { usePosts } from './core/usePosts.js'
import { STATUS } from './core/types.js'

const nav = [
  { id: 'compose',  label: 'Compose',  icon: PenSquare },
  { id: 'queue',    label: 'Queue',    icon: ListChecks },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
]

export default function App() {
  const { posts, addPost } = usePosts()
  const active = 'queue'
  const scheduledCount = posts.filter((p) => p.status === STATUS.SCHEDULED).length

  return (
    <div className="flex min-h-screen bg-ink font-display text-fg">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
        <div className="px-5 py-5"><Logo /></div>
        <nav className="flex flex-col gap-1 px-3">
          {nav.map(({ id, label, icon: Icon }) => (
            <button key={id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition
                ${active === id ? 'bg-coral/12 text-fg' : 'text-muted hover:bg-elevated hover:text-fg'}`}>
              <Icon size={18} strokeWidth={1.75} className={active === id ? 'text-coral' : ''} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto p-4">
          <button className="w-full rounded-lg border border-line px-3 py-2 text-sm text-muted transition hover:border-coral/40 hover:text-fg">
            Connect account
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line px-8 py-4">
          <div>
            <h1 className="text-lg font-medium tracking-tight">Queue</h1>
            <p className="mt-0.5 font-mono text-xs text-muted">THIS WEEK · {scheduledCount} SCHEDULED</p>
          </div>
        </header>

        <main className="grid flex-1 gap-6 p-8 lg:grid-cols-[minmax(0,380px)_1fr]">
          <Composer onSchedule={addPost} />
          <Queue posts={posts} />
        </main>
      </div>
    </div>
  )
}