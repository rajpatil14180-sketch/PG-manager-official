import React from 'react'
import { Badge } from '../common/Badge'
import { formatRupees } from '../../api'
import type { TenantProfile } from '../../types'
import {
  Home,
  Building2,
  Calendar,
  Shield,
  Wallet,
  Bath,
  DoorOpen,
  BedDouble,
  MapPin,
  CheckCircle2,
} from 'lucide-react'

interface TenantAccommodationProps {
  profile: TenantProfile | null
  loading: boolean
}

export const TenantAccommodation: React.FC<TenantAccommodationProps> = ({
  profile,
  loading,
}) => {
  if (loading && !profile) {
    return (
      <div className="view-loading-panel">
        <div className="loading-spinner" />
        <span>Loading your accommodation details…</span>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="empty-box">
        <span>No accommodation profile found.</span>
      </div>
    )
  }

  const hasAttachedBath = profile.has_attached_bath === 1 || (profile.room_no && [1, 2].includes(profile.room_no))

  return (
    <div className="accommodation-view-content">
      {/* Editorial Masthead */}
      <div className="view-masthead">
        <div>
          <span className="mono-sub-label">ROOM & BED ALLOCATION</span>
          <h1 className="view-title">My Accommodation</h1>
          <p className="view-desc">
            Complete details of your assigned room, bed number, sanitary specifications and property amenities.
          </p>
        </div>
      </div>

      {/* Main Accommodation Layout Grid */}
      <div className="accommodation-split-grid">
        {/* Left Card: Room & Bed Specifications */}
        <div className="accommodation-card main-spec-card">
          <div className="spec-card-head">
            <span className="icon-wrap-dark"><Home size={20} /></span>
            <div>
              <h2 className="spec-title">Room {String(profile.room_no || '01').padStart(2, '0')} · Bed {profile.bed_label || 'A'}</h2>
              <span className="spec-sub">Dedicated Bed Space in a 4 BHK Residence</span>
            </div>
            <Badge variant="active">Active Occupancy</Badge>
          </div>

          <div className="spec-tiles-grid">
            <div className="spec-tile">
              <span className="spec-tile-icon"><DoorOpen size={16} /></span>
              <div>
                <span className="spec-label">Room Number</span>
                <strong className="spec-val">Room {profile.room_no}</strong>
              </div>
            </div>

            <div className="spec-tile">
              <span className="spec-tile-icon"><BedDouble size={16} /></span>
              <div>
                <span className="spec-label">Bed Assignment</span>
                <strong className="spec-val">Bed {profile.bed_label}</strong>
              </div>
            </div>

            <div className="spec-tile">
              <span className="spec-tile-icon"><Bath size={16} /></span>
              <div>
                <span className="spec-label">Bathroom Configuration</span>
                <strong className="spec-val">
                  {hasAttachedBath ? 'Private Attached Bathroom' : 'Shared Central Washroom'}
                </strong>
              </div>
            </div>

            <div className="spec-tile">
              <span className="spec-tile-icon"><Calendar size={16} /></span>
              <div>
                <span className="spec-label">Tenancy Start Date</span>
                <strong className="spec-val">{profile.join_date}</strong>
              </div>
            </div>
          </div>

          {/* Sanitary Specs Callout */}
          <div className="sanitary-details-callout">
            <div className="callout-icon">
              <Bath size={20} />
            </div>
            <div>
              <strong>Sanitary Arrangement Specification</strong>
              <p>
                {hasAttachedBath
                  ? 'Your room features a private attached bathroom with hot/cold shower fitting, washbasin, and dedicated WC for you and your room partner.'
                  : 'Your room accesses the shared central corridor common washroom equipped with twin water closets, dual basins, and shower facilities.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Card: Property & Financial Terms */}
        <div className="accommodation-card terms-card">
          <div className="spec-card-head">
            <span className="icon-wrap-green"><Building2 size={20} /></span>
            <div>
              <h2 className="spec-title">{profile.pg_name}</h2>
              <span className="spec-sub">Property & Tenancy Contract Terms</span>
            </div>
          </div>

          <div className="property-address-box">
            <MapPin size={16} className="text-coral" />
            <div>
              <strong>Address</strong>
              <p>{profile.pg_address || 'Nashik, Maharashtra'}</p>
            </div>
          </div>

          <div className="terms-fin-list">
            <div className="terms-row">
              <span>Security Deposit (Refundable)</span>
              <strong>{formatRupees(profile.deposit)}</strong>
            </div>
            <div className="terms-row">
              <span>Agreed Yearly Rent</span>
              <strong className="text-blue">{formatRupees(profile.agreed_yearly_price)}</strong>
            </div>
            <div className="terms-row">
              <span>Payment Structure</span>
              <strong>12 Monthly Installments</strong>
            </div>
            <div className="terms-row">
              <span>Resident Status</span>
              <strong className="text-green">Verified Occupant</strong>
            </div>
          </div>

          <div className="house-rules-note">
            <CheckCircle2 size={16} className="text-green" />
            <span>
              All utility inquiries and maintenance issues should be submitted directly via the <strong>Maintenance</strong> section of this portal.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
