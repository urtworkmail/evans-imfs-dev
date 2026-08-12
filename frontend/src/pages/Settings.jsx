import { useState, useEffect } from 'react'
import { settingsApi, totpApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Spinner, AlertBanner, Tabs } from '../components/UI'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const TABS = [
  { key: 'schedule',     label: 'Fetch Schedule'        },
  { key: 'parameters',   label: 'Inventory Parameters'  },
  { key: 'integrations', label: 'API Integrations'      },
  { key: 'security',     label: 'Security'               },
]

// Derived helper — safe outside render
function weightTotal(system) {
  return (
    (parseFloat(system.forecast_weight_month1) || 0) +
    (parseFloat(system.forecast_weight_month2) || 0) +
    (parseFloat(system.forecast_weight_month3) || 0)
  )
}

export default function Settings() {
  const { user, refreshUser } = useAuth()
  const [tab,      setTab]      = useState('schedule')
  const [schedule, setSchedule] = useState({
    frequency: 'daily', day_of_week: null, time: '06:00', is_active: true,
  })
  const [system, setSystem] = useState({
    overstock_days:          '90',
    safety_buffer_days:      '14',
    peak_season_multiplier:  '1.15',
    forecast_weight_month1:  '50',
    forecast_weight_month2:  '30',
    forecast_weight_month3:  '20',
    login_lifetime_hours:    '24',
  })
  const [creds, setCreds] = useState({
    shopify_shop_url:     '',
    shopify_access_token: '',
    qb_client_id:         '',
    qb_client_secret:     '',
    qb_realm_id:          '',
    qb_refresh_token:     '',
    qb_environment:       'sandbox',
  })
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState(null)

  // ── TOTP / 2FA ──
  const [totpSetup,     setTotpSetup]     = useState(null)  // { secret, qr_code } while enrolling
  const [totpCode,      setTotpCode]      = useState('')
  const [totpBusy,      setTotpBusy]      = useState(false)
  const [totpError,     setTotpError]     = useState('')
  const [disablePwd,    setDisablePwd]    = useState('')
  const [showDisable,   setShowDisable]   = useState(false)

  useEffect(() => {
    Promise.all([settingsApi.getSchedule(), settingsApi.getSystem()])
      .then(([s, sys]) => {
        if (s.data) setSchedule(s.data)
        if (sys.data && Object.keys(sys.data).length) {
          const d = sys.data
          setSystem(prev => ({
            ...prev,
            overstock_days:         d.overstock_days         || prev.overstock_days,
            safety_buffer_days:     d.safety_buffer_days     || prev.safety_buffer_days,
            peak_season_multiplier: d.peak_season_multiplier || prev.peak_season_multiplier,
            forecast_weight_month1: d.forecast_weight_month1 || prev.forecast_weight_month1,
            forecast_weight_month2: d.forecast_weight_month2 || prev.forecast_weight_month2,
            forecast_weight_month3: d.forecast_weight_month3 || prev.forecast_weight_month3,
            login_lifetime_hours:   d.login_lifetime_hours   || prev.login_lifetime_hours,
          }))
          setCreds(prev => ({
            ...prev,
            shopify_shop_url:     d.shopify_shop_url     || '',
            shopify_access_token: d.shopify_access_token || '',
            qb_client_id:         d.qb_client_id         || '',
            qb_client_secret:     d.qb_client_secret     || '',
            qb_realm_id:          d.qb_realm_id          || '',
            qb_refresh_token:     d.qb_refresh_token     || '',
            qb_environment:       d.qb_environment       || 'sandbox',
          }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  const saveSchedule = async () => {
    setSaving(true)
    try   { await settingsApi.saveSchedule(schedule); showMsg('Fetch schedule saved.') }
    catch { showMsg('Error saving schedule.', 'error') }
    finally { setSaving(false) }
  }

  const saveSystem = async () => {
    setSaving(true)
    try   { await settingsApi.saveSystem(system); showMsg('Inventory parameters saved.') }
    catch { showMsg('Error saving parameters.', 'error') }
    finally { setSaving(false) }
  }

  const saveCreds = async () => {
    setSaving(true)
    try   { await settingsApi.saveSystem(creds); showMsg('API credentials saved.') }
    catch { showMsg('Error saving credentials.', 'error') }
    finally { setSaving(false) }
  }

  const startTotpSetup = async () => {
    setTotpBusy(true); setTotpError('')
    try {
      const { data } = await totpApi.setup()
      setTotpSetup(data)
      setTotpCode('')
    } catch {
      setTotpError('Failed to start setup. Try again.')
    } finally { setTotpBusy(false) }
  }

  const confirmTotpSetup = async () => {
    setTotpBusy(true); setTotpError('')
    try {
      await totpApi.verify(totpCode)
      setTotpSetup(null)
      setTotpCode('')
      await refreshUser()
      showMsg('Two-factor authentication enabled.')
    } catch (e) {
      setTotpError(e.response?.data?.detail || 'Invalid code.')
    } finally { setTotpBusy(false) }
  }

  const cancelTotpSetup = () => { setTotpSetup(null); setTotpCode(''); setTotpError('') }

  const disableTotp = async () => {
    setTotpBusy(true); setTotpError('')
    try {
      await totpApi.disable(disablePwd)
      setShowDisable(false)
      setDisablePwd('')
      await refreshUser()
      showMsg('Two-factor authentication disabled.')
    } catch (e) {
      setTotpError(e.response?.data?.detail || 'Incorrect password.')
    } finally { setTotpBusy(false) }
  }

  if (loading) return <Spinner />

  const total = weightTotal(system)

  return (
    <div>
      {msg && (
        <AlertBanner type={msg.type === 'success' ? 'success' : 'critical'}>
          {msg.text}
        </AlertBanner>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ── FETCH SCHEDULE ── */}
      {tab === 'schedule' && (
        <div className="card card-pad">
          <div className="section-title">Automatic Data Fetch Schedule</div>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
            Configure when the system automatically pulls orders from Shopify and QuickBooks.
            Requires the Celery worker container to be running.
          </p>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Frequency</label>
              <select className="form-select" value={schedule.frequency}
                onChange={e => setSchedule({ ...schedule, frequency: e.target.value })}>
                <option value="manual">Manual only</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            {schedule.frequency === 'weekly' && (
              <div className="form-group">
                <label className="form-label">Day of Week</label>
                <select className="form-select" value={schedule.day_of_week ?? 0}
                  onChange={e => setSchedule({ ...schedule, day_of_week: parseInt(e.target.value) })}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            {schedule.frequency !== 'manual' && (
              <div className="form-group">
                <label className="form-label">Time (UTC)</label>
                <input className="form-input" type="time" value={schedule.time}
                  onChange={e => setSchedule({ ...schedule, time: e.target.value })} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 280, fontSize: 13, cursor: 'pointer' }}>
              Scheduled fetch active
              <input className="ios-switch" type="checkbox" checked={!!schedule.is_active}
                onChange={e => setSchedule({ ...schedule, is_active: e.target.checked })} />
            </label>
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveSchedule} disabled={saving}>
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
          <div className="separator" />
          <div style={{ background: 'var(--gray-50)', borderRadius: 6, padding: '14px 16px', fontSize: 13 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Container Status</div>
            <div className="resp-grid-2" style={{ color: 'var(--gray-600)' }}>
              <div>Celery Worker: <span className="badge badge-healthy" style={{ fontSize: 11 }}>Running</span></div>
              <div>Celery Beat: <span className="badge badge-healthy" style={{ fontSize: 11 }}>Running</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ── INVENTORY PARAMETERS ── */}
      {tab === 'parameters' && (
        <div className="card card-pad">
          <div className="section-title">Inventory Calculation Parameters</div>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
            These values control stock alert thresholds, reorder calculations, and demand forecasting.
          </p>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Overstock Threshold (days)</label>
              <input className="form-input" type="number" value={system.overstock_days}
                onChange={e => setSystem({ ...system, overstock_days: e.target.value })} />
              <div className="form-hint">Items with cover &gt; this value are flagged "Overstock"</div>
            </div>
            <div className="form-group">
              <label className="form-label">Safety Buffer (days)</label>
              <input className="form-input" type="number" value={system.safety_buffer_days}
                onChange={e => setSystem({ ...system, safety_buffer_days: e.target.value })} />
              <div className="form-hint">Added to lead time when calculating reorder quantity</div>
            </div>
            <div className="form-group">
              <label className="form-label">Peak Season Multiplier</label>
              <input className="form-input" type="number" step="0.05" min="1" max="3"
                value={system.peak_season_multiplier}
                onChange={e => setSystem({ ...system, peak_season_multiplier: e.target.value })} />
              <div className="form-hint">Applied Apr–Sep. 1.15 = +15% demand expected</div>
            </div>
          </div>

          <div className="separator" />

          <div className="section-title">Forecast Weighting — Last 3 Months</div>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
            Controls how much weight each month of sales history gets in the demand forecast.
            Month 1 = most recent 30 days. Month 2 = 31–60 days ago. Month 3 = 61–90 days ago.
            Values are automatically normalised to 100% on save.
          </p>
          <div className="resp-grid-3" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Month 1 — Most Recent (%)</label>
              <input className="form-input" type="number" min="1" max="98"
                value={system.forecast_weight_month1}
                onChange={e => setSystem({ ...system, forecast_weight_month1: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Month 2 — Middle (%)</label>
              <input className="form-input" type="number" min="1" max="98"
                value={system.forecast_weight_month2}
                onChange={e => setSystem({ ...system, forecast_weight_month2: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Month 3 — Oldest (%)</label>
              <input className="form-input" type="number" min="1" max="98"
                value={system.forecast_weight_month3}
                onChange={e => setSystem({ ...system, forecast_weight_month3: e.target.value })} />
            </div>
          </div>
          <div style={{ fontSize: 12, marginBottom: 16 }}>
            Current total:{' '}
            <span style={{ fontWeight: 600, color: total === 100 ? 'var(--green)' : 'var(--amber)' }}>
              {total}%{total !== 100 ? ' — will be auto-normalised to 100% on save' : ' ✓'}
            </span>
          </div>

          <button className="btn btn-primary btn-sm" onClick={saveSystem} disabled={saving}>
            {saving ? 'Saving…' : 'Save Parameters'}
          </button>
        </div>
      )}

      {/* ── API INTEGRATIONS ── */}
      {tab === 'integrations' && (
        <div>
          {/* Shopify */}
          <div className="card card-pad mb-4">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 22 }}>🛍️</div>
              <div style={{ flex: 1 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Shopify Integration</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Direct-to-consumer orders (DTC channel)</div>
              </div>
              <span className={'badge ' + (creds.shopify_shop_url ? 'badge-healthy' : 'badge-gray')}>
                {creds.shopify_shop_url ? 'Configured' : 'Using mock data'}
              </span>
            </div>
            <div style={{
              background: 'var(--blue-light)', border: '1px solid var(--blue-mid)',
              borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#1E3A8A',
            }}>
              <strong>Setup:</strong> Shopify Admin → Settings → Apps → Develop apps → Create app →
              Enable Orders (read) scope → Get Admin API access token.
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Shop URL</label>
                <input className="form-input" value={creds.shopify_shop_url}
                  onChange={e => setCreds({ ...creds, shopify_shop_url: e.target.value })}
                  placeholder="yourshop.myshopify.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Access Token</label>
                <input className="form-input" type="password" value={creds.shopify_access_token}
                  onChange={e => setCreds({ ...creds, shopify_access_token: e.target.value })}
                  placeholder="shpat_xxxxxxxxxxxxxxxx" />
              </div>
            </div>
          </div>

          {/* QuickBooks */}
          <div className="card card-pad mb-4">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 22 }}>📊</div>
              <div style={{ flex: 1 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>QuickBooks Integration</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Wholesale orders via QB Invoices</div>
              </div>
              <span className={'badge ' + (creds.qb_client_id ? 'badge-healthy' : 'badge-gray')}>
                {creds.qb_client_id ? 'Configured' : 'Using mock data'}
              </span>
            </div>
            <div style={{
              background: 'var(--blue-light)', border: '1px solid var(--blue-mid)',
              borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#1E3A8A',
            }}>
              <strong>Setup:</strong> developer.intuit.com → Create app → Get Client ID &amp; Secret →
              Use OAuth Playground to get Refresh Token → Get Company ID from QB URL.
              <br /><strong>Item matching:</strong> QB Invoice line item names must match product SKUs (e.g. GGB-SND).
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Client ID</label>
                <input className="form-input" value={creds.qb_client_id}
                  onChange={e => setCreds({ ...creds, qb_client_id: e.target.value })}
                  placeholder="ABxxxxxxxxxxxxxxxx" />
              </div>
              <div className="form-group">
                <label className="form-label">Client Secret</label>
                <input className="form-input" type="password" value={creds.qb_client_secret}
                  onChange={e => setCreds({ ...creds, qb_client_secret: e.target.value })}
                  placeholder="xxxxxxxxxxxxxxxx" />
              </div>
              <div className="form-group">
                <label className="form-label">Company ID (Realm ID)</label>
                <input className="form-input" value={creds.qb_realm_id}
                  onChange={e => setCreds({ ...creds, qb_realm_id: e.target.value })}
                  placeholder="1234567890" />
              </div>
              <div className="form-group">
                <label className="form-label">Environment</label>
                <select className="form-select" value={creds.qb_environment}
                  onChange={e => setCreds({ ...creds, qb_environment: e.target.value })}>
                  <option value="sandbox">Sandbox (testing)</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Refresh Token</label>
                <input className="form-input" type="password" value={creds.qb_refresh_token}
                  onChange={e => setCreds({ ...creds, qb_refresh_token: e.target.value })}
                  placeholder="Long-lived refresh token from OAuth flow" />
                <div className="form-hint">System auto-refreshes access tokens. Update here if refresh token expires.</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={saveCreds} disabled={saving}>
              {saving ? 'Saving…' : 'Save API Credentials'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
              After saving, use the Fetch buttons on the Sales page to test the connection.
            </span>
          </div>

          <div className="separator" />
          <div style={{
            background: 'var(--amber-light)', border: '1px solid #FDE68A',
            borderRadius: 6, padding: '12px 16px', fontSize: 12, color: '#78350F',
          }}>
            <strong>⚠ Security note:</strong> Credentials are stored in the database.
            For production, set them as environment variables in your <code>.env</code> file instead —
            environment variables always take priority over database values.
          </div>
        </div>
      )}

      {/* ── SECURITY / TOTP ── */}
      {tab === 'security' && (
        <div className="card card-pad">
          <div className="section-title">Login Session Length</div>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
            How long a login lasts before requiring username/password (and the authentication
            code, for admins with 2FA enabled) again.
          </p>
          <div className="form-group" style={{ maxWidth: 220 }}>
            <label className="form-label">Session length (hours)</label>
            <input className="form-input" type="number" min="1" max="720"
              value={system.login_lifetime_hours}
              onChange={e => setSystem({ ...system, login_lifetime_hours: e.target.value })} />
            <div className="form-hint">Default 24. Applies to logins from the moment they happen.</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveSystem} disabled={saving}>
            {saving ? 'Saving…' : 'Save Session Length'}
          </button>

          <div className="separator" />

          <div className="section-title">Two-Factor Authentication</div>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
            Adds a second step to login using a standard authenticator app (Google Authenticator,
            Authy, 1Password, etc). Generated and verified entirely on this server — no third-party
            service involved. Available for admin accounts.
          </p>

          {user?.role !== 'admin' ? (
            <AlertBanner type="info">Two-factor authentication is only available for admin accounts.</AlertBanner>
          ) : totpError && <AlertBanner type="critical">{totpError}</AlertBanner>}

          {user?.role === 'admin' && !user?.totp_enabled && !totpSetup && (
            <button className="btn btn-primary btn-sm" onClick={startTotpSetup} disabled={totpBusy}>
              {totpBusy ? 'Starting…' : 'Enable Two-Factor Authentication'}
            </button>
          )}

          {totpSetup && (
            <div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 16 }}>
                <img src={totpSetup.qr_code} alt="TOTP QR code" width={160} height={160}
                  style={{ borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    1. Scan this QR code with your authenticator app.
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    Or enter this key manually:
                  </div>
                  <div className="sku-cell" style={{ fontSize: 13, background: 'var(--gray-100)', padding: '6px 10px', borderRadius: 6, display: 'inline-block', marginBottom: 12 }}>
                    {totpSetup.secret}
                  </div>
                  <div className="form-group" style={{ marginTop: 8, maxWidth: 200 }}>
                    <label className="form-label">2. Enter the 6-digit code</label>
                    <input className="form-input" type="text" inputMode="numeric" autoFocus
                      value={totpCode}
                      onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456" />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary btn-sm" onClick={confirmTotpSetup} disabled={totpBusy || totpCode.length !== 6}>
                      {totpBusy ? 'Verifying…' : 'Confirm & Enable'}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={cancelTotpSetup} disabled={totpBusy}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {user?.role === 'admin' && user?.totp_enabled && !totpSetup && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <span className="badge badge-healthy">Enabled</span>
              </div>
              {!showDisable ? (
                <button className="btn btn-outline btn-sm" onClick={() => setShowDisable(true)}>
                  Disable Two-Factor Authentication
                </button>
              ) : (
                <div style={{ maxWidth: 300 }}>
                  <div className="form-group">
                    <label className="form-label">Confirm your password to disable</label>
                    <input className="form-input" type="password" autoFocus
                      value={disablePwd} onChange={e => setDisablePwd(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-danger btn-sm" onClick={disableTotp} disabled={totpBusy || !disablePwd}>
                      {totpBusy ? 'Disabling…' : 'Confirm Disable'}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => { setShowDisable(false); setDisablePwd(''); setTotpError('') }} disabled={totpBusy}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
