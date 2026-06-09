import { useState, useEffect } from 'react'
import { suppliersApi } from '../api/client'
import { Spinner, Modal, AlertBanner } from '../components/UI'
import { fmtMoney } from '../utils/fmt'

const safeArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []

const EMPTY = { name: '', contact_email: '', lead_time_days: 14, moq: '', cost_per_unit: '', notes: '' }

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = async () => {
    try {
      setError(null)
      const { data } = await suppliersApi.list()
      setSuppliers(safeArray(data))
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to load suppliers.')
    }
  }

  useEffect(() => { load().finally(() => setLoading(false)) }, [])

  const openAdd = () => { setForm(EMPTY); setModal({ mode: 'add' }) }
  const openEdit = (s) => { setForm({ ...s }); setModal({ mode: 'edit', data: s }) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        contact_email: form.contact_email || null,
        lead_time_days: parseInt(form.lead_time_days) || 0,
        moq: form.moq !== '' ? parseFloat(form.moq) : null,
        cost_per_unit: form.cost_per_unit !== '' ? parseFloat(form.cost_per_unit) : null,
        notes: form.notes || '',
      }
      if (modal.mode === 'add') await suppliersApi.create(payload)
      else await suppliersApi.update(form.id, payload)
      setMsg({ type: 'success', text: 'Supplier saved.' })
      setModal(null)
      await load()
    } catch (e) {
      const detail = e.response?.data
      setMsg({ type: 'error', text: 'Error: ' + (typeof detail === 'object' ? JSON.stringify(detail) : detail || e.message) })
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this supplier?')) return
    try { await suppliersApi.delete(id); await load() }
    catch { setMsg({ type: 'error', text: 'Cannot delete: supplier may be in use by products.' }) }
  }

  if (loading) return <Spinner />
  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)' }}>
      ⚠ {error} <button className="btn btn-outline btn-sm" style={{ marginLeft: 12 }} onClick={load}>Retry</button>
    </div>
  )

  return (
    <div>
      {msg && <AlertBanner type={msg.type === 'success' ? 'success' : 'critical'}>{msg.text}</AlertBanner>}
      <div className="flex items-center justify-between mb-4">
        <div />
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Supplier</button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Supplier</th><th>Email</th><th>Lead Time</th><th>MOQ</th><th>Cost/Unit</th><th>Notes</th><th></th></tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>
                No suppliers yet. Add one or seed the database.
              </td></tr>
            ) : suppliers.map(s => (
              <tr key={s.id}>
                <td className="font-medium">{s.name}</td>
                <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{s.contact_email || '—'}</td>
                <td>{s.lead_time_days}d</td>
                <td>{s.moq ?? '—'}</td>
                <td>{s.cost_per_unit ? fmtMoney(s.cost_per_unit) : '—'}</td>
                <td style={{ color: 'var(--gray-500)', fontSize: 12, maxWidth: 200 }}>{s.notes || '—'}</td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-outline btn-xs" onClick={() => openEdit(s)}>Edit</button>
                    <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)' }} onClick={() => handleDelete(s.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          title={modal.mode === 'add' ? 'Add Supplier' : `Edit: ${modal.data?.name}`}
          onClose={() => setModal(null)}
        >
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.contact_email || ''}
                onChange={e => setForm({ ...form, contact_email: e.target.value })} />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Lead Time (days)</label>
              <input className="form-input" type="number" value={form.lead_time_days}
                onChange={e => setForm({ ...form, lead_time_days: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">MOQ</label>
              <input className="form-input" type="number" value={form.moq || ''}
                onChange={e => setForm({ ...form, moq: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Cost per Unit ($)</label>
            <input className="form-input" type="number" step="0.01" value={form.cost_per_unit || ''}
              onChange={e => setForm({ ...form, cost_per_unit: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes || ''}
              onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="form-row">
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Supplier'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
