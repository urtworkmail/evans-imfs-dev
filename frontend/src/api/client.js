import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        if (!refresh) throw new Error('no refresh')
        const { data } = await axios.post('/api/auth/token/refresh/', { refresh })
        localStorage.setItem('access_token', data.access)
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (username, password, totp_code) => api.post('/auth/token/', { username, password, totp_code }),
  me: () => api.get('/users/me/'),
}

export const totpApi = {
  setup:   () => api.post('/users/totp_setup/'),
  verify:  (code) => api.post('/users/totp_verify/', { code }),
  disable: (password) => api.post('/users/totp_disable/', { password }),
}

export const productsApi = {
  list:       (params) => api.get('/products/', { params }),
  create:     (data)   => api.post('/products/', data),
  update:     (id, data) => api.put(`/products/${id}/`, data),
  delete:     (id)     => api.delete(`/products/${id}/`),
  categories: ()       => api.get('/categories/'),
}

export const suppliersApi = {
  list:   ()           => api.get('/suppliers/'),
  create: (data)       => api.post('/suppliers/', data),
  update: (id, data)   => api.put(`/suppliers/${id}/`, data),
  delete: (id)         => api.delete(`/suppliers/${id}/`),
}

export const inventoryApi = {
  fabric:       ()       => api.get('/inventory/fabric/'),
  finished:     ()       => api.get('/inventory/finished/'),
  currentStock: ()       => api.get('/inventory/current-stock/'),
  logs:         (params) => api.get('/inventory/logs/', { params }),
  logCreate:    (data)   => api.post('/inventory/logs/', data),
}

export const salesApi = {
  orders:        (params)             => api.get('/sales/orders/', { params }),
  analysis:      (params)             => api.get('/sales/analysis/', { params }),
  comparison:    (p1s, p1e, p2s, p2e) => api.get('/analysis/comparison/', { params: { start1: p1s, end1: p1e, start2: p2s, end2: p2e } }),
  fetchShopify:  ()                   => api.post('/fetch/shopify/'),
  fetchQuickBooks: ()                 => api.post('/fetch/quickbooks/'),
  fetchStatus:   ()                   => api.get('/fetch/status/'),
}

export const forecastApi = {
  forecast:      () => api.get('/forecast/'),
  reorderAlerts: () => api.get('/alerts/reorder/'),
}

export const purchasingApi = {
  list:          (params) => api.get('/purchase-orders/', { params }),
  get:           (id)     => api.get(`/purchase-orders/${id}/`),
  placeOrder:    (data)   => api.post('/purchase-orders/place/', data),
  markReceived:  (id)     => api.post(`/purchase-orders/${id}/mark_received/`),
  updateStatus:  (id, status) => api.post(`/purchase-orders/${id}/update_status/`, { status }),
  delete:        (id)     => api.delete(`/purchase-orders/${id}/`),
}

export const usersApi = {
  list:             ()           => api.get('/users/'),
  create:           (data)       => api.post('/users/', data),
  update:           (id, data)   => api.put(`/users/${id}/`, data),
  delete:           (id)         => api.delete(`/users/${id}/`),
  permissionConfig: ()           => api.get('/users/permission_config/'),
}

export const settingsApi = {
  getSchedule:  ()     => api.get('/settings/fetch-schedule/'),
  saveSchedule: (data) => api.put('/settings/fetch-schedule/', data),
  getSystem:    ()     => api.get('/settings/system/'),
  saveSystem:   (data) => api.put('/settings/system/', data),
}

export default api
