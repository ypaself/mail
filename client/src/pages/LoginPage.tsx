import { useState } from 'react'
import ForgotPasswordModal from './ForgotPasswordModal'

interface LoginPageProps {
  onLogin: (token: string, email: string) => void
  onForgotPassword?: (email: string, resetToken: string) => void
}

export default function LoginPage({ onLogin, onForgotPassword }: LoginPageProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = isLogin ? '/api/login' : '/api/register'
      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'An error occurred')
        return
      }

      if (data.token) {
        onLogin(data.token, email)
      } else if (data.user && !isLogin) {
        setError('')
        setEmail('')
        setPassword('')
        setIsLogin(true)
        setError('Registration successful! Please login.')
        setTimeout(() => setError(''), 3000)
      }
    } catch (err) {
      setError('Failed to connect to server. Make sure backend is running on port 5050.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>📧 Mail App</h1>
        <h2>{isLogin ? 'Login' : 'Register'}</h2>

        {error && <div className={`message ${isLogin && error.includes('successful') ? 'success' : 'error'}`}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          {isLogin && (
            <p className="forgot-password-text">
              <button
                type="button"
                className="forgot-password-btn"
                onClick={() => setShowForgotPassword(true)}
                disabled={loading}
              >
                Forgot Password?
              </button>
            </p>
          )}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Loading...' : isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <p className="toggle-text">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="toggle-btn"
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
            }}
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </div>

      {showForgotPassword && (
        <ForgotPasswordModal
          onClose={() => setShowForgotPassword(false)}
          onForgot={(email, token) => {
            setShowForgotPassword(false)
            if (onForgotPassword) {
              onForgotPassword(email, token)
            }
          }}
        />
      )}
    </div>
  )
}
