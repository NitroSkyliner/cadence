import { useState, useEffect, useCallback } from 'react'
import { Loader2, Trash2, Shield, User as UserIcon } from 'lucide-react'
import { API } from '../core/api.js'

export default function Team({ currentUserId }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ email: '', password: '', role: 'member' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try { setUsers(await (await fetch(`${API}/users`)).json()) }
    catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const add = async () => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`${API}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Could not add user')
      setForm({ email: '', password: '', role: 'member' }); load()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const setRole = async (uid, role) => {
    await fetch(`${API}/users/${uid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
    load()
  }
  const remove = async (uid) => { await fetch(`${API}/users/${uid}`, { method: 'DELETE' }); load() }

  if (loading) return <p className="py-8 text-center text-sm text-muted">Loading team…</p>

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-4 font-mono text-xs tracking-wider text-muted">TEAM · {users.length}</p>
      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-elevated text-muted">
              {u.role === 'admin' ? <Shield size={16} strokeWidth={1.75} /> : <UserIcon size={16} strokeWidth={1.75} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-fg">{u.email}</div>
              <div className="font-mono text-[11px] text-muted">{u.role}{u.id === currentUserId ? ' · you' : ''}</div>
            </div>
            {u.id !== currentUserId && (
              <>
                <button onClick={() => setRole(u.id, u.role === 'admin' ? 'member' : 'admin')}
                  className="rounded-lg border border-line px-2.5 py-1 font-mono text-[11px] text-muted transition hover:border-coral/40 hover:text-fg">
                  Make {u.role === 'admin' ? 'member' : 'admin'}
                </button>
                <button onClick={() => remove(u.id)} className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:text-red-400">
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface p-5">
        <p className="mb-3 font-mono text-xs tracking-wider text-muted">ADD TEAMMATE</p>
        <div className="flex flex-col gap-2">
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="Email"
            className="rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg placeholder:text-muted outline-none transition focus:border-coral" />
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" placeholder="Temporary password (8+ chars)"
            className="rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg placeholder:text-muted outline-none transition focus:border-coral" />
          <div className="flex items-center gap-2">
            {['member', 'admin'].map((r) => (
              <button key={r} onClick={() => setForm({ ...form, role: r })}
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition ${form.role === r ? 'border-coral bg-coral/12 text-coral' : 'border-line text-muted hover:text-fg'}`}>
                {r}
              </button>
            ))}
          </div>
          {error && <p className="font-mono text-[11px] text-red-400">{error}</p>}
          <button onClick={add} disabled={busy || !form.email.trim() || form.password.length < 8}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition duration-100 enabled:hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40">
            {busy && <Loader2 size={15} strokeWidth={2} className="animate-spin" />} Add teammate
          </button>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">Share the email + temporary password with them to sign in.</p>
      </div>
    </div>
  )
}