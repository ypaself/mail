import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

interface ComposePageProps {
  token: string
  userEmail: string
  onSent: () => void
  onCancel: () => void
}

export default function ComposePage({ token, userEmail, onSent, onCancel }: ComposePageProps) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const location = useLocation()

  useEffect(() => {
    if (location.state) {
      const { action, email, replyTo } = location.state
      if (email) {
        if (action === 'reply') {
          setTo(replyTo || email.from)
          setSubject(email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`)
          setBody(`\n\nOn ${new Date(email.date).toLocaleString()}, ${email.from} wrote:\n> ${email.body.replace(/\n/g, '\n> ')}`)
        } else if (action === 'forward') {
          setSubject(email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`)
          setBody(`\n\n---------- Forwarded message ---------\nFrom: ${email.from}\nDate: ${new Date(email.date).toLocaleString()}\nSubject: ${email.subject}\nTo: ${email.to}\n\n${email.body}`)
        }
      }
    }
  }, [location.state])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!to || !subject || !body) {
      setError('Please fill in all fields')
      return
    }

    setSending(true)
    try {
      const response = await fetch('http://localhost:5050/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to,
          subject,
          text: body,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Email sent successfully!')
        setTo('')
        setSubject('')
        setBody('')
        setTimeout(onSent, 1500)
      } else {
        setError(data.error || 'Failed to send email')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="compose-container">
      <div className="compose-card">
        <div className="compose-header">
          <h2>Compose Email</h2>
          <button onClick={onCancel} className="close-btn">✕</button>
        </div>

        {error && <div className="message error">{error}</div>}
        {success && <div className="message success">{success}</div>}

        <form onSubmit={handleSend}>
          <div className="form-group">
            <label>From</label>
            <input
              type="email"
              value={userEmail}
              disabled
              className="disabled-input"
            />
          </div>

          <div className="form-group">
            <label>To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              required
              disabled={sending}
            />
          </div>

          <div className="form-group">
            <label>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              required
              disabled={sending}
            />
          </div>

          <div className="form-group">
            <label>Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message here..."
              rows={10}
              required
              disabled={sending}
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              disabled={sending}
              className="submit-btn"
            >
              {sending ? 'Sending...' : 'Send Email'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="cancel-btn"
              disabled={sending}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
