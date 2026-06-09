import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { forecastApi, salesApi } from '../api/client'
import { MetricCard, Spinner, AlertBanner, StatusBadge, SectionCard } from '../components/UI'
import { fmtMoney, fmtNum } from '../utils/fmt'

const toArr = (d) => Array.isArray(d) ? d : (Array.isArray(d?.results) ? d.results : [])
const toDay = () => new Date().toISOString().split('T')[0]
const nAgo  = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().split('T')[0] }

export default function Dashboard() {
  const [alerts,   setAlerts]   = useState([])
  const [monthly,  setMonthly]  = useState([])
  const [skuStats, setSkuStats] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      forecastApi.reorderAlerts(),
      salesApi.analysis({ start: nAgo(12), end: toDay() }),
    ])
      .then(([a, s]) => {
        setAlerts(toArr(a.data))
        setMonthly(toArr(s.data?.monthly).slice(-12))
        setSkuStats(toArr(s.data?.sku_stats))
      })
      .catch(e => setError(e.message || 'Failed to load dashboard data.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (error)   return <AlertBanner type="critical">⚠ {error}</AlertBanner>

  const criticals  = alerts.filter(a => a.status === 'critical')
  const lows       = alerts.filter(a => a.status === 'low')
  const totalRev   = monthly.reduce((s, m) => s + parseFloat(m.dtc_revenue || 0) + parseFloat(m.wholesale_revenue || 0), 0)
  const totalUnits = monthly.reduce((s, m) => s + (m.dtc_units || 0) + (m.wholesale_units || 0), 0)
  const last = monthly[monthly.length - 1] || {}
  const prev = monthly[monthly.length - 2] || {}
  const revLast  = parseFloat(last.dtc_revenue || 0) + parseFloat(last.wholesale_revenue || 0)
  const revPrev  = parseFloat(prev.dtc_revenue || 0) + parseFloat(prev.wholesale_revenue || 0)
  const revChg   = revPrev  ? Math.round((revLast  - revPrev)  / revPrev  * 100) : 0
  const uLast    = (last.dtc_units || 0) + (last.wholesale_units || 0)
  const uPrev    = (prev.dtc_units || 0) + (prev.wholesale_units || 0)
  const unitsChg = uPrev ? Math.round((uLast - uPrev) / uPrev * 100) : 0

  const chartData = monthly.map(m => ({ name: m.month, DTC: m.dtc_units || 0, Wholesale: m.wholesale_units || 0 }))
  const urgentAlerts = alerts.filter(a => ['critical', 'low'].includes(a.status)).slice(0, 8)

  return (
    <div>
      {criticals.length > 0 && (
        <AlertBanner type="critical">
          {criticals.length} item{criticals.length > 1 ? 's' : ''} at critical stock — immediate reorder required.
          <button className="link-btn" style={{ color: 'inherit', marginLeft: 8 }} onClick={() => navigate('/reorder')}>
            View Reorder Planner →
          </button>
        </AlertBanner>
      )}
      {lows.length > 0 && (
        <AlertBanner type="warning">
          {lows.length} item{lows.length > 1 ? 's' : ''} at low stock. Review within 7 days.
        </AlertBanner>
      )}

      <div className="metric-grid metric-grid-4 mb-5">
        <MetricCard label="Revenue (12 months)"  value={fmtMoney(totalRev)}   sub={`${revChg   >= 0 ? '↑' : '↓'} ${Math.abs(revChg)}% vs prev month`}   subColor={revChg   >= 0 ? 'var(--green)' : 'var(--red)'} />
        <MetricCard label="Units Sold (12 months)" value={fmtNum(totalUnits)} sub={`${unitsChg >= 0 ? '↑' : '↓'} ${Math.abs(unitsChg)}% vs prev month`} subColor={unitsChg >= 0 ? 'var(--green)' : 'var(--red)'} />
        <MetricCard label="Stock Alerts"  value={criticals.length + lows.length} sub={`${criticals.length} critical, ${lows.length} low`} subColor={criticals.length > 0 ? 'var(--red)' : 'var(--amber)'} />
        <MetricCard label="Items Monitored" value={alerts.length} sub="Finished goods + fabric" />
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <div className="section-title">Monthly Units Sold — Last 12 Months</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, color: 'var(--gray-500)' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#2563EB', borderRadius: 2, marginRight: 4 }} />DTC</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#93C5FD', borderRadius: 2, marginRight: 4 }} />Wholesale</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="DTC"       stackId="a" fill="#2563EB" />
                <Bar dataKey="Wholesale" stackId="a" fill="#93C5FD" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <SectionCard title="Urgent Reorder Needed">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>On Hand</th><th>Cover</th><th>Status</th></tr></thead>
              <tbody>
                {urgentAlerts.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 24 }}>All items at healthy levels ✓</td></tr>
                ) : urgentAlerts.map((a, i) => (
                  <tr key={i}>
                    <td>
                      <div className="font-medium">{a.item || '—'}</div>
                      <div className="sku-cell">{a.sku !== 'FABRIC' ? a.sku : a.category}</div>
                    </td>
                    <td>{fmtNum(a.on_hand)} {a.unit}</td>
                    <td>{a.cover_days != null ? `${Math.round(a.cover_days)}d` : '∞'}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray-100)' }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/reorder')}>View Full Reorder Planner →</button>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
