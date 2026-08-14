import { useState, useEffect, useCallback } from 'react'
import { auditApi } from '../api/client'
import { Spinner } from '../components/UI'
import { fmtDateTime, deviceLabel } from '../utils/fmt'

const ACTIONS = [
  { value: '',                          label: 'All actions' },
  { value: 'auth.login',                label: 'Login' },
  { value: 'auth.login_failed',         label: 'Login Failed' },
  { value: 'auth.login_failed_totp',    label: 'Login Failed (2FA)' },
  { value: 'auth.logout',               label: 'Logout' },
  { value: 'session.revoked',           label: 'Session Ended' },
  { value: 'user.created',              label: 'User Created' },
  { value: 'user.updated',              label: 'User Updated' },
  { value: 'user.deleted',              label: 'User Deleted' },
  { value: 'user.totp_enabled',         label: '2FA Enabled' },
  { value: 'user.totp_disabled',        label: '2FA Disabled' },
  { value: 'settings.updated',          label: 'Settings Updated' },
  { value: 'settings.fetch_schedule_updated', label: 'Fetch Schedule Updated' },
  { value: 'settings.credentials_revealed',   label: 'Credentials Revealed' },
]
const ACTION_LABEL = Object.fromEntries(ACTIONS.filter(a => a.value).map(a => [a.value, a.label]))

const ACTION_BADGE = {
  'auth.login':                  'badge badge-healthy',
  'auth.login_failed':           'badge badge-critical',
  'auth.login_failed_totp':      'badge badge-critical',
  'auth.logout':                 'badge badge-gray',
  'session.revoked':             'badge badge-critical',
  'user.created':                'badge badge-healthy',
  'user.updated':                'badge badge-blue',
  'user.deleted':                'badge badge-critical',
  'user.totp_enabled':           'badge badge-healthy',
  'user.totp_disabled':          'badge badge-low',
  'settings.updated':            'badge badge-blue',
  'settings.fetch_schedule_updated': 'badge badge-blue',
  'settings.credentials_revealed':   'badge badge-overstock',
}

const PAGE_SIZE = 200

function detailsText(details) {
  if (!details || Object.keys(details).length === 0) return '—'
  return Object.entries(details).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')
}

export default function AuditLog() {
  const [rows,    setRows]    = useState([])
  const [count,   setCount]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [action,  setAction]  = useState('')
  const [username,setUsername]= useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const params = { page }
      if (action) params.action = action
      if (username) params.username = username
      const { data } = await auditApi.list(params)
      if (Array.isArray(data)) { setRows(data); setCount(data.length) }
      else { setRows(data.results || []); setCount(data.count ?? (data.results || []).length) }
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to load the audit log.')
    }
  }, [page, action, username])

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)) }, [load])

  const applyFilter = (setter) => (e) => { setPage(1); setter(e.target.value) }

  if (error) return <div style={{ padding: 40, color: 'var(--red)', textAlign: 'center' }}>⚠ {error} <button className="btn btn-outline btn-sm" style={{ marginLeft: 12 }} onClick={load}>Retry</button></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="form-select" style={{ minWidth: 200 }} value={action} onChange={applyFilter(setAction)}>
            {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <input className="form-input" style={{ minWidth: 180 }} placeholder="Filter by username…"
            value={username} onChange={applyFilter(setUsername)} />
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => { setLoading(true); load().finally(() => setLoading(false)) }}>Refresh</button>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div className="card table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Details</th><th>IP Address</th><th>Device</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>No matching activity.</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>{fmtDateTime(r.created_at)}</td>
                    <td className="font-medium">{r.actor_username || 'system'}</td>
                    <td><span className={ACTION_BADGE[r.action] || 'badge badge-gray'}>{ACTION_LABEL[r.action] || r.action}</span></td>
                    <td className="sku-cell">{r.target || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--gray-500)', maxWidth: 260 }}>{detailsText(r.details)}</td>
                    <td className="sku-cell">{r.ip_address || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>{deviceLabel(r.user_agent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {count > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-3">
              <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                Page {page} of {Math.ceil(count / PAGE_SIZE)} · {count} total
              </span>
              <div className="flex gap-2">
                <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                <button className="btn btn-outline btn-sm" disabled={page >= Math.ceil(count / PAGE_SIZE)} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
