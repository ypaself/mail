import { useEffect, useState } from 'react'
import { Star, Search, Paperclip, Reply, Forward, PenLine } from 'lucide-react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  template?: string
  isStarred?: boolean
  isSnoozed?: boolean
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

interface SearchFilters {
  from: string
  to: string
  cc: string
  bcc: string
  subject: string
  keywords: string
  hasAttachment: boolean
  dateFrom: string
  dateTo: string
  readStatus: 'all' | 'read' | 'unread'
  category: string
}

interface InboxPageProps {
  token: string
  onViewEmail: (email: Email) => void
  searchQuery?: string
  searchFilters?: SearchFilters
}

export default function InboxPage({ token, onViewEmail, searchQuery = '', searchFilters }: InboxPageProps) {
  const [inboxEmails, setInboxEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSearchOptions, setShowSearchOptions] = useState(false)
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)
  const [activeTab, setActiveTab] = useState<'all' | 'primary' | 'promotions' | 'transactions' | 'social'>('all')

  useEffect(() => {
    fetchAllEmails()
  }, [token])

  const fetchAllEmails = async () => {
    setLoading(true)
    setError('')
    try {
      // Fetch inbox emails (received)
      const inboxResponse = await fetch(`/api/inbox`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const inboxData = await inboxResponse.json()

      if (inboxResponse.ok && inboxData.emails && inboxData.emails.length > 0) {
        setInboxEmails(inboxData.emails)
      } else {
        setInboxEmails([])
      }
    } catch (err) {
      setInboxEmails([])
      setError('Failed to load inbox emails')
    } finally {
      setLoading(false)
    }
  }

  // Determine email category based on content
  const getEmailCategory = (email: Email): 'primary' | 'promotions' | 'transactions' | 'social' => {
    const subject = (email.subject || '').toLowerCase()
    const body = (email.body || '').toLowerCase()
    const from = (email.from || '').toLowerCase()
    const combined = `${subject} ${body} ${from}`

    // Social keywords
    if (combined.includes('facebook') || combined.includes('twitter') || combined.includes('instagram') || combined.includes('linkedin') || combined.includes('youtube') || combined.includes('tiktok') || combined.includes('pinterest') || combined.includes('reddit') || combined.includes('telegram') || combined.includes('whatsapp') || combined.includes('snapchat') || combined.includes('social') || combined.includes('friend request') || combined.includes('follow') || combined.includes('comment') || combined.includes('like') || combined.includes('share')) {
      return 'social'
    }

    // Promotions keywords
    if (combined.includes('sale') || combined.includes('discount') || combined.includes('offer') || combined.includes('coupon') || combined.includes('promotion') || combined.includes('deal')) {
      return 'promotions'
    }

    // Transactions keywords
    if (combined.includes('order') || combined.includes('invoice') || combined.includes('receipt') || combined.includes('payment') || combined.includes('transaction') || combined.includes('purchase') || combined.includes('confirmation')) {
      return 'transactions'
    }

    // Default to primary
    return 'primary'
  }

  // Filter emails based on tab, search query and advanced filters
  const filteredEmails = inboxEmails.filter(email => {
    // Apply tab filter (skip if 'all' tab is selected)
    if (activeTab !== 'all') {
      const emailCategory = getEmailCategory(email)
      if (emailCategory !== activeTab) return false
    }

    // Apply search query filter
    if (localSearchQuery) {
      const query = localSearchQuery.toLowerCase()
      const matchesQuery = (
        (email.subject || '').toLowerCase().includes(query) ||
        (email.from || '').toLowerCase().includes(query) ||
        (email.to || '').toLowerCase().includes(query) ||
        (email.body || '').toLowerCase().includes(query)
      )
      if (!matchesQuery) return false
    }

    // Apply advanced filters
    if (searchFilters) {
      if (searchFilters.from && !(email.from || '').toLowerCase().includes(searchFilters.from.toLowerCase())) return false
      if (searchFilters.to && !(email.to || '').toLowerCase().includes(searchFilters.to.toLowerCase())) return false
      if (searchFilters.subject && !(email.subject || '').toLowerCase().includes(searchFilters.subject.toLowerCase())) return false
      if (searchFilters.keywords && !(email.body || '').toLowerCase().includes(searchFilters.keywords.toLowerCase())) return false

      if (searchFilters.readStatus !== 'all') {
        if (searchFilters.readStatus === 'read' && !email.isRead) return false
        if (searchFilters.readStatus === 'unread' && email.isRead) return false
      }

      if (searchFilters.dateFrom) {
        const emailDate = new Date(email.date)
        const filterDate = new Date(searchFilters.dateFrom)
        if (emailDate < filterDate) return false
      }

      if (searchFilters.dateTo) {
        const emailDate = new Date(email.date)
        const filterDate = new Date(searchFilters.dateTo)
        if (emailDate > filterDate) return false
      }
    }

    return true
  })

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
        setInboxEmails(inboxEmails.map(email =>
          email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
        ))
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }


  return (
    <div className="email-container">
      <div className="mail-search-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search mail..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
          />
          <button
            className="search-options-btn"
            onClick={() => setShowSearchOptions(!showSearchOptions)}
            title="Advanced search options"
          >
            &#9776;
          </button>
        </div>
      </div>

      <div className="email-tabs">
        <button
          className={`email-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All
        </button>
        <button
          className={`email-tab-btn ${activeTab === 'primary' ? 'active' : ''}`}
          onClick={() => setActiveTab('primary')}
        >
          Primary
        </button>
        <button
          className={`email-tab-btn ${activeTab === 'promotions' ? 'active' : ''}`}
          onClick={() => setActiveTab('promotions')}
        >
          Promotions
        </button>
        <button
          className={`email-tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions
        </button>
        <button
          className={`email-tab-btn ${activeTab === 'social' ? 'active' : ''}`}
          onClick={() => setActiveTab('social')}
        >
          Social
        </button>
      </div>

      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading emails...</div>}

      {filteredEmails.length > 0 && (
        <div className="email-list">
          {filteredEmails.map((email, idx) => (
            <div
              key={idx}
              className={`email-item ${!email.isRead ? 'unread' : ''}`}
              onClick={() => onViewEmail(email)}
            >
              <input type="checkbox" className="email-checkbox" />
              <button
                className={`email-star-btn ${email.isStarred ? 'active' : ''}`}
                onClick={(e) => handleToggleStar(email.id, e)}
                title={email.isStarred ? 'Remove star' : 'Add star'}
              >
                <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
              </button>
              <div className="email-content">
                <div className="email-header">
                  <span className="email-from"><span style={{fontWeight:600,color:email.isRead?'#111':'#0288d1'}}>{(email.from||'').split('@')[0]}</span>{(email.from||'').includes('@')&&<span style={{fontWeight:300,color:email.isRead?'#555':'#0288d1'}}>@{(email.from||'').split('@')[1]}</span>}</span>
                  <strong className="email-subject" style={{ color: (!email.subject || email.subject === '(No subject)') ? '#888' : 'inherit', position: 'relative' }}>
                    {(() => { const s = (email.subject || '').toLowerCase().trim(); if (s.startsWith('re:')) return <span className="reply-status-icon"><Reply size={14} /></span>; if (s.startsWith('fwd:') || s.startsWith('fw:')) return <span className="reply-status-icon"><Forward size={14} /></span>; return null; })()}
                    {(!!email.hasAttachments || /data-file-card/i.test(email.body || '')) && <Paperclip size={13} style={{ color: '#888', flexShrink: 0, marginRight: '2px', verticalAlign: 'middle' }} />}
                    <span>{(() => { const raw = email.subject || ''; const low = raw.toLowerCase().trim(); if (low.startsWith('re:') || low.startsWith('fwd:') || low.startsWith('fw:')) return raw.slice(raw.indexOf(':') + 1).trim() || '(No subject)'; return raw || '(No subject)'; })()}</span>
                  </strong>
                  {(() => { const p = bodyPreview(email.body, email.hasAttachments); return p ? <span className="email-preview"> - {p}</span> : null; })()}
                </div>
                {(() => { const html = extractFileCardsHtml(email.body || ''); if (!html) return null; return <div style={{ display:'flex', flexDirection:'row', flexWrap:'nowrap', overflow:'hidden', alignItems:'center', gap:'6px', marginTop:'4px', lineHeight:0 }} dangerouslySetInnerHTML={{ __html: html }} /> })()}
              </div>
              <button className={`email-canvas-btn${/data-canvas-(draft|saved)/.test(email.body||'')?' active':''}`} style={{ background:'none', border:'none', cursor:'default', padding:'0', boxSizing:'border-box', color:/data-canvas-(draft|saved)/.test(email.body||'')?'#7c4dff':'#ccc', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0, height:'40px', width:'40px' }} title="Canvas board"><PenLine size={40} /></button>
              <span className="email-date" style={{ color: email.folder === 'sent' ? '#222' : email.folder === 'drafts' ? '#ff5722' : !email.isRead ? '#0288d1' : '#666', fontWeight: 700, fontSize: '13px' }}>{new Date(email.date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {filteredEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>{localSearchQuery ? 'No emails match your search' : 'No inbox emails yet'}</p>
        </div>
      )}
    </div>
  )
}
