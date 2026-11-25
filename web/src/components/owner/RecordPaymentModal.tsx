import React, { useState } from 'react'
import { Modal } from '../common/Modal'
import { api, formatRupees } from '../../api'
import { CreditCard, AlertCircle } from 'lucide-react'

interface RecordPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  tenantId: number
  tenantName?: string
  remainingDue?: number
  onSuccess: (message: string) => void
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  tenantName,
  remainingDue,
  onSuccess,
}) => {
  const today = new Date().toISOString().slice(0, 10)
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(today)
  const [mode, setMode] = useState<'upi' | 'cash'>('upi')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const numAmount = parseInt(amount, 10)
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Payment amount must be a positive whole number.')
      return
    }

    if (remainingDue !== undefined && numAmount > remainingDue) {
      setError(`Payment cannot exceed the remaining balance of ${formatRupees(remainingDue)}.`)
      return
    }

    setSubmitting(true)
    try {
      await api.recordPayment(tenantId, {
        amount: numAmount,
        paid_on: paidOn,
        mode,
      })
      onSuccess(`Payment of ${formatRupees(numAmount)} recorded successfully.`)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Could not record payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      subtitle="FINANCIAL TRANSACTION"
      title={`Record Payment${tenantName ? ` for ${tenantName}` : ''}`}
      maxWidth="480px"
    >
      <form onSubmit={handleSubmit} className="standard-form">
        {error && (
          <div className="inline-alert alert-coral">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {remainingDue !== undefined && (
          <div className="remaining-due-pill">
            <span>Outstanding Balance:</span>
            <strong>{formatRupees(remainingDue)}</strong>
          </div>
        )}

        <div className="form-field">
          <label>Payment Amount (₹) *</label>
          <input
            type="number"
            min="1"
            step="1"
            required
            autoFocus
            placeholder="e.g. 15000"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <span className="field-caption">Enter positive whole rupees only. Floats not allowed.</span>
        </div>

        <div className="form-grid-two">
          <div className="form-field">
            <label>Payment Date *</label>
            <input
              type="date"
              required
              value={paidOn}
              onChange={e => setPaidOn(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Payment Mode *</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value as 'upi' | 'cash')}
            >
              <option value="upi">UPI / Online Transfer</option>
              <option value="cash">Cash in Hand</option>
            </select>
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
            <CreditCard size={16} />
            {submitting ? 'Recording…' : 'Save Payment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
