import { useEffect, useState } from 'react'
import { Star, Trash2, Edit, Paperclip, Reply, Forward, PenLine } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  isSpam?: boolean
  isRead?: boolean
  folder?: string
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

interface SpamPageProps {
  token: string
  onViewEmail: (email: Email) => void
}

export default function SpamPage({ token, onViewEmail }: SpamPageProps) {
  const [spamEmails, setSpamEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSpamEmails()
  }, [token])

  const fetchSpamEmails = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5050/api/spam', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (response.ok && data.emails && data.emails.length > 0) {
        setSpamEmails(data.emails)
      } else {
        setSpamEmails([])
      }
    } catch (err) {
      setSpamEmails([])
      setError('Failed to load spam emails')
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
        setSpamEmails(spamEmails.map(email =>
          email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
        ))
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  const handleRemoveSpam = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/spam`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the email from the spam list
        setSpamEmails(spamEmails.filter(email => email.id !== emailId))
      }
    } catch (err) {
      console.error('Failed to remove from spam:', err)
    }
  }

  return (
    <div className="email-container">
      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading spam emails...</div>}

      {spamEmails.length > 0 && (
        <div className="email-list">
          {spamEmails.map((email, idx) => (
            <div
              key={idx}
              className={`email-item spam-item ${!email.isRead && email.folder !== 'sent' && email.folder !== 'drafts' ? 'unread' : ''} ${email.folder === 'sent' ? 'sent' : ''}`}
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  {email.folder === 'drafts'
                    ? <><span style={{color:'#ff5722',fontWeight:700}}>Draft:</span>{' '}<span style={{fontWeight:600,color:'#111'}}>{(email.to||'').split('@')[0]}</span>{(email.to||'').includes('@')&&<span style={{fontWeight:300,color:'#555'}}>@{(email.to||'').split('@')[1]}</span>}</>
                    : email.folder === 'sent'
                      ? <><span style={{color:'#ff9800',fontWeight:700}}>To:</span>{' '}<span style={{fontWeight:600,color:'#111'}}>{(email.to||'').split('@')[0]}</span>{(email.to||'').includes('@')&&<span style={{fontWeight:300,color:'#555'}}>@{(email.to||'').split('@')[1]}</span>}</>
                      : <><span style={{fontWeight:600,color:email.isRead?'#111':'#0288d1'}}>{(email.from||'').split('@')[0]}</span>{(email.from||'').includes('@')&&<span style={{fontWeight:300,color:email.isRead?'#555':'#0288d1'}}>@{(email.from||'').split('@')[1]}</span>}</>
                  }
                  <span className="spam-badge">Spam</span>
                  <button
                    className={`star-btn ${email.isStarred ? 'active' : ''}`}
                    onClick={(e) => handleToggleStar(email.id, e)}
                    title={email.isStarred ? 'Remove star' : 'Add star'}
                  >
                    <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className="spam-btn active"
                    onClick={(e) => handleRemoveSpam(email.id, e)}
                    title="Remove from spam"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                {email.folder === 'drafts' && <Edit size={16} style={{ color: '#ff5722', flexShrink: 0 }} />}
                <button className={`email-canvas-btn${/data-canvas-(draft|saved)/.test(email.body||'')?' active':''}`} style={{ background:'none', border:'none', cursor:'default', padding:'0', boxSizing:'border-box', color:/data-canvas-(draft|saved)/.test(email.body||'')?'#7c4dff':'#ccc', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0, height:'40px', width:'40px' }} title="Canvas board"><PenLine size={40} /></button>
                <span className="email-date" style={{ color: email.folder === 'sent' ? '#222' : email.folder === 'drafts' ? '#ff5722' : !email.isRead ? '#0288d1' : '#666', fontWeight: 700, fontSize: '13px' }}>{new Date(email.date).toLocaleDateString()}</span>
              </div>
              <div className="email-subject" style={{ color: (!email.subject || email.subject === '(No subject)') ? '#888' : 'inherit', position: 'relative' }}>{(() => { const s = (email.subject || '').toLowerCase().trim(); if (s.startsWith('re:')) return <span className="reply-status-icon"><Reply size={14} /></span>; if (s.startsWith('fwd:') || s.startsWith('fw:')) return <span className="reply-status-icon"><Forward size={14} /></span>; return null; })()}{(!!email.hasAttachments || /data-file-card/i.test(email.body || '')) && <Paperclip size={13} style={{ color: '#888', flexShrink: 0, marginRight: '2px', verticalAlign: 'middle' }} />}<span>{(() => { const raw = email.subject || ''; const low = raw.toLowerCase().trim(); if (low.startsWith('re:') || low.startsWith('fwd:') || low.startsWith('fw:')) return raw.slice(raw.indexOf(':') + 1).trim() || '(No subject)'; return raw || '(No subject)'; })()}</span></div>
              {(() => { const p = bodyPreview(email.body, email.hasAttachments); return p ? <div className="email-preview">{p}</div> : null; })()}
              {(() => { const html = extractFileCardsHtml(email.body || ''); if (!html) return null; return <div style={{ display:'flex', flexDirection:'row', flexWrap:'nowrap', overflow:'hidden', alignItems:'center', gap:'6px', marginTop:'4px', lineHeight:0 }} dangerouslySetInnerHTML={{ __html: html }} /> })()}
            </div>
          ))}
        </div>
      )}

      {spamEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No spam emails</p>
        </div>
      )}
    </div>
  )
}
