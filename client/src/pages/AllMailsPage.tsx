import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Star, StarOff, Archive, ArchiveRestore, Trash2, MailOpen, Check, Clock, AlarmClock, AlarmClockOff, Calendar, Mail, ChevronDown, ChevronLeft, ChevronRight, Plus, AlertOctagon, Printer, Reply, Forward, Send, Edit, Inbox, CreditCard, Heart, Share2, Zap, MoreVertical, VolumeX, CheckSquare, FolderInput, Square, Tag, Folder, FolderOpen, RotateCcw, Flag, FlagOff, Bell, FileText, Paperclip, BarChart2, X, PenLine, RefreshCw, UserMinus, EyeOff, ShieldCheck, Pin, PinOff, Ban, BookOpen, X as XIcon } from 'lucide-react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import ColorPicker from '../components/ColorPicker'

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
    const all = Array.from(doc.querySelectorAll('[data-file-card]'))
    if (!all.length) return ''
    return all.map(card => {
      card.querySelectorAll('[data-remove-file], [data-upload-overlay], [data-folder-progress]').forEach(el => el.remove())
      card.removeAttribute('contenteditable')
      return card.outerHTML
    }).join('')
  } catch { return '' }
}

function FileCardsOverflowContainer({ html }: { html: string }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const lastW = useRef(-1)

  const cardHtmls = useMemo(() => {
    if (!html) return []
    try {
      const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
      return Array.from(doc.querySelectorAll('[data-file-card]')).map(el => el.outerHTML)
    } catch { return [] }
  }, [html])

  // Start with all cards visible so badge is hidden until first measurement
  const [visibleCount, setVisibleCount] = useState(Number.MAX_SAFE_INTEGER)

  const updateOverflow = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const outer = outerRef.current
      if (!outer) return
      const W = outer.offsetWidth
      if (W === 0 || W === lastW.current) return
      lastW.current = W
      const CARD_W = 120
      const GAP = 2
      const BADGE_W = 44
      const avail = W - BADGE_W - GAP
      const count = Math.max(0, Math.floor((avail + GAP) / (CARD_W + GAP)))
      setVisibleCount(prev => prev === count ? prev : count)
    })
  }, [])

  useEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    lastW.current = -1
    updateOverflow()
    const observer = new ResizeObserver(updateOverflow)
    observer.observe(outer)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      observer.disconnect()
    }
  }, [html, updateOverflow])

  const shown = Math.min(visibleCount, cardHtmls.length)
  const hidden = cardHtmls.length - shown

  return (
    <div ref={outerRef} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', width: '100%', minWidth: 0, overflow: 'hidden' }}>
      <Paperclip size={14} style={{ color: '#666', flexShrink: 0 }} />
      {cardHtmls.slice(0, shown).map((cardHtml, i) => (
        <div key={i} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: cardHtml }} />
      ))}
      {hidden > 0 && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', fontWeight: 700, color: '#666',
          background: '#e0e0e0', borderRadius: '50%',
          width: '38px', height: '38px', flexShrink: 0, whiteSpace: 'nowrap'
        }}>{shown > 0 ? `+${hidden}` : hidden}</span>
      )}
    </div>
  )
}

// Date range identifiers for grouping emails
const DATE_RANGES = {
  TOMORROW: 'Tomorrow',
  TODAY: 'Today',
  YESTERDAY: 'Yesterday',
  THIS_WEEK: 'This week',
  THIS_MONTH: 'This month',
  THIS_YEAR: 'This year',
  OLDER: 'Older'
} as const

// Define an exact custom sorting order/weight for each possible date range group.
// Lower numbers appear higher up in the list.
const CUSTOM_SORT_ORDER: Record<string, number> = {
  'Pinned': 0.5,
  [DATE_RANGES.TOMORROW]: 1,
  [DATE_RANGES.TODAY]: 2,
  [DATE_RANGES.YESTERDAY]: 3,
  [DATE_RANGES.THIS_WEEK]: 4,
  [DATE_RANGES.THIS_MONTH]: 5,
  [DATE_RANGES.THIS_YEAR]: 6,
  [DATE_RANGES.OLDER]: 9999,
  // Unlisted ranges (like 'YYYY-MM') will default to 1000 and be sorted descending by date
}

// Color palette for avatars (medium tone - slightly darker)
const AVATAR_COLORS = [
  '#1565c0', // Medium Blue
  '#c62828', // Medium Red
  '#2e7d32', // Medium Green
  '#e65100', // Medium Orange
  '#6a1b9a', // Medium Purple
  '#00695c', // Medium Teal
  '#ad1457', // Medium Pink
  '#00838f', // Medium Cyan
  '#558b2f', // Medium Lime
  '#5d4037', // Medium Brown
  '#37474f', // Medium Slate
  '#4527a0', // Medium Deep Purple
  '#c84315', // Medium Deep Orange
  '#00707b', // Medium Cyan Dark
  '#e64a19', // Medium Orange Red
]

// Helper function to mix hex colors
function mixColors(color1: string, color2: string, amount: number): string {
  const c1 = parseInt(color1.replace('#', ''), 16)
  const c2 = parseInt(color2.replace('#', ''), 16)

  const r1 = (c1 >> 16) & 255
  const g1 = (c1 >> 8) & 255
  const b1 = c1 & 255

  const r2 = (c2 >> 16) & 255
  const g2 = (c2 >> 8) & 255
  const b2 = c2 & 255

  const r = Math.round(r1 * (1 - amount) + r2 * amount)
  const g = Math.round(g1 * (1 - amount) + g2 * amount)
  const b = Math.round(b1 * (1 - amount) + b2 * amount)

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// Helper function to generate consistent color from email
function getAvatarColor(email: string): string {
  if (!email) return '#cccccc'
  // Extract just the email address
  let emailAddress = email
  const bracketMatch = email.match(/<([^>]+)>/)
  if (bracketMatch) {
    emailAddress = bracketMatch[1]
  }

  // Simple hash function to generate a number from email
  let hash = 0
  for (let i = 0; i < emailAddress.length; i++) {
    const char = emailAddress.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }

  // Use absolute value and modulo to get color index
  const colorIndex = Math.abs(hash) % AVATAR_COLORS.length
  const baseColor = AVATAR_COLORS[colorIndex]

  // Mix with bright gray (40% blend)
  return mixColors(baseColor, '#e8e8e8', 0.4)
}

// Helper function to generate avatar initials from email address
function getAvatarInitials(email: string): string {
  if (!email) return '?'
  // Extract email address from formatted string like "John Doe <john@example.com>" or just "john@example.com"
  let emailAddress = email

  // Check if email is formatted with brackets
  const bracketMatch = email.match(/<([^>]+)>/)
  if (bracketMatch) {
    emailAddress = bracketMatch[1]
  }

  // Split by @ to get name and domain parts
  const [namePart, domainPart] = emailAddress.split('@')

  if (!namePart || !domainPart) {
    return '??'
  }

  // Get first character of name and domain
  const nameChar = namePart.charAt(0).toUpperCase()
  const domainChar = domainPart.charAt(0).toUpperCase()

  return nameChar + domainChar
}

const getDynamicSnoozeOptions = () => {
  const now = new Date();
  const opt1 = new Date(now.getTime() + 4 * 3600000);
  const opt2 = new Date(now); opt2.setDate(opt2.getDate() + 1); opt2.setHours(8, 0, 0, 0);
  const opt3 = new Date(now); opt3.setDate(opt3.getDate() + 2); opt3.setHours(8, 0, 0, 0);
  const dayName3 = opt3.toLocaleDateString('en-US', {weekday: 'short'});
  const getDayMon = (d: Date) => (d.getDay() + 6) % 7;
  const prefix3 = getDayMon(opt3) <= getDayMon(now) ? 'Next week' : 'This week';
  const opt4 = new Date(now); opt4.setDate(opt4.getDate() + 3); opt4.setHours(8, 0, 0, 0);
  const dayName4 = opt4.toLocaleDateString('en-US', {weekday: 'short'});
  const prefix4 = getDayMon(opt4) <= getDayMon(now) ? 'Next week later' : 'This week later';
  const opt5 = new Date(now); opt5.setDate(opt5.getDate() + ((7 - now.getDay()) % 7 || 7)); opt5.setHours(8, 0, 0, 0);
  const prefix5 = now.getDay() === 0 ? 'Next weekend' : 'This weekend';
  return [
    { label: 'Later today (4 hours)', shortLabel: 'Later today', timeText: opt1.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }), hours: 4 },
    { label: `Tomorrow (8:00 AM)`, shortLabel: 'Tomorrow', timeText: `${opt2.toLocaleDateString('en-US', {weekday: 'short'})}, 8:00 AM`, hours: (opt2.getTime() - now.getTime()) / 3600000 },
    { label: `${prefix3} (${dayName3}, 8:00 AM)`, shortLabel: prefix3, timeText: `${dayName3}, 8:00 AM`, hours: (opt3.getTime() - now.getTime()) / 3600000 },
    { label: `${prefix4} (${dayName4}, 8:00 AM)`, shortLabel: prefix4, timeText: `${dayName4}, 8:00 AM`, hours: (opt4.getTime() - now.getTime()) / 3600000 },
    { label: `${prefix5} (Sun, 8:00 AM)`, shortLabel: prefix5, timeText: 'Sun, 8:00 AM', hours: (opt5.getTime() - now.getTime()) / 3600000 },
  ];
}

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
  isSpam?: boolean
  isArchived?: boolean
  isDeleted?: boolean
  isScheduled?: boolean
  scheduledFor?: string
  isDraft?: boolean
  isSubscription?: boolean
  isReport?: boolean
  isPinned?: boolean
  isMuted?: boolean
  snoozeCount?: number
  label_name?: string
  label_color?: string
  hasAttachments?: boolean
  attachments?: Array<{ filename?: string; name?: string; size?: number; dataUrl?: string }>
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
  onReply?: (action: 'reply' | 'replyAll' | 'forward', email: Email) => void
  type?: 'inbox' | 'sent' | 'starred' | 'snoozed' | 'drafts' | 'archived' | 'archive' | 'purchased' | 'all' | 'scheduled' | 'important' | 'spam' | 'trash' | 'delete' | 'subscriptions' | 'reports' | 'label' | 'group'
  // Required when type === 'group' — scopes fetching/actions to a single group's emails.
  groupId?: number
  // Optional when type === 'group' — sub-filters the group's emails (all/inbox/sent/schedule/...).
  groupFilter?: string
  searchQuery?: string
  searchFilters?: SearchFilters
  onSearch?: (query: string) => void
  onRefreshCounts?: () => void
  onEmailReadChange?: (emailId: number, isRead: boolean) => void
  externalReadUpdate?: { emailId: number; isRead: boolean } | null
  externalDeleteUpdate?: { emailId: number; isDeleted: boolean } | null
  openedEmailId?: number | null
  refreshSignal?: number
  // True app-wide whenever a minimized compose strip is showing — reserves room at the
  // bottom of the email list so the strip sits below it instead of overlaying it.
  hasMinimizedStrip?: boolean
}

export default function AllMailsPage({ token, onViewEmail, onReply, type = 'all', groupId, groupFilter, searchQuery = '', searchFilters, onSearch, onRefreshCounts, onEmailReadChange, externalReadUpdate, externalDeleteUpdate, openedEmailId, refreshSignal, hasMinimizedStrip = false }: AllMailsPageProps) {
  const [allEmails, setAllEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedEmails, setSelectedEmails] = useState<Set<number>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [groupedEmails, setGroupedEmails] = useState<Set<string>>(new Set())
  const [immersiveMode, setImmersiveMode] = useState(false)
  const [readerZoomLevel, setReaderZoomLevel] = useState(100)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalEmails, setTotalEmails] = useState(0)
  const [jumpToPageInput, setJumpToPageInput] = useState(String(page))
  const [labelSearchQuery, setLabelSearchQuery] = useState('')
  const [labels, setLabels] = useState<any[]>([])
  const [expandedMoveLabels, setExpandedMoveLabels] = useState<Set<number>>(new Set())
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState<number | null>(null)
  const [snoozeMenuPosition, setSnoozeMenuPosition] = useState<{ top?: number; bottom?: number; right: number; maxHeight: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; email: Email } | null>(null)
  const [customSnoozeDate, setCustomSnoozeDate] = useState('')
  const [customSnoozePopupEmailId, setCustomSnoozePopupEmailId] = useState<number | null>(null)
  const [customSnoozePopupBulk, setCustomSnoozePopupBulk] = useState(false)
  const [snoozeHour, setSnoozeHour] = useState(12)
  const [snoozeMinute, setSnoozeMinute] = useState(0)
  const [snoozePeriod, setSnoozePeriod] = useState<'AM' | 'PM'>('PM')
  const [calendarViewMonth, setCalendarViewMonth] = useState(new Date().getMonth())
  const [calendarViewYear, setCalendarViewYear] = useState(new Date().getFullYear())
  const [moveMenuOpen, setMoveMenuOpen] = useState<number | null>(null)
  const [moveMenuPosition, setMoveMenuPosition] = useState<{ top?: number; bottom?: number; right: number; maxHeight: number } | null>(null)
  const [showCreateLabelModal, setShowCreateLabelModal] = useState(false)
  const [clLabelName, setClLabelName] = useState('')
  const [clLabelColor, setClLabelColor] = useState('')
  const [clParentId, setClParentId] = useState<number | null>(null)
  const [pendingMoveEmailId, setPendingMoveEmailId] = useState<number | null>(null)
  const [clLoading, setClLoading] = useState(false)
  const [clError, setClError] = useState('')
  const [clShowSubLabelDropdown, setClShowSubLabelDropdown] = useState(false)
  const [expandedCreateSubLabels, setExpandedCreateSubLabels] = useState<Set<number>>(new Set())
  const [selectAllAcrossPages, setSelectAllAcrossPages] = useState(false)
  const [toast, setToast] = useState<{ message: string; onUndo?: () => void } | null>(null)
  const [mailHeaderCheckboxDropdownOpen, setMailHeaderCheckboxDropdownOpen] = useState(false)
  const [openDateGroupDropdown, setOpenDateGroupDropdown] = useState<string | null>(null)
  const [bulkMoreMenuOpen, setBulkMoreMenuOpen] = useState(false)
  const [bulkSnoozeMenuOpen, setBulkSnoozeMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'primary' | 'promotions' | 'transactions' | 'social'>('all')
  const [activeDeleteTab, setActiveDeleteTab] = useState<'delete' | 'received' | 'sent'>('delete')
  const [collapsedDateGroups, setCollapsedDateGroups] = useState<Set<string>>(new Set())
  const [hoveredDateGroup, setHoveredDateGroup] = useState<string | null>(null)
  const [dateDropdownPos, setDateDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [expandedChildSections, setExpandedChildSections] = useState<Set<string>>(new Set())
  const [childEmailsMap, setChildEmailsMap] = useState<Map<string, Email[]>>(new Map())
  const [loadingChildSections, setLoadingChildSections] = useState<Set<string>>(new Set())
  const [childCountsMap, setChildCountsMap] = useState<Map<string, { total: number; unread: number }>>(new Map())
  const [parentUnread, setParentUnread] = useState(0)
  const [hoveredParentHeader, setHoveredParentHeader] = useState(false)
  const [hoveredChildHeader, setHoveredChildHeader] = useState<string | null>(null)
  const { labelName } = useParams()
  const { search } = useLocation()
  const includeChildren = new URLSearchParams(search).get('includeChildren') === 'true'
  const mainCheckboxRef = useRef<HTMLInputElement>(null)
  const clSubLabelTriggerRef = useRef<HTMLDivElement>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openedScrolledRef = useRef(false)
  const fetchAllMailsRef = useRef<() => Promise<void>>(async () => {})
  const navigate = useNavigate()

  // Lets the Group/Ungroup toolbar buttons know whether a contact is already in any
  // group, without an N+1 fetch per selected email.
  useEffect(() => {
    fetch('http://localhost:5050/api/group-members/all', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setGroupedEmails(new Set((data.emails || []).map((e: string) => e.toLowerCase()))))
      .catch(err => console.error('Failed to fetch group members:', err))
  }, [token])

  useEffect(() => {
    setPage(1)
    setFocusedIndex(-1)
    setAllEmails([])
    setTotalEmails(0)
    setChildEmailsMap(new Map())
    // Switching folders/labels doesn't always remount this component (e.g. /labels/:labelName?
    // reuses the same instance across different labels) — selection state must be reset
    // explicitly so "Select" clicked in one folder doesn't leak its UI into another.
    setSelectionMode(false)
    setSelectedEmails(new Set())
  }, [type, labelName, groupId, groupFilter])

  useEffect(() => {
    if (!externalReadUpdate) return
    const { emailId, isRead } = externalReadUpdate
    setAllEmails(prev => {
      const found = prev.find(e => e.id === emailId)
      if (!found || found.isRead === isRead) return prev
      return prev.map(e => e.id === emailId ? { ...e, isRead } : e)
    })
  }, [externalReadUpdate])

  useEffect(() => {
    if (!externalDeleteUpdate) return
    const { emailId, isDeleted } = externalDeleteUpdate
    setAllEmails(prev => {
      const found = prev.find(e => e.id === emailId)
      if (!found || found.isDeleted === isDeleted) return prev
      return prev.map(e => e.id === emailId ? { ...e, isDeleted } : e)
    })
  }, [externalDeleteUpdate])

  useEffect(() => {
    const handler = (e: Event) => {
      const { isRead, folderType } = (e as CustomEvent).detail as { isRead: boolean, folderType?: string }

      const isReceived = (em: Email) => em.folder !== 'sent' && em.folder !== 'drafts' && !em.isScheduled

      const isMatch = (em: Email) => {
        if (!isReceived(em)) return false  // never mark sent/draft/scheduled as read/unread
        if (!folderType || folderType === type) return true;
        if (folderType === 'archive' || folderType === 'archived') return !!em.isArchived;
        if (folderType === 'inbox') return !em.isArchived && !em.isDeleted && !em.isSpam && !em.isSnoozed;
        if (folderType === 'starred') return !!em.isStarred;
        if (folderType === 'snoozed') return !!em.isSnoozed;
        if (folderType === 'spam') return !!em.isSpam;
        if (folderType === 'delete') return !!em.isDeleted;
        if (folderType === 'all' || folderType === 'all-mails') return true;
        return false;
      }

      setAllEmails(prev => {
        const updated = prev.map(em => isMatch(em) ? { ...em, isRead } : em)
        const newUnread = updated.filter(em => !em.isRead && em.folder !== 'sent' && em.folder !== 'drafts' && !em.isScheduled && !em.isDraft).length
        setParentUnread(newUnread)
        return updated
      })

      setChildEmailsMap(prev => {
        const next = new Map(prev)
        next.forEach((emails, key) => next.set(key, emails.map(em => isMatch(em) ? { ...em, isRead } : em)))
        return next
      })

      setChildCountsMap(prev => {
        const next = new Map(prev)
        // Simple blanket fallback since checking isMatch per-count would be heavy
        if (!folderType || folderType === type || type === 'all') {
           next.forEach((counts, key) => next.set(key, { total: counts.total, unread: isRead ? 0 : counts.total }))
        }
        return next
      })
    }

    window.addEventListener('mailBulkRead', handler)
    return () => window.removeEventListener('mailBulkRead', handler)
  }, [type])

  useEffect(() => {
    const handler = (e: Event) => {
      const { isStarred, folderType } = (e as CustomEvent).detail as { isStarred: boolean, folderType?: string }

      const isAllStar = (folderType === 'all' || folderType === 'all-mails') && isStarred

      const isMatch = (em: Email) => {
        if (folderType === 'delete') return !!em.isDeleted;
        if (em.isDeleted && !isAllStar) return false;
        if (!folderType || folderType === type) return true;
        if (folderType === 'archive' || folderType === 'archived') return !!em.isArchived;
        if (folderType === 'inbox') return !em.isArchived && !em.isDeleted && !em.isSpam && !em.isSnoozed && em.folder !== 'sent';
        if (folderType === 'starred') return !!em.isStarred;
        if (folderType === 'snoozed') return !!em.isSnoozed;
        if (folderType === 'spam') return !!em.isSpam;
        if (folderType === 'drafts') return em.folder === 'drafts';
        if (folderType === 'scheduled') return !!em.isScheduled;
        if (folderType === 'sent') return em.folder === 'sent';
        if (folderType === 'all' || folderType === 'all-mails') return true;
        return false;
      }

      // Collect labels of deleted emails being restored (server clears label_name on restore)
      const restoredLabelNames = new Set<string>()

      setAllEmails(prev => prev.map(em => {
        if (!isMatch(em)) return em
        if (isAllStar && em.isDeleted) {
          if (em.label_name) restoredLabelNames.add(em.label_name)
          return { ...em, isStarred: true, isDeleted: false, label_name: undefined }
        }
        return { ...em, isStarred }
      }))

      // Remove restored emails from label sections (they lose their label on restore)
      if (isAllStar && restoredLabelNames.size > 0) {
        setChildEmailsMap(prev => {
          const next = new Map(prev)
          next.forEach((emails, key) => {
            next.set(key, emails.filter(em => !em.isDeleted))
          })
          return next
        })
        // Refresh label pages and sidebar counts
        restoredLabelNames.forEach(lname => {
          window.dispatchEvent(new CustomEvent('folderRefresh', { detail: { folder: 'label', labelName: lname } }))
        })
        onRefreshCounts?.()
      } else {
        setChildEmailsMap(prev => {
          const next = new Map(prev)
          next.forEach((emails, key) => next.set(key, emails.map(em => isMatch(em) ? { ...em, isStarred } : em)))
          return next
        })
      }
    }
    window.addEventListener('mailBulkStar', handler)
    return () => window.removeEventListener('mailBulkStar', handler)
  }, [type])

  useEffect(() => {
    const handler = (e: Event) => {
      const { isSnoozed, folderType, undoIds } = (e as CustomEvent).detail as { isSnoozed: boolean, folderType?: string, undoIds?: number[] }
      
      const isTargetFolder = (em: Email) => {
        if (undoIds && undoIds.length > 0) return undoIds.includes(em.id as number);
        if (!folderType || folderType === type) return true;
        if (folderType === 'snoozed') return !!em.isSnoozed;
        if (folderType === 'inbox') return !em.isArchived && !em.isDeleted && !em.isSpam && !em.isSnoozed && em.folder !== 'sent';
        if (folderType === 'archive' || folderType === 'archived') return !!em.isArchived;
        if (folderType === 'starred') return !!em.isStarred;
        if (folderType === 'spam') return !!em.isSpam;
        if (folderType === 'all' || folderType === 'all-mails') return true;
        if (folderType === 'sent') return em.folder === 'sent';
        if (folderType === 'drafts') return em.folder === 'drafts';
        if (folderType === 'delete') return !!em.isDeleted;
        if (folderType === 'scheduled') return !!em.isScheduled;
        if (folderType === 'reports') return !!em.isReport;
        if (folderType === 'subscriptions') return !!em.isSubscription;
        return false;
      }

      setAllEmails(prev => {
        const next = prev.map(em => isTargetFolder(em) ? { ...em, isSnoozed, snoozedUntil: isSnoozed ? new Date(Date.now() + 24 * 3600000).toISOString() : undefined } : em);
        if (undoIds && undoIds.length > 0) {
          if (type === 'snoozed' && !isSnoozed) return next.filter(em => em.isSnoozed);
          if (type === 'inbox' && isSnoozed) return next.filter(em => !undoIds.includes(em.id as number));
          return next;
        }
        if (type === 'snoozed' && (folderType === 'snoozed' || folderType === 'all' || folderType === 'all-mails') && !isSnoozed) return [];
        else if (type === 'inbox' && folderType === 'inbox' && isSnoozed) return [];
        else if (type === 'snoozed' && !isSnoozed) return next.filter(em => em.isSnoozed);
        return next;
      });

      setChildEmailsMap(prev => {
        const next = new Map(prev);
        if (undoIds && undoIds.length > 0) {
          next.forEach((emails, key) => {
            const upd = emails.map(em => isTargetFolder(em) ? { ...em, isSnoozed, snoozedUntil: isSnoozed ? new Date(Date.now() + 24 * 3600000).toISOString() : undefined } : em);
            if (type === 'snoozed' && !isSnoozed) next.set(key, upd.filter(em => em.isSnoozed));
            else if (type === 'inbox' && isSnoozed) next.set(key, upd.filter(em => !undoIds.includes(em.id as number)));
            else next.set(key, upd);
          });
          return next;
        }
        if (type === 'snoozed' && (folderType === 'snoozed' || folderType === 'all' || folderType === 'all-mails') && !isSnoozed) next.clear();
        else if (type === 'inbox' && folderType === 'inbox' && isSnoozed) next.clear();
        else next.forEach((emails, key) => {
          const upd = emails.map(em => isTargetFolder(em) ? { ...em, isSnoozed, snoozedUntil: isSnoozed ? new Date(Date.now() + 24 * 3600000).toISOString() : undefined } : em);
          next.set(key, type === 'snoozed' && !isSnoozed ? upd.filter(em => em.isSnoozed) : upd);
        });
        return next;
      });

      if (!undoIds || undoIds.length === 0) {
        if (type === 'snoozed' && (folderType === 'snoozed' || folderType === 'all' || folderType === 'all-mails') && !isSnoozed) setTotalEmails(0);
        else if (type === 'inbox' && folderType === 'inbox' && isSnoozed) setTotalEmails(0);
      }
      
      fetchAllMailsRef.current()
    }
    window.addEventListener('mailBulkSnooze', handler)
    return () => window.removeEventListener('mailBulkSnooze', handler)
  }, [type])

  useEffect(() => {
    const handler = () => fetchAllMailsRef.current()
    window.addEventListener('mailBulkImportant', handler)
    return () => window.removeEventListener('mailBulkImportant', handler)
  }, [])

  useEffect(() => {
    const handler = () => fetchAllMailsRef.current()
    window.addEventListener('mailRefresh', handler)
    return () => window.removeEventListener('mailRefresh', handler)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const { folder, labelName: refreshLabel } = (e as CustomEvent).detail as { folder: string; labelName?: string }
      if (folder === type) {
        fetchAllMailsRef.current()
      } else if (folder === 'label' && refreshLabel && type === 'label' && labelName && decodeURIComponent(labelName) === refreshLabel) {
        fetchAllMailsRef.current()
      }
    }
    window.addEventListener('folderRefresh', handler)
    return () => window.removeEventListener('folderRefresh', handler)
  }, [type, labelName])

  useEffect(() => {
    fetchAllMails()
  }, [token, type, labelName, groupId, groupFilter, search, page, pageSize, refreshSignal]);

  // After returning from chat view, scroll the opened email item into view once
  useEffect(() => {
    if (openedScrolledRef.current || !openedEmailId || loading) return
    openedScrolledRef.current = true
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-email-id="${openedEmailId}"]`) as HTMLElement | null
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' })
    })
  }, [openedEmailId, loading])

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

  const findLabelByLastName = (labelList: any[], lastName: string): any | null => {
    for (const lbl of labelList) {
      if (lbl.name === lastName) return lbl
      if (lbl.children) {
        const found = findLabelByLastName(lbl.children, lastName)
        if (found) return found
      }
    }
    return null
  }

  const findLabelNode = (labelList: any[], name: string): any | null => {
    for (const lbl of labelList) {
      if (lbl.name === name) return lbl
      if (lbl.children) {
        const found = findLabelNode(lbl.children, name)
        if (found) return found
      }
    }
    return null
  }

  const currentLabelNode = useMemo(() => {
    if (!labelName || !includeChildren) return null
    const lastName = decodeURIComponent(labelName).split(' / ').pop() || ''
    return findLabelByLastName(labels, lastName)
  }, [labels, labelName, includeChildren])

  // Prefetch unread+total counts for all child labels when viewing a collapsed parent
  useEffect(() => {
    if (!includeChildren || !currentLabelNode?.children?.length) return
    currentLabelNode.children.forEach(async (child: any) => {
      const childFullName = `${labelName ? decodeURIComponent(labelName) : ''} / ${child.name}`
      if (childCountsMap.has(childFullName)) return
      try {
        const res = await fetch(`http://localhost:5050/api/labels/${encodeURIComponent(childFullName)}?page=1&limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setChildCountsMap(prev => new Map(prev).set(childFullName, { total: data.total || 0, unread: data.unread || 0 }))
        }
      } catch (_) {}
    })
  }, [currentLabelNode, labelName, includeChildren, token])


  useEffect(() => {
    const closeAll = () => {
      setSnoozeMenuOpen(null); setSnoozeMenuPosition(null)
      setMoveMenuOpen(null); setMoveMenuPosition(null)
      setContextMenu(null)
      setBulkSnoozeMenuOpen(false); setBulkMoreMenuOpen(false)
    }
    window.addEventListener('sidebarMenuOpened', closeAll)
    return () => window.removeEventListener('sidebarMenuOpened', closeAll)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const isClickInsideDropdown = target.closest('.checkbox-dropdown')
      if (!isClickInsideDropdown) {
        setMailHeaderCheckboxDropdownOpen(false)
        setOpenDateGroupDropdown(null)
      }
      if (!target.closest('.move-to-dropdown') && !target.closest('[data-move-btn]')) {
        setMoveMenuOpen(null)
        setMoveMenuPosition(null)
      }
      if (!target.closest('.snooze-dropdown') && !target.closest('[data-snooze-btn]')) {
        setSnoozeMenuOpen(null)
        setSnoozeMenuPosition(null)
      }
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

  // Get date range label for an email
  const getDateRangeLabel = (emailDate: Date): string => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const email = new Date(emailDate)
    email.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Tomorrow (future)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (email.getTime() === tomorrow.getTime()) {
      return DATE_RANGES.TOMORROW
    }

    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() - today.getDay())

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const yearStart = new Date(today.getFullYear(), 0, 1)

    // Today
    if (email.getTime() === today.getTime()) {
      return DATE_RANGES.TODAY
    }

    // Yesterday
    if (email.getTime() === yesterday.getTime()) {
      return DATE_RANGES.YESTERDAY
    }

    // This week (last 7 days)
    if (email.getTime() >= weekStart.getTime() && email.getTime() < today.getTime()) {
      return DATE_RANGES.THIS_WEEK
    }

    // For all other dates, use YYYY-MM format (e.g., "2026-03")
    const year = email.getFullYear()
    const month = String(email.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  // Group emails by date range
  const groupEmailsByDateRange = (emails: Email[], reverseSort = false) => {
    const groups: Map<string, Email[]> = new Map()
    const _now = Date.now()

    emails.forEach(email => {
      if (email.isPinned) {
        if (!groups.has('Pinned')) groups.set('Pinned', [])
        groups.get('Pinned')!.push(email)
        return
      }
      const isUpcoming = type === 'scheduled' && email.scheduledFor && new Date(email.scheduledFor).getTime() > _now;
      const dateRange = getDateRangeLabel(new Date(isUpcoming ? email.scheduledFor! : email.date))
      if (!groups.has(dateRange)) {
        groups.set(dateRange, [])
      }
      groups.get(dateRange)!.push(email)
    })

    const sortedGroups: Array<[string, Email[]]> = []

    // Extract all group keys and sort them using the custom weights map
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
      const weightA = CUSTOM_SORT_ORDER[a] ?? 1000
      const weightB = CUSTOM_SORT_ORDER[b] ?? 1000
      
      if (weightA === weightB) {
        return reverseSort ? a.localeCompare(b) : b.localeCompare(a)
      }
      return weightA - weightB
    })

    // 1. Push fixed text ranges first (weights < 1000)
    sortedKeys.filter(key => CUSTOM_SORT_ORDER[key] && CUSTOM_SORT_ORDER[key] < 1000).forEach(key => {
      sortedGroups.push([key, groups.get(key)!])
    })

    // 2. Extract just the month ranges to preserve the year separator logic
    const monthRanges = sortedKeys.filter(key => /^\d{4}-\d{2}$/.test(key))

    // Group months by year and add with year separators
    let currentYear: string | null = null
    monthRanges.forEach(monthRange => {
      const year = monthRange.substring(0, 4)
      if (currentYear !== year) {
        currentYear = year
        sortedGroups.push([`__year_${year}__`, []])
      }
      sortedGroups.push([monthRange, groups.get(monthRange)!])
    })

    // 3. Push any trailing ranges (like 'Older' with weight 9999)
    sortedKeys.filter(key => CUSTOM_SORT_ORDER[key] && CUSTOM_SORT_ORDER[key] > 1000).forEach(key => {
      sortedGroups.push([key, groups.get(key)!])
    })

    return sortedGroups
  }

  // Toggle date group collapse/expand
  const toggleDateGroupCollapse = (dateRange: string) => {
    const newCollapsed = new Set(collapsedDateGroups)
    if (newCollapsed.has(dateRange)) {
      newCollapsed.delete(dateRange)
    } else {
      newCollapsed.add(dateRange)
    }
    setCollapsedDateGroups(newCollapsed)
  }

  // Get display label for date range
  const getDisplayDateRangeLabel = (dateRange: string, emails: Email[]): string => {
    // Handle year headers (e.g., "__year_2025__" → "2025")
    if (dateRange.startsWith('__year_')) {
      return dateRange.substring(7, 11)
    }

    // Handle fixed ranges (Today, Yesterday, This week)
    if (['Today', 'Tomorrow', 'Yesterday', 'This week'].includes(dateRange)) {
      return dateRange
    }

    // Handle YYYY-MM format
    if (/^\d{4}-\d{2}$/.test(dateRange)) {
      const [year, month] = dateRange.split('-')
      const date = new Date(`${year}-${month}-01`)
      const monthName = date.toLocaleString('default', { month: 'long' })
      return `${monthName} ${year}`
    }

    return dateRange
  }

  // Check if a date range is a year header
  const isYearHeader = (dateRange: string): boolean => {
    return dateRange.startsWith('__year_')
  }

  // Get parent year from a month dateRange
  const getParentYear = (dateRange: string): string | null => {
    if (/^\d{4}-\d{2}$/.test(dateRange)) {
      const year = dateRange.substring(0, 4)
      return `__year_${year}__`
    }
    return null
  }

  // Calculate email counts for a year based on all emails
  const getYearEmailCounts = (yearKey: string, allEmails: Email[]) => {
    const rawYearKey = yearKey.startsWith('__up_') || yearKey.startsWith('__as_') ? yearKey.substring(5) : yearKey
    const year = rawYearKey.substring(7, 11)
    let total = 0
    let unread = 0
    const _now = Date.now()

    allEmails.forEach(email => {
      const isUpcoming = type === 'scheduled' && email.scheduledFor && new Date(email.scheduledFor).getTime() > _now;
      const emailDate = new Date(isUpcoming ? email.scheduledFor! : email.date)
      const emailYear = String(emailDate.getFullYear())

      if (emailYear === year) {
        total++
        if (!email.isRead && email.folder !== 'sent' && email.folder !== 'drafts' && !email.isScheduled && !email.isDraft) {
          unread++
        }
      }
    })

    return { total, unread }
  }

  // Get month information for a collapsed year
  const getCollapsedYearMonths = (yearKey: string, emails: Email[]) => {
    const isUpcomingGrp = yearKey.startsWith('__up_')
    const rawYearKey = yearKey.startsWith('__up_') || yearKey.startsWith('__as_') ? yearKey.substring(5) : yearKey
    const year = rawYearKey.substring(7, 11)
    const monthsMap = new Map<string, { month: string; total: number; unread: number }>()
    const _now = Date.now()

    emails.forEach(email => {
      const isUpcoming = type === 'scheduled' && email.scheduledFor && new Date(email.scheduledFor).getTime() > _now;
      const emailDate = new Date(isUpcoming ? email.scheduledFor! : email.date)
      const emailYear = String(emailDate.getFullYear())

      if (emailYear === year) {
        const month = emailDate.getMonth() + 1
        const monthKey = `${year}-${String(month).padStart(2, '0')}`
        const monthName = emailDate.toLocaleString('default', { month: 'short' })

        if (!monthsMap.has(monthKey)) {
          monthsMap.set(monthKey, { month: monthName, total: 0, unread: 0 })
        }

        const monthData = monthsMap.get(monthKey)!
        monthData.total++
        if (!email.isRead && email.folder !== 'sent' && email.folder !== 'drafts' && !email.isScheduled && !email.isDraft) {
          monthData.unread++
        }
      }
    })

    // Sort months in descending order (newest first), or ascending if upcoming
    return Array.from(monthsMap.entries())
      .sort((a, b) => isUpcomingGrp ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]))
      .map(([_, data]) => data)
  }

  const getFolderColor = (folderType: string, labelColor?: string): string => {
    switch (folderType) {
      case 'inbox': return '#2196f3'
      case 'sent': return '#4db6ac'
      case 'starred': return '#ffc107'
      case 'snoozed': return '#fb8c00'
      case 'drafts': return '#ff7043'
      case 'archived': return '#78909c'
      case 'purchased': return '#8e24aa'
      case 'all': return '#5e35b1'
      case 'scheduled': return '#4db6ac'
      case 'spam': return '#e53935'
      case 'delete': return '#757575'
      case 'subscriptions': return '#039be5'
      case 'reports': return '#7b5ea7'
      case 'label': return labelColor || '#888888'
      default: return '#888888'
    }
  }

  // Get folder icon based on email folder
  const getFolderIcon = (folder?: string, email?: any) => {
    const icons = []

    // 1. Check flags and add corresponding icons
    if (email?.isArchived) {
      icons.push(<span key="archived" title="Archived"><Archive size={24} style={{ color: '#7986cb' }} /></span>)
    }

    if (email?.isDeleted || type === 'delete') {
      if (folder === 'sent' || type === 'sent') {
        icons.push(<span key="delete-sent" title="Deleted Sent" className="delete-icon-bg active-delete-sent" />)
      } else {
        icons.push(<span key="delete" title="Deleted"><Trash2 size={24} style={{ color: '#f48fb1' }} /></span>)
      }
    }

    if (email?.isSpam) {
      icons.push(<span key="spam" title="Spam"><AlertOctagon size={24} style={{ color: '#e91e63' }} /></span>)
    }


    if (email?.isScheduled || folder === 'scheduled') {
      const isScheduledSent = email?.scheduledFor && new Date(email.scheduledFor).getTime() <= Date.now()
      if (isScheduledSent) {
        icons.push(<span key="scheduled-sent" title="Scheduled Sent" className="active-scheduled-sent-icon-bg" style={{ width: '24px', height: '24px', backgroundSize: '24px 24px', margin: 0 }} />)
      } else {
        icons.push(<span key="scheduled" title="Scheduled" className="active-scheduled-icon-bg" style={{ width: '24px', height: '24px', backgroundSize: '24px 24px', margin: 0 }} />)
      }
    }

    if (email?.label_name) {
      const labelLastName = email.label_name.split(' / ').pop() || email.label_name
      const labelNode = findLabelNode(labels, labelLastName)
      const labelColor = labelNode?.color || email.label_color || '#999'
      const hasChildren = labelNode?.children && labelNode.children.length > 0
      icons.push(
        hasChildren
          ? <span key={`label-${email.label_name}`} title={email.label_name}><Folder size={24} style={{ color: labelColor, stroke: labelColor, fill: 'none', flexShrink: 0 }} /></span>
          : <span key={`label-${email.label_name}`} title={email.label_name}><Tag size={24} style={{ color: labelColor, stroke: labelColor, fill: 'none', flexShrink: 0 }} /></span>
      )
    }

    // 2. Base Folder (Inbox, Sent, Drafts)
    if (folder === 'sent') {
      if (type !== 'sent' && !email?.isDeleted && type !== 'delete' && !email?.isScheduled) {
        icons.unshift(<span key="sent" title="Sent"><Send size={24} style={{ color: '#4db6ac' }} /></span>)
      }
    } else if (folder === 'drafts') {
      if (type !== 'drafts') {
        icons.unshift(<span key="drafts" title="Drafts"><Edit size={24} style={{ color: '#ff5722' }} /></span>)
      }
    } else if (!email?.isArchived && !email?.isDeleted && !email?.isSpam && !email?.label_name) {
      if (type !== 'inbox') {
        icons.unshift(<span key="inbox" title="Inbox"><Inbox size={24} style={{ color: '#64b5f6' }} /></span>)
      }
    }

    const uniqueIcons = icons.filter((v, i, a) => a.findIndex(t => (t.key === v.key)) === i)

    if (uniqueIcons.length === 0) return null;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {uniqueIcons}
      </div>
    )
  }

  // Get email count for a specific category
  const getCategoryCount = (category: 'all' | 'primary' | 'promotions' | 'transactions' | 'social') => {
    if (type !== 'inbox') return { total: 0, unread: 0 }

    let categoryEmails = allEmails

    if (category !== 'all') {
      categoryEmails = allEmails.filter(email => {
        const emailCategory = getEmailCategory(email)
        return emailCategory === category
      })
    }

    const total = categoryEmails.length
    const unread = categoryEmails.filter(email => !email.isRead && email.folder !== 'sent' && email.folder !== 'drafts' && !email.isScheduled && !email.isDraft).length

    return { total, unread }
  }

  // Get email count for a specific delete tab
  const getDeleteTabCount = (tab: 'delete' | 'received' | 'sent') => {
    if (type !== 'delete') return { total: 0, unread: 0 }

    let trashEmails = allEmails

    if (tab === 'received') {
      trashEmails = allEmails.filter(email => email.folder === 'inbox')
    } else if (tab === 'sent') {
      trashEmails = allEmails.filter(email => email.folder === 'sent')
    }

    const total = trashEmails.length
    const unread = trashEmails.filter(email => !email.isRead && email.folder !== 'sent' && email.folder !== 'drafts' && !email.isScheduled && !email.isDraft).length

    return { total, unread }
  }

  // Helper function to calculate dropdown button position (for fixed positioning)
  const calculateDropdownPos = (buttonElement: HTMLElement) => {
    const rect = buttonElement.getBoundingClientRect()
    return {
      top: rect.bottom,
      left: rect.left
    }
  }

  // Filter emails based on search query and advanced filters
  const filteredEmails = allEmails.filter(email => {
    // Apply tab filter only for inbox type (skip if 'all' tab is selected)
    if (type === 'inbox' && activeTab !== 'all') {
      const emailCategory = getEmailCategory(email)
      if (emailCategory !== activeTab) return false
    }

    // Apply tab filter for delete type
    if (type === 'delete') {
      if (activeDeleteTab === 'received' && email.folder !== 'inbox') return false
      if (activeDeleteTab === 'sent' && email.folder !== 'sent') return false
      // 'delete' tab shows all deleted emails
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
      { id: label.id, name: prefix ? `${prefix} / ${label.name}` : label.name, color: label.color, hasChildren: !!(label.children && label.children.length > 0) },
      ...(label.children ? flattenLabels(label.children, prefix ? `${prefix} / ${label.name}` : label.name) : [])
    ])
  }

  const flatLabelsTree = (nodes: any[], depth = 0): Array<{id: number, name: string, color: string, hasChildren: boolean, depth: number, parentId: number | null}> =>
    nodes.flatMap(n => [
      { id: n.id, name: n.name, color: n.color, hasChildren: !!(n.children?.length), depth, parentId: null },
      ...(n.children ? flatLabelsTreeInner(n.children, depth + 1, n.id) : [])
    ])
  const flatLabelsTreeInner = (nodes: any[], depth: number, pid: number): Array<{id: number, name: string, color: string, hasChildren: boolean, depth: number, parentId: number | null}> =>
    nodes.flatMap(n => [
      { id: n.id, name: n.name, color: n.color, hasChildren: !!(n.children?.length), depth, parentId: pid },
      ...(n.children ? flatLabelsTreeInner(n.children, depth + 1, n.id) : [])
    ])
  const isCreateSubVisible = (item: {parentId: number | null}, all: Array<{id: number, parentId: number | null}>): boolean => {
    if (item.parentId === null) return true
    if (!expandedCreateSubLabels.has(item.parentId)) return false
    const parent = all.find(l => l.id === item.parentId)
    return parent ? isCreateSubVisible(parent, all) : true
  }

  const flattenLabelsTree = (nodes: any[], prefix = '', depth = 0, parentId: number | null = null): any[] => {
    return nodes.flatMap(label => {
      const fullPath = prefix ? `${prefix} / ${label.name}` : label.name
      return [
        { id: label.id, leafName: label.name, fullPath, color: label.color, hasChildren: !!(label.children?.length), depth, parentId },
        ...(label.children ? flattenLabelsTree(label.children, fullPath, depth + 1, label.id) : [])
      ]
    })
  }

  const isMoveItemVisible = (item: any, allItems: any[]): boolean => {
    if (item.parentId === null) return true
    if (!expandedMoveLabels.has(item.parentId)) return false
    const parent = allItems.find((l: any) => l.id === item.parentId)
    return parent ? isMoveItemVisible(parent, allItems) : true
  }

  const areAllSelectedEmailsMuted = () => {
    if (selectedEmails.size === 0) return false;
    const selectedEmailsList = allEmails.filter(email => selectedEmails.has(email.id));
    return selectedEmailsList.length > 0 && selectedEmailsList.every(email => email.isMuted);
  }

  useEffect(() => {
    if (mainCheckboxRef.current) {
      const numSelected = selectedEmails.size;
      let numEmails = filteredEmails.length;
      childEmailsMap.forEach(emails => { numEmails += emails.length; });
      mainCheckboxRef.current.indeterminate = numSelected > 0 && numSelected < numEmails;
    }
  }, [selectedEmails, filteredEmails, childEmailsMap]);

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
        case 'delete': url = 'http://localhost:5050/api/delete'; break;
        case 'subscriptions': url = 'http://localhost:5050/api/subscriptions'; break;
        case 'reports': url = 'http://localhost:5050/api/reports'; break;
        case 'group':
          if (groupId) url = `http://localhost:5050/api/groups/${groupId}/emails${groupFilter ? `?filter=${encodeURIComponent(groupFilter)}` : ''}`;
          break;
        case 'label':
          if (labelName) url = `http://localhost:5050/api/labels/${encodeURIComponent(labelName)}${includeChildren ? '?includeChildren=true' : ''}`;
          break;
      }

      // Group-compose messages live only in the Groups page and Chat Mail's dedicated
      // group thread — hide them from the regular individual mail folders (everything
      // except the group/label views, which use separate endpoints entirely).
      const shouldExcludeGroups = type !== 'group' && type !== 'label'
      const separator = url.includes('?') ? '&' : '?'
      const finalUrl = `${url}${separator}page=${page}&limit=${pageSize}${shouldExcludeGroups ? '&excludeGroups=true' : ''}`
      const response = await fetch(finalUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      console.log(`Fetched ${type} emails:`, { response: response.ok, emailCount: data.emails?.length, total: data.total, data })

      if (response.ok && data.emails && data.emails.length > 0) {
        console.log(`Setting ${data.emails.length} emails for ${type}`)
        setAllEmails(data.emails)
        setTotalEmails(data.total || 0)
        if (data.unread !== undefined) setParentUnread(data.unread)

        window.dispatchEvent(new CustomEvent('updateFolderCount', { 
          detail: { folder: type, total: data.total || 0, unread: data.unread } 
        }))
      } else if (response.ok) {
        // API returned success but no emails
        setAllEmails([])
        setTotalEmails(data.total || 0)
        if (data.unread !== undefined) setParentUnread(data.unread)
        console.log(`No emails found for type: ${type} - Data:`, data)

        window.dispatchEvent(new CustomEvent('updateFolderCount', { 
          detail: { folder: type, total: data.total || 0, unread: data.unread } 
        }))
      } else if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token')
        localStorage.removeItem('userEmail')
        window.location.href = '/login'
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

  fetchAllMailsRef.current = fetchAllMails

  const handleToggleStar = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/star`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        if (type === 'delete') {
          setAllEmails(prev => prev.filter(email => email.id !== emailId))
        } else {
          setAllEmails(allEmails.map(email => {
            if (email.id !== emailId) return email
            if (email.isDeleted) return { ...email, isStarred: true, isDeleted: false }
            return { ...email, isStarred: !email.isStarred }
          }))
        }
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  const handleUnarchive = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return

    try {
      const unarchiveEmail = allEmails.find(email => email.id === emailId)
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/archive`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        setAllEmails(allEmails.filter(email => email.id !== emailId))
        setTotalEmails(prev => Math.max(0, prev - 1))
        const undoUnarchive = async () => {
          await fetch(`http://localhost:5050/api/emails/${emailId}/archive`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
          })
          if (unarchiveEmail) {
            setAllEmails(prev => [...prev, unarchiveEmail])
            setTotalEmails(prev => prev + 1)
          }
          onRefreshCounts?.()
        }
        showToast('Conversation moved to Inbox', undoUnarchive)
        onRefreshCounts?.()
      }
    } catch (err) {
      console.error('Failed to unarchive email:', err)
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
        const targetEmail = allEmails.find(e => e.id === emailId) || Array.from(childEmailsMap.values()).flat().find(e => e.id === emailId)
        const wasDeleted = !!targetEmail?.isDeleted
        const isNowDeleted = !wasDeleted
        const emailLabelName = targetEmail?.label_name

        // Dispatch folderRefresh for every folder the email belongs to
        const dispatchFolderRefreshes = (em: Email | undefined) => {
          const folders = ['delete']
          if (em) {
            if (em.folder === 'inbox' || (!em.isArchived && !em.isSpam && !em.isSnoozed && em.folder !== 'sent')) folders.push('inbox')
            if (em.folder === 'sent') folders.push('sent')
            if (em.isArchived) folders.push('archive')
            if (em.isSnoozed) folders.push('snoozed')
            if (em.isStarred) folders.push('starred')
            if (em.isSpam) folders.push('spam')
            if (em.isScheduled) folders.push('scheduled')
            if (em.folder === 'drafts') folders.push('drafts')
            if (em.isSubscription) folders.push('subscriptions')
            folders.push('groups', 'reports')
          }
          folders.forEach(f => window.dispatchEvent(new CustomEvent('folderRefresh', { detail: { folder: f } })))
          // ChatMailPage's own conversation list only listens for mailRefresh (not
          // folderRefresh) to know when to refetch — without this, moving a draft to
          // Trash here left it stuck showing in the Chat Mail list indefinitely.
          window.dispatchEvent(new Event('mailRefresh'))
          if (em?.label_name) {
            window.dispatchEvent(new CustomEvent('folderRefresh', { detail: { folder: 'label', labelName: em.label_name } }))
          }
        }

        if (type === 'all') {
          // Mirror server: on delete, clear all folder flags; on restore, put them back
          setAllEmails(prev => prev.map(email => {
            if (email.id !== emailId) return email
            if (isNowDeleted) {
              return {
                ...email,
                isDeleted: true,
                isStarred: false, isArchived: false, isSnoozed: false,
                isSpam: false, isScheduled: false, label_name: undefined,
              }
            }
            return { ...targetEmail!, isDeleted: false }
          }))

          // Remove from / restore in label sections instantly
          setChildEmailsMap(prev => {
            const next = new Map(prev)
            next.forEach((emails, key) => {
              if (isNowDeleted) {
                next.set(key, emails.filter(e => e.id !== emailId))
              } else if (emailLabelName && targetEmail && key.endsWith(emailLabelName)) {
                next.set(key, [...emails, { ...targetEmail, isDeleted: false, label_name: emailLabelName }])
              }
            })
            return next
          })

          dispatchFolderRefreshes(targetEmail)
          onRefreshCounts?.()

          const undo = async () => {
            await fetch(`http://localhost:5050/api/emails/${emailId}/delete`, {
              method: 'PUT', headers: { Authorization: `Bearer ${token}` },
            })
            setAllEmails(prev => prev.map(email =>
              email.id === emailId
                ? { ...email, isDeleted: wasDeleted, label_name: wasDeleted ? undefined : emailLabelName }
                : email
            ))
            setChildEmailsMap(prev => {
              const next = new Map(prev)
              next.forEach((emails, key) => {
                if (wasDeleted) {
                  next.set(key, emails.filter(e => e.id !== emailId))
                } else if (emailLabelName && targetEmail && key.endsWith(emailLabelName)) {
                  next.set(key, [...emails, { ...targetEmail, isDeleted: false, label_name: emailLabelName }])
                }
              })
              return next
            })
            dispatchFolderRefreshes(targetEmail)
            onRefreshCounts?.()
            setToast(null)
          }
          showToast(isNowDeleted ? 'Moved to Deleted' : 'Restored', undo)
        } else {
          setAllEmails(allEmails.filter(email => email.id !== emailId))
          setTotalEmails(prev => Math.max(0, prev - 1))
          setChildEmailsMap(prev => {
            const next = new Map(prev)
            next.forEach((emails, key) => {
              next.set(key, emails.filter(e => e.id !== emailId))
            })
            return next
          })
          dispatchFolderRefreshes(targetEmail)
          onRefreshCounts?.()
          
          const undo = async () => {
            await fetch(`http://localhost:5050/api/emails/${emailId}/delete`, {
              method: 'PUT', headers: { Authorization: `Bearer ${token}` },
            })
            fetchAllMails()
            dispatchFolderRefreshes(targetEmail)
            onRefreshCounts?.()
            setToast(null)
          }
          showToast(type === 'delete' ? 'Conversation restored' : 'Conversation moved to Deleted', undo)
        }
      }
    } catch (err) {
      console.error('Failed to delete email:', err)
    }
  }

  const handlePermanentDelete = async (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return
    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/permanent`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        setAllEmails(prev => prev.filter(email => email.id !== emailId))
        setTotalEmails(prev => Math.max(0, prev - 1))
        showToast('Permanently deleted')
        // Notify other open lists/instances (e.g. ChatMailPage's own conversation list,
        // sidebar Drafts badge) so a deleted draft disappears everywhere immediately,
        // without requiring a page refresh.
        window.dispatchEvent(new Event('mailRefresh'))
        // Closes any floating/minimized popout panel elsewhere that's editing this exact
        // draft, so deleting it here doesn't leave an orphaned strip referencing a draft
        // that no longer exists.
        window.dispatchEvent(new CustomEvent('chatmail:draftDeleted', { detail: { draftId: emailId } }))
        onRefreshCounts?.()
      }
    } catch (err) {
      console.error('Failed to permanently delete email:', err)
    }
  }

  const handleToggleRead = async (emailId: number | undefined, isRead: boolean | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    if (emailId === undefined || isRead === undefined) return;

    const email = allEmails.find(e => e.id === emailId);
    if (!email) return;
    if (email.folder === 'sent' || email.folder === 'drafts' || email.isScheduled) return;

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
            setParentUnread(prev => Math.max(0, newReadStatus ? prev - 1 : prev + 1));
            onEmailReadChange?.(emailId, newReadStatus)
        }
    } catch (err) {
        console.error('Failed to toggle read status:', err);
    }
  };

  const handleToggleMute = async (emailId: number | undefined, isMuted: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!emailId) return;

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/mute`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_muted: !isMuted }),
      });

      if (response.ok) {
        setAllEmails(allEmails.map(email =>
          email.id === emailId ? { ...email, isMuted: !isMuted } : email
        ));
      }
    } catch (err) {
      console.error('Failed to toggle mute status:', err);
    }
  };

  const handleBulkAction = async (action: 'archive' | 'delete' | 'read' | 'spam' | 'star' | 'restore' | 'permanent_delete', value?: boolean) => {
    const ids = Array.from(selectedEmails).filter((id): id is number => id !== undefined);
    if (ids.length === 0) return;

    try {
      if (action === 'archive') {
        await fetch('http://localhost:5050/api/emails/batch', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ids, action: 'archive' }),
        });
        const archivedEmails = allEmails.filter(email => selectedEmails.has(email.id));
        setAllEmails(allEmails.filter(email => !selectedEmails.has(email.id)));
        setTotalEmails(prev => Math.max(0, prev - archivedEmails.length));
        const undoArchive = async () => {
          await fetch('http://localhost:5050/api/emails/batch', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ids, action: 'archive' }),
          });
          setAllEmails(prev => [...prev, ...archivedEmails]);
          setTotalEmails(prev => prev + archivedEmails.length);
          onRefreshCounts?.();
        };
      showToast(`${ids.length} conversation(s) ${type === 'archived' || type === 'archive' ? 'moved to Inbox' : 'archived'}`, undoArchive);
        onRefreshCounts?.();
      } else if (action === 'delete') {
        await fetch('http://localhost:5050/api/emails/batch', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ids, action: 'delete' }),
        });
        const deletedEmails = allEmails.filter(email => selectedEmails.has(email.id));
      if (type === 'all') {
        setAllEmails(allEmails.map(email => 
          selectedEmails.has(email.id) ? {
            ...email,
            isDeleted: true,
            isStarred: false, isArchived: false, isSnoozed: false,
            isSpam: false, isScheduled: false, label_name: undefined
          } : email
        ));
      } else {
        setAllEmails(allEmails.filter(email => !selectedEmails.has(email.id)));
        setTotalEmails(prev => Math.max(0, prev - deletedEmails.length));
      }
        const undoDelete = async () => {
        // Empty undo for bulk delete to avoid complicated restore logic
        };
      showToast(`${ids.length} conversation(s) moved to Deleted`, undoDelete);
        onRefreshCounts?.();
      window.dispatchEvent(new Event('mailRefresh'));
      ids.forEach(id => window.dispatchEvent(new CustomEvent('chatmail:draftDeleted', { detail: { draftId: id } })))
    } else if (action === 'restore') {
      await Promise.all(ids.map(id =>
        fetch(`http://localhost:5050/api/emails/${id}/restore`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        })
      ));
      if (type === 'all') {
        setAllEmails(allEmails.map(email => 
          selectedEmails.has(email.id) ? { ...email, isDeleted: false } : email
        ));
      } else {
        const removedCount = allEmails.filter(email => selectedEmails.has(email.id)).length;
        setAllEmails(allEmails.filter(email => !selectedEmails.has(email.id)));
        setTotalEmails(prev => Math.max(0, prev - removedCount));
      }
      showToast(`${ids.length} conversation(s) restored`);
      onRefreshCounts?.();
      window.dispatchEvent(new Event('mailRefresh'));
    } else if (action === 'permanent_delete') {
      await Promise.all(ids.map(id =>
        fetch(`http://localhost:5050/api/emails/${id}/permanent`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      ));
      const removedCount = allEmails.filter(email => selectedEmails.has(email.id)).length;
      setAllEmails(allEmails.filter(email => !selectedEmails.has(email.id)));
      setTotalEmails(prev => Math.max(0, prev - removedCount));
      showToast(`${ids.length} conversation(s) permanently deleted`);
      onRefreshCounts?.();
      window.dispatchEvent(new Event('mailRefresh'));
      // Close any floating/minimized popout panel elsewhere that's editing one of these
      // now permanently-deleted drafts.
      ids.forEach(id => window.dispatchEvent(new CustomEvent('chatmail:draftDeleted', { detail: { draftId: id } })))
      } else if (action === 'read') {
        const validIds = ids.filter(id => {
          const em = allEmails.find(e => e.id === id);
          return em && em.folder !== 'sent' && em.folder !== 'drafts' && !em.isScheduled;
        });
        if (validIds.length > 0) {
          await fetch('http://localhost:5050/api/emails/batch', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ids: validIds, action: 'read', value }),
          });
          const unreadDelta = validIds.reduce((acc, id) => {
            const em = allEmails.find(e => e.id === id);
            if (!em) return acc;
            if (value && !em.isRead) return acc - 1;
            if (!value && em.isRead) return acc + 1;
            return acc;
          }, 0);
          setAllEmails(allEmails.map(email =>
            validIds.includes(email.id) ? { ...email, isRead: value } : email
          ));
          setParentUnread(prev => Math.max(0, prev + unreadDelta));
          showToast(`${validIds.length} conversation(s) marked as ${value ? 'read' : 'unread'}`, undefined);
          onRefreshCounts?.();
        }
      } else if (action === 'star') {
        await fetch('http://localhost:5050/api/emails/batch', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ids, action: 'star', value }),
        });
        setAllEmails(allEmails.map(email =>
          selectedEmails.has(email.id) ? { ...email, isStarred: value } : email
        ));
        showToast(`${ids.length} conversation(s) ${value ? 'starred' : 'unstarred'}`, undefined);
      } else if (action === 'spam') {
        await Promise.all(ids.map(id =>
          fetch(`http://localhost:5050/api/emails/${id}/spam`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
          })
        ));
        const spamEmails = allEmails.filter(email => selectedEmails.has(email.id));
        setAllEmails(allEmails.filter(email => !selectedEmails.has(email.id)));
        setTotalEmails(prev => Math.max(0, prev - spamEmails.length));
        const undoSpam = async () => {
          await Promise.all(ids.map(id =>
            fetch(`http://localhost:5050/api/emails/${id}/spam`, {
              method: 'PUT',
              headers: { Authorization: `Bearer ${token}` },
            })
          ));
          setAllEmails(prev => [...prev, ...spamEmails]);
          setTotalEmails(prev => prev + spamEmails.length);
          onRefreshCounts?.();
        };
        showToast(`${ids.length} conversation(s) marked as spam`, undoSpam);
        onRefreshCounts?.();
      }
      setSelectedEmails(new Set());
    } catch (err) {
      console.error('Failed to bulk action:', err);
    }
  };

  const handleSnoozeClick = (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return
    if (snoozeMenuOpen === emailId) {
      setSnoozeMenuOpen(null)
      setSnoozeMenuPosition(null)
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const dropdownHeight = 280
      const spaceBelow = window.innerHeight - rect.bottom - 8
      const spaceAbove = rect.top - 8
      if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
        setSnoozeMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.left, maxHeight: Math.max(spaceBelow, 120) })
      } else {
        setSnoozeMenuPosition({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.left, maxHeight: Math.max(spaceAbove, 120) })
      }
      setSnoozeMenuOpen(emailId)
      setCustomSnoozeDate('')
      window.dispatchEvent(new Event('contentDropdownOpened'))
    }
    setMoveMenuOpen(null)
    setMoveMenuPosition(null)
    setContextMenu(null)
  }

  const handleBulkSnoozeConfirm = async (hours: number) => {
    const ids = Array.from(selectedEmails).filter((id): id is number => id !== undefined);
    if (ids.length === 0) return;

    setBulkSnoozeMenuOpen(false);

    try {
      await Promise.all(ids.map(id =>
        fetch(`http://localhost:5050/api/emails/${id}/snooze`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ hours }),
        })
      ));

      if (type === 'inbox' || type === 'all') {
        const removedCount = allEmails.filter(email => selectedEmails.has(email.id)).length;
        setAllEmails(allEmails.filter(email => !selectedEmails.has(email.id)));
        setTotalEmails(prev => Math.max(0, prev - removedCount));
      } else {
        const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        setAllEmails(allEmails.map(email =>
          selectedEmails.has(email.id) ? { ...email, isSnoozed: true, snoozedUntil } : email
        ));
      }
      const bulkSnoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      setChildEmailsMap(prev => {
        const next = new Map(prev)
        next.forEach((emails, key) => next.set(key, emails.map(e => selectedEmails.has(e.id) ? { ...e, isSnoozed: true, snoozedUntil: bulkSnoozedUntil } : e)))
        return next
      })

      showToast(`${ids.length} conversation(s) snoozed`, undefined);
      setSelectedEmails(new Set());
    } catch (err) {
      console.error('Failed to snooze emails:', err);
    }
  }

  const handleBulkMute = async () => {
    const ids = Array.from(selectedEmails).filter((id): id is number => id !== undefined);
    if (ids.length === 0) return;

    try {
      await Promise.all(ids.map(id =>
        fetch(`http://localhost:5050/api/emails/${id}/mute`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ is_muted: true }),
        })
      ));

      setAllEmails(allEmails.map(email =>
        selectedEmails.has(email.id) ? { ...email, isMuted: true } : email
      ));

      showToast(`${ids.length} conversation(s) muted`, undefined);
      setBulkMoreMenuOpen(false);
      setSelectedEmails(new Set());
    } catch (err) {
      console.error('Failed to mute emails:', err);
    }
  }

  const handleBulkUnmute = async () => {
    const ids = Array.from(selectedEmails).filter((id): id is number => id !== undefined);
    if (ids.length === 0) return;

    try {
      await Promise.all(ids.map(id =>
        fetch(`http://localhost:5050/api/emails/${id}/mute`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ is_muted: false }),
        })
      ));

      setAllEmails(allEmails.map(email =>
        selectedEmails.has(email.id) ? { ...email, isMuted: false } : email
      ));

      showToast(`${ids.length} conversation(s) unmuted`, undefined);
      setBulkMoreMenuOpen(false);
      setSelectedEmails(new Set());
    } catch (err) {
      console.error('Failed to unmute emails:', err);
    }
  }

  // Main-section / header toolbar — explicit-direction bulk actions (mirrors ChatMailPage) ──
  const selectedEmailsList = allEmails.filter(email => selectedEmails.has(email.id))
  const toolbarAllRead = selectedEmailsList.length > 0 && selectedEmailsList.every(e => e.isRead)
  const toolbarAllUnread = selectedEmailsList.length > 0 && selectedEmailsList.every(e => !e.isRead)
  const toolbarAnyArchived = selectedEmailsList.some(e => e.isArchived)
  const toolbarAllArchived = selectedEmailsList.length > 0 && selectedEmailsList.every(e => e.isArchived)
  const toolbarAllUnarchived = selectedEmailsList.length > 0 && selectedEmailsList.every(e => !e.isArchived)
  const toolbarAllStarred = selectedEmailsList.length > 0 && selectedEmailsList.every(e => e.isStarred)
  const toolbarAllUnstarred = selectedEmailsList.length > 0 && selectedEmailsList.every(e => !e.isStarred)
  const toolbarAllSnoozed = selectedEmailsList.length > 0 && selectedEmailsList.every(e => e.isSnoozed)
  const toolbarAllUnsnoozed = selectedEmailsList.length > 0 && selectedEmailsList.every(e => !e.isSnoozed)
  const getContactEmail = (email: Email) => ((email.folder === 'sent' || email.folder === 'drafts' || type === 'drafts' || type === 'scheduled') ? email.to : email.from)?.split(',')[0]?.trim()?.toLowerCase() || ''
  const toolbarAllGrouped = selectedEmailsList.length > 0 && selectedEmailsList.every(e => groupedEmails.has(getContactEmail(e)))
  const toolbarAllUngrouped = selectedEmailsList.length > 0 && selectedEmailsList.every(e => !groupedEmails.has(getContactEmail(e)))
  const toolbarAnySpam = selectedEmailsList.some(e => e.isSpam)
  const toolbarAllSpam = selectedEmailsList.length > 0 && selectedEmailsList.every(e => e.isSpam)
  const toolbarAllUnspam = selectedEmailsList.length > 0 && selectedEmailsList.every(e => !e.isSpam)
  const toolbarAnyReported = selectedEmailsList.some(e => e.isReport)
  const toolbarAllReported = selectedEmailsList.length > 0 && selectedEmailsList.every(e => e.isReport)
  const toolbarAllUnreported = selectedEmailsList.length > 0 && selectedEmailsList.every(e => !e.isReport)
  const toolbarAnyPinned = selectedEmailsList.some(e => e.isPinned)
  const toolbarAllPinned = selectedEmailsList.length > 0 && selectedEmailsList.every(e => e.isPinned)
  const toolbarAllUnpinned = selectedEmailsList.length > 0 && selectedEmailsList.every(e => !e.isPinned)
  const toolbarAnyDeleted = selectedEmailsList.some(e => e.isDeleted)
  const toolbarAllDeleted = selectedEmailsList.length > 0 && selectedEmailsList.every(e => e.isDeleted)
  const toolbarAllUndeleted = selectedEmailsList.length > 0 && selectedEmailsList.every(e => !e.isDeleted)
  const toolbarAnyMuted = selectedEmailsList.some(e => e.isMuted)
  const toolbarAllMuted = selectedEmailsList.length > 0 && selectedEmailsList.every(e => e.isMuted)
  const toolbarAllUnmuted = selectedEmailsList.length > 0 && selectedEmailsList.every(e => !e.isMuted)

  const handleSetRead = (force?: boolean) => handleBulkAction('read', force ?? !toolbarAllRead)
  const handleSetStar = (force?: boolean) => handleBulkAction('star', force ?? true)
  const handleSetArchive = async (force?: boolean) => {
    const nextArchived = force ?? !toolbarAnyArchived
    const ids = Array.from(selectedEmails).filter((id): id is number => id !== undefined)
    if (ids.length === 0) return
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/archive`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_archived: nextArchived }) })))
      setAllEmails(prev => prev.map(e => ids.includes(e.id) ? { ...e, isArchived: nextArchived } : e))
      showToast(`${ids.length} conversation(s) ${nextArchived ? 'archived' : 'unarchived'}`, undefined)
      onRefreshCounts?.()
      setSelectedEmails(new Set())
    } catch (err) { console.error('Failed to archive emails:', err) }
  }
  const handleSetSpam = async (force?: boolean) => {
    const nextSpam = force ?? !toolbarAnySpam
    const ids = Array.from(selectedEmails).filter((id): id is number => id !== undefined)
    if (ids.length === 0) return
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/spam`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_spam: nextSpam }) })))
      setAllEmails(prev => prev.map(e => ids.includes(e.id) ? { ...e, isSpam: nextSpam } : e))
      showToast(`${ids.length} conversation(s) ${nextSpam ? 'marked as spam' : 'not spam'}`, undefined)
      onRefreshCounts?.()
      setSelectedEmails(new Set())
    } catch (err) { console.error('Failed to mark spam:', err) }
  }
  const handleSetReport = async (force?: boolean) => {
    const nextReport = force ?? !toolbarAnyReported
    const ids = Array.from(selectedEmails).filter((id): id is number => id !== undefined)
    if (ids.length === 0) return
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/report`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_report: nextReport }) })))
      setAllEmails(prev => prev.map(e => ids.includes(e.id) ? { ...e, isReport: nextReport } : e))
      showToast(`${ids.length} conversation(s) ${nextReport ? 'reported' : 'unreported'}`, undefined)
      setSelectedEmails(new Set())
    } catch (err) { console.error('Failed to report emails:', err) }
  }
  const handleSetPin = async (force?: boolean) => {
    const nextPinned = force ?? !toolbarAnyPinned
    const ids = Array.from(selectedEmails).filter((id): id is number => id !== undefined)
    if (ids.length === 0) return
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/pin`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_pinned: nextPinned }) })))
      setAllEmails(prev => prev.map(e => ids.includes(e.id) ? { ...e, isPinned: nextPinned } : e))
      showToast(`${ids.length} conversation(s) ${nextPinned ? 'pinned' : 'unpinned'}`, undefined)
      setSelectedEmails(new Set())
    } catch (err) { console.error('Failed to pin emails:', err) }
  }
  const handleSetMute = (force?: boolean) => (force ?? !toolbarAllMuted) ? handleBulkMute() : handleBulkUnmute()
  const handleSetSnooze = (hours: number) => handleBulkSnoozeConfirm(hours)
  const handleRestore = () => handleBulkAction('restore')
  const handleSetDeleted = (force?: boolean) => (force ?? !toolbarAnyDeleted) ? handleBulkAction('delete') : handleRestore()
  const handleSetLabel = async (labelName: string) => {
    const ids = Array.from(selectedEmails).filter((id): id is number => id !== undefined)
    if (ids.length === 0) return
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/label`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ label_name: labelName }) })))
      fetchAllMails()
      showToast(`${ids.length} conversation(s) moved to ${labelName}`, undefined)
      setSelectedEmails(new Set())
    } catch (err) { console.error('Failed to apply label:', err) }
  }

  // Broadcast this page's toolbar state to App.tsx's shared main-action section, the same
  // way ChatMailPage does — lets one toolbar UI serve both pages without duplicating it.
  const broadcastMailPageStateRef = useRef<() => void>(() => {})
  useEffect(() => {
    broadcastMailPageStateRef.current = () => {
      window.dispatchEvent(new CustomEvent('mailpage:state', {
        detail: {
          active: true,
          selectionMode,
          hasSelection: selectedEmails.size > 0,
          convAllRead: toolbarAllRead,
          convAllUnread: toolbarAllUnread,
          convAnyArchived: toolbarAnyArchived,
          convAllArchived: toolbarAllArchived,
          convAllUnarchived: toolbarAllUnarchived,
          convAllStarred: toolbarAllStarred,
          convAllUnstarred: toolbarAllUnstarred,
          convAllSnoozed: toolbarAllSnoozed,
          convAllUnsnoozed: toolbarAllUnsnoozed,
          convAllGrouped: toolbarAllGrouped,
          convAllUngrouped: toolbarAllUngrouped,
          convAnySpam: toolbarAnySpam,
          convAllSpam: toolbarAllSpam,
          convAllUnspam: toolbarAllUnspam,
          convAnyReported: toolbarAnyReported,
          convAllReported: toolbarAllReported,
          convAllUnreported: toolbarAllUnreported,
          convAnyPinned: toolbarAnyPinned,
          convAllPinned: toolbarAllPinned,
          convAllUnpinned: toolbarAllUnpinned,
          convAnyDeleted: toolbarAnyDeleted,
          convAllDeleted: toolbarAllDeleted,
          convAllUndeleted: toolbarAllUndeleted,
          convAnyMuted: toolbarAnyMuted,
          convMuted: toolbarAllMuted,
          convAllUnmuted: toolbarAllUnmuted,
          viewMode: 'list',
          zoomLevel: readerZoomLevel,
          immersiveMode,
        }
      }))
    }
    broadcastMailPageStateRef.current()
  }, [selectionMode, selectedEmails, allEmails, readerZoomLevel, immersiveMode, groupedEmails])

  useEffect(() => {
    const handler = () => broadcastMailPageStateRef.current()
    window.addEventListener('mailpage:requestState', handler)
    return () => window.removeEventListener('mailpage:requestState', handler)
  }, [])

  useEffect(() => {
    return () => { window.dispatchEvent(new CustomEvent('mailpage:state', { detail: { active: false } })) }
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const { action, payload } = (e as CustomEvent).detail
      if (action === 'setRead') handleSetRead(payload)
      else if (action === 'setArchive') handleSetArchive(payload)
      else if (action === 'setStar') handleSetStar(payload)
      else if (action === 'snooze') handleSetSnooze(payload)
      else if (action === 'setSpam') handleSetSpam(payload)
      else if (action === 'setReport') handleSetReport(payload)
      else if (action === 'setPin') handleSetPin(payload)
      else if (action === 'setDeleted') handleSetDeleted(payload)
      else if (action === 'setMute') handleSetMute(payload)
      else if (action === 'printConv') window.print()
      else if (action === 'applyLabel') handleSetLabel(payload)
      else if (action === 'toggleImmersive') setImmersiveMode(v => !v)
      else if (action === 'setZoom') setReaderZoomLevel(payload)
      else if (action === 'group' || action === 'ungroup' || action === 'setBlock') { /* no backend concept for plain emails */ }
    }
    window.addEventListener('mailpage:action', handler)
    return () => window.removeEventListener('mailpage:action', handler)
  }, [selectionMode, selectedEmails, allEmails])

  const handleSnoozeConfirm = async (emailId: number, hours: number) => {
    setSnoozeMenuOpen(null)
    setSnoozeMenuPosition(null)

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
        if (hours === 0) {
          // Unsnooze: clear snooze state
          const originalEmail = allEmails.find(e => e.id === emailId)
          const originalSnoozedUntil = originalEmail?.snoozedUntil
          setAllEmails(prev => prev.map(email =>
            email.id === emailId ? { ...email, isSnoozed: false, snoozedUntil: undefined } : email
          ))
          if (type === 'snoozed') fetchAllMails()
          const undoUnsnooze = async () => {
            if (originalSnoozedUntil) {
              const reSnoozeHours = (new Date(originalSnoozedUntil).getTime() - Date.now()) / (1000 * 60 * 60)
              await fetch(`http://localhost:5050/api/emails/${emailId}/snooze`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ hours: Math.max(reSnoozeHours, 0.01) }),
              })
            }
            fetchAllMails()
            setToast(null)
          }
          showToast('Snooze removed', undoUnsnooze)
        } else {
          // Snooze: optimistic remove from non-snoozed views
          const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
          if (type === 'inbox') {
            setAllEmails(prev => prev.filter(email => email.id !== emailId));
            setTotalEmails(prev => Math.max(0, prev - 1));
          } else {
            setAllEmails(prev => prev.map(email => email.id === emailId ? { ...email, isSnoozed: true, snoozedUntil } : email));
          }
          setChildEmailsMap(prev => {
            const next = new Map(prev)
            next.forEach((emails, key) => next.set(key, emails.map(e => e.id === emailId ? { ...e, isSnoozed: true, snoozedUntil } : e)))
            return next
          })
          fetchAllMails()
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
      }
    } catch (err) {
      console.error('Failed to snooze email:', err);
    }
  }


  const handleToggleSpam = async (emailId: number | undefined, isSpam: boolean | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return
    const email = allEmails.find(em => em.id === emailId)
    if (email && (email.folder === 'sent' || email.folder === 'drafts' || email.isScheduled)) return

    try {
      const response = await fetch(`http://localhost:5050/api/emails/${emailId}/spam`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        if (type === 'spam' || type === 'inbox' || type === 'delete') {
          setAllEmails(allEmails.filter(email => email.id !== emailId))
          setTotalEmails(prev => Math.max(0, prev - 1))
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
    if (moveMenuOpen === emailId) {
      setMoveMenuOpen(null)
      setMoveMenuPosition(null)
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const dropdownHeight = 600
      const spaceBelow = window.innerHeight - rect.bottom - 8
      const spaceAbove = rect.top - 8
      if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
        setMoveMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.left, maxHeight: Math.max(spaceBelow, 300) })
      } else {
        setMoveMenuPosition({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.left, maxHeight: Math.max(spaceAbove, 300) })
      }
      setLabelSearchQuery('')
      // Expand all parent labels so the full tree is visible on open
      const collectParentIds = (nodes: any[]): number[] =>
        nodes.flatMap(n => n.children?.length ? [n.id, ...collectParentIds(n.children)] : [])
      setExpandedMoveLabels(new Set(collectParentIds(labels)))
      setMoveMenuOpen(emailId)
      window.dispatchEvent(new Event('contentDropdownOpened'))
    }
    setSnoozeMenuOpen(null)
    setSnoozeMenuPosition(null)
    setContextMenu(null)
  }

  const handleApplyLabel = async (emailId: number, targetLabel: string) => {
    setMoveMenuOpen(null)
    setMoveMenuPosition(null)

    try {
      await fetch(`http://localhost:5050/api/emails/${emailId}/label`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label_name: targetLabel }),
      })
      if (type === 'delete') {
        setAllEmails(prev => prev.filter(e => e.id !== emailId))
        setTotalEmails(prev => Math.max(0, prev - 1))
      } else {
        fetchAllMails()
      }

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
      childEmailsMap.forEach(emails => emails.forEach(e => allEmailIds.add(e.id)));
      setSelectedEmails(allEmailIds);
      setSelectAllAcrossPages(false);
    } else {
      setSelectedEmails(new Set());
      setSelectAllAcrossPages(false);
    }
  };

  const handleDropdownSelect = (selectionType: string) => {
    setMailHeaderCheckboxDropdownOpen(false);
    const childEmails = Array.from(childEmailsMap.values()).flat();
    const combinedEmails = [...allEmails, ...childEmails];
    switch (selectionType) {
      case 'all':
        setSelectedEmails(new Set(combinedEmails.map(email => email.id)));
        setSelectAllAcrossPages(false);
        break;
      case 'none':
        setSelectedEmails(new Set());
        setSelectAllAcrossPages(false);
        break;
      case 'read':
        setSelectedEmails(new Set(combinedEmails.filter(e => e.isRead && e.folder !== 'sent' && e.folder !== 'drafts' && !e.isScheduled && !e.isDraft).map(e => e.id)));
        setSelectAllAcrossPages(false);
        break;
      case 'unread':
        setSelectedEmails(new Set(combinedEmails.filter(e => !e.isRead && e.folder !== 'sent' && e.folder !== 'drafts' && !e.isScheduled && !e.isDraft).map(e => e.id)));
        setSelectAllAcrossPages(false);
        break;
      case 'starred':
        setSelectedEmails(new Set(combinedEmails.filter(e => e.isStarred).map(e => e.id)));
        setSelectAllAcrossPages(false);
        break;
      case 'unstarred':
        setSelectedEmails(new Set(combinedEmails.filter(e => !e.isStarred).map(e => e.id)));
        setSelectAllAcrossPages(false);
        break;
      default:
        break;
    }
  };

  const handleGroupDropdownSelect = (selectionType: string, groupEmails: Email[], isYearGroup: boolean) => {
    setOpenDateGroupDropdown(null)
    const groupIds = groupEmails.map(e => e.id);
    const newSelectedEmails = new Set(selectedEmails);

    switch (selectionType) {
      case 'all':
        groupIds.forEach(id => newSelectedEmails.add(id));
        break;
      case 'none':
        groupIds.forEach(id => newSelectedEmails.delete(id));
        break;
      case 'read':
        groupEmails.forEach(e => {
          if (e.isRead && e.folder !== 'sent' && e.folder !== 'drafts' && !e.isScheduled && !e.isDraft) newSelectedEmails.add(e.id);
          else newSelectedEmails.delete(e.id);
        });
        break;
      case 'unread':
        groupEmails.forEach(e => {
          if (!e.isRead && e.folder !== 'sent' && e.folder !== 'drafts' && !e.isScheduled && !e.isDraft) newSelectedEmails.add(e.id);
          else newSelectedEmails.delete(e.id);
        });
        break;
      case 'starred':
        groupEmails.forEach(e => {
          if (e.isStarred) newSelectedEmails.add(e.id);
          else newSelectedEmails.delete(e.id);
        });
        break;
      case 'unstarred':
        groupEmails.forEach(e => {
          if (!e.isStarred) newSelectedEmails.add(e.id);
          else newSelectedEmails.delete(e.id);
        });
        break;
      default:
        break;
    }
    setSelectedEmails(newSelectedEmails);
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
    window.dispatchEvent(new Event('contentDropdownOpened'))
    setMoveMenuOpen(null)
    setMoveMenuPosition(null)
    setSnoozeMenuOpen(null)
    setSnoozeMenuPosition(null)
  }

  const handleEmailAction = (action: 'reply' | 'replyAll' | 'forward', email: Email, e: React.MouseEvent) => {
    e.stopPropagation()
    if (onReply) {
      onReply(action, email)
      return
    }
    const replyTo = (type === 'sent' || email.folder === 'sent') ? email.to : email.from
    navigate('/compose', { state: { action: action === 'replyAll' ? 'reply' : action, email, replyTo: action !== 'forward' ? replyTo : undefined } })
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
      if (onReply) {
        onReply(action as 'reply' | 'forward', contextMenu.email)
      } else {
        let replyTo = contextMenu.email.from
        if (type === 'sent' || contextMenu.email.folder === 'sent') {
          replyTo = contextMenu.email.to
        }
        navigate('/compose', { state: { action, email: contextMenu.email, replyTo: action === 'reply' ? replyTo : undefined } })
      }
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

  const toggleChildSection = async (_child: any, fullName: string) => {
    const isExpanded = expandedChildSections.has(fullName)
    setExpandedChildSections(prev => {
      const next = new Set(prev)
      isExpanded ? next.delete(fullName) : next.add(fullName)
      return next
    })
    if (!isExpanded && !childEmailsMap.has(fullName)) {
      setLoadingChildSections(prev => new Set(prev).add(fullName))
      try {
        const res = await fetch(`http://localhost:5050/api/labels/${encodeURIComponent(fullName)}?page=1&limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setChildEmailsMap(prev => new Map(prev).set(fullName, data.emails || []))
        }
      } catch (_) {}
      setLoadingChildSections(prev => { const s = new Set(prev); s.delete(fullName); return s })
    }
  }

  const updateChildEmail = (childKey: string, emailId: number, updates: Partial<Email>) => {
    setChildEmailsMap(prev => {
      const next = new Map(prev)
      const emails = next.get(childKey) || []
      next.set(childKey, emails.map(e => e.id === emailId ? { ...e, ...updates } : e))
      return next
    })
  }

  const removeChildEmail = (childKey: string, emailId: number) => {
    setChildEmailsMap(prev => {
      const next = new Map(prev)
      const emails = next.get(childKey) || []
      next.set(childKey, emails.filter(e => e.id !== emailId))
      return next
    })
  }

  const sectionIcon = (() => {
    const s: React.CSSProperties = { flexShrink: 0 }
    switch (type) {
      case 'inbox':         return <Inbox size={22} style={{ ...s, color: '#64b5f6' }} />
      case 'sent':          return <Send size={22} style={{ ...s, color: '#4db6ac' }} />
      case 'starred':       return <Star size={22} style={{ ...s, color: '#ffc107', fill: '#ffc107' }} />
      case 'snoozed':       return <Clock size={22} style={{ ...s, color: '#fb8c00' }} />
      case 'drafts':        return <Edit size={22} style={{ ...s, color: '#ff5722' }} />
      case 'archived':      return <Archive size={22} style={{ ...s, color: '#7986cb' }} />
      case 'scheduled':     return <span className="active-scheduled-icon-bg" style={{ width: 22, height: 22, backgroundSize: '22px 22px', margin: 0, flexShrink: 0 }} />
      case 'important':     return <Flag size={22} style={{ ...s, color: '#f4b400' }} />
      case 'spam':          return <AlertOctagon size={22} style={{ ...s, color: '#e91e63' }} />
      case 'trash':
      case 'delete':        return <Trash2 size={22} style={{ ...s, color: '#f48fb1' }} />
      case 'subscriptions': return <Bell size={22} style={{ ...s, color: '#000' }} />
      case 'reports':       return <BarChart2 size={22} style={{ ...s, color: '#7b5ea7' }} />
      case 'all':           return <Mail size={22} style={{ ...s, color: '#1e88e5' }} />
      case 'purchased':     return <CreditCard size={22} style={{ ...s, color: '#888' }} />
      case 'label': {
        const lastName = labelName ? decodeURIComponent(labelName).split(' / ').pop() || '' : ''
        const node = currentLabelNode ?? findLabelByLastName(labels, lastName)
        const color = node?.color || '#888'
        // Exact sidebar active state: fill=label.color, color/stroke=white (solid colored icon, outline hidden)
        const ls: React.CSSProperties = { flexShrink: 0, color: 'white', stroke: 'white', fill: color }
        if (node?.children?.length) {
          try {
            const saved = localStorage.getItem('expandedLabelGroups')
            const expandedIds: number[] = saved ? JSON.parse(saved) : []
            const isExpanded = node.id && expandedIds.includes(node.id)
            return isExpanded
              ? <FolderOpen size={22} style={ls} />
              : <Folder size={22} style={ls} />
          } catch {
            return <Folder size={22} style={ls} />
          }
        }
        return <Tag size={22} style={ls} />
      }
      default:              return null
    }
  })()

  const sectionName = (() => {
    switch (type) {
      case 'inbox':         return 'Inbox'
      case 'sent':          return 'Sent'
      case 'starred':       return 'Starred'
      case 'snoozed':       return 'Snoozed'
      case 'drafts':        return 'Drafts'
      case 'archived':      return 'Archive'
      case 'scheduled':     return 'Scheduled'
      case 'important':     return 'Important'
      case 'spam':          return 'Spam'
      case 'trash':
      case 'delete':        return 'Trash'
      case 'subscriptions': return 'Subscriptions'
      case 'reports':       return 'Reports'
      case 'all':           return 'All Mails'
      case 'purchased':     return 'Purchased'
      case 'label': {
        const lastName = labelName ? decodeURIComponent(labelName).split(' / ').pop() || '' : ''
        return lastName
      }
      default:              return ''
    }
  })()

  const hasAnyEmails = filteredEmails.length > 0 || Array.from(childEmailsMap.values()).some(arr => arr.length > 0)

  const headerDivider = <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0', flexShrink: 0, margin: '0 3px' }} />

  const pageRangeAndArrows = (
    <>
      <span className="header-page-info">
        {filteredEmails.length > 0 ? `${(page - 1) * pageSize + 1}-${(page - 1) * pageSize + filteredEmails.length} of ${totalEmails || filteredEmails.length}` : '0-0 of 0'}
      </span>
      {headerDivider}
      <button
        className="header-pagination-btn"
        disabled={page === 1 || loading}
        onClick={() => setPage(p => Math.max(1, p - 1))}
        title="Newer"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        className="header-pagination-btn"
        disabled={(page - 1) * pageSize + allEmails.length >= (totalEmails || allEmails.length) || loading}
        onClick={() => setPage(p => p + 1)}
        title="Older"
      >
        <ChevronRight size={24} />
      </button>
    </>
  )

  const readerEmails = selectionMode && selectedEmails.size > 0
    ? filteredEmails.filter(e => selectedEmails.has(e.id))
    : filteredEmails

  return (
    <div className="email-container" style={{ position: 'relative' }}>
      {immersiveMode && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '720px', maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <BookOpen size={18} color="#4db6ac" />
              <span style={{ fontWeight: 600, fontSize: '15px', flex: 1 }}>
                Immersive Reader{selectionMode && selectedEmails.size > 0 ? ` — ${selectedEmails.size} selected` : sectionName ? ` — ${sectionName}` : ''}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {[80, 90, 100, 110, 125].map(lv => <button key={lv} onClick={() => setReaderZoomLevel(lv)} style={{ padding: '2px 7px', borderRadius: '4px', border: '1px solid #ddd', background: readerZoomLevel === lv ? '#e3f2fd' : 'white', color: readerZoomLevel === lv ? '#2196f3' : '#666', fontSize: '11px', cursor: 'pointer' }}>{lv}%</button>)}
              </div>
              <button onClick={() => setImmersiveMode(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', color: '#666' }}><XIcon size={18} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 36px', display: 'flex', flexDirection: 'column', gap: '24px', lineHeight: 1.8, fontFamily: 'Georgia, serif', fontSize: `${readerZoomLevel}%` }}>
              {readerEmails.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', marginTop: '40px' }}>No emails to read</div>
              ) : readerEmails.map(email => {
                const incoming = email.folder !== 'sent'
                return (
                  <div key={email.id} style={{ maxWidth: '640px', alignSelf: 'stretch' }}>
                    <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px' }}>
                      {incoming ? email.from : email.to} · {new Date(email.date).toLocaleString()}
                    </div>
                    {email.subject && <div style={{ fontWeight: 700, marginBottom: '6px', color: '#222' }}>{email.subject}</div>}
                    <div style={{ whiteSpace: 'pre-wrap', color: '#222', background: '#f5f5f5', padding: '12px 16px', borderRadius: '8px' }}>{email.body}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
      <div className="mail-header">
        {selectedEmails.size > 0 ? (
          <div className="mail-header-actions">
            <div className="checkbox-dropdown" style={{ marginLeft: '18px', position: 'relative' }}>
              {sectionIcon && (
                <span style={{ position: 'absolute', right: 'calc(100% + 4px)', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                  {sectionIcon}
                </span>
              )}
              <input type="checkbox" className="mail-checkbox" ref={mainCheckboxRef} checked={true} onChange={handleSelectAll} style={{ marginLeft: '0', width: '16px', height: '16px' }} />
              <button className="checkbox-dropdown-btn" onClick={(e) => { e.stopPropagation(); setMailHeaderCheckboxDropdownOpen(!mailHeaderCheckboxDropdownOpen); }} style={{ width: '15px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronDown size={16} />
              </button>
              {mailHeaderCheckboxDropdownOpen && (
                <div className="checkbox-dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 10003 }} onClick={(e) => e.stopPropagation()}>
                  <button className="dropdown-option" onClick={() => handleDropdownSelect('all')}>All</button>
                  <button className="dropdown-option" onClick={() => handleDropdownSelect('none')}>None</button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <span style={{ fontSize: '13px', color: '#666', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap', display: 'inline-block', minWidth: '68px', marginLeft: '8px' }}>{selectedEmails.size} selected</span>
              {headerDivider}
              <div className="header-pagination">{pageRangeAndArrows}</div>
            </div>
          </div>
        ) : (
          <div className="mail-header-controls">
            {!selectionMode && sectionIcon && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', marginLeft: '-8px' }}>
                {sectionIcon}
                {sectionName && <span style={{ fontSize: '14px', fontWeight: 600, color: '#444' }}>{sectionName}</span>}
              </span>
            )}
            {selectionMode && (
              <>
                <div className="checkbox-dropdown" style={{ marginLeft: '18px', position: 'relative' }}>
                  {sectionIcon && (
                    <span style={{ position: 'absolute', right: 'calc(100% + 4px)', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                      {sectionIcon}
                    </span>
                  )}
                  <input type="checkbox" className="mail-checkbox" ref={mainCheckboxRef} checked={filteredEmails.length > 0 && selectedEmails.size === filteredEmails.length + Array.from(childEmailsMap.values()).reduce((sum, arr) => sum + arr.length, 0)} onChange={handleSelectAll} style={{ width: '16px', height: '16px' }} />
                  <button className="checkbox-dropdown-btn" onClick={(e) => { e.stopPropagation(); setMailHeaderCheckboxDropdownOpen(!mailHeaderCheckboxDropdownOpen); }} title="Filter options" style={{ width: '15px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronDown size={16} />
                  </button>
                    {mailHeaderCheckboxDropdownOpen && (
                      <div className="checkbox-dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 10003 }} onClick={(e) => e.stopPropagation()}>
                        <button className="dropdown-option" onClick={() => handleDropdownSelect('all')}>All</button>
                        <button className="dropdown-option" onClick={() => handleDropdownSelect('none')}>None</button>
                        {type !== 'sent' && type !== 'drafts' && type !== 'scheduled' && (
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  <span style={{ fontSize: '13px', color: '#666', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap', display: 'inline-block', minWidth: '68px', marginLeft: '8px' }}>{selectedEmails.size} selected</span>
                  {headerDivider}
                  <div className="header-pagination">{pageRangeAndArrows}</div>
                </div>
              </>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', cursor: 'default' }}>
            <button
              disabled={!hasAnyEmails}
              onClick={() => { if (!hasAnyEmails) return; setSelectionMode(v => !v); if (selectionMode) setSelectedEmails(new Set()) }}
              title={!hasAnyEmails ? 'No emails to select' : selectionMode ? 'Exit selection mode' : 'Select emails'}
              style={{
                background: selectionMode ? '#eeeeff' : 'none',
                border: selectionMode ? '1px solid #999' : '1px solid #ddd',
                cursor: hasAnyEmails ? 'pointer' : 'not-allowed',
                color: selectionMode ? '#667eea' : '#666',
                opacity: hasAnyEmails ? 1 : 0.4,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '30px',
                width: '30px',
                borderRadius: '50%',
                transition: 'all 0.2s ease',
                position: 'relative',
                boxShadow: selectionMode ? '0 2px 4px rgba(0, 0, 0, 0.4)' : 'none',
                flexShrink: 0,
              }}
            >
              <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, transform: 'translate(1px, 2px)' }}>
                <span style={{ position: 'absolute', top: -0.5, left: -0.5, width: 12, height: 12, borderTop: '1.5px solid currentColor', borderLeft: '1.5px solid currentColor', borderRadius: '3px 0 0 0' }} />
                <Square size={20} strokeWidth={1.5} />
              </span>
            </button>
            <span style={{ fontSize: '9px', lineHeight: 1, whiteSpace: 'nowrap', color: '#666' }}>{selectionMode ? 'Cancel' : 'Select'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', cursor: 'default', flexShrink: 0 }}>
            <button
              onClick={() => fetchAllMails()}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#666',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8e8e8'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Refresh"
            >
              <RefreshCw size={24} strokeWidth={1.5} />
            </button>
            <span style={{ fontSize: '9px', lineHeight: 1, whiteSpace: 'nowrap', color: '#666' }}>Refresh</span>
          </div>
          {selectionMode && (
            <>
              <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0', flexShrink: 0, margin: '0 4px' }} />
              {[
                { icon: <span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={20} strokeWidth={1.5} /><span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span>, label: 'Unread', title: 'Mark as unread', accent: '#2196f3', onClick: () => handleSetRead(false) },
                { icon: <ArchiveRestore size={20} strokeWidth={1.5} />, label: 'Unarchive', title: 'Unarchive', accent: '#7986cb', onClick: () => handleSetArchive(false) },
                { icon: <StarOff size={20} strokeWidth={1.5} />, label: 'Unstar', title: 'Unstar', accent: '#ffc107', onClick: () => handleSetStar(false) },
                { icon: <AlarmClockOff size={20} strokeWidth={1.5} />, label: 'Unsnooze', title: 'Remove snooze', accent: '#fb8c00', onClick: () => handleSetSnooze(0) },
                { icon: <UserMinus size={20} strokeWidth={1.5} />, label: 'Ungroup', title: 'Remove from group', accent: '#ab47bc', onClick: () => {} },
                { icon: <RotateCcw size={20} strokeWidth={1.5} />, label: 'Restore', title: 'Restore', accent: '#f44336', onClick: () => handleRestore() },
                { icon: <EyeOff size={20} strokeWidth={1.5} />, label: 'Hide', title: 'Hide/show deleted', accent: '#90a4ae', onClick: () => {} },
                { icon: <ShieldCheck size={20} strokeWidth={1.5} />, label: 'Unspam', title: 'Not spam', accent: '#e91e63', onClick: () => handleSetSpam(false) },
                { icon: <FlagOff size={20} strokeWidth={1.5} />, label: 'Unreport', title: 'Unreport', accent: '#f57c00', onClick: () => handleSetReport(false) },
                { icon: <PinOff size={20} strokeWidth={1.5} />, label: 'Unpin', title: 'Unpin', accent: '#f44336', onClick: () => handleSetPin(false) },
                { icon: <Bell size={20} strokeWidth={1.5} />, label: 'Unmute', title: 'Unmute', accent: '#7986cb', onClick: () => handleSetMute(false) },
                { icon: <Ban size={20} strokeWidth={1.5} />, label: 'Unblock', title: 'Unblock sender', accent: '#e53935', onClick: () => {} },
              ].map(({ icon, label, title, accent, onClick }) => {
                const noSelection = selectedEmails.size === 0
                const isActive = (label === 'Unread' && toolbarAllUnread) || (label === 'Unarchive' && toolbarAllUnarchived) || (label === 'Unstar' && toolbarAllUnstarred) || (label === 'Unsnooze' && toolbarAllUnsnoozed) || (label === 'Ungroup' && toolbarAllUngrouped) || (label === 'Unspam' && toolbarAllUnspam) || (label === 'Unreport' && toolbarAllUnreported) || (label === 'Unpin' && toolbarAllUnpinned) || (label === 'Unmute' && toolbarAllUnmuted) || (label === 'Restore' && toolbarAllUndeleted)
                const isPartial = !noSelection && (
                  (label === 'Unread' && !toolbarAllUnread && !toolbarAllRead) ||
                  (label === 'Unarchive' && !toolbarAllUnarchived && !toolbarAllArchived) ||
                  (label === 'Unstar' && !toolbarAllUnstarred && !toolbarAllStarred) ||
                  (label === 'Unsnooze' && !toolbarAllUnsnoozed && !toolbarAllSnoozed) ||
                  (label === 'Ungroup' && !toolbarAllUngrouped && !toolbarAllGrouped) ||
                  (label === 'Unspam' && !toolbarAllUnspam && !toolbarAllSpam) ||
                  (label === 'Unreport' && !toolbarAllUnreported && !toolbarAllReported) ||
                  (label === 'Unpin' && !toolbarAllUnpinned && !toolbarAllPinned) ||
                  (label === 'Unmute' && !toolbarAllUnmuted && !toolbarAllMuted) ||
                  (label === 'Restore' && !toolbarAllUndeleted && !toolbarAllDeleted)
                )
                const isDisabled = noSelection || isActive
                const isLightActive = isActive && (label === 'Unarchive' || label === 'Unsnooze' || label === 'Ungroup' || label === 'Unspam' || label === 'Unreport' || label === 'Unpin' || label === 'Unmute' || label === 'Restore')
                const alreadyLabel = label === 'Unread' ? 'Already unread' : label === 'Unarchive' ? 'Already unarchived' : label === 'Unstar' ? 'Already unstarred' : label === 'Unsnooze' ? 'Already unsnoozed' : label === 'Ungroup' ? 'Already ungrouped' : label === 'Unspam' ? 'Already unspammed' : label === 'Unreport' ? 'Already unreported' : label === 'Unpin' ? 'Already unpinned' : label === 'Unmute' ? 'Already unmuted' : label === 'Restore' ? 'Already restored' : ''
                return (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', cursor: 'default', flexShrink: 0 }}>
                    <button
                      disabled={isDisabled}
                      onClick={onClick}
                      title={noSelection ? `${title} (select emails first)` : isActive ? alreadyLabel : isPartial ? `${title} (mixed)` : title}
                      style={{
                        background: isLightActive ? accent + '22' : isActive ? accent : 'none',
                        border: 'none',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        color: isLightActive ? accent : isActive ? '#fff' : isPartial ? accent : '#666',
                        opacity: noSelection ? 0.35 : 1,
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        transition: 'all 0.2s ease',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { if (!isDisabled) e.currentTarget.style.backgroundColor = accent + '22' }}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isLightActive ? accent + '22' : isActive ? accent : 'transparent'}
                    >
                      {icon}
                    </button>
                    <span style={{ fontSize: '9px', lineHeight: 1, whiteSpace: 'nowrap', color: (isActive || isPartial) ? accent : '#666' }}>{label}</span>
                  </div>
                )
              })}
            </>
          )}
        </div>
        <div className="header-pagination">
          {!selectionMode && pageRangeAndArrows}
          {!selectionMode && (
            <>
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
            </>
          )}
        </div>
        </div>
      </div>

      {type === 'inbox' && (
        <div className="email-tabs">
          <button
            className={`email-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Inbox size={16} />
            All
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {getCategoryCount('all').total > 0 && (
                <span style={{ backgroundColor: '#d4d4d4', color: '#111', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 500, display: 'inline-block', flexShrink: 0 }}>{getCategoryCount('all').total}</span>
              )}
              {getCategoryCount('all').unread > 0 && (
                <span style={{ backgroundColor: '#2196f3', color: 'white', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0 }}>{getCategoryCount('all').unread}</span>
              )}
            </span>
          </button>
          <button
            className={`email-tab-btn ${activeTab === 'primary' ? 'active' : ''}`}
            onClick={() => setActiveTab('primary')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Heart size={16} />
            Primary
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {getCategoryCount('primary').total > 0 && (
                <span style={{ backgroundColor: '#d4d4d4', color: '#111', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 500, display: 'inline-block', flexShrink: 0 }}>{getCategoryCount('primary').total}</span>
              )}
              {getCategoryCount('primary').unread > 0 && (
                <span style={{ backgroundColor: '#2196f3', color: 'white', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0 }}>{getCategoryCount('primary').unread}</span>
              )}
            </span>
          </button>
          <button
            className={`email-tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <CreditCard size={16} />
            Transactions
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {getCategoryCount('transactions').total > 0 && (
                <span style={{ backgroundColor: '#d4d4d4', color: '#111', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 500, display: 'inline-block', flexShrink: 0 }}>{getCategoryCount('transactions').total}</span>
              )}
              {getCategoryCount('transactions').unread > 0 && (
                <span style={{ backgroundColor: '#2196f3', color: 'white', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0 }}>{getCategoryCount('transactions').unread}</span>
              )}
            </span>
          </button>
          <button
            className={`email-tab-btn ${activeTab === 'social' ? 'active' : ''}`}
            onClick={() => setActiveTab('social')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Share2 size={16} />
            Social
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {getCategoryCount('social').total > 0 && (
                <span style={{ backgroundColor: '#d4d4d4', color: '#111', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 500, display: 'inline-block', flexShrink: 0 }}>{getCategoryCount('social').total}</span>
              )}
              {getCategoryCount('social').unread > 0 && (
                <span style={{ backgroundColor: '#2196f3', color: 'white', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0 }}>{getCategoryCount('social').unread}</span>
              )}
            </span>
          </button>
          <button
            className={`email-tab-btn ${activeTab === 'promotions' ? 'active' : ''}`}
            onClick={() => setActiveTab('promotions')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Zap size={16} />
            Promotions
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {getCategoryCount('promotions').total > 0 && (
                <span style={{ backgroundColor: '#d4d4d4', color: '#111', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 500, display: 'inline-block', flexShrink: 0 }}>{getCategoryCount('promotions').total}</span>
              )}
              {getCategoryCount('promotions').unread > 0 && (
                <span style={{ backgroundColor: '#2196f3', color: 'white', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0 }}>{getCategoryCount('promotions').unread}</span>
              )}
            </span>
          </button>
        </div>
      )}

      {type === 'delete' && (
        <div className="email-tabs">
          <button
            className={`email-tab-btn ${activeDeleteTab === 'delete' ? 'active' : ''}`}
            onClick={() => setActiveDeleteTab('delete')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Trash2 size={16} style={{ color: activeDeleteTab === 'delete' ? '#f48fb1' : 'currentColor' }} />
            All
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {getDeleteTabCount('delete').total > 0 && (
                <span style={{ backgroundColor: '#d4d4d4', color: '#111', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 500, display: 'inline-block', flexShrink: 0 }}>{getDeleteTabCount('delete').total}</span>
              )}
              {getDeleteTabCount('delete').unread > 0 && (
                <span style={{ backgroundColor: '#2196f3', color: 'white', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0 }}>{getDeleteTabCount('delete').unread}</span>
              )}
            </span>
          </button>
          <button
            className={`email-tab-btn ${activeDeleteTab === 'received' ? 'active' : ''}`}
            onClick={() => setActiveDeleteTab('received')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Inbox size={16} style={{ color: activeDeleteTab === 'received' ? '#f48fb1' : 'currentColor' }} />
            Inbox
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {getDeleteTabCount('received').total > 0 && (
                <span style={{ backgroundColor: '#d4d4d4', color: '#111', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 500, display: 'inline-block', flexShrink: 0 }}>{getDeleteTabCount('received').total}</span>
              )}
              {getDeleteTabCount('received').unread > 0 && (
                <span style={{ backgroundColor: '#2196f3', color: 'white', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0 }}>{getDeleteTabCount('received').unread}</span>
              )}
            </span>
          </button>
          <button
            className={`email-tab-btn ${activeDeleteTab === 'sent' ? 'active' : ''}`}
            onClick={() => setActiveDeleteTab('sent')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span className={activeDeleteTab === 'sent' ? "delete-icon-bg active-delete-sent" : "delete-icon-bg"} style={{ width: '16px', height: '16px', backgroundSize: '16px 16px', margin: 0 }} />
            Sent
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {getDeleteTabCount('sent').total > 0 && (
                <span style={{ backgroundColor: '#d4d4d4', color: '#111', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 500, display: 'inline-block', flexShrink: 0 }}>{getDeleteTabCount('sent').total}</span>
              )}
              {getDeleteTabCount('sent').unread > 0 && (
                <span style={{ backgroundColor: '#2196f3', color: 'white', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0 }}>{getDeleteTabCount('sent').unread}</span>
              )}
            </span>
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

      {loading && (
        <div style={{ position: 'absolute', top: '60px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: 'rgba(255,255,255,0.9)', padding: '6px 16px', borderRadius: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', fontSize: '13px', color: '#555', pointerEvents: 'none', fontWeight: 500 }}>
          Loading...
        </div>
      )}

      {(filteredEmails.length > 0 || (includeChildren && currentLabelNode?.children?.length > 0)) && (
        <div className={`email-list${selectionMode ? ' selection-mode' : ''}`} style={hasMinimizedStrip ? { marginBottom: '60px' } : undefined}>
          {/* Parent label header with counts */}
          {includeChildren && labelName && (() => {
            const shouldShowParent = selectionMode && (hoveredParentHeader || filteredEmails.some(e => selectedEmails.has(e.id)) || openDateGroupDropdown === '__parent_label__') && filteredEmails.length > 0
            return (
            <div className="child-label-header" style={{ cursor: filteredEmails.length > 0 ? 'pointer' : 'default', background: '#f0f0f0', borderRadius: '18px', margin: '4px 0 4px 0', width: '100%', boxSizing: 'border-box', border: `1px solid ${getFolderColor(type, currentLabelNode?.color)}` }}
              onMouseEnter={() => setHoveredParentHeader(true)}
              onMouseLeave={() => setHoveredParentHeader(false)}
            >
              {/* 1. Toggle button */}
              <div style={{ width: '16px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderTopLeftRadius: '18px', borderBottomLeftRadius: '18px', borderTopRightRadius: 0, borderBottomRightRadius: 0, flexShrink: 0 }}>
                <ChevronDown size={16} style={{ color: currentLabelNode?.color || '#999' }} />
              </div>
              {/* 2. Checkbox + dropdown (hover, emails exist) */}
              {shouldShowParent && (
                <div className="checkbox-dropdown" style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="mail-checkbox"
                    style={{ width: '16px', height: '16px' }}
                    ref={(el) => {
                      if (el) {
                        const sc = filteredEmails.filter(e => selectedEmails.has(e.id)).length
                        el.checked = sc === filteredEmails.length && filteredEmails.length > 0
                        el.indeterminate = sc > 0 && sc < filteredEmails.length
                      }
                    }}
                    onChange={(e) => {
                      e.stopPropagation()
                      const ids = filteredEmails.map(em => em.id)
                      const sc = filteredEmails.filter(e => selectedEmails.has(e.id)).length
                      const next = new Set(selectedEmails)
                      if (sc === filteredEmails.length) ids.forEach(id => next.delete(id))
                      else ids.forEach(id => next.add(id))
                      setSelectedEmails(next)
                      setOpenDateGroupDropdown(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    className="checkbox-dropdown-btn"
                    style={{ width: '15px', height: '16px', padding: 0, backgroundColor: 'white', border: 'none', background: 'none', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (openDateGroupDropdown === '__parent_label__') { setOpenDateGroupDropdown(null); setDateDropdownPos(null) }
                      else { setDateDropdownPos(calculateDropdownPos(e.currentTarget)); setOpenDateGroupDropdown('__parent_label__') }
                    }}
                  ><ChevronDown size={16} /></button>
                  {openDateGroupDropdown === '__parent_label__' && dateDropdownPos && createPortal(
                    <div className="checkbox-dropdown-menu" style={{ position: 'fixed', top: `${dateDropdownPos.top + 8}px`, left: `${dateDropdownPos.left}px`, zIndex: 999999999, pointerEvents: 'auto', margin: 0 }} onClick={(e) => e.stopPropagation()}>
                      <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('all', filteredEmails, false)}>All</button>
                      <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('none', filteredEmails, false)}>None</button>
                      {type !== 'sent' && type !== 'drafts' && type !== 'scheduled' && (
                        <>
                          <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('read', filteredEmails, false)}>Read</button>
                          <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('unread', filteredEmails, false)}>Unread</button>
                        </>
                      )}
                      <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('starred', filteredEmails, false)}>Starred</button>
                      <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('unstarred', filteredEmails, false)}>Unstarred</button>
                    </div>,
                    document.body
                  )}
                </div>
              )}
              {/* 3. Folder icon */}
              {currentLabelNode?.children?.length
                ? <FolderOpen size={16} style={{ color: currentLabelNode?.color || '#999', fill: 'currentColor', opacity: 0.8, flexShrink: 0 }} />
                : <Tag size={16} style={{ color: currentLabelNode?.color || '#999', fill: 'currentColor', opacity: 0.8, flexShrink: 0 }} />}
              <span className="child-label-name" style={{ color: currentLabelNode?.color || '#333' }}>
                {decodeURIComponent(labelName as string).split(' / ').pop()}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                {totalEmails > 0 && (
                  <span style={{ backgroundColor: '#d4d4d4', color: '#111', fontSize: '13.5px', fontWeight: 500, padding: '1px 4px', borderRadius: '10px', flexShrink: 0, display: 'inline-block' }}>{totalEmails}</span>
                )}
                {parentUnread > 0 && (
                  <span style={{ backgroundColor: '#2196f3', color: 'white', fontSize: '13.5px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '10px', flexShrink: 0, display: 'inline-block' }}>{parentUnread}</span>
                )}
              </span>
            </div>
            )
          })()}
          {includeChildren && labelName && filteredEmails.length === 0 && (
            <div style={{ padding: '8px 16px', color: '#999', fontSize: '13px' }}>No emails</div>
          )}
          {(() => {
            const _now = Date.now()
            const _upcoming = type === 'scheduled' ? filteredEmails.filter(e => e.scheduledFor && new Date(e.scheduledFor).getTime() > _now) : []
            const _alreadySent = type === 'scheduled' ? filteredEmails.filter(e => !e.scheduledFor || new Date(e.scheduledFor).getTime() <= _now) : []
            const _sortedUpcoming = _upcoming.slice().sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())
            const _sortedAlreadySent = _alreadySent.slice().sort((a, b) => new Date(b.scheduledFor ?? b.date).getTime() - new Date(a.scheduledFor ?? a.date).getTime())

            // Combined total per date-range label (upcoming + already-sent) for gray pill
            const _scheduledTotalByRange: Map<string, number> = type === 'scheduled'
              ? filteredEmails.reduce((map, e) => {
                  const isUpcoming = e.scheduledFor && new Date(e.scheduledFor).getTime() > _now;
                  const label = getDateRangeLabel(new Date(isUpcoming ? e.scheduledFor! : e.date))
                  map.set(label, (map.get(label) || 0) + 1)
                  return map
                }, new Map<string, number>())
              : new Map()
            const _groups: [string, Email[]][] = type === 'scheduled'
              ? [
                  ...groupEmailsByDateRange(_sortedUpcoming, true).map(([k, v]) => [`__up_${k}`, v] as [string, Email[]]),
                  ...(_upcoming.length > 0 && _alreadySent.length > 0 ? [['__SCHEDULED_DIVIDER__', []] as [string, Email[]]] : []),
                  ...groupEmailsByDateRange(_sortedAlreadySent).map(([k, v]) => [`__as_${k}`, v] as [string, Email[]]),
                ]
              : groupEmailsByDateRange(filteredEmails)
            return (
              <>
                {type === 'scheduled' && _upcoming.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', margin: '4px 6px 2px', backgroundColor: '#fff3e0', borderRadius: '8px', borderLeft: '3px solid #fb8c00' }}>
                    <Clock size={13} color="#fb8c00" />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#fb8c00', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Upcoming · {_upcoming.length}</span>
                  </div>
                )}
                {type === 'scheduled' && _alreadySent.length > 0 && _upcoming.length === 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', margin: '4px 6px 2px', backgroundColor: '#f5f5f5', borderRadius: '8px', borderLeft: '3px solid #9e9e9e' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#757575', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Already Sent · {_alreadySent.length}</span>
                  </div>
                )}
                {_groups.map(([dateRange, emailsInRange]) => {
            if (dateRange === '__SCHEDULED_DIVIDER__') {
              return (
                <div key="__SCHEDULED_DIVIDER__" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px 4px', margin: '0 6px' }}>
                  <div style={{ flex: 1, height: '1.5px', backgroundColor: '#bdbdbd' }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#757575', whiteSpace: 'nowrap', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Already Sent · {_alreadySent.length}</span>
                  <div style={{ flex: 1, height: '1.5px', backgroundColor: '#bdbdbd' }} />
                </div>
              )
            }
            const _isUp = dateRange.startsWith('__up_')
            const _isAs = dateRange.startsWith('__as_')
            const _prefix = _isUp ? '__up_' : _isAs ? '__as_' : ''
            const rawDateRange = _prefix ? dateRange.slice(_prefix.length) : dateRange
            const isYear = isYearHeader(rawDateRange)
            const parentYear = getParentYear(rawDateRange)
            const isParentYearCollapsed = parentYear && collapsedDateGroups.has(`${_prefix}${parentYear}`)

            // Skip rendering months if their parent year is collapsed
            if (!isYear && isParentYearCollapsed) {
              return null
            }

            return (
              <div key={dateRange}>
                {/* Year Header */}
                {isYear ? (() => {
                  return (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        height: '25px',
                        padding: '0 0px',
                        margin: '0 8px 2px 8px',
                        borderRadius: '24px',
                        borderLeft: _isUp ? '3px solid #fb8c00' : _isAs ? '3px solid #4db6ac' : undefined,
                        cursor: 'pointer',
                        userSelect: 'none',
                        gap: '0px',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#333',
                        position: 'sticky',
                        top: '1px',
                        zIndex: 10,
                        overflow: 'visible',
                        transition: 'padding 0.2s ease',
                        backgroundColor: (() => {
                        const grouped = groupEmailsByDateRange(filteredEmails)
                        const yearEmails = grouped
                          .filter(([range]) => !isYearHeader(range) && getParentYear(range) === rawDateRange)
                          .flatMap(([_, emails]) => emails)
                        const allSelected = yearEmails.length > 0 && yearEmails.every(e => selectedEmails.has(e.id))
                        if (allSelected) {
                          return '#f0f7ff'
                        }
                        if (hoveredDateGroup === dateRange) {
                          return collapsedDateGroups.has(dateRange) ? '#e8e8e8' : (_isUp ? '#ffe0b2' : '#f9f9f9')
                        }
                        return collapsedDateGroups.has(dateRange) ? 'transparent' : (_isUp ? '#fff3e0' : '#f0f0f0')
                      })(),
                      border: (() => {
                        const grouped = groupEmailsByDateRange(filteredEmails)
                        const yearEmails = grouped
                          .filter(([range]) => !isYearHeader(range) && getParentYear(range) === rawDateRange)
                          .flatMap(([_, emails]) => emails)
                        const allSelected = yearEmails.length > 0 && yearEmails.every(e => selectedEmails.has(e.id))
                        if (allSelected) {
                          return '0.5px solid #888888'
                        }
                        return collapsedDateGroups.has(dateRange) ? 'none' : '0.5px solid #888888'
                      })(),
                      boxShadow: hoveredDateGroup === dateRange
                        ? (collapsedDateGroups.has(dateRange)
                          ? '0 2px 4px rgba(0, 0, 0, 0.6)'
                          : '0 2px 8px rgba(0, 0, 0, 0.4)')
                        : 'none',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                    onMouseEnter={() => setHoveredDateGroup(dateRange)}
                    onMouseLeave={() => setHoveredDateGroup(null)}
                    onClick={() => toggleDateGroupCollapse(dateRange)}
                  >
                    {(() => {
                      const grouped = groupEmailsByDateRange(filteredEmails)
                      const yearEmails = grouped
                        .filter(([range]) => !isYearHeader(range) && getParentYear(range) === rawDateRange)
                        .flatMap(([_, emails]) => emails)
                      const shouldShow = selectionMode && (hoveredDateGroup === dateRange || yearEmails.some(e => selectedEmails.has(e.id)) || openDateGroupDropdown === dateRange) && !collapsedDateGroups.has(dateRange)

                      return (
                        <>
                          {/* Checkbox and Dropdown */}
                          <div className="checkbox-dropdown" style={{ display: shouldShow ? 'flex' : 'none', alignItems: 'center', gap: '2px', position: 'relative', transition: 'all 0.2s ease', marginLeft: '16px' }}>
                            <input
                              type="checkbox"
                              className="mail-checkbox"
                              style={{ display: shouldShow ? 'block' : 'none', width: '16px', height: '16px' }}
                              ref={(el) => {
                                if (el) {
                                  const selectedCount = yearEmails.filter(e => selectedEmails.has(e.id)).length
                                  el.checked = selectedCount === yearEmails.length && yearEmails.length > 0
                                  el.indeterminate = selectedCount > 0 && selectedCount < yearEmails.length
                                }
                              }}
                              onChange={(e) => {
                                e.stopPropagation()
                                const emailIdsInYear = yearEmails.map(em => em.id)
                                const selectedCount = yearEmails.filter(e => selectedEmails.has(e.id)).length
                                const newSelectedEmails = new Set(selectedEmails)

                                if (selectedCount === yearEmails.length) {
                                  emailIdsInYear.forEach(id => newSelectedEmails.delete(id))
                                } else if (selectedCount === 0) {
                                  emailIdsInYear.forEach(id => newSelectedEmails.add(id))
                                } else {
                                  emailIdsInYear.forEach(id => newSelectedEmails.delete(id))
                                }
                                setSelectedEmails(newSelectedEmails)
                                setOpenDateGroupDropdown(null)
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              className="checkbox-dropdown-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (openDateGroupDropdown === dateRange) {
                                  setOpenDateGroupDropdown(null)
                                  setDateDropdownPos(null)
                                } else {
                                  const pos = calculateDropdownPos(e.currentTarget)
                                  setDateDropdownPos(pos)
                                  setOpenDateGroupDropdown(dateRange)
                                }
                              }}
                              style={{ width: '15px', height: '16px', display: shouldShow ? 'block' : 'none', padding: 0, backgroundColor: 'white', border: 'none', background: 'none', cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <ChevronDown size={16} />
                            </button>
                            {openDateGroupDropdown === dateRange && dateDropdownPos && createPortal(
                              <div className="checkbox-dropdown-menu" style={{ position: 'fixed', top: `${dateDropdownPos.top + 8}px`, left: `${dateDropdownPos.left}px`, zIndex: 999999999, pointerEvents: 'auto', margin: 0 }} onClick={(e) => e.stopPropagation()}>
                                <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('all', yearEmails, false)}>All</button>
                                <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('none', yearEmails, false)}>None</button>
                                {type !== 'sent' && type !== 'drafts' && type !== 'scheduled' && (
                                  <>
                                    <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('read', yearEmails, false)}>Read</button>
                                    <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('unread', yearEmails, false)}>Unread</button>
                                  </>
                                )}
                                <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('starred', yearEmails, false)}>Starred</button>
                                <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('unstarred', yearEmails, false)}>Unstarred</button>
                              </div>,
                              document.body
                            )}
                          </div>

                          {/* Toggle and Year/Text - Left Side */}
                          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '9px', marginRight: '4px' }}>
                            {collapsedDateGroups.has(dateRange) ? (
                              <ChevronRight size={18} style={{ color: '#999' }} />
                            ) : (
                              <ChevronDown size={18} style={{ color: '#999' }} />
                            )}
                          </div>
                        </>
                      )
                    })()}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      {collapsedDateGroups.has(dateRange) ? (
                        // Collapsed view: show inline months with badges
                        <span style={{ fontSize: '13px', color: '#333', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {(() => {
                            const counts = getYearEmailCounts(rawDateRange, filteredEmails)
                            return (
                              <>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {getDisplayDateRangeLabel(rawDateRange, emailsInRange)}
                                  {counts.total > 0 && !_isUp && (
                                      <span style={{ backgroundColor: '#d4d4d4', color: '#111', fontSize: '13.5px', fontWeight: 500, padding: '1px 4px', borderRadius: '10px', flexShrink: 0, display: 'inline-block' }}>{counts.total}</span>
                                    )}
                                    {type === 'scheduled' && (() => {
                                      const yearStr = rawDateRange.substring(7, 11)
                                      const ac = filteredEmails.filter(e => (!e.scheduledFor || new Date(e.scheduledFor).getTime() <= Date.now()) && String(new Date(e.date).getFullYear()) === yearStr).length
                                  return ac > 0 ? <span style={{ backgroundColor: '#4db6ac', color: 'white', fontSize: '13.5px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '10px', flexShrink: 0, display: 'inline-block', marginLeft: '2px' }}>{ac}</span> : null
                                    })()}
                                  </span>
                                  {(() => {
                                    if (type === 'scheduled') {
                                      const yearStr = rawDateRange.substring(7, 11)
                                      const uc = filteredEmails.filter(e => e.scheduledFor && new Date(e.scheduledFor).getTime() > Date.now() && String(new Date(e.scheduledFor).getFullYear()) === yearStr).length
                                      return uc > 0 ? <span style={{ backgroundColor: '#fb8c00', color: 'white', padding: '1px 4px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0, marginLeft: '4px' }}>{uc}</span> : null
                                    }
                                    return counts.unread > 0 ? <span style={{ backgroundColor: '#2196f3', color: 'white', padding: '1px 4px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0, marginLeft: '4px' }}>{counts.unread}</span> : null
                                  })()}
                                </span>
                                {(() => {
                                  const months = getCollapsedYearMonths(rawDateRange, filteredEmails)
                                  return months.map((monthData, idx) => (
                                    <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
                                      <span>{monthData.month}({monthData.total})</span>
                                      {monthData.unread > 0 && (
                                        <span style={{ backgroundColor: '#2196f3', color: 'white', padding: '1px 4px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0, marginLeft: '2px' }}>
                                          {monthData.unread}
                                        </span>
                                      )}
                                    </span>
                                  ))
                                })()}
                              </>
                            )
                          })()}
                        </span>
                      ) : (

                        // Expanded view: show only year info
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
                          <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {getDisplayDateRangeLabel(rawDateRange, emailsInRange)}
                            {(() => {
                              const counts = getYearEmailCounts(rawDateRange, filteredEmails)
                              const yearStr = rawDateRange.substring(7, 11)
                              const ac = type === 'scheduled'
                                ? filteredEmails.filter(e => (!e.scheduledFor || new Date(e.scheduledFor).getTime() <= Date.now()) && String(new Date(e.date).getFullYear()) === yearStr).length
                                : 0
                              return (
                                <>
                                  {counts.total > 0 && !_isUp && <span style={{ backgroundColor: '#d4d4d4', color: '#111', fontSize: '13.5px', fontWeight: 500, padding: '1px 4px', borderRadius: '10px', flexShrink: 0, marginLeft: '4px', display: 'inline-block' }}>{counts.total}</span>}
                                {ac > 0 && <span style={{ backgroundColor: '#4db6ac', color: 'white', fontSize: '13.5px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '10px', flexShrink: 0, marginLeft: '2px', display: 'inline-block' }}>{ac}</span>}
                                </>
                              )
                            })()}
                          </span>
                          {(() => {
                            const counts = getYearEmailCounts(rawDateRange, filteredEmails)
                            if (type === 'scheduled') {
                              const yearStr = rawDateRange.substring(7, 11)
                              const uc = filteredEmails.filter(e => e.scheduledFor && new Date(e.scheduledFor).getTime() > Date.now() && String(new Date(e.scheduledFor).getFullYear()) === yearStr).length
                              return uc > 0 ? <span style={{ backgroundColor: '#fb8c00', color: 'white', padding: '1px 4px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0, marginLeft: '4px' }}>{uc}</span> : null
                            }
                            return counts.unread > 0 ? (
                              <span style={{ backgroundColor: '#2196f3', color: 'white', padding: '1px 4px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0, marginLeft: '4px' }}>
                                {counts.unread}
                              </span>
                            ) : null
                          })()}
                        </span>
                      )}
                    </span>
                  </div>
                  )
                })()
                : (() => {
                  return (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        height: '25px',
                        padding: '0 0px',
                        margin: '0 8px 5px 8px',
                        borderRadius: '24px',
                        borderLeft: _isUp ? '3px solid #fb8c00' : _isAs ? '3px solid #4db6ac' : undefined,
                        cursor: 'pointer',
                        userSelect: 'none',
                        gap: '0px',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#333',
                        position: 'sticky',
                        top: '1px',
                        zIndex: 10,
                        overflow: 'visible',
                        transition: 'padding 0.2s ease',
                      backgroundColor: (() => {
                        const allSelected = emailsInRange.length > 0 && emailsInRange.every(e => selectedEmails.has(e.id))
                        if (allSelected) {
                          return '#f0f7ff'
                        }
                        if (hoveredDateGroup === dateRange) {
                          return collapsedDateGroups.has(dateRange) ? '#e8e8e8' : (_isUp ? '#ffe0b2' : '#f9f9f9')
                        }
                        return collapsedDateGroups.has(dateRange) ? 'transparent' : (_isUp ? '#fff3e0' : '#f0f0f0')
                      })(),
                      border: (() => {
                        const allSelected = emailsInRange.length > 0 && emailsInRange.every(e => selectedEmails.has(e.id))
                        if (allSelected) {
                          return '0.5px solid #888888'
                        }
                        return collapsedDateGroups.has(dateRange) ? 'none' : '0.5px solid #888888'
                      })(),
                      boxShadow: hoveredDateGroup === dateRange
                        ? (collapsedDateGroups.has(dateRange)
                          ? '0 2px 4px rgba(0, 0, 0, 0.6)'
                          : '0 2px 8px rgba(0, 0, 0, 0.4)')
                        : 'none'
                    }}
                    onMouseEnter={() => setHoveredDateGroup(dateRange)}
                    onMouseLeave={() => setHoveredDateGroup(null)}
                    onClick={() => toggleDateGroupCollapse(dateRange)}
                  >
                    {(() => {
                      const shouldShow = selectionMode && (hoveredDateGroup === dateRange || emailsInRange.some(e => selectedEmails.has(e.id)) || openDateGroupDropdown === dateRange) && !collapsedDateGroups.has(dateRange)

                      return (
                        <>
                          {/* Checkbox and Dropdown - Visible only in expanded state with hover/selected, while Select mode is active */}
                          {collapsedDateGroups.has(dateRange) === false && selectionMode && (hoveredDateGroup === dateRange || emailsInRange.some(e => selectedEmails.has(e.id)) || openDateGroupDropdown === dateRange) && (
                            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '1rem', marginRight: '4px', position: 'relative' }}>
                              <input
                                type="checkbox"
                                className="mail-checkbox"
                                style={{ width: '16px', height: '16px' }}
                                ref={(el) => {
                                  if (el) {
                                    const selectedCount = emailsInRange.filter(e => selectedEmails.has(e.id)).length
                                    el.checked = selectedCount === emailsInRange.length && emailsInRange.length > 0
                                    el.indeterminate = selectedCount > 0 && selectedCount < emailsInRange.length
                                  }
                                }}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  const emailIds = emailsInRange.map(em => em.id)
                                  const selectedCount = emailsInRange.filter(e => selectedEmails.has(e.id)).length
                                  const newSelectedEmails = new Set(selectedEmails)

                                  if (selectedCount === emailsInRange.length) {
                                    emailIds.forEach(id => newSelectedEmails.delete(id))
                                  } else if (selectedCount === 0) {
                                    emailIds.forEach(id => newSelectedEmails.add(id))
                                  } else {
                                    emailIds.forEach(id => newSelectedEmails.delete(id))
                                  }
                                  setSelectedEmails(newSelectedEmails)
                                  setOpenDateGroupDropdown(null)
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                className="checkbox-dropdown-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (openDateGroupDropdown === dateRange) {
                                    setOpenDateGroupDropdown(null)
                                    setDateDropdownPos(null)
                                  } else {
                                    const pos = calculateDropdownPos(e.currentTarget)
                                    setDateDropdownPos(pos)
                                    setOpenDateGroupDropdown(dateRange)
                                  }
                                }}
                                style={{ width: '15px', height: '16px', padding: 0, backgroundColor: 'white', border: 'none', background: 'none', cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <ChevronDown size={16} />
                              </button>
                              {openDateGroupDropdown === dateRange && dateDropdownPos && createPortal(
                                <div className="checkbox-dropdown-menu" style={{ position: 'fixed', top: `${dateDropdownPos.top + 8}px`, left: `${dateDropdownPos.left}px`, zIndex: 999999999, pointerEvents: 'auto', margin: 0 }} onClick={(e) => e.stopPropagation()}>
                                  <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('all', emailsInRange, false)}>All</button>
                                  <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('none', emailsInRange, false)}>None</button>
                                  {type !== 'sent' && type !== 'drafts' && type !== 'scheduled' && (
                                    <>
                                      <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('read', emailsInRange, false)}>Read</button>
                                      <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('unread', emailsInRange, false)}>Unread</button>
                                    </>
                                  )}
                                  <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('starred', emailsInRange, false)}>Starred</button>
                                  <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('unstarred', emailsInRange, false)}>Unstarred</button>
                                </div>,
                                document.body
                              )}
                            </div>
                          )}

                          {/* Pin Icon - Shown only for the Pinned group, before the toggle button */}
                          {rawDateRange === 'Pinned' && (
                            <Pin size={20} style={{ color: '#4caf50', flexShrink: 0, marginLeft: '8px', transform: 'rotate(-45deg)' }} />
                          )}

                          {/* Toggle Button - Always visible, fixed position */}
                          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: (rawDateRange.startsWith('__year_') ? '9px' : /^\d{4}-\d{2}$/.test(rawDateRange) ? '18px' : rawDateRange === 'This week' ? '27px' : rawDateRange === 'Yesterday' ? '36px' : (rawDateRange === 'Today' || rawDateRange === 'Tomorrow') ? '45px' : '27px'), marginRight: '4px', position: 'relative', width: '18px', height: '18px' }}>
                            {collapsedDateGroups.has(dateRange) ? (
                              <ChevronRight size={18} style={{ color: '#999' }} />
                            ) : (
                              <ChevronDown size={18} style={{ color: '#999' }} />
                            )}

                            {/* Checkbox and Dropdown - Overlays toggle button on hover/selected (collapsed only) */}
                            <div className="checkbox-dropdown" style={{ display: (shouldShow && collapsedDateGroups.has(dateRange)) ? 'flex' : 'none', alignItems: 'center', gap: '2px', position: 'absolute', left: '0px', top: '50%', transform: 'translateY(-50%)', transition: 'all 0.2s ease', opacity: (shouldShow && collapsedDateGroups.has(dateRange)) ? 1 : 0, visibility: (shouldShow && collapsedDateGroups.has(dateRange)) ? 'visible' : 'hidden', pointerEvents: (shouldShow && collapsedDateGroups.has(dateRange)) ? 'auto' : 'none', zIndex: 10 }}>
                              <input
                                type="checkbox"
                                className="mail-checkbox"
                                style={{ width: '16px', height: '16px' }}
                                ref={(el) => {
                                  if (el) {
                                    const selectedCount = emailsInRange.filter(e => selectedEmails.has(e.id)).length
                                    el.checked = selectedCount === emailsInRange.length && emailsInRange.length > 0
                                    el.indeterminate = selectedCount > 0 && selectedCount < emailsInRange.length
                                  }
                                }}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  const emailIds = emailsInRange.map(em => em.id)
                                  const selectedCount = emailsInRange.filter(e => selectedEmails.has(e.id)).length
                                  const newSelectedEmails = new Set(selectedEmails)

                                  if (selectedCount === emailsInRange.length) {
                                    // All selected, deselect all
                                    emailIds.forEach(id => newSelectedEmails.delete(id))
                                  } else if (selectedCount === 0) {
                                    // None selected, select all
                                    emailIds.forEach(id => newSelectedEmails.add(id))
                                  } else {
                                    // Partially selected, deselect all
                                    emailIds.forEach(id => newSelectedEmails.delete(id))
                                  }
                                  setSelectedEmails(newSelectedEmails)
                                  setOpenDateGroupDropdown(null)
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                className="checkbox-dropdown-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (openDateGroupDropdown === dateRange) {
                                    setOpenDateGroupDropdown(null)
                                    setDateDropdownPos(null)
                                  } else {
                                    const pos = calculateDropdownPos(e.currentTarget)
                                    setDateDropdownPos(pos)
                                    setOpenDateGroupDropdown(dateRange)
                                  }
                                }}
                                style={{ width: '15px', height: '16px', padding: 0, backgroundColor: 'white', border: 'none', background: 'none', cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <ChevronDown size={16} />
                              </button>
                              {openDateGroupDropdown === dateRange && dateDropdownPos && createPortal(
                                <div className="checkbox-dropdown-menu" style={{ position: 'fixed', top: `${dateDropdownPos.top + 8}px`, left: `${dateDropdownPos.left}px`, zIndex: 999999999, pointerEvents: 'auto', margin: 0 }} onClick={(e) => e.stopPropagation()}>
                                  <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('all', emailsInRange, false)}>All</button>
                                  <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('none', emailsInRange, false)}>None</button>
                                  {type !== 'sent' && type !== 'drafts' && type !== 'scheduled' && (
                                    <>
                                      <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('read', emailsInRange, false)}>Read</button>
                                      <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('unread', emailsInRange, false)}>Unread</button>
                                    </>
                                  )}
                                  <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('starred', emailsInRange, false)}>Starred</button>
                                  <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('unstarred', emailsInRange, false)}>Unstarred</button>
                                </div>,
                                document.body
                              )}
                            </div>
                          </div>
                        </>
                      )
                    })()}
                    <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
                        <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {getDisplayDateRangeLabel(rawDateRange, emailsInRange)}
                          {type === 'scheduled' ? (() => {
                            const total = _scheduledTotalByRange.get(rawDateRange) ?? emailsInRange.length
                            return total > 0 && !_isUp ? <span style={{ backgroundColor: '#d4d4d4', color: '#111', fontSize: '13.5px', fontWeight: 500, padding: '1px 4px', borderRadius: '10px', flexShrink: 0, marginLeft: '4px', display: 'inline-block' }}>{total}</span> : null
                          })() : emailsInRange.length > 0 ? (
                            <span style={{ backgroundColor: '#d4d4d4', color: '#111', fontSize: '13.5px', fontWeight: 500, padding: '1px 4px', borderRadius: '10px', flexShrink: 0, marginLeft: '4px', display: 'inline-block' }}>{emailsInRange.length}</span>
                          ) : null}
                          {type === 'scheduled' && (() => {
                            const ac = emailsInRange.filter(e => !e.scheduledFor || new Date(e.scheduledFor).getTime() <= Date.now()).length
                            return ac > 0 ? <span style={{ backgroundColor: '#4db6ac', color: 'white', fontSize: '13.5px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '10px', flexShrink: 0, marginLeft: '2px', display: 'inline-block' }}>{ac}</span> : null
                          })()}
                        </span>
                          {(() => {
                            if (type === 'scheduled') {
                              const uc = emailsInRange.filter(e => e.scheduledFor && new Date(e.scheduledFor).getTime() > Date.now()).length
                              return uc > 0 ? <span style={{ backgroundColor: '#fb8c00', color: 'white', padding: '1px 4px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0, marginLeft: '4px' }}>{uc}</span> : null
                            }
                            const unread = emailsInRange.filter(e => !e.isRead && e.folder !== 'sent' && e.folder !== 'drafts' && !e.isScheduled && !e.isDraft).length
                            return unread > 0 ? <span style={{ backgroundColor: '#2196f3', color: 'white', padding: '1px 4px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0, marginLeft: '4px' }}>{unread}</span> : null
                          })()}
                      </span>
                    </span>
                  </div>
                    )
                  })()
                }

              {/* Email Items in Group */}
              {!collapsedDateGroups.has(dateRange) && emailsInRange.map((email, idx) => (
            <div
              key={email.id}
              id={`email-item-${email.id}`}
              data-email-id={email.id}
              className={`email-item ${!email.isRead && type !== 'sent' && type !== 'drafts' && email.folder !== 'sent' && email.folder !== 'drafts' && !email.isScheduled && !(type === 'spam' && email.folder === 'sent') ? 'unread' : ''} ${(email.folder === 'sent' || type === 'sent') ? 'sent' : ''} ${selectedEmails.has(email.id) ? 'selected' : ''} ${focusedIndex === idx ? 'focused' : ''} ${email.hasAttachments ? 'has-attachments' : ''} ${email.id === openedEmailId ? 'opened' : ''}`}
              onClick={() => {
                if (selectionMode) { handleSelectEmail(email.id); return; }
                onViewEmail(email);
              }}
              onContextMenu={(e) => handleContextMenu(e, email)}
            >
              <div className="checkbox-wrapper">
                {!email.isRead && type !== 'drafts' && email.folder !== 'sent' && email.folder !== 'drafts' && !email.isScheduled && (
                  <div className="unread-indicator"></div>
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer'
                }}
                className="checkbox-icon-wrapper"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectEmail(email.id);
                  setOpenDateGroupDropdown(null);
                }}
                >
                  {selectedEmails.has(email.id) ? (
                    <CheckSquare size={18} style={{ color: '#1a73e8' }} className="checkbox-icon" />
                  ) : (
                    <>
                      {(() => {
                        const avatarEmail = (email.folder === 'sent' || email.folder === 'drafts' || type === 'drafts' || type === 'scheduled') ? email.to : email.from
                        return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            minWidth: '28px',
                            minHeight: '28px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: '#fff',
                            backgroundColor: getAvatarColor(avatarEmail),
                            borderRadius: '50%',
                            overflow: 'hidden'
                          }}
                          className="profile-icon"
                          >
                            {getAvatarInitials(avatarEmail)}
                          </div>
                        )
                      })()}

                      <Square size={18} style={{ color: '#999' }} className="checkbox-icon" />
                    </>
                  )}
                </div>
              </div>
              <button
                className={`star-btn ${(type !== 'delete' && !email.isDeleted) && email.isStarred ? 'active' : ''}`}
                onClick={(e) => handleToggleStar(email.id, e)}
                title={type === 'delete' || email.isDeleted ? 'Star & restore' : (email.isStarred ? 'Remove star' : 'Add star')}
              >
                <Star size={18} fill={(type !== 'delete' && !email.isDeleted) && email.isStarred ? 'currentColor' : 'none'} />
              </button>
              {email.isPinned && (
                <Pin size={16} style={{ color: '#4caf50', flexShrink: 0, marginLeft: '2px', transform: 'rotate(-45deg)' }} title="Pinned" />
              )}
              <div className="email-from">
                {type === 'drafts' || email.folder === 'drafts'
                  ? <span className="email-to"><span style={{ color: '#ff5722', fontWeight: 700 }}>Draft:</span>{' '}<span style={{fontWeight:600,color:'#111'}}>{highlightText((email.to||'').split('@')[0], searchQuery)}</span>{(email.to||'').includes('@')&&<span style={{fontWeight:300,color:'#555'}}>@{highlightText((email.to||'').split('@')[1], searchQuery)}</span>}</span>
                  : email.folder === 'sent' || type === 'sent'
                    ? <span className="email-to"><span style={{ color: '#fb8c00', fontWeight: 700 }}>To:</span>{' '}<span style={{fontWeight:600,color:'#111'}}>{highlightText((email.to||'').split('@')[0], searchQuery)}</span>{(email.to||'').includes('@')&&<span style={{fontWeight:300,color:'#555'}}>@{highlightText((email.to||'').split('@')[1], searchQuery)}</span>}</span>
                  : <><span style={{fontWeight:600,color:email.isRead?'#111':'#0288d1'}}>{highlightText((email.from||'').split('@')[0], searchQuery)}</span>{(email.from||'').includes('@')&&<span style={{fontWeight:300,color:email.isRead?'#555':'#0288d1'}}>@{highlightText((email.from||'').split('@')[1], searchQuery)}</span>}</>}
              </div>
              <div style={(!!email.hasAttachments || /data-file-card/i.test(email.body || '')) ? { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4px 0' } : { flex: 1, minWidth: 0, display: 'flex' }}>
                <div className="email-subject" style={(!!email.hasAttachments || /data-file-card/i.test(email.body || '')) ? { flex: 'none', width: '100%' } : { flex: 1, width: '100%' }}>
                  {(() => {
                    const iconNode = getFolderIcon(email.folder, email);
                    return iconNode ? <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '4px', verticalAlign: 'middle', flexShrink: 0 }}>{iconNode}</span> : null;
                  })()}
                  {type === 'inbox' && email.isMuted && <VolumeX size={18} style={{ marginRight: '0px', marginLeft: '0px', display: 'inline', color: '#999', flexShrink: 0 }} />}
                  {(() => {
                    const lowerSub = (email.subject || '').toLowerCase().trim();
                    if (lowerSub.startsWith('re:')) {
                      return <Reply size={13} style={{ color: '#888', flexShrink: 0, marginRight: '4px', display: 'inline', verticalAlign: 'middle' }}><title>Replied</title></Reply>
                    }
                    if (lowerSub.startsWith('fwd:')) {
                      return <Forward size={13} style={{ color: '#888', flexShrink: 0, marginRight: '4px', display: 'inline', verticalAlign: 'middle' }}><title>Forwarded</title></Forward>
                    }
                    return null;
                  })()}
                  <span style={{ color: (!email.subject || email.subject === '(No subject)') ? '#888' : 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, minWidth: 0 }}>
                    {highlightText(email.subject || '(No subject)', searchQuery)}
                  </span>
                  {(() => { const p = bodyPreview(email.body, email.hasAttachments); return p ? <span className="email-preview" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 99999, minWidth: 0 }}> - {highlightText(p, searchQuery)}</span> : null; })()}
                </div>
                {(() => { const html = extractFileCardsHtml(email.body || ''); if (!html) return null; return <FileCardsOverflowContainer html={html} /> })()}
              </div>
              <div className="email-hover-actions" style={{ display: moveMenuOpen === email.id || snoozeMenuOpen === email.id ? 'flex' : undefined }}>
                {type !== 'drafts' && !email.isDraft && (
                  <>
                    <button className="action-btn" onClick={(e) => handleEmailAction('reply', email, e)} title="Reply">
                      <Reply size={18} />
                    </button>
                    <button className="action-btn" onClick={(e) => handleEmailAction('forward', email, e)} title="Forward">
                      <Forward size={18} />
                    </button>
                  </>
                )}
                {email.isArchived && (
                  <button className="action-btn archive-btn" onClick={(e) => handleUnarchive(email.id, e)} title="Unarchive">
                    <span style={{ position: 'relative', display: 'inline-flex' }}>
                      <Archive size={18} />
                      <span style={{ position: 'absolute', top: '50%', left: '-2px', right: '-2px', height: '2px', backgroundColor: 'currentColor', transform: 'rotate(-45deg)', transformOrigin: 'center', pointerEvents: 'none' }} />
                    </span>
                  </button>
                )}
                {email.isDeleted ? (
                  <>
                    <button className="action-btn" onClick={(e) => handleDelete(email.id, e)} title="Restore">
                      <RotateCcw size={18} />
                    </button>
                    <button className="action-btn delete-action-btn" onClick={(e) => handlePermanentDelete(email.id, e)} title="Permanently delete">
                      <Trash2 size={18} />
                    </button>
                  </>
                ) : (
                  <button className="action-btn delete-action-btn" onClick={(e) => handleDelete(email.id, e)} title="Delete">
                    <Trash2 size={18} />
                  </button>
                )}
                {type !== 'sent' && type !== 'drafts' && type !== 'scheduled' && email.folder !== 'sent' && email.folder !== 'drafts' && !email.isScheduled && (
                  <button className={`action-btn ${email.isRead ? 'unread-btn' : 'read-btn'}`} onClick={(e) => handleToggleRead(email.id, email.isRead, e)} title={email.isRead ? "Mark as unread" : "Mark as read"}>
                    <span className="default-icon" style={{ position: 'relative', display: 'inline-flex' }}>
                      {!email.isRead ? (
                        <><Mail size={18} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></>
                      ) : <><MailOpen size={18} /><span style={{ position: 'absolute', bottom: -2, right: -2.5, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ strokeWidth: 4 }} /></span></>}
                    </span>
                    <span className="hover-icon" style={{ position: 'relative', display: 'inline-flex' }}>
                      {!email.isRead ? (
                        <><MailOpen size={18} /><span style={{ position: 'absolute', bottom: -2, right: -2.5, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ strokeWidth: 4 }} /></span></>
                      ) : <><Mail size={18} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></>}
                    </span>
                  </button>
                )}
                {type !== 'archived' && !email.isArchived && (
                  <button className="action-btn archive-btn" onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const response = await fetch('http://localhost:5050/api/emails/batch', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ ids: [email.id], action: 'archive' }),
                      });
                      if (response.ok) {
                        const archivedEmail = email;
                        setAllEmails(allEmails.filter(e => e.id !== email.id));
                        setTotalEmails(prev => Math.max(0, prev - 1));
                        const undoArchive = async () => {
                          await fetch('http://localhost:5050/api/emails/batch', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ ids: [email.id], action: 'archive' }),
                          });
                          setAllEmails(prev => [...prev, archivedEmail]);
                          setTotalEmails(prev => prev + 1);
                          onRefreshCounts?.();
                        };
                        showToast('Email archived', undoArchive);
                        onRefreshCounts?.();
                      }
                    } catch (err) {
                      console.error('Failed to archive email:', err);
                    }
                  }} title="Archive">
                    <Archive size={18} />
                  </button>
                )}
                {email.folder !== 'sent' && email.folder !== 'drafts' && !email.isScheduled && (
                  <button className="action-btn spam-btn" onClick={(e) => handleToggleSpam(email.id, email.isSpam, e)} title={email.isSpam ? "Not spam" : "Mark as spam"}>
                    {email.isSpam ? (
                      <span style={{ position: 'relative', display: 'inline-flex' }}>
                        <AlertOctagon size={18} />
                        <span style={{ position: 'absolute', top: '50%', left: '-2px', right: '-2px', height: '2px', backgroundColor: 'currentColor', transform: 'rotate(-45deg)', transformOrigin: 'center', pointerEvents: 'none' }} />
                      </span>
                    ) : (
                      <AlertOctagon size={18} />
                    )}
                  </button>
                )}
                {type === 'inbox' && (
                  <button className="action-btn" onClick={(e) => handleToggleMute(email.id, email.isMuted || false, e)} title={email.isMuted ? "Unmute" : "Mute"}>
                    <VolumeX size={18} />
                  </button>
                )}
                <div style={{ position: 'relative' }}>
                  {email.isSnoozed ? (
                    <button className={`action-btn snoozed-btn${snoozeMenuOpen === email.id ? ' snooze-active' : ''}`} data-snooze-btn="true" onClick={(e) => handleSnoozeClick(email.id, e)} title="Remove snooze">
                      <AlarmClockOff size={18} />
                    </button>
                  ) : (
                    <button className={`action-btn snoozed-btn${snoozeMenuOpen === email.id ? ' snooze-active' : ''}`} data-snooze-btn="true" onClick={(e) => handleSnoozeClick(email.id, e)} title="Snooze">
                      <AlarmClock size={18} />
                    </button>
                  )}
                </div>
                <button className={`action-btn move-btn${moveMenuOpen === email.id ? ' move-active' : ''}`} data-move-btn="true" onClick={(e) => handleMoveClick(email.id, e)} title="Move to">
                  <FolderInput size={18} />
                </button>
              </div>
              <div style={{ marginLeft: 'auto', marginRight: '1px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button className={`email-canvas-btn${/data-canvas-(draft|saved)/.test(email.body||'')?' active':''}`} style={{ background:'none', border:'none', cursor:'default', padding:'0', boxSizing:'border-box', color:/data-canvas-(draft|saved)/.test(email.body||'')?'#7c4dff':'#ccc', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0, height:'40px', width:'40px' }} title="Canvas board"><PenLine size={40} /></button>
                <div className="email-date" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px', justifyContent: 'center' }}>
                  {email.isSnoozed && email.snoozedUntil && (
                    <span className="snoozed-until" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={11} style={{ flexShrink: 0 }} />
                      {(() => {
                        const snoozedDate = new Date(email.snoozedUntil);
                        const now = new Date();
                        const time = snoozedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        const isToday = snoozedDate.getFullYear() === now.getFullYear()
                          && snoozedDate.getMonth() === now.getMonth()
                          && snoozedDate.getDate() === now.getDate();
                        const countText = email.snoozeCount && email.snoozeCount > 1 ? ` (${email.snoozeCount})` : '';
                        
                        let dateStr = '';
                        if (isToday) {
                          dateStr = `Today ${time}${countText}`;
                        } else {
                          const day = snoozedDate.getDate();
                          const month = snoozedDate.toLocaleString('default', { month: 'short' });
                          dateStr = snoozedDate.getFullYear() === now.getFullYear() ? `${day} ${month}` : `${day} ${month} ${snoozedDate.getFullYear()}`;
                          dateStr = `${dateStr} ${time}${countText}`;
                        }

                        if (snoozedDate.getTime() <= now.getTime()) {
                          const diff = Math.floor((now.getTime() - snoozedDate.getTime()) / 1000);
                          let timeAgo = '';
                          if (diff < 60) timeAgo = `${diff} ${diff === 1 ? 'sec' : 'secs'} ago`;
                          else if (diff < 3600) { const m = Math.floor(diff / 60); timeAgo = `${m} ${m === 1 ? 'min' : 'mins'} ago`; }
                          else if (diff < 86400) { const h = Math.floor(diff / 3600); timeAgo = `${h} ${h === 1 ? 'hour' : 'hours'} ago`; }
                          else if (diff < 2592000) { const d = Math.floor(diff / 86400); timeAgo = `${d} ${d === 1 ? 'day' : 'days'} ago`; }
                          else if (diff < 31536000) { const mo = Math.floor(diff / 2592000); timeAgo = `${mo} ${mo === 1 ? 'month' : 'months'} ago`; }
                          else { const y = Math.floor(diff / 31536000); timeAgo = `${y} ${y === 1 ? 'year' : 'years'} ago`; }
                          
                          return <>{dateStr} <span style={{ opacity: 0.7, fontWeight: 400 }}>· {timeAgo}</span></>;
                        }
                        
                        return dateStr;
                      })()}
                    </span>
                  )}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
                                    {email.scheduledFor && new Date(email.scheduledFor).getTime() > Date.now() && (
                                      <div style={{ width: '60px', height: '4px', backgroundColor: '#b2dfdb', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                                        <div style={{ height: '100%', animation: `schedule-progress ${Math.max(0, new Date(email.scheduledFor).getTime() - new Date(email.date).getTime())}ms linear forwards`, animationDelay: `-${Math.max(0, Date.now() - new Date(email.date).getTime())}ms` }} />
                                      </div>
                                    )}
                                    <span style={{ color: (email.folder === 'sent' || type === 'sent') ? '#222' : email.folder === 'drafts' ? '#ff5722' : !email.isRead ? '#0288d1' : '#666', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap' }}>
                    {(() => {
                      if (email.folder === 'drafts' || type === 'drafts') {
                        const diff = Math.max(0, Math.floor((Date.now() - new Date(email.date).getTime()) / 1000));
                        if (diff < 60) return `${diff} ${diff === 1 ? 'sec' : 'secs'} ago`;
                        if (diff < 3600) { const m = Math.floor(diff / 60); return `${m} ${m === 1 ? 'min' : 'mins'} ago`; }
                        if (diff < 86400) { const h = Math.floor(diff / 3600); return `${h} ${h === 1 ? 'hour' : 'hours'} ago`; }
                        if (diff < 2592000) { const d = Math.floor(diff / 86400); return `${d} ${d === 1 ? 'day' : 'days'} ago`; }
                        if (diff < 31536000) { const mo = Math.floor(diff / 2592000); return `${mo} ${mo === 1 ? 'month' : 'months'} ago`; }
                        const y = Math.floor(diff / 31536000); return `${y} ${y === 1 ? 'year' : 'years'} ago`;
                      }
                      const emailDate = new Date(email.date);
                      const nowTime = new Date();
                      const isToday = emailDate.getFullYear() === nowTime.getFullYear() && emailDate.getMonth() === nowTime.getMonth() && emailDate.getDate() === nowTime.getDate();
                      if (isToday) {
                        return emailDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                      } else {
                        const day = emailDate.getDate();
                        const month = emailDate.toLocaleString('default', { month: 'short' });
                        return emailDate.getFullYear() === nowTime.getFullYear() ? `${day} ${month}` : `${day} ${month} ${emailDate.getFullYear()}`;
                      }
                    })()}
                                    </span>
                                  </div>
                  {email.scheduledFor && (
                    <span className="scheduled-until" style={{ paddingLeft: 0, paddingRight: 0, height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#00897b', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      <span className="active-scheduled-icon-bg" style={{ width: '11px', height: '11px', backgroundSize: '11px 11px', margin: 0, flexShrink: 0 }} />
                      {(() => {
                        const scheduledDate = new Date(email.scheduledFor);
                        const now = new Date();
                        const time = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        const isToday = scheduledDate.getFullYear() === now.getFullYear()
                          && scheduledDate.getMonth() === now.getMonth()
                          && scheduledDate.getDate() === now.getDate();
                        
                        let dateStr = '';
                        if (isToday) {
                          dateStr = `Today ${time}`;
                        } else {
                          const day = scheduledDate.getDate();
                          const month = scheduledDate.toLocaleString('default', { month: 'short' });
                          dateStr = scheduledDate.getFullYear() === now.getFullYear() ? `${day} ${month}` : `${day} ${month} ${scheduledDate.getFullYear()}`;
                          dateStr = `${dateStr} ${time}`;
                        }

                        if (scheduledDate.getTime() <= now.getTime()) {
                          const diff = Math.floor((now.getTime() - scheduledDate.getTime()) / 1000);
                          let timeAgo = '';
                          if (diff < 60) timeAgo = `${diff} ${diff === 1 ? 'sec' : 'secs'} ago`;
                          else if (diff < 3600) { const m = Math.floor(diff / 60); timeAgo = `${m} ${m === 1 ? 'min' : 'mins'} ago`; }
                          else if (diff < 86400) { const h = Math.floor(diff / 3600); timeAgo = `${h} ${h === 1 ? 'hour' : 'hours'} ago`; }
                          else if (diff < 2592000) { const d = Math.floor(diff / 86400); timeAgo = `${d} ${d === 1 ? 'day' : 'days'} ago`; }
                          else if (diff < 31536000) { const mo = Math.floor(diff / 2592000); timeAgo = `${mo} ${mo === 1 ? 'month' : 'months'} ago`; }
                          else { const y = Math.floor(diff / 31536000); timeAgo = `${y} ${y === 1 ? 'year' : 'years'} ago`; }
                          
                          return <>{dateStr} <span style={{ opacity: 0.7, fontWeight: 400 }}>· {timeAgo}</span></>;
                        }
                        
                        return dateStr;
                      })()}
                    </span>
                  )}
                </div>
              </div>
            </div>
              ))}
            </div>
            )
          })}
              </>
            )
          })()}
          {/* Child label sections — shown directly after parent emails */}
          {includeChildren && currentLabelNode && currentLabelNode.children && currentLabelNode.children.length > 0 && (
            <div className="child-label-sections">
          {currentLabelNode.children.map((child: any) => {
            const childFullName = `${labelName ? decodeURIComponent(labelName) : ''} / ${child.name}`
            const isExpanded = expandedChildSections.has(childFullName)
            const isLoading = loadingChildSections.has(childFullName)
            const childEmails = childEmailsMap.get(childFullName) || []
            const hasGrandchildren = child.children && child.children.length > 0
            const childCounts = childEmailsMap.has(childFullName)
              ? {
                  total: childEmails.length,
              unread: childEmails.filter(e => !e.isRead && e.folder !== 'sent' && e.folder !== 'drafts' && !e.isScheduled && !e.isDraft).length,
                }
              : childCountsMap.get(childFullName)
            const childDropdownKey = `__child_label__${childFullName}`
            const shouldShowChild = isExpanded && childEmails.length > 0 && selectionMode && (hoveredChildHeader === childFullName || childEmails.some(e => selectedEmails.has(e.id)) || openDateGroupDropdown === childDropdownKey)
            return (
              <div key={child.id} className="child-label-section">
                <div className="child-label-header" style={{ border: `${isExpanded ? '1px' : '0.5px'} solid ${child.color || '#888888'}` }}
                  onClick={() => toggleChildSection(child, childFullName)}
                  onMouseEnter={() => setHoveredChildHeader(childFullName)}
                  onMouseLeave={() => setHoveredChildHeader(null)}
                >
                  {/* 1. Toggle button */}
                  <div style={{ width: '16px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isExpanded ? 'white' : '#f0f0f0', borderTopLeftRadius: '18px', borderBottomLeftRadius: '18px', borderTopRightRadius: 0, borderBottomRightRadius: 0, flexShrink: 0 }}>
                    {isExpanded
                      ? <ChevronDown size={16} style={{ color: child.color || '#999' }} />
                      : <ChevronRight size={16} style={{ color: '#999' }} />}
                  </div>
                  {/* 2. Checkbox + dropdown (hover, expanded, has emails) */}
                  {shouldShowChild && (
                    <div className="checkbox-dropdown" style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="mail-checkbox"
                        style={{ width: '16px', height: '16px' }}
                        ref={(el) => {
                          if (el) {
                            const sc = childEmails.filter(e => selectedEmails.has(e.id)).length
                            el.checked = sc === childEmails.length && childEmails.length > 0
                            el.indeterminate = sc > 0 && sc < childEmails.length
                          }
                        }}
                        onChange={(e) => {
                          e.stopPropagation()
                          const ids = childEmails.map(em => em.id)
                          const sc = childEmails.filter(e => selectedEmails.has(e.id)).length
                          const next = new Set(selectedEmails)
                          if (sc === childEmails.length) ids.forEach(id => next.delete(id))
                          else ids.forEach(id => next.add(id))
                          setSelectedEmails(next)
                          setOpenDateGroupDropdown(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        className="checkbox-dropdown-btn"
                        style={{ width: '15px', height: '16px', padding: 0, backgroundColor: 'white', border: 'none', background: 'none', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (openDateGroupDropdown === childDropdownKey) { setOpenDateGroupDropdown(null); setDateDropdownPos(null) }
                          else { setDateDropdownPos(calculateDropdownPos(e.currentTarget)); setOpenDateGroupDropdown(childDropdownKey) }
                        }}
                      ><ChevronDown size={16} /></button>
                      {openDateGroupDropdown === childDropdownKey && dateDropdownPos && createPortal(
                        <div className="checkbox-dropdown-menu" style={{ position: 'fixed', top: `${dateDropdownPos.top + 8}px`, left: `${dateDropdownPos.left}px`, zIndex: 999999999, pointerEvents: 'auto', margin: 0 }} onClick={(e) => e.stopPropagation()}>
                          <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('all', childEmails, false)}>All</button>
                          <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('none', childEmails, false)}>None</button>
                          <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('read', childEmails, false)}>Read</button>
                          <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('unread', childEmails, false)}>Unread</button>
                          <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('starred', childEmails, false)}>Starred</button>
                          <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('unstarred', childEmails, false)}>Unstarred</button>
                        </div>,
                        document.body
                      )}
                    </div>
                  )}
                  {/* 3. Folder icon */}
                  {hasGrandchildren
                    ? isExpanded
                      ? <FolderOpen size={16} style={{ color: child.color, fill: 'currentColor', opacity: 0.8, flexShrink: 0 }} />
                      : <Folder size={16} style={{ color: child.color, fill: 'currentColor', opacity: 0.8, flexShrink: 0 }} />
                    : <Tag size={16} style={{ color: child.color, fill: 'currentColor', opacity: 0.8, flexShrink: 0 }} />}
                  <span className="child-label-name" style={{ color: child.color }}>
                    {childFullName.split(' / ').map((part, i, arr) => (
                      <span key={i}>
                        {i > 0 && <span style={{ opacity: 0.45, margin: '0 3px', fontWeight: 400 }}>/</span>}
                        <span style={{ fontWeight: i === arr.length - 1 ? 600 : 400, opacity: i === arr.length - 1 ? 1 : 0.55 }}>{part}</span>
                      </span>
                    ))}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {(childCounts?.total ?? 0) > 0 && (
                      <span style={{ backgroundColor: '#d4d4d4', color: '#111', fontSize: '13.5px', fontWeight: 500, padding: '1px 4px', borderRadius: '10px', flexShrink: 0, display: 'inline-block' }}>{childCounts!.total}</span>
                    )}
                    {(childCounts?.unread ?? 0) > 0 && (
                      <span style={{ backgroundColor: '#2196f3', color: 'white', fontSize: '13.5px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '10px', flexShrink: 0, display: 'inline-block' }}>{childCounts!.unread}</span>
                    )}
                  </span>
                </div>
                {isExpanded && (
                  <div className="child-label-emails">
                    {isLoading ? (
                      <div style={{ padding: '12px 16px', color: '#999', fontSize: '13px' }}>Loading...</div>
                    ) : childEmails.length === 0 ? (
                      <div style={{ padding: '12px 16px', color: '#999', fontSize: '13px' }}>No emails</div>
                    ) : groupEmailsByDateRange(childEmails).map(([dateRange, emailsInRange]) => {
                      const childKey = `child::${childFullName}::${dateRange}`
                      const parentYearKey = getParentYear(dateRange)
                      const parentChildKey = parentYearKey ? `child::${childFullName}::${parentYearKey}` : null
                      if (!isYearHeader(dateRange) && parentChildKey && collapsedDateGroups.has(parentChildKey)) return null

                      if (isYearHeader(dateRange)) {
                        const yearEmails = groupEmailsByDateRange(childEmails)
                          .filter(([range]) => !isYearHeader(range) && getParentYear(range) === dateRange)
                          .flatMap(([_, emails]) => emails)
                        const allSelected = yearEmails.length > 0 && yearEmails.every(e => selectedEmails.has(e.id))
                        const shouldShow = selectionMode && (hoveredDateGroup === childKey || yearEmails.some(e => selectedEmails.has(e.id)) || openDateGroupDropdown === childKey) && !collapsedDateGroups.has(childKey)
                        const counts = getYearEmailCounts(dateRange, childEmails)
                        return (
                          <div key={dateRange}
                            style={{
                              display: 'flex', alignItems: 'center', height: '25px',
                              padding: '0', margin: '0 8px 5px 8px', borderRadius: '24px',
                              cursor: 'pointer', userSelect: 'none', gap: '0px',
                              fontSize: '13px', fontWeight: '500', color: '#333',
                              position: 'sticky', top: '1px', zIndex: 11, overflow: 'visible',
                              textTransform: 'uppercase', letterSpacing: '0.5px',
                              transition: 'padding 0.2s ease',
                              backgroundColor: allSelected ? '#f0f7ff' : hoveredDateGroup === childKey ? (collapsedDateGroups.has(childKey) ? '#e8e8e8' : '#f9f9f9') : (collapsedDateGroups.has(childKey) ? 'transparent' : '#f0f0f0'),
                              border: (allSelected || !collapsedDateGroups.has(childKey)) ? '0.5px solid #888888' : 'none',
                              boxShadow: hoveredDateGroup === childKey ? (collapsedDateGroups.has(childKey) ? '0 2px 4px rgba(0,0,0,0.6)' : '0 2px 8px rgba(0,0,0,0.4)') : 'none',
                            }}
                            onMouseEnter={() => setHoveredDateGroup(childKey)}
                            onMouseLeave={() => setHoveredDateGroup(null)}
                            onClick={() => toggleDateGroupCollapse(childKey)}
                          >
                            {/* Checkbox + Dropdown */}
                            <div className="checkbox-dropdown" style={{ display: shouldShow ? 'flex' : 'none', alignItems: 'center', gap: '2px', position: 'relative', transition: 'all 0.2s ease', marginLeft: '16px' }}>
                              <input type="checkbox" className="mail-checkbox"
                                style={{ display: shouldShow ? 'block' : 'none', width: '16px', height: '16px' }}
                                ref={(el) => {
                                  if (el) {
                                    const sc = yearEmails.filter(e => selectedEmails.has(e.id)).length
                                    el.checked = sc === yearEmails.length && yearEmails.length > 0
                                    el.indeterminate = sc > 0 && sc < yearEmails.length
                                  }
                                }}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  const ids = yearEmails.map(em => em.id)
                                  const sc = yearEmails.filter(e => selectedEmails.has(e.id)).length
                                  const next = new Set(selectedEmails)
                                  if (sc === yearEmails.length) ids.forEach(id => next.delete(id))
                                  else if (sc === 0) ids.forEach(id => next.add(id))
                                  else ids.forEach(id => next.delete(id))
                                  setSelectedEmails(next)
                                  setOpenDateGroupDropdown(null)
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button className="checkbox-dropdown-btn"
                                style={{ width: '15px', height: '16px', display: shouldShow ? 'block' : 'none', padding: 0, backgroundColor: 'white', border: 'none', background: 'none', cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (openDateGroupDropdown === childKey) { setOpenDateGroupDropdown(null); setDateDropdownPos(null) }
                                  else { setDateDropdownPos(calculateDropdownPos(e.currentTarget)); setOpenDateGroupDropdown(childKey) }
                                }}
                              ><ChevronDown size={16} /></button>
                              {openDateGroupDropdown === childKey && dateDropdownPos && createPortal(
                                <div className="checkbox-dropdown-menu" style={{ position: 'fixed', top: `${dateDropdownPos.top + 8}px`, left: `${dateDropdownPos.left}px`, zIndex: 999999999, pointerEvents: 'auto', margin: 0 }} onClick={(e) => e.stopPropagation()}>
                                  <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('all', yearEmails, false)}>All</button>
                                  <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('none', yearEmails, false)}>None</button>
                                  <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('read', yearEmails, false)}>Read</button>
                                  <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('unread', yearEmails, false)}>Unread</button>
                                  <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('starred', yearEmails, false)}>Starred</button>
                                  <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('unstarred', yearEmails, false)}>Unstarred</button>
                                </div>, document.body
                              )}
                            </div>
                            {/* Toggle chevron */}
                            <div style={{ display: 'flex', alignItems: 'center', marginLeft: '9px', marginRight: '4px' }}>
                              {collapsedDateGroups.has(childKey) ? <ChevronRight size={18} style={{ color: '#999' }} /> : <ChevronDown size={18} style={{ color: '#999' }} />}
                            </div>
                            {/* Label */}
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
                              <span style={{ fontSize: '13px' }}>
                                {getDisplayDateRangeLabel(dateRange, emailsInRange)}
                                {counts.total > 0 && <span style={{ backgroundColor: '#d4d4d4', color: '#111', fontSize: '13.5px', fontWeight: 500, padding: '1px 4px', borderRadius: '10px', marginLeft: '4px', display: 'inline-block' }}>{counts.total}</span>}
                              </span>
                              {counts.unread > 0 && <span style={{ backgroundColor: '#2196f3', color: 'white', padding: '1px 4px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', marginLeft: '2px' }}>{counts.unread}</span>}
                            </span>
                          </div>
                        )
                      }

                      const allSelected = emailsInRange.length > 0 && emailsInRange.every(e => selectedEmails.has(e.id))
                      return (
                        <div key={dateRange} style={{ paddingBottom: '4px' }}>
                          {/* Date heading */}
                          <div
                            style={{
                              display: 'flex', alignItems: 'center', height: '25px',
                              padding: '0', margin: '0 8px 5px 8px', borderRadius: '24px',
                              cursor: 'pointer', userSelect: 'none', gap: '0px',
                              fontSize: '13px', fontWeight: '500', color: '#333',
                              position: 'sticky', top: '1px', zIndex: 10, overflow: 'visible',
                              transition: 'padding 0.2s ease',
                              backgroundColor: allSelected ? '#f0f7ff' : hoveredDateGroup === childKey ? (collapsedDateGroups.has(childKey) ? '#e8e8e8' : '#f9f9f9') : (collapsedDateGroups.has(childKey) ? 'transparent' : '#f0f0f0'),
                              border: (allSelected || !collapsedDateGroups.has(childKey)) ? '0.5px solid #888888' : 'none',
                              boxShadow: hoveredDateGroup === childKey ? (collapsedDateGroups.has(childKey) ? '0 2px 4px rgba(0,0,0,0.6)' : '0 2px 8px rgba(0,0,0,0.4)') : 'none',
                            }}
                            onMouseEnter={() => setHoveredDateGroup(childKey)}
                            onMouseLeave={() => setHoveredDateGroup(null)}
                            onClick={() => toggleDateGroupCollapse(childKey)}
                          >
                            {/* Checkbox + Dropdown - expanded state only */}
                            {!collapsedDateGroups.has(childKey) && selectionMode && (hoveredDateGroup === childKey || emailsInRange.some(e => selectedEmails.has(e.id)) || openDateGroupDropdown === childKey) && (
                              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '1rem', marginRight: '4px', position: 'relative' }}>
                                <input type="checkbox" className="mail-checkbox"
                                  style={{ width: '16px', height: '16px' }}
                                  ref={(el) => {
                                    if (el) {
                                      const sc = emailsInRange.filter(e => selectedEmails.has(e.id)).length
                                      el.checked = sc === emailsInRange.length && emailsInRange.length > 0
                                      el.indeterminate = sc > 0 && sc < emailsInRange.length
                                    }
                                  }}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    const ids = emailsInRange.map(em => em.id)
                                    const sc = emailsInRange.filter(e => selectedEmails.has(e.id)).length
                                    const next = new Set(selectedEmails)
                                    if (sc === emailsInRange.length) ids.forEach(id => next.delete(id))
                                    else if (sc === 0) ids.forEach(id => next.add(id))
                                    else ids.forEach(id => next.delete(id))
                                    setSelectedEmails(next)
                                    setOpenDateGroupDropdown(null)
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <button className="checkbox-dropdown-btn"
                                  style={{ width: '15px', height: '16px', padding: 0, backgroundColor: 'white', border: 'none', background: 'none', cursor: 'pointer' }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (openDateGroupDropdown === childKey) { setOpenDateGroupDropdown(null); setDateDropdownPos(null) }
                                    else { setDateDropdownPos(calculateDropdownPos(e.currentTarget)); setOpenDateGroupDropdown(childKey) }
                                  }}
                                ><ChevronDown size={16} /></button>
                                {openDateGroupDropdown === childKey && dateDropdownPos && createPortal(
                                  <div className="checkbox-dropdown-menu" style={{ position: 'fixed', top: `${dateDropdownPos.top + 8}px`, left: `${dateDropdownPos.left}px`, zIndex: 999999999, pointerEvents: 'auto', margin: 0 }} onClick={(e) => e.stopPropagation()}>
                                    <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('all', emailsInRange, false)}>All</button>
                                    <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('none', emailsInRange, false)}>None</button>
                                    <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('read', emailsInRange, false)}>Read</button>
                                    <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('unread', emailsInRange, false)}>Unread</button>
                                    <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('starred', emailsInRange, false)}>Starred</button>
                                    <button className="dropdown-option" onClick={() => handleGroupDropdownSelect('unstarred', emailsInRange, false)}>Unstarred</button>
                                  </div>, document.body
                                )}
                              </div>
                            )}
                            {/* Toggle chevron */}
                            <div style={{ display: 'flex', alignItems: 'center', marginLeft: (!collapsedDateGroups.has(childKey) && selectionMode && (hoveredDateGroup === childKey || emailsInRange.some(e => selectedEmails.has(e.id)) || openDateGroupDropdown === childKey)) ? '4px' : (/^\d{4}-\d{2}$/.test(dateRange) ? '18px' : dateRange === 'This week' ? '27px' : dateRange === 'Yesterday' ? '36px' : dateRange === 'Today' ? '45px' : '9px'), marginRight: '4px' }}>
                              {collapsedDateGroups.has(childKey) ? <ChevronRight size={18} style={{ color: '#999' }} /> : <ChevronDown size={18} style={{ color: '#999' }} />}
                            </div>
                            <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0px' }}>
                              <span style={{ fontSize: '13px' }}>
                                {getDisplayDateRangeLabel(dateRange, emailsInRange)}
                                {emailsInRange.length > 0 && (
                                  <span style={{ backgroundColor: '#d4d4d4', color: '#111', fontSize: '13.5px', fontWeight: 500, padding: '1px 4px', borderRadius: '10px', flexShrink: 0, marginLeft: '4px', display: 'inline-block' }}>{emailsInRange.length}</span>
                                )}
                              </span>
                              {emailsInRange.filter(e => !e.isRead && e.folder !== 'sent' && e.folder !== 'drafts' && !e.isScheduled && !e.isDraft).length > 0 && (
                                <span style={{ backgroundColor: '#2196f3', color: 'white', padding: '1px 4px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0, marginLeft: '2px' }}>
                                  {emailsInRange.filter(e => !e.isRead && e.folder !== 'sent' && e.folder !== 'drafts' && !e.isScheduled && !e.isDraft).length}
                                </span>
                              )}
                            </span>
                          </div>
                          {!collapsedDateGroups.has(childKey) && emailsInRange.map((email, idx) => (
                            <div
                              key={email.id}
                              className={`email-item ${!email.isRead && type !== 'sent' && email.folder !== 'sent' && email.folder !== 'drafts' ? 'unread' : ''} ${(email.folder === 'sent' || type === 'sent') ? 'sent' : ''} ${selectedEmails.has(email.id) ? 'selected' : ''}`}
                              onClick={async () => {
                                if (selectionMode) { handleSelectEmail(email.id); return; }
                                if (!email.isRead && email.id && email.folder !== 'sent' && email.folder !== 'drafts' && !email.isScheduled) {
                                  try {
                                    await fetch(`http://localhost:5050/api/emails/${email.id}/read`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                      body: JSON.stringify({ is_read: true }),
                                    })
                                    updateChildEmail(childFullName, email.id, { isRead: true })
                                  } catch (_) {}
                                }
                                onViewEmail(email)
                              }}
                              onContextMenu={(e) => handleContextMenu(e, email)}
                            >
                              <div className="checkbox-wrapper">
                                {!email.isRead && email.folder !== 'sent' && email.folder !== 'drafts' && (
                                  <div className="unread-indicator"></div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', cursor: 'pointer' }}
                                  className="checkbox-icon-wrapper"
                                  onClick={(e) => { e.stopPropagation(); handleSelectEmail(email.id); setOpenDateGroupDropdown(null); }}
                                >
                                  {selectedEmails.has(email.id) ? (
                                    <CheckSquare size={18} style={{ color: '#1a73e8' }} className="checkbox-icon" />
                                  ) : (
                                    <>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', minWidth: '28px', minHeight: '28px', fontSize: '12px', fontWeight: 'bold', color: '#fff', backgroundColor: getAvatarColor((email.folder === 'sent' || email.folder === 'drafts') ? email.to : email.from), borderRadius: '50%', overflow: 'hidden' }} className="profile-icon">
                                        {getAvatarInitials((email.folder === 'sent' || email.folder === 'drafts') ? email.to : email.from)}
                                      </div>
                                      <Square size={18} style={{ color: '#999' }} className="checkbox-icon" />
                                    </>
                                  )}
                                </div>
                              </div>
                              <button
                                className={`star-btn ${email.isStarred ? 'active' : ''}`}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  if (!email.id) return
                                  try {
                                    await fetch(`http://localhost:5050/api/emails/${email.id}/star`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } })
                                    updateChildEmail(childFullName, email.id, { isStarred: !email.isStarred })
                                  } catch (_) {}
                                }}
                                title={email.isStarred ? 'Remove star' : 'Add star'}
                              >
                                <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
                              </button>
                              {email.isPinned && (
                                <Pin size={16} style={{ color: '#4caf50', flexShrink: 0, marginLeft: '2px', transform: 'rotate(-45deg)' }} title="Pinned" />
                              )}
                              <div className="email-from">
                                {email.folder === 'drafts'
                                  ? <span className="email-to"><span style={{color:'#ff5722',fontWeight:700}}>Draft</span>{' '}<span style={{fontWeight:600,color:'#111'}}>{highlightText((email.to||'').split('@')[0], searchQuery)}</span>{(email.to||'').includes('@')&&<span style={{fontWeight:300,color:'#555'}}>@{highlightText((email.to||'').split('@')[1], searchQuery)}</span>}</span>
                                  : email.folder === 'sent'
                                    ? <span className="email-to"><span style={{color:'#fb8c00',fontWeight:700}}>To:</span>{' '}<span style={{fontWeight:600,color:'#111'}}>{highlightText((email.to||'').split('@')[0], searchQuery)}</span>{(email.to||'').includes('@')&&<span style={{fontWeight:300,color:'#555'}}>@{highlightText((email.to||'').split('@')[1], searchQuery)}</span>}</span>
                                  : <><span style={{fontWeight:600,color:email.isRead?'#111':'#0288d1'}}>{highlightText((email.from||'').split('@')[0], searchQuery)}</span>{(email.from||'').includes('@')&&<span style={{fontWeight:300,color:email.isRead?'#555':'#0288d1'}}>@{highlightText((email.from||'').split('@')[1], searchQuery)}</span>}</>}
                              </div>
                              <div style={(!!email.hasAttachments || /data-file-card/i.test(email.body || '')) ? { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4px 0' } : { flex: 1, minWidth: 0, display: 'flex' }}>
                                <div className="email-subject" style={(!!email.hasAttachments || /data-file-card/i.test(email.body || '')) ? { flex: 'none', width: '100%' } : { flex: 1, width: '100%' }}>
                                  {(() => {
                                    const iconNode = getFolderIcon(email.folder, email);
                                    return iconNode ? <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '4px', verticalAlign: 'middle', flexShrink: 0 }}>{iconNode}</span> : null;
                                  })()}
                                  {email.isMuted && <VolumeX size={18} style={{ marginRight: '0px', marginLeft: '0px', display: 'inline', color: '#999', flexShrink: 0 }} />}
                                  {(() => {
                                    const lowerSub = (email.subject || '').toLowerCase().trim();
                                    if (lowerSub.startsWith('re:')) {
                                      return <Reply size={13} style={{ color: '#888', flexShrink: 0, marginRight: '4px', display: 'inline', verticalAlign: 'middle' }}><title>Replied</title></Reply>
                                    }
                                    if (lowerSub.startsWith('fwd:')) {
                                      return <Forward size={13} style={{ color: '#888', flexShrink: 0, marginRight: '4px', display: 'inline', verticalAlign: 'middle' }}><title>Forwarded</title></Forward>
                                    }
                                    return null;
                                  })()}
                                  <span style={{ color: (!email.subject || email.subject === '(No subject)') ? '#888' : 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, minWidth: 0 }}>
                                    {highlightText(email.subject || '(No subject)', searchQuery)}
                                  </span>
                                  {(() => { const p = bodyPreview(email.body, email.hasAttachments); return p ? <span className="email-preview" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 99999, minWidth: 0 }}> - {highlightText(p, searchQuery)}</span> : null; })()}
                                </div>
                                {(() => { const html = extractFileCardsHtml(email.body || ''); if (!html) return null; return <FileCardsOverflowContainer html={html} /> })()}
                              </div>
                              <div className="email-hover-actions" style={{ display: moveMenuOpen === email.id || snoozeMenuOpen === email.id ? 'flex' : undefined }}>
                                <button className="action-btn trash-btn" onClick={async (e) => {
                                  e.stopPropagation()
                                  try {
                                    const res = await fetch(`http://localhost:5050/api/emails/${email.id}/delete`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } })
                                    if (res.ok) {
                                      removeChildEmail(childFullName, email.id)
                                      showToast('Conversation moved to Deleted', async () => {
                                        await fetch(`http://localhost:5050/api/emails/${email.id}/delete`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } })
                                      })
                                    }
                                  } catch (_) {}
                                }} title="Deleted">
                                  <Trash2 size={18} />
                                </button>
                                {email.folder !== 'sent' && email.folder !== 'drafts' && (
                                  <button className={`action-btn ${email.isRead ? 'unread-btn' : 'read-btn'}`} onClick={async (e) => {
                                    e.stopPropagation()
                                    if (!email.id) return
                                    const newRead = !email.isRead
                                    try {
                                      await fetch(`http://localhost:5050/api/emails/${email.id}/read`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                        body: JSON.stringify({ is_read: newRead }),
                                      })
                                      updateChildEmail(childFullName, email.id, { isRead: newRead })
                                    } catch (_) {}
                                  }} title={email.isRead ? 'Mark as unread' : 'Mark as read'}>
                                    <span className="default-icon" style={{ position: 'relative', display: 'inline-flex' }}>
                                      {!email.isRead ? (
                                        <><Mail size={18} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></>
                                      ) : <><MailOpen size={18} /><span style={{ position: 'absolute', bottom: -2, right: -2.5, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ strokeWidth: 4 }} /></span></>}
                                    </span>
                                    <span className="hover-icon" style={{ position: 'relative', display: 'inline-flex' }}>
                                      {!email.isRead ? (
                                        <><MailOpen size={18} /><span style={{ position: 'absolute', bottom: -2, right: -2.5, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ strokeWidth: 4 }} /></span></>
                                      ) : <><Mail size={18} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></>}
                                    </span>
                                  </button>
                                )}
                                {email.folder !== 'sent' && email.folder !== 'drafts' && !email.isArchived && (
                                  <button className="action-btn archive-btn" onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!email.id) return;
                                    try {
                                      const response = await fetch('http://localhost:5050/api/emails/batch', {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                        body: JSON.stringify({ ids: [email.id], action: 'archive' }),
                                      });
                                      if (response.ok) {
                                        removeChildEmail(childFullName, email.id);
                                        showToast('Email archived', async () => {
                                          await fetch('http://localhost:5050/api/emails/batch', {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                            body: JSON.stringify({ ids: [email.id], action: 'archive' }),
                                          });
                                          onRefreshCounts?.();
                                        });
                                        onRefreshCounts?.();
                                      }
                                    } catch (err) {
                                      console.error('Failed to archive email:', err);
                                    }
                                  }} title="Archive">
                                    <Archive size={18} />
                                  </button>
                                )}
                                <div style={{ position: 'relative' }}>
                                  <button className="action-btn snoozed-btn" data-snooze-btn="true" onClick={(e) => handleSnoozeClick(email.id, e)} title="Snooze"
                                    style={snoozeMenuOpen === email.id ? { backgroundColor: 'white', border: '1px solid #888888', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' } : undefined}>
                                    <Clock size={18} />
                                  </button>
                                </div>
                                <button className="action-btn" data-move-btn="true" onClick={(e) => handleMoveClick(email.id, e)} title="Move to"
                                  style={moveMenuOpen === email.id ? { backgroundColor: 'white', border: '1px solid #888888', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' } : undefined}>
                                  <FolderInput size={18} />
                                </button>
                              </div>
                              <div style={{ marginLeft: 'auto', marginRight: '1px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                <div className="email-date" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minHeight: '48px', minWidth: '110px' }}>
                                  {email.isSnoozed && email.snoozedUntil && (
                                    <span className="snoozed-until" style={{ position: 'absolute', bottom: 'calc(50% + 9px)', right: 0, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      <Clock size={11} style={{ flexShrink: 0 }} />
                                      {(() => {
                                        const snoozedDate = new Date(email.snoozedUntil);
                                        const now = new Date();
                                        const time = snoozedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                                        const isToday = snoozedDate.getFullYear() === now.getFullYear()
                                          && snoozedDate.getMonth() === now.getMonth()
                                          && snoozedDate.getDate() === now.getDate();
                                        const countText = email.snoozeCount && email.snoozeCount > 1 ? ` (${email.snoozeCount})` : '';
                                        
                                        let dateStr = '';
                                        if (isToday) {
                                          dateStr = `Today ${time}${countText}`;
                                        } else {
                                          const day = snoozedDate.getDate();
                                          const month = snoozedDate.toLocaleString('default', { month: 'short' });
                                          dateStr = snoozedDate.getFullYear() === now.getFullYear() ? `${day} ${month}` : `${day} ${month} ${snoozedDate.getFullYear()}`;
                                          dateStr = `${dateStr} ${time}${countText}`;
                                        }

                                        if (snoozedDate.getTime() <= now.getTime()) {
                                          const diff = Math.floor((now.getTime() - snoozedDate.getTime()) / 1000);
                                          let timeAgo = '';
                                          if (diff < 60) timeAgo = `${diff} ${diff === 1 ? 'sec' : 'secs'} ago`;
                                          else if (diff < 3600) { const m = Math.floor(diff / 60); timeAgo = `${m} ${m === 1 ? 'min' : 'mins'} ago`; }
                                          else if (diff < 86400) { const h = Math.floor(diff / 3600); timeAgo = `${h} ${h === 1 ? 'hour' : 'hours'} ago`; }
                                          else if (diff < 2592000) { const d = Math.floor(diff / 86400); timeAgo = `${d} ${d === 1 ? 'day' : 'days'} ago`; }
                                          else if (diff < 31536000) { const mo = Math.floor(diff / 2592000); timeAgo = `${mo} ${mo === 1 ? 'month' : 'months'} ago`; }
                                          else { const y = Math.floor(diff / 31536000); timeAgo = `${y} ${y === 1 ? 'year' : 'years'} ago`; }
                                          
                                          return <>{dateStr} <span style={{ opacity: 0.7, fontWeight: 400 }}>· {timeAgo}</span></>;
                                        }
                                        
                                        return dateStr;
                                      })()}
                                    </span>
                                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
                    {email.scheduledFor && new Date(email.scheduledFor).getTime() > Date.now() && (
                      <div style={{ width: '60px', height: '4px', backgroundColor: '#b2dfdb', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ height: '100%', animation: `schedule-progress ${Math.max(0, new Date(email.scheduledFor).getTime() - new Date(email.date).getTime())}ms linear forwards`, animationDelay: `-${Math.max(0, Date.now() - new Date(email.date).getTime())}ms` }} />
                      </div>
                    )}
                    <span style={{ color: (email.folder === 'sent' || type === 'sent') ? '#222' : (email.folder === 'drafts' || type === 'drafts') ? '#ff5722' : !email.isRead ? '#0288d1' : '#666', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap' }}>
                                    {(() => {
                                      if (email.folder === 'drafts' || type === 'drafts') {
                                        const diff = Math.max(0, Math.floor((Date.now() - new Date(email.date).getTime()) / 1000));
                                        if (diff < 60) return `${diff} ${diff === 1 ? 'sec' : 'secs'} ago`;
                                        if (diff < 3600) { const m = Math.floor(diff / 60); return `${m} ${m === 1 ? 'min' : 'mins'} ago`; }
                                        if (diff < 86400) { const h = Math.floor(diff / 3600); return `${h} ${h === 1 ? 'hour' : 'hours'} ago`; }
                                        if (diff < 2592000) { const d = Math.floor(diff / 86400); return `${d} ${d === 1 ? 'day' : 'days'} ago`; }
                                        if (diff < 31536000) { const mo = Math.floor(diff / 2592000); return `${mo} ${mo === 1 ? 'month' : 'months'} ago`; }
                                        const y = Math.floor(diff / 31536000); return `${y} ${y === 1 ? 'year' : 'years'} ago`;
                                      }
                                      const emailDate = new Date(email.date);
                                      const nowTime = new Date();
                                      const isToday = emailDate.getFullYear() === nowTime.getFullYear() && emailDate.getMonth() === nowTime.getMonth() && emailDate.getDate() === nowTime.getDate();
                                      if (isToday) {
                                        return emailDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                                      } else {
                                        const day = emailDate.getDate();
                                        const month = emailDate.toLocaleString('default', { month: 'short' });
                                        return emailDate.getFullYear() === nowTime.getFullYear() ? `${day} ${month}` : `${day} ${month} ${emailDate.getFullYear()}`;
                                      }
                                    })()}
                    </span>
                  </div>
                              {email.scheduledFor && (
                                <span className="scheduled-until" style={{ position: 'absolute', top: 'calc(50% + 9px)', right: 0, paddingLeft: 0, paddingRight: 0, height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#4db6ac', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                  <span className={new Date(email.scheduledFor).getTime() <= Date.now() ? "active-scheduled-sent-icon-bg" : "active-scheduled-icon-bg"} style={{ width: '11px', height: '11px', backgroundSize: '11px 11px', margin: 0, flexShrink: 0 }} />
                                      <span className={new Date(email.scheduledFor).getTime() <= Date.now() ? "active-scheduled-sent-icon-bg" : "active-scheduled-icon-bg"} style={{ width: '11px', height: '11px', backgroundSize: '11px 11px', margin: 0, flexShrink: 0 }} />
                                      {(() => {
                                        const scheduledDate = new Date(email.scheduledFor);
                                        const now = new Date();
                                        const time = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                                        const isToday = scheduledDate.getFullYear() === now.getFullYear()
                                          && scheduledDate.getMonth() === now.getMonth()
                                          && scheduledDate.getDate() === now.getDate();
                                        
                                        let dateStr = '';
                                        if (isToday) {
                                          dateStr = `Today ${time}`;
                                        } else {
                                          const day = scheduledDate.getDate();
                                          const month = scheduledDate.toLocaleString('default', { month: 'short' });
                                          dateStr = scheduledDate.getFullYear() === now.getFullYear() ? `${day} ${month}` : `${day} ${month} ${scheduledDate.getFullYear()}`;
                                          dateStr = `${dateStr} ${time}`;
                                        }

                                        if (scheduledDate.getTime() <= now.getTime()) {
                                          const diff = Math.floor((now.getTime() - scheduledDate.getTime()) / 1000);
                                          let timeAgo = '';
                                          if (diff < 60) timeAgo = `${diff} ${diff === 1 ? 'sec' : 'secs'} ago`;
                                          else if (diff < 3600) { const m = Math.floor(diff / 60); timeAgo = `${m} ${m === 1 ? 'min' : 'mins'} ago`; }
                                          else if (diff < 86400) { const h = Math.floor(diff / 3600); timeAgo = `${h} ${h === 1 ? 'hour' : 'hours'} ago`; }
                                          else if (diff < 2592000) { const d = Math.floor(diff / 86400); timeAgo = `${d} ${d === 1 ? 'day' : 'days'} ago`; }
                                          else if (diff < 31536000) { const mo = Math.floor(diff / 2592000); timeAgo = `${mo} ${mo === 1 ? 'month' : 'months'} ago`; }
                                          else { const y = Math.floor(diff / 31536000); timeAgo = `${y} ${y === 1 ? 'year' : 'years'} ago`; }
                                          
                                          return <>{dateStr} <span style={{ opacity: 0.7, fontWeight: 400 }}>· {timeAgo}</span></>;
                                        }
                        
                                        return dateStr;
                                      })()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
            </div>
          )}
        </div>
      )}

      {filteredEmails.length === 0 && !loading && !(includeChildren && labelName && currentLabelNode?.children?.length > 0) && (
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

      {moveMenuOpen !== null && moveMenuPosition && createPortal(
        (() => {
          const currentEmail = allEmails.find(e => e.id === moveMenuOpen)
          const currentLabelName = currentEmail?.label_name ?? null
          return (
            <div
              className="move-to-dropdown"
              style={{ position: 'fixed', top: moveMenuPosition.top ?? 'auto', bottom: moveMenuPosition.bottom ?? 'auto', right: moveMenuPosition.right, left: 'auto', width: '320px', minHeight: '200px', maxHeight: moveMenuPosition.maxHeight, background: '#fff', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)', border: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 9999 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '8px', borderBottom: '1px solid #e8e8e8', background: '#f8f8f8', borderRadius: '10px 10px 0 0', position: 'relative' }}>
                <input
                  type="text"
                  className="label-search-input"
                  placeholder="Search labels..."
                  value={labelSearchQuery}
                  onChange={(e) => setLabelSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  style={{ paddingRight: labelSearchQuery ? '28px' : '8px' }}
                />
                {labelSearchQuery && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setLabelSearchQuery('') }}
                    style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', display: 'flex', padding: 0 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {(() => {
                  const allItems = flattenLabelsTree(labels)
                  const searching = labelSearchQuery.trim() !== ''
                  const visible = searching
                    ? allItems.filter(l => l.fullPath.toLowerCase().includes(labelSearchQuery.toLowerCase()))
                    : allItems.filter(l => isMoveItemVisible(l, allItems))
                  if (visible.length === 0) return <div style={{ padding: '12px 14px', color: '#999', fontSize: '13px' }}>No labels found</div>
                  return visible.map(label => {
                    const isExpanded = expandedMoveLabels.has(label.id)
                    const isSelected = label.fullPath === currentLabelName
                    const iconColor = label.color
                    const depth = searching ? 0 : label.depth
                    return (
                      <div
                        key={label.id}
                        style={{
                          display: 'flex', alignItems: 'center',
                          paddingLeft: `${6 + depth * 16}px`, paddingRight: '10px',
                          borderBottom: '1px solid #f5f5f5',
                          background: isSelected ? '#e8f0fe' : undefined,
                        }}
                      >
                        {label.hasChildren ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedMoveLabels(prev => {
                                const next = new Set(prev)
                                next.has(label.id) ? next.delete(label.id) : next.add(label.id)
                                return next
                              })
                            }}
                            style={{ background: 'none', backgroundColor: 'white', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: isExpanded ? iconColor : '#888', flexShrink: 0 }}
                          >
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                        ) : (
                          <span style={{ width: '17px', flexShrink: 0 }} />
                        )}
                        <div
                          onClick={() => handleApplyLabel(moveMenuOpen, label.fullPath)}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                            paddingTop: '9px', paddingBottom: '9px',
                            cursor: 'pointer', fontSize: '14px', color: '#333',
                          }}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f5f5f5' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? '#e8f0fe' : 'transparent' }}
                        >
                          {label.hasChildren
                            ? isExpanded
                              ? <FolderOpen size={15} style={{ color: iconColor, stroke: iconColor, fill: 'none', flexShrink: 0 }} />
                              : <Folder size={15} style={{ color: iconColor, stroke: iconColor, fill: 'none', flexShrink: 0 }} />
                            : <Tag size={15} style={{ color: iconColor, stroke: iconColor, fill: 'none', flexShrink: 0 }} />}
                          <span style={{ fontWeight: depth === 0 ? 600 : 400 }}>{label.leafName}</span>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
              <div style={{ height: '1px', backgroundColor: '#ddd' }} />
              <button
                onClick={() => { setPendingMoveEmailId(moveMenuOpen); setMoveMenuOpen(null); setMoveMenuPosition(null); setClLabelName(''); setClLabelColor(''); setClParentId(null); setClError(''); setShowCreateLabelModal(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#667eea', padding: '10px 14px', fontSize: '13px', fontWeight: 600, background: 'none', backgroundColor: 'white', border: 'none', cursor: 'pointer', width: '100%' }}
              >
                <Plus size={15} />
                Create new label
              </button>
            </div>
          )
        })(),
        document.body
      )}
      
      {snoozeMenuOpen !== null && snoozeMenuPosition && createPortal(
        <div
          className="snooze-dropdown"
          style={{ position: 'fixed', top: snoozeMenuPosition.top ?? 'auto', bottom: snoozeMenuPosition.bottom ?? 'auto', right: snoozeMenuPosition.right, left: 'auto', maxHeight: snoozeMenuPosition.maxHeight, overflowY: 'auto', zIndex: 9999 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '8px 14px 6px', fontSize: '12px', fontWeight: 600, color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={13} style={{ flexShrink: 0 }} />
            Snooze until...
          </div>
          {(() => {
            const snoozedEmail = allEmails.find(e => e.id === snoozeMenuOpen)
            if (!snoozedEmail?.snoozedUntil) return null
            const d = new Date(snoozedEmail.snoozedUntil)
            const now = new Date()
            if (d <= now) return null
            const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
            const day = d.getDate()
            const month = d.toLocaleString('default', { month: 'short' })
            const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
            const label = isToday
              ? `Today ${time}`
              : d.getFullYear() === now.getFullYear()
                ? `${day} ${month} ${now.getFullYear()}`
                : `${day} ${month} ${d.getFullYear()}`
            return (
              <>
                <div style={{ padding: '8px 14px 6px', fontSize: '0.85rem', color: '#fb8c00', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', margin: '1px 4px', borderRadius: '8px' }}>
                  <AlarmClock size={15} style={{ flexShrink: 0 }} />
                  <span>Snoozed until {label}</span>
                </div>
                <button
                  className="dropdown-option snooze-unsnooze-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e53935', borderBottom: '1px solid #f0e0d0' }}
                  onClick={() => handleSnoozeConfirm(snoozeMenuOpen!, 0)}
                >
                  <AlarmClockOff size={15} style={{ flexShrink: 0 }} />
                  Unsnooze
                </button>
              </>
            )
          })()}
          {getDynamicSnoozeOptions().map(opt => (
            <button key={opt.label} className="dropdown-option" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }} onClick={() => handleSnoozeConfirm(snoozeMenuOpen!, opt.hours)}>
              <span>{opt.shortLabel}</span>
              <span style={{ color: '#888', fontWeight: 500, fontSize: '14px', whiteSpace: 'nowrap' }}>
                {opt.timeText}
              </span>
            </button>
          ))}
          <div className="snooze-separator"></div>
          <div className="snooze-custom-wrapper">
            <button
              className="dropdown-option"
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}
              onClick={(e) => {
                e.stopPropagation()
                const snoozedEmail = allEmails.find(e => e.id === snoozeMenuOpen)
                const existingSnooze = snoozedEmail?.snoozedUntil ? new Date(snoozedEmail.snoozedUntil) : null
                const ref = (existingSnooze && existingSnooze > new Date()) ? existingSnooze : new Date()
                const h = ref.getHours()
                setSnoozeHour(h % 12 || 12)
                setSnoozeMinute(ref.getMinutes())
                setSnoozePeriod(h >= 12 ? 'PM' : 'AM')
                setCalendarViewMonth(ref.getMonth())
                setCalendarViewYear(ref.getFullYear())
                setCustomSnoozeDate(existingSnooze && existingSnooze > new Date()
                  ? `${ref.getFullYear()}-${String(ref.getMonth()+1).padStart(2,'0')}-${String(ref.getDate()).padStart(2,'0')}`
                  : '')
                setCustomSnoozePopupEmailId(snoozeMenuOpen)
                setSnoozeMenuOpen(null)
                setSnoozeMenuPosition(null)
              }}
            >
              <Calendar size={15} style={{ flexShrink: 0 }} />
              Pick date &amp; time
            </button>
          </div>
        </div>,
        document.body
      )}
    
      {(customSnoozePopupEmailId !== null || customSnoozePopupBulk) && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setCustomSnoozePopupEmailId(null); setCustomSnoozePopupBulk(false); setCustomSnoozeDate('') }}
        >
          <div
            style={{ background: '#f0f0f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customSnoozeDate && (customSnoozePopupEmailId !== null || customSnoozePopupBulk)) {
                e.preventDefault()
                const hour24 = snoozePeriod === 'AM' ? snoozeHour % 12 : (snoozeHour % 12) + 12
                const dateTimeStr = `${customSnoozeDate}T${String(hour24).padStart(2,'0')}:${String(snoozeMinute).padStart(2,'0')}`
                if (customSnoozePopupBulk) {
                  const date = new Date(dateTimeStr)
                  const diff = date.getTime() - new Date().getTime()
                  const hours = diff / (1000 * 60 * 60)
                  if (hours > 0) handleBulkSnoozeConfirm(hours)
                  else alert('Please select a future time')
                  setCustomSnoozePopupBulk(false)
                } else if (customSnoozePopupEmailId !== null) {
                  handleCustomSnooze(customSnoozePopupEmailId, dateTimeStr)
                  setCustomSnoozePopupEmailId(null)
                }
                setCustomSnoozeDate('')
              }
            }}
          >
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlarmClock size={17} color="#fb8c00" />
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#333' }}>Pick date &amp; time</span>
            </div>

            {/* Body: left calendar + right controls */}
            {(() => {
              const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
              const todayStr = new Date().toISOString().slice(0, 10)
              const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate()
              const firstDay = new Date(calendarViewYear, calendarViewMonth, 1).getDay()

              return (
                <div style={{ display: 'flex' }}>

                  {/* ── Left: Calendar ── */}
                  <div style={{ padding: '22px 20px', borderRight: '1px solid #e0e0e0', width: '310px' }}>

                    {/* Month / year nav */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>{MONTH_NAMES[calendarViewMonth]} {calendarViewYear}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); calendarViewMonth === 0 ? (setCalendarViewMonth(11), setCalendarViewYear(y => y - 1)) : setCalendarViewMonth(m => m - 1) }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          style={{ background: 'transparent', backgroundColor: 'white', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#666', lineHeight: 1, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background-color 0.2s ease', paddingBottom: '2px' }}
                        >‹</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); calendarViewMonth === 11 ? (setCalendarViewMonth(0), setCalendarViewYear(y => y + 1)) : setCalendarViewMonth(m => m + 1) }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          style={{ background: 'transparent', backgroundColor: 'white', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#666', lineHeight: 1, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background-color 0.2s ease', paddingBottom: '2px' }}
                        >›</button>
                      </div>
                    </div>

                    {/* Weekday headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)', marginBottom: '6px' }}>
                      {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                        <div key={d} style={{ fontSize: '12px', color: '#bbb', textAlign: 'center', padding: '4px 0', fontWeight: 600 }}>{d}</div>
                      ))}
                    </div>

                    {/* Day grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)', gap: '2px', minHeight: '238px' }}>
                      {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                        const dateStr = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                        const isSelected = customSnoozeDate === dateStr
                        const isToday = dateStr === todayStr
                        const isPast = dateStr < todayStr
                        return (
                          <button
                            key={day}
                            disabled={isPast}
                            onClick={(e) => { e.stopPropagation(); setCustomSnoozeDate(dateStr) }}
                            style={{ width: '38px', height: '38px', backgroundColor: 'white', border: 'none', borderRadius: '50%', cursor: isPast ? 'default' : 'pointer', background: isSelected ? '#0288d1' : '#f5f5f5', color: isSelected ? '#fff' : isPast ? '#ddd' : isToday ? '#0288d1' : '#333', fontWeight: isSelected || isToday ? 700 : 400, fontSize: '14px' }}
                          >{day}</button>
                        )
                      })}
                    </div>
                  </div>

                  {/* ── Right: Time + Actions ── */}
                  <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '28px', width: '230px' }}>

                    {/* Date label + value */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '14px', color: '#888', fontWeight: 500 }}>Date</div>
                      <div style={{ fontSize: '15px', color: customSnoozeDate ? '#333' : '#ccc', fontWeight: customSnoozeDate ? 500 : 400, minHeight: '22px' }}>
                        {customSnoozeDate
                          ? (() => { const [y,m,d] = customSnoozeDate.split('-'); return `${d}/${m}/${y}` })()
                          : 'DD/MM/YYYY'}
                      </div>
                    </div>

                    {/* Time label + inputs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '14px', color: '#888', fontWeight: 500 }}>Time</div>
                      {/* Hour : Minute  AM/PM — all in one row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input
                          type="number"
                          min={1} max={12}
                          value={snoozeHour}
                          className="snooze-time-input"
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            if (!isNaN(v)) setSnoozeHour(Math.min(12, Math.max(1, v)))
                          }}
                          onBlur={(e) => {
                            const v = Number(e.target.value)
                            setSnoozeHour(isNaN(v) || v < 1 ? 1 : v > 12 ? 12 : v)
                          }}
                          style={{ width: '50px', padding: '7px 4px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '15px', outline: 'none', textAlign: 'center', MozAppearance: 'textfield', fontWeight: 500, fontFamily: 'inherit' } as React.CSSProperties}
                        />
                        <span style={{ fontWeight: 700, color: '#555', fontSize: '16px' }}>:</span>
                        <input
                          type="number"
                          min={0} max={59}
                          value={String(snoozeMinute).padStart(2, '0')}
                          className="snooze-time-input"
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            if (!isNaN(v)) setSnoozeMinute(Math.min(59, Math.max(0, v)))
                          }}
                          onBlur={(e) => {
                            const v = Number(e.target.value)
                            setSnoozeMinute(isNaN(v) || v < 0 ? 0 : v > 59 ? 59 : v)
                          }}
                          style={{ width: '50px', padding: '7px 4px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '15px', outline: 'none', textAlign: 'center', MozAppearance: 'textfield', fontWeight: 500, fontFamily: 'inherit' } as React.CSSProperties}
                        />
                        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid #c0c0c0', marginLeft: '4px' }}>
                          {(['AM', 'PM'] as const).map(p => (
                            <button
                              key={p}
                              onClick={(e) => { e.stopPropagation(); setSnoozePeriod(p) }}
                              style={{ padding: '6px 4px', backgroundColor: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, background: snoozePeriod === p ? '#0288d1' : '#fafafa', color: snoozePeriod === p ? '#fff' : '#999', transition: 'background 0.15s' }}
                            >{p}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )
            })()}

            {/* Footer: Cancel / Save — bottom right */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid #e0e0e0' }}>
              <button
                className="snooze-cancel-btn"
                onClick={(e) => { e.stopPropagation(); setCustomSnoozePopupEmailId(null); setCustomSnoozeDate('') }}
                style={{ width: '90px', padding: '8px 0', borderRadius: '20px', border: '1.5px solid #c0c0c0', background: '#fff', color: '#555', fontSize: '15px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}
              >Cancel</button>
              <button
                disabled={!customSnoozeDate}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!customSnoozeDate) return
                  const hour24 = snoozePeriod === 'AM' ? snoozeHour % 12 : (snoozeHour % 12) + 12
                  const dateTimeStr = `${customSnoozeDate}T${String(hour24).padStart(2,'0')}:${String(snoozeMinute).padStart(2,'0')}`
                  if (customSnoozePopupBulk) {
                    const date = new Date(dateTimeStr)
                    const diff = date.getTime() - new Date().getTime()
                    const hours = diff / (1000 * 60 * 60)
                    if (hours > 0) handleBulkSnoozeConfirm(hours)
                    else alert('Please select a future time')
                    setCustomSnoozePopupBulk(false)
                  } else if (customSnoozePopupEmailId !== null) {
                    handleCustomSnooze(customSnoozePopupEmailId, dateTimeStr)
                    setCustomSnoozePopupEmailId(null)
                  }
                  setCustomSnoozeDate('')
                }}
                className="snooze-popup-save-btn"
                style={{ width: '90px', padding: '8px 0', borderRadius: '20px', backgroundColor: 'white', border: 'none', background: customSnoozeDate ? '#0288d1' : '#b3d9f0', color: '#fff', fontSize: '15px', cursor: customSnoozeDate ? 'pointer' : 'not-allowed', fontWeight: 600, transition: 'all 0.15s' }}
              >Save</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showCreateLabelModal && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setShowCreateLabelModal(false); setPendingMoveEmailId(null) }}
        >
          <div
            style={{ background: '#f0f0f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', width: '560px', height: '560px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => { e.stopPropagation(); setClShowSubLabelDropdown(false); }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>Create New Label</span>
            </div>

            {/* Form */}
            <div style={{ padding: '16px 20px 10px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
              {clError && <div style={{ color: '#e53935', fontSize: '13px', background: '#fff0f0', padding: '8px 12px', borderRadius: '8px' }}>{clError}</div>}

              {/* Label Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Label Name</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="Enter label name"
                  value={clLabelName}
                  onChange={(e) => setClLabelName(e.target.value)}
                  style={{ padding: '9px 12px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>

              {/* Sub-label Dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Sub-label under (optional)</label>
                <div
                  ref={clSubLabelTriggerRef}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!clShowSubLabelDropdown) {
                      const collectParents = (nodes: any[]): number[] =>
                        nodes.flatMap((n: any) => n.children?.length ? [n.id, ...collectParents(n.children)] : [])
                      setExpandedCreateSubLabels(new Set(collectParents(labels)))
                    }
                    setClShowSubLabelDropdown(!clShowSubLabelDropdown)
                  }}
                  style={{ display: 'flex', alignItems: 'center', padding: '9px 12px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '14px', background: '#fff', cursor: 'pointer', justifyContent: 'space-between' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#333' }}>
                    {clParentId ? (() => {
                      const sel = flatLabelsTree(labels).find((l: any) => l.id === clParentId)
                      return sel ? (
                        <>
                          {sel.hasChildren
                            ? <Folder size={16} style={{ color: sel.color, stroke: sel.color, fill: 'none', flexShrink: 0 }} />
                            : <Tag size={16} style={{ color: sel.color, stroke: sel.color, fill: 'none', flexShrink: 0 }} />}
                          {sel.name}
                        </>
                      ) : 'None (top-level)'
                    })() : 'None (top-level)'}
                  </span>
                  <ChevronDown size={16} style={{ color: '#888' }} />
                </div>
                {clShowSubLabelDropdown && createPortal(
                  (() => {
                    const rect = clSubLabelTriggerRef.current?.getBoundingClientRect()
                    const dropdownH = 420
                    const dropdownW = 460
                    const spaceBelow = rect ? window.innerHeight - rect.bottom - 8 : 0
                    const spaceAbove = rect ? rect.top - 8 : 0
                    const openUpward = rect ? spaceBelow < dropdownH && spaceAbove > spaceBelow : false
                    const top = rect ? (openUpward ? Math.max(8, rect.top - Math.min(dropdownH, spaceAbove) - 4) : rect.bottom + 4) : window.innerHeight / 2 - dropdownH / 2
                    const left = rect ? Math.min(rect.left, window.innerWidth - dropdownW - 8) : window.innerWidth / 2 - dropdownW / 2
                    const maxH = rect ? (openUpward ? Math.min(dropdownH, spaceAbove) : Math.min(dropdownH, spaceBelow)) : dropdownH
                    const allItems = flatLabelsTree(labels)
                    return (
                      <div style={{ position: 'fixed', inset: 0, zIndex: 20000 }} onClick={() => setClShowSubLabelDropdown(false)}>
                        <div style={{ position: 'absolute', top, left, width: dropdownW, background: '#fff', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)', border: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', maxHeight: maxH, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ padding: '10px 14px', borderBottom: '1px solid #e8e8e8', background: '#f8f8f8', borderRadius: '10px 10px 0 0' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#555' }}>Select parent label</span>
                          </div>
                          <div style={{ overflowY: 'auto', flex: 1 }}>
                            <div
                              onClick={() => { setClParentId(null); setClShowSubLabelDropdown(false) }}
                              style={{ padding: '11px 14px', cursor: 'pointer', fontSize: '14px', borderBottom: '1px solid #f0f0f0', color: '#555', fontStyle: 'italic', background: clParentId === null ? '#e8f0fe' : undefined, display: 'flex', alignItems: 'center', gap: '8px' }}
                              onMouseEnter={(e) => { if (clParentId !== null) e.currentTarget.style.background = '#f5f5f5' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = clParentId === null ? '#e8f0fe' : 'transparent' }}
                            >
                              <FolderOpen size={15} style={{ color: '#999', flexShrink: 0 }} />
                              None (top-level)
                            </div>
                            {allItems.filter((l: any) => isCreateSubVisible(l, allItems)).map((l: any) => {
                              const isExpanded = expandedCreateSubLabels.has(l.id)
                              const iconColor = l.color
                              return (
                                <div key={l.id} style={{ display: 'flex', alignItems: 'center', paddingLeft: `${6 + l.depth * 16}px`, paddingRight: '10px', borderBottom: '1px solid #f5f5f5', background: clParentId === l.id ? '#e8f0fe' : undefined }}>
                                  {l.hasChildren ? (
                                    <button onClick={(e) => { e.stopPropagation(); setExpandedCreateSubLabels(prev => { const next = new Set(prev); next.has(l.id) ? next.delete(l.id) : next.add(l.id); return next }) }}
                                      style={{ background: 'none', backgroundColor: 'white', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: isExpanded ? iconColor : '#888', flexShrink: 0 }}>
                                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                    </button>
                                  ) : <span style={{ width: '17px', flexShrink: 0 }} />}
                                  <div
                                    onClick={() => { setClParentId(l.id); setClShowSubLabelDropdown(false) }}
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '9px', paddingBottom: '9px', cursor: 'pointer', fontSize: '14px', color: '#333' }}
                                    onMouseEnter={(e) => { if (clParentId !== l.id) e.currentTarget.style.background = '#f5f5f5' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = clParentId === l.id ? '#e8f0fe' : 'transparent' }}
                                  >
                                    {l.hasChildren
                                      ? isExpanded
                                        ? <FolderOpen size={15} style={{ color: iconColor, stroke: iconColor, fill: 'none', flexShrink: 0 }} />
                                        : <Folder size={15} style={{ color: iconColor, stroke: iconColor, fill: 'none', flexShrink: 0 }} />
                                      : <Tag size={15} style={{ color: iconColor, stroke: iconColor, fill: 'none', flexShrink: 0 }} />}
                                    <span style={{ fontWeight: l.depth === 0 ? 600 : 400 }}>{l.name}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })(),
                  document.body
                )}
              </div>

              {/* Color */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Color</label>
                {/* Left: swatches | Right: RGB picker */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
                  {/* Left — swatches + hex+swatch at bottom */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 30px)', gap: '8px' }}>
                      {['#f44336','#e91e63','#9c27b0','#3f51b5','#2196f3','#00bcd4','#009688','#4caf50','#ffeb3b','#ff9800','#795548','#607d8b'].map(c => (
                        <button key={c} onClick={(e) => { e.stopPropagation(); setClLabelColor(c) }}
                          style={{ width: '30px', height: '30px', borderRadius: '50%', background: c, border: clLabelColor === c ? '3px solid #333' : '2px solid rgba(0,0,0,0.08)', cursor: 'pointer', outline: 'none' }} />
                      ))}
                    </div>
                    {/* Selected color label + hex+swatch */}
                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Selected color</span>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #c0c0c0', borderRadius: '6px', overflow: 'hidden', width: 'fit-content' }}>
                      <div style={{ width: '50px', height: '56px', background: clLabelColor || '#607d8b', flexShrink: 0 }} />
                      <input
                        type="text" value={clLabelColor} maxLength={7}
                        onChange={(e) => { if (/^#[0-9a-f]{0,6}$/i.test(e.target.value)) setClLabelColor(e.target.value) }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="#607d8b"
                        style={{ padding: '18px 10px', backgroundColor: 'white', border: 'none', fontSize: '14px', fontFamily: 'monospace', outline: 'none', width: '110px' }}
                      />
                    </div>
                    </div>
                  </div>
                  {/* Right — Inline color picker */}
                  <ColorPicker value={clLabelColor || '#607d8b'} onChange={setClLabelColor} showHex={false} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid #e0e0e0' }}>
              <button
                className="snooze-cancel-btn"
                onClick={() => { setShowCreateLabelModal(false); setPendingMoveEmailId(null) }}
                style={{ padding: '8px 22px', borderRadius: '20px', border: '1.5px solid #c0c0c0', background: '#fff', color: '#555', fontSize: '15px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
              >Cancel</button>
              <button
                disabled={clLoading || !clLabelName.trim()}
                onClick={async () => {
                  if (!clLabelName.trim()) { setClError('Label name is required'); return }
                  setClLoading(true); setClError('')
                  try {
                    const payload: any = { name: clLabelName, color: clLabelColor || '#607d8b' }
                    if (clParentId) payload.parent_label_id = clParentId
                    const res = await fetch('http://localhost:5050/api/custom-labels', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify(payload),
                    })
                    if (res.ok) {
                      setShowCreateLabelModal(false)
                      // Fetch fresh labels so the new label is available for display and path computation
                      let freshLabels = labels
                      try {
                        const labelsRes = await fetch('http://localhost:5050/api/custom-labels', {
                          headers: { Authorization: `Bearer ${token}` },
                        })
                        if (labelsRes.ok) {
                          const labelsData = await labelsRes.json()
                          freshLabels = labelsData.labels || []
                          setLabels(freshLabels)
                          window.dispatchEvent(new Event('customLabelsChanged'))
                        }
                      } catch {}
                      onRefreshCounts?.()
                      if (pendingMoveEmailId !== null) {
                        const parentItem = clParentId ? flattenLabelsTree(freshLabels).find((l: any) => l.id === clParentId) : null
                        const newFullPath = parentItem ? `${parentItem.fullPath} / ${clLabelName}` : clLabelName
                        await handleApplyLabel(pendingMoveEmailId, newFullPath)
                        setPendingMoveEmailId(null)
                      }
                    }
                    else { const d = await res.json(); setClError(d.error || 'Failed to create label') }
                  } catch { setClError('Failed to create label') }
                  setClLoading(false)
                }}
                className="snooze-popup-save-btn"
                style={{ padding: '8px 22px', borderRadius: '20px', backgroundColor: 'white', border: 'none', background: clLabelName.trim() ? '#0288d1' : '#b3d9f0', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: clLabelName.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
              >{clLoading ? 'Creating...' : 'Create Label'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
