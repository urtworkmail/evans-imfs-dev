import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { monitoringApi } from '../api/client'

const POLL_MS = 60000

/* Persistent status pill, shown in the page header (top-right) for Super
   Admin — the closest equivalent to a "top bar" icon now that the old
   top bar was removed. Click to open the full Status Checker page. */
export default function StatusIndicator() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  const load = useCallback(() => {
    monitoringApi.status().then(({ data }) => setData(data)).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  if (!data) return null
  const allUp = data.down === 0

  return (
    <button
      onClick={() => navigate('/status')}
      title={allUp ? 'All systems operational' : `${data.down} endpoint(s) down`}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px', borderRadius: 999, border: '1px solid var(--gray-200)',
        background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
        color: 'var(--gray-600)', flexShrink: 0,
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: allUp ? 'var(--green)' : 'var(--red)',
        boxShadow: allUp ? '0 0 0 3px var(--green-light)' : '0 0 0 3px var(--red-light)',
      }} />
      {allUp ? 'Systems Operational' : `${data.down} Down`}
    </button>
  )
}
