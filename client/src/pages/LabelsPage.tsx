import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Star, Tag } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  isLabeled?: boolean
  folder?: string
  label?: string
}

interface LabelsPageProps {
  token: string
  onViewEmail: (email: Email) => void
}

export default function LabelsPage({ token, onViewEmail }: LabelsPageProps) {
  const { labelName } = useParams<{ labelName?: string }>()
  const [labeledEmails, setLabeledEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchLabeledEmails()
  }, [token, labelName])

  const fetchLabeledEmails = async () => {
    setLoading(true)
    setError('')
    try {
      const endpoint = labelName
        ? `http://localhost:5050/api/labels/${encodeURIComponent(labelName)}`
        : 'http://localhost:5050/api/labels'
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (response.ok && data.emails && data.emails.length > 0) {
        setLabeledEmails(data.emails)
      } else {
        setLabeledEmails([])
      }
    } catch (err) {
      setLabeledEmails([])
      setError('Failed to load labeled emails')
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
        setLabeledEmails(labeledEmails.map(email =>
          email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
        ))
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  const handleRemoveLabel = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/label`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the labeled email from the list
        setLabeledEmails(labeledEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to remove label:', err)
    }
  }

  return (
    <div className="email-container">
      {labelName && <h2 className="page-header">{labelName} Label</h2>}
      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading {labelName ? labelName + ' ' : ''}emails...</div>}

      {labeledEmails.length > 0 && (
        <div className="email-list">
          {labeledEmails.map((email, idx) => (
            <div
              key={idx}
              className="email-item labeled-item"
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  <strong>{email.folder === 'sent' ? `To: ${email.to}` : email.from}</strong>
                  <span className="label-badge">{email.label || 'Label'}</span>
                  <button
                    className={`star-btn ${email.isStarred ? 'active' : ''}`}
                    onClick={(e) => handleToggleStar(email.id, e)}
                    title={email.isStarred ? 'Remove star' : 'Add star'}
                  >
                    <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className="label-btn"
                    onClick={(e) => handleRemoveLabel(email.id, e)}
                    title="Remove label"
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

      {labeledEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No labeled emails</p>
        </div>
      )}
    </div>
  )
}
