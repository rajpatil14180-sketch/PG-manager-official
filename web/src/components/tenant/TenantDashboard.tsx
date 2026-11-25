import React from 'react'
import { MetricCard } from '../common/MetricCard'
import { Badge } from '../common/Badge'
import { formatRupees } from '../../api'
import type { TenantHomeData } from '../../types'
import {
  Home,
  Wallet,
  Clock,
  AlertTriangle,
  Building2,
  Calendar,
  Shield,
  CreditCard,
  Settings,
  Bell,
  ArrowUpRight,
  CheckCircle2,
  Plus,
} from 'lucide-react'

interface TenantDashboardProps {
  data: TenantHomeData | null
  loading: boolean
  onNavigateTab: (tab: 'home' | 'accommodation' | 'payments' | 'maintenance' | 'announcements' | 'profile') => void
}

export const TenantDashboard: React.FC<TenantDashboardProps> = ({
  data,
  loading,
  onNavigateTab,
}) => {
  if (loading && !data) {
    return (
      <div className="view-loading-panel">
        <div className="loading-spinner" />
        <span>Loading your resident dashboard…</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="empty-box">
        <AlertTriangle size={24} />
        <span>Unable to load resident data. Please try signing in again.</span>
      </div>
    )
  }

  const { profile, financials, announcements, tickets } = data
  const isOverdue = financials.overdue_amount > 0
  const recentTickets = tickets.slice(0, 3)
  const recentAnnouncements = announcements.slice(0, 3)

  return (
    <div className="tenant-dashboard-content">
      {/* Resident Welcome Masthead */}
      <div className="editorial-hero-band tenant-hero-band">
        <div className="hero-text-area">
          <span className="mono-sub-label">RESIDENT PORTAL · {profile.pg_name?.toUpperCase() || 'HOME'}</span>
          <h1 className="hero-display-title">Welcome back, {profile.name.split(' ')[0]}</h1>
          <p className="hero-lead-text">
            Your accommodation at <strong>{profile.pg_name}</strong> · Room {profile.room_no}, Bed {profile.bed_label}. Joined {profile.join_date}.
          </p>
        </div>
        <div className="hero-action-area">
          <Badge variant={isOverdue ? 'overdue' : 'active'} size="md">
            {isOverdue ? `Overdue: ${formatRupees(financials.overdue_amount)}` : 'Tenancy Active · Rent Up to Date'}
          </Badge>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="metrics-strip-grid">
        <MetricCard
          label="AGREED YEARLY RENT"
          value={formatRupees(financials.agreed_yearly_price)}
          hint="Total annual contract price"
          icon={<Wallet size={18} />}
          variant="stone"
        />
        <MetricCard
          label="PAID TO DATE"
          value={formatRupees(financials.total_paid)}
          hint={`${financials.payments.length} verified payments`}
          icon={<CheckCircle2 size={18} />}
          variant="green"
        />
        <MetricCard
          label="REMAINING BALANCE"
          value={formatRupees(financials.due_left)}
          hint="Balance due for the remaining year"
          icon={<CreditCard size={18} />}
        />
        <MetricCard
          label="AMOUNT OVERDUE"
          value={formatRupees(financials.overdue_amount)}
          hint={isOverdue ? 'Requires payment' : 'No overdue balance'}
          icon={<AlertTriangle size={18} />}
          variant={isOverdue ? 'coral' : 'default'}
        />
        <MetricCard
          label="NEXT DUE DATE"
          value={financials.next_due_date || 'Fully Covered'}
          hint={financials.next_due_date ? 'Next monthly installment' : 'All installments paid'}
          icon={<Clock size={18} />}
        />
      </div>

      {/* Overdue Payment Alert if Applicable */}
      {isOverdue && (
        <div className="inline-alert alert-coral banner-large">
          <AlertTriangle size={20} />
          <div className="alert-content-wrap">
            <strong>Payment Due Notice</strong>
            <span>
              Your account has an overdue amount of <strong>{formatRupees(financials.overdue_amount)}</strong>. Please coordinate with the property owner to record your installment.
            </span>
          </div>
          <button
            className="button-pill-outline button-sm"
            onClick={() => onNavigateTab('payments')}
          >
            View Schedule →
          </button>
        </div>
      )}

      {/* Two Column Grid: Recent Notices & Maintenance Requests */}
      <div className="dashboard-split-grid">
        {/* Notices from Owner */}
        <div className="console-panel">
          <div className="panel-header">
            <div className="header-with-icon">
              <span className="icon-wrap-dark"><Bell size={17} /></span>
              <div>
                <h3 className="panel-title">Property Notices</h3>
                <span className="panel-caption">Updates from your property manager</span>
              </div>
            </div>
            <button
              className="button-secondary"
              onClick={() => onNavigateTab('announcements')}
            >
              All Notices →
            </button>
          </div>

          {recentAnnouncements.length > 0 ? (
            <div className="announcements-compact-feed">
              {recentAnnouncements.map(ann => (
                <div key={ann.id} className="announcement-compact-card">
                  <div className="ann-card-header">
                    <span className="ann-date">
                      {new Date(ann.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="ann-message">{ann.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-box-subtle">
              <span>No property notices at this time.</span>
            </div>
          )}
        </div>

        {/* Maintenance Requests */}
        <div className="console-panel">
          <div className="panel-header">
            <div className="header-with-icon">
              <span className="icon-wrap-blue"><Settings size={17} /></span>
              <div>
                <h3 className="panel-title">Maintenance & Repairs</h3>
                <span className="panel-caption">Your reported maintenance requests</span>
              </div>
            </div>
            <button
              className="button-primary button-sm"
              onClick={() => onNavigateTab('maintenance')}
            >
              <Plus size={14} /> Report Issue
            </button>
          </div>

          {recentTickets.length > 0 ? (
            <div className="tickets-compact-list">
              {recentTickets.map(ticket => (
                <div key={ticket.id} className="ticket-compact-row">
                  <div className="ticket-compact-left">
                    <div className="ticket-compact-meta">
                      <span className="category-pill">{ticket.category}</span>
                      <span className="ticket-age-tag">
                        {new Date(ticket.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                    <p className="ticket-compact-desc">{ticket.description}</p>
                  </div>
                  <Badge variant={ticket.status.toLowerCase().replace(' ', '-') as any}>
                    {ticket.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-box-subtle">
              <CheckCircle2 size={24} className="text-green" />
              <span>You have no active maintenance tickets. Everything is running smoothly!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
