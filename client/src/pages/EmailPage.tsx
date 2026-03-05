import { useState } from 'react'
import { Send, ArrowLeft, Trash2, Archive, Star } from 'lucide-react'
import '../App.css'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
}

interface EmailPageProps {
  token: string
  selectedEmail?: Email | null
  onBack?: () => void
}

export default function EmailPage({ token, selectedEmail, onBack }: EmailPageProps) {
  const [mode, setMode] = useState<'compose' | 'view'>('compose')
  const [subject, setSubject] = useState(selectedEmail?.subject || '')
  const [to, setTo] = useState(selectedEmail?.to || '')
  const [body, setBody] = useState(selectedEmail?.body || '')
  const [sending, setSending] = useState(false)

  const handleSendEmail = async () => {
    if (!subject.trim() || !to.trim() || !body.trim()) {
      alert('Please fill in all fields')
      return
    }

    setSending(true)
    try {
      const response = await fetch('http://localhost:5050/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ subject, to, body }),
      })

      if (response.ok) {
        alert('Email sent successfully!')
        setSubject('')
        setTo('')
        setBody('')
      } else {
        alert('Failed to send email')
      }
    } catch (err) {
      alert('Error sending email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="email-page">
      {mode === 'compose' ? (
        <div className="email-compose">
          <div className="compose-header">
            <h2>Compose Email</h2>
            {onBack && (
              <button className="back-btn" onClick={onBack}>
                <ArrowLeft size={20} />
              </button>
            )}
          </div>

          <div className="compose-form">
            <div className="form-group">
              <label>To:</label>
              <input
                type="email"
                placeholder="recipient@example.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="email-input"
              />
            </div>

            <div className="form-group">
              <label>Subject:</label>
              <input
                type="text"
                placeholder="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="email-input"
              />
            </div>

            <div className="form-group">
              <label>Message:</label>
              <textarea
                placeholder="Write your email message here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="email-textarea"
                rows={15}
              ></textarea>
            </div>

            <div className="compose-actions">
              <button
                className="send-email-btn"
                onClick={handleSendEmail}
                disabled={sending}
              >
                <Send size={20} />
                {sending ? 'Sending...' : 'Send Email'}
              </button>
              {onBack && (
                <button className="cancel-btn" onClick={onBack}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="email-view">
          {selectedEmail ? (
            <>
              <div className="view-header">
                <h2>{selectedEmail.subject}</h2>
                <div className="view-actions">
                  <button className="icon-btn" title="Star">
                    <Star size={20} />
                  </button>
                  <button className="icon-btn" title="Archive">
                    <Archive size={20} />
                  </button>
                  <button className="icon-btn delete" title="Delete">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              <div className="view-metadata">
                <div className="metadata-row">
                  <span className="label">From:</span>
                  <span className="value">{selectedEmail.from}</span>
                </div>
                <div className="metadata-row">
                  <span className="label">To:</span>
                  <span className="value">{selectedEmail.to}</span>
                </div>
                <div className="metadata-row">
                  <span className="label">Date:</span>
                  <span className="value">
                    {new Date(selectedEmail.date).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="view-body">
                <p>{selectedEmail.body}</p>
              </div>

              <div className="view-footer">
                <button className="reply-btn" onClick={() => setMode('compose')}>
                  Reply
                </button>
                {onBack && (
                  <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={20} /> Back to Inbox
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="no-email">
              <p>Select an email to view</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
