import { useEffect, useState } from 'react'
import { Star, Send, Trash2, Paperclip, PenLine } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  isDraft?: boolean
  hasAttachments?: boolean
}

function bodyPreview(body: string, hasAttachments?: boolean): string {
  if (!body) return ''
  const hasDrawing = /<img[^>]*data-canvas-draft="1"[^>]*src="data:image/i.test(body)
  const hasCanvas = /data-canvas-draft="1"|data-canvas-saved="1"/i.test(body)
  const text = (() => {
    try {
      const _d = new DOMParser().parseFromString(`<div>${body}</div>`, 'text/html')
      _d.querySelectorAll('[data-file-card],[data-canvas-draft],[data-canvas-saved]').forEach(el => el.remove())
      return (_d.querySelector('div')?.textContent || '').replace(/\s+/g, ' ').trim()
    } catch {
      return body.replace(/<span\b[^>]*data-file-card[^>]*>[\s\S]*?<\/span>/gi, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    }
  })()
  const parts: string[] = []
  if (hasCanvas) parts.push(hasDrawing ? '📐 Drawing' : '📐 Canvas')
  // file indicator removed
  if (text) parts.push(text.substring(0, 80))
  return parts.join(' · ')
}

function extractFileCardsHtml(body: string): string {
  if (!body || !/data-file-card/i.test(body)) return ''
  try {
    const doc = new DOMParser().parseFromString(`<div>${body}</div>`, 'text/html')
    const cards = doc.querySelectorAll('[data-file-card]')
    if (!cards.length) return ''
    return Array.from(cards).map(card => {
      card.querySelectorAll('[data-remove-file], [data-upload-overlay], [data-folder-progress]').forEach(el => el.remove())
      card.removeAttribute('contenteditable')
      return card.outerHTML
    }).join('')
  } catch { return '' }
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
      const response = await fetch(`/api/drafts`, {
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
      const response = await fetch(`/api/emails/${emailId}/star`, {
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
      const response = await fetch(`/api/emails/${emailId}/send`, {
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
      const response = await fetch(`/api/emails/${emailId}/draft`, {
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
          {draftEmails.map((email) => (
            <div
              key={email.id ?? email.subject + email.date}
              className="email-item draft-item"
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  <span style={{ color: '#ff5722', fontWeight: 700, marginRight: '4px', flexShrink: 0 }}>Draft:</span>
                  {(!!email.hasAttachments || /data-file-card/i.test(email.body || '')) && <Paperclip size={13} style={{ color: '#888', flexShrink: 0, marginRight: '2px', verticalAlign: 'middle' }} />}
                  <strong style={{ color: (!email.subject || email.subject === '(No subject)') ? '#888' : 'inherit' }}>{email.subject || '(No subject)'}</strong>
                  <button
                    className={`star-btn ${email.isStarred ? 'active' : ''}`}
                    onClick={(e) => handleToggleStar(email.id, e)}
                    title={email.isStarred ? 'Remove star' : 'Add star'}
                  >
                    <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <button className={`email-canvas-btn${/data-canvas-(draft|saved)/.test(email.body||'')?' active':''}`} style={{ background:'none', border:'none', cursor:'default', padding:'0', boxSizing:'border-box', color:/data-canvas-(draft|saved)/.test(email.body||'')?'#7c4dff':'#ccc', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0, height:'40px', width:'40px' }} title="Canvas board"><PenLine size={40} /></button>
                <span className="email-date" style={{ color: '#ff5722', fontWeight: 700, fontSize: '13px' }}>{new Date(email.date).toLocaleDateString()}</span>
              </div>
              <div className="email-subject">To: {email.to}</div>
              {(() => { const p = bodyPreview(email.body, email.hasAttachments); return p ? <div className="email-preview">{p}</div> : null; })()}
              {(() => { const html = extractFileCardsHtml(email.body || ''); if (!html) return null; return <div style={{ display:'flex', flexDirection:'row', flexWrap:'nowrap', overflow:'hidden', alignItems:'center', gap:'6px', marginTop:'4px', lineHeight:0 }} dangerouslySetInnerHTML={{ __html: html }} /> })()}
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
