import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import logo from './assets/logo.png'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import ReorderPlanner from './pages/ReorderPlanner'
import PurchaseOrders from './pages/PurchaseOrders'
import Products from './pages/Products'
import Suppliers from './pages/Suppliers'
import Sales from './pages/Sales'
import Forecast from './pages/Forecast'
import Comparison from './pages/Comparison'
import UserManagement from './pages/UserManagement'
import Sessions from './pages/Sessions'
import AuditLog from './pages/AuditLog'
import Settings from './pages/Settings'

const PAGE_META = {
  '/':                { title: 'Dashboard',           subtitle: 'Live overview of stock health, sales, and reorder alerts.' },
  '/inventory':       { title: 'Inventory',           subtitle: 'Finished goods and raw fabric stock levels.' },
  '/reorder':         { title: 'Reorder Planner',     subtitle: 'What to order next, and by when.' },
  '/purchase-orders': { title: 'Purchase Orders',     subtitle: 'Track orders placed with suppliers.' },
  '/products':        { title: 'Products',            subtitle: 'Manage your product catalog.' },
  '/suppliers':       { title: 'Suppliers',           subtitle: 'Manage supplier details, lead times, and costs.' },
  '/sales':           { title: 'Sales',                subtitle: 'Shopify and QuickBooks order history.' },
  '/forecast':        { title: 'Forecasting',          subtitle: 'Demand projections and fabric consumption.' },
  '/comparison':      { title: 'Comparison Analysis', subtitle: 'Compare sales performance across two periods.' },
  '/users':           { title: 'User Management',     subtitle: 'Manage accounts, roles, and permissions.' },
  '/sessions':        { title: 'Active Sessions',     subtitle: 'Devices currently logged in across the platform.' },
  '/audit-log':       { title: 'Audit Log',           subtitle: 'Security and administration activity across the platform.' },
  '/settings':        { title: 'Settings',              subtitle: 'Fetch schedule, inventory parameters, integrations, and security.' },
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--gray-400)', fontSize:14 }}>
      <div style={{ textAlign:'center' }}>
        <img src={logo} alt="" style={{ width:44, height:44, marginBottom:12 }} />
        <div>Loading Evans Golf IMFS…</div>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireAdmin({ children }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') return (
    <div style={{ padding:40, textAlign:'center', color:'var(--gray-500)' }}>
      <div style={{ fontSize:28, marginBottom:8 }}>🔒</div>
      <div>Admin access required.</div>
    </div>
  )
  return children
}

function AppLayout() {
  const location = useLocation()
  const meta = PAGE_META[location.pathname] || { title: 'Evans Golf IMFS' }
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <div className="page-content">
          <div className="page-header">
            <div>
              <div className="page-title">{meta.title}</div>
              {meta.subtitle && <div className="page-subtitle">{meta.subtitle}</div>}
            </div>
          </div>
          <ErrorBoundary key={location.pathname}>
            <Routes>
              <Route path="/"                element={<Dashboard />} />
              <Route path="/inventory"       element={<Inventory />} />
              <Route path="/reorder"         element={<ReorderPlanner />} />
              <Route path="/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/products"        element={<Products />} />
              <Route path="/suppliers"       element={<Suppliers />} />
              <Route path="/sales"           element={<Sales />} />
              <Route path="/forecast"        element={<Forecast />} />
              <Route path="/comparison"      element={<Comparison />} />
              <Route path="/users"           element={<RequireAdmin><UserManagement /></RequireAdmin>} />
              <Route path="/sessions"        element={<RequireAdmin><Sessions /></RequireAdmin>} />
              <Route path="/audit-log"       element={<RequireAdmin><AuditLog /></RequireAdmin>} />
              <Route path="/settings"        element={<RequireAdmin><Settings /></RequireAdmin>} />
              <Route path="*"               element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*"    element={<RequireAuth><AppLayout /></RequireAuth>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
