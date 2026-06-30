import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Paperclip, X } from 'lucide-react'

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
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
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
    } else {
      // Pre-fill when opened via "New window" button from ChatMailPage
      try {
        const toVal = sessionStorage.getItem('newwin_compose_to')
        const subjectVal = sessionStorage.getItem('newwin_compose_subject')
        const bodyVal = sessionStorage.getItem('newwin_compose_body')
        if (toVal) {
          const toArr: string[] = JSON.parse(toVal)
          if (toArr.length) setTo(toArr.join(', '))
        }
        if (subjectVal) setSubject(subjectVal)
        if (bodyVal) {
          // Strip HTML tags for plain-text compose area
          const tmp = document.createElement('div')
          tmp.innerHTML = bodyVal
          const plainText = tmp.innerText || tmp.textContent || ''
          if (plainText.trim()) setBody(plainText)
        }
        // Clean up keys so they don't persist on reload
        ;['newwin_compose_to','newwin_compose_subject','newwin_compose_body','newwin_compose_cc','newwin_compose_bcc'].forEach(k => sessionStorage.removeItem(k))
      } catch (_) {}
    }
  }, [location.state])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

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
      const response = await fetch(`/api/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to,
          subject,
          text: body,
          has_attachments: attachments.length > 0,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Email sent successfully!')
        setTo('')
        setSubject('')
        setBody('')
        setAttachments([])
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

          {attachments.length > 0 && (
            <div className="attachments-list" style={{ marginBottom: '10px' }}>
              {attachments.map((file, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#555', marginBottom: '4px' }}>
                  <Paperclip size={13} />
                  <span>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: '#999', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="form-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={sending}
              className="submit-btn"
            >
              {sending ? 'Sending...' : 'Send Email'}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="cancel-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Paperclip size={15} />
              Attach Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
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
