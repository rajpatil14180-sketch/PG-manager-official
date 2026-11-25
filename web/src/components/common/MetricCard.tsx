import React from 'react'

interface MetricCardProps {
  label: string
  value: string | number
  hint?: string
  trend?: string
  icon?: React.ReactNode
  variant?: 'default' | 'stone' | 'green' | 'blue' | 'coral'
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  hint,
  trend,
  icon,
  variant = 'default',
}) => {
  return (
    <div className={`metric-card metric-variant-${variant}`}>
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        {icon && <span className="metric-icon">{icon}</span>}
      </div>
      <div className="metric-value-row">
        <span className="metric-value">{value}</span>
        {trend && <span className="metric-trend">{trend}</span>}
      </div>
      {hint && <span className="metric-hint">{hint}</span>}
    </div>
  )
}
