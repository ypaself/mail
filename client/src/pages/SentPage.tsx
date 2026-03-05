import { useEffect, useState } from 'react'
import { Star, Clock, Archive, ShoppingCart, AlertCircle, Trash2, RotateCcw, LogOut, Tag } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  template?: string
  isStarred?: boolean
  isSnoozed?: boolean
}

interface SentPageProps {
  token: string
  onViewEmail: (email: Email) => void
}

export default function SentPage({ token, onViewEmail }: SentPageProps) {
  const [sentEmails, setSentEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSentEmails()
  }, [token])

  const fetchSentEmails = async () => {
    setLoading(true)
    setError('')
    try {
      // Fetch sent emails
      const sentResponse = await fetch('http://localhost:5050/api/sent', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const sentData = await sentResponse.json()

      if (sentResponse.ok && sentData.emails && sentData.emails.length > 0) {
        setSentEmails(sentData.emails)
      } else {
        setSentEmails([])
      }
    } catch (err) {
      setSentEmails([])
      setError('Failed to load sent emails')
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
        setSentEmails(sentEmails.map(email =>
          email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
        ))
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  const handleToggleSnooze = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/snooze`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hours: 1 }),
      })

      if (response.ok) {
        // Remove the snoozed email from the sent folder
        setSentEmails(sentEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to snooze email:', err)
    }
  }

  const handleArchive = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/archive`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the archived email from the sent folder
        setSentEmails(sentEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to archive email:', err)
    }
  }

  const handlePurchase = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/purchase`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the purchased email from the sent folder
        setSentEmails(sentEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to mark as purchased:', err)
    }
  }

  const handleSchedule = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000) // Schedule for tomorrow

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/schedule`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scheduledFor }),
      })

      if (response.ok) {
        // Remove the scheduled email from the sent folder
        setSentEmails(sentEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to schedule email:', err)
    }
  }

  const handleImportant = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/important`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the important email from the sent folder
        setSentEmails(sentEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to mark as important:', err)
    }
  }

  const handleSpam = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/spam`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the spam email from the sent folder
        setSentEmails(sentEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to mark as spam:', err)
    }
  }

  const handleDelete = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/delete`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the deleted email from the sent folder
        setSentEmails(sentEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to delete email:', err)
    }
  }

  const handleSubscription = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/subscription`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the subscription email from the sent folder
        setSentEmails(sentEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to manage subscription:', err)
    }
  }

  const handleLabel = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/label`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the labeled email from the sent folder
        setSentEmails(sentEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to manage label:', err)
    }
  }

  return (
    <div className="email-container">
      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading sent emails...</div>}

      {sentEmails.length > 0 && (
        <div className="email-list">
          {sentEmails.map((email, idx) => (
            <div
              key={idx}
              className="email-item"
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  <strong>To: {email.to}</strong>
                  <button
                    className={`star-btn ${email.isStarred ? 'active' : ''}`}
                    onClick={(e) => handleToggleStar(email.id, e)}
                    title={email.isStarred ? 'Remove star' : 'Add star'}
                  >
                    <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className="snooze-btn"
                    onClick={(e) => handleToggleSnooze(email.id, e)}
                    title="Snooze for 1 hour"
                  >
                    <Clock size={18} />
                  </button>
                  <button
                    className="archive-btn"
                    onClick={(e) => handleArchive(email.id, e)}
                    title="Archive"
                  >
                    <Archive size={18} />
                  </button>
                  <button
                    className="purchase-btn"
                    onClick={(e) => handlePurchase(email.id, e)}
                    title="Mark as purchase"
                  >
                    <ShoppingCart size={18} />
                  </button>
                  <button
                    className="schedule-btn"
                    onClick={(e) => handleSchedule(email.id, e)}
                    title="Schedule for tomorrow"
                  >
                    <Clock size={18} />
                  </button>
                  <button
                    className="important-btn"
                    onClick={(e) => handleImportant(email.id, e)}
                    title="Mark as important"
                  >
                    <AlertCircle size={18} />
                  </button>
                  <button
                    className="spam-btn"
                    onClick={(e) => handleSpam(email.id, e)}
                    title="Mark as spam"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDelete(email.id, e)}
                    title="Delete"
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button
                    className="subscription-btn"
                    onClick={(e) => handleSubscription(email.id, e)}
                    title="Manage subscription"
                  >
                    <LogOut size={18} />
                  </button>
                  <button
                    className="label-btn"
                    onClick={(e) => handleLabel(email.id, e)}
                    title="Add label"
                  >
                    <Tag size={18} />
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

      {sentEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No sent emails yet</p>
        </div>
      )}
    </div>
  )
}
