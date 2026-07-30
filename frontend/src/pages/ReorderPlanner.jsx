import { useState, useEffect } from 'react'
import { forecastApi, purchasingApi } from '../api/client'
import { Spinner, AlertBanner, StatusBadge } from '../components/UI'
import { fmtMoney, fmtNum } from '../utils/fmt'
import { useAuth } from '../context/AuthContext'

// ── Order confirmation modal ───────────────────────────
function OrderConfirmModal({ alert, onConfirm, onCancel, saving }) {
  const [notes, setNotes] = useState('')
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Place Purchase Order</span>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--gray-50)', borderRadius: 6, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>ORDER SUMMARY</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="font-medium">{alert.item}</span>
              <StatusBadge status={alert.status} />
            </div>
            <div className="resp-grid-2" style={{ fontSize: 13, gap: 8 }}>
              <div><span style={{ color: 'var(--gray-500)' }}>Quantity: </span><strong>{fmtNum(alert.recommended_qty)} {alert.unit}</strong></div>
              <div><span style={{ color: 'var(--gray-500)' }}>Est. Cost: </span><strong>{fmtMoney(alert.cost_estimate)}</strong></div>
              <div><span style={{ color: 'var(--gray-500)' }}>Supplier: </span>{alert.supplier || '—'}</div>
              <div><span style={{ color: 'var(--gray-500)' }}>Lead Time: </span>{alert.lead_days}d</div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea className="form-textarea" value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Urgent reorder — stock critical" />
          </div>
          <div className="form-row">
            <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary" onClick={() => onConfirm(notes)} disabled={saving}>
              {saving ? 'Placing Order…' : 'Confirm Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Success toast ──────────────────────────────────────
function POSuccessToast({ po, onClose }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
      background: '#fff', border: '1px solid var(--gray-200)',
      borderRadius: 8, padding: '16px 20px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      minWidth: 260, maxWidth: '90vw',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 20 }}>✅</div>
        <div style={{ flex: 1 }}>
          <div className="font-medium" style={{ marginBottom: 2 }}>Purchase Order Placed</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>PO#{po.po_number}</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Supplier: {po.supplier_name || '—'}</div>
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 18, padding: 0 }}>✕</button>
      </div>
    </div>
  )
}

// ── Single reorder row — with data-label for mobile card view ──
function ReorderRow({ a, poStatus, onOrderClick, canOrder }) {
  const done = ['sent', 'confirmed', 'received'].includes(poStatus)
  return (
    <tr style={done ? { opacity: 0.55 } : {}}>
      <td>
        <div className="font-medium">{a.item}</div>
        <div className="sku-cell">{a.sku !== 'FABRIC' ? a.sku : 'Raw Fabric'}</div>
      </td>
      <td data-label="Type">
        <span className="badge badge-gray">{a.type === 'fabric' ? 'Fabric' : a.category}</span>
      </td>
      <td data-label="On Hand">
        {fmtNum(a.on_hand, a.unit === 'sq yd' ? 1 : 0)} <span className="text-muted">{a.unit}</span>
      </td>
      <td data-label="Burn/day">
        {a.daily_burn > 0 ? Number(a.daily_burn).toFixed(2) : '—'} <span className="text-muted">{a.unit}/d</span>
      </td>
      <td data-label="Cover">
        {a.cover_days != null
          ? <span style={{ color: a.cover_days < 14 ? 'var(--red)' : 'inherit', fontWeight: a.cover_days < 14 ? 600 : 400 }}>
              {Math.round(a.cover_days)}d
            </span>
          : '∞'}
      </td>
      <td data-label="Status"><StatusBadge status={a.status} /></td>
      <td data-label="Order By">
        <span style={{ fontWeight: a.order_by_label === 'Today' ? 700 : 400, color: a.order_by_label === 'Today' ? 'var(--red)' : 'inherit' }}>
          {a.order_by_label}
        </span>
      </td>
      <td data-label="Rec. Qty" className="font-medium">{fmtNum(a.recommended_qty)} {a.unit}</td>
      <td data-label="Est. Cost">{a.cost_estimate > 0 ? fmtMoney(a.cost_estimate) : '—'}</td>
      <td data-label="Supplier" className="text-muted" style={{ fontSize: 12 }}>{a.supplier || '—'}</td>
      <td data-label="Action">
        {done
          ? <span className="badge badge-healthy" style={{ fontSize: 11 }}>
              {poStatus === 'received' ? 'Received ✓' : 'Ordered ✓'}
            </span>
          : canOrder
            ? <button
                className={'btn btn-sm ' + (['critical', 'low'].includes(a.status) ? 'btn-primary' : 'btn-outline')}
                onClick={onOrderClick}
              >
                Order Now
              </button>
            : <span className="text-muted" style={{ fontSize: 12 }}>—</span>
        }
      </td>
    </tr>
  )
}

// ── Table wrapper ──────────────────────────────────────
function ReorderTable({ rows, alerts, orderedMap, onOrder, canOrder }) {
  if (rows.length === 0) return (
    <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)', marginBottom: 20 }}>
      No items in this category.
    </div>
  )
  return (
    <div className="card table-wrap table-reorder reorder-card-view" style={{ marginBottom: 20 }}>
      <table>
        <thead>
          <tr>
            <th>Item</th><th>Type</th><th>On Hand</th><th>Burn/day</th>
            <th>Cover</th><th>Status</th><th>Order By</th>
            <th>Rec. Qty</th><th>Est. Cost</th><th>Supplier</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(a => {
            const idx = alerts.indexOf(a)
            return (
              <ReorderRow
                key={idx}
                a={a}
                poStatus={orderedMap[idx]?.status}
                onOrderClick={() => onOrder(idx, a)}
                canOrder={canOrder}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────
export default function ReorderPlanner() {
  const { hasPermission } = useAuth()
  const canOrder = hasPermission('reorder.order')
  const [alerts,      setAlerts]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [ordering,    setOrdering]    = useState(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const [orderedMap,  setOrderedMap]  = useState({})
  const [toast,       setToast]       = useState(null)

  useEffect(() => {
    forecastApi.reorderAlerts()
      .then(r => setAlerts(Array.isArray(r.data) ? r.data : (r.data?.results || [])))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleConfirmOrder = async (notes) => {
    const { idx, alert } = ordering
    setSavingOrder(true)
    try {
      const { data: po } = await purchasingApi.placeOrder({
        item_type:    alert.type === 'fabric' ? 'fabric' : 'finished_goods',
        item_label:   alert.item,
        product_id:   alert.product_id || null,
        fabric_color: alert.type === 'fabric' ? alert.item.replace(' Fabric', '') : '',
        quantity:     alert.recommended_qty,
        unit:         alert.unit,
        unit_cost:    alert.cost_estimate > 0 && alert.recommended_qty > 0
                        ? alert.cost_estimate / alert.recommended_qty : 0,
        supplier_id:  alert.supplier_id || null,
        notes,
      })
      setOrderedMap(prev => ({ ...prev, [idx]: po }))
      setToast(po)
      setTimeout(() => setToast(null), 5000)
    } catch (e) {
      window.alert('Failed to place order: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message))
    } finally {
      setSavingOrder(false)
      setOrdering(null)
    }
  }

  if (loading) return <Spinner />
  if (error)   return <AlertBanner type="critical">⚠ {error}</AlertBanner>

  const urgent     = alerts.filter(a => ['critical', 'low'].includes(a.status))
  const monitoring = alerts.filter(a => !['critical', 'low'].includes(a.status))
  const totalCost  = urgent.reduce((s, a) => s + (a.cost_estimate || 0), 0)

  return (
    <div>
      {urgent.length > 0
        ? <AlertBanner type="warning">
            {urgent.length} item{urgent.length !== 1 ? 's' : ''} require reorder.
            &nbsp;Total estimated value: <strong>{fmtMoney(totalCost)}</strong>
          </AlertBanner>
        : <AlertBanner type="success">All items at healthy stock levels.</AlertBanner>
      }

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div className="section-title" style={{ color: 'var(--red)', marginBottom: 0 }}>🔴 Urgent — Order Required</div>
        <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>({urgent.length} items)</span>
      </div>
      <ReorderTable rows={urgent} alerts={alerts} orderedMap={orderedMap} canOrder={canOrder}
        onOrder={(idx, a) => setOrdering({ idx, alert: a })} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>🟢 Monitoring — Healthy / Overstock</div>
        <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>({monitoring.length} items)</span>
      </div>
      <ReorderTable rows={monitoring} alerts={alerts} orderedMap={orderedMap} canOrder={canOrder}
        onOrder={(idx, a) => setOrdering({ idx, alert: a })} />

      <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
        <strong>Cover days</strong> = on-hand ÷ daily burn. &nbsp;
        <strong>Order-by date</strong> = today + (cover − lead time). &nbsp;
        <strong>Rec. qty</strong> = (lead time + 14 buffer) × daily burn − on-hand, rounded to MOQ.
      </div>

      {ordering && (
        <OrderConfirmModal
          alert={ordering.alert}
          onConfirm={handleConfirmOrder}
          onCancel={() => setOrdering(null)}
          saving={savingOrder}
        />
      )}
      {toast && <POSuccessToast po={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
