import { useEffect, useState, useRef } from 'react'
import { Star, Archive, Trash2, MailOpen, Clock, Move, Mail, ChevronDown, RefreshCw, ChevronLeft, ChevronRight, Plus, AlertOctagon, Printer, Reply, Forward, Flag } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'

interface Email {
  id: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  folder?: string
  isRead?: boolean
  isSnoozed?: boolean
  snoozedUntil?: string
  isImportant?: boolean
  isSpam?: boolean
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

interface AllMailsPageProps {
  token: string
  onViewEmail: (email: Email) => void
  type?: 'inbox' | 'sent' | 'starred' | 'snoozed' | 'drafts' | 'archived' | 'purchased' | 'all' | 'scheduled' | 'important' | 'spam' | 'trash' | 'subscriptions' | 'label'
  searchQuery?: string
  searchFilters?: SearchFilters
  onSearch?: (query: string) => void
}

export default function AllMailsPage({ token, onViewEmail, type = 'all', searchQuery = '', searchFilters, onSearch }: AllMailsPageProps) {
  const [allEmails, setAllEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedEmails, setSelectedEmails] = useState<Set<number>>(new Set())
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalEmails, setTotalEmails] = useState(0)
  const [jumpToPageInput, setJumpToPageInput] = useState(String(page))
  const [labelSearchQuery, setLabelSearchQuery] = useState('')
  const [labels, setLabels] = useState<any[]>([])
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; email: Email } | null>(null)
  const [customSnoozeDate, setCustomSnoozeDate] = useState('')
  const [moveMenuOpen, setMoveMenuOpen] = useState<number | null>(null)
  const [selectAllAcrossPages, setSelectAllAcrossPages] = useState(false)
  const [toast, setToast] = useState<{ message: string; onUndo?: () => void } | null>(null)
  const [checkboxDropdownOpen, setCheckboxDropdownOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'primary' | 'promotions' | 'transactions' | 'social'>('all')
  const [activeTrashTab, setActiveTrashTab] = useState<'trash' | 'received' | 'sent'>('trash')
  const { labelName } = useParams()
  const mainCheckboxRef = useRef<HTMLInputElement>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    setPage(1)
    setFocusedIndex(-1)
  }, [type, labelName])

  useEffect(() => {
    fetchAllMails()
  }, [token, type, labelName, page, pageSize]);

  useEffect(() => {
    setJumpToPageInput(String(page));
  }, [page]);

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const response = await fetch('http://localhost:5050/api/custom-labels', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) {
          const data = await response.json()
          setLabels(data.labels)
        }
      } catch (err) {
        console.error('Failed to fetch labels:', err)
      }
    }
    fetchLabels()
  }, [token])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const isClickInsideDropdown = target.closest('.checkbox-dropdown')
      if (!isClickInsideDropdown) {
        setCheckboxDropdownOpen(false)
      }
      setMoveMenuOpen(null)
      setSnoozeMenuOpen(null)
      setContextMenu(null)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

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

  // Filter emails based on search query and advanced filters
  const filteredEmails = allEmails.filter(email => {
    // Apply tab filter only for inbox type (skip if 'all' tab is selected)
    if (type === 'inbox' && activeTab !== 'all') {
      const emailCategory = getEmailCategory(email)
      if (emailCategory !== activeTab) return false
    }

    // Apply tab filter for trash type
    if (type === 'trash') {
      if (activeTrashTab === 'received' && email.folder !== 'inbox') return false
      if (activeTrashTab === 'sent' && email.folder !== 'sent') return false
      // 'trash' tab shows all deleted emails
    }

    // Hide sent, drafts, and scheduled emails in All Mails view
    if (type === 'all' && ['sent', 'drafts', 'scheduled'].includes(email.folder || '')) {
      return false
    }

    // Apply search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return

      if (e.key.toLowerCase() === 'l' && selectedEmails.size === 1) {
        const emailId = Array.from(selectedEmails)[0]
        e.preventDefault()
        setLabelSearchQuery('')
        setMoveMenuOpen(prev => (prev === emailId ? null : emailId))
        setContextMenu(null)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex(prev => (prev < filteredEmails.length - 1 ? prev + 1 : prev))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedEmails, filteredEmails])

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0) {
      const el = document.getElementById(`email-item-${focusedIndex}`)
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [focusedIndex])

  const flattenLabels = (labels: any[], prefix = ''): any[] => {
    return labels.flatMap(label => [
      { id: label.id, name: prefix ? `${prefix} / ${label.name}` : label.name, color: label.color },
      ...(label.children ? flattenLabels(label.children, prefix ? `${prefix} / ${label.name}` : label.name) : [])
    ])
  }

  useEffect(() => {
    if (mainCheckboxRef.current) {
      const numSelected = selectedEmails.size;
      const numEmails = filteredEmails.length;
      mainCheckboxRef.current.indeterminate = numSelected > 0 && numSelected < numEmails;
    }
  }, [selectedEmails, filteredEmails]);

  const showToast = (message: string, onUndo?: () => void) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    setToast({ message, onUndo })
    // Show for 5 seconds to give time to undo
    toastTimeoutRef.current = setTimeout(() => setToast(null), 5000)
  }

  const fetchAllMails = async () => {
    setSelectedEmails(new Set())
    setSelectAllAcrossPages(false)
    setLoading(true)
    setError('')
    try {
      let url = 'http://localhost:5050/api/allmails'
      
      switch (type) {
        case 'inbox': url = 'http://localhost:5050/api/inbox'; break;
        case 'sent': url = 'http://localhost:5050/api/sent'; break;
        case 'starred': url = 'http://localhost:5050/api/starred'; break;
        case 'snoozed': url = 'http://localhost:5050/api/snoozed'; break;
        case 'drafts': url = 'http://localhost:5050/api/drafts'; break;
        case 'archived': url = 'http://localhost:5050/api/archived'; break;
        case 'purchased': url = 'http://localhost:5050/api/purchased'; break;
        case 'scheduled': url = 'http://localhost:5050/api/scheduled'; break;
        case 'important': url = 'http://localhost:5050/api/important'; break;
        case 'spam': url = 'http://localhost:5050/api/spam'; break;
        case 'trash': url = 'http://localhost:5050/api/trash'; break;
        case 'subscriptions': url = 'http://localhost:5050/api/subscriptions'; break;
        case 'label': 
          if (labelName) url = `http://localhost:5050/api/labels/${encodeURIComponent(labelName)}`;
          break;
      }

      const separator = url.includes('?') ? '&' : '?'
      const finalUrl = `${url}${separator}page=${page}&limit=${pageSize}`
      const response = await fetch(finalUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      console.log(`Fetched ${type} emails:`, { response: response.ok, emailCount: data.emails?.length, total: data.total, data })

      if (response.ok && data.emails && data.emails.length > 0) {
        console.log(`Setting ${data.emails.length} emails for ${type}`)
        setAllEmails(data.emails)
        setTotalEmails(data.total || 0)
      } else if (response.ok) {
        // API returned success but no emails
        setAllEmails([])
        setTotalEmails(data.total || 0)
        console.log(`No emails found for type: ${type} - Data:`, data)
      } else {
        setAllEmails([])
        setTotalEmails(0)
        setError(`Failed to load ${type} emails: ${response.statusText}`)
        console.error(`API error for ${type}:`, response.status, data)
      }
    } catch (err) {
      setAllEmails([])
      setTotalEmails(0)
      setError(`Failed to load emails: ${err instanceof Error ? err.message : 'Unknown error'}`)
      console.error(`Fetch error for ${type}:`, err)
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
        setAllEmails(allEmails.map(email =>
          email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
        ))
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  const handleArchive = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/archive`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Remove the archived email from the list
        setAllEmails(allEmails.filter(email => email.id !== emailId))

        const undo = async () => {
          await fetch(`http://localhost:5050/api/emails/${emailId}/archive`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
          })
          fetchAllMails()
          setToast(null)
        }
        showToast(type === 'archived' ? 'Conversation moved to Inbox' : 'Conversation archived', undo)
      }
    } catch (err) {
      console.error('Failed to archive email:', err)
    }
  }

  const handleDelete = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/delete`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        setAllEmails(allEmails.filter(email => email.id !== emailId))

        const undo = async () => {
          await fetch(`http://localhost:5050/api/emails/${emailId}/delete`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
          })
          fetchAllMails()
          setToast(null)
        }
        showToast(type === 'trash' ? 'Conversation restored' : 'Conversation moved to Trash', undo)
      }
    } catch (err) {
      console.error('Failed to delete email:', err)
    }
  }

  const handleToggleRead = async (emailId: number | undefined, isRead: boolean | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    if (emailId === undefined || isRead === undefined) return;

    const newReadStatus = !isRead;

    try {
        const response = await fetch(`http://localhost:5050/api/emails/${emailId}/read`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ is_read: newReadStatus }),
        });

        if (response.ok) {
            setAllEmails(allEmails.map(email =>
                email.id === emailId ? { ...email, isRead: newReadStatus } : email
            ));
        }
    } catch (err) {
        console.error('Failed to toggle read status:', err);
    }
  };

  const handleBulkAction = async (action: 'archive' | 'delete' | 'read', value?: boolean) => {
    const ids = Array.from(selectedEmails).filter((id): id is number => id !== undefined);
    if (ids.length === 0) return;

    try {
      if (action === 'read') {
        await fetch('http://localhost:5050/api/emails/batch', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ids, action: 'read', value }),
        });
        setAllEmails(allEmails.map(email =>
          selectedEmails.has(email.id) ? { ...email, isRead: value } : email
        ));
      } else if (action === 'archive') {
        await Promise.all(ids.map(id =>
          fetch(`http://localhost:5050/api/emails/${id}/archive`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
          })
        ));
        setAllEmails(allEmails.filter(email => !selectedEmails.has(email.id)));
        showToast(`${ids.length} conversation(s) archived`, undefined);
      } else if (action === 'delete') {
        await Promise.all(ids.map(id =>
          fetch(`http://localhost:5050/api/emails/${id}/delete`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
          })
        ));
        setAllEmails(allEmails.filter(email => !selectedEmails.has(email.id)));
        showToast(`${ids.length} conversation(s) moved to Trash`, undefined);
      }
      setSelectedEmails(new Set());
    } catch (err) {
      console.error('Failed to bulk action:', err);
    }
  };

  const handleSnoozeClick = (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return
    setSnoozeMenuOpen(snoozeMenuOpen === emailId ? null : emailId)
    setMoveMenuOpen(null)
    setCustomSnoozeDate('')
    setContextMenu(null)
  }

  const handleSnoozeConfirm = async (emailId: number, hours: number) => {
    setSnoozeMenuOpen(null)

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/snooze`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hours }),
      });

      if (response.ok) {
        // If in inbox, remove it from view as it's snoozed
        if (type === 'inbox') {
          setAllEmails(allEmails.filter(email => email.id !== emailId));
        } else {
          setAllEmails(allEmails.map(email => email.id === emailId ? { ...email, isSnoozed: true } : email));
        }

        const undo = async () => {
          await fetch(`http://localhost:5050/api/emails/${emailId}/snooze`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ hours: 0 }),
          });
          fetchAllMails()
          setToast(null)
        }
        showToast('Conversation snoozed', undo)
      }
    } catch (err) {
      console.error('Failed to snooze email:', err);
    }
  }

  const handleToggleImportant = async (emailId: number | undefined, isImportant: boolean | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/important`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        setAllEmails(allEmails.map(email =>
          email.id === emailId ? { ...email, isImportant: !isImportant } : email
        ))
        const undo = async () => {
          await fetch(`http://localhost:5050/api/emails/${emailId}/important`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
          })
          fetchAllMails()
          setToast(null)
        }
        showToast(isImportant ? 'Marked as not important' : 'Marked as important', undo)
      }
    } catch (err) {
      console.error('Failed to toggle important:', err)
    }
  }

  const handleToggleSpam = async (emailId: number | undefined, isSpam: boolean | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/spam`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        if (type === 'spam' || type === 'inbox') {
          setAllEmails(allEmails.filter(email => email.id !== emailId))
        } else {
          setAllEmails(allEmails.map(email =>
            email.id === emailId ? { ...email, isSpam: !isSpam } : email
          ))
        }

        const undo = async () => {
          await fetch(`http://localhost:5050/api/emails/${emailId}/spam`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
          })
          fetchAllMails()
          setToast(null)
        }
        showToast(isSpam ? 'Conversation unmarked as spam' : 'Conversation marked as spam', undo)
      }
    } catch (err) {
      console.error('Failed to toggle spam:', err)
    }
  }

  const handleCustomSnooze = (emailId: number, dateString: string) => {
    if (!dateString) return
    const date = new Date(dateString)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const hours = diff / (1000 * 60 * 60)
    
    if (hours > 0) {
      handleSnoozeConfirm(emailId, hours)
    } else {
      alert('Please select a future time')
    }
  }

  const handleMoveClick = (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return
    if (moveMenuOpen !== emailId) {
      setLabelSearchQuery('')
    }
    setMoveMenuOpen(moveMenuOpen === emailId ? null : emailId)
    setSnoozeMenuOpen(null)
    setContextMenu(null)
  }

  const handleApplyLabel = async (emailId: number, targetLabel: string) => {
    setMoveMenuOpen(null)

    try {
      await fetch(`http://localhost:5050/api/emails/${emailId}/label`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label_name: targetLabel }),
      })
      fetchAllMails() // Refresh list to show updated label

      const undoLabel = (type === 'label' && labelName) ? decodeURIComponent(labelName) : null;
      const undo = async () => {
        await fetch(`http://localhost:5050/api/emails/${emailId}/label`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ label_name: undoLabel }),
        })
        fetchAllMails()
        setToast(null)
      }
      showToast(`Label "${targetLabel}" applied`, undo)
    } catch (err) {
      console.error('Failed to move email:', err)
    }
  }

  const handleSelectEmail = (emailId: number) => {
    const newSelection = new Set(selectedEmails);
    if (newSelection.has(emailId)) {
      newSelection.delete(emailId);
    } else {
      newSelection.add(emailId);
    }
    setSelectedEmails(newSelection);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const allEmailIds = new Set(filteredEmails.map(email => email.id));
      setSelectedEmails(allEmailIds);
      setSelectAllAcrossPages(false);
    } else {
      setSelectedEmails(new Set());
      setSelectAllAcrossPages(false);
    }
  };

  const handleDropdownSelect = (selectionType: string) => {
    setCheckboxDropdownOpen(false);
    switch (selectionType) {
      case 'all':
        setSelectedEmails(new Set(allEmails.map(email => email.id)));
        setSelectAllAcrossPages(false);
        break;
      case 'none':
        setSelectedEmails(new Set());
        setSelectAllAcrossPages(false);
        break;
      case 'read':
        setSelectedEmails(new Set(allEmails.filter(e => e.isRead).map(e => e.id)));
        setSelectAllAcrossPages(false);
        break;
      case 'unread':
        setSelectedEmails(new Set(allEmails.filter(e => !e.isRead).map(e => e.id)));
        setSelectAllAcrossPages(false);
        break;
      case 'starred':
        setSelectedEmails(new Set(allEmails.filter(e => e.isStarred).map(e => e.id)));
        setSelectAllAcrossPages(false);
        break;
      case 'unstarred':
        setSelectedEmails(new Set(allEmails.filter(e => !e.isStarred).map(e => e.id)));
        setSelectAllAcrossPages(false);
        break;
      default:
        break;
    }
  };

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpToPageInput, 10);
    if (!isNaN(pageNum) && pageNum > 0) {
      setPage(pageNum);
    } else {
      // Reset input to current page if invalid
      setJumpToPageInput(String(page));
    }
  };

  const handleContextMenu = (e: React.MouseEvent, email: Email) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, email })
    setMoveMenuOpen(null)
    setSnoozeMenuOpen(null)
  }

  const handleContextAction = (action: 'reply' | 'forward' | 'print') => {
    if (!contextMenu) return
    
    if (action === 'print') {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Print Email</title>
              <style>
                body { font-family: sans-serif; padding: 20px; }
                .header { border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 20px; }
                .meta { color: #666; margin-bottom: 5px; }
              </style>
            </head>
            <body>
              <div class="header">
                <h2>${contextMenu.email.subject}</h2>
                <div class="meta">From: ${contextMenu.email.from}</div>
                <div class="meta">To: ${contextMenu.email.to}</div>
                <div class="meta">Date: ${new Date(contextMenu.email.date).toLocaleString()}</div>
              </div>
              <div class="body">${contextMenu.email.body.replace(/\n/g, '<br>')}</div>
              <script>window.print();</script>
            </body>
          </html>
        `)
        printWindow.document.close()
      }
    } else {
      let replyTo = contextMenu.email.from
      if (type === 'sent' || contextMenu.email.folder === 'sent') {
        replyTo = contextMenu.email.to
      }
      navigate('/compose', { state: { action, email: contextMenu.email, replyTo: action === 'reply' ? replyTo : undefined } })
    }
    setContextMenu(null)
  }

  const handleSelectAllAcross = () => {
    setSelectAllAcrossPages(true)
  }

  const handleClearSelection = () => {
    setSelectAllAcrossPages(false)
    setSelectedEmails(new Set())
  }

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'))

    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} style={{ backgroundColor: '#fff59d', color: '#000' }}>{part}</span>
          ) : (
            part
          )
        )}
      </>
    )
  }

  return (
    <div className="email-container">
      <div className="mail-header">
        {selectedEmails.size > 0 ? (
          <div className="mail-header-actions">
            <div className="checkbox-dropdown">
              <input type="checkbox" className="mail-checkbox" ref={mainCheckboxRef} checked={true} onChange={handleSelectAll} />
              <button className="checkbox-dropdown-btn" onClick={(e) => { e.stopPropagation(); setCheckboxDropdownOpen(!checkboxDropdownOpen); }}>
                <ChevronDown size={16} />
              </button>
              {checkboxDropdownOpen && (
                <div className="checkbox-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                  <button className="dropdown-option" onClick={() => handleDropdownSelect('all')}>All</button>
                  <button className="dropdown-option" onClick={() => handleDropdownSelect('none')}>None</button>
                </div>
              )}
            </div>
            <button className="action-btn" onClick={() => handleBulkAction('archive')} title="Archive">
              <Archive size={18} />
            </button>
            <button className="action-btn" onClick={() => handleBulkAction('delete')} title="Delete">
              <Trash2 size={18} />
            </button>
            {type !== 'sent' && type !== 'drafts' && (
              <>
                <button className="action-btn" onClick={() => handleBulkAction('read', true)} title="Mark as read">
                  <MailOpen size={18} />
                </button>
                <button className="action-btn" onClick={() => handleBulkAction('read', false)} title="Mark as unread">
                  <Mail size={18} />
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="mail-header-controls">
            <div className="checkbox-dropdown">
              <input type="checkbox" className="mail-checkbox" ref={mainCheckboxRef} checked={filteredEmails.length > 0 && selectedEmails.size === filteredEmails.length} onChange={handleSelectAll} />
              <button className="checkbox-dropdown-btn" onClick={(e) => { e.stopPropagation(); setCheckboxDropdownOpen(!checkboxDropdownOpen); }} title="Filter options">
                <ChevronDown size={16} />
              </button>
              {checkboxDropdownOpen && (
                <div className="checkbox-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                  <button className="dropdown-option" onClick={() => handleDropdownSelect('all')}>All</button>
                  <button className="dropdown-option" onClick={() => handleDropdownSelect('none')}>None</button>
                  {type !== 'sent' && type !== 'drafts' && (
                    <>
                      <button className="dropdown-option" onClick={() => handleDropdownSelect('read')}>Read</button>
                      <button className="dropdown-option" onClick={() => handleDropdownSelect('unread')}>Unread</button>
                    </>
                  )}
                  <button className="dropdown-option" onClick={() => handleDropdownSelect('starred')}>Starred</button>
                  <button className="dropdown-option" onClick={() => handleDropdownSelect('unstarred')}>Unstarred</button>
                </div>
              )}
            </div>
            <button className="mail-refresh-btn" title="Refresh" onClick={fetchAllMails}>
              <RefreshCw size={18} />
            </button>
          </div>
        )}
        <div className="header-pagination">
          <span className="header-page-info">
            {totalEmails > 0 ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalEmails)} of ${totalEmails}` : '0-0 of 0'}
          </span>
          <button 
            className="header-pagination-btn" 
            disabled={page === 1 || loading} 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            title="Newer"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            className="header-pagination-btn" 
            disabled={allEmails.length < pageSize || loading} 
            onClick={() => setPage(p => p + 1)}
            title="Older"
          >
            <ChevronRight size={18} />
          </button>
          <select
            className="page-size-select"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1) // Reset to first page
            }}
            title="Emails per page"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <form onSubmit={handleJumpToPage} className="jump-to-page-form">
            <input
              type="number"
              className="jump-to-page-input"
              value={jumpToPageInput}
              onChange={(e) => setJumpToPageInput(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              min="1"
            />
            <button type="submit" className="jump-to-page-btn" onClick={(e) => e.stopPropagation()}>Go</button>
          </form>
        </div>
      </div>

      {type === 'inbox' && (
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
      )}

      {type === 'trash' && (
        <div className="email-tabs">
          <button
            className={`email-tab-btn ${activeTrashTab === 'trash' ? 'active' : ''}`}
            onClick={() => setActiveTrashTab('trash')}
          >
            All
          </button>
          <button
            className={`email-tab-btn ${activeTrashTab === 'received' ? 'active' : ''}`}
            onClick={() => setActiveTrashTab('received')}
          >
            Received
          </button>
          <button
            className={`email-tab-btn ${activeTrashTab === 'sent' ? 'active' : ''}`}
            onClick={() => setActiveTrashTab('sent')}
          >
            Sent
          </button>
        </div>
      )}

      {selectedEmails.size === filteredEmails.length && filteredEmails.length > 0 && (
        <div className="select-all-banner">
          {!selectAllAcrossPages ? (
            <span>
              All {filteredEmails.length} conversations on this page are selected.
              <button className="link-btn" onClick={handleSelectAllAcross}>
                Select all {totalEmails} conversations in {type}
              </button>
            </span>
          ) : (
            <span>
              All {totalEmails} conversations in {type} are selected.
              <button className="link-btn" onClick={handleClearSelection}>
                Clear selection
              </button>
            </span>
          )}
        </div>
      )}

      {error && <div className="message error">{error}</div>}

      {loading && <div className="loading">Loading all mails...</div>}

      {filteredEmails.length > 0 && (
        <div className="email-list">
          {filteredEmails.map((email, idx) => (
            <div
              key={idx}
              id={`email-item-${idx}`}
              className={`email-item ${!email.isRead ? 'unread' : ''} ${selectedEmails.has(email.id) ? 'selected' : ''} ${focusedIndex === idx ? 'focused' : ''}`}
              onClick={async () => {
                if (!email.isRead && type !== 'sent' && type !== 'drafts' && email.id !== undefined) {
                  try {
                    await fetch(`http://localhost:5050/api/emails/${email.id}/read`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ is_read: true }),
                    });
                    setAllEmails(allEmails.map(e => e.id === email.id ? { ...e, isRead: true } : e));
                  } catch (_) {}
                }
                onViewEmail(email);
              }}
              onContextMenu={(e) => handleContextMenu(e, email)}
            >
              <div className="checkbox-wrapper">
                {!email.isRead && (
                  <div className="unread-indicator"></div>
                )}
                <input
                  type="checkbox"
                  className="email-checkbox"
                  checked={selectedEmails.has(email.id)}
                  onChange={() => handleSelectEmail(email.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <button
                className={`star-btn ${email.isStarred ? 'active' : ''}`}
                onClick={(e) => handleToggleStar(email.id, e)}
                title={email.isStarred ? 'Remove star' : 'Add star'}
              >
                <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
              </button>
              <div className="email-from">
                {email.folder === 'sent' || type === 'drafts' || type === 'sent'
                  ? <>To: {highlightText(email.to, searchQuery)}</>
                  : highlightText(email.from, searchQuery)}
              </div>
              <div className="email-subject">
                {highlightText(email.subject, searchQuery)}
                <span className="email-preview"> - {highlightText(email.body.substring(0, 100), searchQuery)}...</span>
              </div>
              <div className="email-hover-actions">
                <button className="action-btn" onClick={(e) => handleArchive(email.id, e)} title={type === 'archived' ? "Unarchive" : "Archive"}>
                  <Archive size={18} />
                </button>
                <button className="action-btn" onClick={(e) => handleDelete(email.id, e)} title={type === 'trash' ? "Restore" : "Delete"}>
                  <Trash2 size={18} />
                </button>
                {type !== 'sent' && type !== 'drafts' && (
                  <button className="action-btn" onClick={(e) => handleToggleRead(email.id, email.isRead, e)} title={email.isRead ? "Mark as unread" : "Mark as read"}>
                    {email.isRead ? <Mail size={18} /> : <MailOpen size={18} />}
                  </button>
                )}
                <button className="action-btn" onClick={(e) => handleToggleImportant(email.id, email.isImportant, e)} title={email.isImportant ? "Mark as not important" : "Mark as important"}>
                  <Flag size={18} fill={email.isImportant ? 'currentColor' : 'none'} color={email.isImportant ? '#f4b400' : 'currentColor'} />
                </button>
                <button className="action-btn" onClick={(e) => handleToggleSpam(email.id, email.isSpam, e)} title={email.isSpam ? "Not spam" : "Mark as spam"}>
                  <AlertOctagon size={18} />
                </button>
                <div style={{ position: 'relative' }}>
                  <button className="action-btn" onClick={(e) => handleSnoozeClick(email.id, e)} title="Snooze">
                    <Clock size={18} />
                  </button>
                  {snoozeMenuOpen === email.id && (
                    <div className="snooze-dropdown" onClick={(e) => e.stopPropagation()}>
                      <button className="dropdown-option" onClick={() => handleSnoozeConfirm(email.id, 4)}>Later today (4 hours)</button>
                      <button className="dropdown-option" onClick={() => handleSnoozeConfirm(email.id, 24)}>Tomorrow</button>
                      <button className="dropdown-option" onClick={() => handleSnoozeConfirm(email.id, 168)}>Next week</button>
                      <div className="snooze-separator"></div>
                      <div className="snooze-custom-wrapper">
                        <label>Pick date & time</label>
                        <input
                          type="datetime-local"
                          className="snooze-date-input"
                          onClick={(e) => e.stopPropagation()}
                          min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                          value={customSnoozeDate}
                          onChange={(e) => setCustomSnoozeDate(e.target.value)}
                        />
                        <button
                          className="snooze-save-btn"
                          onClick={(e) => { e.stopPropagation(); handleCustomSnooze(email.id, customSnoozeDate); }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <button className="action-btn" onClick={(e) => handleMoveClick(email.id, e)} title="Move to">
                    <Move size={18} />
                  </button>
                  {moveMenuOpen === email.id && (
                    <div className="move-to-dropdown" onClick={(e) => e.stopPropagation()}>
                      <div style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                        <input
                          type="text"
                          className="label-search-input"
                          placeholder="Search labels..."
                          value={labelSearchQuery}
                          onChange={(e) => setLabelSearchQuery(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      </div>
                      <div className="dropdown-scroll-area">
                        {flattenLabels(labels).filter(l => l.name.toLowerCase().includes(labelSearchQuery.toLowerCase())).length > 0 ? (
                          flattenLabels(labels)
                            .filter(l => l.name.toLowerCase().includes(labelSearchQuery.toLowerCase()))
                            .map(label => (
                            <button
                              key={label.id}
                              className="dropdown-option"
                              onClick={() => handleApplyLabel(email.id, label.name)}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: label.color, display: 'inline-block', flexShrink: 0 }}></span>
                              {label.name}
                            </button>
                          ))
                        ) : (
                          <div className="dropdown-option" style={{ cursor: 'default', color: '#999' }}>No labels found</div>
                        )}
                      </div>
                      <div style={{ height: '1px', backgroundColor: '#eee', margin: '4px 0' }}></div>
                      <button
                        className="dropdown-option"
                        onClick={() => {
                          setMoveMenuOpen(null);
                          navigate('/create-label');
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#667eea' }}
                      >
                        <Plus size={14} />
                        Create new label
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', marginRight: '1px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <div className="email-date" style={{ color: email.isRead ? '#666' : '#333', fontWeight: email.isRead ? 'normal' : 'bold' }}>
                  {email.isSnoozed && email.snoozedUntil ? (
                    <span className="snoozed-until">
                      {(() => {
                        const snoozedDate = new Date(email.snoozedUntil);
                        const currentYear = new Date().getFullYear();
                        const snoozedYear = snoozedDate.getFullYear();
                        const time = snoozedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        if (currentYear === snoozedYear) {
                          const day = snoozedDate.getDate();
                          const month = snoozedDate.toLocaleString('default', { month: 'short' });
                          return `${day} ${month} ${time}`;
                        } else {
                          const day = snoozedDate.getDate();
                          const month = snoozedDate.toLocaleString('default', { month: 'short' });
                          const year = snoozedDate.getFullYear();
                          return `${day} ${month} ${year} ${time}`;
                        }
                      })()}
                    </span>
                  ) : (
                    (() => {
                      const emailDate = new Date(email.date);
                      const currentYear = new Date().getFullYear();
                      const emailYear = emailDate.getFullYear();
                      const day = emailDate.getDate();
                      const month = emailDate.toLocaleString('default', { month: 'short' });

                      if (currentYear === emailYear) {
                        return `${day} ${month}`;
                      } else {
                        return `${day} ${month} ${emailYear}`;
                      }
                    })()
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredEmails.length === 0 && !loading && (
        <div className="empty-state">
          <p>No mails</p>
        </div>
      )}

      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button className="context-menu-item" onClick={() => handleContextAction('reply')}>
            <Reply size={16} /> Reply
          </button>
          <button className="context-menu-item" onClick={() => handleContextAction('forward')}>
            <Forward size={16} /> Forward
          </button>
          <div style={{ height: '1px', backgroundColor: '#eee', margin: '4px 0' }}></div>
          <button className="context-menu-item" onClick={() => handleContextAction('print')}>
            <Printer size={16} /> Print
          </button>
        </div>
      )}

      {toast && (
        <div className="toast-notification">
          <span>{toast.message}</span>
          {toast.onUndo && (
            <button className="toast-undo-btn" onClick={toast.onUndo}>
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
