import React from 'react'
import { MetricCard } from '../common/MetricCard'
import { Badge } from '../common/Badge'
import { formatRupees } from '../../api'
import type { TenantFinancials } from '../../types'
import {
  Wallet,
  Clock,
  AlertTriangle,
  CreditCard,
  Calendar,
  CheckCircle2,
  FileText,
} from 'lucide-react'

interface TenantPaymentsProps {
  financials: TenantFinancials | null
  loading: boolean
}

export const TenantPayments: React.FC<TenantPaymentsProps> = ({
  financials,
  loading,
}) => {
  if (loading && !financials) {
    return (
      <div className="view-loading-panel">
        <div className="loading-spinner" />
        <span>Loading your payment schedule and ledger…</span>
      </div>
    )
  }

  if (!financials) {
    return (
      <div className="empty-box">
        <span>No financial records available.</span>
      </div>
    )
  }

  const isOverdue = financials.overdue_amount > 0

  return (
    <div className="tenant-payments-content">
      {/* Editorial Masthead */}
      <div className="view-masthead">
        <div>
          <span className="mono-sub-label">ACCOUNT LEDGER & SCHEDULE</span>
          <h1 className="view-title">My Payments</h1>
          <p className="view-desc">
            Complete reconciliation of your 12-month installment schedule, verified receipts and outstanding balances.
          </p>
        </div>
        <div className="masthead-badge-area">
          <Badge variant={isOverdue ? 'overdue' : 'active'} size="md">
            {isOverdue ? `Overdue: ${formatRupees(financials.overdue_amount)}` : 'Installments Up to Date'}
          </Badge>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="metrics-strip-grid">
        <MetricCard
          label="AGREED YEARLY RENT"
          value={formatRupees(financials.agreed_yearly_price)}
          hint="Total contract value"
          icon={<Wallet size={18} />}
          variant="stone"
        />
        <MetricCard
          label="TOTAL PAID TO DATE"
          value={formatRupees(financials.total_paid)}
          hint="Recorded and verified"
          icon={<CheckCircle2 size={18} />}
          variant="green"
        />
        <MetricCard
          label="EXPECTED TILL TODAY"
          value={formatRupees(financials.expected_till_today)}
          hint="Cumulative installments due"
          icon={<Clock size={18} />}
        />
        <MetricCard
          label="REMAINING BALANCE"
          value={formatRupees(financials.due_left)}
          hint="Due across remaining months"
          icon={<CreditCard size={18} />}
        />
        <MetricCard
          label="NEXT INSTALLMENT DUE"
          value={financials.next_due_date || 'Fully Covered'}
          hint={financials.next_due_date ? 'Pay on or before this date' : 'All 12 installments paid'}
          icon={<Calendar size={18} />}
          variant={isOverdue ? 'coral' : 'default'}
        />
      </div>

      {/* Overdue Warning Callout */}
      {isOverdue && (
        <div className="inline-alert alert-coral banner-large">
          <AlertTriangle size={20} />
          <div>
            <strong>Payment Overdue Warning</strong>
            <p>
              Your account has an overdue balance of <strong>{formatRupees(financials.overdue_amount)}</strong>. Please settle your installment with the property owner.
            </p>
          </div>
        </div>
      )}

      {/* 12-Month Installment Schedule Table */}
      <div className="table-container-card">
        <div className="card-top-header">
          <span className="icon-wrap-dark"><Calendar size={18} /></span>
          <div>
            <h2 className="table-section-title">12-Month Installment Schedule</h2>
            <span className="table-section-caption">
              Yearly rent broken down into 12 monthly installments with reminder due dates.
            </span>
          </div>
        </div>

        {financials.installments && financials.installments.length > 0 ? (
          <div className="editorial-table-wrap">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th>Installment #</th>
                  <th>Due Date</th>
                  <th>Installment Amount</th>
                  <th>Cumulative Target</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {financials.installments.map(inst => (
                  <tr key={inst.installment_no} className={`inst-row ${inst.status}`}>
                    <td>
                      <span className="mono-num">Month {String(inst.installment_no).padStart(2, '0')}</span>
                    </td>
                    <td>
                      <span className="date-cell">{inst.due_date}</span>
                    </td>
                    <td>
                      <strong className="mono-num">{formatRupees(inst.amount)}</strong>
                    </td>
                    <td>
                      <span className="mono-num">{formatRupees(inst.cumulative)}</span>
                    </td>
                    <td className="text-right">
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
                          ? 'Paid · Verified'
                          : inst.status === 'overdue'
                          ? 'Overdue'
                          : 'Upcoming Due'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-box-subtle">
            <span>Installment schedule information is being prepared.</span>
          </div>
        )}
      </div>

      {/* Payment History Ledger */}
      <div className="table-container-card">
        <div className="card-top-header">
          <span className="icon-wrap-green"><CreditCard size={18} /></span>
          <div>
            <h2 className="table-section-title">Verified Payment History</h2>
            <span className="table-section-caption">
              Official transaction receipts recorded by property management.
            </span>
          </div>
        </div>

        {financials.payments.length > 0 ? (
          <div className="editorial-table-wrap">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th>Payment Date</th>
                  <th>Payment Mode</th>
                  <th className="text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody>
                {financials.payments.map((p, idx) => (
                  <tr key={`${p.paid_on}-${idx}`}>
                    <td>
                      <span className="date-cell">{p.paid_on}</span>
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
        ) : (
          <div className="empty-box">
            <CreditCard size={28} />
            <h3>No payment transactions recorded yet</h3>
            <p>Once you make a payment to the owner via Cash or UPI, your verified receipt will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
