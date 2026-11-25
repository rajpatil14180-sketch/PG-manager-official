import React from 'react'
import type { Announcement } from '../../types'
import { Bell, Calendar, Building2 } from 'lucide-react'

interface TenantAnnouncementsProps {
  announcements: Announcement[]
  propertyName?: string
  loading: boolean
}

export const TenantAnnouncements: React.FC<TenantAnnouncementsProps> = ({
  announcements,
  propertyName,
  loading,
}) => {
  return (
    <div className="tenant-announcements-content">
      {/* Editorial Masthead */}
      <div className="view-masthead">
        <div>
          <span className="mono-sub-label">NOTICE BOARD</span>
          <h1 className="view-title">Property Announcements</h1>
          <p className="view-desc">
            Official announcements, operational updates, and scheduled maintenance notices for {propertyName || 'your property'}.
          </p>
        </div>
      </div>

      <div className="announcements-feed-container">
        {loading ? (
          <div className="view-loading-panel">
            <div className="loading-spinner" />
            <span>Loading property announcements…</span>
          </div>
        ) : announcements.length > 0 ? (
          <div className="announcement-cards-feed">
            {announcements.map(ann => (
              <div key={ann.id} className="editorial-announcement-card">
                <div className="ann-card-top-bar">
                  <div className="ann-icon-title">
                    <span className="icon-wrap-dark"><Bell size={16} /></span>
                    <strong>Notice from Management</strong>
                  </div>
                  <span className="ann-post-date">
                    <Calendar size={13} />
                    {new Date(ann.created_at).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <div className="ann-card-body">
                  <p>{ann.message}</p>
                </div>
                <div className="ann-card-footer">
                  <span>Broadcasted to all residents</span>
                  {propertyName && <span>{propertyName}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-box">
            <Bell size={32} />
            <h3>No Announcements Posted</h3>
            <p>Your property manager has not posted any active announcements. Check back later.</p>
          </div>
        )}
      </div>
    </div>
  )
}
