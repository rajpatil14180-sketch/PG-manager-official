import React, { useState, useEffect, useCallback } from 'react'
import { api, getAuthToken, getAuthRole, setAuthSession, clearAuthSession } from './api'
import type {
  Role,
  PG,
  Room,
  Bed,
  PGSummary,
  Ticket,
  Announcement,
  TenantRecord,
  OwnerOverviewData,
  OwnerDashboardData,
  OwnerFinanceData,
  TenantHomeData,
} from './types'

// Components
import { LoginPage } from './components/auth/LoginPage'
import { OwnerDashboard } from './components/owner/OwnerDashboard'
import { OwnerProperties } from './components/owner/OwnerProperties'
import { OwnerTenants } from './components/owner/OwnerTenants'
import { OwnerFinance } from './components/owner/OwnerFinance'
import { OwnerMaintenance } from './components/owner/OwnerMaintenance'
import { OwnerAnnouncements } from './components/owner/OwnerAnnouncements'

import { BedDetailsModal } from './components/owner/BedDetailsModal'
import { AddTenantModal } from './components/owner/AddTenantModal'
import { RecordPaymentModal } from './components/owner/RecordPaymentModal'
import { TenantRecordModal } from './components/owner/TenantRecordModal'

import { TenantDashboard } from './components/tenant/TenantDashboard'
import { TenantAccommodation } from './components/tenant/TenantAccommodation'
import { TenantPayments } from './components/tenant/TenantPayments'
import { TenantMaintenance } from './components/tenant/TenantMaintenance'
import { TenantAnnouncements } from './components/tenant/TenantAnnouncements'
import { TenantProfileView } from './components/tenant/TenantProfile'

// Icons
import {
  Building2,
  BedDouble,
  Users,
  Wallet,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  Home,
  Check,
  AlertCircle,
  CreditCard,
  DoorOpen,
  User,
  ShieldCheck,
} from 'lucide-react'

export default function App() {
  // Authentication State
  const [token, setToken] = useState<string>(getAuthToken())
  const [role, setRole] = useState<Role>(getAuthRole() as Role)
  const [username, setUsername] = useState<string>('')
  const [authBusy, setAuthBusy] = useState<boolean>(false)
  const [authError, setAuthError] = useState<string>('')

  // Notifications
  const [notice, setNotice] = useState<string>('')
  const [errorBanner, setErrorBanner] = useState<string>('')

  // Mobile Navigation
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false)

  // Owner State & Views
  type OwnerView = 'overview' | 'properties' | 'tenants' | 'finance' | 'maintenance' | 'announcements'
  const [ownerView, setOwnerView] = useState<OwnerView>('overview')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7))
  const [dashboardData, setDashboardData] = useState<OwnerDashboardData | null>(null)
  const [overviewData, setOverviewData] = useState<OwnerOverviewData | null>(null)
  const [financeData, setFinanceData] = useState<OwnerFinanceData | null>(null)
  const [properties, setProperties] = useState<PG[]>([])
  const [activePropertyId, setActivePropertyId] = useState<number | null>(null)
  const [layout, setLayout] = useState<Room[]>([])
  const [propertySummary, setPropertySummary] = useState<PGSummary | null>(null)
  const [allTenants, setAllTenants] = useState<(TenantRecord['profile'] & { financials: TenantRecord['financials'] })[]>([])
  const [allTickets, setAllTickets] = useState<Ticket[]>([])
  const [ownerAnnouncements, setOwnerAnnouncements] = useState<Announcement[]>([])
  const [ownerLoading, setOwnerLoading] = useState<boolean>(false)

  // Modals State
  const [selectedBedDetails, setSelectedBedDetails] = useState<any | null>(null)
  const [addTenantOpen, setAddTenantOpen] = useState<boolean>(false)
  const [addTenantBedId, setAddTenantBedId] = useState<number>(0)
  const [addTenantBasePrice, setAddTenantBasePrice] = useState<number>(200000)

  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false)
  const [paymentTenantId, setPaymentTenantId] = useState<number>(0)
  const [paymentTenantName, setPaymentTenantName] = useState<string>('')
  const [paymentDueLeft, setPaymentDueLeft] = useState<number | undefined>(undefined)

  const [tenantRecordModalOpen, setTenantRecordModalOpen] = useState<boolean>(false)
  const [inspectTenantRecord, setInspectTenantRecord] = useState<TenantRecord | null>(null)

  // Tenant State & Views
  type TenantView = 'home' | 'accommodation' | 'payments' | 'maintenance' | 'announcements' | 'profile'
  const [tenantView, setTenantView] = useState<TenantView>('home')
  const [tenantHomeData, setTenantHomeData] = useState<TenantHomeData | null>(null)
  const [tenantLoading, setTenantLoading] = useState<boolean>(false)

  const notify = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 4000)
  }

  // Load Owner Data
  const refreshOwnerData = useCallback(async () => {
    if (!token || role !== 'owner') return
    setOwnerLoading(true)
    setErrorBanner('')
    try {
      const [dashboard, overview, finance, pgs, tenantsList, ticketsList] = await Promise.all([
        api.getOwnerDashboard(selectedMonth),
        api.getOwnerOverview(),
        api.getOwnerFinance(),
        api.getPGs(),
        api.getOwnerTenants(),
        api.getOwnerTickets(),
      ])

      setDashboardData(dashboard)
      setOverviewData(overview)
      setFinanceData(finance)
      setProperties(pgs)
      setAllTenants(tenantsList)
      setAllTickets(ticketsList)
      setOwnerAnnouncements(overview.recent_announcements || [])

      // Set default active property if not set
      setActivePropertyId(current => (current !== null ? current : pgs[0]?.id ?? null))
    } catch (err: any) {
      if (String(err.message).toLowerCase().includes('sign in') || String(err.message).includes('401')) {
        handleLogout()
      } else {
        setErrorBanner(err.message || 'Unable to sync portfolio data.')
      }
    } finally {
      setOwnerLoading(false)
    }
  }, [token, role, selectedMonth])

  // Load Property Floor Plan Layout
  const loadPropertyLayout = useCallback(async (pgId: number) => {
    try {
      const [rooms, summ] = await Promise.all([
        api.getPGLayout(pgId),
        api.getPGSummary(pgId),
      ])
      setLayout(rooms)
      setPropertySummary(summ)
    } catch (err: any) {
      setErrorBanner(err.message || 'Could not load floor plan layout.')
    }
  }, [])

  // Load Tenant Data
  const refreshTenantData = useCallback(async () => {
    if (!token || role !== 'tenant') return
    setTenantLoading(true)
    setErrorBanner('')
    try {
      const data = await api.getTenantHome()
      setTenantHomeData(data)
    } catch (err: any) {
      if (String(err.message).toLowerCase().includes('sign in') || String(err.message).includes('401')) {
        handleLogout()
      } else {
        setErrorBanner(err.message || 'Unable to sync resident data.')
      }
    } finally {
      setTenantLoading(false)
    }
  }, [token, role])

  // Verify Auth & Initial Load
  useEffect(() => {
    if (token) {
      api.me()
        .then(res => {
          setUsername(res.username)
          setRole(res.role)
        })
        .catch(() => {
          handleLogout()
        })
    }
  }, [token])

  useEffect(() => {
    if (token && role === 'owner') {
      refreshOwnerData()
    } else if (token && role === 'tenant') {
      refreshTenantData()
    }
  }, [token, role, refreshOwnerData, refreshTenantData])

  useEffect(() => {
    if (token && role === 'owner' && activePropertyId !== null) {
      loadPropertyLayout(activePropertyId)
    }
  }, [token, role, activePropertyId, loadPropertyLayout])

  // Authentication Handlers
  const handleLogin = async (u: string, p: string) => {
    setAuthBusy(true)
    setAuthError('')
    try {
      const res = await api.login(u, p)
      setAuthSession(res.token, res.user.role)
      setToken(res.token)
      setRole(res.user.role)
      setUsername(res.user.username)
      notify(`Welcome back, ${res.user.username}! Signed in to PG Manager.`)
    } catch (err: any) {
      setAuthError(err.message || 'Sign in failed. Check credentials.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = () => {
    api.logout().catch(() => {})
    clearAuthSession()
    setToken('')
    setRole('owner')
    setUsername('')
    setOverviewData(null)
    setDashboardData(null)
    setFinanceData(null)
    setTenantHomeData(null)
    setProperties([])
    setActivePropertyId(null)
    setSelectedBedDetails(null)
    setInspectTenantRecord(null)
    notify('Successfully signed out.')
  }

  // Owner Action Handlers
  const handleSelectBed = async (bed: Bed) => {
    try {
      const details = await api.getBedDetails(bed.bed_id)
      setSelectedBedDetails(details)
    } catch (err: any) {
      setErrorBanner(err.message || 'Could not fetch bed details.')
    }
  }

  const handleOpenAddTenant = (bedId: number, basePrice: number = 200000) => {
    setAddTenantBedId(bedId)
    setAddTenantBasePrice(basePrice)
    setSelectedBedDetails(null)
    setAddTenantOpen(true)
  }

  const handleOpenRecordPayment = (tenantId?: number, name?: string, dueLeft?: number) => {
    if (tenantId) {
      setPaymentTenantId(tenantId)
      setPaymentTenantName(name || '')
      setPaymentDueLeft(dueLeft)
      setPaymentModalOpen(true)
    } else {
      // If called generically, pick the first active tenant
      const activeOne = allTenants.find(t => t.is_active)
      if (activeOne) {
        setPaymentTenantId(activeOne.tenant_id)
        setPaymentTenantName(activeOne.name)
        setPaymentDueLeft(activeOne.financials?.due_left)
        setPaymentModalOpen(true)
      } else {
        setErrorBanner('No active residents available to record payment.')
      }
    }
  }

  const handleOpenTenantRecord = async (tenantId: number) => {
    try {
      const rec = await api.getTenantRecord(tenantId)
      setInspectTenantRecord(rec)
      setTenantRecordModalOpen(true)
    } catch (err: any) {
      setErrorBanner(err.message || 'Could not load resident record.')
    }
  }

  const handleVacateTenant = async (tenantId: number, name: string) => {
    if (!window.confirm(`Are you sure you want to vacate ${name}? Their account will be deactivated, but all payment history and records will remain preserved permanently.`)) {
      return
    }
    try {
      await api.vacateTenant(tenantId)
      notify(`Resident ${name} vacated. Tenancy history has been preserved.`)
      setSelectedBedDetails(null)
      setTenantRecordModalOpen(false)
      await refreshOwnerData()
      if (activePropertyId) await loadPropertyLayout(activePropertyId)
    } catch (err: any) {
      setErrorBanner(err.message || 'Could not vacate resident.')
    }
  }

  const handleUpdateTicketStatus = async (ticketId: number, newStatus: Ticket['status']) => {
    try {
      await api.updateTicketStatus(ticketId, newStatus)
      notify(`Maintenance ticket #${ticketId} updated to ${newStatus}.`)
      await refreshOwnerData()
    } catch (err: any) {
      setErrorBanner(err.message || 'Could not update ticket status.')
    }
  }

  const handleAddAnnouncement = async (pgId: number, message: string) => {
    await api.createAnnouncement(pgId, message)
    notify('Announcement published to resident dashboards.')
    await refreshOwnerData()
  }

  const handleDeleteAnnouncement = async (id: number) => {
    await api.deleteAnnouncement(id)
    notify('Announcement deleted.')
    await refreshOwnerData()
  }

  const handleUpdateRoomBalcony = async (roomId: number, hasBalcony: boolean | null) => {
    try {
      await api.updateRoomBalcony(roomId, hasBalcony)
      notify('Room balcony configuration updated.')
      await refreshOwnerData()
    } catch (err: any) {
      setErrorBanner(err.message || 'Could not update balcony setting.')
    }
  }

  // Tenant Action Handlers
  const handleSubmitTenantTicket = async (category: string, urgency: string, description: string) => {
    await api.createTenantTicket({ category, urgency, description })
    notify('Maintenance request submitted successfully!')
    await refreshTenantData()
  }

  // RENDER: Login View
  if (!token) {
    return (
      <LoginPage
        onLogin={handleLogin}
        busy={authBusy}
        error={authError}
        onClearError={() => setAuthError('')}
      />
    )
  }

  // RENDER: Resident Portal
  if (role === 'tenant') {
    return (
      <div className="cohere-app-shell tenant-shell-mode">
        {/* Mobile Navigation Backdrop */}
        {mobileNavOpen && (
          <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
        )}

        {/* Sidebar Navigation */}
        <aside className={`cohere-sidebar ${mobileNavOpen ? 'is-mobile-open' : ''}`}>
          <div className="sidebar-top">
            <div className="brand-logo-strip">
              <span className="brand-logo-mark"><Building2 size={19} /></span>
              <div className="brand-text-block">
                <span className="brand-title">PG Manager</span>
                <span className="brand-portal-tag">Resident Portal</span>
              </div>
            </div>
            <button className="mobile-close-btn" onClick={() => setMobileNavOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="sidebar-nav-section">
            <span className="nav-section-title">MY ACCOMMODATION</span>
            <button
              className={`nav-menu-item ${tenantView === 'home' ? 'is-active' : ''}`}
              onClick={() => { setTenantView('home'); setMobileNavOpen(false) }}
            >
              <Home size={18} /> Home Dashboard
            </button>
            <button
              className={`nav-menu-item ${tenantView === 'accommodation' ? 'is-active' : ''}`}
              onClick={() => { setTenantView('accommodation'); setMobileNavOpen(false) }}
            >
              <DoorOpen size={18} /> My Room & Bed
            </button>
            <button
              className={`nav-menu-item ${tenantView === 'payments' ? 'is-active' : ''}`}
              onClick={() => { setTenantView('payments'); setMobileNavOpen(false) }}
            >
              <Wallet size={18} /> Payments & Schedule
            </button>
          </div>

          <div className="sidebar-nav-section">
            <span className="nav-section-title">SERVICES & NOTICES</span>
            <button
              className={`nav-menu-item ${tenantView === 'maintenance' ? 'is-active' : ''}`}
              onClick={() => { setTenantView('maintenance'); setMobileNavOpen(false) }}
            >
              <Settings size={18} />
              <span>Maintenance</span>
              {tenantHomeData?.tickets.filter(t => t.status !== 'Resolved').length ? (
                <span className="nav-badge-count">
                  {tenantHomeData.tickets.filter(t => t.status !== 'Resolved').length}
                </span>
              ) : null}
            </button>
            <button
              className={`nav-menu-item ${tenantView === 'announcements' ? 'is-active' : ''}`}
              onClick={() => { setTenantView('announcements'); setMobileNavOpen(false) }}
            >
              <Bell size={18} /> Announcements
            </button>
            <button
              className={`nav-menu-item ${tenantView === 'profile' ? 'is-active' : ''}`}
              onClick={() => { setTenantView('profile'); setMobileNavOpen(false) }}
            >
              <User size={18} /> Account Profile
            </button>
          </div>

          <div className="sidebar-bottom-block">
            <div className="resident-status-card">
              <span className="res-card-name">{tenantHomeData?.profile.name || username}</span>
              <span className="res-card-pg">
                {tenantHomeData?.profile.pg_name || 'Resident'} · Room {tenantHomeData?.profile.room_no}
              </span>
            </div>
            <button className="signout-button" onClick={handleLogout}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="cohere-main-container">
          {/* Top Bar */}
          <header className="cohere-topbar">
            <div className="topbar-left">
              <button
                className="hamburger-btn"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Toggle navigation"
              >
                <Menu size={20} />
              </button>
              <div className="topbar-breadcrumbs">
                <span>Resident Portal</span>
                <span className="sep">/</span>
                <strong className="current-crumb">
                  {tenantView === 'home' && 'Home Dashboard'}
                  {tenantView === 'accommodation' && 'My Room & Bed'}
                  {tenantView === 'payments' && 'Payments & Schedule'}
                  {tenantView === 'maintenance' && 'Maintenance Requests'}
                  {tenantView === 'announcements' && 'Property Announcements'}
                  {tenantView === 'profile' && 'Account Profile'}
                </strong>
              </div>
            </div>

            <div className="topbar-right">
              <div className="topbar-pill">
                <span className="live-dot" />
                <span>{tenantHomeData?.profile.pg_name || 'PG'}</span>
              </div>
              <div className="user-avatar-tag" title={username}>
                {(tenantHomeData?.profile.name || username).slice(0, 1).toUpperCase()}
              </div>
            </div>
          </header>

          {/* Toast / Global Alerts */}
          {notice && (
            <div className="global-toast toast-success">
              <Check size={16} />
              <span>{notice}</span>
              <button onClick={() => setNotice('')}>×</button>
            </div>
          )}
          {errorBanner && (
            <div className="global-toast toast-error">
              <AlertCircle size={16} />
              <span>{errorBanner}</span>
              <button onClick={() => setErrorBanner('')}>×</button>
            </div>
          )}

          {/* View Body */}
          <main className="view-scroll-viewport">
            {tenantView === 'home' && (
              <TenantDashboard
                data={tenantHomeData}
                loading={tenantLoading}
                onNavigateTab={setTenantView}
              />
            )}
            {tenantView === 'accommodation' && (
              <TenantAccommodation
                profile={tenantHomeData?.profile || null}
                loading={tenantLoading}
              />
            )}
            {tenantView === 'payments' && (
              <TenantPayments
                financials={tenantHomeData?.financials || null}
                loading={tenantLoading}
              />
            )}
            {tenantView === 'maintenance' && (
              <TenantMaintenance
                tickets={tenantHomeData?.tickets || []}
                loading={tenantLoading}
                onSubmitTicket={handleSubmitTenantTicket}
              />
            )}
            {tenantView === 'announcements' && (
              <TenantAnnouncements
                announcements={tenantHomeData?.announcements || []}
                propertyName={tenantHomeData?.profile.pg_name}
                loading={tenantLoading}
              />
            )}
            {tenantView === 'profile' && (
              <TenantProfileView
                profile={tenantHomeData?.profile || null}
                username={username}
                loading={tenantLoading}
                onLogout={handleLogout}
              />
            )}
          </main>
        </div>
      </div>
    )
  }

  // RENDER: Owner Portal
  return (
    <div className="cohere-app-shell">
      {/* Mobile Navigation Backdrop */}
      {mobileNavOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`cohere-sidebar ${mobileNavOpen ? 'is-mobile-open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand-logo-strip">
            <span className="brand-logo-mark"><Building2 size={19} /></span>
            <div className="brand-text-block">
              <span className="brand-title">PG Manager</span>
              <span className="brand-portal-tag">Owner Command</span>
            </div>
          </div>
          <button className="mobile-close-btn" onClick={() => setMobileNavOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-nav-section">
          <span className="nav-section-title">COMMAND CENTER</span>
          <button
            className={`nav-menu-item ${ownerView === 'overview' ? 'is-active' : ''}`}
            onClick={() => { setOwnerView('overview'); setMobileNavOpen(false) }}
          >
            <Building2 size={18} /> Home
          </button>
          <button
            className={`nav-menu-item ${ownerView === 'properties' ? 'is-active' : ''}`}
            onClick={() => { setOwnerView('properties'); setMobileNavOpen(false) }}
          >
            <BedDouble size={18} /> Properties
          </button>
          <button
            className={`nav-menu-item ${ownerView === 'tenants' ? 'is-active' : ''}`}
            onClick={() => { setOwnerView('tenants'); setMobileNavOpen(false) }}
          >
            <Users size={18} />
            <span>Tenants</span>
            {allTenants.length ? (
              <span className="nav-badge-count">{allTenants.filter(t => t.is_active).length}</span>
            ) : null}
          </button>
        </div>

        <div className="sidebar-nav-section">
          <span className="nav-section-title">FINANCE & DISPATCH</span>
          <button
            className={`nav-menu-item ${ownerView === 'finance' ? 'is-active' : ''}`}
            onClick={() => { setOwnerView('finance'); setMobileNavOpen(false) }}
          >
            <Wallet size={18} /> Finance
          </button>
          <button
            className={`nav-menu-item ${ownerView === 'maintenance' ? 'is-active' : ''}`}
            onClick={() => { setOwnerView('maintenance'); setMobileNavOpen(false) }}
          >
            <Settings size={18} />
            <span>Maintenance</span>
            {allTickets.filter(t => t.status !== 'Resolved').length ? (
              <span className="nav-badge-count count-coral">
                {allTickets.filter(t => t.status !== 'Resolved').length}
              </span>
            ) : null}
          </button>
          <button
            className={`nav-menu-item ${ownerView === 'announcements' ? 'is-active' : ''}`}
            onClick={() => { setOwnerView('announcements'); setMobileNavOpen(false) }}
          >
            <Bell size={18} /> Announcements
          </button>
        </div>

        <div className="sidebar-bottom-block">
          <div className="resident-status-card owner-id-card">
            <span className="res-card-name">{username || 'Property Owner'}</span>
            <span className="res-card-pg">Administrator · {properties.length} Properties</span>
          </div>
          <button className="signout-button" onClick={handleLogout}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="cohere-main-container">
        {/* Topbar */}
        <header className="cohere-topbar">
          <div className="topbar-left">
            <button
              className="hamburger-btn"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Toggle navigation"
            >
              <Menu size={20} />
            </button>
            <div className="topbar-breadcrumbs">
              <span>Workspace</span>
              <span className="sep">/</span>
              <strong className="current-crumb">
                {ownerView === 'overview' && 'Executive Overview'}
                {ownerView === 'properties' && 'Properties & Floor Plans'}
                {ownerView === 'tenants' && 'Resident Directory'}
                {ownerView === 'finance' && 'Finance & Collections'}
                {ownerView === 'maintenance' && 'Maintenance Workspace'}
                {ownerView === 'announcements' && 'Broadcast Announcements'}
              </strong>
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-pill">
              <span className="live-dot" />
              <span>SQLite Persistent Storage</span>
            </div>
            <button
              className="button-pill-outline button-sm header-action-btn"
              onClick={() => handleOpenRecordPayment()}
            >
              <CreditCard size={14} /> Quick Collect
            </button>
            <div className="user-avatar-tag" title={username}>
              {username ? username.slice(0, 1).toUpperCase() : 'O'}
            </div>
          </div>
        </header>

        {/* Global Notifications */}
        {notice && (
          <div className="global-toast toast-success">
            <Check size={16} />
            <span>{notice}</span>
            <button onClick={() => setNotice('')}>×</button>
          </div>
        )}
        {errorBanner && (
          <div className="global-toast toast-error">
            <AlertCircle size={16} />
            <span>{errorBanner}</span>
            <button onClick={() => setErrorBanner('')}>×</button>
          </div>
        )}

        {/* View Body */}
        <main className="view-scroll-viewport">
          {ownerView === 'overview' && (
            <OwnerDashboard
              username={username}
              data={dashboardData}
              loading={ownerLoading}
              selectedMonth={selectedMonth}
              onChangeMonth={m => setSelectedMonth(m)}
              onRefresh={refreshOwnerData}
              onSelectProperty={id => {
                setActivePropertyId(id)
                setOwnerView('properties')
              }}
              onNavigateTab={tab => setOwnerView(tab as OwnerView)}
              onRecordPayment={handleOpenRecordPayment}
              onUpdateTicketStatus={handleUpdateTicketStatus}
              onAddTenantToBed={(pgId, bedId, basePrice) => {
                setActivePropertyId(pgId)
                handleOpenAddTenant(bedId, basePrice)
              }}
              onUpdateRoomBalcony={handleUpdateRoomBalcony}
            />
          )}

          {ownerView === 'properties' && (
            <OwnerProperties
              properties={properties}
              activePropertyId={activePropertyId}
              layout={layout}
              summary={propertySummary}
              loading={ownerLoading}
              onSelectProperty={id => setActivePropertyId(id)}
              onSelectBed={handleSelectBed}
              onAddTenantToBed={(bedId, basePrice) => handleOpenAddTenant(bedId, basePrice)}
            />
          )}

          {ownerView === 'tenants' && (
            <OwnerTenants
              tenants={allTenants}
              properties={properties}
              activePropertyId={activePropertyId}
              loading={ownerLoading}
              onOpenTenantRecord={handleOpenTenantRecord}
              onRecordPayment={handleOpenRecordPayment}
              onVacateTenant={handleVacateTenant}
            />
          )}

          {ownerView === 'finance' && (
            <OwnerFinance
              financeData={financeData}
              loading={ownerLoading}
              onOpenRecordPayment={handleOpenRecordPayment}
              onOpenTenantRecord={handleOpenTenantRecord}
            />
          )}

          {ownerView === 'maintenance' && (
            <OwnerMaintenance
              tickets={allTickets}
              properties={properties}
              loading={ownerLoading}
              onUpdateStatus={handleUpdateTicketStatus}
            />
          )}

          {ownerView === 'announcements' && (
            <OwnerAnnouncements
              announcements={ownerAnnouncements}
              properties={properties}
              activePropertyId={activePropertyId}
              loading={ownerLoading}
              onAddAnnouncement={handleAddAnnouncement}
              onDeleteAnnouncement={handleDeleteAnnouncement}
            />
          )}
        </main>
      </div>

      {/* Owner Modals */}
      <BedDetailsModal
        isOpen={!!selectedBedDetails}
        onClose={() => setSelectedBedDetails(null)}
        details={selectedBedDetails}
        onRecordPayment={tenantId => {
          const tenant = selectedBedDetails?.tenant
          const financials = selectedBedDetails?.financials
          setSelectedBedDetails(null)
          handleOpenRecordPayment(tenantId, tenant?.name, financials?.due_left)
        }}
        onVacateTenant={(tenantId, name) => handleVacateTenant(tenantId, name)}
        onAddTenant={bedId => {
          const base = selectedBedDetails?.bed?.base_yearly_price || 200000
          handleOpenAddTenant(bedId, base)
        }}
      />

      <AddTenantModal
        isOpen={addTenantOpen}
        onClose={() => setAddTenantOpen(false)}
        bedId={addTenantBedId}
        pgId={activePropertyId || (properties[0]?.id ?? 1)}
        basePrice={addTenantBasePrice}
        onSuccess={async msg => {
          notify(msg)
          await refreshOwnerData()
          if (activePropertyId) await loadPropertyLayout(activePropertyId)
        }}
      />

      <RecordPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        tenantId={paymentTenantId}
        tenantName={paymentTenantName}
        remainingDue={paymentDueLeft}
        onSuccess={async msg => {
          notify(msg)
          await refreshOwnerData()
          if (activePropertyId) await loadPropertyLayout(activePropertyId)
          if (inspectTenantRecord) {
            await handleOpenTenantRecord(paymentTenantId)
          }
        }}
      />

      <TenantRecordModal
        isOpen={tenantRecordModalOpen}
        onClose={() => setTenantRecordModalOpen(false)}
        record={inspectTenantRecord}
        onRecordPayment={(tenantId, name, remainingDue) => {
          setTenantRecordModalOpen(false)
          handleOpenRecordPayment(tenantId, name, remainingDue)
        }}
        onVacateTenant={handleVacateTenant}
      />
    </div>
  )
}
