import { useState, useEffect, useCallback } from 'react'
import { inventoryApi, forecastApi } from '../api/client'
import { Spinner, Tabs, StatusBadge, StockBar, ColorSwatch, Modal, AlertBanner } from '../components/UI'
import { fmtNum, colorHex } from '../utils/fmt'

const TABS = [
  { key: 'finished', label: 'Finished Goods' },
  { key: 'fabric',   label: 'Raw Fabric' },
]

const safeArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []

// ── Log types ──────────────────────────────────────────
const LOG_TYPES = [
  { value: 'finished_receipt', label: 'Finished Goods Receipt',  desc: 'Stock arrived from supplier — adds to inventory' },
  { value: 'fabric_receipt',   label: 'Fabric Receipt',          desc: 'Fabric roll/yardage received — adds to fabric stock' },
  { value: 'adjustment',       label: 'Manual Audit Adjustment',  desc: 'Correct stock after physical count — can add or subtract' },
  { value: 'waste',            label: 'Waste / Write-off',        desc: 'Damaged, lost, or scrapped stock — subtracts from inventory' },
]

// ── Adjustment modal — full audit support ──────────────
function AdjustmentModal({ onClose, onSaved }) {
  const [stockData, setStockData]   = useState(null)
  const [loadingStock, setLoadingStock] = useState(true)
  const [form, setForm]             = useState({
    log_type:    'adjustment',
    item_type:   'finished',  // 'finished' | 'fabric'
    product_id:  '',
    fabric_color:'',
    quantity:    '',
    note:        '',
  })
  const [preview, setPreview]   = useState(null)
  const [saving,  setSaving]    = useState(false)
  const [error,   setError]     = useState(null)

  // Load current stock for dropdown + preview
  useEffect(() => {
    inventoryApi.currentStock()
      .then(r => setStockData(r.data))
      .catch(() => setStockData({ finished: [], fabric: [] }))
      .finally(() => setLoadingStock(false))
  }, [])

  // Calculate live preview whenever item or quantity changes
  useEffect(() => {
    if (!stockData || !form.quantity) { setPreview(null); return }
    const qty = parseFloat(form.quantity)
    if (isNaN(qty)) { setPreview(null); return }

    if (form.item_type === 'finished' && form.product_id) {
      const item = stockData.finished.find(f => String(f.product_id) === String(form.product_id))
      if (item) {
        const after = Math.max(0, item.on_hand + qty)
        setPreview({ label: item.name, before: item.on_hand, after, unit: 'units', diff: qty })
      }
    } else if (form.item_type === 'fabric' && form.fabric_color) {
      const item = stockData.fabric.find(f => f.color === form.fabric_color)
      if (item) {
        const after = Math.max(0, item.on_hand + qty)
        setPreview({ label: `${form.fabric_color} Fabric`, before: item.on_hand, after, unit: 'sq yd', diff: qty })
      }
    }
  }, [form.product_id, form.fabric_color, form.quantity, form.item_type, stockData])

  // Sync item_type with log_type
  const setLogType = (log_type) => {
    const item_type = log_type === 'fabric_receipt' ? 'fabric' : 'finished'
    setForm(prev => ({ ...prev, log_type, item_type, product_id: '', fabric_color: '', quantity: '' }))
    setPreview(null)
  }

  const handleSave = async () => {
    setError(null)
    const qty = parseFloat(form.quantity)
    if (!form.quantity || isNaN(qty)) { setError('Please enter a quantity.'); return }
    if (form.item_type === 'finished' && !form.product_id) { setError('Please select a product.'); return }
    if (form.item_type === 'fabric' && !form.fabric_color) { setError('Please select a fabric colour.'); return }
    if (!form.note.trim()) { setError('Please add a note explaining this adjustment.'); return }

    // Waste and manual subtractions: negative quantity
    let finalQty = qty
    if (form.log_type === 'waste' && qty > 0) finalQty = -qty
    // For adjustment, the user enters positive or negative directly

    setSaving(true)
    try {
      const payload = {
        log_type:               form.log_type,
        fabric_color:           form.item_type === 'fabric' ? form.fabric_color : '',
        product:                form.item_type === 'finished' ? parseInt(form.product_id) : null,
        quantity_change_sq_yards: form.item_type === 'fabric'   ? finalQty : null,
        quantity_change_units:    form.item_type === 'finished' ? finalQty : null,
        note: form.note,
      }
      await inventoryApi.logCreate(payload)
      onSaved()
    } catch (e) {
      setError('Failed to save: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message))
    } finally { setSaving(false) }
  }

  const logTypeInfo = LOG_TYPES.find(t => t.value === form.log_type)
  const isAudit     = form.log_type === 'adjustment'
  const isWaste     = form.log_type === 'waste'

  return (
    <Modal title="Log Inventory Adjustment" onClose={onClose}>
      {error && <AlertBanner type="critical">{error}</AlertBanner>}

      {/* Log type selector */}
      <div className="form-group">
        <label className="form-label">Adjustment Type</label>
        <div className="resp-grid-2">
          {LOG_TYPES.map(t => (
            <label key={t.value} style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              padding: '10px 12px', border: `2px solid ${form.log_type === t.value ? 'var(--blue)' : 'var(--gray-200)'}`,
              borderRadius: 6, cursor: 'pointer', transition: 'border-color .12s',
              background: form.log_type === t.value ? 'var(--blue-light)' : '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="radio" name="log_type" value={t.value}
                  checked={form.log_type === t.value}
                  onChange={() => setLogType(t.value)}
                  style={{ accentColor: 'var(--blue)' }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{t.label}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--gray-500)', paddingLeft: 20 }}>{t.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Item type toggle — only for adjustment and waste */}
      {(isAudit || isWaste) && (
        <div className="form-group">
          <label className="form-label">Stock Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['finished','Finished Goods (units)'],['fabric','Raw Fabric (sq yd)']].map(([val, label]) => (
              <button key={val}
                className={'filter-chip' + (form.item_type === val ? ' active' : '')}
                onClick={() => setForm(prev => ({ ...prev, item_type: val, product_id: '', fabric_color: '', quantity: '' }))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Item selector */}
      {loadingStock
        ? <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Loading stock data…</div>
        : form.item_type === 'finished'
          ? (
            <div className="form-group">
              <label className="form-label">Product</label>
              <select className="form-select" value={form.product_id}
                onChange={e => setForm({ ...form, product_id: e.target.value })}>
                <option value="">Select product…</option>
                {(stockData?.finished || []).map(f => (
                  <option key={f.product_id} value={f.product_id}>
                    {f.sku} — {f.name} (currently: {fmtNum(f.on_hand)} units)
                  </option>
                ))}
              </select>
            </div>
          )
          : (
            <div className="form-group">
              <label className="form-label">Fabric Colour</label>
              <select className="form-select" value={form.fabric_color}
                onChange={e => setForm({ ...form, fabric_color: e.target.value })}>
                <option value="">Select colour…</option>
                {(stockData?.fabric || []).map(f => (
                  <option key={f.color} value={f.color}>
                    {f.color} (currently: {fmtNum(f.on_hand, 1)} sq yd)
                  </option>
                ))}
              </select>
            </div>
          )
      }

      {/* Quantity */}
      <div className="form-group">
        <label className="form-label">
          Quantity&nbsp;
          <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}>
            ({form.item_type === 'fabric' ? 'sq yards' : 'units'})
            {isAudit && ' — use negative number to subtract, positive to add'}
            {isWaste && ' — enter a positive number (will be deducted automatically)'}
            {!isAudit && !isWaste && ' — positive number added to stock'}
          </span>
        </label>
        <input className="form-input"
          type="number"
          step={form.item_type === 'fabric' ? '0.1' : '1'}
          value={form.quantity}
          onChange={e => setForm({ ...form, quantity: e.target.value })}
          placeholder={isAudit ? 'e.g. -5 to remove, +10 to add' : 'e.g. 50'}
        />
      </div>

      {/* Live preview */}
      {preview && (
        <div style={{
          background: parseFloat(form.quantity) >= 0 ? 'var(--green-light)' : 'var(--red-light)',
          border: `1px solid ${parseFloat(form.quantity) >= 0 ? '#A7F3D0' : '#FECACA'}`,
          borderRadius: 6, padding: '12px 14px', marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--gray-600)' }}>
            STOCK PREVIEW — {preview.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
            <div>
              <span style={{ color: 'var(--gray-500)' }}>Before: </span>
              <strong>{fmtNum(preview.before, preview.unit === 'sq yd' ? 1 : 0)} {preview.unit}</strong>
            </div>
            <div style={{ fontSize: 18, color: 'var(--gray-400)' }}>→</div>
            <div>
              <span style={{ color: 'var(--gray-500)' }}>After: </span>
              <strong style={{ color: preview.after > preview.before ? 'var(--green)' : 'var(--red)' }}>
                {fmtNum(preview.after, preview.unit === 'sq yd' ? 1 : 0)} {preview.unit}
              </strong>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gray-500)' }}>
              Change: <strong style={{ color: preview.diff > 0 ? 'var(--green)' : 'var(--red)' }}>
                {preview.diff > 0 ? '+' : ''}{fmtNum(isWaste ? -Math.abs(preview.diff) : preview.diff, preview.unit === 'sq yd' ? 1 : 0)} {preview.unit}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Note — required */}
      <div className="form-group">
        <label className="form-label">
          Reason / Note <span style={{ color: 'var(--red)' }}>*</span>
        </label>
        <textarea className="form-textarea" value={form.note}
          onChange={e => setForm({ ...form, note: e.target.value })}
          placeholder={
            isAudit  ? 'e.g. Physical audit on 23 May 2026 — found 5 fewer units than system showed' :
            isWaste  ? 'e.g. 3 bags damaged in warehouse flood — written off' :
            form.log_type === 'fabric_receipt' ? 'e.g. Received 200 sq yd Sand Dune from Lakeside Fabrics — PO#1234' :
            'e.g. Received 30 GGB-SND from supplier — delivery note #5678'
          }
        />
        <div className="form-hint">Required. This is saved to the audit log permanently.</div>
      </div>

      <div className="form-row">
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Adjustment'}
        </button>
      </div>
    </Modal>
  )
}

// ── Main Inventory page ────────────────────────────────
export default function Inventory() {
  const [tab,        setTab]        = useState('finished')
  const [finished,   setFinished]   = useState([])
  const [fabric,     setFabric]     = useState([])
  const [alerts,     setAlerts]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [catFilter,  setCatFilter]  = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showLog,    setShowLog]    = useState(false)
  const [msg,        setMsg]        = useState(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const [f, fab, al] = await Promise.all([
        inventoryApi.finished(),
        inventoryApi.fabric(),
        forecastApi.reorderAlerts(),
      ])
      setFinished(safeArray(f.data))
      setFabric(safeArray(fab.data))
      setAlerts(safeArray(al.data))
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to load inventory.')
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const handleSaved = useCallback(async () => {
    setShowLog(false)
    setMsg({ type: 'success', text: 'Adjustment saved. Stock levels updated.' })
    await load()
    setTimeout(() => setMsg(null), 4000)
  }, [load])

  const getAlertFor    = (sku)   => alerts.find(a => a.sku === sku) || {}
  const getFabricAlert = (color) =>
    alerts.find(a => a.type === 'fabric' && typeof a.item === 'string' && a.item.startsWith(color)) || {}

  if (loading) return <Spinner />
  if (error)   return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)' }}>
      ⚠ {error} <button className="btn btn-outline btn-sm" style={{ marginLeft: 12 }} onClick={load}>Retry</button>
    </div>
  )

  const finishedFiltered = finished.filter(fg => {
    const cat = fg.product?.category_name || ''
    const al  = getAlertFor(fg.product?.sku)
    if (catFilter    !== 'all' && cat !== catFilter)                   return false
    if (statusFilter !== 'all' && (al.status || 'healthy') !== statusFilter) return false
    return true
  })

  return (
    <div>
      {msg && <AlertBanner type={msg.type === 'success' ? 'success' : 'critical'}>{msg.text}</AlertBanner>}

      <div className="flex items-center justify-between mb-4">
        <div />
        <button className="btn btn-primary btn-sm" onClick={() => setShowLog(true)}>
          + Log Adjustment
        </button>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ── FINISHED GOODS TAB ── */}
      {tab === 'finished' && (
        <>
          <div className="filters-row">
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Category:</span>
            {['all','bag','strap','towel'].map(c => (
              <button key={c} className={'filter-chip' + (catFilter === c ? ' active' : '')}
                onClick={() => setCatFilter(c)}>
                {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
            <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 8 }}>Status:</span>
            {['all','critical','low','healthy','overstock'].map(s => (
              <button key={s} className={'filter-chip' + (statusFilter === s ? ' active' : '')}
                onClick={() => setStatusFilter(s)}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th><th>Product</th><th>Category</th><th>On Hand</th>
                  <th>Stock Level</th><th>Cover (days)</th><th>30d Sales</th>
                  <th>Burn/day</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {finishedFiltered.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>
                    {finished.length === 0
                      ? 'No inventory data — fetch sales first or seed the database.'
                      : 'No items match the current filters.'}
                  </td></tr>
                ) : finishedFiltered.map(fg => {
                  const al  = getAlertFor(fg.product?.sku)
                  const pct = al.daily_burn > 0 ? Math.min(100, (fg.on_hand_units / (al.daily_burn * 60)) * 100) : 50
                  return (
                    <tr key={fg.id}>
                      <td className="sku-cell">{fg.product?.sku || '—'}</td>
                      <td>
                        <div className="font-medium">{fg.product?.name || '—'}</div>
                        {fg.product?.is_limited_edition && (
                          <span className="badge badge-blue" style={{ fontSize: 10 }}>Limited</span>
                        )}
                      </td>
                      <td><span className="badge badge-gray">{fg.product?.category_name || '—'}</span></td>
                      <td className="font-medium">{fmtNum(fg.on_hand_units)}</td>
                      <td><StockBar pct={pct} status={al.status} /></td>
                      <td>{al.cover_days != null ? Math.round(al.cover_days) : '∞'}</td>
                      <td>{al.daily_burn != null ? fmtNum(al.daily_burn * 30, 0) : '—'}</td>
                      <td>{al.daily_burn != null ? Number(al.daily_burn).toFixed(1) : '—'}</td>
                      <td><StatusBadge status={al.status || 'healthy'} /></td>
                      <td>
                        <button className="btn btn-outline btn-xs"
                          onClick={() => setShowLog(true)}
                          title="Log adjustment for this product">
                          Adjust
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── RAW FABRIC TAB ── */}
      {tab === 'fabric' && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colour</th><th>On Hand (sq yd)</th><th>Stock Level</th>
                <th>Cover (days)</th><th>Daily Burn (sq yd)</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {fabric.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>
                  No fabric data. Seed the database first.
                </td></tr>
              ) : fabric.map(f => {
                const al  = getFabricAlert(f.color)
                const pct = al.daily_burn > 0 ? Math.min(100, (f.on_hand_sq_yards / (al.daily_burn * 60)) * 100) : 50
                return (
                  <tr key={f.id}>
                    <td><ColorSwatch color={f.color} hex={colorHex(f.color)} /></td>
                    <td className="font-medium">{fmtNum(f.on_hand_sq_yards, 1)}</td>
                    <td><StockBar pct={pct} status={al.status} /></td>
                    <td>{al.cover_days != null ? Math.round(al.cover_days) : '∞'}</td>
                    <td>{al.daily_burn != null ? Number(al.daily_burn).toFixed(2) : '—'}</td>
                    <td><StatusBadge status={al.status || 'healthy'} /></td>
                    <td>
                      <button className="btn btn-outline btn-xs"
                        onClick={() => setShowLog(true)}
                        title="Log adjustment for this fabric">
                        Adjust
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showLog && (
        <AdjustmentModal onClose={() => setShowLog(false)} onSaved={handleSaved} />
      )}
    </div>
  )
}
