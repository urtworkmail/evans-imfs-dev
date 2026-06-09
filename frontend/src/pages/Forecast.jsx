import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { forecastApi } from '../api/client'
import { Spinner, AlertBanner, StatusBadge, Tabs } from '../components/UI'
import { fmtNum } from '../utils/fmt'

const TABS   = [{ key: 'products', label: 'Product Forecast' }, { key: 'fabric', label: 'Fabric Consumption' }]
const COLORS = ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#BE185D']
const toArr  = (d) => Array.isArray(d) ? d : (Array.isArray(d?.results) ? d.results : [])

export default function Forecast() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [tab,     setTab]     = useState('products')

  useEffect(() => {
    forecastApi.forecast()
      .then(r => setData(toArr(r.data)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (error)   return <AlertBanner type="critical">⚠ {error}</AlertBanner>

  const criticals    = data.filter(d => d.status === 'critical').length
  const months       = data[0]?.projections?.map(p => p.month) || []
  const uniqueColors = [...new Set(data.filter(p => p.category !== 'towel').map(p => p.color))]

  const fabricChartData = months.map((month, mi) => {
    const entry = { month }
    data.filter(p => p.projections && p.daily_burn > 0 && p.category !== 'towel').forEach(p => {
      const proj = p.projections[mi]?.projected_units || 0
      const sq   = p.category === 'bag' ? 4.5 : p.category === 'strap' ? 1.2 : 0
      if (sq > 0 && p.color) entry[p.color] = (entry[p.color] || 0) + Math.round(proj * sq)
    })
    return entry
  })

  return (
    <div>
      <AlertBanner type="info">
        Forecast uses weighted moving average (50% last 30d · 30% prev 30d · 20% prior). Peak season multiplier applied Apr–Sep.
      </AlertBanner>
      {criticals > 0 && (
        <AlertBanner type="critical">
          {criticals} product{criticals > 1 ? 's' : ''} at critical stock — forecast shows continued stockout risk.
        </AlertBanner>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'products' && (
        <div className="card table-wrap table-forecast">
          <table>
            <thead>
              <tr>
                <th>Product</th><th>On Hand</th><th>Burn/day</th><th>Cover</th>
                {months.map(m => <th key={m}>{m}</th>)}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={5 + months.length} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>No data — fetch sales first.</td></tr>
              ) : data.map(p => (
                <tr key={p.product_id}>
                  <td>
                    <div className="font-medium">{p.name}</div>
                    <div className="sku-cell">{p.sku}</div>
                  </td>
                  <td>{fmtNum(p.on_hand)}</td>
                  <td>{p.daily_burn > 0 ? Number(p.daily_burn).toFixed(1) : '—'}</td>
                  <td>{p.cover_days != null ? Math.round(p.cover_days) + 'd' : '∞'}</td>
                  {(p.projections || []).map((proj, i) => (
                    <td key={i} style={{ textAlign: 'right' }}>
                      {proj.projected_units > 0 ? fmtNum(proj.projected_units) : <span className="text-muted">—</span>}
                    </td>
                  ))}
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'fabric' && (
        <div className="card card-pad">
          <div className="section-title">Projected Fabric Consumption by Color (sq yards / month)</div>
          <div className="chart-container" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fabricChartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {uniqueColors.map((color, i) => (
                  <Bar key={color} dataKey={color} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === uniqueColors.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 20 }}>
            <table>
              <thead><tr><th>Color</th>{months.map(m => <th key={m}>{m}</th>)}</tr></thead>
              <tbody>
                {uniqueColors.map(color => (
                  <tr key={color}>
                    <td className="font-medium">{color}</td>
                    {fabricChartData.map((row, i) => <td key={i} style={{ textAlign: 'right' }}>{fmtNum(row[color] || 0)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
