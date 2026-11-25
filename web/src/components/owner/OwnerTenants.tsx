import React, { useState, useMemo } from 'react'
import { Badge } from '../common/Badge'
import { formatRupees } from '../../api'
import type { PG, TenantRecord } from '../../types'
import {
  Users,
  Search,
  Filter,
  CreditCard,
  UserX,
  Phone,
  Calendar,
  Building2,
  Home,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react'

interface OwnerTenantsProps {
  tenants: (TenantRecord['profile'] & { financials: TenantRecord['financials'] })[]
  properties: PG[]
  activePropertyId: number | null
  loading: boolean
  onOpenTenantRecord: (tenantId: number) => void
  onRecordPayment: (tenantId: number, name: string, dueLeft: number) => void
  onVacateTenant: (tenantId: number, name: string) => void
}

export const OwnerTenants: React.FC<OwnerTenantsProps> = ({
  tenants,
  properties,
  activePropertyId,
  loading,
  onOpenTenantRecord,
  onRecordPayment,
  onVacateTenant,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [propertyFilter, setPropertyFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'overdue' | 'ok' | 'vacated'>('all')
  const [roomFilter, setRoomFilter] = useState<string>('all')

  // Filter tenants
  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      // Search by name or phone
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = t.name.toLowerCase().includes(q)
        const matchPhone = t.phone.toLowerCase().includes(q)
        if (!matchName && !matchPhone) return false
      }

      // Property filter
      if (propertyFilter !== 'all') {
        const targetPgId = Number(propertyFilter)
        if (t.pg_id !== targetPgId) return false
      }

      // Room filter
      if (roomFilter !== 'all') {
        const targetRoom = Number(roomFilter)
        if (t.room_no !== targetRoom) return false
      }

      // Status filter
      if (statusFilter === 'active') {
        if (!t.is_active) return false
      } else if (statusFilter === 'vacated') {
        if (t.is_active) return false
      } else if (statusFilter === 'overdue') {
        if (!t.is_active || (t.financials?.overdue_amount || 0) <= 0) return false
      } else if (statusFilter === 'ok') {
        if (!t.is_active || (t.financials?.overdue_amount || 0) > 0) return false
      }

      return true
    })
  }, [tenants, searchQuery, propertyFilter, roomFilter, statusFilter])

  const activeCount = tenants.filter(t => t.is_active).length
  const vacatedCount = tenants.filter(t => !t.is_active).length
  const overdueCount = tenants.filter(t => t.is_active && (t.financials?.overdue_amount || 0) > 0).length

  return (
    <div className="tenants-view-content">
      {/* Header & stats */}
      <div className="view-masthead">
        <div>
          <span className="mono-sub-label">RESIDENT DIRECTORY</span>
          <h1 className="view-title">Resident Management</h1>
          <p className="view-desc">
            Complete database of current residents, historical tenancies, financial ledgers and room allocations.
          </p>
        </div>
        <div className="summary-pill-group">
          <div className="summary-pill">
            <span>ACTIVE RESIDENTS</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="summary-pill">
            <span>OVERDUE ACCOUNTS</span>
            <strong className={overdueCount > 0 ? 'text-coral' : 'text-green'}>
              {overdueCount}
            </strong>
          </div>
          <div className="summary-pill">
            <span>VACATED HISTORY</span>
            <strong>{vacatedCount}</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filters-control-bar">
        <div className="search-input-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by resident name or phone number…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        <div className="filter-dropdowns-group">
          {/* Property Dropdown */}
          <div className="filter-select-wrap">
            <label>Property:</label>
            <select
              value={propertyFilter}
              onChange={e => setPropertyFilter(e.target.value)}
            >
              <option value="all">All Properties</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Room Dropdown */}
          <div className="filter-select-wrap">
            <label>Room:</label>
            <select
              value={roomFilter}
              onChange={e => setRoomFilter(e.target.value)}
            >
              <option value="all">All Rooms</option>
              <option value="1">Room 01</option>
              <option value="2">Room 02</option>
              <option value="3">Room 03</option>
              <option value="4">Room 04</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="filter-select-wrap">
            <label>Status:</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All Records ({tenants.length})</option>
              <option value="active">Active Residents ({activeCount})</option>
              <option value="overdue">Overdue ({overdueCount})</option>
              <option value="ok">Up to Date</option>
              <option value="vacated">Vacated ({vacatedCount})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="table-container-card">
        {loading ? (
          <div className="view-loading-panel">
            <div className="loading-spinner" />
            <span>Loading resident records…</span>
          </div>
        ) : filteredTenants.length > 0 ? (
          <div className="editorial-table-wrap">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Property & Room</th>
                  <th>Join Date</th>
                  <th>Agreed Yearly Rent</th>
                  <th>Total Paid</th>
                  <th>Balance Left</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map(t => {
                  const isActive = Boolean(t.is_active)
                  const isOverdue = isActive && (t.financials?.overdue_amount || 0) > 0
                  const dueLeft = t.financials?.due_left || 0
                  const overdueAmt = t.financials?.overdue_amount || 0

                  return (
                    <tr
                      key={t.tenant_id}
                      className={`tenant-row ${!isActive ? 'row-vacated' : isOverdue ? 'row-overdue' : ''}`}
                    >
                      {/* Resident Info */}
                      <td>
                        <div className="user-name-cell">
                          <div className={`user-table-avatar ${!isActive ? 'avatar-muted' : ''}`}>
                            {t.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <strong className="user-table-name">{t.name}</strong>
                            <span className="user-table-phone">
                              <Phone size={11} /> {t.phone}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Property & Room */}
                      <td>
                        <div className="room-cell">
                          <strong>{t.pg_name || 'PG'}</strong>
                          <span>
                            Room {t.room_no || '—'}, Bed {t.bed_label || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Join Date */}
                      <td>
                        <span className="date-cell">{t.join_date}</span>
                      </td>

                      {/* Agreed Rent */}
                      <td>
                        <strong className="mono-num">{formatRupees(t.agreed_yearly_price)}</strong>
                      </td>

                      {/* Total Paid */}
                      <td>
                        <strong className="mono-num text-green">
                          {formatRupees(t.financials?.total_paid || 0)}
                        </strong>
                      </td>

                      {/* Balance Left */}
                      <td>
                        <div className="balance-cell">
                          <strong className="mono-num">{formatRupees(dueLeft)}</strong>
                          {isOverdue && (
                            <span className="overdue-sub-tag">
                              Overdue {formatRupees(overdueAmt)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        {!isActive ? (
                          <Badge variant="vacated">Vacated</Badge>
                        ) : isOverdue ? (
                          <Badge variant="overdue">Overdue</Badge>
                        ) : (
                          <Badge variant="occupied">Up to date</Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="text-right">
                        <div className="table-actions-cluster">
                          <button
                            className="button-pill-outline button-sm"
                            title="Inspect complete resident file and schedule"
                            onClick={() => onOpenTenantRecord(t.tenant_id)}
                          >
                            <FileText size={13} /> View File
                          </button>

                          {isActive && (
                            <>
                              <button
                                className="button-pill-outline button-sm button-accent"
                                title="Record payment"
                                onClick={() => onRecordPayment(t.tenant_id, t.name, dueLeft)}
                              >
                                <CreditCard size={13} /> Pay
                              </button>
                              <button
                                className="icon-btn-danger"
                                title="Vacate resident (history preserved)"
                                onClick={() => onVacateTenant(t.tenant_id, t.name)}
                              >
                                <UserX size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-box">
            <Users size={32} />
            <h3>No resident records match your criteria</h3>
            <p>Try clearing filters or search for another name or phone number.</p>
            <button
              className="button-pill-outline"
              onClick={() => {
                setSearchQuery('')
                setPropertyFilter('all')
                setRoomFilter('all')
                setStatusFilter('all')
              }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
