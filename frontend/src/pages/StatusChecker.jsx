import { useState, useEffect, useCallback } from 'react'
import { monitoringApi, settingsApi } from '../api/client'
import { Spinner, AlertBanner } from '../components/UI'
import { fmtDateTime } from '../utils/fmt'

const POLL_MS = 60000

export default function StatusChecker() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const [webhook,      setWebhook]      = useState('')
  const [webhookSaved,  setWebhookSaved] = useState('')
  const [webhookBusy,  setWebhookBusy]  = useState(false)
  const [webhookMsg,   setWebhookMsg]   = useState(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const { data } = await monitoringApi.status()
      setData(data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to load endpoint status.')
    }
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    settingsApi.getSystem().then(({ data }) => {
      setWebhook(data.slack_webhook_url || '')
      setWebhookSaved(data.slack_webhook_url || '')
    }).catch(() => {})
  }, [])

  const saveWebhook = async () => {
    setWebhookBusy(true); setWebhookMsg(null)
    try {
      await settingsApi.saveSystem({ slack_webhook_url: webhook })
      setWebhookSaved(webhook)
      setWebhookMsg({ type: 'success', text: 'Slack webhook saved.' })
    } catch {
      setWebhookMsg({ type: 'error', text: 'Could not save the webhook URL.' })
    } finally { setWebhookBusy(false) }
  }

  if (loading) return <Spinner />
  if (error)   return <div style={{ padding: 40, color: 'var(--red)', textAlign: 'center' }}>⚠ {error} <button className="btn btn-outline btn-sm" style={{ marginLeft: 12 }} onClick={load}>Retry</button></div>

  const allUp = data.down === 0

  return (
    <div>
      <div className="card card-pad mb-4" style={{
        display: 'flex', alignItems: 'center', gap: 14,
        borderLeft: `4px solid ${allUp ? 'var(--green)' : 'var(--red)'}`,
      }}>
        <div style={{ fontSize: 26 }}>{allUp ? '✅' : '⚠️'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {allUp ? 'All Systems Operational' : `${data.down} of ${data.total} endpoints down`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            {data.up} of {data.total} endpoints up · checked every 60 seconds · last checked {fmtDateTime(data.checked_at)}
          </div>
        </div>
      </div>

      <div className="card card-pad mb-4">
        <div className="section-title" style={{ marginBottom: 4 }}>Notifications</div>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 14 }}>
          A daily status report goes to <strong>matt@evansgolfcompany.com</strong> every 24 hours, plus Slack below
          if a webhook is set. If any endpoint is down, an alert also goes to matt@evansgolfcompany.com and
          the developer; otherwise the developer gets a daily all-clear listing every endpoint.
        </p>
        {webhookMsg && <AlertBanner type={webhookMsg.type === 'success' ? 'success' : 'critical'}>{webhookMsg.text}</AlertBanner>}
        <div className="form-group" style={{ maxWidth: 460 }}>
          <label className="form-label">Slack Webhook URL (optional)</label>
          <input className="form-input" value={webhook} onChange={e => setWebhook(e.target.value)}
            placeholder="https://hooks.slack.com/services/…" />
          <div className="form-hint">Leave blank to skip Slack notifications.</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={saveWebhook} disabled={webhookBusy || webhook === webhookSaved}>
          {webhookBusy ? 'Saving…' : 'Save Webhook'}
        </button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Endpoint</th><th>Path</th><th>Status</th><th>Code</th><th>Response Time</th><th>Last Checked</th></tr>
          </thead>
          <tbody>
            {data.endpoints.map(ep => (
              <tr key={ep.name}>
                <td className="font-medium">{ep.name}</td>
                <td className="sku-cell">{ep.path}</td>
                <td>
                  <span className={'badge ' + (ep.is_up ? 'badge-healthy' : 'badge-critical')}>
                    {ep.is_up ? 'Up' : ep.is_up === false ? 'Down' : 'Unknown'}
                  </span>
                </td>
                <td className="sku-cell">{ep.status_code ?? '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{ep.response_ms != null ? `${ep.response_ms} ms` : '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{fmtDateTime(ep.checked_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
