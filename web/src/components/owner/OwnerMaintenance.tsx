import React, { useState, useMemo } from 'react'
import { Badge } from '../common/Badge'
import type { PG, Ticket } from '../../types'
import {
  Settings,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Home,
  User,
} from 'lucide-react'

interface OwnerMaintenanceProps {
  tickets: Ticket[]
  properties: PG[]
  loading: boolean
  onUpdateStatus: (ticketId: number, status: Ticket['status']) => void
}

export const OwnerMaintenance: React.FC<OwnerMaintenanceProps> = ({
  tickets,
  properties,
  loading,
  onUpdateStatus,
}) => {
  const [propertyFilter, setPropertyFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (propertyFilter !== 'all' && t.pg_id !== Number(propertyFilter)) return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (urgencyFilter !== 'all' && t.urgency !== urgencyFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchDesc = t.description.toLowerCase().includes(q)
        const matchTenant = (t.tenant_name || '').toLowerCase().includes(q)
        const matchCat = t.category.toLowerCase().includes(q)
        if (!matchDesc && !matchTenant && !matchCat) return false
      }
      return true
    })
  }, [tickets, propertyFilter, statusFilter, urgencyFilter, searchQuery])

  const openCount = tickets.filter(t => t.status === 'Open').length
  const inProgressCount = tickets.filter(t => t.status === 'In Progress').length
  const resolvedCount = tickets.filter(t => t.status === 'Resolved').length

  return (
    <div className="maintenance-view-content">
      {/* Editorial Masthead */}
      <div className="view-masthead">
        <div>
          <span className="mono-sub-label">PROPERTY CARE & OPERATIONS</span>
          <h1 className="view-title">Maintenance Requests</h1>
          <p className="view-desc">
            Track and resolve repair issues reported by residents across plumbing, electrical, Wi-Fi, cleaning and furniture.
          </p>
        </div>
        <div className="summary-pill-group">
          <div className="summary-pill">
            <span>OPEN TICKETS</span>
            <strong className="text-coral">{openCount}</strong>
          </div>
          <div className="summary-pill">
            <span>IN PROGRESS</span>
            <strong className="text-blue">{inProgressCount}</strong>
          </div>
          <div className="summary-pill">
            <span>RESOLVED</span>
            <strong className="text-green">{resolvedCount}</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filters-control-bar">
        <div className="search-input-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search tickets by description, resident, or category…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-dropdowns-group">
          {/* Property Filter */}
          <div className="filter-select-wrap">
            <label>Property:</label>
            <select
              value={propertyFilter}
              onChange={e => setPropertyFilter(e.target.value)}
            >
              <option value="all">All Properties</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="filter-select-wrap">
            <label>Status:</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses ({tickets.length})</option>
              <option value="Open">Open ({openCount})</option>
              <option value="In Progress">In Progress ({inProgressCount})</option>
              <option value="Resolved">Resolved ({resolvedCount})</option>
            </select>
          </div>

          {/* Urgency Filter */}
          <div className="filter-select-wrap">
            <label>Urgency:</label>
            <select
              value={urgencyFilter}
              onChange={e => setUrgencyFilter(e.target.value)}
            >
              <option value="all">All Urgencies</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets List */}
      <div className="table-container-card">
        {loading ? (
          <div className="view-loading-panel">
            <div className="loading-spinner" />
            <span>Loading maintenance tickets…</span>
          </div>
        ) : filteredTickets.length > 0 ? (
          <div className="editorial-table-wrap">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th>Ticket Details</th>
                  <th>Category</th>
                  <th>Property Allocation</th>
                  <th>Reported By</th>
                  <th>Age</th>
                  <th>Urgency</th>
                  <th className="text-right">Status Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map(t => (
                  <tr key={t.id} className={t.status === 'Resolved' ? 'row-resolved' : ''}>
                    {/* Ticket description & ID */}
                    <td style={{ maxWidth: '300px' }}>
                      <div className="ticket-cell-main">
                        <span className="ticket-id-tag">#TICK-{String(t.id).padStart(3, '0')}</span>
                        <p className="ticket-cell-desc">{t.description}</p>
                      </div>
                    </td>

                    {/* Category */}
                    <td>
                      <span className="category-pill">{t.category}</span>
                    </td>

                    {/* Property & Bed */}
                    <td>
                      <div className="room-cell">
                        <strong>{t.pg_name || 'PG'}</strong>
                        <span>Room {t.room_no || '—'}, Bed {t.bed_label || '—'}</span>
                      </div>
                    </td>

                    {/* Resident */}
                    <td>
                      <div className="resident-cell">
                        <strong>{t.tenant_name || 'Resident'}</strong>
                      </div>
                    </td>

                    {/* Age in Days */}
                    <td>
                      <span className="date-cell">
                        {t.age_in_days === 0 ? 'Today' : `${t.age_in_days}d ago`}
                      </span>
                    </td>

                    {/* Urgency */}
                    <td>
                      <Badge variant={t.urgency.toLowerCase() as any}>
                        {t.urgency}
                      </Badge>
                    </td>

                    {/* Status Dropdown */}
                    <td className="text-right">
                      <select
                        className={`status-select-control status-${t.status.toLowerCase().replace(' ', '-')}`}
                        value={t.status}
                        onChange={e => onUpdateStatus(t.id, e.target.value as Ticket['status'])}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-box">
            <CheckCircle2 size={32} className="text-green" />
            <h3>No maintenance tickets found</h3>
            <p>No issues match the selected property, status or urgency filters.</p>
          </div>
        )}
      </div>
    </div>
  )
}
