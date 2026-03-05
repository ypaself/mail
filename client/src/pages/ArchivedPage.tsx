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
  isArchived?: boolean
  folder?: string
}

interface ArchivedPageProps {
  token: string
  onViewEmail: (email: Email) => void
}

export default function ArchivedPage({ token, onViewEmail }: ArchivedPageProps) {
  const [archivedEmails, setArchivedEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchArchivedEmails()
  }, [token])

  const fetchArchivedEmails = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5050/api/archived', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (response.ok && data.emails && data.emails.length > 0) {
        setArchivedEmails(data.emails)
      } else {
        setArchivedEmails([])
      }
    } catch (err) {
      setArchivedEmails([])
      setError('Failed to load archived emails')
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
        setArchivedEmails(archivedEmails.map(email =>
          email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
        ))
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  const handleUnarchive = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/archive`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the unarchived email from the list
        setArchivedEmails(archivedEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to unarchive email:', err)
    }
  }

  return (
    <div className="email-container">
      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading archived emails...</div>}

      {archivedEmails.length > 0 && (
        <div className="email-list">
          {archivedEmails.map((email, idx) => (
            <div
              key={idx}
              className="email-item archived-item"
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  <strong>{email.folder === 'sent' ? `To: ${email.to}` : email.from}</strong>
                  <span className="archived-badge">Archived</span>
                  <button
                    className={`star-btn ${email.isStarred ? 'active' : ''}`}
                    onClick={(e) => handleToggleStar(email.id, e)}
                    title={email.isStarred ? 'Remove star' : 'Add star'}
                  >
                    <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className="archive-btn active"
                    onClick={(e) => handleUnarchive(email.id, e)}
                    title="Unarchive"
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

      {archivedEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No archived emails</p>
        </div>
      )}
    </div>
  )
}
