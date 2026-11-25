import React from 'react'
import { Modal } from '../common/Modal'
import { Badge } from '../common/Badge'
import { formatRupees } from '../../api'
import type { TenantRecord } from '../../types'
import { CreditCard, UserX, Phone, Calendar, Shield, Home, Building2, CheckCircle2, AlertCircle } from 'lucide-react'

interface TenantRecordModalProps {
  isOpen: boolean
  onClose: () => void
  record: TenantRecord | null
  onRecordPayment: (tenantId: number, name: string, remainingDue: number) => void
  onVacateTenant: (tenantId: number, name: string) => void
}

export const TenantRecordModal: React.FC<TenantRecordModalProps> = ({
  isOpen,
  onClose,
  record,
  onRecordPayment,
  onVacateTenant,
}) => {
  if (!record) return null

  const { profile, financials } = record
  const isActive = Boolean(profile.is_active)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      subtitle={`RESIDENT PROFILE #${profile.tenant_id}`}
      title={profile.name}
      maxWidth="680px"
    >
      <div className="tenant-record-content">
        {/* Profile Card Header */}
        <div className="profile-hero-card">
          <div className="profile-hero-left">
            <div className="large-avatar">{profile.name.slice(0, 1).toUpperCase()}</div>
            <div>
              <div className="name-with-badge">
                <h3 className="profile-hero-name">{profile.name}</h3>
                <Badge variant={isActive ? 'active' : 'vacated'}>
                  {isActive ? 'Active Tenancy' : 'Vacated'}
                </Badge>
              </div>
              <div className="profile-hero-meta">
                <span><Phone size={13} /> {profile.phone}</span>
                {profile.pg_name && (
                  <span><Building2 size={13} /> {profile.pg_name}</span>
                )}
                {profile.room_no && profile.bed_label && (
                  <span><Home size={13} /> Room {profile.room_no} · Bed {profile.bed_label}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Core Tenancy Details */}
        <div className="metrics-tri-grid">
          <div className="tri-tile">
            <span className="tri-label">Joining Date</span>
            <strong className="tri-val">{profile.join_date}</strong>
          </div>
          <div className="tri-tile">
            <span className="tri-label">Security Deposit</span>
            <strong className="tri-val">{formatRupees(profile.deposit)}</strong>
          </div>
          <div className="tri-tile">
            <span className="tri-label">Agreed Yearly Rent</span>
            <strong className="tri-val">{formatRupees(profile.agreed_yearly_price)}</strong>
          </div>
        </div>

        {/* Financial Highlights */}
        <div className="financial-summary-card">
          <div className="fin-stat-box">
            <span>Total Collected</span>
            <strong className="text-green">{formatRupees(financials.total_paid)}</strong>
          </div>
          <div className="fin-stat-box">
            <span>Outstanding Balance</span>
            <strong>{formatRupees(financials.due_left)}</strong>
          </div>
          <div className="fin-stat-box">
            <span>Overdue Amount</span>
            <strong className={financials.overdue_amount > 0 ? 'text-coral' : 'text-green'}>
              {formatRupees(financials.overdue_amount)}
            </strong>
          </div>
          <div className="fin-stat-box">
            <span>Next Due Date</span>
            <strong>{financials.next_due_date || 'Fully Covered'}</strong>
          </div>
        </div>

        {/* Overdue Warning */}
        {financials.overdue_amount > 0 && (
          <div className="inline-alert alert-coral">
            <AlertCircle size={16} />
            <span>
              Payment overdue by <strong>{formatRupees(financials.overdue_amount)}</strong>. Next installment was due on {financials.next_due_date}.
            </span>
          </div>
        )}

        {/* 12-Month Installment Schedule Breakdown */}
        {financials.installments && financials.installments.length > 0 && (
          <div className="modal-section">
            <div className="modal-section-head">
              <h4 className="section-subtitle">12-Month Installment Schedule</h4>
              <span className="micro-badge">12 Installments</span>
            </div>
            <div className="installment-schedule-table">
              <div className="schedule-head">
                <span>#</span>
                <span>Due Date</span>
                <span>Amount</span>
                <span>Cumulative</span>
                <span className="text-right">Status</span>
              </div>
              {financials.installments.map(inst => (
                <div key={inst.installment_no} className={`schedule-row ${inst.status}`}>
                  <span className="inst-num">{String(inst.installment_no).padStart(2, '0')}</span>
                  <span className="inst-date">{inst.due_date}</span>
                  <span className="inst-amount">{formatRupees(inst.amount)}</span>
                  <span className="inst-cumulative">{formatRupees(inst.cumulative)}</span>
                  <span className="inst-status text-right">
                    <Badge
                      variant={
                        inst.status === 'paid'
                          ? 'resolved'
                          : inst.status === 'overdue'
                          ? 'overdue'
                          : 'neutral'
                      }
                    >
                      {inst.status === 'paid'
                        ? 'Paid'
                        : inst.status === 'overdue'
                        ? 'Overdue'
                        : 'Upcoming'}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Complete Payment Records Ledger */}
        <div className="modal-section">
          <div className="modal-section-head">
            <h4 className="section-subtitle">Payment History</h4>
            <span className="micro-badge">{financials.payments.length} Payments</span>
          </div>
          {financials.payments.length > 0 ? (
            <div className="history-ledger-table">
              <div className="ledger-header">
                <span>Payment Date</span>
                <span>Payment Mode</span>
                <span className="text-right">Amount Paid</span>
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
              <span>No payment records found for this resident.</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        {isActive && (
          <div className="modal-actions-bar">
            <button
              className="button-pill-outline button-danger"
              onClick={() => onVacateTenant(profile.tenant_id, profile.name)}
            >
              <UserX size={15} /> Vacate Resident
            </button>
            <button
              className="button-primary"
              onClick={() => onRecordPayment(profile.tenant_id, profile.name, financials.due_left)}
            >
              <CreditCard size={15} /> Record Payment
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
