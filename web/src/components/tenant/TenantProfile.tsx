import React from 'react'
import { Badge } from '../common/Badge'
import { formatRupees } from '../../api'
import type { TenantProfile } from '../../types'
import {
  User,
  Phone,
  Calendar,
  Building2,
  Home,
  Shield,
  CreditCard,
  LogOut,
  CheckCircle2,
} from 'lucide-react'

interface TenantProfileProps {
  profile: TenantProfile | null
  username: string
  loading: boolean
  onLogout: () => void
}

export const TenantProfileView: React.FC<TenantProfileProps> = ({
  profile,
  username,
  loading,
  onLogout,
}) => {
  if (loading && !profile) {
    return (
      <div className="view-loading-panel">
        <div className="loading-spinner" />
        <span>Loading account profile…</span>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="empty-box">
        <span>No profile information available.</span>
      </div>
    )
  }

  return (
    <div className="tenant-profile-content">
      {/* Editorial Masthead */}
      <div className="view-masthead">
        <div>
          <span className="mono-sub-label">AUTHENTICATED ACCOUNT</span>
          <h1 className="view-title">Resident Profile</h1>
          <p className="view-desc">
            Your verified resident identity, active tenancy contract details, and account credentials.
          </p>
        </div>
      </div>

      <div className="profile-layout-grid">
        {/* Profile Card */}
        <div className="account-summary-card">
          <div className="account-hero">
            <div className="account-avatar-large">
              {profile.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="account-names">
              <div className="name-badge-line">
                <h2 className="account-full-name">{profile.name}</h2>
                <Badge variant="active">Verified Resident</Badge>
              </div>
              <span className="account-username">@{username}</span>
            </div>
          </div>

          <div className="account-details-grid">
            <div className="acc-detail-tile">
              <span className="acc-detail-label">
                <Phone size={14} /> Phone Number
              </span>
              <strong className="acc-detail-val">{profile.phone}</strong>
            </div>

            <div className="acc-detail-tile">
              <span className="acc-detail-label">
                <Building2 size={14} /> Assigned Property
              </span>
              <strong className="acc-detail-val">{profile.pg_name}</strong>
            </div>

            <div className="acc-detail-tile">
              <span className="acc-detail-label">
                <Home size={14} /> Room & Bed
              </span>
              <strong className="acc-detail-val">
                Room {profile.room_no}, Bed {profile.bed_label}
              </strong>
            </div>

            <div className="acc-detail-tile">
              <span className="acc-detail-label">
                <Calendar size={14} /> Tenancy Start
              </span>
              <strong className="acc-detail-val">{profile.join_date}</strong>
            </div>

            <div className="acc-detail-tile">
              <span className="acc-detail-label">
                <Shield size={14} /> Security Deposit
              </span>
              <strong className="acc-detail-val">{formatRupees(profile.deposit)}</strong>
            </div>

            <div className="acc-detail-tile">
              <span className="acc-detail-label">
                <CreditCard size={14} /> Agreed Yearly Rent
              </span>
              <strong className="acc-detail-val text-blue">
                {formatRupees(profile.agreed_yearly_price)}
              </strong>
            </div>
          </div>

          <div className="security-notice-callout">
            <CheckCircle2 size={16} className="text-green" />
            <span>
              Your account is secured via salted PBKDF2 hashing. In order to update personal details or room allocations, contact your property manager.
            </span>
          </div>

          <div className="account-actions-row">
            <button
              className="button-pill-outline button-danger"
              onClick={onLogout}
            >
              <LogOut size={16} /> Sign out of Resident Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
