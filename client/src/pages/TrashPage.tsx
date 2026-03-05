import { useEffect, useState } from 'react'
import { Star, RotateCcw } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  isDeleted?: boolean
  folder?: string
}

interface TrashPageProps {
  token: string
  onViewEmail: (email: Email) => void
}

export default function TrashPage({ token, onViewEmail }: TrashPageProps) {
  const [trashEmails, setTrashEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTrashEmails()
  }, [token])

  const fetchTrashEmails = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5050/api/trash', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (response.ok && data.emails && data.emails.length > 0) {
        setTrashEmails(data.emails)
      } else {
        setTrashEmails([])
      }
    } catch (err) {
      setTrashEmails([])
      setError('Failed to load trash emails')
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
        setTrashEmails(trashEmails.map(email =>
          email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
        ))
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  const handleRestore = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/delete`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the restored email from the trash list
        setTrashEmails(trashEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to restore email:', err)
    }
  }

  return (
    <div className="email-container">
      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading trash emails...</div>}

      {trashEmails.length > 0 && (
        <div className="email-list">
          {trashEmails.map((email, idx) => (
            <div
              key={idx}
              className="email-item trash-item"
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  <strong>{email.folder === 'sent' ? `To: ${email.to}` : email.from}</strong>
                  <span className="trash-badge">Deleted</span>
                  <button
                    className={`star-btn ${email.isStarred ? 'active' : ''}`}
                    onClick={(e) => handleToggleStar(email.id, e)}
                    title={email.isStarred ? 'Remove star' : 'Add star'}
                  >
                    <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className="restore-btn"
                    onClick={(e) => handleRestore(email.id, e)}
                    title="Restore from trash"
                  >
                    <RotateCcw size={18} />
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

      {trashEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No emails in trash</p>
        </div>
      )}
    </div>
  )
}
