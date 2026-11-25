import React from 'react'
import { Modal } from '../common/Modal'
import { Badge } from '../common/Badge'
import { formatRupees } from '../../api'
import type { Bed, TenantRecord } from '../../types'
import { CreditCard, UserX, UserPlus, Phone, Calendar, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface BedDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  details: {
    bed: Bed
    room_no: number
    pg_name: string
    tenant: TenantRecord['profile'] | null
    financials: TenantRecord['financials'] | null
  } | null
  onRecordPayment: (tenantId: number) => void
  onVacateTenant: (tenantId: number, tenantName: string) => void
  onAddTenant: (bedId: number) => void
}

export const BedDetailsModal: React.FC<BedDetailsModalProps> = ({
  isOpen,
  onClose,
  details,
  onRecordPayment,
  onVacateTenant,
  onAddTenant,
}) => {
  if (!details) return null

  const { bed, room_no, pg_name, tenant, financials } = details
  const isOccupied = !!tenant

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      subtitle={`ROOM ${String(room_no).padStart(2, '0')} · ${pg_name.toUpperCase()}`}
      title={`Bed ${bed.label} Overview`}
      maxWidth="620px"
    >
      <div className="bed-modal-content">
        {/* Price & status hero row */}
        <div className="bed-modal-hero">
          <div>
            <span className="info-micro-label">BASE YEARLY RATE</span>
            <div className="hero-amount">{formatRupees(bed.base_yearly_price)}</div>
            <span className="info-caption">Standard yearly occupancy price</span>
          </div>
          <div>
            <Badge
              variant={
                bed.status === 'empty'
                  ? 'vacant'
                  : bed.status === 'overdue'
                  ? 'overdue'
                  : 'occupied'
              }
              size="md"
            >
              {bed.status === 'empty'
                ? 'Vacant'
                : bed.status === 'overdue'
                ? 'Payment Overdue'
                : 'Occupied · Up to date'}
            </Badge>
          </div>
        </div>

        {isOccupied && financials ? (
          <>
            {/* Tenant profile block */}
            <div className="tenant-info-card">
              <div className="tenant-avatar-circle">
                {tenant.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="tenant-card-details">
                <div className="tenant-name-row">
                  <h3 className="tenant-full-name">{tenant.name}</h3>
                  <Badge variant="active">Active Resident</Badge>
                </div>
                <div className="tenant-meta-row">
                  <span>
                    <Phone size={13} /> {tenant.phone}
                  </span>
                  <span>
                    <Calendar size={13} /> Joined {tenant.join_date}
                  </span>
                  <span>
                    <Shield size={13} /> Deposit {formatRupees(tenant.deposit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial ledger metrics */}
            <div className="financial-metrics-grid">
              <div className="fin-metric-tile">
                <span className="fin-label">Agreed Yearly Rent</span>
                <strong className="fin-value">{formatRupees(tenant.agreed_yearly_price)}</strong>
              </div>
              <div className="fin-metric-tile">
                <span className="fin-label">Total Paid So Far</span>
                <strong className="fin-value text-green">{formatRupees(financials.total_paid)}</strong>
              </div>
              <div className="fin-metric-tile">
                <span className="fin-label">Remaining Balance</span>
                <strong className="fin-value">{formatRupees(financials.due_left)}</strong>
              </div>
              <div className="fin-metric-tile">
                <span className="fin-label">Overdue Amount</span>
                <strong className={`fin-value ${financials.overdue_amount > 0 ? 'text-coral' : 'text-green'}`}>
                  {formatRupees(financials.overdue_amount)}
                </strong>
              </div>
              <div className="fin-metric-tile full-span">
                <span className="fin-label">Next Installment Due Date</span>
                <strong className="fin-value">
                  {financials.next_due_date || 'All installments fully covered'}
                </strong>
              </div>
            </div>

            {/* Overdue alert if applicable */}
            {financials.overdue_amount > 0 && (
              <div className="inline-alert alert-coral">
                <AlertTriangle size={16} />
                <span>
                  Tenant is overdue by <strong>{formatRupees(financials.overdue_amount)}</strong>. Next installment was due on {financials.next_due_date}.
                </span>
              </div>
            )}

            {/* Payment history list */}
            <div className="modal-section">
              <div className="modal-section-head">
                <h4 className="section-subtitle">Payment Records</h4>
                <span className="micro-badge">{financials.payments.length} Payments</span>
              </div>
              {financials.payments.length > 0 ? (
                <div className="history-ledger-table">
                  <div className="ledger-header">
                    <span>Date</span>
                    <span>Mode</span>
                    <span className="text-right">Amount</span>
                  </div>
                  {financials.payments.map((p, idx) => (
                    <div key={`${p.paid_on}-${idx}`} className="ledger-row">
                      <span className="ledger-date">{p.paid_on}</span>
                      <span className="ledger-mode">
                        <span className="mode-pill">{p.mode.toUpperCase()}</span>
                      </span>
                      <strong className="ledger-amount text-right">{formatRupees(p.amount)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-box-subtle">
                  <span>No payments recorded yet for this resident.</span>
                </div>
              )}
            </div>

            {/* Actions for occupied bed */}
            <div className="modal-actions-bar">
              <button
                className="button-pill-outline button-danger"
                onClick={() => onVacateTenant(tenant.tenant_id, tenant.name)}
              >
                <UserX size={15} /> Vacate Resident
              </button>
              <button
                className="button-primary"
                onClick={() => onRecordPayment(tenant.tenant_id)}
              >
                <CreditCard size={15} /> Record Payment
              </button>
            </div>
          </>
        ) : (
          /* Vacant bed view */
          <div className="vacant-bed-state">
            <div className="vacant-card">
              <div className="vacant-icon-wrap">
                <CheckCircle2 size={32} />
              </div>
              <h3>This Bed is Available for Booking</h3>
              <p>
                Add a new resident to assign bed <strong>{bed.label}</strong> in <strong>Room {room_no}</strong>. The system will automatically compute their late-joining discount and generate their resident login.
              </p>
              <button
                className="button-primary"
                onClick={() => onAddTenant(bed.bed_id)}
              >
                <UserPlus size={16} /> Add Resident to Bed
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
