import { useState, useEffect, useCallback } from 'react'
import { monitoringApi } from '../api/client'
import { Spinner } from '../components/UI'
import { fmtBytes, fmtDateTime, progressFillClass } from '../utils/fmt'

const POLL_MS = 30000

const usageStatus = (pct) => pct >= 90 ? 'critical' : pct >= 70 ? 'low' : 'healthy'

function UsageCard({ label, pct, sub }) {
  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 600 }}>{pct != null ? `${pct.toFixed(1)}%` : '—'}</div>
      </div>
      <div className="progress-bar" style={{ height: 10, marginBottom: 10 }}>
        <div className={progressFillClass(usageStatus(pct || 0))} style={{ width: `${Math.min(100, Math.max(2, pct || 0))}%` }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{sub}</div>
    </div>
  )
}

export default function ServerUsage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const { data } = await monitoringApi.serverUsage()
      setData(data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to load server usage.')
    }
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  if (loading) return <Spinner />
  if (error)   return <div style={{ padding: 40, color: 'var(--red)', textAlign: 'center' }}>⚠ {error} <button className="btn btn-outline btn-sm" style={{ marginLeft: 12 }} onClick={load}>Retry</button></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
          Updated every 30 seconds · last measured {fmtDateTime(data.measured_at)}
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => { setLoading(true); load().finally(() => setLoading(false)) }}>Refresh</button>
      </div>

      <div className="resp-grid-3" style={{ marginBottom: 20 }}>
        <UsageCard label="CPU" pct={data.cpu_percent} sub={`${data.cpu_count} core${data.cpu_count === 1 ? '' : 's'}`} />
        <UsageCard label="Memory" pct={data.memory.percent} sub={`${fmtBytes(data.memory.used)} of ${fmtBytes(data.memory.total)}`} />
        <UsageCard label="Disk" pct={data.disk.percent} sub={`${fmtBytes(data.disk.used)} of ${fmtBytes(data.disk.total)}`} />
      </div>

      <div className="card card-pad">
        <div className="section-title">Load Average</div>
        <div className="resp-grid-3">
          <div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>1 minute</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{data.load_avg?.['1m'] != null ? data.load_avg['1m'].toFixed(2) : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>5 minutes</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{data.load_avg?.['5m'] != null ? data.load_avg['5m'].toFixed(2) : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>15 minutes</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{data.load_avg?.['15m'] != null ? data.load_avg['15m'].toFixed(2) : '—'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
