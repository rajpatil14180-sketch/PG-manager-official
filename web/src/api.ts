import type {
  PG,
  Room,
  PGSummary,
  Ticket,
  Announcement,
  TenantRecord,
  OwnerOverviewData,
  OwnerDashboardData,
  OwnerFinanceData,
  TenantHomeData,
  Bed,
} from './types'

const TOKEN_KEY = 'pgmanager_token'
const ROLE_KEY = 'pgmanager_role'
const LEGACY_TOKEN_KEY = 'gharpar_token'
const LEGACY_ROLE_KEY = 'gharpar_role'

export function getAuthToken(): string {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || ''
}

export function getAuthRole(): string {
  return localStorage.getItem(ROLE_KEY) || localStorage.getItem(LEGACY_ROLE_KEY) || 'owner'
}

export function setAuthSession(token: string, role: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ROLE_KEY, role)
  // maintain legacy keys for full compatibility
  localStorage.setItem(LEGACY_TOKEN_KEY, token)
  localStorage.setItem(LEGACY_ROLE_KEY, role)
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROLE_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
  localStorage.removeItem(LEGACY_ROLE_KEY)
}

export const formatRupees = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0))
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`/api?__path=${encodeURIComponent(path)}`, { ...options, headers })
  } catch {
    throw new Error('Cannot reach the PG Manager API. Ensure web_api.py is running on port 8765.')
  }

  const raw = await response.text()
  let data: any = {}
  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error(`The API returned an invalid response (HTTP ${response.status}).`)
    }
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (HTTP ${response.status}).`)
  }

  return data as T
}

export const api = {
  // Authentication
  login: (username: string, password: string) =>
    request<{ token: string; user: { username: string; role: 'owner' | 'tenant'; tenant_id?: number } }>(
      '/login',
      { method: 'POST', body: JSON.stringify({ username, password }) }
    ),
  logout: () => request<{ ok: boolean }>('/logout', { method: 'POST', body: '{}' }),
  me: () => request<{ username: string; role: 'owner' | 'tenant'; tenant_id?: number }>('/me'),

  // Owner endpoints
  getOwnerDashboard: (month?: string) =>
    request<OwnerDashboardData>(month ? `/owner/dashboard?month=${encodeURIComponent(month)}` : '/owner/dashboard'),
  updateRoomBalcony: (roomId: number, hasBalcony: boolean | null) =>
    request<{ ok: boolean; has_balcony: boolean | null }>(`/rooms/${roomId}/balcony`, {
      method: 'POST',
      body: JSON.stringify({ has_balcony: hasBalcony }),
    }),
  getOwnerOverview: () => request<OwnerOverviewData>('/owner/overview'),
  getOwnerFinance: () => request<OwnerFinanceData>('/owner/finance'),
  getOwnerTenants: () => request<(TenantRecord['profile'] & { financials: TenantRecord['financials'] })[]>('/owner/tenants'),
  getOwnerTickets: () => request<Ticket[]>('/owner/tickets'),

  getPGs: () => request<PG[]>('/pgs'),
  getPGLayout: (pgId: number) => request<Room[]>(`/pgs/${pgId}/layout`),
  getPGSummary: (pgId: number) => request<PGSummary>(`/pgs/${pgId}/summary`),
  getPGTickets: (pgId: number) => request<Ticket[]>(`/pgs/${pgId}/tickets`),
  getPGAnnouncements: (pgId: number) => request<Announcement[]>(`/pgs/${pgId}/announcements`),
  getPGTenants: (pgId: number) => request<(TenantRecord['profile'] & { financials: TenantRecord['financials'] })[]>(`/pgs/${pgId}/tenants`),

  getBedDetails: (bedId: number) =>
    request<{
      bed: Bed
      room_no: number
      pg_name: string
      tenant: TenantRecord['profile'] | null
      financials: TenantRecord['financials'] | null
    }>(`/beds/${bedId}`),

  getTenantRecord: (tenantId: number) => request<TenantRecord>(`/tenants/${tenantId}`),

  getPricingSuggestion: (bedId: number, joinDate: string) =>
    request<{ suggested_price: number }>(`/pricing/suggestion?bed_id=${bedId}&join_date=${joinDate}`),

  addTenant: (pgId: number, payload: {
    bed_id: number
    name: string
    phone: string
    join_date: string
    deposit: number
    agreed_yearly_price: number
    username: string
    password: string
  }) => request<{ tenant_id: number; suggested_price: number }>(`/pgs/${pgId}/tenants`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  recordPayment: (tenantId: number, payload: {
    amount: number
    paid_on: string
    mode: 'cash' | 'upi'
  }) => request<{ payment_id: number }>(`/tenants/${tenantId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  vacateTenant: (tenantId: number) =>
    request<{ ok: boolean }>(`/tenants/${tenantId}/vacate`, {
      method: 'POST',
      body: '{}',
    }),

  updateTicketStatus: (ticketId: number, status: 'Open' | 'In Progress' | 'Resolved') =>
    request<{ ok: boolean }>(`/tickets/${ticketId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  createAnnouncement: (pgId: number, message: string) =>
    request<{ id: number }>(`/pgs/${pgId}/announcements`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  deleteAnnouncement: (announcementId: number) =>
    request<{ ok: boolean }>(`/announcements/${announcementId}`, {
      method: 'DELETE',
    }),

  // Tenant endpoints
  getTenantHome: () => request<TenantHomeData>('/tenant/home'),
  createTenantTicket: (payload: { category: string; urgency: string; description: string }) =>
    request<{ id: number }>('/tenant/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}
