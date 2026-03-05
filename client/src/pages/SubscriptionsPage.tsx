import { useEffect, useState } from 'react'
import { Star, LogOut } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  isSubscription?: boolean
  folder?: string
}

interface SubscriptionsPageProps {
  token: string
  onViewEmail: (email: Email) => void
}

export default function SubscriptionsPage({ token, onViewEmail }: SubscriptionsPageProps) {
  const [subscriptionEmails, setSubscriptionEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSubscriptionEmails()
  }, [token])

  const fetchSubscriptionEmails = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5050/api/subscriptions', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (response.ok && data.emails && data.emails.length > 0) {
        setSubscriptionEmails(data.emails)
      } else {
        setSubscriptionEmails([])
      }
    } catch (err) {
      setSubscriptionEmails([])
      setError('Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStar = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/star`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Update the email's starred status in the UI
        setSubscriptionEmails(subscriptionEmails.map(email =>
          email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
        ))
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  const handleUnsubscribe = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/subscription`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the subscription email from the list
        setSubscriptionEmails(subscriptionEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to unsubscribe:', err)
    }
  }

  return (
    <div className="email-container">
      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading subscriptions...</div>}

      {subscriptionEmails.length > 0 && (
        <div className="email-list">
          {subscriptionEmails.map((email, idx) => (
            <div
              key={idx}
              className="email-item subscription-item"
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  <strong>{email.folder === 'sent' ? `To: ${email.to}` : email.from}</strong>
                  <span className="subscription-badge">Newsletter</span>
                  <button
                    className={`star-btn ${email.isStarred ? 'active' : ''}`}
                    onClick={(e) => handleToggleStar(email.id, e)}
                    title={email.isStarred ? 'Remove star' : 'Add star'}
                  >
                    <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className="unsubscribe-btn"
                    onClick={(e) => handleUnsubscribe(email.id, e)}
                    title="Unsubscribe"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
                <span className="email-date">{new Date(email.date).toLocaleDateString()}</span>
              </div>
              <div className="email-subject">{email.subject}</div>
              <div className="email-preview">{email.body.substring(0, 100)}...</div>
            </div>
          ))}
        </div>
      )}

      {subscriptionEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No subscriptions</p>
        </div>
      )}
    </div>
  )
}
