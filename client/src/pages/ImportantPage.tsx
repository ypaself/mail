import { useEffect, useState } from 'react'
import { Star, AlertCircle } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  isImportant?: boolean
  folder?: string
}

interface ImportantPageProps {
  token: string
  onViewEmail: (email: Email) => void
}

export default function ImportantPage({ token, onViewEmail }: ImportantPageProps) {
  const [importantEmails, setImportantEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchImportantEmails()
  }, [token])

  const fetchImportantEmails = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5050/api/important', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (response.ok && data.emails && data.emails.length > 0) {
        setImportantEmails(data.emails)
      } else {
        setImportantEmails([])
      }
    } catch (err) {
      setImportantEmails([])
      setError('Failed to load important emails')
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
        setImportantEmails(importantEmails.map(email =>
          email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
        ))
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  const handleRemoveImportant = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/important`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the email from the important list
        setImportantEmails(importantEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to remove from important:', err)
    }
  }

  return (
    <div className="email-container">
      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading important emails...</div>}

      {importantEmails.length > 0 && (
        <div className="email-list">
          {importantEmails.map((email, idx) => (
            <div
              key={idx}
              className="email-item important-item"
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  <strong>{email.folder === 'sent' ? `To: ${email.to}` : email.from}</strong>
                  <span className="important-badge">Important</span>
                  <button
                    className={`star-btn ${email.isStarred ? 'active' : ''}`}
                    onClick={(e) => handleToggleStar(email.id, e)}
                    title={email.isStarred ? 'Remove star' : 'Add star'}
                  >
                    <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className="important-btn active"
                    onClick={(e) => handleRemoveImportant(email.id, e)}
                    title="Remove from important"
                  >
                    <AlertCircle size={18} />
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

      {importantEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No important emails</p>
        </div>
      )}
    </div>
  )
}
