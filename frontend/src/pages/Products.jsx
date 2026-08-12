import { useState, useEffect } from 'react'
import { productsApi, suppliersApi } from '../api/client'
import { Spinner, Modal, ColorSwatch, AlertBanner } from '../components/UI'
import { colorHex } from '../utils/fmt'
import { useAuth } from '../context/AuthContext'

const safeArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []

const EMPTY = {
  sku: '', name: '', category: '', color: '',
  fabric_consumption_sq_yards: '', supplier: '',
  is_limited_edition: false, active: true,
}

export default function Products() {
  const { hasPermission } = useAuth()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [search, setSearch] = useState('')

  const load = async () => {
    try {
      setError(null)
      const [p, c, s] = await Promise.all([
        productsApi.list(),
        productsApi.categories(),
        suppliersApi.list(),
      ])
      setProducts(safeArray(p.data))
      setCategories(safeArray(c.data))
      setSuppliers(safeArray(s.data))
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to load products.')
    }
  }

  useEffect(() => { load().finally(() => setLoading(false)) }, [])

  const openAdd = () => { setForm(EMPTY); setModal({ mode: 'add' }) }
  const openEdit = (p) => {
    setForm({
      _id: p.id, sku: p.sku, name: p.name,
      category: p.category ?? '', color: p.color ?? '',
      fabric_consumption_sq_yards: p.fabric_consumption_sq_yards ?? '',
      supplier: p.supplier ?? '',
      is_limited_edition: p.is_limited_edition ?? false,
      active: p.active ?? true,
    })
    setModal({ mode: 'edit', data: p })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        sku: form.sku,
        name: form.name,
        category: form.category || null,
        color: form.color,
        fabric_consumption_sq_yards: form.fabric_consumption_sq_yards !== ''
          ? parseFloat(form.fabric_consumption_sq_yards) : null,
        supplier: form.supplier || null,
        is_limited_edition: form.is_limited_edition,
        active: form.active,
      }
      if (modal.mode === 'add') await productsApi.create(payload)
      else await productsApi.update(form._id, payload)
      setMsg({ type: 'success', text: `Product ${modal.mode === 'add' ? 'created' : 'updated'}.` })
      setModal(null)
      await load()
    } catch (e) {
      const detail = e.response?.data
      setMsg({ type: 'error', text: 'Error: ' + (typeof detail === 'object' ? JSON.stringify(detail) : detail || e.message) })
    } finally { setSaving(false) }
  }

  const filtered = products.filter(p =>
    !search ||
    (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <Spinner />
  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)' }}>
      ⚠ {error} <button className="btn btn-outline btn-sm" style={{ marginLeft: 12 }} onClick={() => load()}>Retry</button>
    </div>
  )

  return (
    <div>
      {msg && (
        <AlertBanner type={msg.type === 'success' ? 'success' : 'critical'}>{msg.text}</AlertBanner>
      )}
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: "wrap", gap: 10 }}>
        <input className="form-input" style={{ width: '100%', maxWidth: 300 }} placeholder="Search by name or SKU…"
          value={search} onChange={e => setSearch(e.target.value)} />
        {hasPermission('products.create') && (
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Product</button>
        )}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>SKU</th><th>Name</th><th>Category</th><th>Color</th>
              <th>Fabric (sq yd)</th><th>Supplier</th><th>Limited</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>
                {products.length === 0 ? 'No products found. Add one or seed the database.' : 'No products match search.'}
              </td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td className="sku-cell">{p.sku}</td>
                <td className="font-medium">{p.name}</td>
                <td><span className="badge badge-gray">{p.category_name || '—'}</span></td>
                <td><ColorSwatch color={p.color} hex={colorHex(p.color)} /></td>
                <td>{p.fabric_consumption_sq_yards != null ? p.fabric_consumption_sq_yards : '—'}</td>
                <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{p.supplier_name || '—'}</td>
                <td>{p.is_limited_edition
                  ? <span className="badge badge-blue">Yes</span>
                  : <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>No</span>}
                </td>
                <td>{p.active
                  ? <span className="badge badge-healthy">Active</span>
                  : <span className="badge badge-gray">Inactive</span>}
                </td>
                <td>
                  {hasPermission('products.edit') && (
                    <button className="btn btn-outline btn-xs" onClick={() => openEdit(p)}>Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          title={modal.mode === 'add' ? 'Add Product' : `Edit: ${modal.data?.name}`}
          onClose={() => setModal(null)}
        >
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">SKU *</label>
              <input className="form-input" value={form.sku}
                onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="e.g. GGB-COR" />
            </div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Product name" />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select className="form-select" value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">Select…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <input className="form-input" value={form.color}
                onChange={e => setForm({ ...form, color: e.target.value })} placeholder="e.g. Navy" />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Fabric (sq yd)</label>
              <input className="form-input" type="number" step="0.1" value={form.fabric_consumption_sq_yards}
                onChange={e => setForm({ ...form, fabric_consumption_sq_yards: e.target.value })}
                placeholder="Blank for towels" />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select className="form-select" value={form.supplier}
                onChange={e => setForm({ ...form, supplier: e.target.value })}>
                <option value="">No supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 28, marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
              Limited Edition
              <input className="ios-switch" type="checkbox" checked={form.is_limited_edition}
                onChange={e => setForm({ ...form, is_limited_edition: e.target.checked })} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
              Active
              <input className="ios-switch" type="checkbox" checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })} />
            </label>
          </div>
          <div className="form-row">
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Product'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
