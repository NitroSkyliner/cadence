import { useState, useEffect, useCallback } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { API } from '../core/api.js'
import { PLATFORMS } from '../core/types.js'

// Per-platform connect form fields. Add a platform here + a builder on the
// server registry and it becomes connectable with zero other UI changes.
const CONNECT_FIELDS = {
  bluesky: [
    { name: 'handle', placeholder: 'handle.bsky.social', type: 'text' },
    { name: 'app_password', placeholder: 'app password (xxxx-xxxx-xxxx-xxxx)', type: 'password', mono: true },
  ],
  mastodon: [
    { name: 'instance_url', placeholder: 'https://mastodon.social', type: 'text' },
    { name: 'access_token', placeholder: 'access token', type: 'password', mono: true },
  ],
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/accounts`)
      setAccounts(await res.json())
    } catch (err) {
      console.error('Failed to load accounts:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <p className="py-8 text-center text-sm text-muted">Loading accounts…</p>

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-4 font-mono text-xs tracking-wider text-muted">CONNECTED ACCOUNTS</p>
      <div className="flex flex-col gap-3">
        {accounts.map((acc) => <AccountRow key={acc.id} account={acc} onChange={load} />)}
      </div>
      <p className="mt-6 text-xs leading-relaxed text-muted">
        Credentials live on your local Cadence server, never in the browser. Connected platforms
        post for real; everything else runs on a mock adapter so you can build and test freely.
      </p>
    </div>
  )
}

function AccountRow({ account, onChange }) {
  const meta = PLATFORMS[account.id]
  const fields = CONNECT_FIELDS[account.id] || []
  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const setField = (name, v) => setValues((s) => ({ ...s, [name]: v }))
  const allFilled = fields.every((f) => (values[f.name] || '').trim())

  const connect = async () => {
    setBusy(true); setError(null)
    try {
      const body = Object.fromEntries(fields.map((f) => [f.name, (values[f.name] || '').trim()]))
      const res = await fetch(`${API}/accounts/${account.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.detail || 'Could not connect')
      }
      setValues({}); onChange()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true); setError(null)
    try {
      await fetch(`${API}/accounts/${account.id}`, { method: 'DELETE' })
      onChange()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-elevated font-mono text-xs text-muted">
            {meta?.short ?? account.id.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="text-sm font-medium text-fg">{meta?.label ?? account.id}</div>
            <div className="font-mono text-[11px] text-muted">
              {account.connected
                ? `Connected · ${account.account}`
                : account.supported ? 'Not connected' : 'Coming soon'}
            </div>
          </div>
        </div>
        {account.connected ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-400">
            <Check size={12} strokeWidth={2} /> Live
          </span>
        ) : account.supported ? (
          <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted">Mock</span>
        ) : (
          <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted/50">Soon</span>
        )}
      </div>

      {account.supported && !account.connected && (
        <div className="mt-4 flex flex-col gap-2">
          {fields.map((f) => (
            <input key={f.name} value={values[f.name] || ''} onChange={(e) => setField(f.name, e.target.value)}
              type={f.type} placeholder={f.placeholder}
              className={`rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg placeholder:text-muted outline-none transition focus:border-coral ${f.mono ? 'font-mono' : ''}`} />
          ))}
          {error && <p className="font-mono text-[11px] text-red-400">{error}</p>}
          <button onClick={connect} disabled={busy || !allFilled}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition duration-100 enabled:hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40">
            {busy && <Loader2 size={15} strokeWidth={2} className="animate-spin" />}
            {busy ? 'Verifying…' : 'Connect'}
          </button>
        </div>
      )}

      {account.connected && (
        <div className="mt-4 flex items-center gap-3">
          {error && <p className="flex-1 font-mono text-[11px] text-red-400">{error}</p>}
          <button onClick={disconnect} disabled={busy}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-40">
            {busy ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <X size={14} strokeWidth={2} />}
            Disconnect
          </button>
        </div>
      )}
    </section>
  )
}