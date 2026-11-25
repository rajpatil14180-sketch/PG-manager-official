export type Role = 'owner' | 'tenant'

export interface User {
  username: string
  role: Role
  tenant_id?: number | null
}

export interface PG {
  id: number
  name: string
  address: string
  total_beds: number
  occupied_beds: number
  overdue_tenants: number
}

export interface Bed {
  bed_id: number
  label: string
  base_yearly_price: number
  tenant_id: number | null
  tenant_name: string | null
  status: 'empty' | 'occupied' | 'overdue'
}

export interface Room {
  room_id: number
  room_no: number
  has_attached_bath: number
  beds: Bed[]
}

export interface PGSummary {
  total_beds: number
  occupied_beds: number
  total_expected: number
  total_collected: number
  total_overdue: number
}

export interface Payment {
  id?: number
  amount: number
  paid_on: string
  mode: 'cash' | 'upi'
  tenant_id?: number
  tenant_name?: string
  tenant_phone?: string
  pg_id?: number
  pg_name?: string
  room_no?: number
  bed_label?: string
}

export interface InstallmentItem {
  installment_no: number
  due_date: string
  amount: number
  cumulative: number
  is_due: boolean
  is_paid: boolean
  status: 'paid' | 'overdue' | 'upcoming'
}

export interface TenantFinancials {
  tenant_id: number
  name: string
  join_date: string
  agreed_yearly_price: number
  total_paid: number
  due_left: number
  expected_till_today: number
  overdue_amount: number
  next_due_date: string | null
  status: 'ok' | 'overdue'
  payments: Payment[]
  installments?: InstallmentItem[]
}

export interface TenantProfile {
  tenant_id: number
  name: string
  phone: string
  join_date: string
  deposit: number
  agreed_yearly_price: number
  is_active: number
  bed_id?: number | null
  bed_label?: string
  room_no?: number
  has_attached_bath?: number
  pg_id?: number
  pg_name?: string
  pg_address?: string
}

export interface TenantRecord {
  profile: TenantProfile
  financials: TenantFinancials
}

export interface Ticket {
  id: number
  tenant_id: number
  pg_id: number
  category: string
  description: string
  urgency: 'Low' | 'Medium' | 'High'
  status: 'Open' | 'In Progress' | 'Resolved'
  created_at: string
  resolved_at?: string | null
  tenant_name?: string
  room_no?: number
  bed_label?: string
  pg_name?: string
  age_in_days: number
}

export interface Announcement {
  id: number
  pg_id: number
  message: string
  created_at: string
  pg_name?: string
}

export interface OwnerOverviewMetrics {
  total_properties: number
  total_beds: number
  occupied_beds: number
  vacant_beds: number
  occupancy_rate: number
  active_tenants: number
  overdue_tenants: number
  total_expected: number
  total_collected: number
  total_agreed: number
  outstanding_amount: number
  total_overdue: number
  open_tickets_count: number
}

export interface OverdueTenantItem {
  tenant_id: number
  name: string
  phone: string
  pg_id: number
  pg_name: string
  room_no: number
  bed_label: string
  agreed_yearly_price: number
  total_paid: number
  due_left: number
  overdue_amount: number
  next_due_date: string | null
}

export interface OwnerOverviewData {
  properties: PG[]
  metrics: OwnerOverviewMetrics
  recent_payments: Payment[]
  overdue_tenants: OverdueTenantItem[]
  open_tickets: Ticket[]
  all_tickets?: Ticket[]
  recent_announcements: Announcement[]
}

export interface OwnerFinanceData {
  summary: {
    total_expected: number
    total_collected: number
    outstanding_amount: number
    total_overdue: number
  }
  property_summaries: (PG & PGSummary)[]
  tenants: (TenantProfile & { financials: TenantFinancials })[]
  payments: Payment[]
}

export interface TenantHomeData {
  profile: TenantProfile
  financials: TenantFinancials
  announcements: Announcement[]
  tickets: Ticket[]
  ticket_categories?: string[]
  ticket_urgencies?: string[]
}

export interface VacantBedItem {
  bed_id: number
  pg_id: number
  pg_name: string
  room_id: number
  room_no: number
  bed_label: string
  base_yearly_price: number | null
  monthly_equivalent: number | null
  price_valid: boolean
  has_attached_bath: boolean
  has_balcony: boolean | null
}

export interface PropertyComparisonItem {
  id: number
  name: string
  address: string
  total_rooms: number
  total_beds: number
  occupied_beds: number
  vacant_beds: number
  occupancy_rate: number
  scheduled_rent: number
  paid_against_scheduled: number
  collected_this_month: number
  current_month_overdue: number
  current_month_not_yet_due: number
  previous_arrears: number
  vacant_annual_potential: number
  vacant_monthly_potential: number
  next_month_contracted: number
  has_legacy_vacated: boolean
}

export interface MonthlyHistoryPoint {
  month: string
  collected: number
  scheduled: number | null
  outstanding: number | null
  scheduled_reliable: boolean
  by_pg: Record<string, {
    collected: number
    scheduled: number | null
    outstanding: number | null
    scheduled_reliable: boolean
  }>
}

export interface OverdueDashboardTenant {
  tenant_id: number
  name: string
  phone: string
  pg_id: number
  pg_name: string
  room_no: number
  bed_label: string
  current_month_overdue: number
  previous_period_arrears: number
  overdue_amount: number
  due_left: number
  next_due_date: string | null
}

export interface OwnerDashboardData {
  selected_month: string
  today: string
  portfolio: {
    total_pgs: number
    total_rooms: number
    total_beds: number
    occupied_beds: number
    vacant_beds: number
    occupancy_percentage: number
    vacant_percentage: number
    active_tenants: number
    open_tickets_count: number
  }
  monthly_overview: {
    month: string
    scheduled_rent: number
    actual_collected: number
    paid_against_scheduled: number
    remaining_to_collect: number
    current_month_overdue: number
    current_month_not_yet_due: number
    previous_period_arrears: number
    collection_percentage: number
    overdue_tenants_count: number
    arrears_tenants_count: number
  }
  vacant_inventory: {
    total_vacant_beds: number
    total_beds: number
    vacant_percentage: number
    estimated_annual_potential: number
    estimated_monthly_potential: number
    by_property: {
      pg_id: number
      pg_name: string
      vacant_beds: number
      total_beds: number
      estimated_annual_potential: number
      estimated_monthly_potential: number
    }[]
    beds: VacantBedItem[]
    warnings: string[]
  }
  next_month_outlook: {
    month: string
    contracted_rent: number
    estimated_vacant_potential: number
    combined_opportunity: number
    occupied_beds: number
    vacant_beds: number
    contributing_properties: number
  }
  monthly_history: MonthlyHistoryPoint[]
  properties: PropertyComparisonItem[]
  overdue_tenants: OverdueDashboardTenant[]
  recent_payments: Payment[]
  open_tickets: Ticket[]
  recent_announcements: Announcement[]
}
