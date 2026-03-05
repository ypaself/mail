import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'

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

interface StarredPageProps {
  token: string
  onViewEmail: (email: Email) => void
}

export default function StarredPage({ token, onViewEmail }: StarredPageProps) {
  const [starredEmails, setStarredEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchStarredEmails()
  }, [token])

  const fetchStarredEmails = async () => {
    setLoading(true)
    setError('')
    try {
      const starredResponse = await fetch('http://localhost:5050/api/starred', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const starredData = await starredResponse.json()

      if (starredResponse.ok && starredData.emails && starredData.emails.length > 0) {
        setStarredEmails(starredData.emails)
      } else {
        setStarredEmails([])
      }
    } catch (err) {
      setStarredEmails([])
      setError('Failed to load starred emails')
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
        // Refresh the starred emails list
        fetchStarredEmails()
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  return (
    <div className="email-container">
      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading starred emails...</div>}

      {starredEmails.length > 0 && (
        <div className="email-list">
          {starredEmails.map((email, idx) => (
            <div
              key={idx}
              className="email-item"
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  <strong>{email.folder === 'sent' ? `To: ${email.to}` : email.from}</strong>
                  <button
                    className="star-btn active"
                    onClick={(e) => handleToggleStar(email.id, e)}
                    title="Remove star"
                  >
                    <Star size={18} fill="currentColor" />
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

      {starredEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No starred emails yet</p>
        </div>
      )}
    </div>
  )
}
