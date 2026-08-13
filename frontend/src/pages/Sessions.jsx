import { useState, useEffect, useCallback } from 'react'
import { sessionsApi } from '../api/client'
import { Spinner, AlertBanner, MetricCard } from '../components/UI'
import { fmtDateTime, deviceLabel } from '../utils/fmt'

const ROLE_BADGE = {
  admin:              'badge badge-critical',
  general_manager:    'badge badge-blue',
  warehouse_manager:  'badge badge-healthy',
  sales_analyst:      'badge badge-overstock',
  viewer:             'badge badge-gray',
  custom:             'badge badge-gray',
}

export default function Sessions() {
  const [data,    setData]    = useState({ total_active: 0, sessions: [] })
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [msg,     setMsg]     = useState(null)
  const [busyId,  setBusyId]  = useState(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const { data } = await sessionsApi.list()
      setData(data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to load active sessions.')
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const endSession = async (session) => {
    if (!window.confirm(`End this login for ${session.full_name}? They'll be signed out immediately.`)) return
    setBusyId(session.id)
    try {
      await sessionsApi.revoke(session.id)
      setMsg({ type: 'success', text: 'Session ended.' })
      await load()
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Could not end that session.' })
    } finally { setBusyId(null) }
  }

  if (loading) return <Spinner />
  if (error)   return <div style={{ padding: 40, color: 'var(--red)', textAlign: 'center' }}>⚠ {error} <button className="btn btn-outline btn-sm" style={{ marginLeft: 12 }} onClick={load}>Retry</button></div>

  return (
    <div>
      {msg && <AlertBanner type={msg.type === 'success' ? 'success' : 'critical'}>{msg.text}</AlertBanner>}

      <div style={{ maxWidth: 260, marginBottom: 20 }}>
        <MetricCard label="Active Sessions" value={data.total_active} sub="Currently signed in" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{data.sessions.length} device{data.sessions.length === 1 ? '' : 's'} logged in</div>
        <button className="btn btn-outline btn-sm" onClick={() => { setLoading(true); load().finally(() => setLoading(false)) }}>Refresh</button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>User</th><th>Role</th><th>Device</th><th>IP Address</th><th>Signed in</th><th>Expires</th><th></th></tr>
          </thead>
          <tbody>
            {data.sessions.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>No active sessions.</td></tr>
            ) : data.sessions.map(s => (
              <tr key={s.id}>
                <td>
                  <div className="font-medium">{s.full_name}</div>
                  <div className="sku-cell">{s.username}{s.is_you && <span className="badge badge-gray" style={{ marginLeft: 6 }}>This device</span>}</div>
                </td>
                <td><span className={ROLE_BADGE[s.role] || 'badge badge-gray'}>{s.role}</span></td>
                <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>{deviceLabel(s.user_agent)}</td>
                <td className="sku-cell">{s.ip_address || '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{fmtDateTime(s.created_at)}</td>
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{fmtDateTime(s.expires_at)}</td>
                <td>
                  {!s.is_you && (
                    <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)' }}
                      disabled={busyId === s.id} onClick={() => endSession(s)}>
                      {busyId === s.id ? 'Ending…' : 'End Session'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
