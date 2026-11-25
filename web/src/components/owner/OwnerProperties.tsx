import React from 'react'
import { FloorPlan } from '../common/FloorPlan'
import { Badge } from '../common/Badge'
import { formatRupees } from '../../api'
import type { PG, Room, Bed, PGSummary } from '../../types'
import {
  Building2,
  BedDouble,
  DoorOpen,
  Plus,
  AlertCircle,
  Sparkles,
} from 'lucide-react'

interface OwnerPropertiesProps {
  properties: PG[]
  activePropertyId: number | null
  layout: Room[]
  summary: PGSummary | null
  loading: boolean
  onSelectProperty: (id: number) => void
  onSelectBed: (bed: Bed) => void
  onAddTenantToBed: (bedId: number, basePrice: number) => void
}

export const OwnerProperties: React.FC<OwnerPropertiesProps> = ({
  properties,
  activePropertyId,
  layout,
  summary,
  loading,
  onSelectProperty,
  onSelectBed,
  onAddTenantToBed,
}) => {
  const activePg = properties.find(p => p.id === activePropertyId) || properties[0]

  const allBeds = layout.flatMap(r => r.beds)
  const vacantBeds = allBeds.filter(b => b.status === 'empty')
  const occupiedBeds = allBeds.filter(b => b.status === 'occupied')
  const overdueBeds = allBeds.filter(b => b.status === 'overdue')

  return (
    <div className="properties-view-content">
      {/* Property Selector Tabs Strip */}
      <div className="property-selector-strip">
        <div className="property-tabs-scroll">
          {properties.map(pg => {
            const isSelected = pg.id === activePg?.id
            return (
              <button
                key={pg.id}
                className={`property-tab-chip ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onSelectProperty(pg.id)}
              >
                <Building2 size={16} />
                <span className="tab-property-name">{pg.name}</span>
                <span className="tab-occupancy-pill">
                  {pg.occupied_beds}/{pg.total_beds} beds
                </span>
                {pg.overdue_tenants > 0 && (
                  <span className="tab-overdue-pill" title={`${pg.overdue_tenants} overdue tenants`}>
                    !
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Property Header Bar */}
      {activePg && (
        <div className="property-masthead">
          <div className="masthead-main">
            <div className="masthead-badge">PROPERTY WORKSPACE</div>
            <h1 className="masthead-title">{activePg.name}</h1>
            <p className="masthead-address">{activePg.address}</p>
          </div>
          <div className="masthead-metrics">
            <div className="masthead-stat-box">
              <span className="stat-label">TOTAL BEDS</span>
              <strong className="stat-val">{summary?.total_beds || activePg.total_beds}</strong>
            </div>
            <div className="masthead-stat-box">
              <span className="stat-label">OCCUPIED</span>
              <strong className="stat-val text-blue">{summary?.occupied_beds || activePg.occupied_beds}</strong>
            </div>
            <div className="masthead-stat-box">
              <span className="stat-label">VACANT</span>
              <strong className="stat-val text-green">
                {Math.max(0, (summary?.total_beds || activePg.total_beds) - (summary?.occupied_beds || activePg.occupied_beds))}
              </strong>
            </div>
            <div className="masthead-stat-box">
              <span className="stat-label">OVERDUE</span>
              <strong className={`stat-val ${activePg.overdue_tenants > 0 ? 'text-coral' : 'text-green'}`}>
                {activePg.overdue_tenants}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Blueprint & Legend Area */}
      <div className="blueprint-workspace-grid">
        {/* Left Side: Architectural Floor Plan Canvas */}
        <div className="floor-plan-panel">
          <div className="panel-inner-head">
            <div>
              <span className="mono-sub-label">ARCHITECTURAL BLUEPRINT</span>
              <h2 className="panel-main-title">Interactive Floor Plan</h2>
              <p className="panel-sub-desc">
                Select any bed in the blueprint to inspect resident financials, record payments, or assign new bookings.
              </p>
            </div>
            <div className="plan-stats-badge">
              <DoorOpen size={15} /> 4 ROOMS · 8 BEDS
            </div>
          </div>

          {loading ? (
            <div className="blueprint-loading">
              <div className="loading-spinner" />
              <span>Rendering architectural layout…</span>
            </div>
          ) : (
            <FloorPlan
              rooms={layout}
              propertyName={activePg?.name}
              onSelectBed={onSelectBed}
            />
          )}

          <div className="floor-plan-foot">
            <span>
              <Building2 size={14} /> Architectural Schematic for {activePg?.name}
            </span>
            <span>Vector SVG · Real Database State · Strict Rupees</span>
          </div>
        </div>

        {/* Right Side: Bed Legend & Room Inventory Panel */}
        <div className="blueprint-side-panel">
          {/* Bed Status Legend */}
          <div className="side-card legend-side-card">
            <h3 className="side-card-title">Bed Status Legend</h3>
            <div className="legend-items-list">
              <div className="legend-item-row">
                <div className="legend-dot-label">
                  <span className="legend-indicator vacant-indicator" />
                  <div>
                    <strong>Vacant Bed</strong>
                    <span className="legend-hint">Available for immediate booking</span>
                  </div>
                </div>
                <Badge variant="vacant">{vacantBeds.length} Beds</Badge>
              </div>

              <div className="legend-item-row">
                <div className="legend-dot-label">
                  <span className="legend-indicator occupied-indicator" />
                  <div>
                    <strong>Occupied · Up to date</strong>
                    <span className="legend-hint">Installments covered to date</span>
                  </div>
                </div>
                <Badge variant="occupied">{occupiedBeds.length} Beds</Badge>
              </div>

              <div className="legend-item-row">
                <div className="legend-dot-label">
                  <span className="legend-indicator overdue-indicator" />
                  <div>
                    <strong>Payment Overdue</strong>
                    <span className="legend-hint">Requires owner collection</span>
                  </div>
                </div>
                <Badge variant="overdue">{overdueBeds.length} Beds</Badge>
              </div>
            </div>
          </div>

          {/* Room Inventory List */}
          <div className="side-card room-inventory-card">
            <h3 className="side-card-title">Room & Bed Directory</h3>
            <div className="rooms-scroll-list">
              {layout.map(room => (
                <div key={room.room_id} className="room-inventory-block">
                  <div className="room-inventory-head">
                    <div>
                      <strong>Room {String(room.room_no).padStart(2, '0')}</strong>
                      <span className="bath-tag">
                        {room.has_attached_bath ? 'Attached Bathroom' : 'Shared Common Washroom'}
                      </span>
                    </div>
                    <span className="room-beds-count">{room.beds.length} beds</span>
                  </div>

                  <div className="room-beds-buttons">
                    {room.beds.map(bed => (
                      <button
                        key={bed.bed_id}
                        className={`bed-summary-btn status-${bed.status}`}
                        onClick={() => onSelectBed(bed)}
                      >
                        <div className="bed-btn-left">
                          <BedDouble size={14} />
                          <span>Bed {bed.label}</span>
                          <span className="occupant-name">
                            {bed.tenant_name || 'Vacant'}
                          </span>
                        </div>
                        <div className="bed-btn-right">
                          <span className="bed-price">{formatRupees(bed.base_yearly_price)}</span>
                          <span className={`micro-status-dot ${bed.status}`} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Architectural Notes Banner */}
          <div className="architect-notice-card">
            <div className="notice-icon">
              <Sparkles size={16} />
            </div>
            <div>
              <strong>Sanitary Arrangement Specification</strong>
              <p>
                Rooms 01 and 02 include private attached bathrooms. Rooms 03 and 04 share the central corridor common washroom equipped with dual WC stalls and washbasin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
