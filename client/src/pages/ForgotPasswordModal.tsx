import { useState } from 'react'

interface ForgotPasswordModalProps {
  onClose: () => void
  onForgot: (email: string, token: string) => void
}

export default function ForgotPasswordModal({ onClose, onForgot }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch(`/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to process request')
        return
      }

      if (data.token) {
        setSuccess('Reset link sent! Use the token to reset your password.')
        setTimeout(() => {
          onForgot(email, data.token)
        }, 1500)
      } else {
        setSuccess('If the email exists, a reset link will be sent.')
        setTimeout(onClose, 2000)
      }
    } catch (err) {
      setError('Failed to connect to server. Make sure backend is running on port 5050.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Forgot Password</h2>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        {error && <div className="message error">{error}</div>}
        {success && <div className="message success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your registered email"
              required
              disabled={loading}
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              disabled={loading}
              className="submit-btn"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cancel-btn"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
