import { useEffect, useState } from 'react'
import { Star, Send, Trash2 } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  isDraft?: boolean
}

interface DraftsPageProps {
  token: string
  onViewEmail: (email: Email) => void
  onSendDraft?: (draftId: number) => void
}

export default function DraftsPage({ token, onViewEmail, onSendDraft }: DraftsPageProps) {
  const [draftEmails, setDraftEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDrafts()
  }, [token])

  const fetchDrafts = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5050/api/drafts', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (response.ok && data.emails && data.emails.length > 0) {
        setDraftEmails(data.emails)
      } else {
        setDraftEmails([])
      }
    } catch (err) {
      setDraftEmails([])
      setError('Failed to load drafts')
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
        setDraftEmails(draftEmails.map(email =>
          email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
        ))
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  const handleSendDraft = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/send`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the draft from the list
        setDraftEmails(draftEmails.filter(email => email.id !== emailId))
        if (onSendDraft) onSendDraft(emailId)
      }
    } catch (err) {
      console.error('Failed to send draft:', err)
    }
  }

  const handleDeleteDraft = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    if (!confirm('Are you sure you want to delete this draft?')) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/draft`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the draft from the list
        setDraftEmails(draftEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to delete draft:', err)
    }
  }

  return (
    <div className="email-container">
      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading drafts...</div>}

      {draftEmails.length > 0 && (
        <div className="email-list">
          {draftEmails.map((email, idx) => (
            <div
              key={idx}
              className="email-item draft-item"
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  <strong>{email.subject || '(No subject)'}</strong>
                  <span className="draft-badge">Draft</span>
                  <button
                    className={`star-btn ${email.isStarred ? 'active' : ''}`}
                    onClick={(e) => handleToggleStar(email.id, e)}
                    title={email.isStarred ? 'Remove star' : 'Add star'}
                  >
                    <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <span className="email-date">{new Date(email.date).toLocaleDateString()}</span>
              </div>
              <div className="email-subject">To: {email.to}</div>
              <div className="email-preview">{email.body.substring(0, 100)}...</div>
              <div className="draft-actions">
                <button
                  className="draft-send-btn"
                  onClick={(e) => handleSendDraft(email.id, e)}
                  title="Send draft"
                >
                  <Send size={16} /> Send
                </button>
                <button
                  className="draft-delete-btn"
                  onClick={(e) => handleDeleteDraft(email.id, e)}
                  title="Delete draft"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {draftEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No drafts</p>
        </div>
      )}
    </div>
  )
}
