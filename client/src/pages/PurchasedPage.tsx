import { useEffect, useState } from 'react'
import { Star, ShoppingCart } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  isPurchased?: boolean
  folder?: string
}

interface PurchasedPageProps {
  token: string
  onViewEmail: (email: Email) => void
}

export default function PurchasedPage({ token, onViewEmail }: PurchasedPageProps) {
  const [purchasedEmails, setPurchasedEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPurchasedEmails()
  }, [token])

  const fetchPurchasedEmails = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5050/api/purchased', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (response.ok && data.emails && data.emails.length > 0) {
        setPurchasedEmails(data.emails)
      } else {
        setPurchasedEmails([])
      }
    } catch (err) {
      setPurchasedEmails([])
      setError('Failed to load purchased emails')
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
        setPurchasedEmails(purchasedEmails.map(email =>
          email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
        ))
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  const handleUnpurchase = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/purchase`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the unpurchased email from the list
        setPurchasedEmails(purchasedEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to unpurchase email:', err)
    }
  }

  return (
    <div className="email-container">
      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading purchased emails...</div>}

      {purchasedEmails.length > 0 && (
        <div className="email-list">
          {purchasedEmails.map((email, idx) => (
            <div
              key={idx}
              className="email-item purchased-item"
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  <strong>{email.folder === 'sent' ? `To: ${email.to}` : email.from}</strong>
                  <span className="purchased-badge">Purchase</span>
                  <button
                    className={`star-btn ${email.isStarred ? 'active' : ''}`}
                    onClick={(e) => handleToggleStar(email.id, e)}
                    title={email.isStarred ? 'Remove star' : 'Add star'}
                  >
                    <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className="purchase-btn active"
                    onClick={(e) => handleUnpurchase(email.id, e)}
                    title="Remove from purchases"
                  >
                    <ShoppingCart size={18} />
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

      {purchasedEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No purchased emails</p>
        </div>
      )}
    </div>
  )
}
