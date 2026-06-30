import { useState } from 'react'
import { X, Send, MessageSquare } from 'lucide-react'

interface Props {
  token: string
  onClose: () => void
}

const CATEGORIES = ['general', 'bug', 'feature request', 'ui/ux', 'performance', 'other']

export default function FeedbackModal({ token, onClose }: Props) {
  const [category, setCategory] = useState('general')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    setError('')
    try {
      const r = await fetch(`/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category, subject, message })
      })
      if (r.ok) {
        setSent(true)
        setTimeout(onClose, 2000)
      } else {
        const d = await r.json()
        setError(d.error || 'Failed to send feedback')
      }
    } catch {
      setError('Network error — please try again')
    }
    setSending(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16, color: '#1a1a2e' }}>
            <MessageSquare size={18} style={{ color: '#1a73e8' }} />
            Send Feedback
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#43a047' }}>
            <div style={{ fontSize: 40 }}>✓</div>
            <div style={{ marginTop: 10, fontWeight: 600, fontSize: 15 }}>Thanks for your feedback!</div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ padding: '20px' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 7, fontSize: 14, background: '#fafafa', color: '#333' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Subject <span style={{ fontWeight: 400, color: '#aaa' }}>(optional)</span></label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Brief summary"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 7, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>Message <span style={{ color: '#e53935' }}>*</span></label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Describe your feedback, bug, or suggestion…"
                rows={5}
                required
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 7, fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            {error && <div style={{ color: '#e53935', fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={onClose} style={{ padding: '8px 18px', border: '1px solid #ddd', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 14, color: '#555' }}>Cancel</button>
              <button type="submit" disabled={sending || !message.trim()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 7, background: sending ? '#90caf9' : '#1a73e8', color: '#fff', cursor: sending ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 500 }}>
                <Send size={14} />{sending ? 'Sending…' : 'Send Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
