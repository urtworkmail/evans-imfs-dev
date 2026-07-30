import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'
import Sidebar from './components/Sidebar'
import ThemeToggle from './components/ThemeToggle'
import Login from './pages/Login'
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
import Settings from './pages/Settings'

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/inventory': 'Inventory',
  '/reorder': 'Reorder Planner',
  '/purchase-orders': 'Purchase Orders',
  '/products': 'Products',
  '/suppliers': 'Suppliers',
  '/sales': 'Sales',
  '/forecast': 'Forecasting',
  '/comparison': 'Comparison Analysis',
  '/users': 'User Management',
  '/settings': 'Settings',
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--gray-400)', fontSize:14 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>⛳</div>
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
  const title = PAGE_TITLES[location.pathname] || 'Evans Golf IMFS'
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <div className="topbar">
          <div className="topbar-title">{title}</div>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </div>
        <div className="page-content">
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
