import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { initials } from '../utils/fmt'
import logo from '../assets/logo.png'

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
const IcoSessions   = () => <Icon d={<><rect x="2" y="4" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>} />
const IcoAuditLog   = () => <Icon d={<><path d="M9 3h6a2 2 0 012 2v14a2 2 0 01-2 2H9a2 2 0 01-2-2V5a2 2 0 012-2z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/></>} />
const IcoSettings   = () => <Icon d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></>} />
const IcoStatus     = () => <Icon d={<><circle cx="12" cy="12" r="9"/><polyline points="8 12 10.5 14.5 16 9"/></>} />
const IcoServer     = () => <Icon d={<><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><line x1="7" y1="7" x2="7.01" y2="7"/><line x1="7" y1="17" x2="7.01" y2="17"/></>} />
const IcoChevronUp  = () => <Icon d={<polyline points="18 15 12 9 6 15"/>} size={12} />
const IcoSun        = () => <Icon d={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.22 4.22l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.22 19.78l1.41-1.41M17.66 6.34l1.41-1.41"/></>} />
const IcoMoon       = () => <Icon d={<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>} />

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
    { path: '/users',     label: 'Users',            Icon: IcoUsers,    adminOnly: true },
    { path: '/sessions',  label: 'Active Sessions',  Icon: IcoSessions, adminOnly: true },
    { path: '/audit-log', label: 'Audit Log',        Icon: IcoAuditLog, adminOnly: true },
    { path: '/settings',  label: 'Settings',         Icon: IcoSettings, adminOnly: true },
  ]},
  { section: 'System', items: [
    { path: '/status',       label: 'Status Checker', Icon: IcoStatus, adminOnly: true },
    { path: '/server-usage', label: 'Server Usage',   Icon: IcoServer, adminOnly: true },
  ]},
]

export default function Sidebar() {
  const navigate       = useNavigate()
  const location       = useLocation()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen]  = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navRef            = useRef(null)
  const userMenuRef       = useRef(null)

  // Close menu on route change
  useEffect(() => { setOpen(false); setUserMenuOpen(false) }, [location.pathname])

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close user menu when clicking outside it
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false)
    }
    if (userMenuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  const handleNav = (path) => { navigate(path); setOpen(false) }

  return (
    <aside className="sidebar" ref={navRef}>
      {/* Logo */}
      <div className="sidebar-logo">
        <img src={logo} alt="" className="sidebar-logo-mark" />
        <div>
          <div className="sidebar-logo-brand">Evans Golf IMFS</div>
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

        {/* Account actions — mobile only (desktop uses the popover below).
            The popover can't work on mobile: the sidebar becomes a fixed
            top bar there, so a menu that opens "upward" from it would
            render off the top of the screen. */}
        <div className="sidebar-mobile-account">
          <div className="sidebar-section-label">Account</div>
          <div className="sidebar-link" onClick={toggleTheme}>
            {theme === 'dark' ? <IcoSun /> : <IcoMoon />} {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </div>
          <div className="sidebar-link" style={{ color: 'var(--red)' }} onClick={logout}>
            ⎋ Sign Out
          </div>
        </div>
      </nav>

      {/* User area — click to open account menu */}
      <div className="sidebar-user-wrap" ref={userMenuRef}>
        {userMenuOpen && (
          <div className="user-menu-popover">
            <div className="user-menu-header">
              <div className="sidebar-avatar">
                {user ? initials(`${user.first_name || ''} ${user.last_name || user.username}`) : 'U'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.first_name} {user?.last_name}
                </div>
                <div className="text-muted" style={{ fontSize: 12 }}>{user?.role_label || user?.role}</div>
              </div>
            </div>
            <div className="user-menu-item" onClick={toggleTheme}>
              {theme === 'dark' ? <IcoSun /> : <IcoMoon />} {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </div>
            <div className="user-menu-item user-menu-item-danger" onClick={logout}>
              ⎋ Sign Out
            </div>
          </div>
        )}
        <div className="sidebar-user" onClick={() => setUserMenuOpen(o => !o)}>
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
          <span className="text-muted" style={{ display: 'flex', flexShrink: 0 }}><IcoChevronUp /></span>
        </div>
      </div>
    </aside>
  )
}
