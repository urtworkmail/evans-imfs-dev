import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { salesApi } from '../api/client'
import { Spinner, AlertBanner, MetricCard } from '../components/UI'
import { fmtMoney, fmtNum } from '../utils/fmt'

const toArr = (d) => Array.isArray(d) ? d : (Array.isArray(d?.results) ? d.results : [])
const nAgo  = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0] }

function ChgBadge({ a, b }) {
  if (b == null || b === 0) return null
  const pct = Math.round((a - b) / Math.abs(b) * 100)
  return <span style={{ color: a >= b ? 'var(--green)' : 'var(--red)', fontSize: 12 }}>{a >= b ? '↑' : '↓'} {Math.abs(pct)}%</span>
}

export default function Comparison() {
  const [p1Start, setP1Start] = useState(nAgo(90))
  const [p1End,   setP1End]   = useState(nAgo(61))
  const [p2Start, setP2Start] = useState(nAgo(60))
  const [p2End,   setP2End]   = useState(nAgo(1))
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const run = async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await salesApi.comparison(p1Start, p1End, p2Start, p2End)
      setResult(data)
    } catch (e) { setError(e.message || 'Failed to load comparison.') }
    finally { setLoading(false) }
  }

  const p1 = result?.period1
  const p2 = result?.period2

  const chartData = p1 && p2 ? (() => {
    const allSkus = new Set([...toArr(p1.sku_breakdown).map(s => s.sku), ...toArr(p2.sku_breakdown).map(s => s.sku)])
    return [...allSkus].map(sku => {
      const s1 = toArr(p1.sku_breakdown).find(s => s.sku === sku)
      const s2 = toArr(p2.sku_breakdown).find(s => s.sku === sku)
      return { sku, Period1: s1?.units || 0, Period2: s2?.units || 0 }
    }).sort((a, b) => (b.Period1 + b.Period2) - (a.Period1 + a.Period2)).slice(0, 10)
  })() : []

  return (
    <div>
      {error && <AlertBanner type="critical">⚠ {error}</AlertBanner>}

      <div className="card card-pad mb-4">
        <div className="section-title">Select Two Periods to Compare</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="resp-grid-2 comparison-periods">
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>PERIOD 1</div>
              <div className="flex gap-2 items-center">
                <input className="form-input" style={{ flex: 1, minWidth: 0 }} type="date" value={p1Start} onChange={e => setP1Start(e.target.value)} />
                <span style={{ color: 'var(--gray-400)', flexShrink: 0 }}>–</span>
                <input className="form-input" style={{ flex: 1, minWidth: 0 }} type="date" value={p1End}   onChange={e => setP1End(e.target.value)} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>PERIOD 2</div>
              <div className="flex gap-2 items-center">
                <input className="form-input" style={{ flex: 1, minWidth: 0 }} type="date" value={p2Start} onChange={e => setP2Start(e.target.value)} />
                <span style={{ color: 'var(--gray-400)', flexShrink: 0 }}>–</span>
                <input className="form-input" style={{ flex: 1, minWidth: 0 }} type="date" value={p2End}   onChange={e => setP2End(e.target.value)} />
              </div>
            </div>
          </div>
          <div>
            <button className="btn btn-primary" onClick={run} disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Loading…' : 'Compare Periods'}
            </button>
          </div>
        </div>
      </div>

      {loading && <Spinner />}

      {result && p1 && p2 && (
        <>
          <div className="metric-grid metric-grid-3 mb-4">
            {[
              { label: 'Total Units',    v1: p1.total_units,           v2: p2.total_units,           fmt: fmtNum },
              { label: 'Total Revenue',  v1: p1.total_revenue,         v2: p2.total_revenue,         fmt: fmtMoney },
              { label: 'Fabric (sq yd)', v1: p1.total_fabric_consumed, v2: p2.total_fabric_consumed, fmt: v => fmtNum(v, 1) },
            ].map(({ label, v1, v2, fmt }) => (
              <div key={label} className="metric-card">
                <div className="metric-label">{label}</div>
                <div className="resp-grid-2" style={{ marginTop: 8 }}>
                  <div><div style={{ fontSize: 11, color: 'var(--gray-500)' }}>Period 1</div><div style={{ fontSize: 18, fontWeight: 600 }}>{fmt(v1)}</div></div>
                  <div><div style={{ fontSize: 11, color: 'var(--gray-500)' }}>Period 2</div><div style={{ fontSize: 18, fontWeight: 600 }}>{fmt(v2)}</div></div>
                </div>
                <div className="metric-sub"><ChgBadge a={v2} b={v1} /> vs Period 1</div>
              </div>
            ))}
          </div>

          {chartData.length > 0 && (
            <div className="card card-pad mb-4">
              <div className="section-title">Units by SKU — Top 10</div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                    <XAxis dataKey="sku" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Period1" fill="#93C5FD" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Period2" fill="#2563EB" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="card table-wrap">
            <div style={{ padding: '16px 20px 0' }}><div className="section-title">SKU-Level Breakdown</div></div>
            <table>
              <thead><tr><th>SKU</th><th>Name</th><th>P1 Units</th><th>P2 Units</th><th>Δ Units</th><th>P1 Revenue</th><th>P2 Revenue</th><th>Δ Revenue</th></tr></thead>
              <tbody>
                {[...new Set([...toArr(p1.sku_breakdown).map(s => s.sku), ...toArr(p2.sku_breakdown).map(s => s.sku)])].map(sku => {
                  const s1 = toArr(p1.sku_breakdown).find(s => s.sku === sku) || { units: 0, revenue: 0 }
                  const s2 = toArr(p2.sku_breakdown).find(s => s.sku === sku) || { units: 0, revenue: 0 }
                  return (
                    <tr key={sku}>
                      <td className="sku-cell">{sku}</td>
                      <td style={{ fontSize: 12 }}>{s2.name || s1.name}</td>
                      <td>{fmtNum(s1.units)}</td>
                      <td>{fmtNum(s2.units)}</td>
                      <td><ChgBadge a={s2.units} b={s1.units} /></td>
                      <td>{fmtMoney(parseFloat(s1.revenue))}</td>
                      <td>{fmtMoney(parseFloat(s2.revenue))}</td>
                      <td><ChgBadge a={parseFloat(s2.revenue)} b={parseFloat(s1.revenue)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
