import { useState, useEffect, useCallback } from 'react'
import { purchasingApi } from '../api/client'
import { Spinner, AlertBanner, Modal, StatusBadge } from '../components/UI'
import { fmtMoney, fmtNum, fmtDate } from '../utils/fmt'
import { useAuth } from '../context/AuthContext'

const safeArray = (d) => Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []

const STATUS_OPTIONS = ['draft','sent','confirmed','received','cancelled']
const STATUS_COLORS  = { draft:'badge-gray', sent:'badge-blue', confirmed:'badge-overstock', received:'badge-healthy', cancelled:'badge-critical' }

function POStatusBadge({ status }) {
  return <span className={`badge ${STATUS_COLORS[status] || 'badge-gray'}`}>{status}</span>
}

function PODetailModal({ po, onClose, onStatusChange, onReceive, canOrder }) {
  const [updating, setUpdating] = useState(false)
  const [msg, setMsg] = useState(null)

  const changeStatus = async (newStatus) => {
    setUpdating(true)
    try {
      await onStatusChange(po.id, newStatus)
      setMsg({ type: 'success', text: `Status updated to "${newStatus}".` })
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed to update status.' })
    } finally { setUpdating(false) }
  }

  const receive = async () => {
    if (!window.confirm('Mark this PO as received? This will update inventory stock levels.')) return
    setUpdating(true)
    try {
      await onReceive(po.id)
      setMsg({ type: 'success', text: 'PO marked as received. Inventory updated.' })
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed to mark received.' })
    } finally { setUpdating(false) }
  }

  return (
    <Modal title={`Purchase Order — PO#${po.po_number}`} onClose={onClose} size="modal-lg">
      {msg && <AlertBanner type={msg.type === 'success' ? 'success' : 'critical'}>{msg.text}</AlertBanner>}

      <div className="resp-grid-2 po-detail-grid" style={{ marginBottom: 16, background: 'var(--gray-50)', borderRadius: 6, padding: 14 }}>
        <div><span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Status</span><br /><POStatusBadge status={po.status} /></div>
        <div><span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Supplier</span><br /><span className="font-medium">{po.supplier_name || '—'}</span></div>
        <div><span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Created</span><br /><span style={{ fontSize: 13 }}>{fmtDate(po.created_at)}</span></div>
        <div><span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Expected</span><br /><span style={{ fontSize: 13 }}>{po.expected_date ? fmtDate(po.expected_date) : '—'}</span></div>
        <div><span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Created by</span><br /><span style={{ fontSize: 13 }}>{po.created_by_name || '—'}</span></div>
        <div><span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Est. Cost</span><br /><span className="font-medium">{fmtMoney(po.estimated_cost)}</span></div>
      </div>

      {po.notes && (
        <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--gray-600)', background: 'var(--gray-50)', padding: '10px 14px', borderRadius: 6 }}>
          📝 {po.notes}
        </div>
      )}

      <div className="section-title">Order Items</div>
      <div className="card table-wrap" style={{ marginBottom: 16 }}>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit Cost</th><th>Total</th><th>Received</th></tr></thead>
          <tbody>
            {(po.items || []).map((item, i) => (
              <tr key={i}>
                <td className="font-medium">{item.item_label}</td>
                <td>{fmtNum(item.quantity, 1)}</td>
                <td>{item.unit}</td>
                <td>{fmtMoney(item.unit_cost)}</td>
                <td>{fmtMoney(item.total_cost)}</td>
                <td>{item.received_qty > 0 ? <span className="badge badge-healthy">{fmtNum(item.received_qty, 1)} ✓</span> : <span className="text-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canOrder && (
        <>
          <div className="section-title">Update Status</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {STATUS_OPTIONS.filter(s => s !== po.status).map(s => (
              <button key={s} className="btn btn-outline btn-sm" onClick={() => changeStatus(s)} disabled={updating}>
                Mark as "{s}"
              </button>
            ))}
            {po.status !== 'received' && po.status !== 'cancelled' && (
              <button className="btn btn-primary btn-sm" onClick={receive} disabled={updating}>
                ✓ Mark Received & Update Inventory
              </button>
            )}
          </div>
        </>
      )}

      <div className="form-row" style={{ marginTop: 16 }}>
        <button className="btn btn-outline" onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}

export default function PurchaseOrders() {
  const { hasPermission } = useAuth()
  const canOrder = hasPermission('reorder.order')
  const [orders,   setOrders]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [detail,   setDetail]   = useState(null)
  const [filter,   setFilter]   = useState('')
  const [msg,      setMsg]      = useState(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const params = filter ? { status: filter } : {}
      const { data } = await purchasingApi.list(params)
      setOrders(safeArray(data))
    } catch (e) {
      setError(e.message)
    }
  }, [filter])

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)) }, [load])

  const handleStatusChange = async (id, newStatus) => {
    await purchasingApi.updateStatus(id, newStatus)
    await load()
    if (detail?.id === id) {
      const { data } = await purchasingApi.get(id)
      setDetail(data)
    }
  }

  const handleReceive = async (id) => {
    await purchasingApi.markReceived(id)
    await load()
    if (detail?.id === id) {
      const { data } = await purchasingApi.get(id)
      setDetail(data)
    }
    setMsg({ type: 'success', text: 'Inventory updated from received PO.' })
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this purchase order?')) return
    try {
      await purchasingApi.delete(id)
      await load()
    } catch { setMsg({ type: 'error', text: 'Cannot delete this order.' }) }
  }

  if (loading) return <Spinner />
  if (error)   return <AlertBanner type="critical">⚠ {error} <button className="btn btn-outline btn-sm" style={{ marginLeft: 12 }} onClick={load}>Retry</button></AlertBanner>

  const totalOrdered   = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + parseFloat(o.estimated_cost || 0), 0)
  const pendingCount   = orders.filter(o => ['sent','confirmed'].includes(o.status)).length
  const receivedCount  = orders.filter(o => o.status === 'received').length

  return (
    <div>
      {msg && <AlertBanner type={msg.type === 'success' ? 'success' : 'critical'}>{msg.text}</AlertBanner>}

      <div className="metric-grid metric-grid-3 mb-5">
        <div className="metric-card">
          <div className="metric-label">Total Orders</div>
          <div className="metric-value">{orders.length}</div>
          <div className="metric-sub">{pendingCount} pending</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Value On Order</div>
          <div className="metric-value">{fmtMoney(totalOrdered)}</div>
          <div className="metric-sub">Excluding cancelled</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Received</div>
          <div className="metric-value">{receivedCount}</div>
          <div className="metric-sub">Inventory updated</div>
        </div>
      </div>

      <div className="filters-row mb-4">
        <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Status:</span>
        {[['','All'],...STATUS_OPTIONS.map(s => [s, s.charAt(0).toUpperCase()+s.slice(1)])].map(([val,label]) => (
          <button key={val} className={'filter-chip' + (filter === val ? ' active' : '')} onClick={() => setFilter(val)}>{label}</button>
        ))}
      </div>

      <div className="card table-wrap table-po">
        <table>
          <thead>
            <tr><th>PO Number</th><th>Type</th><th>Supplier</th><th>Status</th><th>Est. Cost</th><th>Expected</th><th>Created</th><th>Created By</th><th></th></tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
                No purchase orders yet. Use the Reorder Planner to place orders.
              </td></tr>
            ) : orders.map(o => (
              <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(o)}>
                <td><span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--blue)' }}>{o.po_number}</span></td>
                <td><span className="badge badge-gray">{o.order_type === 'fabric' ? 'Fabric' : 'Finished Goods'}</span></td>
                <td className="font-medium">{o.supplier_name || '—'}</td>
                <td><POStatusBadge status={o.status} /></td>
                <td>{fmtMoney(o.estimated_cost)}</td>
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{o.expected_date ? fmtDate(o.expected_date) : '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{fmtDate(o.created_at)}</td>
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{o.created_by_name || '—'}</td>
                <td onClick={e => e.stopPropagation()}>
                  {canOrder && (
                    <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)' }} onClick={() => handleDelete(o.id)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <PODetailModal
          po={detail}
          onClose={() => setDetail(null)}
          onStatusChange={handleStatusChange}
          onReceive={handleReceive}
          canOrder={canOrder}
        />
      )}
    </div>
  )
}
