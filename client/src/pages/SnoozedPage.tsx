import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isSnoozed?: boolean
  snoozedUntil?: string
  folder?: string
}

interface SnoozedPageProps {
  token: string
  onViewEmail: (email: Email) => void
}

export default function SnoozedPage({ token, onViewEmail }: SnoozedPageProps) {
  const [snoozedEmails, setSnoozedEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSnoozedEmails()
  }, [token])

  const fetchSnoozedEmails = async () => {
    setLoading(true)
    setError('')
    try {
      const snoozedResponse = await fetch('http://localhost:5050/api/snoozed', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const snoozedData = await snoozedResponse.json()

      if (snoozedResponse.ok && snoozedData.emails && snoozedData.emails.length > 0) {
        setSnoozedEmails(snoozedData.emails)
      } else {
        setSnoozedEmails([])
      }
    } catch (err) {
      setSnoozedEmails([])
      setError('Failed to load snoozed emails')
    } finally {
      setLoading(false)
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
        // Refresh the snoozed emails list
        fetchSnoozedEmails()
      }
    } catch (err) {
      console.error('Failed to toggle snooze:', err)
    }
  }

  const formatSnoozeTime = (snoozedUntil: string | undefined) => {
    if (!snoozedUntil) return 'Unknown'
    const date = new Date(snoozedUntil)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  return (
    <div className="email-container">
      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading snoozed emails...</div>}

      {snoozedEmails.length > 0 && (
        <div className="email-list">
          {snoozedEmails.map((email, idx) => (
            <div
              key={idx}
              className="email-item"
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  <strong>{email.folder === 'sent' ? `To: ${email.to}` : email.from}</strong>
                  <button
                    className="snooze-btn active"
                    onClick={(e) => handleToggleSnooze(email.id, e)}
                    title="Unsnooze"
                  >
                    <Clock size={18} />
                  </button>
                </div>
                <span className="email-date">
                  Reappears: {formatSnoozeTime(email.snoozedUntil)}
                </span>
              </div>
              <div className="email-subject">{email.subject}</div>
              <div className="email-preview">{email.body.substring(0, 100)}...</div>
            </div>
          ))}
        </div>
      )}

      {snoozedEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No snoozed emails</p>
        </div>
      )}
    </div>
  )
}
