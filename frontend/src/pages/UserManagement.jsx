import { useState, useEffect, useCallback } from 'react'
import { usersApi } from '../api/client'
import { Spinner, Modal, AlertBanner } from '../components/UI'
import { fmtDate, initials } from '../utils/fmt'

const safeArray = (d) => Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []

// ── Permission module row — defined at module scope (no inner components) ──
function PermissionRow({ perm, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0 5px 32px', cursor: 'pointer', fontSize: 13, color: 'var(--gray-700)' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ width: 14, height: 14, accentColor: 'var(--blue)' }}
      />
      {perm.label}
    </label>
  )
}

function ModuleBlock({ mod, overrides, allChecked, onModuleToggle, onPermToggle }) {
  const [open, setOpen] = useState(true)
  const checkedCount = mod.permissions.filter(p => overrides[p.key] === true).length
  const total = mod.permissions.length

  return (
    <div style={{ borderBottom: '1px solid var(--gray-100)' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            checked={allChecked}
            onChange={e => { e.stopPropagation(); onModuleToggle(mod, e.target.checked) }}
            style={{ width: 15, height: 15, accentColor: 'var(--blue)' }}
            onClick={e => e.stopPropagation()}
          />
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-900)' }}>{mod.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{checkedCount}/{total}</span>
          <span style={{ fontSize: 11, color: 'var(--gray-400)', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform .15s' }}>▼</span>
        </div>
      </div>
      {open && (
        <div style={{ background: 'var(--gray-50)', paddingBottom: 4 }}>
          {mod.permissions.map(p => (
            <PermissionRow
              key={p.key}
              perm={p}
              checked={overrides[p.key] === true}
              onChange={e => onPermToggle(p.key, e.target.checked)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const ROLE_BADGE = {
  admin:           'badge badge-critical',
  general_manager: 'badge badge-blue',
  warehouse_manager:'badge badge-healthy',
  sales_analyst:   'badge badge-overstock',
  viewer:          'badge badge-gray',
  custom:          'badge badge-gray',
}

const EMPTY_FORM = {
  username: '', email: '', first_name: '', last_name: '',
  role: 'viewer', password: '', is_active: true, permissions_json: {},
}

export default function UserManagement() {
  const [users,    setUsers]   = useState([])
  const [config,   setConfig]  = useState({ modules: [], personas: [] })
  const [loading,  setLoading] = useState(true)
  const [error,    setError]   = useState(null)
  const [modal,    setModal]   = useState(null)
  const [form,     setForm]    = useState(EMPTY_FORM)
  const [saving,   setSaving]  = useState(false)
  const [msg,      setMsg]     = useState(null)
  const [activeTab,setActiveTab]= useState('details') // details | permissions

  const load = useCallback(async () => {
    try {
      setError(null)
      const [u, c] = await Promise.all([usersApi.list(), usersApi.permissionConfig()])
      setUsers(safeArray(u.data))
      setConfig(c.data || { modules: [], personas: [] })
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to load users.')
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const openAdd  = () => { setForm(EMPTY_FORM); setActiveTab('details'); setModal({ mode: 'add' }) }
  const openEdit = (u) => {
    setForm({ ...u, password: '', permissions_json: u.permissions_json || {} })
    setActiveTab('details')
    setModal({ mode: 'edit', data: u })
  }

  // Apply a persona preset — sets permissions_json to all keys in preset
  const applyPersona = (personaKey) => {
    const persona = config.personas.find(p => p.key === personaKey)
    if (!persona) return
    const newPerms = {}
    if (persona.permissions[0] === '*') {
      // wildcard = all permissions granted
      config.modules.forEach(mod => mod.permissions.forEach(p => { newPerms[p.key] = true }))
    } else {
      // First revoke all, then grant the persona's set
      config.modules.forEach(mod => mod.permissions.forEach(p => { newPerms[p.key] = false }))
      persona.permissions.forEach(k => { newPerms[k] = true })
    }
    setForm(prev => ({ ...prev, role: personaKey === 'admin' ? 'admin' : prev.role, permissions_json: newPerms }))
  }

  const handleModuleToggle = (mod, checked) => {
    setForm(prev => {
      const updated = { ...prev.permissions_json }
      mod.permissions.forEach(p => { updated[p.key] = checked })
      return { ...prev, permissions_json: updated }
    })
  }

  const handlePermToggle = (key, checked) => {
    setForm(prev => ({ ...prev, permissions_json: { ...prev.permissions_json, [key]: checked } }))
  }

  const handleSave = async () => {
    if (!form.username) { setMsg({ type: 'error', text: 'Username is required.' }); return }
    if (modal.mode === 'add' && !form.password) { setMsg({ type: 'error', text: 'Password is required for new users.' }); return }
    setSaving(true)
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password
      delete payload.effective_permissions
      delete payload.role_label
      if (modal.mode === 'add') await usersApi.create(payload)
      else await usersApi.update(form.id, payload)
      setMsg({ type: 'success', text: `User ${modal.mode === 'add' ? 'created' : 'updated'} successfully.` })
      setModal(null)
      await load()
    } catch (e) {
      const detail = e.response?.data
      setMsg({ type: 'error', text: 'Error: ' + (typeof detail === 'object' ? JSON.stringify(detail) : String(detail || e.message)) })
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) return
    try { await usersApi.delete(id); await load() }
    catch { setMsg({ type: 'error', text: 'Cannot delete this user.' }) }
  }

  const selectAllPerms = (checked) => {
    const updated = {}
    config.modules.forEach(mod => mod.permissions.forEach(p => { updated[p.key] = checked }))
    setForm(prev => ({ ...prev, permissions_json: updated }))
  }

  if (loading) return <Spinner />
  if (error)   return <div style={{ padding: 40, color: 'var(--red)', textAlign: 'center' }}>⚠ {error} <button className="btn btn-outline btn-sm" style={{ marginLeft: 12 }} onClick={load}>Retry</button></div>

  return (
    <div>
      {msg && <AlertBanner type={msg.type === 'success' ? 'success' : 'critical'}>{msg.text}</AlertBanner>}

      <div className="flex items-center justify-between mb-4">
        <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{users.length} users</div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add User</button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>No users found.</td></tr>
            ) : users.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="sidebar-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                      {initials(`${u.first_name || ''} ${u.last_name || u.username}`)}
                    </div>
                    <div>
                      <div className="font-medium">{u.first_name} {u.last_name}</div>
                      <div className="sku-cell">{u.username}</div>
                    </div>
                  </div>
                </td>
                <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{u.email || '—'}</td>
                <td><span className={ROLE_BADGE[u.role] || 'badge badge-gray'}>{u.role_label || u.role}</span></td>
                <td>{u.is_active ? <span className="badge badge-healthy">Active</span> : <span className="badge badge-gray">Inactive</span>}</td>
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{fmtDate(u.date_joined)}</td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-outline btn-xs" onClick={() => openEdit(u)}>Edit</button>
                    <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)' }} onClick={() => handleDelete(u.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          title={modal.mode === 'add' ? 'Add User' : `Edit: ${modal.data?.username}`}
          onClose={() => setModal(null)}
          size="modal-lg"
        >
          {/* Tab bar inside modal */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: 20, marginTop: -4 }}>
            {[['details','Account Details'],['permissions','Permissions']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  background: 'none', border: 'none', fontFamily: 'inherit',
                  color: activeTab === key ? 'var(--blue)' : 'var(--gray-500)',
                  borderBottom: activeTab === key ? '2px solid var(--blue)' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── DETAILS TAB ── */}
          {activeTab === 'details' && (
            <>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input className="form-input" value={form.first_name || ''} onChange={e => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="form-input" value={form.last_name || ''} onChange={e => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input className="form-input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={form.role}
                    onChange={e => { setForm({ ...form, role: e.target.value }); applyPersona(e.target.value) }}>
                    <option value="admin">Super Admin</option>
                    <option value="general_manager">General Manager</option>
                    <option value="warehouse_manager">Warehouse Manager</option>
                    <option value="sales_analyst">Sales Analyst</option>
                    <option value="viewer">Viewer</option>
                    <option value="custom">Custom</option>
                  </select>
                  <div className="form-hint">
                    {config.personas.find(p => p.key === form.role)?.description || 'Select a role to auto-populate permissions.'}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{modal.mode === 'add' ? 'Password *' : 'New Password (blank = keep current)'}</label>
                  <input className="form-input" type="password" value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
                </div>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  Account active
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--gray-500)', alignSelf: 'center' }}>Quick apply:</span>
                {config.personas.filter(p => p.key !== 'admin').map(p => (
                  <button key={p.key} className="btn btn-outline btn-xs"
                    onClick={() => { applyPersona(p.key); setActiveTab('permissions') }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── PERMISSIONS TAB ── */}
          {activeTab === 'permissions' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                  Customise exactly what this user can access.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline btn-xs" onClick={() => selectAllPerms(true)}>Select All</button>
                  <button className="btn btn-outline btn-xs" onClick={() => selectAllPerms(false)}>Clear All</button>
                </div>
              </div>

              <div style={{ border: '1px solid var(--gray-200)', borderRadius: 6, overflow: 'hidden', maxHeight: 380, overflowY: 'auto' }}>
                {config.modules.map(mod => {
                  const allChecked = mod.permissions.every(p => form.permissions_json[p.key] === true)
                  return (
                    <ModuleBlock
                      key={mod.key}
                      mod={mod}
                      overrides={form.permissions_json}
                      allChecked={allChecked}
                      onModuleToggle={handleModuleToggle}
                      onPermToggle={handlePermToggle}
                    />
                  )
                })}
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--gray-500)' }}>
                ℹ Permissions shown above override the role defaults. Super Admin always has full access regardless of these settings.
              </div>
            </>
          )}

          <div className="form-row">
            <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
            {activeTab === 'details' && (
              <button className="btn btn-outline" onClick={() => setActiveTab('permissions')}>Next: Permissions →</button>
            )}
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save User'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
