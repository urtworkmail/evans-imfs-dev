import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { initials } from '../utils/fmt'

const Icon = ({ d, size = 14 }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
    viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    {d}
  </svg>
)

const IcoDashboard  = () => <Icon d={<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>} />
const IcoInventory  = () => <Icon d={<><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>} />
const IcoReorder    = () => <Icon d={<><path d="M12 5v14M5 12l7-7 7 7"/></>} />
const IcoPO         = () => <Icon d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></>} />
const IcoProducts   = () => <Icon d={<><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></>} />
const IcoSuppliers  = () => <Icon d={<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>} />
const IcoSales      = () => <Icon d={<><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>} />
const IcoForecast   = () => <Icon d={<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>} />
const IcoComparison = () => <Icon d={<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>} />
const IcoUsers      = () => <Icon d={<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>} />
const IcoSettings   = () => <Icon d={<><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></>} />

const NAV = [
  { section: 'Overview', items: [
    { path: '/',                label: 'Dashboard',       Icon: IcoDashboard },
  ]},
  { section: 'Inventory', items: [
    { path: '/inventory',       label: 'Inventory',       Icon: IcoInventory },
    { path: '/reorder',         label: 'Reorder Planner', Icon: IcoReorder },
    { path: '/purchase-orders', label: 'Purchase Orders', Icon: IcoPO },
  ]},
  { section: 'Products', items: [
    { path: '/products',        label: 'Products',        Icon: IcoProducts },
    { path: '/suppliers',       label: 'Suppliers',       Icon: IcoSuppliers },
  ]},
  { section: 'Analytics', items: [
    { path: '/sales',           label: 'Sales',           Icon: IcoSales },
    { path: '/forecast',        label: 'Forecasting',     Icon: IcoForecast },
    { path: '/comparison',      label: 'Comparison',      Icon: IcoComparison },
  ]},
  { section: 'Admin', items: [
    { path: '/users',     label: 'Users',    Icon: IcoUsers,    adminOnly: true },
    { path: '/settings',  label: 'Settings', Icon: IcoSettings, adminOnly: true },
  ]},
]

export default function Sidebar() {
  const navigate       = useNavigate()
  const location       = useLocation()
  const { user, logout } = useAuth()
  const [open, setOpen]  = useState(false)
  const navRef           = useRef(null)

  // Close menu on route change
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleNav = (path) => { navigate(path); setOpen(false) }

  return (
    <aside className="sidebar" ref={navRef}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div>
          <div className="sidebar-logo-brand">🏌️ Evans Golf IMFS</div>
          <div className="sidebar-logo-sub">Inventory &amp; Forecasting</div>
        </div>
      </div>

      {/* Hamburger button — visible only on mobile via CSS */}
      <button
        className="hamburger-btn"
        style={{ display: 'none' }}   /* CSS overrides this on mobile */
        onClick={() => setOpen(o => !o)}
        aria-label="Toggle menu"
      >
        {open ? '✕' : '☰'}
      </button>

      {/* Navigation */}
      <nav className={'sidebar-nav' + (open ? ' open' : '')}>
        {NAV.map(section => {
          const visible = section.items.filter(i => !i.adminOnly || user?.role === 'admin')
          if (!visible.length) return null
          return (
            <div key={section.section}>
              <div className="sidebar-section-label">{section.section}</div>
              {visible.map(item => {
                const active = location.pathname === item.path
                return (
                  <div
                    key={item.path}
                    className={'sidebar-link' + (active ? ' active' : '')}
                    onClick={() => handleNav(item.path)}
                  >
                    <item.Icon />
                    {item.label}
                  </div>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* User area */}
      <div className="sidebar-user">
        <div className="sidebar-avatar">
          {user ? initials(`${user.first_name || ''} ${user.last_name || user.username}`) : 'U'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sidebar-user-name"
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.first_name} {user?.last_name}
          </div>
          <div className="sidebar-user-role">{user?.role_label || user?.role}</div>
        </div>
        <button className="btn btn-ghost btn-xs" onClick={logout}
          title="Log out" style={{ padding: '4px 6px', fontSize: '13px' }}>
          ⎋
        </button>
      </div>
    </aside>
  )
}
