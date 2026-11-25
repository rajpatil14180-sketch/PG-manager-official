import React, { useState } from 'react'
import {
  Building2,
  ShieldCheck,
  ArrowUpRight,
  AlertCircle,
  KeyRound,
  User,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>
  busy: boolean
  error: string
  onClearError: () => void
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  busy,
  error,
  onClearError,
}) => {
  const [username, setUsername] = useState('owner')
  const [password, setPassword] = useState('owner123')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    onClearError()
    await onLogin(username.trim(), password)
  }

  const fillDemo = (u: string, p: string) => {
    setUsername(u)
    setPassword(p)
    onClearError()
  }

  return (
    <div className="cohere-login-wrapper">
      {/* Top Announcement Bar - Cohere style */}
      <div className="cohere-announcement-bar">
        <span>PG MANAGER · ENTERPRISE PROPERTY MANAGEMENT PLATFORM</span>
      </div>

      <div className="login-container-grid">
        {/* Left Side: Editorial & Product Mockup Console Band */}
        <div className="login-editorial-column">
          <div className="login-brand-strip">
            <div className="brand-logo-mark">
              <Building2 size={20} />
            </div>
            <span className="brand-title-text">PG Manager</span>
          </div>

          <div className="login-editorial-copy">
            <span className="mono-sub-label">ACCOMMODATION INFRASTRUCTURE</span>
            <h1 className="login-hero-heading">
              Softer operations.<br />Hardened clarity.
            </h1>
            <p className="login-hero-paragraph">
              A unified command system for property managers and residents. Architectural floor plans, automated late-joining pricing, 12-month installment schedules, and maintenance dispatching.
            </p>
          </div>

          {/* Agent Console Mockup Card - Cohere dark panel */}
          <div className="agent-console-card">
            <div className="console-top-row">
              <span className="console-status-dot" />
              <span className="console-system-status">SYSTEM ONLINE · 100% DISK PERSISTED</span>
              <span className="console-version-tag">v2.4 LTS</span>
            </div>
            <div className="console-metric-preview">
              <div className="preview-tile">
                <span>PORTFOLIO OCCUPANCY</span>
                <strong>100% Operational</strong>
              </div>
              <div className="preview-tile">
                <span>FINANCIAL ENGINE</span>
                <strong>Integer Rupees (₹)</strong>
              </div>
              <div className="preview-tile">
                <span>ROLE ROUTER</span>
                <strong>Owner + Resident Portal</strong>
              </div>
            </div>
            <div className="console-code-snippet">
              <code>$ pgmanager --engine=sqlite --security=pbkdf2_sha256</code>
            </div>
          </div>

          <div className="login-footer-trust">
            <span>© 2026 PG Manager. Built with architectural precision and editorial restraint.</span>
          </div>
        </div>

        {/* Right Side: Form & Quick Sign In Card */}
        <div className="login-form-column">
          <div className="login-form-box">
            <div className="form-header">
              <span className="mono-sub-label">SECURE AUTHENTICATION</span>
              <h2 className="form-main-title">Access your workspace</h2>
              <p className="form-caption">
                Sign in using your authorized property owner or resident account credentials.
              </p>
            </div>

            {error && (
              <div className="inline-alert alert-coral">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-field">
                <label>Account Username</label>
                <div className="input-with-icon">
                  <User size={16} className="input-icon" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={e => {
                      setUsername(e.target.value)
                      if (error) onClearError()
                    }}
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Password</label>
                <div className="input-with-icon">
                  <KeyRound size={16} className="input-icon" />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value)
                      if (error) onClearError()
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="button-primary full-width-btn"
                disabled={busy}
              >
                {busy ? 'Authenticating…' : 'Sign In to PG Manager'}
                {!busy && <ArrowUpRight size={16} />}
              </button>
            </form>

            {/* Quick Demo Accounts Pill Strip */}
            <div className="demo-accounts-pill-box">
              <span className="demo-strip-label">SAMPLE TEST ACCOUNTS:</span>
              <div className="demo-buttons-row">
                <button
                  type="button"
                  className="demo-account-pill"
                  onClick={() => fillDemo('owner', 'owner123')}
                >
                  <span className="pill-role">OWNER</span>
                  <span>owner / owner123</span>
                </button>
                <button
                  type="button"
                  className="demo-account-pill"
                  onClick={() => fillDemo('amit', 'tenant123')}
                >
                  <span className="pill-role">RESIDENT</span>
                  <span>amit / tenant123</span>
                </button>
              </div>
            </div>

            <div className="login-security-badge">
              <ShieldCheck size={15} />
              <span>Connected to SQLite database with PBKDF2 salted hash authentication.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
