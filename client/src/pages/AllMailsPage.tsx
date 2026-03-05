import { useEffect, useState } from 'react'
import { Star, Archive } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  folder?: string
}

interface AllMailsPageProps {
  token: string
  onViewEmail: (email: Email) => void
}

export default function AllMailsPage({ token, onViewEmail }: AllMailsPageProps) {
  const [allEmails, setAllEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAllMails()
  }, [token])

  const fetchAllMails = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5050/api/allmails', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (response.ok && data.emails && data.emails.length > 0) {
        setAllEmails(data.emails)
      } else {
        setAllEmails([])
      }
    } catch (err) {
      setAllEmails([])
      setError('Failed to load all mails')
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
        setAllEmails(allEmails.map(email =>
          email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
        ))
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
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
        // Remove the archived email from the list
        setAllEmails(allEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to archive email:', err)
    }
  }

  return (
    <div className="email-container">
      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading all mails...</div>}

      {allEmails.length > 0 && (
        <div className="email-list">
          {allEmails.map((email, idx) => (
            <div
              key={idx}
              className="email-item"
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  <strong>{email.folder === 'sent' ? `To: ${email.to}` : email.from}</strong>
                  <button
                    className={`star-btn ${email.isStarred ? 'active' : ''}`}
                    onClick={(e) => handleToggleStar(email.id, e)}
                    title={email.isStarred ? 'Remove star' : 'Add star'}
                  >
                    <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className="archive-btn"
                    onClick={(e) => handleArchive(email.id, e)}
                    title="Archive"
                  >
                    <Archive size={18} />
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

      {allEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No mails</p>
        </div>
      )}
    </div>
  )
}
