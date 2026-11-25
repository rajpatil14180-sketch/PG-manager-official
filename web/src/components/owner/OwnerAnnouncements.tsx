import React, { useState } from 'react'
import type { PG, Announcement } from '../../types'
import {
  Bell,
  Plus,
  Trash2,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

interface OwnerAnnouncementsProps {
  announcements: Announcement[]
  properties: PG[]
  activePropertyId: number | null
  loading: boolean
  onAddAnnouncement: (pgId: number, message: string) => Promise<void>
  onDeleteAnnouncement: (id: number) => Promise<void>
}

export const OwnerAnnouncements: React.FC<OwnerAnnouncementsProps> = ({
  announcements,
  properties,
  activePropertyId,
  loading,
  onAddAnnouncement,
  onDeleteAnnouncement,
}) => {
  const [selectedPgId, setSelectedPgId] = useState<number>(
    activePropertyId || (properties[0]?.id ?? 1)
  )
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) {
      setError('Announcement message cannot be empty.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      await onAddAnnouncement(selectedPgId, message.trim())
      setMessage('')
    } catch (err: any) {
      setError(err.message || 'Could not publish announcement.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this announcement? It will be removed from all resident portals.')) {
      return
    }
    try {
      await onDeleteAnnouncement(id)
    } catch (err: any) {
      alert(err.message || 'Could not delete announcement.')
    }
  }

  return (
    <div className="announcements-view-content">
      {/* Editorial Header */}
      <div className="view-masthead">
        <div>
          <span className="mono-sub-label">RESIDENT COMMUNICATIONS</span>
          <h1 className="view-title">Property Announcements</h1>
          <p className="view-desc">
            Broadcast essential notices, maintenance schedules, rent reminders and hostel updates to resident dashboards.
          </p>
        </div>
      </div>

      {/* Two-Column Composer & Feed */}
      <div className="announcement-two-col-grid">
        {/* Left Column: Composer Card */}
        <div className="compose-announcement-card">
          <div className="card-top-header">
            <span className="icon-wrap-dark"><Bell size={18} /></span>
            <div>
              <h2 className="compose-title">Publish Notice</h2>
              <span className="compose-sub">Broadcast to all residents of the selected property</span>
            </div>
          </div>

          <form onSubmit={handlePublish} className="compose-form">
            {error && (
              <div className="inline-alert alert-coral">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-field">
              <label>Target Accommodation Property *</label>
              <select
                value={selectedPgId}
                onChange={e => setSelectedPgId(Number(e.target.value))}
              >
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.address})</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Announcement Message *</label>
              <textarea
                rows={5}
                required
                maxLength={1000}
                placeholder="e.g. Overhead water tank sanitization is scheduled for Saturday between 9:00 AM and 1:00 PM. Water supply will be temporarily paused."
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
              <div className="character-count-row">
                <span>Markdown formatting supported</span>
                <span className={message.length > 900 ? 'text-coral' : ''}>
                  {message.length} / 1000 characters
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="button-primary full-width-btn"
              disabled={submitting}
            >
              <Plus size={16} />
              {submitting ? 'Publishing Notice…' : 'Publish to Resident Dashboards'}
            </button>
          </form>
        </div>

        {/* Right Column: History Feed */}
        <div className="announcements-feed-card">
          <div className="feed-header-row">
            <div>
              <h3 className="feed-title">Broadcast History</h3>
              <span className="feed-count">{announcements.length} Published Notices</span>
            </div>
          </div>

          {loading ? (
            <div className="view-loading-panel">
              <div className="loading-spinner" />
              <span>Loading broadcasted announcements…</span>
            </div>
          ) : announcements.length > 0 ? (
            <div className="announcement-cards-stream">
              {announcements.map(ann => (
                <div key={ann.id} className="announcement-feed-item">
                  <div className="ann-feed-top">
                    <div className="ann-tag-group">
                      <span className="ann-prop-badge">
                        <Building2 size={12} /> {ann.pg_name || 'Property'}
                      </span>
                      <span className="ann-time-badge">
                        <Calendar size={12} />
                        {new Date(ann.created_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <button
                      className="icon-btn-danger"
                      title="Delete announcement"
                      onClick={() => handleDelete(ann.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <p className="ann-feed-body">{ann.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-box">
              <Bell size={28} />
              <h3>No announcements posted yet</h3>
              <p>Notices published using the composer on the left will appear in resident portals.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
