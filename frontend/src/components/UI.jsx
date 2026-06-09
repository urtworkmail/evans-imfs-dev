import { statusBadgeClass, statusLabel, progressFillClass } from '../utils/fmt'

// ── Modal ─────────────────────────────────────────────
export function Modal({ title, onClose, children, size = '' }) {
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────
export function StatusBadge({ status }) {
  return <span className={statusBadgeClass(status)}>{statusLabel(status)}</span>
}

// ── Spinner ───────────────────────────────────────────
export function Spinner() {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      Loading…
    </div>
  )
}

// ── Metric Card ───────────────────────────────────────
export function MetricCard({ label, value, sub, subColor }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub" style={subColor ? { color: subColor } : {}}>{sub}</div>}
    </div>
  )
}

// ── Stock bar ─────────────────────────────────────────
export function StockBar({ pct, status }) {
  return (
    <div className="progress-bar" style={{ minWidth: 70 }}>
      <div className={progressFillClass(status)} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
    </div>
  )
}

// ── Trend indicator ───────────────────────────────────
export function Trend({ current, previous }) {
  if (!previous || previous === 0) return <span className="trend-neutral">—</span>
  const pct = Math.round((current - previous) / previous * 100)
  if (pct > 0) return <span className="trend-up">↑ {pct}%</span>
  if (pct < 0) return <span className="trend-down">↓ {Math.abs(pct)}%</span>
  return <span className="trend-neutral">0%</span>
}

// ── Tabs ──────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button
          key={t.key}
          className={`tab-btn ${active === t.key ? 'active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Alert Banner ──────────────────────────────────────
export function AlertBanner({ type = 'warning', children }) {
  const cls = { critical: 'alert-critical', warning: 'alert-warning', info: 'alert-info', success: 'alert-success' }[type]
  const icon = { critical: '⚠', warning: '●', info: 'ℹ', success: '✓' }[type]
  return (
    <div className={`alert-banner ${cls}`}>
      <span>{icon}</span>
      <span>{children}</span>
    </div>
  )
}

// ── Color swatch ──────────────────────────────────────
export function ColorSwatch({ color, hex }) {
  return (
    <div className="flex items-center gap-2">
      <span className="color-swatch" style={{ background: hex }} />
      <span>{color}</span>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────
export function EmptyState({ icon = '📭', text = 'No data found' }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-text">{text}</div>
    </div>
  )
}

// ── Section card wrapper ──────────────────────────────
export function SectionCard({ title, action, children, style }) {
  return (
    <div className="card" style={style}>
      {(title || action) && (
        <div className="flex items-center justify-between" style={{ padding: '16px 20px 0' }}>
          {title && <div className="section-title" style={{ marginBottom: 0 }}>{title}</div>}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
