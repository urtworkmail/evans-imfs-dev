import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { salesApi } from '../api/client'
import { Spinner, AlertBanner, SectionCard, MetricCard } from '../components/UI'
import { fmtMoney, fmtNum } from '../utils/fmt'

const toArr = (d) => Array.isArray(d) ? d : (Array.isArray(d?.results) ? d.results : [])
const toDay = () => new Date().toISOString().split('T')[0]
const nAgo  = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0] }

export default function Sales() {
  const [monthly,  setMonthly]  = useState([])
  const [skuStats, setSkuStats] = useState([])
  const [fetchLogs,setFetchLogs]= useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [fetching, setFetching] = useState(null)
  const [msg,      setMsg]      = useState(null)
  const [channel,  setChannel]  = useState('')
  const [start,    setStart]    = useState(nAgo(365))
  const [end,      setEnd]      = useState(toDay())

  const load = useCallback(async () => {
    try {
      setError(null)
      const [a, fl] = await Promise.all([
        salesApi.analysis({ start, end, channel: channel || undefined }),
        salesApi.fetchStatus(),
      ])
      setMonthly(toArr(a.data?.monthly))
      setSkuStats(toArr(a.data?.sku_stats))
      setFetchLogs(toArr(fl.data))
    } catch (e) {
      setError(e.message || 'Failed to load sales data.')
    }
  }, [start, end, channel])

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)) }, [load])

  const triggerFetch = async (source) => {
    setFetching(source)
    try {
      const fn = source === 'shopify' ? salesApi.fetchShopify : salesApi.fetchQuickBooks
      const { data } = await fn()
      setMsg({ type: 'success', text: `${source === 'shopify' ? 'Shopify' : 'QuickBooks'}: ${data.orders_created} new orders fetched.` })
      await load()
    } catch {
      setMsg({ type: 'error', text: `Failed to fetch from ${source}.` })
    } finally { setFetching(null) }
  }

  if (loading) return <Spinner />

  const totalRev   = skuStats.reduce((s, x) => s + parseFloat(x.revenue || 0), 0)
  const totalUnits = skuStats.reduce((s, x) => s + (x.units || 0), 0)
  const totalFabric= skuStats.reduce((s, x) => s + (x.fabric_consumed || 0), 0)
  const chartData  = monthly.map(m => ({ name: m.month, DTC: m.dtc_units || 0, Wholesale: m.wholesale_units || 0 }))
  const lastShopify= fetchLogs.find(f => f.source === 'shopify')
  const lastQB     = fetchLogs.find(f => f.source === 'quickbooks')

  return (
    <div>
      {error && <AlertBanner type="critical">⚠ {error}</AlertBanner>}
      {msg   && <AlertBanner type={msg.type === 'success' ? 'success' : 'critical'}>{msg.text}</AlertBanner>}

      <div className="card card-pad mb-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--gray-500)' }}>
          <span>Shopify: {lastShopify ? `Last fetched ${new Date(lastShopify.fetched_at).toLocaleString()}` : 'Never fetched'}</span>
          <span>QuickBooks: {lastQB ? `Last fetched ${new Date(lastQB.fetched_at).toLocaleString()}` : 'Never fetched'}</span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={() => triggerFetch('shopify')}     disabled={!!fetching}>{fetching === 'shopify'     ? 'Fetching…' : '↓ Fetch Shopify'}</button>
          <button className="btn btn-outline btn-sm" onClick={() => triggerFetch('quickbooks')} disabled={!!fetching}>{fetching === 'quickbooks' ? 'Fetching…' : '↓ Fetch QuickBooks'}</button>
        </div>
      </div>

      <div className="filters-row mb-4">
        <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Channel:</span>
        {[['', 'All'], ['DTC', 'DTC (Shopify)'], ['wholesale', 'Wholesale (QB)']].map(([val, label]) => (
          <button key={val} className={'filter-chip' + (channel === val ? ' active' : '')} onClick={() => setChannel(val)}>{label}</button>
        ))}
        <span style={{ flexBasis: '100%', height: 0 }} /><span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Date:</span>
        <input className="form-input" style={{ minWidth: 0, flex: 1 }} type="date" value={start} onChange={e => setStart(e.target.value)} />
        <span style={{ color: 'var(--gray-400)' }}>–</span>
        <input className="form-input" style={{ minWidth: 0, flex: 1 }} type="date" value={end}   onChange={e => setEnd(e.target.value)} />
      </div>

      <div className="metric-grid metric-grid-3 mb-4">
        <MetricCard label="Total Revenue"          value={fmtMoney(totalRev)}             sub="Selected period" />
        <MetricCard label="Units Sold"             value={fmtNum(totalUnits)}             sub="Selected period" />
        <MetricCard label="Fabric Consumed"        value={`${fmtNum(totalFabric, 1)} sq yd`} sub="Bags and straps only" />
      </div>

      <div className="grid-2 mb-4">
        <div className="card card-pad">
          <div className="section-title">Monthly Units Sold</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, color: 'var(--gray-500)' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#2563EB', borderRadius: 2, marginRight: 4 }} />DTC</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#93C5FD', borderRadius: 2, marginRight: 4 }} />Wholesale</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="DTC"       stackId="a" fill="#2563EB" />
                <Bar dataKey="Wholesale" stackId="a" fill="#93C5FD" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <SectionCard title="Top SKUs by Volume">
          <div className="table-wrap">
            <table>
              <thead><tr><th>SKU</th><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
              <tbody>
                {skuStats.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)' }}>No data — fetch from Shopify / QuickBooks first.</td></tr>
                ) : skuStats.sort((a, b) => b.units - a.units).slice(0, 8).map((s, i) => (
                  <tr key={i}>
                    <td className="sku-cell">{s.sku}</td>
                    <td style={{ fontSize: 12 }}>{s.name}</td>
                    <td className="font-medium">{fmtNum(s.units)}</td>
                    <td>{fmtMoney(parseFloat(s.revenue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
