import { useEffect, useState } from 'react'
import { Star, Trash2 } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  isSpam?: boolean
  folder?: string
}

interface SpamPageProps {
  token: string
  onViewEmail: (email: Email) => void
}

export default function SpamPage({ token, onViewEmail }: SpamPageProps) {
  const [spamEmails, setSpamEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSpamEmails()
  }, [token])

  const fetchSpamEmails = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5050/api/spam', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (response.ok && data.emails && data.emails.length > 0) {
        setSpamEmails(data.emails)
      } else {
        setSpamEmails([])
      }
    } catch (err) {
      setSpamEmails([])
      setError('Failed to load spam emails')
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
        setSpamEmails(spamEmails.map(email =>
          email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
        ))
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  const handleRemoveSpam = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/spam`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the email from the spam list
        setSpamEmails(spamEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to remove from spam:', err)
    }
  }

  return (
    <div className="email-container">
      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading spam emails...</div>}

      {spamEmails.length > 0 && (
        <div className="email-list">
          {spamEmails.map((email, idx) => (
            <div
              key={idx}
              className="email-item spam-item"
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  <strong>{email.folder === 'sent' ? `To: ${email.to}` : email.from}</strong>
                  <span className="spam-badge">Spam</span>
                  <button
                    className={`star-btn ${email.isStarred ? 'active' : ''}`}
                    onClick={(e) => handleToggleStar(email.id, e)}
                    title={email.isStarred ? 'Remove star' : 'Add star'}
                  >
                    <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className="spam-btn active"
                    onClick={(e) => handleRemoveSpam(email.id, e)}
                    title="Remove from spam"
                  >
                    <Trash2 size={18} />
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

      {spamEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No spam emails</p>
        </div>
      )}
    </div>
  )
}
