import React, { useState } from 'react'
import { Badge } from '../common/Badge'
import type { Ticket } from '../../types'
import {
  Settings,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  Wrench,
  Wifi,
  Zap,
  Sparkles,
} from 'lucide-react'

interface TenantMaintenanceProps {
  tickets: Ticket[]
  loading: boolean
  onSubmitTicket: (category: string, urgency: string, description: string) => Promise<void>
}

const CATEGORIES = ['Plumbing', 'Electrical', 'Wi-Fi', 'Cleaning', 'Furniture', 'Other']
const URGENCIES = ['Low', 'Medium', 'High']

export const TenantMaintenance: React.FC<TenantMaintenanceProps> = ({
  tickets,
  loading,
  onSubmitTicket,
}) => {
  const [category, setCategory] = useState('Plumbing')
  const [urgency, setUrgency] = useState('Medium')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) {
      setError('Please provide a clear description of the maintenance issue.')
      return
    }

    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      await onSubmitTicket(category, urgency, description.trim())
      setDescription('')
      setCategory('Plumbing')
      setUrgency('Medium')
      setSuccess('Maintenance request submitted successfully! The property manager has been notified.')
      setTimeout(() => setSuccess(''), 5000)
    } catch (err: any) {
      setError(err.message || 'Could not submit maintenance request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="tenant-maintenance-content">
      {/* Editorial Masthead */}
      <div className="view-masthead">
        <div>
          <span className="mono-sub-label">ROOM & FACILITY CARE</span>
          <h1 className="view-title">Maintenance Requests</h1>
          <p className="view-desc">
            Report any plumbing, electrical, connectivity or furniture issues directly to property management.
          </p>
        </div>
      </div>

      {success && (
        <div className="inline-alert alert-green">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Two Column Layout: Form & My Requests List */}
      <div className="maintenance-split-grid">
        {/* Left Column: Report Form Card */}
        <div className="composer-card-panel">
          <div className="panel-inner-head">
            <span className="icon-wrap-blue"><Wrench size={18} /></span>
            <div>
              <h2 className="card-section-title">Report an Issue</h2>
              <span className="card-section-caption">Submit a work order ticket</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="standard-form">
            {error && (
              <div className="inline-alert alert-coral">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-grid-two">
              <div className="form-field">
                <label>Issue Category *</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Urgency Level *</label>
                <select
                  value={urgency}
                  onChange={e => setUrgency(e.target.value)}
                >
                  {URGENCIES.map(u => (
                    <option key={u} value={u}>{u} Priority</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-field">
              <label>Detailed Description of the Issue *</label>
              <textarea
                rows={4}
                required
                maxLength={1000}
                placeholder="Describe what happened, where in the room or bathroom it is located, and how long it has been an issue…"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
              <span className="field-caption">
                Be specific to help maintenance staff resolve the issue on the first visit.
              </span>
            </div>

            <button
              type="submit"
              className="button-primary full-width-btn"
              disabled={submitting}
            >
              <Plus size={16} />
              {submitting ? 'Submitting Request…' : 'Submit Maintenance Ticket'}
            </button>
          </form>
        </div>

        {/* Right Column: Submitted Tickets History */}
        <div className="history-card-panel">
          <div className="panel-inner-head">
            <div>
              <h2 className="card-section-title">My Maintenance Requests</h2>
              <span className="card-section-caption">Track resolution status of your tickets</span>
            </div>
            <span className="micro-badge">{tickets.length} Tickets</span>
          </div>

          {loading ? (
            <div className="view-loading-panel">
              <div className="loading-spinner" />
              <span>Loading your maintenance requests…</span>
            </div>
          ) : tickets.length > 0 ? (
            <div className="ticket-items-feed">
              {tickets.map(t => (
                <div key={t.id} className="ticket-item-card">
                  <div className="ticket-item-top">
                    <div className="ticket-tag-cluster">
                      <span className="category-pill">{t.category}</span>
                      <Badge variant={t.urgency.toLowerCase() as any}>
                        {t.urgency}
                      </Badge>
                      <span className="ticket-date-tag">
                        {new Date(t.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    {/* Read-only status badge for tenant */}
                    <Badge variant={t.status.toLowerCase().replace(' ', '-') as any}>
                      {t.status}
                    </Badge>
                  </div>
                  <p className="ticket-body-desc">{t.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-box">
              <CheckCircle2 size={32} className="text-green" />
              <h3>No tickets submitted yet</h3>
              <p>Whenever you notice an issue with plumbing, Wi-Fi or electricity, use the form on the left to report it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
