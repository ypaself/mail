import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Star, Tag, Paperclip, Reply, Forward, PenLine } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  isLabeled?: boolean
  isRead?: boolean
  folder?: string
  label?: string
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

      if (!response.ok) {
        setError(`Failed to load label emails: ${data.error || response.statusText}`)
        setLabeledEmails([])
      } else if (data.emails && data.emails.length > 0) {
        setLabeledEmails(data.emails)
      } else {
        setLabeledEmails([])
      }
    } catch (err) {
      setLabeledEmails([])
      setError('Failed to load labeled emails: ' + (err instanceof Error ? err.message : 'Unknown error'))
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
              className={`email-item labeled-item ${!email.isRead && email.folder !== 'sent' ? 'unread' : ''} ${email.folder === 'sent' ? 'sent' : ''}`}
              onClick={() => onViewEmail(email)}
            >
              <div className="email-header">
                <div className="email-from">
                  {email.folder === 'sent'
                    ? <><span style={{color:'#ff9800',fontWeight:700}}>To:</span>{' '}<span style={{fontWeight:600,color:'#111'}}>{(email.to||'').split('@')[0]}</span>{(email.to||'').includes('@')&&<span style={{fontWeight:300,color:'#555'}}>@{(email.to||'').split('@')[1]}</span>}</>
                    : <><span style={{fontWeight:600,color:email.isRead?'#111':'#0288d1'}}>{(email.from||'').split('@')[0]}</span>{(email.from||'').includes('@')&&<span style={{fontWeight:300,color:email.isRead?'#555':'#0288d1'}}>@{(email.from||'').split('@')[1]}</span>}</>
                  }
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

      {labeledEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No labeled emails</p>
        </div>
      )}
    </div>
  )
}
