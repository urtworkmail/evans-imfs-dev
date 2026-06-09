export const fmtMoney = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)

export const fmtNum = (n, dec = 0) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })

export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export const initials = (name = '') =>
  name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)

export const colorHex = (color) => {
  const map = {
    'Sand Dune': '#C8A97B',
    'Black': '#1F2937',
    'Navy': '#1E3A5F',
    'Red': '#DC2626',
    'Olive': '#556B2F',
    'Tan': '#D2B48C',
    'Coral': '#FF7F6E',
    'White': '#F3F4F6',
  }
  return map[color] || '#9CA3AF'
}

export const statusBadgeClass = (status) => {
  const map = { critical: 'badge-critical', low: 'badge-low', healthy: 'badge-healthy', overstock: 'badge-overstock' }
  return `badge ${map[status] || 'badge-gray'}`
}

export const statusLabel = (status) => {
  const map = { critical: 'Critical', low: 'Low', healthy: 'Healthy', overstock: 'Overstock' }
  return map[status] || status || '—'
}

export const progressFillClass = (status) => {
  const map = { critical: 'fill-critical', low: 'fill-low', healthy: 'fill-healthy', overstock: 'fill-overstock' }
  return `progress-fill ${map[status] || 'fill-healthy'}`
}

export const today = () => new Date().toISOString().split('T')[0]

export const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
