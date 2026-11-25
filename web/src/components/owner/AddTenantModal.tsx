import React, { useState, useEffect } from 'react'
import { Modal } from '../common/Modal'
import { api, formatRupees } from '../../api'
import { UserPlus, Sparkles, AlertCircle } from 'lucide-react'

interface AddTenantModalProps {
  isOpen: boolean
  onClose: () => void
  bedId: number
  pgId: number
  basePrice?: number
  onSuccess: (message: string) => void
}

export const AddTenantModal: React.FC<AddTenantModalProps> = ({
  isOpen,
  onClose,
  bedId,
  pgId,
  basePrice = 200000,
  onSuccess,
}) => {
  const today = new Date().toISOString().slice(0, 10)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [joinDate, setJoinDate] = useState(today)
  const [deposit, setDeposit] = useState('10000')
  const [agreedPrice, setAgreedPrice] = useState(String(basePrice))
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Calculate pricing suggestion when bedId or joinDate changes
  useEffect(() => {
    if (!isOpen || !bedId) return
    setError('')
    api
      .getPricingSuggestion(bedId, joinDate)
      .then(res => {
        setSuggestedPrice(res.suggested_price)
        setAgreedPrice(String(res.suggested_price))
      })
      .catch(() => {
        // keep fallback to base price
        setSuggestedPrice(basePrice)
        setAgreedPrice(String(basePrice))
      })
  }, [isOpen, bedId, joinDate, basePrice])

  // Auto-generate suggested username when name changes if empty
  const handleNameChange = (val: string) => {
    setName(val)
    if (!username) {
      const clean = val.trim().toLowerCase().split(' ')[0]
      if (clean) setUsername(clean)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const numDeposit = parseInt(deposit, 10)
    const numPrice = parseInt(agreedPrice, 10)

    if (!name.trim() || !phone.trim() || !username.trim() || !password) {
      setError('Please fill in all required fields.')
      return
    }
    if (isNaN(numDeposit) || numDeposit < 0) {
      setError('Deposit must be a non-negative whole number.')
      return
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Agreed yearly price must be greater than zero.')
      return
    }

    setSubmitting(true)
    try {
      await api.addTenant(pgId, {
        bed_id: bedId,
        name: name.trim(),
        phone: phone.trim(),
        join_date: joinDate,
        deposit: numDeposit,
        agreed_yearly_price: numPrice,
        username: username.trim(),
        password,
      })
      onSuccess(`Resident ${name.trim()} successfully registered and assigned to bed.`)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Could not add resident. Please check the inputs.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      subtitle="RESIDENT ONBOARDING"
      title="Add New Resident"
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit} className="standard-form">
        {error && (
          <div className="inline-alert alert-coral">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="form-grid-two">
          <div className="form-field">
            <label>Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Phone Number *</label>
            <input
              type="tel"
              required
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid-two">
          <div className="form-field">
            <label>Joining Date *</label>
            <input
              type="date"
              required
              value={joinDate}
              onChange={e => setJoinDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Security Deposit (₹) *</label>
            <input
              type="number"
              min="0"
              step="100"
              required
              value={deposit}
              onChange={e => setDeposit(e.target.value)}
            />
          </div>
        </div>

        <div className="form-field">
          <div className="label-with-hint">
            <label>Agreed Yearly Rent (₹) *</label>
            {suggestedPrice !== null && (
              <span className="hint-pill">
                <Sparkles size={12} /> Suggested: {formatRupees(suggestedPrice)}
              </span>
            )}
          </div>
          <input
            type="number"
            min="1000"
            step="100"
            required
            value={agreedPrice}
            onChange={e => setAgreedPrice(e.target.value)}
          />
          <span className="field-caption">
            Calculated using college start date discount tiers. Owner can adjust as agreed with resident.
          </span>
        </div>

        <div className="form-divider" />

        <div className="form-subheading">Resident Portal Credentials</div>

        <div className="form-grid-two">
          <div className="form-field">
            <label>Login Username *</label>
            <input
              type="text"
              required
              autoComplete="off"
              placeholder="e.g. rahul"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Temporary Password *</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Min 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="form-actions-right">
          <button
            type="button"
            className="button-pill-outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button-primary"
            disabled={submitting}
          >
            <UserPlus size={16} />
            {submitting ? 'Registering Resident…' : 'Register & Assign Bed'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
