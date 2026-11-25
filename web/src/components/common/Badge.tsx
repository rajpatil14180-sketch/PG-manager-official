import React from 'react'

export interface BadgeProps {
  variant?: 'vacant' | 'occupied' | 'overdue' | 'open' | 'in-progress' | 'resolved' | 'active' | 'vacated' | 'high' | 'medium' | 'low' | 'neutral' | 'stone'
  children: React.ReactNode
  size?: 'sm' | 'md'
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, size = 'sm' }) => {
  return (
    <span className={`badge-pill badge-${variant} badge-size-${size}`}>
      <span className="badge-dot" />
      {children}
    </span>
  )
}
