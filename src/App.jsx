import { useState } from 'react'
import { Logo } from './components/Logo.jsx'
import Composer from './components/Composer.jsx'
import Queue from './components/Queue.jsx'
import Calendar from './components/Calendar.jsx'
import { usePosts } from './core/usePosts.js'
import { STATUS } from './core/types.js'
import Insights from './components/Insights.jsx'
import { ListChecks, CalendarDays, BarChart3, Plug } from 'lucide-react'
import Accounts from './components/Accounts.jsx'

const NAV = [
  { id: 'queue', label: 'Queue', icon: ListChecks },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'accounts', label: 'Accounts', icon: Plug },
]

export default function App() {
  const { posts, addPost, updatePost, deletePost, refreshMetrics } = usePosts()
  const [view, setView] = useState('queue')
  const scheduledCount = posts.filter((p) => p.status === STATUS.SCHEDULED).length
  const activeLabel = NAV.find((n) => n.id === view)?.label ?? ''
  const [editingId, setEditingId] = useState(null)
  const editing = posts.find((p) => p.id === editingId) || null

  const handleUpdate = async (id, changes) => {
    await updatePost(id, changes)
    setEditingId(null)
  }

  return (
    <div className="flex min-h-screen bg-ink font-display text-fg">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
        <div className="px-5 py-5"><Logo /></div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map(({ id, label, icon: Icon, soon }) => (
            <button key={id} onClick={() => !soon && setView(id)} disabled={soon}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition
                ${view === id ? 'bg-coral/12 text-fg'
                  : soon ? 'cursor-not-allowed text-muted/40'
                    : 'text-muted hover:bg-elevated hover:text-fg'}`}>
              <Icon size={18} strokeWidth={1.75} className={view === id ? 'text-coral' : ''} />
              {label}
              {soon && <span className="ml-auto font-mono text-[10px] tracking-wider text-muted/40">SOON</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto p-4">
          <button onClick={() => setView('accounts')}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm text-muted transition hover:border-coral/40 hover:text-fg">
            Connect account
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line px-8 py-4">
          <div>
            <h1 className="text-lg font-medium tracking-tight">{activeLabel}</h1>
            <p className="mt-0.5 font-mono text-xs text-muted">THIS WEEK · {scheduledCount} SCHEDULED</p>
          </div>
        </header>

        <main className="flex-1 p-8">
          {view === 'queue' && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
              <Composer
                editing={editing}
                onSchedule={addPost}
                onSaveDraft={addPost}
                onUpdate={handleUpdate}
                onCancelEdit={() => setEditingId(null)}
              />
              <Queue posts={posts} onEdit={setEditingId} onDelete={deletePost} />
            </div>
          )}
          {view === 'calendar' && <Calendar posts={posts} />}
          {view === 'insights' && <Insights posts={posts} onRefresh={refreshMetrics} />}
          {view === 'accounts' && <Accounts />}
        </main>
      </div>
    </div>
  )
}