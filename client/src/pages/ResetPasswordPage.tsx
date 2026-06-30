import { useState } from 'react'

interface ResetPasswordPageProps {
  email: string
  resetToken: string
  onReset: () => void
  onCancel: () => void
}

export default function ResetPasswordPage({ email, resetToken, onReset, onCancel }: ResetPasswordPageProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          token: resetToken,
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to reset password')
        return
      }

      setSuccess('Password reset successfully! Redirecting to login...')
      setTimeout(onReset, 1500)
    } catch (err) {
      setError('Failed to connect to server. Make sure backend is running on port 5050.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🔒 Reset Password</h1>
        <h2>Create a new password</h2>

        {error && <div className="message error">{error}</div>}
        {success && <div className="message success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="disabled-input"
            />
          </div>

          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <p className="toggle-text">
          <button
            type="button"
            className="toggle-btn"
            onClick={onCancel}
            disabled={loading}
          >
            Back to Login
          </button>
        </p>
      </div>
    </div>
  )
}
