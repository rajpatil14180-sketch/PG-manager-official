import React, { useState, useMemo } from 'react'
import { Badge } from '../common/Badge'
import { Modal } from '../common/Modal'
import { formatRupees } from '../../api'
import type { OwnerDashboardData, Ticket, VacantBedItem } from '../../types'
import {
  Building2,
  BedDouble,
  AlertTriangle,
  Wallet,
  ArrowUpRight,
  CreditCard,
  Settings,
  Bell,
  CheckCircle2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  TrendingUp,
  DoorOpen,
  UserPlus,
  Info,
} from 'lucide-react'

interface OwnerDashboardProps {
  username: string
  data: OwnerDashboardData | null
  loading: boolean
  selectedMonth: string
  onChangeMonth: (month: string) => void
  onRefresh: () => void
  onSelectProperty: (pgId: number) => void
  onNavigateTab: (tab: 'properties' | 'tenants' | 'finance' | 'maintenance' | 'announcements') => void
  onRecordPayment: (tenantId: number, name: string, dueLeft: number) => void
  onUpdateTicketStatus: (ticketId: number, newStatus: Ticket['status']) => void
  onAddTenantToBed: (pgId: number, bedId: number, basePrice: number) => void
  onUpdateRoomBalcony: (roomId: number, hasBalcony: boolean | null) => Promise<void>
}

type SortKey = 'occ_desc' | 'occ_asc' | 'coll_desc' | 'vacant_desc' | 'overdue_desc'

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number)
  if (!y || !m) return monthStr
  const total = y * 12 + (m - 1) + delta
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

function formatMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number)
  if (!y || !m) return monthStr
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  username,
  data,
  loading,
  selectedMonth,
  onChangeMonth,
  onRefresh,
  onSelectProperty,
  onNavigateTab,
  onRecordPayment,
  onUpdateTicketStatus,
  onAddTenantToBed,
  onUpdateRoomBalcony,
}) => {
  const [vacantModalOpen, setVacantModalOpen] = useState(false)
  const [overdueModalOpen, setOverdueModalOpen] = useState(false)
  const [vacantPgFilter, setVacantPgFilter] = useState<string>('all')
  const [vacantRoomTypeFilter, setVacantRoomTypeFilter] = useState<'all' | 'attached' | 'common'>('all')
  const [historyRange, setHistoryRange] = useState<6 | 12>(6)
  const [historyPgFilter, setHistoryPgFilter] = useState<string>('all')
  const [propertySort, setPropertySort] = useState<SortKey>('occ_desc')

  // Filtered vacant beds for modal
  const filteredVacantBeds = useMemo(() => {
    if (!data?.vacant_inventory.beds) return []
    return data.vacant_inventory.beds.filter((b: VacantBedItem) => {
      if (vacantPgFilter !== 'all' && b.pg_id !== Number(vacantPgFilter)) return false
      if (vacantRoomTypeFilter === 'attached' && !b.has_attached_bath) return false
      if (vacantRoomTypeFilter === 'common' && b.has_attached_bath) return false
      return true
    })
  }, [data?.vacant_inventory.beds, vacantPgFilter, vacantRoomTypeFilter])

  // Sorted properties for comparison section
  const sortedProperties = useMemo(() => {
    if (!data?.properties) return []
    const copy = [...data.properties]
    copy.sort((a, b) => {
      if (propertySort === 'occ_desc') return b.occupancy_rate - a.occupancy_rate
      if (propertySort === 'occ_asc') return a.occupancy_rate - b.occupancy_rate
      if (propertySort === 'coll_desc') return b.collected_this_month - a.collected_this_month
      if (propertySort === 'vacant_desc') return b.vacant_monthly_potential - a.vacant_monthly_potential
      if (propertySort === 'overdue_desc') return b.current_month_overdue - a.current_month_overdue
      return 0
    })
    return copy
  }, [data?.properties, propertySort])

  // Monthly history slice (6 or 12 months, all or filtered by PG)
  const historySeries = useMemo(() => {
    if (!data?.monthly_history) return []
    const sliced = data.monthly_history.slice(-historyRange)
    return sliced.map(pt => {
      if (historyPgFilter === 'all') {
        return {
          month: pt.month,
          collected: pt.collected,
          scheduled: pt.scheduled,
          outstanding: pt.outstanding,
          scheduled_reliable: pt.scheduled_reliable,
        }
      }
      const pgSlice = pt.by_pg[historyPgFilter]
      return {
        month: pt.month,
        collected: pgSlice ? pgSlice.collected : 0,
        scheduled: pgSlice ? pgSlice.scheduled : null,
        outstanding: pgSlice ? pgSlice.outstanding : null,
        scheduled_reliable: pgSlice ? pgSlice.scheduled_reliable : false,
      }
    })
  }, [data?.monthly_history, historyRange, historyPgFilter])

  const maxChartValue = useMemo(() => {
    let maxVal = 0
    for (const pt of historySeries) {
      if (pt.collected > maxVal) maxVal = pt.collected
      if (pt.scheduled !== null && pt.scheduled > maxVal) maxVal = pt.scheduled
    }
    return maxVal > 0 ? maxVal : 1
  }, [historySeries])

  if (loading && !data) {
    return (
      <div className="view-loading-panel">
        <div className="loading-spinner" />
        <span>Loading portfolio analytics…</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="empty-box">
        <AlertTriangle size={24} />
        <h3>Unable to load portfolio dashboard</h3>
        <p>Check that the backend API is running and try refreshing.</p>
        <button className="button-primary" onClick={onRefresh}>
          <RefreshCw size={15} /> Retry
        </button>
      </div>
    )
  }

  const { portfolio, monthly_overview, vacant_inventory, next_month_outlook, overdue_tenants, recent_payments, open_tickets, recent_announcements } = data

  // Empty portfolio state (Edge Case A)
  if (portfolio.total_pgs === 0) {
    return (
      <div className="empty-box">
        <Building2 size={36} />
        <h3>No properties in your portfolio yet</h3>
        <p>Once properties, rooms, and beds are configured in the database, your portfolio analytics will appear here.</p>
      </div>
    )
  }

  // Donut chart geometry (radius 54, circumference ~339.29)
  const r = 54
  const circ = 2 * Math.PI * r
  const occFrac = portfolio.total_beds > 0 ? portfolio.occupied_beds / portfolio.total_beds : 0
  const occLen = occFrac * circ
  const vacLen = circ - occLen

  // Circular collection progress ring (radius 48, circumference ~301.59)
  const cr = 48
  const cCirc = 2 * Math.PI * cr
  const collFrac = monthly_overview.scheduled_rent > 0
    ? Math.min(1, monthly_overview.paid_against_scheduled / monthly_overview.scheduled_rent)
    : 0
  const collLen = collFrac * cCirc

  // Stacked payment status bar proportions
  const schedTotal = monthly_overview.scheduled_rent
  const paidPct = schedTotal > 0 ? (monthly_overview.paid_against_scheduled / schedTotal) * 100 : 0
  const overduePct = schedTotal > 0 ? (monthly_overview.current_month_overdue / schedTotal) * 100 : 0
  const notDuePct = schedTotal > 0 ? (monthly_overview.current_month_not_yet_due / schedTotal) * 100 : 0

  const formattedToday = new Date(data.today + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="dashboard-content">
      {/* Top Portfolio Welcome & Month Control Bar */}
      <div className="editorial-hero-band portfolio-header-band">
        <div className="hero-text-area">
          <span className="mono-sub-label">
            OWNER HOME · {formattedToday.toUpperCase()} · {portfolio.total_pgs} {portfolio.total_pgs === 1 ? 'PROPERTY' : 'PROPERTIES'}
          </span>
          <h1 className="hero-display-title">Welcome back, {username || 'Owner'}</h1>
          <p className="hero-lead-text">
            Consolidated occupancy, cash collections, arrears, vacant inventory potential, and revenue forecast across {portfolio.total_pgs} PG properties ({portfolio.total_rooms} rooms, {portfolio.total_beds} beds).
          </p>
        </div>

        <div className="portfolio-controls-cluster">
          <div className="month-navigator" aria-label="Select analytics month">
            <button
              type="button"
              className="month-nav-btn"
              title="Previous month"
              onClick={() => onChangeMonth(shiftMonth(selectedMonth, -1))}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="month-input-wrap">
              <Calendar size={14} />
              <input
                type="month"
                value={selectedMonth}
                onChange={e => {
                  if (e.target.value) onChangeMonth(e.target.value)
                }}
                aria-label="Analytics month"
              />
            </div>
            <button
              type="button"
              className="month-nav-btn"
              title="Next month"
              onClick={() => onChangeMonth(shiftMonth(selectedMonth, 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            type="button"
            className="button-pill-outline"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* SECTION A: PORTFOLIO SNAPSHOT — VISUAL ANALYTICS */}
      <div className="section-block">
        <div className="section-block-head">
          <div>
            <span className="mono-sub-label">PORTFOLIO SNAPSHOT · {formatMonthLabel(selectedMonth).toUpperCase()}</span>
            <h2 className="section-title">Occupancy, Collections & Overdue Status</h2>
          </div>
        </div>

        <div className="visual-analytics-grid">
          {/* 1. Occupancy Donut Chart Card */}
          <div className="analytics-visual-card">
            <div className="visual-card-head">
              <div>
                <span className="mono-sub-label">INVENTORY OCCUPANCY</span>
                <h3 className="visual-card-title">Bed Occupancy</h3>
              </div>
              <Badge variant="occupied">{portfolio.total_pgs} PGs · {portfolio.total_rooms} Rooms</Badge>
            </div>

            <div className="donut-layout">
              <div className="donut-svg-wrap">
                <svg viewBox="0 0 140 140" className="donut-svg" role="img" aria-label={`Portfolio occupancy ${portfolio.occupancy_percentage}%`}>
                  {/* Vacant base ring */}
                  <circle
                    cx="70"
                    cy="70"
                    r={r}
                    fill="none"
                    stroke={portfolio.total_beds > 0 ? '#2e9e5b' : '#e5e7eb'}
                    strokeWidth="16"
                    className="donut-segment clickable-segment"
                    onClick={() => setVacantModalOpen(true)}
                  >
                    <title>{`Vacant beds: ${portfolio.vacant_beds} (click to inspect)`}</title>
                  </circle>
                  {/* Occupied arc */}
                  {portfolio.occupied_beds > 0 && (
                    <circle
                      cx="70"
                      cy="70"
                      r={r}
                      fill="none"
                      stroke="#1863dc"
                      strokeWidth="16"
                      strokeDasharray={`${occLen} ${vacLen}`}
                      strokeDashoffset={circ * 0.25}
                      className="donut-segment clickable-segment"
                      onClick={() => onNavigateTab('properties')}
                    >
                      <title>{`Occupied beds: ${portfolio.occupied_beds} (click to view properties)`}</title>
                    </circle>
                  )}
                  <text x="70" y="67" textAnchor="middle" className="donut-center-pct">
                    {portfolio.occupancy_percentage}%
                  </text>
                  <text x="70" y="84" textAnchor="middle" className="donut-center-sub">
                    OCCUPIED
                  </text>
                </svg>
              </div>

              <div className="donut-legend-stats">
                <button
                  type="button"
                  className="legend-stat-btn"
                  onClick={() => onNavigateTab('properties')}
                >
                  <span className="legend-swatch swatch-blue" />
                  <div className="legend-stat-text">
                    <span>Occupied Beds</span>
                    <strong>{portfolio.occupied_beds}</strong>
                  </div>
                </button>

                <button
                  type="button"
                  className="legend-stat-btn"
                  onClick={() => setVacantModalOpen(true)}
                >
                  <span className="legend-swatch swatch-green" />
                  <div className="legend-stat-text">
                    <span>Vacant Beds</span>
                    <strong className="text-green">{portfolio.vacant_beds}</strong>
                  </div>
                </button>

                <div className="legend-stat-divider" />

                <div className="legend-total-row">
                  <span>Total Capacity</span>
                  <strong>{portfolio.total_beds} Beds</strong>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Monthly Rent Collection Circular Progress Ring */}
          <div className="analytics-visual-card">
            <div className="visual-card-head">
              <div>
                <span className="mono-sub-label">MONTHLY TARGET PROGRESS</span>
                <h3 className="visual-card-title">Rent Collection ({formatMonthLabel(selectedMonth)})</h3>
              </div>
              <button className="button-secondary" onClick={() => onNavigateTab('finance')}>
                Ledger →
              </button>
            </div>

            <div className="donut-layout">
              <div className="donut-svg-wrap">
                <svg viewBox="0 0 120 120" className="ring-svg" role="img" aria-label={`Collection progress ${monthly_overview.collection_percentage}%`}>
                  <circle
                    cx="60"
                    cy="60"
                    r={cr}
                    fill="none"
                    stroke="#eeece7"
                    strokeWidth="12"
                  />
                  {collLen > 0 && (
                    <circle
                      cx="60"
                      cy="60"
                      r={cr}
                      fill="none"
                      stroke="#003c33"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${collLen} ${cCirc}`}
                      transform="rotate(-90 60 60)"
                    />
                  )}
                  <text x="60" y="57" textAnchor="middle" className="ring-center-pct">
                    {monthly_overview.collection_percentage}%
                  </text>
                  <text x="60" y="73" textAnchor="middle" className="ring-center-sub">
                    COVERED
                  </text>
                </svg>
              </div>

              <div className="collection-breakdown-stats">
                <div className="coll-stat-line">
                  <span>Scheduled for {formatMonthLabel(selectedMonth)}</span>
                  <strong>{formatRupees(monthly_overview.scheduled_rent)}</strong>
                </div>
                <div className="coll-stat-line">
                  <span>Covered Against Schedule</span>
                  <strong className="text-green">{formatRupees(monthly_overview.paid_against_scheduled)}</strong>
                </div>
                <div className="coll-stat-line">
                  <span>Remaining to Collect</span>
                  <strong className={monthly_overview.remaining_to_collect > 0 ? 'text-coral' : 'text-green'}>
                    {formatRupees(monthly_overview.remaining_to_collect)}
                  </strong>
                </div>
                <div className="coll-stat-divider" />
                <div className="coll-stat-line cash-highlight">
                  <span>Actual Cash Received in Month</span>
                  <strong>{formatRupees(monthly_overview.actual_collected)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Payment Status Stacked Bar & Overdue Breakdown Card */}
          <div className="analytics-visual-card">
            <div className="visual-card-head">
              <div>
                <span className="mono-sub-label">CURRENT VS ARREARS</span>
                <h3 className="visual-card-title">Payment Status Breakdown</h3>
              </div>
              <button
                type="button"
                className="button-pill-outline button-sm"
                onClick={() => setOverdueModalOpen(true)}
              >
                {overdue_tenants.length} Affected
              </button>
            </div>

            {schedTotal > 0 ? (
              <div className="stacked-bar-section">
                <div className="stacked-bar-track" role="img" aria-label="Stacked bar of paid, overdue, and not yet due rent">
                  {paidPct > 0 && (
                    <div
                      className="stacked-seg seg-paid"
                      style={{ width: `${paidPct}%` }}
                      title={`Paid: ${formatRupees(monthly_overview.paid_against_scheduled)}`}
                    />
                  )}
                  {overduePct > 0 && (
                    <div
                      className="stacked-seg seg-overdue"
                      style={{ width: `${overduePct}%` }}
                      title={`Current-month overdue: ${formatRupees(monthly_overview.current_month_overdue)}`}
                    />
                  )}
                  {notDuePct > 0 && (
                    <div
                      className="stacked-seg seg-not-due"
                      style={{ width: `${notDuePct}%` }}
                      title={`Not yet due: ${formatRupees(monthly_overview.current_month_not_yet_due)}`}
                    />
                  )}
                </div>

                <div className="stacked-legend-grid">
                  <div className="stacked-legend-item">
                    <span className="legend-swatch swatch-paid" />
                    <div>
                      <span>Paid Scheduled</span>
                      <strong>{formatRupees(monthly_overview.paid_against_scheduled)}</strong>
                    </div>
                  </div>
                  <div className="stacked-legend-item">
                    <span className="legend-swatch swatch-overdue" />
                    <div>
                      <span>Month Overdue</span>
                      <strong className="text-coral">{formatRupees(monthly_overview.current_month_overdue)}</strong>
                    </div>
                  </div>
                  <div className="stacked-legend-item">
                    <span className="legend-swatch swatch-notdue" />
                    <div>
                      <span>Not Yet Due</span>
                      <strong>{formatRupees(monthly_overview.current_month_not_yet_due)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-box-subtle">
                <span>₹0 scheduled rent in {formatMonthLabel(selectedMonth)}.</span>
              </div>
            )}

            {/* Clickable Overdue + Separate Previous-Period Arrears Box */}
            <button
              type="button"
              className="clickable-overdue-summary"
              onClick={() => setOverdueModalOpen(true)}
            >
              <div className="overdue-summary-col">
                <span className="mono-sub-label">CURRENT-MONTH OVERDUE</span>
                <strong className={monthly_overview.current_month_overdue > 0 ? 'text-coral' : 'text-green'}>
                  {formatRupees(monthly_overview.current_month_overdue)}
                </strong>
                <small>{monthly_overview.overdue_tenants_count} tenant(s)</small>
              </div>
              <div className="overdue-summary-sep" />
              <div className="overdue-summary-col">
                <span className="mono-sub-label">PREVIOUS-PERIOD ARREARS</span>
                <strong className={monthly_overview.previous_period_arrears > 0 ? 'text-coral' : 'text-green'}>
                  {formatRupees(monthly_overview.previous_period_arrears)}
                </strong>
                <small>{monthly_overview.arrears_tenants_count} tenant(s) · Separate</small>
              </div>
              <ArrowUpRight size={16} className="overdue-arrow" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION B & C: VACANT INVENTORY POTENTIAL & NEXT MONTH REVENUE OUTLOOK */}
      <div className="dashboard-split-grid">
        {/* Section B: Vacant Inventory & Revenue Potential */}
        <div
          className="console-panel clickable-panel"
          role="button"
          tabIndex={0}
          onClick={() => setVacantModalOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setVacantModalOpen(true)
            }
          }}
        >
          <div className="panel-header">
            <div className="header-with-icon">
              <span className="icon-wrap-green"><BedDouble size={18} /></span>
              <div>
                <h3 className="panel-title">Vacant Inventory & Revenue Potential</h3>
                <span className="panel-caption">Estimated potential (not guaranteed or actual earned revenue)</span>
              </div>
            </div>
            <span className="button-pill-outline button-sm">
              Inspect {vacant_inventory.total_vacant_beds} Beds <ArrowUpRight size={13} />
            </span>
          </div>

          <div className="vacant-potential-hero">
            <div className="potential-stat">
              <span className="mono-sub-label">ESTIMATED MONTHLY POTENTIAL</span>
              <strong className="potential-big-num text-green">
                {formatRupees(vacant_inventory.estimated_monthly_potential)}
              </strong>
              <small>Aggregate annual ÷ 12 (whole rupees)</small>
            </div>
            <div className="potential-stat">
              <span className="mono-sub-label">ESTIMATED ANNUAL POTENTIAL</span>
              <strong className="potential-big-num">
                {formatRupees(vacant_inventory.estimated_annual_potential)}
              </strong>
              <small>{vacant_inventory.total_vacant_beds} of {vacant_inventory.total_beds} beds vacant ({vacant_inventory.vacant_percentage}%)</small>
            </div>
          </div>

          {vacant_inventory.warnings.length > 0 && (
            <div className="inline-alert alert-coral">
              <AlertTriangle size={15} />
              <span>{vacant_inventory.warnings.join(' ')}</span>
            </div>
          )}

          <div className="vacant-by-pg-list">
            {vacant_inventory.by_property.map(vp => (
              <div key={vp.pg_id} className="vacant-pg-row">
                <div className="vacant-pg-name">
                  <strong>{vp.pg_name}</strong>
                  <span>{vp.vacant_beds} vacant / {vp.total_beds} beds</span>
                </div>
                <div className="vacant-pg-bar-wrap">
                  <div
                    className="vacant-pg-bar-fill"
                    style={{
                      width: `${vp.total_beds > 0 ? (vp.vacant_beds / vp.total_beds) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="vacant-pg-amt">
                  <strong>{formatRupees(vp.estimated_monthly_potential)}/mo</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section C: Next Month Revenue Outlook */}
        <div className="console-panel outlook-dark-panel">
          <div className="panel-header outlook-head">
            <div className="header-with-icon">
              <span className="icon-wrap-outlook"><TrendingUp size={18} /></span>
              <div>
                <h3 className="panel-title">Next Month Revenue Outlook ({formatMonthLabel(next_month_outlook.month)})</h3>
                <span className="panel-caption">Excludes previous arrears · Separates contracted rent vs. vacant estimate</span>
              </div>
            </div>
            <Badge variant="stone">{next_month_outlook.contributing_properties} PGs</Badge>
          </div>

          <div className="outlook-metrics-stack">
            <div className="outlook-row">
              <div>
                <strong>Contracted Scheduled Rent</strong>
                <small>Active tenants ({next_month_outlook.occupied_beds} occupied beds)</small>
              </div>
              <strong className="outlook-amount">{formatRupees(next_month_outlook.contracted_rent)}</strong>
            </div>

            <div className="outlook-row">
              <div>
                <strong>Estimated Vacant-Bed Potential</strong>
                <small>Speculative estimate ({next_month_outlook.vacant_beds} vacant beds) — not confirmed</small>
              </div>
              <strong className="outlook-amount text-mint">
                + {formatRupees(next_month_outlook.estimated_vacant_potential)}
              </strong>
            </div>

            <div className="outlook-total-row">
              <div>
                <span className="mono-sub-label">COMBINED REVENUE OPPORTUNITY</span>
                <small>Contracted + estimated vacant potential</small>
              </div>
              <strong className="outlook-combined-num">
                {formatRupees(next_month_outlook.combined_opportunity)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION D: MONTH-WISE COLLECTION ANALYTICS */}
      <div className="section-block">
        <div className="console-panel">
          <div className="panel-header analytics-chart-header">
            <div>
              <span className="mono-sub-label">HISTORICAL & CURRENT COLLECTIONS</span>
              <h2 className="section-title">Month-Wise Collection Analytics</h2>
              <p className="panel-caption">
                Actual cash collected by payment date vs. reliable scheduled rent. Click any bar to inspect that month.
              </p>
            </div>

            <div className="chart-controls-group">
              <select
                className="filter-select-sm"
                value={historyPgFilter}
                onChange={e => setHistoryPgFilter(e.target.value)}
                aria-label="Filter chart by property"
              >
                <option value="all">All Properties</option>
                {data.properties.map(p => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>

              <div className="segmented-toggle" role="group" aria-label="Chart range">
                <button
                  type="button"
                  className={historyRange === 6 ? 'is-active' : ''}
                  onClick={() => setHistoryRange(6)}
                >
                  6 Months
                </button>
                <button
                  type="button"
                  className={historyRange === 12 ? 'is-active' : ''}
                  onClick={() => setHistoryRange(12)}
                >
                  12 Months
                </button>
              </div>
            </div>
          </div>

          {/* Historical Reliability Notice if legacy vacated tenants exist */}
          {historySeries.some(pt => !pt.scheduled_reliable) && (
            <div className="inline-alert alert-stone">
              <Info size={16} />
              <span>
                Historical scheduled rent is marked <strong>Incomplete</strong> for earlier months where legacy vacated tenants have no recorded vacating date. Actual cash collections remain exact from payment records.
              </span>
            </div>
          )}

          {/* Responsive Bar Chart */}
          <div className="bar-chart-scroll">
            <div className="bar-chart-grid">
              {historySeries.map(pt => {
                const isSelected = pt.month === selectedMonth
                const collH = Math.round((pt.collected / maxChartValue) * 140)
                const schedH = pt.scheduled !== null ? Math.round((pt.scheduled / maxChartValue) * 140) : 0

                return (
                  <button
                    key={pt.month}
                    type="button"
                    className={`bar-column-btn ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => onChangeMonth(pt.month)}
                    title={`${formatMonthLabel(pt.month)}: Collected ${formatRupees(pt.collected)}${pt.scheduled !== null ? ` / Scheduled ${formatRupees(pt.scheduled)}` : ' (Scheduled incomplete)'}`}
                  >
                    <div className="bars-pair">
                      {pt.scheduled !== null && (
                        <div
                          className="bar-rect bar-scheduled"
                          style={{ height: `${Math.max(4, schedH)}px` }}
                        />
                      )}
                      <div
                        className="bar-rect bar-collected"
                        style={{ height: `${Math.max(pt.collected > 0 ? 6 : 2, collH)}px` }}
                      />
                    </div>
                    <span className="bar-month-label">{formatMonthLabel(pt.month)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="chart-legend-strip">
            <span><i className="legend-swatch swatch-collected" /> Actual Cash Collected</span>
            <span><i className="legend-swatch swatch-scheduled" /> Scheduled Rent (when reliable)</span>
          </div>

          {/* Month-wise Table */}
          <div className="editorial-table-wrap" style={{ marginTop: '16px' }}>
            <table className="editorial-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="text-right">Scheduled Rent</th>
                  <th className="text-right">Collected</th>
                  <th className="text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {[...historySeries].reverse().map(pt => (
                  <tr
                    key={pt.month}
                    className={pt.month === selectedMonth ? 'row-highlighted' : ''}
                    onClick={() => onChangeMonth(pt.month)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <strong>{formatMonthLabel(pt.month)}</strong>
                      {pt.month === selectedMonth && (
                        <span style={{ marginLeft: '8px' }}>
                          <Badge variant="active">Selected</Badge>
                        </span>
                      )}
                    </td>
                    <td className="text-right mono-num">
                      {pt.scheduled !== null ? formatRupees(pt.scheduled) : <span className="muted-tag">Incomplete</span>}
                    </td>
                    <td className="text-right mono-num text-green">
                      <strong>{formatRupees(pt.collected)}</strong>
                    </td>
                    <td className="text-right mono-num">
                      {pt.outstanding !== null ? formatRupees(pt.outstanding) : <span className="muted-tag">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION E: PROPERTY-WISE COMPARISON */}
      <div className="section-block">
        <div className="section-block-head">
          <div>
            <span className="mono-sub-label">PROPERTY COMPARISON · {formatMonthLabel(selectedMonth).toUpperCase()}</span>
            <h2 className="section-title">Properties Performance</h2>
          </div>
          <div className="filter-select-wrap">
            <label>Sort by:</label>
            <select
              value={propertySort}
              onChange={e => setPropertySort(e.target.value as SortKey)}
            >
              <option value="occ_desc">Highest occupancy</option>
              <option value="occ_asc">Lowest occupancy</option>
              <option value="coll_desc">Highest collection</option>
              <option value="vacant_desc">Highest vacant-bed potential</option>
              <option value="overdue_desc">Highest overdue amount</option>
            </select>
          </div>
        </div>

        <div className="property-card-grid">
          {sortedProperties.map(pg => (
            <div
              key={pg.id}
              className="cohere-product-card"
              onClick={() => onSelectProperty(pg.id)}
            >
              <div className="card-top-row">
                <div className="property-badge-name">
                  <span className="property-dot" />
                  <span className="property-type-tag">{pg.total_rooms} ROOMS · {pg.total_beds} BEDS</span>
                </div>
                <Badge variant={pg.vacant_beds === 0 ? 'resolved' : 'vacant'}>
                  {pg.vacant_beds === 0 ? 'Fully Occupied' : `${pg.vacant_beds} Vacant`}
                </Badge>
              </div>

              <h3 className="card-property-title">{pg.name}</h3>
              <p className="card-property-address">{pg.address}</p>

              <div className="card-progress-section">
                <div className="progress-labels">
                  <span>Occupancy ({pg.occupied_beds}/{pg.total_beds} beds)</span>
                  <strong>{pg.occupancy_rate}%</strong>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${pg.occupancy_rate}%` }} />
                </div>
              </div>

              <div className="property-compare-metrics">
                <div className="compare-row">
                  <span>Scheduled ({formatMonthLabel(selectedMonth)})</span>
                  <strong className="mono-num">{formatRupees(pg.scheduled_rent)}</strong>
                </div>
                <div className="compare-row">
                  <span>Collected in Month</span>
                  <strong className="mono-num text-green">{formatRupees(pg.collected_this_month)}</strong>
                </div>
                <div className="compare-row">
                  <span>Current-Month Overdue</span>
                  <strong className={`mono-num ${pg.current_month_overdue > 0 ? 'text-coral' : 'text-green'}`}>
                    {formatRupees(pg.current_month_overdue)}
                  </strong>
                </div>
                <div className="compare-row">
                  <span>Vacant Monthly Potential (Est.)</span>
                  <strong className="mono-num">{formatRupees(pg.vacant_monthly_potential)}</strong>
                </div>
              </div>

              <div className="card-footer-cta">
                <span>Open Property Workspace</span>
                <ArrowUpRight size={16} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* OPERATIONAL FEEDS: MAINTENANCE & RECENT COLLECTIONS & ANNOUNCEMENTS */}
      <div className="dashboard-split-grid">
        {/* Maintenance Action Center */}
        <div className="console-panel">
          <div className="panel-header">
            <div className="header-with-icon">
              <span className="icon-wrap-blue"><Settings size={17} /></span>
              <div>
                <h3 className="panel-title">Maintenance Requiring Attention</h3>
                <span className="panel-caption">{portfolio.open_tickets_count} unresolved resident reports</span>
              </div>
            </div>
            <button className="button-secondary" onClick={() => onNavigateTab('maintenance')}>
              All Tickets →
            </button>
          </div>

          {open_tickets.length > 0 ? (
            <div className="tickets-compact-list">
              {open_tickets.slice(0, 5).map(ticket => (
                <div key={ticket.id} className="ticket-compact-row">
                  <div className="ticket-compact-left">
                    <div className="ticket-compact-meta">
                      <Badge variant={ticket.urgency.toLowerCase() as any}>{ticket.urgency}</Badge>
                      <span className="ticket-category-tag">{ticket.category}</span>
                      <span className="ticket-age-tag">{ticket.age_in_days}d ago</span>
                    </div>
                    <p className="ticket-compact-desc">{ticket.description}</p>
                    <span className="ticket-resident-sub">
                      {ticket.tenant_name || 'Resident'} · {ticket.pg_name} · Room {ticket.room_no}, Bed {ticket.bed_label}
                    </span>
                  </div>
                  <div className="ticket-quick-actions">
                    <select
                      className="status-dropdown-sm"
                      value={ticket.status}
                      onChange={e => onUpdateTicketStatus(ticket.id, e.target.value as any)}
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-box-subtle">
              <CheckCircle2 size={24} className="text-green" />
              <span>No open maintenance tickets.</span>
            </div>
          )}
        </div>

        {/* Recent Collections & Announcements */}
        <div className="console-panel">
          <div className="panel-header">
            <div className="header-with-icon">
              <span className="icon-wrap-green"><Wallet size={17} /></span>
              <div>
                <h3 className="panel-title">Recent Collections</h3>
                <span className="panel-caption">Latest verified payments across properties</span>
              </div>
            </div>
            <button className="button-secondary" onClick={() => onNavigateTab('finance')}>
              Full Ledger →
            </button>
          </div>

          {recent_payments.length > 0 ? (
            <div className="recent-payments-list">
              {recent_payments.slice(0, 5).map((p, idx) => (
                <div key={`${p.paid_on}-${idx}`} className="recent-pay-row">
                  <div className="pay-avatar"><CreditCard size={15} /></div>
                  <div className="pay-details">
                    <strong>{p.tenant_name}</strong>
                    <span className="pay-meta">
                      {p.pg_name} · Room {p.room_no}, Bed {p.bed_label} · {p.mode.toUpperCase()}
                    </span>
                  </div>
                  <div className="pay-amount-col">
                    <strong className="text-green">{formatRupees(p.amount)}</strong>
                    <span className="pay-date">{p.paid_on}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-box-subtle"><span>No payments recorded yet.</span></div>
          )}

          {recent_announcements.length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <strong style={{ fontSize: '13.5px' }}><Bell size={14} style={{ verticalAlign: 'middle' }} /> Latest Announcements</strong>
                <button className="button-secondary" onClick={() => onNavigateTab('announcements')}>Manage →</button>
              </div>
              <div className="announcements-compact-feed">
                {recent_announcements.slice(0, 2).map(ann => (
                  <div key={ann.id} className="announcement-compact-card">
                    <div className="ann-card-header">
                      <span className="ann-pg-tag">{ann.pg_name}</span>
                      <span className="ann-date">{new Date(ann.created_at).toLocaleDateString('en-IN')}</span>
                    </div>
                    <p className="ann-message">{ann.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: VACANT INVENTORY & BED VALUATION BREAKDOWN */}
      <Modal
        isOpen={vacantModalOpen}
        onClose={() => setVacantModalOpen(false)}
        subtitle="VACANT INVENTORY · ESTIMATED POTENTIAL"
        title={`Vacant Beds (${vacant_inventory.total_vacant_beds})`}
        maxWidth="820px"
      >
        <div className="vacant-modal-body">
          <div className="vacant-modal-summary">
            <div>
              <span className="mono-sub-label">MONTHLY POTENTIAL (EST.)</span>
              <strong className="text-green">{formatRupees(vacant_inventory.estimated_monthly_potential)}</strong>
            </div>
            <div>
              <span className="mono-sub-label">ANNUAL POTENTIAL (EST.)</span>
              <strong>{formatRupees(vacant_inventory.estimated_annual_potential)}</strong>
            </div>
            <div className="vacant-modal-filters">
              <select
                value={vacantPgFilter}
                onChange={e => setVacantPgFilter(e.target.value)}
                aria-label="Filter vacant beds by property"
              >
                <option value="all">All Properties</option>
                {data.properties.map(p => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>
              <select
                value={vacantRoomTypeFilter}
                onChange={e => setVacantRoomTypeFilter(e.target.value as any)}
                aria-label="Filter vacant beds by bathroom type"
              >
                <option value="all">All Room Types</option>
                <option value="attached">Attached Bathroom</option>
                <option value="common">Common Washroom</option>
              </select>
            </div>
          </div>

          {filteredVacantBeds.length > 0 ? (
            <div className="vacant-beds-cards-list">
              {filteredVacantBeds.map(bed => (
                <div key={bed.bed_id} className="vacant-bed-detail-card">
                  <div className="vacant-bed-main">
                    <div className="vacant-bed-title-row">
                      <strong>{bed.pg_name} · Room {bed.room_no}, Bed {bed.bed_label}</strong>
                      <Badge variant="vacant">Vacant</Badge>
                    </div>
                    <div className="vacant-bed-specs">
                      <span>Bathroom: <strong>{bed.has_attached_bath ? 'Attached' : 'Common'}</strong></span>
                      <span>
                        Balcony:{' '}
                        <select
                          className="inline-balcony-select"
                          value={bed.has_balcony === null ? 'unknown' : bed.has_balcony ? 'yes' : 'no'}
                          onChange={e => {
                            const v = e.target.value
                            onUpdateRoomBalcony(bed.room_id, v === 'unknown' ? null : v === 'yes')
                          }}
                          aria-label={`Balcony status for ${bed.pg_name} Room ${bed.room_no}`}
                        >
                          <option value="unknown">Unknown (Not configured)</option>
                          <option value="yes">Yes (Attached Balcony)</option>
                          <option value="no">No</option>
                        </select>
                      </span>
                    </div>
                  </div>

                  <div className="vacant-bed-pricing">
                    <div>
                      <span className="mono-sub-label">BASE YEARLY</span>
                      <strong>{bed.base_yearly_price !== null ? formatRupees(bed.base_yearly_price) : 'Unavailable'}</strong>
                    </div>
                    <div>
                      <span className="mono-sub-label">EST. MONTHLY</span>
                      <strong className="text-green">{bed.monthly_equivalent !== null ? formatRupees(bed.monthly_equivalent) : '—'}</strong>
                    </div>
                  </div>

                  <div className="vacant-bed-actions">
                    <button
                      type="button"
                      className="button-pill-outline button-sm"
                      onClick={() => {
                        setVacantModalOpen(false)
                        onSelectProperty(bed.pg_id)
                      }}
                    >
                      <DoorOpen size={13} /> Blueprint
                    </button>
                    <button
                      type="button"
                      className="button-primary button-sm"
                      onClick={() => {
                        setVacantModalOpen(false)
                        onAddTenantToBed(bed.pg_id, bed.bed_id, bed.base_yearly_price || 200000)
                      }}
                    >
                      <UserPlus size={13} /> Add Tenant
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-box">
              <CheckCircle2 size={28} className="text-green" />
              <h3>No vacant beds match your filter</h3>
              <p>All matching beds are currently occupied.</p>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 2: OVERDUE & ARREARS TENANT BREAKDOWN */}
      <Modal
        isOpen={overdueModalOpen}
        onClose={() => setOverdueModalOpen(false)}
        subtitle={`OVERDUE & ARREARS · ${formatMonthLabel(selectedMonth).toUpperCase()}`}
        title={`Affected Tenants (${overdue_tenants.length})`}
        maxWidth="780px"
      >
        {overdue_tenants.length > 0 ? (
          <div className="editorial-table-wrap">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>PG & Bed</th>
                  <th className="text-right">Month Overdue</th>
                  <th className="text-right">Prev. Arrears</th>
                  <th>Next Due</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {overdue_tenants.map(t => (
                  <tr key={t.tenant_id}>
                    <td>
                      <strong>{t.name}</strong>
                      <span className="user-table-phone">{t.phone}</span>
                    </td>
                    <td>
                      <strong>{t.pg_name}</strong>
                      <span className="room-sub">Room {t.room_no}, Bed {t.bed_label}</span>
                    </td>
                    <td className="text-right mono-num text-coral">
                      <strong>{formatRupees(t.current_month_overdue)}</strong>
                    </td>
                    <td className="text-right mono-num">
                      {formatRupees(t.previous_period_arrears)}
                    </td>
                    <td className="date-cell">{t.next_due_date || '—'}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="button-pill-outline button-sm button-accent"
                        onClick={() => {
                          setOverdueModalOpen(false)
                          onRecordPayment(t.tenant_id, t.name, t.due_left)
                        }}
                      >
                        <CreditCard size={13} /> Collect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-box">
            <CheckCircle2 size={28} className="text-green" />
            <h3>No overdue payments</h3>
            <p>All active tenants are up to date for {formatMonthLabel(selectedMonth)}.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
