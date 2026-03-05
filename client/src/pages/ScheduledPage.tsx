import { useEffect, useState } from 'react'
import { Star, Clock } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  isScheduled?: boolean
  scheduledFor?: string
  folder?: string
}

interface ScheduledPageProps {
  token: string
  onViewEmail: (email: Email) => void
}

export default function ScheduledPage({ token, onViewEmail }: ScheduledPageProps) {
  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchScheduledEmails()
  }, [token])

  const fetchScheduledEmails = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5050/api/scheduled', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (response.ok && data.emails && data.emails.length > 0) {
        setScheduledEmails(data.emails)
      } else {
        setScheduledEmails([])
      }
    } catch (err) {
      setScheduledEmails([])
      setError('Failed to load scheduled emails')
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
        setScheduledEmails(scheduledEmails.map(email =>
          email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
        ))
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  const handleUnschedule = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/schedule`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scheduledFor: null }),
      })

      if (response.ok) {
        // Remove the unscheduled email from the list
        setScheduledEmails(scheduledEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to unschedule email:', err)
    }
  }

  const formatScheduledTime = (scheduledFor: string | undefined) => {
    if (!scheduledFor) return ''
    const date = new Date(scheduledFor)
    return date.toLocaleString()
  }

  return (
    <div className="email-container">
      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading scheduled emails...</div>}

      {scheduledEmails.length > 0 && (
        <div className="email-list">
          {scheduledEmails.map((email, idx) => (
            <div
              key={idx}
              className="email-item scheduled-item"
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  <strong>{email.folder === 'sent' ? `To: ${email.to}` : email.from}</strong>
                  <span className="scheduled-badge">Scheduled</span>
                  <button
                    className={`star-btn ${email.isStarred ? 'active' : ''}`}
                    onClick={(e) => handleToggleStar(email.id, e)}
                    title={email.isStarred ? 'Remove star' : 'Add star'}
                  >
                    <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className="schedule-btn active"
                    onClick={(e) => handleUnschedule(email.id, e)}
                    title="Unschedule"
                  >
                    <Clock size={18} />
                  </button>
                </div>
                <span className="email-date">{new Date(email.date).toLocaleDateString()}</span>
              </div>
              <div className="email-subject">{email.subject}</div>
              <div className="scheduled-time">Will be sent: {formatScheduledTime(email.scheduledFor)}</div>
              <div className="email-preview">{email.body.substring(0, 100)}...</div>
            </div>
          ))}
        </div>
      )}

      {scheduledEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No scheduled emails</p>
        </div>
      )}
    </div>
  )
}
