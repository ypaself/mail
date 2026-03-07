import { useEffect, useState } from 'react'
import { Star, Search } from 'lucide-react'

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

  useEffect(() => {
    fetchAllEmails()
  }, [token])

  const fetchAllEmails = async () => {
    setLoading(true)
    setError('')
    try {
      // Fetch inbox emails (received)
      const inboxResponse = await fetch('http://localhost:5050/api/inbox', {
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

  // Filter emails based on search query and advanced filters
  const filteredEmails = inboxEmails.filter(email => {
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
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/star`, {
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

      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading emails...</div>}

      {filteredEmails.length > 0 && (
        <div className="email-list">
          {filteredEmails.map((email, idx) => (
            <div
              key={idx}
              className="email-item"
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
                  <strong className="email-from">{email.from}</strong>
                  <strong className="email-subject">{email.subject}</strong>
                  <span className="email-preview"> - {email.body.substring(0, 60)}...</span>
                </div>
              </div>
              <span className="email-date">{new Date(email.date).toLocaleDateString()}</span>
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
