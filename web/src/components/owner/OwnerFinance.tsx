import React, { useState, useMemo } from 'react'
import { MetricCard } from '../common/MetricCard'
import { Badge } from '../common/Badge'
import { formatRupees } from '../../api'
import type { OwnerFinanceData, Payment, TenantRecord } from '../../types'
import {
  Wallet,
  Clock,
  AlertTriangle,
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Building2,
  FileText,
} from 'lucide-react'

interface OwnerFinanceProps {
  financeData: OwnerFinanceData | null
  loading: boolean
  onOpenRecordPayment: (tenantId?: number, name?: string, remainingDue?: number) => void
  onOpenTenantRecord: (tenantId: number) => void
}

export const OwnerFinance: React.FC<OwnerFinanceProps> = ({
  financeData,
  loading,
  onOpenRecordPayment,
  onOpenTenantRecord,
}) => {
  const [activeTab, setActiveTab] = useState<'tenants' | 'ledger' | 'properties'>('tenants')
  const [searchQuery, setSearchQuery] = useState('')
  const [modeFilter, setModeFilter] = useState<'all' | 'upi' | 'cash'>('all')

  const summary = financeData?.summary || {
    total_expected: 0,
    total_collected: 0,
    outstanding_amount: 0,
    total_overdue: 0,
  }

  // Filter payments ledger
  const filteredPayments = useMemo(() => {
    if (!financeData?.payments) return []
    return financeData.payments.filter(p => {
      if (modeFilter !== 'all' && p.mode !== modeFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = (p.tenant_name || '').toLowerCase().includes(q)
        const matchPg = (p.pg_name || '').toLowerCase().includes(q)
        const matchDate = (p.paid_on || '').includes(q)
        if (!matchName && !matchPg && !matchDate) return false
      }
      return true
    })
  }, [financeData?.payments, modeFilter, searchQuery])

  // Filter tenant financials
  const filteredTenants = useMemo(() => {
    if (!financeData?.tenants) return []
    return financeData.tenants.filter(t => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = t.name.toLowerCase().includes(q)
        const matchPg = (t.pg_name || '').toLowerCase().includes(q)
        if (!matchName && !matchPg) return false
      }
      return true
    })
  }, [financeData?.tenants, searchQuery])

  if (loading && !financeData) {
    return (
      <div className="view-loading-panel">
        <div className="loading-spinner" />
        <span>Loading financial ledger and metrics…</span>
      </div>
    )
  }

  return (
    <div className="finance-view-content">
      {/* Editorial Header */}
      <div className="view-masthead">
        <div>
          <span className="mono-sub-label">REVENUE & COLLECTIONS</span>
          <h1 className="view-title">Finance & Payments</h1>
          <p className="view-desc">
            Complete financial tracking, cash and UPI payment records, and tenant-wise installment reconciliations.
          </p>
        </div>
        <div className="masthead-cta-area">
          <button
            className="button-primary"
            onClick={() => onOpenRecordPayment()}
          >
            <CreditCard size={16} /> Record New Payment
          </button>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="finance-metrics-strip">
        <MetricCard
          label="TOTAL EXPECTED TO DATE"
          value={formatRupees(summary.total_expected)}
          hint="Sum of installments due on or before today"
          icon={<Clock size={18} />}
          variant="stone"
        />
        <MetricCard
          label="TOTAL REVENUE COLLECTED"
          value={formatRupees(summary.total_collected)}
          hint="All verified payments recorded"
          icon={<Wallet size={18} />}
          variant="green"
        />
        <MetricCard
          label="OUTSTANDING BALANCE"
          value={formatRupees(summary.outstanding_amount)}
          hint="Uncollected yearly tenancy value"
          icon={<CreditCard size={18} />}
        />
        <MetricCard
          label="OVERDUE AMOUNT"
          value={formatRupees(summary.total_overdue)}
          hint={summary.total_overdue > 0 ? 'Behind schedule payments' : 'All accounts fully covered'}
          icon={<AlertTriangle size={18} />}
          variant={summary.total_overdue > 0 ? 'coral' : 'default'}
        />
      </div>

      {/* Section Sub-Navigation Tabs */}
      <div className="sub-nav-tabs-bar">
        <div className="sub-nav-tabs">
          <button
            className={`sub-nav-tab ${activeTab === 'tenants' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('tenants')}
          >
            Tenant Financial Status ({financeData?.tenants.length || 0})
          </button>
          <button
            className={`sub-nav-tab ${activeTab === 'ledger' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('ledger')}
          >
            Payment Transaction Ledger ({financeData?.payments.length || 0})
          </button>
          <button
            className={`sub-nav-tab ${activeTab === 'properties' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('properties')}
          >
            Property Comparison
          </button>
        </div>

        {/* Search bar inside tab strip */}
        {activeTab !== 'properties' && (
          <div className="tab-search-bar">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder={activeTab === 'tenants' ? 'Search resident…' : 'Search payments…'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* TAB 1: Tenant-wise Financial Status */}
      {activeTab === 'tenants' && (
        <div className="table-container-card">
          <div className="editorial-table-wrap">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Property & Bed</th>
                  <th>Agreed Yearly Rent</th>
                  <th>Total Paid</th>
                  <th>Balance Left</th>
                  <th>Overdue Amount</th>
                  <th>Next Due Date</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map(t => {
                  const fin = t.financials
                  const isOverdue = (fin?.overdue_amount || 0) > 0

                  return (
                    <tr key={t.tenant_id} className={!t.is_active ? 'row-vacated' : isOverdue ? 'row-overdue' : ''}>
                      <td>
                        <strong className="user-table-name">{t.name}</strong>
                        <span className="user-table-phone">{t.phone}</span>
                      </td>
                      <td>
                        <strong>{t.pg_name}</strong>
                        <span className="room-sub">Room {t.room_no}, Bed {t.bed_label}</span>
                      </td>
                      <td>
                        <strong className="mono-num">{formatRupees(t.agreed_yearly_price)}</strong>
                      </td>
                      <td>
                        <strong className="mono-num text-green">{formatRupees(fin?.total_paid || 0)}</strong>
                      </td>
                      <td>
                        <strong className="mono-num">{formatRupees(fin?.due_left || 0)}</strong>
                      </td>
                      <td>
                        <strong className={`mono-num ${isOverdue ? 'text-coral' : 'text-green'}`}>
                          {formatRupees(fin?.overdue_amount || 0)}
                        </strong>
                      </td>
                      <td>
                        <span className="date-cell">{fin?.next_due_date || 'Fully Paid'}</span>
                      </td>
                      <td>
                        {!t.is_active ? (
                          <Badge variant="vacated">Vacated</Badge>
                        ) : isOverdue ? (
                          <Badge variant="overdue">Overdue</Badge>
                        ) : (
                          <Badge variant="occupied">Up to date</Badge>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="table-actions-cluster">
                          <button
                            className="button-pill-outline button-sm"
                            onClick={() => onOpenTenantRecord(t.tenant_id)}
                          >
                            <FileText size={13} /> Details
                          </button>
                          {Boolean(t.is_active) && (
                            <button
                              className="button-pill-outline button-sm button-accent"
                              onClick={() => onOpenRecordPayment(t.tenant_id, t.name, fin?.due_left)}
                            >
                              <CreditCard size={13} /> Collect
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Payment Transaction Ledger */}
      {activeTab === 'ledger' && (
        <div className="table-container-card">
          <div className="ledger-filter-controls">
            <span className="filter-label">Filter Mode:</span>
            <button
              className={`filter-chip ${modeFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setModeFilter('all')}
            >
              All Modes
            </button>
            <button
              className={`filter-chip ${modeFilter === 'upi' ? 'is-active' : ''}`}
              onClick={() => setModeFilter('upi')}
            >
              UPI Online
            </button>
            <button
              className={`filter-chip ${modeFilter === 'cash' ? 'is-active' : ''}`}
              onClick={() => setModeFilter('cash')}
            >
              Cash in Hand
            </button>
          </div>

          <div className="editorial-table-wrap">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Payment Date</th>
                  <th>Resident</th>
                  <th>Property Allocation</th>
                  <th>Payment Mode</th>
                  <th className="text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map(p => (
                  <tr key={p.id}>
                    <td>
                      <span className="tx-id-badge">TX-{String(p.id).padStart(4, '0')}</span>
                    </td>
                    <td>
                      <span className="date-cell">{p.paid_on}</span>
                    </td>
                    <td>
                      <strong className="user-table-name">{p.tenant_name}</strong>
                    </td>
                    <td>
                      <span>{p.pg_name}</span>
                      <span className="room-sub">Room {p.room_no}, Bed {p.bed_label}</span>
                    </td>
                    <td>
                      <span className={`mode-badge mode-${p.mode}`}>
                        {p.mode.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-right">
                      <strong className="mono-num text-green">{formatRupees(p.amount)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Property Comparison Summary */}
      {activeTab === 'properties' && (
        <div className="property-summaries-grid">
          {(financeData?.property_summaries || []).map(pg => {
            const occPct = pg.total_beds ? Math.round((pg.occupied_beds / pg.total_beds) * 100) : 0
            const collectionPct = pg.total_expected ? Math.round((pg.total_collected / pg.total_expected) * 100) : 0

            return (
              <div key={pg.id} className="cohere-product-card property-fin-card">
                <div className="card-top-row">
                  <span className="property-type-tag"><Building2 size={13} /> PROPERTY</span>
                  <Badge variant="stone">{occPct}% Occupancy</Badge>
                </div>

                <h3 className="card-property-title">{pg.name}</h3>
                <p className="card-property-address">{pg.address}</p>

                <div className="fin-stats-stack">
                  <div className="fin-stat-row">
                    <span>Expected to date:</span>
                    <strong>{formatRupees(pg.total_expected)}</strong>
                  </div>
                  <div className="fin-stat-row">
                    <span>Total collected:</span>
                    <strong className="text-green">{formatRupees(pg.total_collected)}</strong>
                  </div>
                  <div className="fin-stat-row">
                    <span>Overdue amount:</span>
                    <strong className={pg.total_overdue > 0 ? 'text-coral' : 'text-green'}>
                      {formatRupees(pg.total_overdue)}
                    </strong>
                  </div>
                </div>

                <div className="progress-labels">
                  <span>Collection Reconciled</span>
                  <strong>{collectionPct}%</strong>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(100, collectionPct)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
