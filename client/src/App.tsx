import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import ColorPicker from './components/ColorPicker'
import AiFloatingButton from './components/AiFloatingButton'
import ErrorBoundary from './components/ErrorBoundary'
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom'
import './App.css'
import LoginPage from './pages/LoginPage'
import InboxPage from './pages/InboxPage'
import SentPage from './pages/SentPage'
import StarredPage from './pages/StarredPage'
import SnoozedPage from './pages/SnoozedPage'
import DraftsPage from './pages/DraftsPage'
import ArchivedPage from './pages/ArchivedPage'
import GroupsPage from './pages/GroupsPage'
import AllMailsPage from './pages/AllMailsPage'
import ScheduledPage from './pages/ScheduledPage'
import ImportantPage from './pages/ImportantPage'
import SpamPage from './pages/SpamPage'
import DeletePage from './pages/DeletePage'
import SubscriptionsPage from './pages/SubscriptionsPage'
import LabelsPage from './pages/LabelsPage'
import ComposePage from './pages/ComposePage'
import EmailPage from './pages/EmailPage'
import EmailViewer from './pages/EmailViewer'
import ChatMailPage from './pages/ChatMailPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ConferencePage from './pages/ConferencePage'
import ChatPage from './chat/ChatPage'
import OfficePage from './Office/OfficePage'
import AdminPage from './pages/AdminPage'
import FeedbackModal from './components/FeedbackModal'
import {
  Inbox,
  Send,
  Star,
  Clock,
  FileText,
  Archive,
  ShoppingBag,
  Mail,
  Calendar,
  Flag,
  AlertCircle,
  Trash2,
  Tag,
  FolderOpen,
  Folder,
  Bell,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit3,
  MessageSquare,
  Users,
  FileCode,
  MoreHorizontal,
  Layers,
  Video,
  StickyNote,
  Sheet,
  FileJson,
  Search,
  RefreshCw,
  X,
  Sliders,
  FolderPlus,
  Heart,
  HeartOff,
  MailOpen,
  Check,
  Paintbrush,
  FolderInput,
  ExternalLink,
  Eraser,
  StarOff,
  FlagOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  AlarmClock,
  AlarmClockOff,
  BarChart2,
  User,
  BellOff,
  Ban,
  AlertOctagon,
  Pin,
  Printer,
  ShieldCheck,
  BookOpen,
  SlidersHorizontal,
  CornerRightDown,
  ListFilter,
  ZoomIn,
  List,
  ArrowLeftRight
} from 'lucide-react'

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
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  folder?: string
  isRead?: boolean
  isDraft?: boolean
}

interface LabelNode {
  id: number
  name: string
  color: string
  children?: LabelNode[]
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

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem('userEmail'))
  const [showFeedback, setShowFeedback] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [chatViewContact, setChatViewContact] = useState<string | null>(() => sessionStorage.getItem('chatViewContact'))
  // Chronological order (oldest/first-floated first) of every active floating session —
  // main/generic compose uses the MAIN_FLOAT_SLOT sentinel since contactEmail can't be
  // null in this array. Drives left-to-right slot positions: new strips are appended to
  // the right of existing ones instead of displacing them. Persisted so a page refresh
  // restores the same minimized strips instead of silently dropping them — they only go
  // away when the user closes them.
  const MAIN_FLOAT_SLOT = '__main__'
  const [floatOrder, setFloatOrder] = useState<string[]>(() => {
    try { const s = sessionStorage.getItem('chatFloatOrder'); return s ? JSON.parse(s) : [] } catch { return [] }
  })
  useEffect(() => { sessionStorage.setItem('chatFloatOrder', JSON.stringify(floatOrder)) }, [floatOrder])
  // Contacts whose thread reply box currently has an active floating/minimized panel —
  // kept mounted (hidden) even after navigating away from them, so each contact's
  // floated draft survives independently instead of being unmounted/overwritten when
  // switching to a different contact's thread. Seeded from the restored floatOrder so
  // those contact instances remount immediately after a refresh.
  const [floatingContacts, setFloatingContacts] = useState<Set<string>>(
    () => new Set(floatOrder.filter(id => id !== MAIN_FLOAT_SLOT))
  )
  const registerFloatSlot = (id: string, floating: boolean) => {
    setFloatOrder(prev => {
      if (floating) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter(x => x !== id)
    })
  }
  // Whether any floating session anywhere is currently minimized — email/conversation
  // list containers use this to reserve room at the bottom for the strip row instead of
  // letting it overlay list content.
  const [minimizedSlots, setMinimizedSlots] = useState<Set<string>>(new Set())
  const hasMinimizedStrip = minimizedSlots.size > 0
  const registerMinimizedSlot = (id: string, minimized: boolean) => {
    setMinimizedSlots(prev => {
      const next = new Set(prev)
      if (minimized) next.add(id); else next.delete(id)
      return next
    })
  }
  const floatSlots = floatOrder
  // Maps draftId -> owning contact email (or null for the main/generic compose) for
  // every currently-floating session. A draft started from inside a contact's thread
  // (e.g. a per-message "Forward" card) floats within THAT contact's own instance even
  // though it can show up in the main list as a standalone "draft_..." item (no
  // recipient yet) — this lets the main list's click handler delegate back to the
  // actual owning instance instead of treating the draft as its own.
  const floatingDraftOwnersRef = useRef<Map<number, string | null>>(new Map())
  const registerFloatingDraft = (owner: string | null, floating: boolean, draftId: number | null) => {
    if (draftId == null) return
    if (floating) floatingDraftOwnersRef.current.set(draftId, owner)
    else if (floatingDraftOwnersRef.current.get(draftId) === owner) floatingDraftOwnersRef.current.delete(draftId)
  }
  const getFloatingDraftOwner = (draftId: number) => floatingDraftOwnersRef.current.get(draftId)
  const MAX_VISIBLE_MINIMIZED_STRIPS = 3
  const overflowCount = Math.max(0, floatSlots.length - MAX_VISIBLE_MINIMIZED_STRIPS)
  const [overflowBadgePos, setOverflowBadgePos] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (overflowCount === 0) return
    const middleBar = document.querySelector('.middle-bar') as HTMLElement | null
    const rect = middleBar?.getBoundingClientRect()
    if (!rect) return
    const stripWidth = 300, gap = 12, circleSize = 44
    const stripY = Math.max(0, window.innerHeight - 50 - 16)
    const x = rect.left + gap + (stripWidth + gap) * MAX_VISIBLE_MINIMIZED_STRIPS
    setOverflowBadgePos({ x: Math.max(0, x), y: stripY + (50 - circleSize) / 2 })
  }, [overflowCount])
  const [chatMailCompose, setChatMailCompose] = useState(() => sessionStorage.getItem('chatMailCompose') === 'true')
  const chatMailReturnPath = useRef<string>(sessionStorage.getItem('chatMailReturnPath') || '/chatmail')
  const [draftEmail, setDraftEmail] = useState<Email | null>(() => {
    try { const s = sessionStorage.getItem('draftEmail'); return s ? JSON.parse(s) : null } catch { return null }
  })
  const [chatReplyMessage, setChatReplyMessage] = useState<string | null>(null)
  const [chatReplyData, setChatReplyData] = useState<{ action: 'reply' | 'replyAll' | 'forward'; subject: string; from: string; to: string; body: string; date: string; sourceMessageId?: number } | null>(null)
  const [chatComposeRecipients, setChatComposeRecipients] = useState<{ to: string[]; subject: string; groupLabel?: string; groupId?: number } | null>(null)
  const [highlightedEmailId, setHighlightedEmailId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('highlightedEmailId')
    return saved ? parseInt(saved, 10) : null
  })
  const [openedEmailId, setOpenedEmailId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('openedEmailId')
    return saved ? parseInt(saved, 10) : null
  })
  const [resetEmail, setResetEmail] = useState<string>('')
  const [resetToken, setResetToken] = useState<string>('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarHoverExpanded, setSidebarHoverExpanded] = useState(false)
  const [moreExpanded, setMoreExpanded] = useState(() => {
    const path = window.location.pathname;
    if (['/allmails', '/reports', '/spam', '/delete', '/subscriptions', '/labels'].includes(path)) return true
    // A More-section folder (All Mails/Reports/Spam/Trash) can also be the one currently
    // proxied through Chat Mail — on a hard refresh the path is '/chatmail', not its own
    // route, so check the persisted folder key too instead of collapsing the section.
    if (path === '/chatmail' && sessionStorage.getItem('chat_folderViewMode') === 'chatmail') {
      const persistedTab = sessionStorage.getItem('chat_persistedListTab') || ''
      if (['allmails', 'report', 'spam', 'delete'].includes(persistedTab)) return true
    }
    return false
  })
  const [activeApp, setActiveApp] = useState<'mail' | 'calendar' | 'contacts' | 'groups' | 'notes' | 'sheets' | 'docs' | 'more' | 'files'>(() => {
    const path = window.location.pathname;
    if (['/conference', '/chat', '/office'].includes(path)) return '' as any;
    return 'mail';
  })
  const [activeSidebarSection, setActiveSidebarSection] = useState<string>(() => {
    const path = window.location.pathname;
    if (path === '/sent') return 'sent';
    if (path === '/starred') return 'starred';
    if (path === '/snoozed') return 'snoozed';
    if (path === '/drafts') return 'drafts';
    if (path === '/archived') return 'archive';
    if (path === '/groups') return 'groups';
    if (path === '/allmails') return 'all-mails';
    if (path === '/scheduled') return 'scheduled';
    if (path === '/reports') return 'reports';
    if (path === '/spam') return 'spam';
    if (path === '/delete') return 'delete';
    if (path === '/subscriptions') return 'manage-subscription';
    if (path === '/labels') return 'manage-labels';
    if (path === '/chatmail') {
      // A folder was being proxied through Chat Mail when the page was refreshed —
      // restore that folder's own sidebar highlight instead of defaulting to blank/Drafts.
      // Label keys can't resolve here yet (customLabels hasn't loaded) — a later effect
      // corrects those once labels are fetched, mirroring the existing /labels/ route fix-up.
      if (sessionStorage.getItem('chat_folderViewMode') === 'chatmail') {
        const persistedTab = sessionStorage.getItem('chat_persistedListTab') || ''
        const builtInSectionMap: Record<string, string> = {
          inbox: 'inbox', sent: 'sent', starred: 'starred', snoozed: 'snoozed', draft: 'drafts',
          archive: 'archive', group: 'groups', allmails: 'all-mails', scheduled: 'scheduled',
          report: 'reports', spam: 'spam', delete: 'delete',
        }
        if (builtInSectionMap[persistedTab]) return builtInSectionMap[persistedTab]
        if (persistedTab.startsWith('label:')) return '' // resolved by the customLabels effect below
      }
      if (sessionStorage.getItem('chat_draftId')) return 'drafts';
      return '';
    }
    return 'inbox';
  })
  const [customLabels, setCustomLabels] = useState<LabelNode[]>([])
  const [upcomingScheduledEmail, setUpcomingScheduledEmail] = useState<{ date: string, scheduledFor: string } | null>(null)
  const [upcomingScheduledCount, setUpcomingScheduledCount] = useState(0)
  const [labelPageKey, setLabelPageKey] = useState(0)
  const [expandedLabelGroups, setExpandedLabelGroups] = useState<Set<number>>(() => {
    // Load expanded labels from localStorage on mount
    try {
      const saved = localStorage.getItem('expandedLabelGroups')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [openLabelMenu, setOpenLabelMenu] = useState<number | null>(null)
  const [labelMenuPos, setLabelMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [openFolderMenu, setOpenFolderMenu] = useState<string | null>(null)
  const [folderMenuPos, setFolderMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [appToast, setAppToast] = useState<{ message: string; onUndo?: () => void } | null>(null)
  const appToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [moreFolderOrder, setMoreFolderOrder] = useState(['all-mails', 'reports', 'spam', 'delete', 'subscription', 'manage-labels'])
  const [favouriteLabels, setFavouriteLabels] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('favouriteLabels')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch { return new Set() }
  })
  const [importantLabels, setImportantLabels] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('importantLabels')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch { return new Set() }
  })
  const [starredFolders, setStarredFolders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('starredFolders')
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>()
    } catch { return new Set<string>() }
  })
  const [snoozedFolders, setSnoozedFolders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('snoozedFolders')
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>()
    } catch { return new Set<string>() }
  })
  const [snoozedLabels, setSnoozedLabels] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('snoozedLabels')
      return saved ? new Set<number>(JSON.parse(saved)) : new Set<number>()
    } catch { return new Set<number>() }
  })
  const [colorPickerLabelId, setColorPickerLabelId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [menuButtonClicked, setMenuButtonClicked] = useState(false)
  const [customSnoozePopupFolder, setCustomSnoozePopupFolder] = useState<string | null>(null)
  const [folderSnoozeMenu, setFolderSnoozeMenu] = useState<{ folder: string, top: number, left: number } | null>(null)
  const folderSnoozeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [customSnoozeDate, setCustomSnoozeDate] = useState('')
  const [snoozeHour, setSnoozeHour] = useState(12)
  const [snoozeMinute, setSnoozeMinute] = useState(0)
  const [snoozePeriod, setSnoozePeriod] = useState<'AM' | 'PM'>('PM')
  const [calendarViewMonth, setCalendarViewMonth] = useState(new Date().getMonth())
  const [calendarViewYear, setCalendarViewYear] = useState(new Date().getFullYear())
  const [showSearchOptions, setShowSearchOptions] = useState(false)
  const [showDeleteLabelModal, setShowDeleteLabelModal] = useState(false)
  const [deleteLabelTarget, setDeleteLabelTarget] = useState<{ label: LabelNode; parentId: number | null } | null>(null)
  const [deleteLabelExpanded, setDeleteLabelExpanded] = useState<Set<number>>(new Set())
  const [showCreateLabelModal, setShowCreateLabelModal] = useState(false)
  const [clLabelName, setClLabelName] = useState('')
  const [clLabelColor, setClLabelColor] = useState('')
  const [clParentId, setClParentId] = useState<number | null>(null)
  const [clLoading, setClLoading] = useState(false)
  const [clError, setClError] = useState('')
  const [clIsRenameMode, setClIsRenameMode] = useState(false)
  const [clRenameLabelId, setClRenameLabelId] = useState<number | null>(null)
  const [expandedSubLabels, setExpandedSubLabels] = useState<Set<number>>(new Set())
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [clShowSubLabelDropdown, setClShowSubLabelDropdown] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({
    inbox: 0,
    starred: 0,
    snoozed: 0,
    archived: 0,
    groups: 0,
    all: 0,
    scheduled: 0,
    reports: 0,
    spam: 0,
    delete: 0,
    subscriptions: 0
  })
  const [markableUnreadCounts, setMarkableUnreadCounts] = useState<Record<string, number>>({})
  const [markableTotalCounts, setMarkableTotalCounts] = useState<Record<string, number>>({})
  const [receivedTotalCounts, setReceivedTotalCounts] = useState<Record<string, number>>({})
  const [totalCounts, setTotalCounts] = useState<Record<string, number>>({
    inbox: 0,
    starred: 0,
    snoozed: 0,
    archived: 0,
    groups: 0,
    all: 0,
    scheduled: 0,
    important: 0,
    spam: 0,
    delete: 0,
    subscriptions: 0,
    sent: 0,
    drafts: 0
  })
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    from: '',
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    keywords: '',
    hasAttachment: false,
    dateFrom: '',
    dateTo: '',
    readStatus: 'all',
    category: ''  
  })
  const searchInputRef = useRef<HTMLInputElement>(null)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)
  const subLabelTriggerRef = useRef<HTMLDivElement>(null)
  const addLabelBtnRef = useRef<HTMLButtonElement>(null)
  const [addLabelDropdownPos, setAddLabelDropdownPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null)
  const [savedFiles, setSavedFiles] = useState<Array<{ name: string; size: number; dataUrl?: string; date?: string; emailId?: number; emailSubject?: string; emailFrom?: string; emailTo?: string; emailFolder?: string; emailIsScheduled?: boolean; emailLabelName?: string; emailLabelColor?: string }>>([])
  const [filePreview, setFilePreview] = useState<{name: string, dataUrl?: string} | null>(null)
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [fileCategory, setFileCategory] = useState<'all' | 'documents' | 'media'>('all')
  const [chatMailMoveOpen, setChatMailMoveOpen] = useState(false)
  const [chatMailMovePos, setChatMailMovePos] = useState<{ top: number; right: number } | null>(null)
  const [chatMailZoomOpen, setChatMailZoomOpen] = useState(false)
  const [chatMailZoomPos, setChatMailZoomPos] = useState<{ top: number; right: number } | null>(null)
  // Mirrors ChatMailPage's ActionButton (non-toolbar variant) color states exactly:
  // regular = grey, hover = accent text, active = accent fill + white text, active:hover = same fill, deeper shadow.
  const mainActionBtnProps = (accent: string, active: boolean, isDisabled: boolean) => ({
    style: {
      backgroundColor: active ? accent : 'none',
      border: isDisabled ? '1px solid #ccc' : active ? '1px solid #999' : '1px solid #ddd',
      color: isDisabled ? '#ccc' : active ? '#fff' : '#666',
      boxShadow: active ? '0 2px 4px rgba(0, 0, 0, 0.4)' : 'none',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.5 : 1,
    } as React.CSSProperties,
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isDisabled) return
      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.6)'
      e.currentTarget.style.borderColor = '#999'
      if (active) {
        e.currentTarget.style.backgroundColor = accent
        e.currentTarget.style.color = '#fff'
      } else {
        e.currentTarget.style.backgroundColor = 'white'
        e.currentTarget.style.color = accent
      }
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isDisabled) return
      e.currentTarget.style.boxShadow = active ? '0 2px 4px rgba(0, 0, 0, 0.4)' : 'none'
      e.currentTarget.style.borderColor = active ? '#999' : '#ddd'
      e.currentTarget.style.backgroundColor = active ? accent : 'none'
      e.currentTarget.style.color = active ? '#fff' : '#666'
    },
  })
  // Global toggle: when 'chatmail', clicking any sidebar folder/label routes into
  // Chat Mail (filtered to that folder's tab) instead of its normal AllMailsPage view.
  // Persisted to sessionStorage so a hard page refresh on /chatmail restores which folder
  // was being proxied instead of silently falling back to plain Chat Mail.
  const [folderViewMode, setFolderViewModeState] = useState<'list' | 'chatmail'>(
    () => (sessionStorage.getItem('chat_folderViewMode') as 'list' | 'chatmail') || 'list'
  )
  const setFolderViewMode = (mode: 'list' | 'chatmail') => {
    setFolderViewModeState(mode)
    sessionStorage.setItem('chat_folderViewMode', mode)
  }
  // Mirrors the section keys handleSidebarSection normally gets for each folder's own
  // route — used so the sidebar highlights the folder being proxied through Chat Mail
  // instead of (incorrectly) highlighting the Chat Mail button itself.
  const getSidebarSectionForFolderKey = (key: string): string => {
    const sectionMap: Record<string, string> = {
      inbox: 'inbox', sent: 'sent', starred: 'starred', snoozed: 'snoozed', draft: 'drafts',
      archive: 'archive', group: 'groups', allmails: 'all-mails', scheduled: 'scheduled',
      report: 'reports', spam: 'spam', delete: 'delete',
    }
    if (sectionMap[key]) return sectionMap[key]
    if (key.startsWith('label:')) {
      const displayName = key.slice('label:'.length)
      const findLabelId = (labels: LabelNode[]): number | null => {
        for (const l of labels) {
          if (displayName === l.name || displayName.endsWith(` / ${l.name}`)) return l.id
          if (l.children) { const id = findLabelId(l.children); if (id) return id }
        }
        return null
      }
      const id = findLabelId(customLabels)
      return id ? `label-${id}` : ''
    }
    return ''
  }
  const goToChatMailTab = (tab: string) => {
    // ChatMailPage stays mounted across Inbox/Sent/etc. navigation (see comment near its
    // render below) — a useState lazy-initializer would never re-run, so this must be a
    // live event the already-mounted instance reacts to. The same sessionStorage key also
    // backs ChatMailPage's initial state for the rare case where it hasn't mounted yet, and
    // for restoring the proxied folder after a hard page refresh.
    setActiveSidebarSection(getSidebarSectionForFolderKey(tab))
    if (['allmails', 'report', 'spam', 'delete'].includes(tab)) setMoreExpanded(true)
    sessionStorage.setItem('chat_persistedListTab', tab)
    window.dispatchEvent(new CustomEvent('chatmail:setListTab', { detail: tab }))
    navigate('/chatmail')
  }
  const [chatMailActionState, setChatMailActionState] = useState<{
    active: boolean; convMuted: boolean; convBlocked: boolean; zoomLevel: number;
    convPinned: boolean; immersiveMode: boolean; selectionMode: boolean; hasSelection: boolean;
    convAllRead: boolean; convAllUnread: boolean; convAllStarred: boolean; convAllUnstarred: boolean; convAnyArchived: boolean; convAllArchived: boolean; convAllUnarchived: boolean; viewMode: 'chat' | 'list';
    convAllSnoozed: boolean; convAllUnsnoozed: boolean; convAllGrouped: boolean; convAllUngrouped: boolean; convAnySpam: boolean; convAllSpam: boolean; convAllUnspam: boolean; convAnyReported: boolean; convAllReported: boolean; convAllUnreported: boolean; convAnyPinned: boolean; convAllPinned: boolean; convAllUnpinned: boolean; convAnyMuted: boolean; convAllUnmuted: boolean; convAnyDeleted: boolean; convAllDeleted: boolean; convAllUndeleted: boolean; chatListTab: string;
  }>({ active: false, convMuted: false, convBlocked: false, zoomLevel: 100, convPinned: false, immersiveMode: false, selectionMode: false, hasSelection: false, convAllRead: true, convAllUnread: false, convAllStarred: false, convAllUnstarred: false, convAnyArchived: false, convAllArchived: false, convAllUnarchived: false, viewMode: 'chat', convAllSnoozed: false, convAllUnsnoozed: false, convAllGrouped: false, convAllUngrouped: false, convAnySpam: false, convAllSpam: false, convAllUnspam: false, convAnyReported: false, convAllReported: false, convAllUnreported: false, convAnyPinned: false, convAllPinned: false, convAllUnpinned: false, convAnyMuted: false, convAllUnmuted: false, convAnyDeleted: false, convAllDeleted: false, convAllUndeleted: false, chatListTab: 'all' })
  // Mirrors chatMailActionState but for AllMailsPage (Inbox/Sent/Starred/.../Labels) — lets
  // the same shared main-action toolbar serve both pages without duplicating its UI.
  const [mailPageActionState, setMailPageActionState] = useState<{
    active: boolean; selectionMode: boolean; hasSelection: boolean;
    convAllRead: boolean; convAllUnread: boolean; convAllStarred: boolean; convAllUnstarred: boolean; convAnyArchived: boolean; convAllArchived: boolean; convAllUnarchived: boolean; convAllSnoozed: boolean; convAllUnsnoozed: boolean; convAllGrouped: boolean; convAllUngrouped: boolean;
    convAnySpam: boolean; convAllSpam: boolean; convAllUnspam: boolean; convAnyReported: boolean; convAllReported: boolean; convAllUnreported: boolean; convAnyPinned: boolean; convAllPinned: boolean; convAllUnpinned: boolean; convAnyMuted: boolean; convAllUnmuted: boolean; convAnyDeleted: boolean; convAllDeleted: boolean; convAllUndeleted: boolean; convMuted: boolean;
    zoomLevel: number; immersiveMode: boolean;
  }>({ active: false, selectionMode: false, hasSelection: false, convAllRead: true, convAllUnread: false, convAllStarred: false, convAllUnstarred: false, convAnyArchived: false, convAllArchived: false, convAllUnarchived: false, convAllSnoozed: false, convAllUnsnoozed: false, convAllGrouped: false, convAllUngrouped: false, convAnySpam: false, convAllSpam: false, convAllUnspam: false, convAnyReported: false, convAllReported: false, convAllUnreported: false, convAnyPinned: false, convAllPinned: false, convAllUnpinned: false, convAnyMuted: false, convAllUnmuted: false, convAnyDeleted: false, convAllDeleted: false, convAllUndeleted: false, convMuted: false, zoomLevel: 100, immersiveMode: false })
  const navigate = useNavigate()
  const location = useLocation()
  // Changes on every navigation (route or active contact) regardless of which contact —
  // each ChatMailPage instance watches this to auto re-minimize its own expanded floating
  // panel the instant the user navigates anywhere else.
  const navKey = `${chatViewContact || ''}|${location.pathname}`



  const handleLogin = (newToken: string, email: string) => {
    setToken(newToken)
    setUserEmail(email)
    localStorage.setItem('token', newToken)
    localStorage.setItem('userEmail', email)
    navigate('/chatmail')
  }

  const handleLogout = () => {
    setToken(null)
    setUserEmail(null)
    localStorage.removeItem('token')
    localStorage.removeItem('userEmail')
    navigate('/login')
  }

  const handleViewEmail = (email: Email) => {
    if (email.isDraft) {
      chatMailReturnPath.current = location.pathname
      sessionStorage.setItem('chatMailReturnPath', location.pathname)
      setDraftEmail(email)
      setChatMailCompose(true)
      navigate('/chatmail', { state: { fromDraft: true } })
      return
    }
    // Open Chat Window View with the contact
    const isOutgoing = email.from?.toLowerCase() === (userEmail || '').toLowerCase() || email.folder === 'sent'
    const contact = isOutgoing ? email.to : email.from
    setChatViewContact(contact)
    setHighlightedEmailId(email.id ?? null)
    setOpenedEmailId(email.id ?? null)
  }

  const handleOpenChatReply = (action: 'reply' | 'replyAll' | 'forward', email: Email) => {
    const isOutgoing = email.folder === 'sent' || email.from?.toLowerCase() === (userEmail || '').toLowerCase()
    const contact = isOutgoing ? email.to : email.from

    const data = {
      action,
      subject: email.subject || '',
      from: email.from || '',
      to: email.to || '',
      body: email.body || '',
      date: email.date || '',
      sourceMessageId: email.id,
    }

    if (action === 'forward') {
      setChatReplyData(data)
      setChatMailCompose(true)
      setChatViewContact(null)
      navigate('/chatmail')
    } else {
      setChatReplyData(data)
      setChatViewContact(contact)
      setHighlightedEmailId(email.id ?? null)
    }
  }

  // "Compose to group" — opens the Chat Mail composer (instead of the plain Compose page)
  // pre-filled with every group member as a recipient, same multi-recipient model as before.
  const handleComposeToGroupViaChat = (to: string[], subject: string, groupLabel: string, groupId: number) => {
    setChatComposeRecipients({ to, subject, groupLabel, groupId })
    setActiveApp('mail')
    setChatMailCompose(true)
    setChatViewContact(null)
    navigate('/chatmail')
  }

  const [emailReadUpdate, setEmailReadUpdate] = useState<{ emailId: number; isRead: boolean } | null>(null)
  const [emailDeleteUpdate, setEmailDeleteUpdate] = useState<{ emailId: number; isDeleted: boolean } | null>(null)

  const handleEmailReadStatusChange = (emailId: number, isRead: boolean) => {
    if (selectedEmail && selectedEmail.id === emailId) {
      setSelectedEmail({ ...selectedEmail, isRead })
    }
    fetchUnreadCounts()
    setEmailReadUpdate({ emailId, isRead })
  }

  const handleEmailDeleteChange = (emailId: number, isDeleted: boolean) => {
    setEmailDeleteUpdate({ emailId, isDeleted })
  }

  const handleForgotPassword = (email: string, token: string) => {
    setResetEmail(email)
    setResetToken(token)
    navigate('/reset')
  }

  const handlePasswordReset = () => {
    navigate('/login')
    setResetEmail('')
    setResetToken('')
  }

  const fetchCustomLabels = async (): Promise<LabelNode[]> => {
    if (!token) return []
    try {
      const response = await fetch('http://localhost:5050/api/custom-labels', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setCustomLabels(data.labels)
        return data.labels as LabelNode[]
      }
    } catch (err) {
      console.error('Failed to fetch custom labels:', err)
    }
    return []
  }

  const fetchUnreadCounts = async () => {
    if (!token) {
      console.log('No token available for fetching unread counts')
      return
    }
    try {
      const RECEIVED_FOLDERS = ['inbox', 'starred', 'snoozed', 'archived', 'reports', 'spam', 'subscriptions', 'delete']
      const unreadCountsMap: Record<string, number> = {}
      const totalCountsMap: Record<string, number> = {}
      const receivedTotalCountsMap: Record<string, number> = {}
      const markableUnreadCountsMap: Record<string, number> = {}
      const markableTotalCountsMap: Record<string, number> = {}
      const newStarredFolders = new Set<string>()
      const newSnoozedFolders = new Set<string>()
      const newFavouriteLabels = new Set<number>()

      // Fetch accurate total + unread counts in one query, plus scheduled for upcoming email detection
      const [countsRes, scheduledRes, sentRes, snoozedRes] = await Promise.all([
        fetch('http://localhost:5050/api/counts', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5050/api/scheduled', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5050/api/sent?page=1&limit=1', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5050/api/snoozed?limit=9999', { headers: { Authorization: `Bearer ${token}` } }),
      ])

      if (countsRes.status === 401 || countsRes.status === 403) {
        localStorage.removeItem('token')
        localStorage.removeItem('userEmail')
        setToken(null)
        setUserEmail(null)
        navigate('/login')
        return
      }

      if (countsRes.ok) {
        const counts = await countsRes.json()
        for (const [key, val] of Object.entries(counts) as [string, { total: number; unread: number }][]) {
          unreadCountsMap[key] = val.unread
          totalCountsMap[key] = val.total
          receivedTotalCountsMap[key] = val.total
        }
      }

      if (scheduledRes.ok) {
        const scheduledData = await scheduledRes.json()
        const emails = Array.isArray(scheduledData.emails) ? scheduledData.emails : []
        const upcomingEmails = emails
          .filter((e: any) => e.scheduledFor && new Date(e.scheduledFor).getTime() > Date.now())
          .sort((a: any, b: any) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
        setUpcomingScheduledCount(upcomingEmails.length)
        if (upcomingEmails[0]) setUpcomingScheduledEmail({ date: upcomingEmails[0].date, scheduledFor: upcomingEmails[0].scheduledFor })
        else setUpcomingScheduledEmail(null)
      }

      // Override sent count with exact match from sent API to fix discrepancy
      if (sentRes.ok) {
        const sentData = await sentRes.json()
        if (sentData.total !== undefined) {
          totalCountsMap['sent'] = sentData.total
          receivedTotalCountsMap['sent'] = sentData.total
        }
      }

      if (snoozedRes.ok) {
        const snoozedData = await snoozedRes.json()
        const emails = Array.isArray(snoozedData.emails) ? snoozedData.emails : []
        if (emails.length > 0 && emails.every((e: any) => e.isStarred)) {
          newStarredFolders.add('snoozed')
        }
      }

      // Fetch unread counts for custom labels in parallel
      if (customLabels.length > 0) {
        console.log('Fetching counts for', customLabels.length, 'labels')
        type LabelFetchResult =
          | { label: any; fullPath: string; success: true; data: any }
          | { label: any; fullPath: string; success: false }
        const fetchLabelCounts = async (labels: any[], pathNames: string[] = []): Promise<void> => {
          const labelPromises: Promise<LabelFetchResult>[] = labels.map(label => (async (): Promise<LabelFetchResult> => {
            const currentPath = [...pathNames, label.name]
            const fullPath = currentPath.join(' / ')
            try {
              const response = await fetch(`http://localhost:5050/api/labels/${encodeURIComponent(fullPath)}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (response.ok) {
                const data = await response.json()
                return { label, data, fullPath, success: true }
              }
              return { label, success: false, fullPath }
            } catch (err) {
              console.error(`Error fetching label ${fullPath}:`, err)
              return { label, success: false, fullPath }
            }
          })())

          const results = await Promise.all(labelPromises)

          // Process results and recursively fetch child labels
          results.forEach(result => {
            if (result.success && result.data) {
              const emails = Array.isArray(result.data.emails) ? result.data.emails : []
              const serverTotal = typeof result.data.total === 'number' ? result.data.total : emails.length
              const unreadCount = emails.filter((email: any) => email.isRead === false && email.folder !== 'sent' && email.folder !== 'drafts' && !email.isScheduled && !email.isDraft).length
              const markable = emails.filter((email: any) => RECEIVED_FOLDERS.includes(email.folder))
              unreadCountsMap[`label-${result.label.id}`] = unreadCount
              totalCountsMap[`label-${result.label.id}`] = serverTotal
              markableUnreadCountsMap[`label-${result.label.id}`] = markable.filter((e: any) => e.isRead === false).length
              markableTotalCountsMap[`label-${result.label.id}`] = markable.length
              if (emails.length > 0 && emails.every((email: any) => email.isStarred)) {
                newStarredFolders.add(`label-${result.label.id}`)
                newFavouriteLabels.add(result.label.id)
              }
              if (emails.length > 0 && emails.every((email: any) => email.isSnoozed)) {
                newSnoozedFolders.add(`label-${result.label.id}`)
              }
            }
          })

          // Recursively fetch child labels in parallel
          const childPromises: Promise<any>[] = []
          results.forEach(result => {
            if (result.label.children && result.label.children.length > 0) {
              const currentPath = [...pathNames, result.label.name]
              childPromises.push(fetchLabelCounts(result.label.children, currentPath))
            }
          })
          if (childPromises.length > 0) {
            await Promise.all(childPromises)
          }
        }
        await fetchLabelCounts(customLabels)
      }

      console.log('Final unread counts:', unreadCountsMap)
      console.log('Final total counts:', totalCountsMap)
      setUnreadCounts(unreadCountsMap)
      setTotalCounts(totalCountsMap)
      setReceivedTotalCounts(receivedTotalCountsMap)
      setMarkableUnreadCounts(markableUnreadCountsMap)
      setMarkableTotalCounts(markableTotalCountsMap)
      setStarredFolders(newStarredFolders)
      localStorage.setItem('starredFolders', JSON.stringify([...newStarredFolders]))
      setSnoozedFolders(newSnoozedFolders)
      localStorage.setItem('snoozedFolders', JSON.stringify([...newSnoozedFolders]))
      setFavouriteLabels(newFavouriteLabels)
      localStorage.setItem('favouriteLabels', JSON.stringify([...newFavouriteLabels]))
    } catch (err) {
      console.error('Failed to fetch unread counts:', err)
    }
  }

  // Validate token on startup — auto-logout if it's expired or signed with wrong secret
  // Global handler: show file cards that fit, +N badge only for hidden ones
  useEffect(() => {
    const CARD_W = 120   // matches width:120px in CSS
    const CARD_GAP = 6
    const BADGE_W = 50   // badge circle width
    const TOTAL_SLOT = CARD_W + CARD_GAP  // 126px per card slot

    const applyOverflow = () => {
      observer.disconnect()

      const seen = new Set<HTMLElement>()
      document.querySelectorAll<HTMLElement>('.email-item [data-file-card]').forEach(card => {
        const container = card.parentElement as HTMLElement
        if (!container || seen.has(container)) return
        seen.add(container)

        // Remove previously injected badge
        container.querySelector('[data-overflow-badge]')?.remove()

        // Fully restore container before measuring (clears any previous visibility:hidden/height:0)
        container.style.display = 'flex'
        container.style.flexDirection = 'row'
        container.style.flexWrap = 'nowrap'
        container.style.overflow = 'hidden'
        container.style.alignItems = 'center'
        container.style.visibility = ''
        container.style.height = ''
        container.style.marginTop = ''

        // Reset all cards to visible
        const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-file-card]'))
        cards.forEach(c => { c.style.display = '' })

        const containerWidth = container.clientWidth
        if (containerWidth <= 0) return  // not in layout yet, skip without hiding

        const n = cards.length

        const EXT_MAP: Record<string, [string, string]> = {
          pdf:  ['PDF',    '#e53935'],
          doc:  ['DOC',    '#1e88e5'], docx: ['DOC',  '#1e88e5'],
          xls:  ['XLS',   '#43a047'], xlsx: ['XLS',  '#43a047'],
          csv:  ['CSV',   '#43a047'],
          ppt:  ['PPT',   '#fb8c00'], pptx: ['PPT',  '#fb8c00'],
          jpg:  ['JPG',   '#8e24aa'], jpeg: ['JPG',  '#8e24aa'],
          png:  ['PNG',   '#8e24aa'], gif: ['GIF',   '#8e24aa'],
          webp: ['IMG',   '#8e24aa'],
          mp4:  ['VID',   '#00897b'], mov: ['VID',   '#00897b'],
          avi:  ['VID',   '#00897b'], mkv: ['VID',   '#00897b'],
          mp3:  ['AUD',   '#00897b'], wav: ['AUD',   '#00897b'],
          zip:  ['ZIP',   '#6d4c41'], rar: ['ZIP',   '#6d4c41'],
          '7z': ['ZIP',   '#6d4c41'],
          js:   ['JS',    '#f57f17'], ts:  ['TS',    '#1565c0'],
          jsx:  ['JSX',   '#f57f17'], tsx: ['TSX',   '#1565c0'],
          py:   ['PY',    '#2e7d32'], rb:  ['RB',    '#b71c1c'],
          java: ['JAVA',  '#e65100'], cpp: ['C++',   '#37474f'],
          c:    ['C',     '#37474f'], cs:  ['C#',    '#37474f'],
          html: ['HTML',  '#e64a19'], css: ['CSS',   '#0288d1'],
          json: ['JSON',  '#546e7a'], xml: ['XML',   '#546e7a'],
          sh:   ['SH',    '#37474f'], txt: ['TXT',   '#757575'],
          md:   ['MD',    '#546e7a'],
        }

        const getTypeBadge = (card: HTMLElement): [string, string] => {
          if (card.hasAttribute('data-folder-card')) return ['FOLDER', '#f9a825']
          const raw = card.getAttribute('data-attachment') || ''
          const filename = decodeURIComponent(raw).split('/').pop() || ''
          const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : ''
          return EXT_MAP[ext] ?? [ext.toUpperCase() || 'FILE', '#607d8b']
        }

        const attachTypeBadge = (card: HTMLElement) => {
          const [label, bg] = getTypeBadge(card)
          const b = document.createElement('span')
          b.setAttribute('data-overflow-badge', '1')
          b.style.cssText = `position:absolute;top:4px;left:4px;display:inline-flex;align-items:center;justify-content:center;height:17px;padding:0 5px;background:${bg};border-radius:3px;font-size:9px;font-weight:700;color:#fff;z-index:3;line-height:1;pointer-events:none;box-sizing:border-box;letter-spacing:0.3px`
          b.textContent = label
          card.appendChild(b)
        }

        // Show file-type badge on every visible card; hide overflow cards
        const allWidth = n * TOTAL_SLOT - CARD_GAP
        if (allWidth <= containerWidth) {
          cards.forEach(c => attachTypeBadge(c))
          return
        }

        const maxVisible = Math.max(1, Math.floor(containerWidth / TOTAL_SLOT))
        const visible = Math.min(maxVisible, n - 1)

        for (let i = visible; i < n; i++) cards[i].style.display = 'none'
        for (let i = 0; i < visible; i++) attachTypeBadge(cards[i])
      })

      observer.observe(document.body, { childList: true, subtree: true })
    }

    const raf = { id: 0 }
    const schedule = () => { cancelAnimationFrame(raf.id); raf.id = requestAnimationFrame(applyOverflow) }

    const observer = new MutationObserver((mutations) => {
      const isSelf = mutations.every(m =>
        Array.from(m.addedNodes).concat(Array.from(m.removedNodes)).every(n =>
          n instanceof Element && (n.hasAttribute('data-overflow-badge') || n.querySelector?.('[data-overflow-badge]'))
        )
      )
      if (!isSelf) schedule()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', schedule)
    schedule()

    return () => { observer.disconnect(); window.removeEventListener('resize', schedule); cancelAnimationFrame(raf.id) }
  }, [])

  useEffect(() => {
    if (!token) return
    fetch('http://localhost:5050/api/counts', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token')
          localStorage.removeItem('userEmail')
          setToken(null)
          setUserEmail(null)
          navigate('/login')
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (chatViewContact) {
      sessionStorage.setItem('chatViewContact', chatViewContact)
    } else {
      sessionStorage.removeItem('chatViewContact')
    }
  }, [chatViewContact])

  useEffect(() => {
    if (highlightedEmailId != null) {
      sessionStorage.setItem('highlightedEmailId', String(highlightedEmailId))
    } else {
      sessionStorage.removeItem('highlightedEmailId')
    }
  }, [highlightedEmailId])

  useEffect(() => {
    if (openedEmailId != null) {
      sessionStorage.setItem('openedEmailId', String(openedEmailId))
    } else {
      sessionStorage.removeItem('openedEmailId')
    }
  }, [openedEmailId])

  useEffect(() => {
    if (chatMailCompose) {
      sessionStorage.setItem('chatMailCompose', 'true')
    } else {
      sessionStorage.removeItem('chatMailCompose')
    }
  }, [chatMailCompose])

  // Detect popout compose window — opened via "New window" button in ChatMailPage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('compose') === 'popout') {
      setChatMailCompose(true)
      // Clean up the URL param without reloading
      const url = new URL(window.location.href)
      url.searchParams.delete('compose')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  useEffect(() => {
    if (draftEmail) {
      try { sessionStorage.setItem('draftEmail', JSON.stringify(draftEmail)) } catch (_) {}
    } else {
      sessionStorage.removeItem('draftEmail')
    }
  }, [draftEmail])

  useEffect(() => {
    if (token) {
      fetchCustomLabels()
      fetchUnreadCounts()
    }
  }, [token])

  // Fetch unread counts again when custom labels are loaded
  useEffect(() => {
    if (token && customLabels.length > 0) {
      fetchUnreadCounts()
    }
  }, [customLabels, token])

  // Instant update of counts and folder lists on mailRefresh event
  useEffect(() => {
    const handleRefresh = () => {
      if (token) fetchUnreadCounts()
      setLabelPageKey(k => k + 1)
    }
    window.addEventListener('mailRefresh', handleRefresh)
    return () => window.removeEventListener('mailRefresh', handleRefresh)
  }, [token, customLabels])

  useEffect(() => {
    const handler = () => { if (token) fetchCustomLabels() }
    window.addEventListener('customLabelsChanged', handler)
    return () => window.removeEventListener('customLabelsChanged', handler)
  }, [token])

  useEffect(() => {
    const handleUpdateFolderCount = (e: Event) => {
      const { folder, total, unread } = (e as CustomEvent).detail
      if (folder === 'label') return; // Handled separately
      let key = folder;
      if (folder === 'trash') key = 'delete';

      setTotalCounts(prev => ({ ...prev, [key]: total }))
      setReceivedTotalCounts(prev => ({ ...prev, [key]: total }))
      if (unread !== undefined) {
        setUnreadCounts(prev => ({ ...prev, [key]: unread }))
      }
    }

    window.addEventListener('updateFolderCount', handleUpdateFolderCount)
    return () => window.removeEventListener('updateFolderCount', handleUpdateFolderCount)
  }, [])

  // Sync active sidebar section with route changes and loaded labels
  useEffect(() => {
    const path = location.pathname
    if (path === '/inbox') setActiveSidebarSection('inbox')
    else if (path === '/sent') setActiveSidebarSection('sent')
    else if (path === '/starred') setActiveSidebarSection('starred')
    else if (path === '/snoozed') setActiveSidebarSection('snoozed')
    else if (path === '/drafts') setActiveSidebarSection('drafts')
    else if (path === '/archived') setActiveSidebarSection('archive')
    else if (path === '/groups') setActiveSidebarSection('groups')
    else if (path === '/allmails') setActiveSidebarSection('all-mails')
    else if (path === '/scheduled') setActiveSidebarSection('scheduled')
    else if (path === '/reports') setActiveSidebarSection('reports')
    else if (path === '/spam') setActiveSidebarSection('spam')
    else if (path === '/delete') setActiveSidebarSection('delete')
    else if (path === '/subscriptions') setActiveSidebarSection('manage-subscription')
    else if (path === '/labels') setActiveSidebarSection('manage-labels')
    else if (path === '/chatmail') {
      // When a folder is being proxied through Chat Mail (folderViewMode === 'chatmail'),
      // goToChatMailTab already set the correct folder section — don't stomp it here, except
      // to resolve a label key once customLabels has loaded (unresolvable at initial mount).
      if (folderViewMode === 'chatmail') {
        const persistedTab = sessionStorage.getItem('chat_persistedListTab') || ''
        if (persistedTab.startsWith('label:') && customLabels.length > 0) {
          const displayName = persistedTab.slice('label:'.length)
          const findLabelId = (labels: LabelNode[]): number | null => {
            for (const l of labels) {
              if (displayName === l.name || displayName.endsWith(` / ${l.name}`)) return l.id
              if (l.children) { const id = findLabelId(l.children); if (id) return id }
            }
            return null
          }
          const id = findLabelId(customLabels)
          if (id) setActiveSidebarSection(`label-${id}`)
        }
      }
      else if ((location.state as any)?.fromDraft || sessionStorage.getItem('chat_draftId')) {
        setActiveSidebarSection('drafts')
      } else {
        setActiveSidebarSection('')
      }
    }
    else if (path.startsWith('/labels/') && customLabels.length > 0) {
      const labelNameParam = decodeURIComponent(path.replace('/labels/', ''))
      const lastName = labelNameParam.split(' / ').pop() || ''
      const findLabelId = (labels: LabelNode[]): number | null => {
        for (const l of labels) {
          if (l.name === lastName) return l.id
          if (l.children) {
            const id = findLabelId(l.children)
            if (id) return id
          }
        }
        return null
      }
      const id = findLabelId(customLabels)
      if (id) setActiveSidebarSection(`label-${id}`)
    }
    
    if (['/conference', '/chat', '/office'].includes(path)) setActiveApp('' as any)
    else setActiveApp('mail')

    if (['/allmails', '/reports', '/spam', '/delete', '/subscriptions', '/labels'].includes(path)) setMoreExpanded(true)
  }, [location.pathname, location.state, customLabels, folderViewMode])

  // Auto-select category filter based on active sidebar section
  useEffect(() => {
    setSearchFilters(prev => ({
      ...prev,
      category: activeSidebarSection === 'inbox' ? '' : activeSidebarSection
    }))
  }, [activeSidebarSection])

  // Auto-focus search bar when app loads or user logs in
  useEffect(() => {
    if (token && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [token])

  // Save expanded label groups to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('expandedLabelGroups', JSON.stringify(Array.from(expandedLabelGroups)))
    } catch (err) {
      console.error('Failed to save expanded label groups:', err)
    }
  }, [expandedLabelGroups])

  // Auto-refresh folder counts every 5 seconds
  useEffect(() => {
    if (!token) return

    const autoRefreshInterval = setInterval(() => {
      fetchUnreadCounts()
    }, 5000) // Refresh every 5 seconds

    return () => clearInterval(autoRefreshInterval)
  }, [token, customLabels])

  // Auto-refresh sent + scheduled folders when a scheduled email's time passes
  useEffect(() => {
    if (!upcomingScheduledEmail) return
    const scheduledTime = new Date(upcomingScheduledEmail.scheduledFor).getTime()
    const delay = scheduledTime - Date.now() + 5000 // 5s buffer after scheduled time
    if (delay <= 0) return
    const timer = setTimeout(() => {
      ;['sent', 'scheduled'].forEach(f =>
        window.dispatchEvent(new CustomEvent('folderRefresh', { detail: { folder: f } }))
      )
      fetchUnreadCounts()
    }, delay)
    return () => clearTimeout(timer)
  }, [upcomingScheduledEmail])

  // Auto-collapse sidebar based on width and user action
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 350) {
        // Always expand sidebar at width >= 350px
        setSidebarCollapsed(false)
        setMenuButtonClicked(false)
      } else if (window.innerWidth < 350 && !menuButtonClicked) {
        // Auto-collapse at width < 350px only if no menu button was clicked
        setSidebarCollapsed(true)
      }
    }

    window.addEventListener('resize', handleResize)
    // Check on initial load
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [menuButtonClicked])

  // Close search options panel and category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const isClickInsideSearchPanel = target.closest('.search-box-wrapper')
      const isClickInsideCategory = target.closest('[data-category-dropdown]')

      if (!isClickInsideSearchPanel && showSearchOptions) {
        setShowSearchOptions(false)
      }
      if (!isClickInsideCategory && showCategoryDropdown) {
        setShowCategoryDropdown(false)
      }
    }

    if (showSearchOptions || showCategoryDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showSearchOptions, showCategoryDropdown])

  // Close label menu when clicking outside
  useEffect(() => {
    if (openLabelMenu === null) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.label-actions') && !target.closest('.label-menu-portal')) {
        closeLabelMenu()
      }
    }
    document.addEventListener('click', handleClickOutside, true)
    return () => document.removeEventListener('click', handleClickOutside, true)
  }, [openLabelMenu])

  // Close sidebar menus when AllMailsPage opens a dropdown
  useEffect(() => {
    const handler = () => { closeLabelMenu(); setOpenFolderMenu(null); setFolderMenuPos(null) }
    window.addEventListener('contentDropdownOpened', handler)
    return () => window.removeEventListener('contentDropdownOpened', handler)
  }, [])

  // Close folderSnoozeMenu when clicking outside
  useEffect(() => {
    if (folderSnoozeMenu === null) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.snooze-dropdown') && !target.closest('.snooze')) {
        setFolderSnoozeMenu(null)
      }
    }
    document.addEventListener('click', handleClickOutside, true)
    return () => document.removeEventListener('click', handleClickOutside, true)
  }, [folderSnoozeMenu])

  // Close folder menu when clicking outside
  useEffect(() => {
    if (openFolderMenu === null) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.folder-actions') && !target.closest('.folder-menu-dropdown')) {
        setOpenFolderMenu(null)
        setFolderMenuPos(null)
      }
    }
    document.addEventListener('click', handleClickOutside, true)
    return () => document.removeEventListener('click', handleClickOutside, true)
  }, [openFolderMenu])

  // Sync ChatMailPage toolbar state into App.tsx search bar buttons
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setChatMailActionState(detail.active ? detail : { active: false, convMuted: false, convBlocked: false, zoomLevel: 100, convPinned: false, immersiveMode: false, selectionMode: false, hasSelection: false, convAllRead: true, convAllUnread: false, convAllStarred: false, convAllUnstarred: false, convAnyArchived: false, convAllArchived: false, convAllUnarchived: false, viewMode: 'chat', convAllSnoozed: false, convAllUnsnoozed: false, convAllGrouped: false, convAllUngrouped: false, convAnySpam: false, convAllSpam: false, convAllUnspam: false, convAnyReported: false, convAllReported: false, convAllUnreported: false, convAnyPinned: false, convAllPinned: false, convAllUnpinned: false, convAnyMuted: false, convAllUnmuted: false, convAnyDeleted: false, convAllDeleted: false, convAllUndeleted: false, chatListTab: 'all' })
    }
    window.addEventListener('chatmail:state', handler)
    // ChatMailPage may mount (and broadcast its initial state) before this listener is
    // registered — child effects run before parent effects on first commit. Ask it to
    // resend so the toolbar doesn't sit stale until some unrelated re-render fixes it.
    window.dispatchEvent(new Event('chatmail:requestState'))
    return () => window.removeEventListener('chatmail:state', handler)
  }, [])

  // Same toolbar-sync pattern as chatmail, for AllMailsPage (Inbox/Sent/.../Labels).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setMailPageActionState(detail.active ? detail : { active: false, selectionMode: false, hasSelection: false, convAllRead: true, convAllUnread: false, convAllStarred: false, convAllUnstarred: false, convAnyArchived: false, convAllArchived: false, convAllUnarchived: false, convAllSnoozed: false, convAllUnsnoozed: false, convAllGrouped: false, convAllUngrouped: false, convAnySpam: false, convAllSpam: false, convAllUnspam: false, convAnyReported: false, convAllReported: false, convAllUnreported: false, convAnyPinned: false, convAllPinned: false, convAllUnpinned: false, convAnyMuted: false, convAllUnmuted: false, convAnyDeleted: false, convAllDeleted: false, convAllUndeleted: false, convMuted: false, zoomLevel: 100, immersiveMode: false })
    }
    window.addEventListener('mailpage:state', handler)
    window.dispatchEvent(new Event('mailpage:requestState'))
    return () => window.removeEventListener('mailpage:state', handler)
  }, [location.pathname])

  // Closing a contact-locked ChatMailPage instance (chatViewContact -> null) unmounts it,
  // and its cleanup broadcasts {active:false} — stomping the toolbar even though the main
  // instance underneath is still showing the chatmail list. Effect cleanups across the tree
  // run before new/changed effects in the same commit, so this fires after that cleanup and
  // lets the surviving instance reassert its real state.
  useEffect(() => {
    window.dispatchEvent(new Event('chatmail:requestState'))
  }, [chatViewContact])

  // Expanding a minimized draft strip from the main (non-contact) ChatMailPage instance
  // needs the /chatmail route active — that instance's tree is display:none everywhere
  // else, so without this the expanded panel would have no chat view visible behind it.
  useEffect(() => {
    const handler = () => navigate('/chatmail')
    window.addEventListener('chatmail:openDraftView', handler)
    return () => window.removeEventListener('chatmail:openDraftView', handler)
  }, [navigate])

  useEffect(() => {
    if (activeApp === 'files') {
      const fetchFiles = async () => {
        try {
          const filesList: Array<{ name: string; size: number; dataUrl?: string, date?: string, emailId?: number, emailSubject?: string, emailFrom?: string, emailTo?: string, emailFolder?: string, emailIsScheduled?: boolean, emailLabelName?: string, emailLabelColor?: string }> = []

          if (token) {
            const res = await fetch('http://localhost:5050/api/allmails?limit=1000', { headers: { Authorization: `Bearer ${token}` } })
            if (res.ok) {
              const data = await res.json()
              if (data.emails) {
                data.emails.forEach((email: any) => {
                  if (email.attachments && Array.isArray(email.attachments)) {
                    email.attachments.forEach((att: any) => filesList.push({ 
                      ...att, 
                      date: email.date,
                      emailId: email.id,
                      emailSubject: email.subject,
                      emailFrom: email.from,
                      emailTo: email.to,
                      emailFolder: email.folder,
                      emailIsScheduled: email.isScheduled,
                      emailLabelName: email.label_name,
                      emailLabelColor: email.label_color
                    }))
                  }
                })
              }
            }
          }

          const store = JSON.parse(localStorage.getItem('mail_msg_attachments') || '{}')
          Object.values(store).forEach((attachments: any) => {
            if (Array.isArray(attachments)) {
              attachments.forEach(att => filesList.push({ ...att, date: new Date().toISOString() }))
            }
          })

          const uniqueFilesMap = new Map();
          filesList.forEach(file => {
            // Prefer the version that has email metadata from the API over the local storage version
            if (!uniqueFilesMap.has(file.name) || (!uniqueFilesMap.get(file.name).emailId && file.emailId)) {
              uniqueFilesMap.set(file.name, file);
            }
          });
          const uniqueFiles = Array.from(uniqueFilesMap.values());
          setSavedFiles(uniqueFiles.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()))
        } catch (e) { console.error('Failed to load files:', e) }
      }
      fetchFiles()
    }
  }, [activeApp, token])

  const handleMailBtnClick = () => {
    setActiveApp(activeApp === 'mail' ? '' as any : 'mail')
    setMenuButtonClicked(true)
    setSidebarCollapsed(false)
  }

  const handleCalendarBtnClick = () => {
    setActiveApp(activeApp === 'calendar' ? '' as any : 'calendar')
    setMenuButtonClicked(true)
    setSidebarCollapsed(false)
  }

  const handleContactsClick = () => {
    setActiveApp(activeApp === 'contacts' ? '' as any : 'contacts')
    setMenuButtonClicked(true)
    setSidebarCollapsed(false)
  }

  const handleGroupsClick = () => {
    setActiveApp(activeApp === 'groups' ? '' as any : 'groups')
    setMenuButtonClicked(true)
    setSidebarCollapsed(false)
  }

  const handleConferenceClick = () => {
    window.open('/conference', 'Conference', 'width=1200,height=800,resizable=yes,scrollbars=yes')
  }

  const handleChatClick = () => {
    window.dispatchEvent(new Event('chatmail:flushDraft'))
    setActiveApp('' as any)
    navigate('/chat')
  }

  const handleOfficeClick = (tab: string = 'notes') => {
    window.open(`/office?tab=${tab}`, 'Office', 'width=1400,height=900,resizable=yes,scrollbars=yes')
  }

  const handleNotesClick = () => {
    handleOfficeClick('notes')
  }

  const handleWordClick = () => {
    handleOfficeClick('docs')
  }

  const handlePdfClick = () => {
    handleOfficeClick('pdf')
  }

  const handleExcelClick = () => {
    handleOfficeClick('sheets')
  }

  // Sidebar section handlers
  const handleSidebarSection = (section: string) => {
    // flush any in-progress draft before navigating away from chatmail
    window.dispatchEvent(new Event('chatmail:flushDraft'))
    setActiveSidebarSection(section)
    setActiveApp('mail')
    setSidebarCollapsed(false)
    setSidebarHoverExpanded(false)

    setChatViewContact(null)
    setHighlightedEmailId(null)
    setOpenedEmailId(null)
    setChatMailCompose(false)
    setDraftEmail(null)
    setChatReplyMessage(null)
    setChatReplyData(null)
  }

  // Reverse direction of goToChatMailTab — given a folder key, navigate to its normal
  // AllMailsPage route. Shared by each folder's click handler and by the switch button
  // (which re-applies whichever folder is currently active when the mode flips).
  const goToFolderListMode = (key: string, opts?: { includeChildren?: boolean }) => {
    if (key === 'inbox') { handleSidebarSection('inbox'); navigate('/inbox'); return }
    if (key === 'sent') { handleSidebarSection('sent'); navigate('/sent'); return }
    if (key === 'starred') { handleSidebarSection('starred'); navigate('/starred'); return }
    if (key === 'snoozed') { handleSidebarSection('snoozed'); navigate('/snoozed'); return }
    if (key === 'draft') { handleSidebarSection('drafts'); navigate('/drafts'); return }
    if (key === 'archive') { handleSidebarSection('archive'); navigate('/archived'); return }
    if (key === 'group') { handleSidebarSection('groups'); navigate('/groups'); return }
    if (key === 'allmails') { handleSidebarSection('all-mails'); navigate('/allmails'); return }
    if (key === 'scheduled') { handleSidebarSection('scheduled'); navigate('/scheduled'); return }
    if (key === 'report') { handleSidebarSection('reports'); navigate('/reports'); return }
    if (key === 'spam') { handleSidebarSection('spam'); navigate('/spam'); return }
    if (key === 'delete') { handleSidebarSection('delete'); navigate('/delete'); return }
    if (key.startsWith('label:')) {
      const displayName = key.slice('label:'.length)
      const findLabelId = (labels: LabelNode[]): number | null => {
        for (const l of labels) {
          if (displayName === l.name || displayName.endsWith(` / ${l.name}`)) return l.id
          if (l.children) { const id = findLabelId(l.children); if (id) return id }
        }
        return null
      }
      const id = findLabelId(customLabels)
      if (id) handleSidebarSection(`label-${id}`)
      const query = opts?.includeChildren ? '?includeChildren=true' : ''
      navigate(`/labels/${encodeURIComponent(displayName)}${query}`)
    }
  }
  // Maps the page currently on screen back to a folder key — used so the switch button
  // can re-open whatever's active right now in the other mode, instead of defaulting to Inbox.
  const getCurrentFolderKey = (): string => {
    const path = location.pathname
    if (path === '/chatmail') return chatMailActionState.chatListTab || 'all'
    const routeMap: Record<string, string> = {
      '/inbox': 'inbox', '/sent': 'sent', '/starred': 'starred', '/snoozed': 'snoozed',
      '/drafts': 'draft', '/archived': 'archive', '/groups': 'group', '/allmails': 'allmails',
      '/scheduled': 'scheduled', '/reports': 'report', '/spam': 'spam', '/delete': 'delete',
    }
    if (routeMap[path]) return routeMap[path]
    if (path.startsWith('/labels/')) return `label:${decodeURIComponent(path.replace('/labels/', '').split('?')[0])}`
    return 'inbox'
  }
  const handleInboxClick = () => {
    if (folderViewMode === 'chatmail') { goToChatMailTab('inbox'); return }
    goToFolderListMode('inbox')
  }
  const handleSentClick = () => {
    if (folderViewMode === 'chatmail') { goToChatMailTab('sent'); return }
    goToFolderListMode('sent')
  }
  const handleStarredClick = () => {
    if (folderViewMode === 'chatmail') { goToChatMailTab('starred'); return }
    goToFolderListMode('starred')
  }
  const handleSnoozedClick = () => {
    if (folderViewMode === 'chatmail') { goToChatMailTab('snoozed'); return }
    goToFolderListMode('snoozed')
  }
  const handleDraftsClick = () => {
    if (folderViewMode === 'chatmail') { goToChatMailTab('draft'); return }
    goToFolderListMode('draft')
  }
  const handleArchiveClick = () => {
    if (folderViewMode === 'chatmail') { goToChatMailTab('archive'); return }
    goToFolderListMode('archive')
  }
  const handleGroupsSidebarClick = () => {
    if (folderViewMode === 'chatmail') { goToChatMailTab('group'); return }
    goToFolderListMode('group')
  }
  const handleAllMailsClick = () => {
    if (folderViewMode === 'chatmail') { goToChatMailTab('allmails'); return }
    goToFolderListMode('allmails')
  }
  const handleScheduledClick = () => {
    if (folderViewMode === 'chatmail') { goToChatMailTab('scheduled'); return }
    goToFolderListMode('scheduled')
  }
  const handleReportsClick = () => {
    if (folderViewMode === 'chatmail') { goToChatMailTab('report'); return }
    goToFolderListMode('report')
  }
  const handleSpamClick = () => {
    if (folderViewMode === 'chatmail') { goToChatMailTab('spam'); return }
    goToFolderListMode('spam')
  }
  const handleDeleteClick = () => {
    if (folderViewMode === 'chatmail') { goToChatMailTab('delete'); return }
    goToFolderListMode('delete')
  }
  const handleManageSubscriptionClick = () => {
    handleSidebarSection('manage-subscription')
    navigate('/subscriptions')
  }
  const handleManageLabelsClick = () => {
    handleSidebarSection('manage-labels')
    navigate('/labels')
  }
  const handleLabelClick = (label: {id: number, name: string, color: string}, parentName?: string, includeChildren?: boolean) => {
    const displayName = parentName ? `${parentName} / ${label.name}` : label.name
    if (folderViewMode === 'chatmail') { goToChatMailTab(`label:${displayName}`); return }
    goToFolderListMode(`label:${displayName}`, { includeChildren })
  }

  const handleAddLabelClick = () => {
    setClLabelName(''); setClLabelColor(''); setClParentId(null); setClError('');
    setClIsRenameMode(false); setClRenameLabelId(null);
    const rect = addLabelBtnRef.current?.getBoundingClientRect()
    if (rect) {
      const dropdownH = 560
      const spaceBelow = window.innerHeight - rect.bottom - 8
      const spaceAbove = rect.top - 8
      const openUpward = spaceBelow < dropdownH && spaceAbove > spaceBelow
      const top = openUpward ? Math.max(8, rect.top - Math.min(dropdownH, spaceAbove) - 4) : rect.bottom + 4
      setAddLabelDropdownPos({ top, left: rect.right + 8, maxHeight: openUpward ? Math.min(dropdownH, spaceAbove) : Math.min(dropdownH, spaceBelow) })
    }
    setShowCreateLabelModal(true)
  }

  const handleLabelCreated = () => {
    fetchCustomLabels()
  }

  const handleDeleteLabel = (labelId: number) => {
    const findWithParent = (labels: LabelNode[], parentId: number | null = null): { label: LabelNode; parentId: number | null } | null => {
      for (const l of labels) {
        if (l.id === labelId) return { label: l, parentId }
        if (l.children) {
          const found = findWithParent(l.children, l.id)
          if (found) return found
        }
      }
      return null
    }
    const target = findWithParent(customLabels)
    if (!target) return
    const collectIds = (nodes: LabelNode[]): number[] =>
      nodes.flatMap(n => [n.id, ...(n.children ? collectIds(n.children) : [])])
    setDeleteLabelExpanded(new Set(collectIds([target.label])))
    setDeleteLabelTarget(target)
    setShowDeleteLabelModal(true)
  }

  const confirmDeleteLabel = async (labelId: number) => {
    try {
      const response = await fetch(`http://localhost:5050/api/custom-labels/${labelId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const removeFromTree = (labels: LabelNode[]): LabelNode[] =>
          labels.filter(l => l.id !== labelId).map(l => ({ ...l, children: l.children ? removeFromTree(l.children) : [] }))
        setCustomLabels(removeFromTree(customLabels))
        setShowDeleteLabelModal(false)
        setDeleteLabelTarget(null)
      } else {
        alert('Failed to delete label')
      }
    } catch (err) {
      console.error('Failed to delete label:', err)
      alert('Failed to delete label')
    }
  }

  const handleToggleLabelGroup = (labelId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const newExpanded = new Set(expandedLabelGroups)
    if (newExpanded.has(labelId)) {
      newExpanded.delete(labelId)
    } else {
      newExpanded.add(labelId)
    }
    setExpandedLabelGroups(newExpanded)
  }

  const closeLabelMenu = () => { setOpenLabelMenu(null); setLabelMenuPos(null) }

  const handleMoveLabel = (labelId: number, currentName: string, currentColor: string) => {
    handleRenameLabel(labelId, currentName, currentColor)
  }

  const handleToggleFavourite = async (labelId: number, forceValue?: boolean) => {
    const isStarred = forceValue !== undefined ? forceValue : !favouriteLabels.has(labelId)
    const next = new Set(favouriteLabels)
    isStarred ? next.add(labelId) : next.delete(labelId)
    setFavouriteLabels(next)
    localStorage.setItem('favouriteLabels', JSON.stringify([...next]))
    closeLabelMenu()

    const menuLabel = findLabelById(customLabels, labelId)
    if (!menuLabel) return
    const menuIsCollapsed = !!(menuLabel.children?.length) && !expandedLabelGroups.has(labelId)
    const paths = getLabelFullPaths(menuLabel, menuIsCollapsed)
    window.dispatchEvent(new CustomEvent('mailBulkStar', { detail: { isStarred, folderType: `label-${labelId}` } }))
    showAppToast(isStarred ? 'All added to star' : 'All removed from star')
    try {
      await Promise.all(paths.map(path =>
        fetch(`http://localhost:5050/api/labels/${encodeURIComponent(path)}/star-all`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_starred: isStarred })
        })
      ))
      window.dispatchEvent(new Event('mailRefresh'))
      await fetchUnreadCounts()
      setLabelPageKey(prev => prev + 1)
    } catch (err) { console.error(err) }
  }

  const handleToggleImportant = async (labelId: number) => {
    const isImportant = !importantLabels.has(labelId)
    const next = new Set(importantLabels)
    isImportant ? next.add(labelId) : next.delete(labelId)
    setImportantLabels(next)
    localStorage.setItem('importantLabels', JSON.stringify([...next]))
    closeLabelMenu()

    const menuLabel = findLabelById(customLabels, labelId)
    if (!menuLabel) return
    const menuIsCollapsed = !!(menuLabel.children?.length) && !expandedLabelGroups.has(labelId)
    const paths = getLabelFullPaths(menuLabel, menuIsCollapsed)
    window.dispatchEvent(new CustomEvent('mailBulkImportant', { detail: { isImportant, folderType: `label-${labelId}` } }))
    showAppToast(isImportant ? 'All marked as important' : 'All removed from important')
    try {
      await Promise.all(paths.map(path =>
        fetch(`http://localhost:5050/api/labels/${encodeURIComponent(path)}/important-all`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_important: isImportant })
        })
      ))
      window.dispatchEvent(new Event('mailRefresh'))
      await fetchUnreadCounts()
      setLabelPageKey(prev => prev + 1)
    } catch (err) { console.error(err) }
  }

  const collectAllLabelPaths = (label: LabelNode, ancestors: string[] = []): string[] => {
    const path = [...ancestors, label.name].join(' / ')
    const paths = [path]
    if (label.children) {
      label.children.forEach(child => paths.push(...collectAllLabelPaths(child, [...ancestors, label.name])))
    }
    return paths
  }

  const getLabelFullPaths = (label: LabelNode, includeChildren: boolean): string[] => {
    const fullRoot = computeLabelFullPath(customLabels, label.id) || label.name
    const ancestors = fullRoot.split(' / ').slice(0, -1)
    return includeChildren ? collectAllLabelPaths(label, ancestors) : [fullRoot]
  }

  const handleMarkAllRead = async (label: LabelNode, includeChildren: boolean) => {
    const paths = getLabelFullPaths(label, includeChildren)
    window.dispatchEvent(new CustomEvent('mailBulkRead', { detail: { isRead: true, folderType: `label-${label.id}` } }))
    closeLabelMenu()
    showAppToast('All marked as read', () => handleMarkAllUnread(label, includeChildren))
    try {
      await Promise.all(paths.map(path =>
        fetch(`http://localhost:5050/api/labels/${encodeURIComponent(path)}/mark-all`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_read: true })
        })
      ))
      window.dispatchEvent(new Event('mailRefresh'))
      await fetchUnreadCounts()
    } catch (err) { console.error(err) }
  }

  const handleMarkAllUnread = async (label: LabelNode, includeChildren: boolean) => {
    const paths = getLabelFullPaths(label, includeChildren)
    window.dispatchEvent(new CustomEvent('mailBulkRead', { detail: { isRead: false, folderType: `label-${label.id}` } }))
    closeLabelMenu()
    showAppToast('All marked as unread', () => handleMarkAllRead(label, includeChildren))
    try {
      await Promise.all(paths.map(path =>
        fetch(`http://localhost:5050/api/labels/${encodeURIComponent(path)}/mark-all`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_read: false })
        })
      ))
      window.dispatchEvent(new Event('mailRefresh'))
      await fetchUnreadCounts()
    } catch (err) { console.error(err) }
  }

  const showAppToast = (message: string, onUndo?: () => void) => {
    if (appToastTimeoutRef.current) clearTimeout(appToastTimeoutRef.current)
    setAppToast({ message, onUndo })
    appToastTimeoutRef.current = setTimeout(() => setAppToast(null), 5000)
  }

  const openFolderSnoozeMenu = (e: React.MouseEvent, folder: string) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const dropdownHeight = 220
    const spaceBelow = window.innerHeight - rect.top
    const top = spaceBelow >= dropdownHeight ? rect.top : Math.max(8, window.innerHeight - dropdownHeight - 8)
    setFolderSnoozeMenu({ folder, top, left: rect.right + 4 })
    setOpenFolderMenu(null)
  }

  const cancelCloseSnoozeMenu = () => {
    if (folderSnoozeTimeoutRef.current) clearTimeout(folderSnoozeTimeoutRef.current)
  }

  const scheduleCloseSnoozeMenu = () => {
    if (folderSnoozeTimeoutRef.current) clearTimeout(folderSnoozeTimeoutRef.current)
    folderSnoozeTimeoutRef.current = setTimeout(() => setFolderSnoozeMenu(null), 300)
  }

  const handleFolderSnoozeHover = (e: React.MouseEvent, folder: string) => {
    cancelCloseSnoozeMenu()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const dropdownHeight = 220
    const spaceBelow = window.innerHeight - rect.top
    const top = spaceBelow >= dropdownHeight ? rect.top : Math.max(8, window.innerHeight - dropdownHeight - 8)
    setFolderSnoozeMenu({ folder, top, left: rect.right + 4 })
  }

  const handleLabelSnoozeHover = (e: React.MouseEvent, labelSnoozeKey: string) => {
    cancelCloseSnoozeMenu()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const dropdownHeight = 220
    const spaceBelow = window.innerHeight - rect.top
    const top = spaceBelow >= dropdownHeight ? rect.top : Math.max(8, window.innerHeight - dropdownHeight - 8)
    setFolderSnoozeMenu({ folder: labelSnoozeKey, top, left: rect.right + 4 })
  }

  const openFolderMenuAt = (e: React.MouseEvent, key: string) => {
    e.stopPropagation()
    closeLabelMenu()
    if (openFolderMenu === key) { setOpenFolderMenu(null); setFolderMenuPos(null); return }
    window.dispatchEvent(new Event('sidebarMenuOpened'))
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const dropdownHeight = 480
    const spaceBelow = window.innerHeight - rect.top
    const top = spaceBelow >= dropdownHeight ? rect.top : Math.max(8, window.innerHeight - dropdownHeight - 8)
    setFolderMenuPos({ top, left: rect.right + 4 })
    setOpenFolderMenu(key)
    const folderRoutes: Record<string, string> = {
      inbox: '/inbox', sent: '/sent', groups: '/groups', starred: '/starred',
      snoozed: '/snoozed', drafts: '/drafts', archive: '/archived',
      'all-mails': '/allmails', scheduled: '/scheduled', reports: '/reports',
      spam: '/spam', delete: '/delete', subscription: '/subscriptions',
      'manage-labels': '/labels',
    }
    if (folderRoutes[key]) {
      handleSidebarSection(key === 'subscription' ? 'manage-subscription' : key)
      navigate(folderRoutes[key])
    }
  }

  const handleFolderMarkAllRead = async (type: string) => {
    setOpenFolderMenu(null)
    window.dispatchEvent(new CustomEvent('mailBulkRead', { detail: { isRead: true, folderType: type } }))
    showAppToast('All marked as read', () => handleFolderMarkAllUnread(type))
    try {
      await fetch(`http://localhost:5050/api/folders/${type}/mark-all`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true })
      })
      window.dispatchEvent(new Event('mailRefresh'))
      await fetchUnreadCounts()
    } catch (err) { console.error(err) }
  }

  const handleFolderMarkAllUnread = async (type: string) => {
    setOpenFolderMenu(null)
    window.dispatchEvent(new CustomEvent('mailBulkRead', { detail: { isRead: false, folderType: type } }))
    showAppToast('All marked as unread', () => handleFolderMarkAllRead(type))
    try {
      await fetch(`http://localhost:5050/api/folders/${type}/mark-all`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: false })
      })
      window.dispatchEvent(new Event('mailRefresh'))
      await fetchUnreadCounts()
    } catch (err) { console.error(err) }
  }

  const handleFolderStarAll = async (type: string, value: boolean) => {
    const folderKey = openFolderMenu || type
    setOpenFolderMenu(null)
    if (folderKey) {
      setStarredFolders(prev => {
        const next = new Set(prev)
        const altKey = folderKey === 'archive' ? 'archived' : 
                       folderKey === 'subscription' ? 'subscriptions' : 
                       folderKey === 'all-mails' ? 'all' : 
                       folderKey;
        if (value) {
          next.add(folderKey)
          next.add(altKey)
        } else {
          next.delete(folderKey)
          next.delete(altKey)
        }
        localStorage.setItem('starredFolders', JSON.stringify([...next]))
        return next
      })
    }
    window.dispatchEvent(new CustomEvent('mailBulkStar', { detail: { isStarred: value, folderType: type } }))
    showAppToast(value ? 'All added to star' : 'All removed from star', () => handleFolderStarAll(type, !value))
    try {
      await fetch(`http://localhost:5050/api/folders/${type}/star-all`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: value })
      })
      window.dispatchEvent(new Event('mailRefresh'))
      if (type === 'all' && value) {
        // Refresh deleted folder, starred, inbox, sent, drafts, scheduled
        ;['delete', 'inbox', 'starred', 'sent', 'drafts', 'scheduled'].forEach(f =>
          window.dispatchEvent(new CustomEvent('folderRefresh', { detail: { folder: f } }))
        )
      }
      await fetchUnreadCounts()
    } catch (err) { console.error(err) }
  }

  const handleFolderImportantAll = async (type: string, value: boolean) => {
    setOpenFolderMenu(null)
    window.dispatchEvent(new CustomEvent('mailBulkImportant', { detail: { isImportant: value, folderType: type } }))
    showAppToast(value ? 'All marked as important' : 'All removed from important', () => handleFolderImportantAll(type, !value))
    try {
      await fetch(`http://localhost:5050/api/folders/${type}/important-all`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_important: value })
      })
      window.dispatchEvent(new Event('mailRefresh'))
      await fetchUnreadCounts()
    } catch (err) { console.error(err) }
  }

  const handleFolderRestoreAll = async () => {
    setOpenFolderMenu(null)
    try {
      await fetch('http://localhost:5050/api/folders/delete/restore-all', {
        method: 'PUT', headers: { Authorization: `Bearer ${token}` }
      })
      window.dispatchEvent(new Event('mailRefresh'))
      await fetchUnreadCounts()
      showAppToast('All deleted emails restored')
    } catch (err) { console.error(err) }
  }

  const handleFolderSnoozeAll = async (type: string, isSnoozed: boolean, hours?: number, undoIds?: number[]) => {
    const folderKey = openFolderMenu || type
    setOpenFolderMenu(null)
    
    if (isSnoozed && hours === undefined) {
      setCustomSnoozePopupFolder(folderKey)
      return
    }

    if (type.startsWith('label:::')) {
      const parts = type.split(':::')
      const labelId = parseInt(parts[1])
      const labelPath = parts.slice(2).join(':::')
      closeLabelMenu()
      setSnoozedLabels(prev => {
        const next = new Set(prev)
        isSnoozed ? next.add(labelId) : next.delete(labelId)
        localStorage.setItem('snoozedLabels', JSON.stringify([...next]))
        return next
      })
      try {
        const response = await fetch(`http://localhost:5050/api/labels/${encodeURIComponent(labelPath)}/snooze-all`, {
          method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_snoozed: isSnoozed, hours: hours || 24, undo_ids: undoIds })
        })
        const data = await response.json()
        const affectedIds = data.ids || []
        if (!undoIds) {
          showAppToast(isSnoozed ? 'All added to snooze' : 'All removed from snoozed', () => handleFolderSnoozeAll(type, !isSnoozed, hours || 24, affectedIds))
        }
        window.dispatchEvent(new CustomEvent('mailBulkSnooze', { detail: { isSnoozed, folderType: type, undoIds: undoIds || affectedIds } }))
        await fetchUnreadCounts()
      } catch (err) { console.error(err) }
      return
    }

    if (folderKey && !undoIds) {
      setSnoozedFolders(prev => {
        const next = new Set(prev)
        const altKey = folderKey === 'archive' ? 'archived' : 
                       folderKey === 'subscription' ? 'subscriptions' : 
                       folderKey === 'all-mails' ? 'all' : 
                       folderKey;
        if (isSnoozed) {
          next.add(folderKey)
          next.add(altKey)
        } else {
          next.delete(folderKey)
          next.delete(altKey)
        }
        localStorage.setItem('snoozedFolders', JSON.stringify([...next]))
        return next
      })
    }
    try {
      const response = await fetch(`http://localhost:5050/api/folders/${type}/snooze-all`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_snoozed: isSnoozed, hours: hours || 24, undo_ids: undoIds })
      })
      const data = await response.json()
      const affectedIds = data.ids || []
      if (!undoIds) {
        showAppToast(isSnoozed ? 'All added to snooze' : 'All removed from snoozed', () => handleFolderSnoozeAll(type, !isSnoozed, hours || 24, affectedIds))
      }
      window.dispatchEvent(new CustomEvent('mailBulkSnooze', { detail: { isSnoozed, folderType: type, undoIds: undoIds || affectedIds } }))
      await fetchUnreadCounts()
    } catch (err) { console.error(err) }
  }

  const handleFolderEmpty = async (type: string) => {
    setOpenFolderMenu(null)
    showAppToast('Folder emptied')
    try {
      await fetch(`http://localhost:5050/api/folders/${type}/empty`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })
      window.dispatchEvent(new Event('mailRefresh'))
      await fetchUnreadCounts()
    } catch (err) { console.error(err) }
  }

  const handleFolderOpenNewTab = (type: string) => {
    setOpenFolderMenu(null)
    const routes: Record<string, string> = {
      inbox: '/inbox', sent: '/sent', starred: '/starred', snoozed: '/snoozed',
      drafts: '/drafts', archive: '/archived', groups: '/groups',
      'all-mails': '/all-mails', scheduled: '/scheduled', reports: '/reports',
      spam: '/spam', delete: '/trash', subscription: '/subscriptions'
    }
    const path = routes[type] || '/'
    window.open(window.location.origin + path, '_blank')
  }

  const handleFolderMoveUp = (key: string) => {
    setOpenFolderMenu(null)
    setMoreFolderOrder(prev => {
      const idx = prev.indexOf(key)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  const handleFolderMoveDown = (key: string) => {
    setOpenFolderMenu(null)
    setMoreFolderOrder(prev => {
      const idx = prev.indexOf(key)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  const findParentId = (labels: LabelNode[], targetId: number): number | null => {
    for (const label of labels) {
      if (label.children?.some(c => c.id === targetId)) return label.id
      if (label.children) {
        const found = findParentId(label.children, targetId)
        if (found !== null) return found
      }
    }
    return null
  }

  const handleRenameLabel = (labelId: number, currentName: string, currentColor: string) => {
    closeLabelMenu()
    setClIsRenameMode(true)
    setClRenameLabelId(labelId)
    setClLabelName(currentName)
    setClLabelColor(currentColor || '#607d8b')
    setClParentId(findParentId(customLabels, labelId))
    setClError('')
    setShowCreateLabelModal(true)
  }

  const handleChangeLabelColor = async (labelId: number, color: string) => {
    try {
      const res = await fetch(`http://localhost:5050/api/custom-labels/${labelId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ color })
      })
      if (res.ok) {
        const updateColor = (labels: LabelNode[]): LabelNode[] =>
          labels.map(l => l.id === labelId ? { ...l, color } : { ...l, children: l.children ? updateColor(l.children) : [] })
        setCustomLabels(updateColor(customLabels))
      }
    } catch (err) { console.error(err) }
  }

  const handleEmptyLabel = async (label: LabelNode, includeChildren: boolean) => {
    const paths = includeChildren ? collectAllLabelPaths(label) : [label.name]
    const msg = includeChildren
      ? `Empty all emails from "${label.name}" and its sub-labels? They will be moved to Trash.`
      : `Empty all emails from "${label.name}"? They will be moved to Trash.`
    if (!window.confirm(msg)) return
    try {
      await Promise.all(paths.map(path =>
        fetch(`http://localhost:5050/api/labels/${encodeURIComponent(path)}/emails`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        })
      ))
      window.dispatchEvent(new Event('mailRefresh'))
      await fetchUnreadCounts()
      setLabelPageKey(prev => prev + 1)
    } catch (err) { console.error(err) }
    closeLabelMenu()
  }

  const handleOpenLabelInNewTab = (labelName: string) => {
    window.open(`/labels/${encodeURIComponent(labelName)}`, '_blank')
    closeLabelMenu()
  }

  const computeLabelFullPath = (labels: LabelNode[], targetId: number, ancestors: string[] = []): string | null => {
    for (const l of labels) {
      if (l.id === targetId) return [...ancestors, l.name].join(' / ')
      if (l.children) {
        const found = computeLabelFullPath(l.children, targetId, [...ancestors, l.name])
        if (found) return found
      }
    }
    return null
  }

  const findLabelById = (labels: LabelNode[], id: number): LabelNode | null => {
    for (const l of labels) {
      if (l.id === id) return l
      if (l.children) { const found = findLabelById(l.children, id); if (found) return found }
    }
    return null
  }

  const renderFolderMenuHeader = (key: string) => {
    const configs: Record<string, { icon: React.ReactNode; name: string; unread: number; total: number }> = {
      inbox:         { icon: <Inbox size={22} style={{ color: '#64b5f6' }} />, name: 'Inbox', unread: unreadCounts.inbox || 0, total: totalCounts.inbox || 0 },
      sent:          { icon: <Send size={22} style={{ color: '#4db6ac' }} />, name: 'Sent', unread: 0, total: totalCounts.sent || 0 },
      groups:        { icon: <Users size={22} style={{ color: '#9575cd' }} />, name: 'Groups', unread: unreadCounts.groups || 0, total: totalCounts.groups || 0 },
      starred:       { icon: <Star size={22} style={{ color: '#ffc107', fill: '#ffc107' }} />, name: 'Starred', unread: unreadCounts.starred || 0, total: totalCounts.starred || 0 },
      snoozed:       { icon: <Clock size={22} style={{ color: '#fb8c00' }} />, name: 'Snoozed', unread: unreadCounts.snoozed || 0, total: totalCounts.snoozed || 0 },
      drafts:        { icon: <FileText size={22} style={{ color: '#ff5722' }} />, name: 'Drafts', unread: 0, total: totalCounts.drafts || 0 },
      archive:       { icon: <Archive size={22} style={{ color: '#7986cb' }} />, name: 'Archive', unread: unreadCounts.archived || 0, total: totalCounts.archived || 0 },
      'all-mails':   { icon: <Mail size={22} style={{ color: '#1e88e5' }} />, name: 'All Mails', unread: unreadCounts.all || 0, total: totalCounts.all || 0 },
      scheduled:     { icon: <span className="active-scheduled-icon-bg" style={{ width: '22px', height: '22px', backgroundSize: '22px 22px', margin: 0 }} />, name: 'Scheduled', unread: 0, total: totalCounts.scheduled || 0 },
      reports:       { icon: <BarChart2 size={22} style={{ color: '#7b5ea7' }} />, name: 'Reports', unread: unreadCounts.reports || 0, total: totalCounts.reports || 0 },
      spam:          { icon: <AlertCircle size={22} style={{ color: '#e91e63' }} />, name: 'Spam', unread: unreadCounts.spam || 0, total: totalCounts.spam || 0 },
      delete:        { icon: <Trash2 size={22} style={{ color: '#f48fb1' }} />, name: 'Deleted', unread: unreadCounts.delete || 0, total: totalCounts.delete || 0 },
      subscription:  { icon: <Bell size={22} style={{ color: '#039be5' }} />, name: 'Manage Subscription', unread: 0, total: 0 },
      'manage-labels': { icon: <Settings size={22} style={{ color: '#78909c' }} />, name: 'Manage Labels', unread: 0, total: 0 },
    }
    const cfg = configs[key]
    if (!cfg) return null
    return (
      <>
        <div className="label-menu-header">
          {cfg.icon}
          <span style={{ fontWeight: 600, fontSize: '17px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{cfg.name}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', flexShrink: 0 }}>
            {cfg.unread > 0 && <span className="label-menu-unread-pill">{cfg.unread}</span>}
            {!['subscription', 'manage-labels'].includes(key) && <span className="label-menu-total-pill">{cfg.total}</span>}
          </span>
        </div>
        <div className="label-menu-divider" />
      </>
    )
  }

  // Recursive function to render label tree
  // Collect all expanded labels for collapsed sidebar vertical display
  const getExpandedLabelsList = (labels: LabelNode[], result: LabelNode[] = []): LabelNode[] => {
    labels.forEach(label => {
      result.push(label)
      if (label.children && expandedLabelGroups.has(label.id)) {
        getExpandedLabelsList(label.children, result)
      }
    })
    return result
  }

  // Recursively sum total and unread counts for a label and all its descendants
  const getAggregateCounts = (label: LabelNode): { total: number; unread: number } => {
    const own = {
      total: totalCounts[`label-${label.id}`] || 0,
      unread: unreadCounts[`label-${label.id}`] || 0,
    }
    if (!label.children || label.children.length === 0) return own
    const childAgg = label.children.reduce(
      (acc, child) => {
        const c = getAggregateCounts(child)
        return { total: acc.total + c.total, unread: acc.unread + c.unread }
      },
      { total: 0, unread: 0 }
    )
    return { total: own.total + childAgg.total, unread: own.unread + childAgg.unread }
  }

  // Same but excludes sent/scheduled/drafts — used for mark-read/unread button logic
  const getMarkableAggregateCounts = (label: LabelNode): { total: number; unread: number } => {
    const own = {
      total: markableTotalCounts[`label-${label.id}`] || 0,
      unread: markableUnreadCounts[`label-${label.id}`] || 0,
    }
    if (!label.children || label.children.length === 0) return own
    const childAgg = label.children.reduce(
      (acc, child) => {
        const c = getMarkableAggregateCounts(child)
        return { total: acc.total + c.total, unread: acc.unread + c.unread }
      },
      { total: 0, unread: 0 }
    )
    return { total: own.total + childAgg.total, unread: own.unread + childAgg.unread }
  }

  const flatLabelsForDropdown = (lbls: any[], prefix = ''): any[] => {
    return lbls.flatMap(label => [
      { id: label.id, name: prefix ? `${prefix} / ${label.name}` : label.name, color: label.color, hasChildren: !!(label.children && label.children.length > 0) },
      ...(label.children ? flatLabelsForDropdown(label.children, prefix ? `${prefix} / ${label.name}` : label.name) : [])
    ])
  }

  // Builds a flat tree list with depth, parentId, and disabled flag
  const flatLabelsForDropdownTree = (lbls: LabelNode[], disableId: number | null = null): Array<{id: number, name: string, color: string, hasChildren: boolean, depth: number, disabled: boolean, parentId: number | null}> => {
    const disabledSet = new Set<number>()
    if (disableId !== null) {
      const collectAll = (nodes: LabelNode[]) => nodes.forEach(n => { disabledSet.add(n.id); if (n.children) collectAll(n.children) })
      const findAndCollect = (nodes: LabelNode[]): boolean => {
        for (const n of nodes) {
          if (n.id === disableId) { collectAll([n]); return true }
          if (n.children && findAndCollect(n.children)) return true
        }
        return false
      }
      findAndCollect(lbls)
    }
    const flatten = (nodes: LabelNode[], d: number, pid: number | null): Array<{id: number, name: string, color: string, hasChildren: boolean, depth: number, disabled: boolean, parentId: number | null}> =>
      nodes.flatMap(n => [
        { id: n.id, name: n.name, color: n.color, hasChildren: !!(n.children?.length), depth: d, disabled: disabledSet.has(n.id), parentId: pid },
        ...(n.children ? flatten(n.children, d + 1, n.id) : [])
      ])
    return flatten(lbls, 0, null)
  }

  const isSubLabelVisible = (item: {parentId: number | null}, allItems: Array<{id: number, parentId: number | null}>): boolean => {
    if (item.parentId === null) return true
    if (!expandedSubLabels.has(item.parentId)) return false
    const parent = allItems.find(l => l.id === item.parentId)
    return parent ? isSubLabelVisible(parent, allItems) : true
  }

  // Helper function to check if label or any descendants have unread emails
  const hasUnreadDescendants = (label: LabelNode): boolean => {
    if ((unreadCounts[`label-${label.id}`] || 0) > 0) return true
    if (label.children && label.children.length > 0) {
      return label.children.some((child: LabelNode) => hasUnreadDescendants(child))
    }
    return false
  }

  const renderLabelNode = (label: LabelNode, depth: number, pathNames: string[] = []): React.ReactNode => {
    const currentPath = [...pathNames, label.name]
    const displayName = currentPath.join(' / ')
    const hasChildren = label.children && label.children.length > 0
    const indent = '  '.repeat(depth)
    const labelKey = `label-${label.id}`
    const unreadCount = unreadCounts[labelKey] || 0
    const isLabelActive = activeSidebarSection === `label-${label.id}` || openLabelMenu === label.id
    console.log(`${indent}Rendering label: "${label.name}" (id: ${label.id}, key: ${labelKey}, unreadCount: ${unreadCount})`, {label, unreadCounts})

    // In collapsed sidebar, only show labels that are expanded (or top-level labels)
    // Collapsed sidebar: render only icon in vertical line
    if (sidebarCollapsed) {
      return (
        <div key={label.id}>
          <button
            className={`sidebar-item custom-label ${isLabelActive ? 'active' : ''}`}
            title={displayName}
            onClick={() => handleLabelClick(label, pathNames.join(' / '), hasChildren && !expandedLabelGroups.has(label.id))}
            style={{ color: label.color, padding: '8px', justifyContent: 'center' }}
          >
            {hasChildren ? (
              expandedLabelGroups.has(label.id) ? (
                <FolderOpen size={22} className="label-icon label-folder-open" style={{ color: isLabelActive ? 'white' : label.color, stroke: isLabelActive ? 'white' : label.color, fill: isLabelActive ? label.color : 'none' }} />
              ) : (
                <Folder size={22} className="label-icon label-folder-closed" style={{ color: isLabelActive ? 'white' : label.color, stroke: isLabelActive ? 'white' : label.color, fill: isLabelActive ? label.color : 'none' }} />
              )
            ) : (
              <Tag size={22} className="label-icon" style={{ color: isLabelActive ? 'white' : label.color, stroke: isLabelActive ? 'white' : label.color, fill: isLabelActive ? label.color : 'none' }} />
            )}
            {hasUnreadDescendants(label) && <span className="unread-badge"></span>}
          </button>
          {/* Recursively render children if expanded - synchronized with regular mode */}
          {hasChildren && expandedLabelGroups.has(label.id) && (
            <div>
              {label.children!.map(child => renderLabelNode(child, depth + 1, currentPath))}
            </div>
          )}
        </div>
      )
    }

    // Regular sidebar: render with hierarchy
    return (
      <div key={label.id}>
        <div className="sidebar-label-item-wrapper" style={{ marginLeft: `${14 + depth * 12}px` }}>
          {/* Toggle Button - Only show if children exist */}
          {hasChildren && (
            <button
              className={`label-toggle-btn${expandedLabelGroups.has(label.id) ? ' expanded' : ''}`}
              onClick={(e) => handleToggleLabelGroup(label.id, e)}
              title={expandedLabelGroups.has(label.id) ? 'Collapse' : 'Expand'}
              style={{ color: expandedLabelGroups.has(label.id) ? label.color : undefined }}
            >
              {expandedLabelGroups.has(label.id) ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          )}
          <button
            className={`sidebar-item custom-label ${isLabelActive ? 'active' : ''}`}
            title={displayName}
            onClick={() => handleLabelClick(label, pathNames.join(' / '), hasChildren && !expandedLabelGroups.has(label.id))}
            style={{ color: label.color }}
          >
            {hasChildren ? (
              expandedLabelGroups.has(label.id) ? (
                <FolderOpen size={22} className="label-icon label-folder-open" style={{ color: isLabelActive ? 'white' : label.color, stroke: isLabelActive ? 'white' : label.color, fill: isLabelActive ? label.color : 'none' }} />
              ) : (
                <Folder size={22} className="label-icon label-folder-closed" style={{ color: isLabelActive ? 'white' : label.color, stroke: isLabelActive ? 'white' : label.color, fill: isLabelActive ? label.color : 'none' }} />
              )
            ) : (
              <Tag size={22} className="label-icon" style={{ color: isLabelActive ? 'white' : label.color, stroke: isLabelActive ? 'white' : label.color, fill: isLabelActive ? label.color : 'none' }} />
            )}
            <span>{label.name}</span>
            <div className="count-container">
              {(() => {
                const isCollapsed = hasChildren && !expandedLabelGroups.has(label.id)
                const counts = isCollapsed
                  ? getAggregateCounts(label)
                  : { total: totalCounts[`label-${label.id}`] || 0, unread: unreadCounts[`label-${label.id}`] || 0 }
                return (
                  <>
                    {counts.unread > 0 && <span className="unread-badge">{counts.unread}</span>}
                    {counts.total > 0 && <span className="total-count">{counts.total}</span>}
                  </>
                )
              })()}
            </div>
          </button>
          <div className={`label-actions${openLabelMenu === label.id ? ' menu-open' : ''}`}>
            <button
              className="label-more-btn"
              onClick={(e) => {
                e.stopPropagation()
                if (openLabelMenu === label.id) {
                  closeLabelMenu()
                } else {
                  setOpenFolderMenu(null); setFolderMenuPos(null)
                  window.dispatchEvent(new Event('sidebarMenuOpened'))
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const dropdownHeight = 600
                  const spaceBelow = window.innerHeight - rect.top
                  const top = spaceBelow >= dropdownHeight ? rect.top : Math.max(8, window.innerHeight - dropdownHeight - 8)
                  setLabelMenuPos({ top, left: rect.right + 4 })
                  setOpenLabelMenu(label.id)
                  setColorPickerLabelId(null)
                  handleSidebarSection(`label-${label.id}`)
                  navigate(`/labels/${encodeURIComponent(displayName)}`)
                }
              }}
              title="More options"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
        {/* Recursively render children if expanded */}
        {hasChildren && expandedLabelGroups.has(label.id) && (
          <div className="label-children-container">
            {label.children!.map(child => renderLabelNode(child, depth + 1, currentPath))}
          </div>
        )}
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <>
    <div className={`app-container ${window.name === 'compose_window' ? 'popout-mode' : ''}`}>
      {token && (
        <header className="app-header">
          <div className="header-left">
            <h1>📧 Mail</h1>
          </div>
          <div className="header-right">
            <button className="header-icon-btn" title="Contacts" onClick={handleContactsClick}>
              <Users size={18} />
            </button>
            <button className={`header-icon-btn ${activeApp === 'files' ? 'active' : ''}`} title="Files" onClick={() => { setActiveApp('files'); setMenuButtonClicked(true); setSidebarCollapsed(false); }}>
              <Folder size={18} />
            </button>
            <button className="header-icon-btn" title="Notifications" onClick={() => {}}>
              <Bell size={18} />
            </button>
            <button className="header-icon-btn" title="Send Feedback" onClick={() => setShowFeedback(true)}>
              <MessageSquare size={18} />
            </button>
            {userEmail === 'ypaself@gmail.com' && (
              <button className="header-icon-btn" title="Admin Dashboard" onClick={() => navigate('/admin')} style={{ color: location.pathname === '/admin' ? '#1a73e8' : undefined }}>
                <ShieldCheck size={18} />
              </button>
            )}
            <button className="header-icon-btn" title="Settings" onClick={() => {}}>
              <Settings size={18} />
            </button>
            <button className="header-icon-btn" title="Profile" onClick={() => {}}>
              <User size={18} />
            </button>
            <span>{userEmail}</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </header>
      )}

      {token && !['/conference', '/chat', '/office'].includes(location.pathname) && (
        <div className="app-bar">
          <button className={`app-bar-btn ${activeApp === 'mail' ? 'active' : ''}`} title="Mail" onClick={handleMailBtnClick}>
            <Mail size={20} />
          </button>
          <button className={`app-bar-btn ${activeApp === 'calendar' ? 'active' : ''}`} title="Calendar" onClick={handleCalendarBtnClick}>
            <Calendar size={20} />
          </button>
          <button className={`app-bar-btn ${activeApp === 'contacts' ? 'active' : ''}`} title="Contacts" onClick={handleContactsClick}>
            <Users size={20} />
          </button>
          <button className={`app-bar-btn ${activeApp === 'groups' ? 'active' : ''}`} title="Groups" onClick={handleGroupsClick}>
            <Layers size={20} />
          </button>
          <button className={`app-bar-btn ${activeApp === 'files' ? 'active' : ''}`} title="Files" onClick={() => { setActiveApp('files'); setMenuButtonClicked(true); setSidebarCollapsed(false); }}>
            <Folder size={20} />
          </button>
          <button className="app-bar-btn" title="Conference" onClick={handleConferenceClick}>
            <Video size={20} />
          </button>
          <button className="app-bar-btn" title="Chat" onClick={handleChatClick}>
            <MessageSquare size={20} />
          </button>
          <button className="app-bar-btn" title="Notes" onClick={() => handleNotesClick()}>
            <StickyNote size={20} />
          </button>
          <button className="app-bar-btn" title="Word" onClick={() => handleWordClick()}>
            <FileText size={20} />
          </button>
          <button className="app-bar-btn" title="PDF" onClick={() => handlePdfClick()}>
            <FileJson size={20} />
          </button>
          <button className="app-bar-btn" title="Excel" onClick={() => handleExcelClick()}>
            <Sheet size={20} />
          </button>
          <button className="app-bar-btn" title="Office" onClick={() => handleOfficeClick('notes')}>
            <FileCode size={20} />
          </button>
          <button className="app-bar-btn" title="More Apps">
            <MoreHorizontal size={20} />
          </button>
          <button className="app-bar-btn compose-appbar-btn" title="Compose" onClick={() => {
            sessionStorage.removeItem('chat_inputValue');
            sessionStorage.removeItem('chat_subjectValue');
            sessionStorage.removeItem('chat_toEmails');
            sessionStorage.removeItem('chat_toInput');
            sessionStorage.removeItem('chat_ccEmails');
            sessionStorage.removeItem('chat_bccEmails');
            sessionStorage.removeItem('chat_ccInput');
            sessionStorage.removeItem('chat_bccInput');
            sessionStorage.removeItem('chat_draftId');
            sessionStorage.removeItem('chat_replyEmailCard');
            sessionStorage.removeItem('chat_selectedConversation');
            sessionStorage.removeItem('chat_viewMode');
            setActiveApp('mail'); setChatMailCompose(true); window.dispatchEvent(new Event('openChatMailCompose')); navigate('/chatmail') }}>
            <Edit3 size={20} />
          </button>
        </div>
      )}

      <main className="app-main">
        {/* Login and special pages - shown when not logged in or on special routes */}
        {!token || ['/login', '/reset', '/conference', '/chat', '/office'].includes(location.pathname) ? (
          <Routes>
            <Route path="/" element={<Navigate to={token ? '/chatmail' : '/login'} />} />
            <Route path="/login" element={<LoginPage onLogin={handleLogin} onForgotPassword={handleForgotPassword} />} />
            <Route path="/reset" element={<ResetPasswordPage email={resetEmail} resetToken={resetToken} onReset={handlePasswordReset} onCancel={() => { navigate('/login'); setResetEmail(''); setResetToken(''); }} />} />
            <Route path="/conference" element={<ConferencePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/office" element={<OfficePage />} />
            <Route path="*" element={<Navigate to={token ? '/chatmail' : '/login'} />} />
          </Routes>
        ) : null}

        {token && location.pathname === '/admin' && (
          <AdminPage token={token} />
        )}

        {/* Sidebar and content layout - only show when logged in and not on special pages */}
        {token && !['/conference', '/chat', '/office', '/login', '/reset'].includes(location.pathname) && (
          <>
            <div className="top-main">
              <div className="menu-section">
                <button
                  className="menu-btn"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  ☰
                </button>
              </div>
              <div className="search-box-wrapper">
                <div className="search-box-container">
                  <Search size={18} className="search-icon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="search-input"
                    placeholder="Search mail..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="clear-search-btn"
                      onClick={() => setSearchQuery('')}
                      title="Clear search"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <button
                    className={`search-filter-btn ${Object.values(searchFilters).some(v => (typeof v === 'string' ? v !== '' : v)) ? 'active' : ''}`}
                    onClick={() => setShowSearchOptions(!showSearchOptions)}
                    title="Advanced search"
                  >
                    <Sliders size={18} />
                  </button>
                </div>

                {showSearchOptions && (
                  <div className="search-options-panel">
                  <div className="search-options-grid">
                    <div className="search-field">
                      <label>From</label>
                      <input
                        type="text"
                        value={searchFilters.from}
                        onChange={(e) => setSearchFilters({...searchFilters, from: e.target.value})}
                        placeholder="Sender email"
                      />
                    </div>
                    <div className="search-field">
                      <label>To</label>
                      <input
                        type="text"
                        value={searchFilters.to}
                        onChange={(e) => setSearchFilters({...searchFilters, to: e.target.value})}
                        placeholder="Recipient email"
                      />
                    </div>

                    <div className="search-field">
                      <label>CC</label>
                      <input
                        type="text"
                        value={searchFilters.cc}
                        onChange={(e) => setSearchFilters({...searchFilters, cc: e.target.value})}
                        placeholder="CC email"
                      />
                    </div>
                    <div className="search-field">
                      <label>BCC</label>
                      <input
                        type="text"
                        value={searchFilters.bcc}
                        onChange={(e) => setSearchFilters({...searchFilters, bcc: e.target.value})}
                        placeholder="BCC email"
                      />
                    </div>

                    <div className="search-field">
                      <label>Subject</label>
                      <input
                        type="text"
                        value={searchFilters.subject}
                        onChange={(e) => setSearchFilters({...searchFilters, subject: e.target.value})}
                        placeholder="Subject keywords"
                      />
                    </div>
                    <div className="search-field">
                      <label>Keywords</label>
                      <input
                        type="text"
                        value={searchFilters.keywords}
                        onChange={(e) => setSearchFilters({...searchFilters, keywords: e.target.value})}
                        placeholder="Body keywords"
                      />
                    </div>

                    <div className="search-field">
                      <label>From Date</label>
                      <input
                        type="date"
                        value={searchFilters.dateFrom}
                        onChange={(e) => setSearchFilters({...searchFilters, dateFrom: e.target.value})}
                      />
                    </div>
                    <div className="search-field">
                      <label>To Date</label>
                      <input
                        type="date"
                        value={searchFilters.dateTo}
                        onChange={(e) => setSearchFilters({...searchFilters, dateTo: e.target.value})}
                      />
                    </div>

                    <div className="search-field">
                      <label>
                        <input
                          type="checkbox"
                          checked={searchFilters.hasAttachment}
                          onChange={(e) => setSearchFilters({...searchFilters, hasAttachment: e.target.checked})}
                        />
                        Has Attachment
                      </label>
                    </div>
                    <div className="search-field">
                      <label>Read Status</label>
                      <select
                        value={searchFilters.readStatus}
                        onChange={(e) => setSearchFilters({...searchFilters, readStatus: e.target.value as 'all' | 'read' | 'unread'})}
                      >
                        <option value="all">All</option>
                        <option value="read">Read</option>
                        <option value="unread">Unread</option>
                      </select>
                    </div>

                    <div className="search-field">
                      <label>Category</label>
                      <div
                        ref={categoryDropdownRef}
                        data-category-dropdown="true"
                        style={{ position: 'relative' }}
                      >
                        <button
                          className="category-dropdown-btn"
                          onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                            fontFamily: 'inherit',
                            backgroundColor: '#f9f9f9',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'border-color 0.2s ease'
                          }}
                        >
                          {searchFilters.category === 'inbox' ? <Inbox size={18} /> :
                           searchFilters.category === 'sent' ? <Send size={18} /> :
                           searchFilters.category === 'starred' ? <Star size={18} /> :
                           searchFilters.category === 'snoozed' ? <Clock size={18} /> :
                           searchFilters.category === 'drafts' ? <FileText size={18} /> :
                           searchFilters.category === 'archive' ? <Archive size={18} /> :
                           searchFilters.category === 'spam' ? <AlertCircle size={18} /> :
                           searchFilters.category === 'delete' ? <Trash2 size={18} /> :
                           searchFilters.category === 'purchases' ? <ShoppingBag size={18} /> :
                           searchFilters.category === 'all-mails' ? <Mail size={18} /> :
                           searchFilters.category === 'scheduled' ? <span className="active-scheduled-icon-bg" style={{ width: '18px', height: '18px', backgroundSize: '18px 18px', margin: 0 }} /> :
                           searchFilters.category === 'important' ? <Flag size={18} /> :
                           searchFilters.category === 'subscriptions' ? <Bell size={18} /> :
                           searchFilters.category.startsWith('label:') && customLabels.find(l => `label:${l.name}` === searchFilters.category) && (
                            <span style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: customLabels.find(l => `label:${l.name}` === searchFilters.category)?.color || '#999',
                              flexShrink: 0
                            }}></span>
                          ) || null}
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {searchFilters.category === '' ? 'All Categories' :
                             searchFilters.category === 'inbox' ? 'Inbox' + (activeSidebarSection === 'inbox' ? ' (Current)' : '') :
                             searchFilters.category === 'sent' ? 'Sent' + (activeSidebarSection === 'sent' ? ' (Current)' : '') :
                             searchFilters.category === 'starred' ? 'Starred' + (activeSidebarSection === 'starred' ? ' (Current)' : '') :
                             searchFilters.category === 'snoozed' ? 'Snoozed' + (activeSidebarSection === 'snoozed' ? ' (Current)' : '') :
                             searchFilters.category === 'drafts' ? 'Drafts' + (activeSidebarSection === 'drafts' ? ' (Current)' : '') :
                             searchFilters.category === 'archive' ? 'Archived' + (activeSidebarSection === 'archive' ? ' (Current)' : '') :
                             searchFilters.category === 'spam' ? 'Spam' + (activeSidebarSection === 'spam' ? ' (Current)' : '') :
                             searchFilters.category === 'delete' ? 'Deleted' + (activeSidebarSection === 'delete' ? ' (Current)' : '') :
                             searchFilters.category === 'purchases' ? 'Purchases' + (activeSidebarSection === 'purchases' ? ' (Current)' : '') :
                             searchFilters.category === 'all-mails' ? 'All Mails' + (activeSidebarSection === 'all-mails' ? ' (Current)' : '') :
                             searchFilters.category === 'scheduled' ? 'Scheduled' + (activeSidebarSection === 'scheduled' ? ' (Current)' : '') :
                             searchFilters.category === 'reports' ? 'Reports' + (activeSidebarSection === 'reports' ? ' (Current)' : '') :
                             searchFilters.category === 'subscriptions' ? 'Subscriptions' + (activeSidebarSection === 'subscriptions' ? ' (Current)' : '') :
                             searchFilters.category.startsWith('label:') ? searchFilters.category.substring(6) : 'All Categories'}
                          </span>
                          <ChevronDown
                            size={16}
                            style={{
                              flexShrink: 0,
                              transition: 'transform 0.2s ease',
                              transform: showCategoryDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                              color: '#666'
                            }}
                          />
                        </button>

                        {showCategoryDropdown && (
                          <div className="category-dropdown-menu">
                            <div
                              className="category-option"
                              onClick={() => {
                                setSearchFilters({...searchFilters, category: ''})
                                setShowCategoryDropdown(false)
                              }}
                              style={{
                                backgroundColor: searchFilters.category === '' ? '#e8f0fe' : 'white',
                                fontWeight: searchFilters.category === '' ? 'bold' : 'normal'
                              }}
                            >
                              All Categories
                            </div>

                            <div style={{ borderTop: '1px solid #e0e0e0', margin: '4px 0' }}></div>

                            <div
                              className="category-option"
                              onClick={() => {
                                setSearchFilters({...searchFilters, category: 'inbox'})
                                setShowCategoryDropdown(false)
                              }}
                              style={{
                                backgroundColor: searchFilters.category === 'inbox' ? '#e8f0fe' : 'white',
                                fontWeight: activeSidebarSection === 'inbox' ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <Inbox size={18} />
                              <span>Inbox {activeSidebarSection === 'inbox' ? '(Current)' : ''}</span>
                            </div>
                            <div
                              className="category-option"
                              onClick={() => {
                                setSearchFilters({...searchFilters, category: 'sent'})
                                setShowCategoryDropdown(false)
                              }}
                              style={{
                                backgroundColor: searchFilters.category === 'sent' ? '#e8f0fe' : 'white',
                                fontWeight: activeSidebarSection === 'sent' ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <Send size={18} />
                              <span>Sent {activeSidebarSection === 'sent' ? '(Current)' : ''}</span>
                            </div>
                            <div
                              className="category-option"
                              onClick={() => {
                                setSearchFilters({...searchFilters, category: 'starred'})
                                setShowCategoryDropdown(false)
                              }}
                              style={{
                                backgroundColor: searchFilters.category === 'starred' ? '#e8f0fe' : 'white',
                                fontWeight: activeSidebarSection === 'starred' ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <Star size={18} />
                              <span>Starred {activeSidebarSection === 'starred' ? '(Current)' : ''}</span>
                            </div>
                            <div
                              className="category-option"
                              onClick={() => {
                                setSearchFilters({...searchFilters, category: 'snoozed'})
                                setShowCategoryDropdown(false)
                              }}
                              style={{
                                backgroundColor: searchFilters.category === 'snoozed' ? '#e8f0fe' : 'white',
                                fontWeight: activeSidebarSection === 'snoozed' ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <Clock size={18} />
                              <span>Snoozed {activeSidebarSection === 'snoozed' ? '(Current)' : ''}</span>
                            </div>
                            <div
                              className="category-option"
                              onClick={() => {
                                setSearchFilters({...searchFilters, category: 'drafts'})
                                setShowCategoryDropdown(false)
                              }}
                              style={{
                                backgroundColor: searchFilters.category === 'drafts' ? '#e8f0fe' : 'white',
                                fontWeight: activeSidebarSection === 'drafts' ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <FileText size={18} />
                              <span>Drafts {activeSidebarSection === 'drafts' ? '(Current)' : ''}</span>
                            </div>
                            <div
                              className="category-option"
                              onClick={() => {
                                setSearchFilters({...searchFilters, category: 'archive'})
                                setShowCategoryDropdown(false)
                              }}
                              style={{
                                backgroundColor: searchFilters.category === 'archive' ? '#e8f0fe' : 'white',
                                fontWeight: activeSidebarSection === 'archive' ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <Archive size={18} />
                              <span>Archived {activeSidebarSection === 'archive' ? '(Current)' : ''}</span>
                            </div>
                            <div
                              className="category-option"
                              onClick={() => {
                                setSearchFilters({...searchFilters, category: 'spam'})
                                setShowCategoryDropdown(false)
                              }}
                              style={{
                                backgroundColor: searchFilters.category === 'spam' ? '#e8f0fe' : 'white',
                                fontWeight: activeSidebarSection === 'spam' ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <AlertCircle size={18} />
                              <span>Spam {activeSidebarSection === 'spam' ? '(Current)' : ''}</span>
                            </div>
                            <div
                              className="category-option"
                              onClick={() => {
                                setSearchFilters({...searchFilters, category: 'delete'})
                                setShowCategoryDropdown(false)
                              }}
                              style={{
                                backgroundColor: searchFilters.category === 'delete' ? '#e8f0fe' : 'white',
                                fontWeight: activeSidebarSection === 'delete' ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <Trash2 size={18} />
                              <span>Deleted {activeSidebarSection === 'delete' ? '(Current)' : ''}</span>
                            </div>
                            <div
                              className="category-option"
                              onClick={() => {
                                setSearchFilters({...searchFilters, category: 'purchases'})
                                setShowCategoryDropdown(false)
                              }}
                              style={{
                                backgroundColor: searchFilters.category === 'purchases' ? '#e8f0fe' : 'white',
                                fontWeight: activeSidebarSection === 'purchases' ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <ShoppingBag size={18} />
                              <span>Purchases {activeSidebarSection === 'purchases' ? '(Current)' : ''}</span>
                            </div>
                            <div
                              className="category-option"
                              onClick={() => {
                                setSearchFilters({...searchFilters, category: 'all-mails'})
                                setShowCategoryDropdown(false)
                              }}
                              style={{
                                backgroundColor: searchFilters.category === 'all-mails' ? '#e8f0fe' : 'white',
                                fontWeight: activeSidebarSection === 'all-mails' ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <Mail size={18} />
                              <span>All Mails {activeSidebarSection === 'all-mails' ? '(Current)' : ''}</span>
                            </div>
                            <div
                              className="category-option"
                              onClick={() => {
                                setSearchFilters({...searchFilters, category: 'scheduled'})
                                setShowCategoryDropdown(false)
                              }}
                              style={{
                                backgroundColor: searchFilters.category === 'scheduled' ? '#e8f0fe' : 'white',
                                fontWeight: activeSidebarSection === 'scheduled' ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <span className="active-scheduled-icon-bg" style={{ width: '18px', height: '18px', backgroundSize: '18px 18px', margin: 0 }} />
                              <span>Scheduled {activeSidebarSection === 'scheduled' ? '(Current)' : ''}</span>
                            </div>
                            <div
                              className="category-option"
                              onClick={() => {
                                setSearchFilters({...searchFilters, category: 'reports'})
                                setShowCategoryDropdown(false)
                              }}
                              style={{
                                backgroundColor: searchFilters.category === 'reports' ? '#e8f0fe' : 'white',
                                fontWeight: activeSidebarSection === 'reports' ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <FileText size={18} style={{ color: '#7b5ea7' }} />
                              <span>Reports {activeSidebarSection === 'reports' ? '(Current)' : ''}</span>
                            </div>
                            <div
                              className="category-option"
                              onClick={() => {
                                setSearchFilters({...searchFilters, category: 'subscriptions'})
                                setShowCategoryDropdown(false)
                              }}
                              style={{
                                backgroundColor: searchFilters.category === 'subscriptions' ? '#e8f0fe' : 'white',
                                fontWeight: activeSidebarSection === 'subscriptions' ? 'bold' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <Bell size={18} />
                              <span>Subscriptions {activeSidebarSection === 'subscriptions' ? '(Current)' : ''}</span>
                            </div>

                            {customLabels.length > 0 && (
                              <>
                                <div style={{ borderTop: '1px solid #e0e0e0', margin: '4px 0' }}>
                                  <div style={{ padding: '4px 10px', fontSize: '0.8rem', color: '#999', fontWeight: 'bold' }}>
                                    ─── Labels ───
                                  </div>
                                </div>
                                {customLabels.map(label => {
                                  const renderLabelOption = (label: any, level: number) => {
                                    const prefix = level === 0 ? '●' : level === 1 ? '├─' : '└─'
                                    const indent = '   '.repeat(level)
                                    const labelValue = `label:${label.name}`
                                    return [
                                      <div
                                        key={label.id}
                                        className="category-option"
                                        onClick={() => {
                                          setSearchFilters({...searchFilters, category: labelValue})
                                          setShowCategoryDropdown(false)
                                        }}
                                        style={{
                                          backgroundColor: searchFilters.category === labelValue ? '#e8f0fe' : 'white',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px'
                                        }}
                                      >
                                        <span style={{ color: '#999' }}>{prefix}{indent}</span>
                                        <span
                                          style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            backgroundColor: label.color || '#999',
                                            flexShrink: 0
                                          }}
                                        ></span>
                                        <span>{label.name}</span>
                                      </div>,
                                      ...(label.children ? label.children.flatMap((child: any) => renderLabelOption(child, level + 1)) : [])
                                    ]
                                  }
                                  return renderLabelOption(label, 0)
                                })}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="search-options-footer">
                    <button
                      className="search-apply-btn"
                      onClick={() => setShowSearchOptions(false)}
                    >
                      Apply Filters
                    </button>
                    <button
                      className="search-clear-btn"
                      onClick={() => {
                        setSearchFilters({
                          from: '',
                          to: '',
                          cc: '',
                          bcc: '',
                          subject: '',
                          keywords: '',
                          hasAttachment: false,
                          dateFrom: '',
                          dateTo: '',
                          readStatus: 'all',
                          category: ''
                        })
                      }}
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              )}
              </div>

              <div className="main-action" style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden' }}>
                {(chatMailActionState.active || mailPageActionState.active) && !chatMailActionState.selectionMode && !mailPageActionState.selectionMode && (() => {
                  const viewChannel = chatMailActionState.active ? 'chatmail:action' : 'mailpage:action'
                  const viewState = chatMailActionState.active ? chatMailActionState : mailPageActionState
                  return (
                <>
                  {[
                    { icon: <BookOpen size={24} strokeWidth={1.5} />, label: 'Reader', title: viewState.immersiveMode ? 'Exit Immersive Reader' : 'Immersive Reader', accent: '#4db6ac', active: viewState.immersiveMode, onClick: () => window.dispatchEvent(new CustomEvent(viewChannel, { detail: { action: 'toggleImmersive' } })) },
                    { icon: <SlidersHorizontal size={24} strokeWidth={1.5} />, label: 'Filter', title: 'Filter messages', accent: '#666', active: false, onClick: () => {} },
                    { icon: <CornerRightDown size={24} strokeWidth={1.5} />, label: 'Jump to', title: 'Jump to message', accent: '#666', active: false, onClick: () => {} },
                    { icon: <ListFilter size={24} strokeWidth={1.5} />, label: 'Sort by', title: 'Category / Sort by', accent: '#666', active: false, onClick: () => {} },
                  ].map(({ icon, label, title, accent, active, onClick }) => {
                    const btnProps = mainActionBtnProps(accent, active, false)
                    return (
                      <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                        <button className="top-btn" title={title} {...btnProps} onClick={onClick}>{icon}</button>
                        <span style={{ fontSize: '9px', lineHeight: 1, whiteSpace: 'nowrap', fontWeight: 300, color: active ? accent : '#666' }}>{label}</span>
                      </div>
                    )
                  })}
                  {(() => {
                    const btnProps = mainActionBtnProps('#666', chatMailZoomOpen, false)
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                        <button
                          className="top-btn"
                          title={`Zoom — ${viewState.zoomLevel}%`}
                          {...btnProps}
                          onClick={(e) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setChatMailZoomPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right }); setChatMailZoomOpen(v => !v) }}
                        >
                          <ZoomIn size={24} strokeWidth={1.5} />
                        </button>
                        <span style={{ fontSize: '9px', lineHeight: 1, whiteSpace: 'nowrap', fontWeight: 300, color: chatMailZoomOpen ? '#666' : '#666' }}>Zoom</span>
                      </div>
                    )
                  })()}
                  {chatMailZoomOpen && chatMailZoomPos && createPortal(
                    <div style={{ position: 'fixed', top: chatMailZoomPos.top, right: chatMailZoomPos.right, background: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 99999, overflow: 'hidden', minWidth: '100px' }} onClick={(e) => e.stopPropagation()}>
                      {[80, 90, 100, 110, 125].map(lv => (
                        <button key={lv} onClick={() => { window.dispatchEvent(new CustomEvent(viewChannel, { detail: { action: 'setZoom', payload: lv } })); setChatMailZoomOpen(false) }} style={{ width: '100%', padding: '8px 14px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: lv === viewState.zoomLevel ? '#2196f3' : '#333', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f5f5'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                          {lv === viewState.zoomLevel && <Check size={12} />}
                          <span style={{ marginLeft: lv === viewState.zoomLevel ? 0 : '20px' }}>{lv}%</span>
                        </button>
                      ))}
                    </div>,
                    document.body
                  )}
                </>
                  )
                })()}
                {(chatMailActionState.selectionMode || mailPageActionState.selectionMode) && (() => {
                  const bulkChannel = chatMailActionState.selectionMode ? 'chatmail:action' : 'mailpage:action'
                  const bulkState = chatMailActionState.selectionMode ? chatMailActionState : mailPageActionState
                  const bulkHasSelection = bulkState.hasSelection
                  return (
                <>
                  <div style={{ width: '1px', height: '32px', background: '#e0e0e0', margin: '0 4px', flexShrink: 0 }} />
                  {[
                    { icon: <span style={{ position: 'relative', display: 'inline-flex' }}><MailOpen size={24} strokeWidth={1.5} /><span style={{ position: 'absolute', bottom: -2, right: -2.5, width: 9, height: 9, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={9} color="#34a853" strokeWidth={4} /></span></span>, label: 'Read', title: 'Mark all read', alreadyTitle: 'Already read', accent: '#2196f3', action: 'setRead', payload: true, forceActive: bulkHasSelection && bulkState.convAllRead, partial: bulkHasSelection && !bulkState.convAllRead && !bulkState.convAllUnread, lightActive: true },
                    { icon: <Archive size={24} strokeWidth={1.5} />, label: 'Archive', title: 'Archive all', alreadyTitle: 'Already archived', accent: '#7986cb', action: 'setArchive', payload: true, forceActive: bulkHasSelection && bulkState.convAllArchived, partial: bulkHasSelection && !bulkState.convAllArchived && !bulkState.convAllUnarchived, lightActive: false },
                    { icon: <Star size={24} strokeWidth={1.5} />, label: 'Star', title: 'Star all', alreadyTitle: 'Already starred', accent: '#ffc107', action: 'setStar', payload: true, forceActive: bulkHasSelection && bulkState.convAllStarred, partial: bulkHasSelection && !bulkState.convAllStarred && !bulkState.convAllUnstarred, lightActive: false },
                    { icon: <AlarmClock size={24} strokeWidth={1.5} />, label: 'Snooze', title: 'Snooze 24h', alreadyTitle: 'Already snoozed', accent: '#fb8c00', action: 'snooze', payload: 24, forceActive: bulkHasSelection && bulkState.convAllSnoozed, partial: bulkHasSelection && !bulkState.convAllSnoozed && !bulkState.convAllUnsnoozed, lightActive: false },
                  ].map(({ icon, label, title, alreadyTitle, accent, action, payload, forceActive, partial, lightActive }) => {
                    const noSelection = !bulkHasSelection
                    const isDisabled = noSelection || forceActive
                    // Pass `false` for the disabled-styling param when forceActive so the button
                    // stays vividly colored (active) instead of greying out — it's "untouchable"
                    // via the real disabled attribute below, not by looking faded.
                    const btnProps = mainActionBtnProps(accent, forceActive, noSelection)
                    const lightBg = forceActive && lightActive ? accent + '22' : btnProps.style.backgroundColor
                    const lightColor = forceActive && lightActive ? accent : btnProps.style.color
                    return (
                    <div key={action} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                      <button
                        className="top-btn"
                        title={noSelection ? `${title} (select messages first)` : forceActive ? alreadyTitle : partial ? `${title} (mixed)` : title}
                        disabled={isDisabled}
                        {...btnProps}
                        style={{ ...btnProps.style, backgroundColor: lightBg, color: partial ? accent : lightColor }}
                        onClick={() => { if (!isDisabled) window.dispatchEvent(new CustomEvent(bulkChannel, { detail: { action, payload } })) }}
                      >
                        {icon}
                      </button>
                      <span style={{ fontSize: '9px', lineHeight: 1, whiteSpace: 'nowrap', fontWeight: 300, color: noSelection ? '#ccc' : (forceActive || partial) ? accent : '#666' }}>{label}</span>
                    </div>
                    )
                  })}
                  {(() => {
                    const moveDisabled = !bulkHasSelection
                    const moveBtnProps = mainActionBtnProps('#78909c', chatMailMoveOpen, moveDisabled)
                    return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', position: 'relative' }}>
                    <button
                      className="top-btn"
                      title={moveDisabled ? 'Move to label (select messages first)' : 'Move to label'}
                      disabled={moveDisabled}
                      {...moveBtnProps}
                      onClick={(e) => {
                        if (moveDisabled) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        setChatMailMovePos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                        setChatMailMoveOpen(v => !v)
                      }}
                    >
                      <FolderInput size={24} strokeWidth={1.5} />
                    </button>
                    <span style={{ fontSize: '9px', lineHeight: 1, whiteSpace: 'nowrap', fontWeight: 300, color: moveDisabled ? '#ccc' : '#78909c' }}>Move</span>
                  </div>
                    )
                  })()}
                  {chatMailMoveOpen && chatMailMovePos && createPortal(
                    <div style={{ position: 'fixed', top: chatMailMovePos.top, right: chatMailMovePos.right, background: 'white', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 99999, minWidth: '150px', maxHeight: '300px', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                      {customLabels.length === 0 ? (
                        <div style={{ padding: '8px 14px', fontSize: '12px', color: '#999' }}>No labels</div>
                      ) : customLabels.slice(0, 12).map(lb => (
                        <button key={lb.id} onClick={() => { window.dispatchEvent(new CustomEvent(bulkChannel, { detail: { action: 'applyLabel', payload: lb.name } })); setChatMailMoveOpen(false) }} style={{ width: '100%', padding: '8px 14px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#333', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f5f5'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: lb.color || '#ccc', flexShrink: 0 }} />{lb.name}
                        </button>
                      ))}
                    </div>,
                    document.body
                  )}
                  {[
                    { icon: <Users size={24} strokeWidth={1.5} />, label: 'Group', title: 'Add to Group', alreadyTitle: 'Already grouped', accent: '#ab47bc', action: 'group', payload: undefined, forceActive: bulkHasSelection && bulkState.convAllGrouped, partial: bulkHasSelection && !bulkState.convAllGrouped && !bulkState.convAllUngrouped },
                    { icon: <Eraser size={24} strokeWidth={1.5} />, label: 'Empty', title: 'Empty conversation', alreadyTitle: 'Already deleted', accent: '#ef9a9a', action: 'setDeleted', payload: true, forceActive: bulkHasSelection && bulkState.convAllDeleted, partial: bulkHasSelection && !bulkState.convAllDeleted && !bulkState.convAllUndeleted },
                    { icon: <Trash2 size={24} strokeWidth={1.5} />, label: 'Delete', title: 'Delete All', alreadyTitle: 'Already deleted', accent: '#f44336', action: 'setDeleted', payload: true, forceActive: bulkHasSelection && bulkState.convAllDeleted, partial: bulkHasSelection && !bulkState.convAllDeleted && !bulkState.convAllUndeleted },
                    { icon: <AlertOctagon size={24} strokeWidth={1.5} />, label: 'Spam', title: 'Mark as Spam', alreadyTitle: 'Already spam', accent: '#e91e63', action: 'setSpam', payload: true, forceActive: bulkHasSelection && bulkState.convAllSpam, partial: bulkHasSelection && !bulkState.convAllSpam && !bulkState.convAllUnspam },
                    { icon: <span style={{ position: 'relative', display: 'inline-flex' }}><Flag size={24} strokeWidth={1.5} /><span style={{ position: 'absolute', top: -2, right: -3, width: 11, height: 11, borderRadius: '50%', backgroundColor: '#f57c00', color: 'white', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid white' }}>!</span></span>, label: 'Report', title: 'Report', alreadyTitle: 'Already reported', accent: '#f57c00', action: 'setReport', payload: true, forceActive: bulkHasSelection && bulkState.convAllReported, partial: bulkHasSelection && !bulkState.convAllReported && !bulkState.convAllUnreported },
                    { icon: <Pin size={24} strokeWidth={1.5} />, label: 'Pin', title: 'Pin conversation', alreadyTitle: 'Already pinned', accent: '#f44336', action: 'setPin', payload: true, forceActive: bulkHasSelection && bulkState.convAllPinned, partial: bulkHasSelection && !bulkState.convAllPinned && !bulkState.convAllUnpinned },
                    { icon: <Printer size={24} strokeWidth={1.5} />, label: 'Print', title: 'Print conversation', alreadyTitle: '', accent: '#90a4ae', action: 'printConv', payload: undefined, forceActive: false, partial: false },
                    { icon: <BellOff size={24} strokeWidth={1.5} />, label: 'Mute', title: 'Mute conversation', alreadyTitle: 'Already muted', accent: '#7986cb', action: 'setMute', payload: true, forceActive: bulkHasSelection && bulkState.convMuted, partial: bulkHasSelection && !bulkState.convMuted && !bulkState.convAllUnmuted },
                    { icon: <Ban size={24} strokeWidth={1.5} />, label: 'Block', title: 'Block sender', alreadyTitle: '', accent: '#e53935', action: 'setBlock', payload: true, forceActive: false, partial: false },
                  ].map(({ icon, label, title, alreadyTitle, accent, action, payload, forceActive, partial }) => {
                    const noSelection = !bulkHasSelection
                    const isDisabled = noSelection || forceActive
                    const btnProps = mainActionBtnProps(accent, forceActive, noSelection)
                    return (
                    <div key={action + label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                      <button
                        className="top-btn"
                        title={noSelection ? `${title} (select messages first)` : forceActive ? alreadyTitle : partial ? `${title} (mixed)` : title}
                        disabled={isDisabled}
                        {...btnProps}
                        style={{ ...btnProps.style, color: partial ? accent : btnProps.style.color }}
                        onClick={() => { if (!isDisabled) window.dispatchEvent(new CustomEvent(bulkChannel, { detail: { action, payload } })) }}
                      >
                        {icon}
                      </button>
                      <span style={{ fontSize: '9px', lineHeight: 1, whiteSpace: 'nowrap', fontWeight: 300, color: noSelection ? '#ccc' : (forceActive || partial) ? accent : '#666' }}>{label}</span>
                    </div>
                    )
                  })}
                </>
                  )
                })()}
                </div>

            </div>

            <div className="top-main-right-buttons">
              <button className="top-btn" title="Conference" onClick={handleConferenceClick}>
                <Video size={18} />
              </button>
              <button className="top-btn" title="Calendar" onClick={handleCalendarBtnClick}>
                <Calendar size={18} />
              </button>
              <button className="top-btn" title="Notes" onClick={() => handleNotesClick()}>
                <FileText size={18} />
              </button>
              <button className="top-btn" title="Task" onClick={() => {}}>
                <Flag size={18} />
              </button>
            </div>

            {activeApp === 'mail' && (
            <div
              className={`left-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
              onMouseEnter={() => {
                if (sidebarCollapsed) {
                  setSidebarCollapsed(false)
                  setSidebarHoverExpanded(true)
                }
              }}
              onMouseLeave={() => {
                if (sidebarHoverExpanded) {
                  setSidebarCollapsed(true)
                  setSidebarHoverExpanded(false)
                }
              }}
            >
              <div className="compose-btn-container">
                <button className="compose-btn" onClick={() => {
                  sessionStorage.removeItem('chat_inputValue');
                  sessionStorage.removeItem('chat_subjectValue');
                  sessionStorage.removeItem('chat_toEmails');
                  sessionStorage.removeItem('chat_toInput');
                  sessionStorage.removeItem('chat_ccEmails');
                  sessionStorage.removeItem('chat_bccEmails');
                  sessionStorage.removeItem('chat_ccInput');
                  sessionStorage.removeItem('chat_bccInput');
                  sessionStorage.removeItem('chat_draftId');
                  sessionStorage.removeItem('chat_replyEmailCard');
                  sessionStorage.removeItem('chat_selectedConversation');
                  sessionStorage.removeItem('chat_viewMode');
                  setActiveApp('mail'); setChatMailCompose(true); window.dispatchEvent(new Event('openChatMailCompose')); navigate('/chatmail') }}>
                  <Edit3 size={20} />
                  <span>Compose</span>
                </button>
                {(() => {
                  const isChatMailActive = (location.pathname === '/chatmail' && !chatMailCompose && folderViewMode === 'list') || location.pathname === '/groups'
                  return (
                    <>
                      <button className={`chatmail-btn ${isChatMailActive ? 'active' : ''}`} onClick={() => {
                        setFolderViewMode('list')
                        sessionStorage.setItem('chat_persistedListTab', 'all')
                        window.dispatchEvent(new CustomEvent('chatmail:setListTab', { detail: 'all' }))
                        handleSidebarSection('');
                        // Clear stale compose session before dispatching reset — if ChatMailPage is
                        // unmounted (user is on a different route) the event has no listener, so
                        // sessionStorage must already be clean when the component remounts.
                        ;['chat_viewMode','chat_selectedConversation','chat_inputValue','chat_subjectValue',
                          'chat_toEmails','chat_toInput','chat_ccEmails','chat_ccInput','chat_bccEmails',
                          'chat_bccInput','chat_showCc','chat_showBcc','chat_draftId','chat_attachments',
                          'chat_replyEmailCard'].forEach(k => sessionStorage.removeItem(k))
                        window.dispatchEvent(new Event('resetChatMail'));
                        navigate('/chatmail');
                      }} title="Chat Mail">
                        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <MessageSquare size={20} strokeWidth={1.5} />
                          <span className="chatmail-mail-icon chatmail-mail-gap"><Mail size={13} stroke="white" strokeWidth={2.5} /></span>
                          <span className="chatmail-mail-icon"><Mail size={13} strokeWidth={1.5} /></span>
                        </span>
                        <span>Chat Mail</span>
                      </button>
                      <button
                        className="chatmail-view-switch-btn"
                        disabled={isChatMailActive}
                        style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', padding: '4px 10px', border: '1px solid #ddd', borderRadius: '14px', background: isChatMailActive ? '#f5f5f5' : 'white', cursor: isChatMailActive ? 'not-allowed' : 'pointer', fontSize: '12px', color: isChatMailActive ? '#bbb' : '#666', opacity: isChatMailActive ? 0.6 : 1 }}
                        onClick={() => {
                          if (isChatMailActive) return
                          const nextMode = folderViewMode === 'list' ? 'chatmail' : 'list'
                          const currentKey = getCurrentFolderKey()
                          setFolderViewMode(nextMode)
                          if (nextMode === 'chatmail') goToChatMailTab(currentKey)
                          else goToFolderListMode(currentKey)
                        }}
                        title={location.pathname === '/groups' ? 'Not available for Groups' : isChatMailActive ? 'Select a folder or label first' : folderViewMode === 'list' ? 'Open folders & labels in Chat Mail view' : 'Open folders & labels in normal List view'}
                      >
                        {folderViewMode === 'list' ? <MessageSquare size={14} /> : <List size={14} />}
                        <ArrowLeftRight size={12} />
                        <span>{folderViewMode === 'list' ? 'Chat' : 'List'}</span>
                      </button>
                    </>
                  )
                })()}
              </div>

              <div className="sidebar-menu">
              {/* Main Navigation Section */}
              <div className="sidebar-section">
                <div className="sidebar-folder-wrapper">
                  <button className={`sidebar-item inbox ${activeSidebarSection === 'inbox' || openFolderMenu === 'inbox' ? 'active' : ''}`} title="Inbox" onClick={handleInboxClick}>
                    <Inbox size={22} style={{ color: '#64b5f6' }} />
                    <span>Inbox</span>
                    <div className="count-container">
                      {unreadCounts.inbox > 0 && <span className="unread-badge">{unreadCounts.inbox}</span>}
                      {totalCounts.inbox > 0 && <span className="total-count">{totalCounts.inbox}</span>}
                    </div>
                  </button>
                  <div className={`folder-actions${openFolderMenu === 'inbox' ? ' menu-open' : ''}`}>
                    <button className="folder-more-btn" onClick={(e) => openFolderMenuAt(e, 'inbox')} title="More options"><MoreHorizontal size={18} /></button>
                  </div>
                </div>
                <div className="sidebar-folder-wrapper">
                  <button className={`sidebar-item sent ${activeSidebarSection === 'sent' || openFolderMenu === 'sent' ? 'active' : ''}`} title="Sent" onClick={handleSentClick}>
                    <span className="sent-icon-bg" />
                    <span>Sent</span>
                    <div className="count-container">
                      {totalCounts.sent > 0 && <span className="total-count">{totalCounts.sent}</span>}
                    </div>
                  </button>
                  <div className={`folder-actions${openFolderMenu === 'sent' ? ' menu-open' : ''}`}>
                    <button className="folder-more-btn" onClick={(e) => { openFolderMenuAt(e, 'sent') }} title="More options"><MoreHorizontal size={18} /></button>
                  </div>
                </div>
                <div className="sidebar-folder-wrapper">
                  <button className={`sidebar-item groups ${activeSidebarSection === 'groups' || openFolderMenu === 'groups' ? 'active' : ''}`} title="Groups" onClick={handleGroupsSidebarClick}>
                    <Users size={22} />
                    <span>Groups</span>
                    <div className="count-container">
                      {unreadCounts.groups > 0 && <span className="unread-badge">{unreadCounts.groups}</span>}
                      {totalCounts.groups > 0 && <span className="total-count">{totalCounts.groups}</span>}
                    </div>
                  </button>
                  <div className={`folder-actions${openFolderMenu === 'groups' ? ' menu-open' : ''}`}>
                    <button className="folder-more-btn" onClick={(e) => { openFolderMenuAt(e, 'groups') }} title="More options"><MoreHorizontal size={18} /></button>
                  </div>
                </div>
                <div className="sidebar-folder-wrapper">
                  <button className={`sidebar-item starred ${activeSidebarSection === 'starred' || openFolderMenu === 'starred' ? 'active' : ''}`} title="Starred" onClick={handleStarredClick}>
                    <Star size={22} style={{ color: '#ffc107' }} />
                    <span>Starred</span>
                    <div className="count-container">
                      {unreadCounts.starred > 0 && <span className="unread-badge">{unreadCounts.starred}</span>}
                      {totalCounts.starred > 0 && <span className="total-count">{totalCounts.starred}</span>}
                    </div>
                  </button>
                  <div className={`folder-actions${openFolderMenu === 'starred' ? ' menu-open' : ''}`}>
                    <button className="folder-more-btn" onClick={(e) => { openFolderMenuAt(e, 'starred') }} title="More options"><MoreHorizontal size={18} /></button>
                  </div>
                </div>
                <div className="sidebar-folder-wrapper">
                  <button className={`sidebar-item snoozed ${activeSidebarSection === 'snoozed' || openFolderMenu === 'snoozed' ? 'active' : ''}`} title="Snoozed" onClick={handleSnoozedClick}>
                    <Clock size={22} style={{ color: '#fb8c00' }} />
                    <span>Snoozed</span>
                    <div className="count-container">
                      {unreadCounts.snoozed > 0 && <span className="unread-badge">{unreadCounts.snoozed}</span>}
                      {totalCounts.snoozed > 0 && <span className="total-count">{totalCounts.snoozed}</span>}
                    </div>
                  </button>
                  <div className={`folder-actions${openFolderMenu === 'snoozed' ? ' menu-open' : ''}`}>
                    <button className="folder-more-btn" onClick={(e) => { openFolderMenuAt(e, 'snoozed') }} title="More options"><MoreHorizontal size={18} /></button>
                  </div>
                </div>
                <div className="sidebar-folder-wrapper">
                  <button className={`sidebar-item ${activeSidebarSection === 'scheduled' || openFolderMenu === 'scheduled' ? 'active' : ''}`} title="Scheduled" onClick={handleScheduledClick}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginLeft: '8px', marginRight: '8px', width: '22px' }}>
                      <span className="scheduled-icon-bg" style={{ margin: 0 }} />
                      {upcomingScheduledEmail && (
                        <div style={{ width: '16px', height: '2.5px', backgroundColor: '#b2dfdb', borderRadius: '1.5px', overflow: 'hidden', marginTop: '2px' }}>
                          <div style={{ height: '100%', animation: `schedule-progress ${Math.max(0, new Date(upcomingScheduledEmail.scheduledFor).getTime() - new Date(upcomingScheduledEmail.date).getTime())}ms linear forwards`, animationDelay: `-${Math.max(0, Date.now() - new Date(upcomingScheduledEmail.date).getTime())}ms` }} />
                        </div>
                      )}
                    </div>
                    <span>Scheduled</span>
                    <div className="count-container">
                      {upcomingScheduledCount > 0 && <span className="unread-badge scheduled-upcoming-badge" style={{ backgroundColor: '#fb8c00' }}>{upcomingScheduledCount}</span>}
                      {totalCounts.scheduled > 0 && <span className="total-count">{totalCounts.scheduled}</span>}
                    </div>
                  </button>
                  <div className={`folder-actions${openFolderMenu === 'scheduled' ? ' menu-open' : ''}`}>
                    <button className="folder-more-btn" onClick={(e) => { openFolderMenuAt(e, 'scheduled') }} title="More options"><MoreHorizontal size={18} /></button>
                  </div>
                </div>
                <div className="sidebar-folder-wrapper">
                  <button className={`sidebar-item drafts ${activeSidebarSection === 'drafts' || openFolderMenu === 'drafts' ? 'active' : ''}`} title="Drafts" onClick={handleDraftsClick}>
                    <FileText size={22} style={{ color: '#ff5722' }} />
                    <span>Drafts</span>
                    <div className="count-container">
                      {totalCounts.drafts > 0 && <span className="total-count">{totalCounts.drafts}</span>}
                    </div>
                  </button>
                  <div className={`folder-actions${openFolderMenu === 'drafts' ? ' menu-open' : ''}`}>
                    <button className="folder-more-btn" onClick={(e) => { openFolderMenuAt(e, 'drafts') }} title="More options"><MoreHorizontal size={18} /></button>
                  </div>
                </div>
                <div className="sidebar-folder-wrapper">
                  <button className={`sidebar-item archive ${activeSidebarSection === 'archive' || openFolderMenu === 'archive' ? 'active' : ''}`} title="Archive" onClick={handleArchiveClick}>
                    <Archive size={22} style={{ color: '#7986cb' }} />
                    <span>Archive</span>
                    <div className="count-container">
                      {unreadCounts.archived > 0 && <span className="unread-badge">{unreadCounts.archived}</span>}
                      {totalCounts.archived > 0 && <span className="total-count">{totalCounts.archived}</span>}
                    </div>
                  </button>
                  <div className={`folder-actions${openFolderMenu === 'archive' ? ' menu-open' : ''}`}>
                    <button className="folder-more-btn" onClick={(e) => { openFolderMenuAt(e, 'archive') }} title="More options"><MoreHorizontal size={18} /></button>
                  </div>
                </div>
              </div>

              {/* More Section Toggle */}
              <div className={`sidebar-item more-toggle ${moreExpanded ? 'expanded' : ''}`}>
                <button onClick={() => setMoreExpanded(!moreExpanded)}>
                  {moreExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <span>{moreExpanded ? 'Less' : 'More'}</span>
                </button>
              </div>

              {/* More Section - Initially Hidden */}
              <div className={`sidebar-section more-section ${moreExpanded ? 'expanded' : ''}`}>
                <div className="sidebar-folder-wrapper">
                  <button className={`sidebar-item all-mails ${activeSidebarSection === 'all-mails' || openFolderMenu === 'all-mails' ? 'active' : ''}`} title="All Mails" onClick={handleAllMailsClick}>
                    <Mail size={22} style={{ color: '#1e88e5' }} />
                    <span>All Mails</span>
                    <div className="count-container">
                      {unreadCounts.all > 0 && <span className="unread-badge">{unreadCounts.all}</span>}
                      {totalCounts.all > 0 && <span className="total-count">{totalCounts.all}</span>}
                    </div>
                  </button>
                  <div className={`folder-actions${openFolderMenu === 'all-mails' ? ' menu-open' : ''}`}>
                    <button className="folder-more-btn" onClick={(e) => { openFolderMenuAt(e, 'all-mails') }} title="More options"><MoreHorizontal size={18} /></button>
                  </div>
                </div>
                <div className="sidebar-folder-wrapper">
                  <button className={`sidebar-item reports ${activeSidebarSection === 'reports' || openFolderMenu === 'reports' ? 'active' : ''}`} title="Reports" onClick={handleReportsClick}>
                    <BarChart2 size={22} style={{ color: '#7b5ea7' }} />
                    <span>Reports</span>
                    <div className="count-container">
                      {unreadCounts.reports > 0 && <span className="unread-badge">{unreadCounts.reports}</span>}
                      {totalCounts.reports > 0 && <span className="total-count">{totalCounts.reports}</span>}
                    </div>
                  </button>
                  <div className={`folder-actions${openFolderMenu === 'reports' ? ' menu-open' : ''}`}>
                    <button className="folder-more-btn" onClick={(e) => { openFolderMenuAt(e, 'reports') }} title="More options"><MoreHorizontal size={18} /></button>
                  </div>
                </div>
                <div className="sidebar-folder-wrapper">
                  <button className={`sidebar-item spam ${activeSidebarSection === 'spam' || openFolderMenu === 'spam' ? 'active' : ''}`} title="Spam" onClick={handleSpamClick}>
                    <AlertCircle size={22} style={{ color: '#e91e63' }} />
                    <span>Spam</span>
                    <div className="count-container">
                      {unreadCounts.spam > 0 && <span className="unread-badge">{unreadCounts.spam}</span>}
                      {totalCounts.spam > 0 && <span className="total-count">{totalCounts.spam}</span>}
                    </div>
                  </button>
                  <div className={`folder-actions${openFolderMenu === 'spam' ? ' menu-open' : ''}`}>
                    <button className="folder-more-btn" onClick={(e) => { openFolderMenuAt(e, 'spam') }} title="More options"><MoreHorizontal size={18} /></button>
                  </div>
                </div>
                <div className="sidebar-folder-wrapper">
                  <button className={`sidebar-item delete ${activeSidebarSection === 'delete' || openFolderMenu === 'delete' ? 'active' : ''}`} title="Deleted" onClick={handleDeleteClick}>
                    <Trash2 size={22} style={{ color: '#f48fb1' }} />
                    <span>Deleted</span>
                    <div className="count-container">
                      {unreadCounts.delete > 0 && <span className="unread-badge">{unreadCounts.delete}</span>}
                      {totalCounts.delete > 0 && <span className="total-count">{totalCounts.delete}</span>}
                    </div>
                  </button>
                  <div className={`folder-actions${openFolderMenu === 'delete' ? ' menu-open' : ''}`}>
                    <button className="folder-more-btn" onClick={(e) => { openFolderMenuAt(e, 'delete') }} title="More options"><MoreHorizontal size={18} /></button>
                  </div>
                </div>
                <div className="sidebar-folder-wrapper">
                  <button className={`sidebar-item ${openFolderMenu === 'subscription' ? 'active' : ''}`} title="Manage Subscription" onClick={handleManageSubscriptionClick}>
                    <Bell size={22} />
                    <span>Manage Subscription</span>
                  </button>
                  <div className={`folder-actions${openFolderMenu === 'subscription' ? ' menu-open' : ''}`}>
                    <button className="folder-more-btn" onClick={(e) => { openFolderMenuAt(e, 'subscription') }} title="More options"><MoreHorizontal size={18} /></button>
                  </div>
                </div>
                <div className="sidebar-folder-wrapper">
                  <button className={`sidebar-item ${openFolderMenu === 'manage-labels' ? 'active' : ''}`} title="Manage Labels" onClick={handleManageLabelsClick}>
                    <Settings size={22} />
                    <span>Manage Labels</span>
                  </button>
                  <div className={`folder-actions${openFolderMenu === 'manage-labels' ? ' menu-open' : ''}`}>
                    <button className="folder-more-btn" onClick={(e) => { openFolderMenuAt(e, 'manage-labels') }} title="More options"><MoreHorizontal size={18} /></button>
                  </div>
                </div>
              </div>

              {/* Labels Section */}
              <div className="sidebar-section-label">
                <span>Labels</span>
                <button ref={addLabelBtnRef} className="add-btn" title="Add Label" onClick={handleAddLabelClick}><Plus size={20} /></button>
              </div>

              <div className="sidebar-section labels-section">
                {customLabels.map(label => renderLabelNode(label, 0))}
              </div>

            </div>
            </div>
            )}

            {activeApp === 'mail' && (
            <div className={`middle-bar ${!token ? 'full-width' : ''}`}>
              {/* Main ChatMailPage instance stays mounted across Inbox/Sent/etc. navigation
                  AND across opening a contact's thread view (not just swapped in for the
                  /chatmail route) so its floating compose panel — rendered via portal —
                  survives browsing anywhere else. Hidden via CSS rather than unmounted
                  whenever it isn't the active view. replyData is withheld while a contact
                  thread is open so this hidden instance doesn't also react to it. */}
              <div style={{ display: (!chatViewContact && location.pathname === '/chatmail') ? 'contents' : 'none' }}>
                <ChatMailPage token={token} userEmail={userEmail || ''} isActiveView={!chatViewContact && location.pathname === '/chatmail'} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} onEmailDeleteChange={handleEmailDeleteChange} externalDeleteUpdate={emailDeleteUpdate} composeMode={chatMailCompose} draftEmail={draftEmail} onDraftLoaded={() => setDraftEmail(null)} replyData={chatViewContact ? null : chatReplyData} onReplyDataLoaded={() => setChatReplyData(null)} composeRecipients={chatViewContact ? null : chatComposeRecipients} onComposeRecipientsLoaded={() => setChatComposeRecipients(null)} onOpenContact={(email) => { setHighlightedEmailId(null); setChatViewContact(email) }} onFloatingChange={(floating, draftId) => { registerFloatSlot(MAIN_FLOAT_SLOT, floating); registerFloatingDraft(null, floating, draftId) }} onMinimizedChange={(minimized) => registerMinimizedSlot(MAIN_FLOAT_SLOT, minimized)} hasMinimizedStrip={hasMinimizedStrip} getFloatingDraftOwner={getFloatingDraftOwner} floatSlotIndex={Math.max(0, floatSlots.indexOf(MAIN_FLOAT_SLOT))} navKey={navKey} onComposeModeExit={() => { setChatMailCompose(false); setChatReplyData(null); setDraftEmail(null) }} onClose={() => { setChatMailCompose(false); setChatReplyData(null); setDraftEmail(null); const returnPath = sessionStorage.getItem('chatMailReturnPath') || chatMailReturnPath.current || '/chatmail'; chatMailReturnPath.current = '/chatmail'; sessionStorage.removeItem('chatMailReturnPath'); navigate(returnPath); }} />
              </div>
              {/* One instance per contact that's either the active thread view or still has
                  a floating/minimized draft — keyed by contact email so React never reuses
                  one contact's instance (and its floating state) for a different contact. */}
              {Array.from(new Set([chatViewContact, ...floatingContacts].filter((c): c is string => !!c))).map(contact => (
                <div key={contact} style={{ display: contact === chatViewContact ? 'contents' : 'none' }}>
                  <ChatMailPage token={token} userEmail={userEmail || ''} contactEmail={contact} highlightedEmailId={contact === chatViewContact ? highlightedEmailId : null} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} onEmailDeleteChange={handleEmailDeleteChange} externalDeleteUpdate={emailDeleteUpdate} replyData={contact === chatViewContact ? chatReplyData : null} onReplyDataLoaded={() => setChatReplyData(null)}
                    floatSlotIndex={Math.max(0, floatSlots.indexOf(contact))}
                    navKey={navKey}
                    isActiveView={contact === chatViewContact}
                    hasMinimizedStrip={hasMinimizedStrip}
                    onOpenContact={(email) => { setHighlightedEmailId(null); setChatViewContact(email) }}
                    onMinimizedChange={(minimized) => registerMinimizedSlot(contact, minimized)}
                    onFloatingChange={(floating, draftId) => {
                      setFloatingContacts(prev => {
                        const next = new Set(prev)
                        if (floating) next.add(contact); else next.delete(contact)
                        return next
                      })
                      registerFloatSlot(contact, floating)
                      registerFloatingDraft(contact, floating, draftId)
                    }}
                    onClose={() => {
                      if (contact !== chatViewContact) return
                      setChatViewContact(null)
                      setHighlightedEmailId(null)
                      setChatReplyMessage(null)
                      setChatReplyData(null)
                      const returnPath = sessionStorage.getItem('chatMailReturnPath')
                      if (returnPath && returnPath !== '/chatmail') {
                        sessionStorage.removeItem('chatMailReturnPath')
                        navigate(returnPath)
                      }
                    }} />
                </div>
              ))}
              {!chatViewContact && (
                <>
                  {location.pathname !== '/chatmail' && (
                  <Routes>
                    <Route path="/inbox" element={<AllMailsPage token={token} hasMinimizedStrip={hasMinimizedStrip} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} type="inbox" searchQuery={searchQuery} searchFilters={searchFilters} onSearch={setSearchQuery} onRefreshCounts={fetchUnreadCounts} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} externalDeleteUpdate={emailDeleteUpdate} openedEmailId={openedEmailId} refreshSignal={labelPageKey} />} />
                    <Route path="/sent" element={<AllMailsPage token={token} hasMinimizedStrip={hasMinimizedStrip} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} type="sent" searchQuery={searchQuery} searchFilters={searchFilters} onSearch={setSearchQuery} onRefreshCounts={fetchUnreadCounts} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} externalDeleteUpdate={emailDeleteUpdate} openedEmailId={openedEmailId} refreshSignal={labelPageKey} />} />
                    <Route path="/starred" element={<AllMailsPage token={token} hasMinimizedStrip={hasMinimizedStrip} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} type="starred" searchQuery={searchQuery} searchFilters={searchFilters} onSearch={setSearchQuery} onRefreshCounts={fetchUnreadCounts} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} externalDeleteUpdate={emailDeleteUpdate} openedEmailId={openedEmailId} refreshSignal={labelPageKey} />} />
                    <Route path="/snoozed" element={<AllMailsPage token={token} hasMinimizedStrip={hasMinimizedStrip} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} type="snoozed" searchQuery={searchQuery} searchFilters={searchFilters} onSearch={setSearchQuery} onRefreshCounts={fetchUnreadCounts} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} externalDeleteUpdate={emailDeleteUpdate} openedEmailId={openedEmailId} refreshSignal={labelPageKey} />} />
                    <Route path="/drafts" element={<AllMailsPage token={token} hasMinimizedStrip={hasMinimizedStrip} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} type="drafts" searchQuery={searchQuery} searchFilters={searchFilters} onSearch={setSearchQuery} onRefreshCounts={fetchUnreadCounts} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} externalDeleteUpdate={emailDeleteUpdate} openedEmailId={openedEmailId} refreshSignal={labelPageKey} />} />
                    <Route path="/archived" element={<AllMailsPage token={token} hasMinimizedStrip={hasMinimizedStrip} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} type="archived" searchQuery={searchQuery} searchFilters={searchFilters} onSearch={setSearchQuery} onRefreshCounts={fetchUnreadCounts} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} externalDeleteUpdate={emailDeleteUpdate} openedEmailId={openedEmailId} refreshSignal={labelPageKey} />} />
                    <Route path="/groups" element={<GroupsPage token={token} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} onRefreshCounts={fetchUnreadCounts} onComposeToGroup={handleComposeToGroupViaChat} />} />
                    <Route path="/allmails" element={<AllMailsPage token={token} hasMinimizedStrip={hasMinimizedStrip} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} type="all" searchQuery={searchQuery} searchFilters={searchFilters} onSearch={setSearchQuery} onRefreshCounts={fetchUnreadCounts} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} externalDeleteUpdate={emailDeleteUpdate} openedEmailId={openedEmailId} refreshSignal={labelPageKey} />} />
                    <Route path="/scheduled" element={<AllMailsPage token={token} hasMinimizedStrip={hasMinimizedStrip} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} type="scheduled" searchQuery={searchQuery} searchFilters={searchFilters} onSearch={setSearchQuery} onRefreshCounts={fetchUnreadCounts} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} externalDeleteUpdate={emailDeleteUpdate} openedEmailId={openedEmailId} refreshSignal={labelPageKey} />} />
                    <Route path="/important" element={<AllMailsPage token={token} hasMinimizedStrip={hasMinimizedStrip} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} type="important" searchQuery={searchQuery} searchFilters={searchFilters} onSearch={setSearchQuery} onRefreshCounts={fetchUnreadCounts} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} externalDeleteUpdate={emailDeleteUpdate} openedEmailId={openedEmailId} refreshSignal={labelPageKey} />} />
                    <Route path="/reports" element={<AllMailsPage token={token} hasMinimizedStrip={hasMinimizedStrip} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} type="reports" searchQuery={searchQuery} searchFilters={searchFilters} onSearch={setSearchQuery} onRefreshCounts={fetchUnreadCounts} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} externalDeleteUpdate={emailDeleteUpdate} openedEmailId={openedEmailId} refreshSignal={labelPageKey} />} />
                    <Route path="/spam" element={<AllMailsPage token={token} hasMinimizedStrip={hasMinimizedStrip} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} type="spam" searchQuery={searchQuery} searchFilters={searchFilters} onSearch={setSearchQuery} onRefreshCounts={fetchUnreadCounts} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} externalDeleteUpdate={emailDeleteUpdate} openedEmailId={openedEmailId} refreshSignal={labelPageKey} />} />
                    <Route path="/delete" element={<AllMailsPage token={token} hasMinimizedStrip={hasMinimizedStrip} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} type="delete" searchQuery={searchQuery} searchFilters={searchFilters} onSearch={setSearchQuery} onRefreshCounts={fetchUnreadCounts} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} externalDeleteUpdate={emailDeleteUpdate} openedEmailId={openedEmailId} refreshSignal={labelPageKey} />} />
                    <Route path="/subscriptions" element={<AllMailsPage token={token} hasMinimizedStrip={hasMinimizedStrip} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} type="subscriptions" searchQuery={searchQuery} searchFilters={searchFilters} onSearch={setSearchQuery} onRefreshCounts={fetchUnreadCounts} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} externalDeleteUpdate={emailDeleteUpdate} openedEmailId={openedEmailId} refreshSignal={labelPageKey} />} />
                    <Route path="/labels/:labelName?" element={<AllMailsPage token={token} hasMinimizedStrip={hasMinimizedStrip} onViewEmail={handleViewEmail} onReply={handleOpenChatReply} type="label" searchQuery={searchQuery} searchFilters={searchFilters} onSearch={setSearchQuery} onRefreshCounts={fetchUnreadCounts} onEmailReadChange={handleEmailReadStatusChange} externalReadUpdate={emailReadUpdate} externalDeleteUpdate={emailDeleteUpdate} openedEmailId={openedEmailId} refreshSignal={labelPageKey} />} />
                    <Route path="/compose" element={<ComposePage token={token} userEmail={userEmail || ''} onSent={() => navigate('/chatmail')} onCancel={() => navigate('/chatmail')} />} />
                    <Route path="/email" element={<EmailPage token={token} selectedEmail={selectedEmail} onBack={() => navigate('/chatmail')} />} />
                    <Route path="/" element={<Navigate to="/chatmail" />} />
                  </Routes>
                  )}

                  {selectedEmail ? (
                    <EmailViewer email={selectedEmail} onBack={() => setSelectedEmail(null)} token={token} onReply={handleOpenChatReply} />
                  ) : null}
                </>
              )}
            </div>
            )}

            {/* "+N" circular badge for minimized compose strips beyond the 3 visible ones —
                those instances stay floating/mounted (content preserved), just not drawn in
                the row, since drawing 4+ side-by-side strips would overflow the middle-bar. */}
            {overflowCount > 0 && overflowBadgePos && (
              <div
                style={{
                  position: 'fixed', zIndex: 500, top: overflowBadgePos.y, left: overflowBadgePos.x,
                  width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#5f6368', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.25)', userSelect: 'none', cursor: 'default',
                }}
                title={`${overflowCount} more minimized`}
              >
                +{overflowCount}
              </div>
            )}

            {activeApp === 'mail' && token && (
              <div className="right-sidebar">
                {/* Right details/preview will go here */}
              </div>
            )}

            {/* Calendar View */}
            {activeApp === 'calendar' && (
              <div className="calendar-container">
                <div className="calendar-header">
                  <h2>Calendar</h2>
                </div>
                <div className="calendar-content">
                  <div className="calendar-sidebar">
                    <div className="mini-calendar">
                      <div className="mini-calendar-header">
                        <button>&lt;</button>
                        <span>Today</span>
                        <button>&gt;</button>
                      </div>
                      <div className="mini-calendar-grid">
                        <div className="calendar-day-name">Sun</div>
                        <div className="calendar-day-name">Mon</div>
                        <div className="calendar-day-name">Tue</div>
                        <div className="calendar-day-name">Wed</div>
                        <div className="calendar-day-name">Thu</div>
                        <div className="calendar-day-name">Fri</div>
                        <div className="calendar-day-name">Sat</div>
                        {Array.from({ length: 35 }).map((_, i) => (
                          <div key={i} className={`calendar-day ${i === 14 ? 'today' : ''}`}>{i % 7 === 0 && i > 0 ? Math.floor(i / 7) * 7 - 20 : i - 5}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="calendar-main">
                    <div className="calendar-view">
                      <div className="calendar-week-header">
                        <div className="week-day">Sunday</div>
                        <div className="week-day">Monday</div>
                        <div className="week-day">Tuesday</div>
                        <div className="week-day">Wednesday</div>
                        <div className="week-day">Thursday</div>
                        <div className="week-day">Friday</div>
                        <div className="week-day">Saturday</div>
                      </div>
                      <div className="calendar-week-grid">
                        {Array.from({ length: 7 }).map((_, i) => (
                          <div key={i} className="week-slot"></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Contacts View */}
            {activeApp === 'contacts' && (
              <div className="contacts-container">
                <div className="contacts-header">
                  <h2>Contacts</h2>
                  <button className="add-contact-btn">
                    <Plus size={20} />
                    <span>Add Contact</span>
                  </button>
                </div>
                <div className="contacts-content">
                  <div className="contacts-sidebar">
                    <div className="contacts-search">
                      <input type="text" id="contacts-search" name="contacts-search" placeholder="Search contacts..." />
                    </div>
                    <div className="contacts-list">
                      <div className="contact-item">
                        <div className="contact-avatar">J</div>
                        <div className="contact-info">
                          <div className="contact-name">John Doe</div>
                          <div className="contact-email">john@example.com</div>
                        </div>
                      </div>
                      <div className="contact-item">
                        <div className="contact-avatar">S</div>
                        <div className="contact-info">
                          <div className="contact-name">Sarah Smith</div>
                          <div className="contact-email">sarah@example.com</div>
                        </div>
                      </div>
                      <div className="contact-item">
                        <div className="contact-avatar">M</div>
                        <div className="contact-info">
                          <div className="contact-name">Mike Johnson</div>
                          <div className="contact-email">mike@example.com</div>
                        </div>
                      </div>
                      <div className="contact-item">
                        <div className="contact-avatar">E</div>
                        <div className="contact-info">
                          <div className="contact-name">Emily Brown</div>
                          <div className="contact-email">emily@example.com</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="contacts-main">
                    <div className="contact-detail">
                      <div className="contact-header">
                        <div className="contact-detail-avatar">J</div>
                        <div className="contact-detail-info">
                          <h3>John Doe</h3>
                          <p>john@example.com</p>
                        </div>
                      </div>
                      <div className="contact-actions">
                        <button className="action-btn">
                          <Mail size={18} />
                          Email
                        </button>
                        <button className="action-btn">
                          <MessageSquare size={18} />
                          Chat
                        </button>
                        <button className="action-btn">
                          <Star size={18} />
                          Favorite
                        </button>
                      </div>
                      <div className="contact-details-section">
                        <h4>Contact Details</h4>
                        <div className="detail-item">
                          <label>Email</label>
                          <p>john@example.com</p>
                        </div>
                        <div className="detail-item">
                          <label>Phone</label>
                          <p>+1 (555) 123-4567</p>
                        </div>
                        <div className="detail-item">
                          <label>Address</label>
                          <p>123 Main St, New York, NY 10001</p>
                        </div>
                      </div>
                      <div className="contact-notes-section">
                        <h4>Notes</h4>
                        <p>Regular contact for business matters</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Groups View */}
            {activeApp === 'groups' && (
              <div className="groups-container">
                <div className="groups-header">
                  <h2>Groups</h2>
                  <button className="create-group-btn">
                    <Plus size={20} />
                    <span>Create Group</span>
                  </button>
                </div>
                <div className="groups-content">
                  <div className="groups-sidebar">
                    <div className="groups-search">
                      <input type="text" id="groups-search" name="groups-search" placeholder="Search groups..." />
                    </div>
                    <div className="groups-list">
                      <div className="group-item">
                        <div className="group-avatar">TM</div>
                        <div className="group-info">
                          <div className="group-name">Team Members</div>
                          <div className="group-count">5 members</div>
                        </div>
                      </div>
                      <div className="group-item">
                        <div className="group-avatar">PM</div>
                        <div className="group-info">
                          <div className="group-name">Project Managers</div>
                          <div className="group-count">3 members</div>
                        </div>
                      </div>
                      <div className="group-item">
                        <div className="group-avatar">DP</div>
                        <div className="group-info">
                          <div className="group-name">Design Partners</div>
                          <div className="group-count">4 members</div>
                        </div>
                      </div>
                      <div className="group-item">
                        <div className="group-avatar">CS</div>
                        <div className="group-info">
                          <div className="group-name">Client Support</div>
                          <div className="group-count">6 members</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="groups-main">
                    <div className="group-detail">
                      <div className="group-header">
                        <div className="group-detail-avatar">TM</div>
                        <div className="group-detail-info">
                          <h3>Team Members</h3>
                          <p>5 members • Created 3 months ago</p>
                        </div>
                      </div>
                      <div className="group-actions">
                        <button className="action-btn">
                          <MessageSquare size={18} />
                          Email All
                        </button>
                        <button className="action-btn">
                          <Plus size={18} />
                          Add Member
                        </button>
                        <button className="action-btn">
                          <FileText size={18} />
                          Settings
                        </button>
                      </div>
                      <div className="group-members-section">
                        <h4>Members ({5})</h4>
                        <div className="members-list">
                          <div className="member-item">
                            <div className="member-avatar">JD</div>
                            <div className="member-info">
                              <div className="member-name">John Doe</div>
                              <div className="member-email">john@example.com</div>
                            </div>
                          </div>
                          <div className="member-item">
                            <div className="member-avatar">SS</div>
                            <div className="member-info">
                              <div className="member-name">Sarah Smith</div>
                              <div className="member-email">sarah@example.com</div>
                            </div>
                          </div>
                          <div className="member-item">
                            <div className="member-avatar">MJ</div>
                            <div className="member-info">
                              <div className="member-name">Mike Johnson</div>
                              <div className="member-email">mike@example.com</div>
                            </div>
                          </div>
                          <div className="member-item">
                            <div className="member-avatar">EB</div>
                            <div className="member-info">
                              <div className="member-name">Emily Brown</div>
                              <div className="member-email">emily@example.com</div>
                            </div>
                          </div>
                          <div className="member-item">
                            <div className="member-avatar">AM</div>
                            <div className="member-info">
                              <div className="member-name">Alex Miller</div>
                              <div className="member-email">alex@example.com</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="group-description-section">
                        <h4>Description</h4>
                        <p>A group for all team members to collaborate and communicate effectively. Everyone in this group can participate in team discussions and activities.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Files View */}
            {activeApp === 'files' && (
              <div className="files-container">
                <div className="files-header">
                  <h2>Files & Attachments</h2>
                  <button className="close-btn" onClick={() => setActiveApp('mail')} title="Close">
                    <X size={24} />
                  </button>
                </div>
                <div className="files-content">
                  <div className="files-sidebar">
                    <div className="files-search" style={{ position: 'relative' }}>
                      <input type="text" placeholder="Search files..." value={fileSearchQuery} onChange={e => setFileSearchQuery(e.target.value)} autoFocus style={{ paddingRight: fileSearchQuery ? '30px' : '12px' }} />
                      {fileSearchQuery && (
                        <button
                          onClick={() => setFileSearchQuery('')}
                          style={{ position: 'absolute', right: '25px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', display: 'flex', padding: 0 }}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <div className="files-list">
                      <div className={`file-category ${fileCategory === 'all' ? 'active' : ''}`} onClick={() => setFileCategory('all')}><Folder size={18} /> All Files</div>
                      <div className={`file-category ${fileCategory === 'documents' ? 'active' : ''}`} onClick={() => setFileCategory('documents')}><FileText size={18} /> Documents</div>
                      <div className={`file-category ${fileCategory === 'media' ? 'active' : ''}`} onClick={() => setFileCategory('media')}><Video size={18} /> Media</div>
                    </div>
                  </div>
                  <div className="files-main">
                    <div className="files-grid">
                      {savedFiles.filter(f => {
                        if (fileSearchQuery && !f.name.toLowerCase().includes(fileSearchQuery.toLowerCase())) return false;
                        const ext = f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() || '' : '';
                        const isMedia = ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm', 'mp3'].includes(ext);
                        if (fileCategory === 'documents' && isMedia) return false;
                        if (fileCategory === 'media' && !isMedia) return false;
                        return true;
                      }).map((file, i) => {
                        const sizeLabel = file.size < 1024 ? `${file.size} B` : file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1048576).toFixed(1)} MB`
                        const ext = file.name.includes('.') ? file.name.split('.').pop()?.toUpperCase() : 'FILE';
                        const isImg = file.dataUrl || ['JPG', 'JPEG', 'PNG', 'GIF'].includes(ext || '');
                        
                        let directionLabel = 'Received from';
                        let emailAddr = file.emailFrom;
                        if (file.emailFolder === 'sent') {
                          directionLabel = 'Sent to';
                          emailAddr = file.emailTo;
                        } else if (file.emailIsScheduled) {
                          directionLabel = 'Scheduled to';
                          emailAddr = file.emailTo;
                        }

                        let cleanEmail = emailAddr || '';
                        if (cleanEmail.includes('<')) {
                          cleanEmail = cleanEmail.match(/<([^>]+)>/)?.[1] || cleanEmail;
                        }
                        
                        return (
                          <div key={i} className="file-card" onClick={() => setFilePreview(file)}>
                            {isImg && file.dataUrl ? (
                              <div className="file-preview" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
                                <img src={file.dataUrl} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '9px', fontWeight: 700, padding: '2px 4px', borderRadius: '4px' }}>{ext}</div>
                              </div>
                            ) : (
                              <div className="file-preview" style={{ position: 'relative' }}>
                                <FileText size={40} />
                                <div style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(0,0,0,0.4)', color: 'white', fontSize: '9px', fontWeight: 700, padding: '2px 4px', borderRadius: '4px' }}>{ext}</div>
                              </div>
                            )}
                            <div className="file-info" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div className="file-name" title={file.name}>{file.name}</div>
                              <div className="file-meta">{sizeLabel} • {file.date ? new Date(file.date).toLocaleDateString() : 'Just now'}</div>
                              
                              {file.emailId && (
                                <div style={{ fontSize: '11px', color: '#555', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px dashed #eee', paddingTop: '6px' }}>
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start', overflow: 'hidden' }}>
                                    <span style={{ color: '#888', whiteSpace: 'nowrap' }}>{directionLabel}:</span> 
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }} title={cleanEmail}>{cleanEmail}</span>
                                  </div>
                                  
                                  {file.emailLabelName && (
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                      <span style={{ 
                                        display: 'inline-block', 
                                        padding: '2px 6px', 
                                        borderRadius: '10px', 
                                        fontSize: '10px', 
                                        backgroundColor: `${file.emailLabelColor || '#999'}15`, 
                                        color: file.emailLabelColor || '#555',
                                        border: `1px solid ${file.emailLabelColor || '#999'}40`,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        maxWidth: '100%',
                                        fontWeight: 600
                                      }} title={file.emailLabelName}>
                                        {file.emailLabelName.split(' / ').pop()}
                                      </span>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveApp('mail');
                                        setSidebarCollapsed(false);
                                        const isOutgoing = file.emailFolder === 'sent' || file.emailFrom?.toLowerCase() === (userEmail || '').toLowerCase();
                                        const contact = isOutgoing ? file.emailTo : file.emailFrom;
                                        const rawContact = contact?.split(',')[0].trim();
                                        setChatViewContact(rawContact || null);
                                        setHighlightedEmailId(file.emailId!);
                                        setOpenedEmailId(file.emailId!);
                                        navigate('/chatmail');
                                      }}
                                      style={{
                                        background: 'none', border: 'none', color: '#1a73e8', fontSize: '11px', cursor: 'pointer', padding: '2px 0', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                    >
                                      <ExternalLink size={12} /> View Email
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {savedFiles.length === 0 && <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#999' }}><Folder size={48} style={{ marginBottom: '16px', opacity: 0.5 }} /><h3>No files yet</h3><p>Attachments from your sent and received emails will appear here.</p></div>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>

    {showDeleteLabelModal && deleteLabelTarget && createPortal(
      (() => {
        const { label, parentId } = deleteLabelTarget
        const hasChildren = !!(label.children && label.children.length > 0)
        const isChild = parentId !== null
        const labelType = hasChildren ? 'Folder' : isChild ? 'Sub-label' : 'Tag'
        const labelTypeColor = hasChildren ? '#1565c0' : isChild ? '#6a1b9a' : '#00695c'

        const renderTree = (nodes: LabelNode[], depth = 0): React.ReactNode =>
          nodes.map(n => {
            const hasKids = !!(n.children?.length)
            const expanded = deleteLabelExpanded.has(n.id)
            const toggle = (e: React.MouseEvent) => {
              e.stopPropagation()
              setDeleteLabelExpanded(prev => {
                const next = new Set(prev)
                next.has(n.id) ? next.delete(n.id) : next.add(n.id)
                return next
              })
            }
            const nodeType = hasKids ? 'Folder' : depth > 0 ? 'Sub-label' : 'Tag'
            const nodeTypeColor = hasKids ? '#1565c0' : depth > 0 ? '#6a1b9a' : '#00695c'
            return (
              <div key={n.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 0', paddingLeft: `${depth * 20}px`, borderBottom: '1px solid #f0f0f0' }}>
                  {hasKids
                    ? <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center', color: '#888', flexShrink: 0 }}>
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    : <span style={{ width: '18px', flexShrink: 0 }} />}
                  {hasKids
                    ? (expanded
                        ? <FolderOpen size={15} style={{ color: n.color, stroke: n.color, fill: 'none', flexShrink: 0 }} />
                        : <Folder size={15} style={{ color: n.color, stroke: n.color, fill: 'none', flexShrink: 0 }} />)
                    : <Tag size={15} style={{ color: n.color, flexShrink: 0 }} />}
                  <span style={{ flex: 1, fontSize: '13px', color: '#222', fontWeight: depth === 0 ? 700 : 400 }}>{n.name}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: nodeTypeColor, background: `${nodeTypeColor}15`, border: `1px solid ${nodeTypeColor}40`, borderRadius: '6px', padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0 }}>
                    {nodeType}
                  </span>
                </div>
                {hasKids && expanded && renderTree(n.children!, depth + 1)}
              </div>
            )
          })

        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => { setShowDeleteLabelModal(false); setDeleteLabelTarget(null); setDeleteLabelExpanded(new Set()) }}
          >
            <div
              style={{ background: '#fff', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)', width: '420px', maxWidth: '90vw', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Trash2 size={18} style={{ color: '#e53935', flexShrink: 0 }} />
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#c62828' }}>Delete Label</span>
              </div>

              {/* Body */}
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Label tree preview */}
                <div style={{ background: '#f8f8f8', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 14px' }}>
                  {renderTree([label])}
                </div>

                {/* Warning */}
                <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#e65100' }}>
                  {hasChildren
                    ? `This folder and all its sub-labels will be permanently deleted. Emails will keep their data but lose their label assignment.`
                    : `This label will be permanently deleted. Emails will keep their data but lose their label assignment.`}
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid #f0f0f0' }}>
                <button
                  onClick={() => { setShowDeleteLabelModal(false); setDeleteLabelTarget(null); setDeleteLabelExpanded(new Set()) }}
                  style={{ padding: '7px 20px', borderRadius: '20px', border: '1.5px solid #c0c0c0', background: '#fff', color: '#555', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >Cancel</button>
                <button
                  onClick={() => confirmDeleteLabel(label.id)}
                  style={{ padding: '7px 20px', borderRadius: '20px', border: 'none', background: '#e53935', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >Delete</button>
              </div>
            </div>
          </div>
        )
      })(),
      document.body
    )}

    {showCreateLabelModal && createPortal(
      <div
        style={addLabelDropdownPos
          ? { position: 'fixed', inset: 0, zIndex: 10000 }
          : { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => { setShowCreateLabelModal(false); setAddLabelDropdownPos(null); setClIsRenameMode(false); setClRenameLabelId(null) }}
      >
        <div
          style={addLabelDropdownPos
            ? { position: 'fixed', top: addLabelDropdownPos.top, left: addLabelDropdownPos.left, background: '#f0f0f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)', border: '1px solid #e0e0e0', width: '500px', maxHeight: `${addLabelDropdownPos.maxHeight}px`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
            : { background: '#f0f0f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', width: '560px', height: '560px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          onClick={(e) => { e.stopPropagation(); setClShowSubLabelDropdown(false); }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0' }}>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>{clIsRenameMode ? 'Rename Label' : 'Create New Label'}</span>
          </div>
          <div style={{ padding: '16px 20px 10px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
            {clError && <div style={{ color: '#e53935', fontSize: '13px', background: '#fff0f0', padding: '8px 12px', borderRadius: '8px' }}>{clError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Label Name</label>
              <input autoFocus type="text" placeholder="Enter label name" value={clLabelName} onChange={(e) => setClLabelName(e.target.value)}
                style={{ padding: '9px 12px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Sub-label under (optional)</label>
              <div
                ref={subLabelTriggerRef}
                onClick={(e) => {
                e.stopPropagation()
                if (!clShowSubLabelDropdown) {
                  const collectParents = (nodes: LabelNode[]): number[] =>
                    nodes.flatMap(n => n.children?.length ? [n.id, ...collectParents(n.children)] : [])
                  setExpandedSubLabels(new Set(collectParents(customLabels)))
                }
                setClShowSubLabelDropdown(!clShowSubLabelDropdown)
              }}
                style={{ display: 'flex', alignItems: 'center', padding: '9px 12px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '14px', background: '#fff', cursor: 'pointer', justifyContent: 'space-between' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#333' }}>
                  {clParentId ? (() => {
                    const sel = flatLabelsForDropdownTree(customLabels).find(l => l.id === clParentId);
                    return sel ? (
                      <>
                        {sel.hasChildren
                          ? <Folder size={16} style={{ color: sel.color, stroke: sel.color, fill: 'none', flexShrink: 0 }} />
                          : <Tag size={16} style={{ color: sel.color, stroke: sel.color, fill: 'none', flexShrink: 0 }} />}
                        {sel.name}
                      </>
                    ) : 'None (top-level)';
                  })() : 'None (top-level)'}
                </span>
                <ChevronDown size={16} style={{ color: '#888' }} />
              </div>
              {clShowSubLabelDropdown && createPortal(
                (() => {
                  const rect = subLabelTriggerRef.current?.getBoundingClientRect()
                  const dropdownH = 420
                  const dropdownW = 460
                  const spaceBelow = rect ? window.innerHeight - rect.bottom - 8 : 0
                  const spaceAbove = rect ? rect.top - 8 : 0
                  const openUpward = rect ? spaceBelow < dropdownH && spaceAbove > spaceBelow : false
                  const top = rect
                    ? openUpward
                      ? Math.max(8, rect.top - Math.min(dropdownH, spaceAbove) - 4)
                      : rect.bottom + 4
                    : window.innerHeight / 2 - dropdownH / 2
                  const left = rect
                    ? Math.min(rect.left, window.innerWidth - dropdownW - 8)
                    : window.innerWidth / 2 - dropdownW / 2
                  const maxHeight = rect
                    ? openUpward ? Math.min(dropdownH, spaceAbove) : Math.min(dropdownH, spaceBelow)
                    : dropdownH
                  return (
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 20000 }}
                      onClick={() => setClShowSubLabelDropdown(false)}
                    >
                      <div
                        style={{ position: 'absolute', top, left, width: dropdownW, background: '#fff', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)', border: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', maxHeight, overflow: 'hidden' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #e8e8e8', background: '#f8f8f8', borderRadius: '10px 10px 0 0' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#555', letterSpacing: '0.3px' }}>Select parent label</span>
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
                          {(() => {
                            const allItems = flatLabelsForDropdownTree(customLabels, clIsRenameMode ? clRenameLabelId : null)
                            return allItems.filter(l => isSubLabelVisible(l, allItems)).map(l => {
                              const isExpanded = expandedSubLabels.has(l.id)
                              const iconColor = l.disabled ? '#ccc' : l.color
                              return (
                                <div
                                  key={l.id}
                                  style={{
                                    display: 'flex', alignItems: 'center',
                                    paddingLeft: `${6 + l.depth * 16}px`, paddingRight: '10px',
                                    borderBottom: '1px solid #f5f5f5',
                                    background: clParentId === l.id ? '#e8f0fe' : undefined,
                                    opacity: l.disabled ? 0.5 : 1,
                                  }}
                                >
                                  {l.hasChildren ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setExpandedSubLabels(prev => {
                                          const next = new Set(prev)
                                          next.has(l.id) ? next.delete(l.id) : next.add(l.id)
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
                                    onClick={() => { if (!l.disabled) { setClParentId(l.id); setClShowSubLabelDropdown(false) } }}
                                    title={l.disabled ? 'Cannot select — would create a circular reference' : undefined}
                                    style={{
                                      flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                                      paddingTop: '9px', paddingBottom: '9px',
                                      cursor: l.disabled ? 'not-allowed' : 'pointer', fontSize: '14px',
                                      color: l.disabled ? '#bbb' : '#333',
                                    }}
                                    onMouseEnter={(e) => { if (!l.disabled && clParentId !== l.id) e.currentTarget.style.background = '#f5f5f5' }}
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
                            })
                          })()}
                        </div>
                      </div>
                    </div>
                  )
                })(),
                document.body
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Color</label>
              {/* Left: swatches | Right: RGB picker */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                {/* Left — swatches + hex+swatch at bottom */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 30px)', gap: '8px' }}>
                    {['#000000','#757575','#bdbdbd','#f06292','#f44336','#e91e63','#9c27b0','#3f51b5','#2196f3','#00bcd4','#009688','#4caf50','#ffeb3b','#ff9800','#795548','#607d8b'].map(c => (
                      <button key={c} onClick={() => setClLabelColor(c)}
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
                      placeholder="#607d8b"
                      style={{ padding: '18px 10px', backgroundColor: 'white', border: 'none', fontSize: '14px', fontFamily: 'monospace', outline: 'none', width: '110px' }}
                    />
                  </div>
                  </div>
                </div>
                <ColorPicker value={clLabelColor || '#607d8b'} onChange={setClLabelColor} showHex={false} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid #e0e0e0' }}>
            <button onClick={() => { setShowCreateLabelModal(false); setAddLabelDropdownPos(null); setClIsRenameMode(false); setClRenameLabelId(null) }}
              className="snooze-cancel-btn"
              style={{ padding: '8px 22px', borderRadius: '20px', border: '1.5px solid #c0c0c0', background: '#fff', color: '#555', fontSize: '15px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
              Cancel
            </button>
            <button disabled={clLoading || !clLabelName.trim()}
              onClick={async () => {
                if (!clLabelName.trim()) { setClError('Label name is required'); return }
                setClLoading(true); setClError('')
                try {
                  if (clIsRenameMode && clRenameLabelId) {
                    const res = await fetch(`http://localhost:5050/api/custom-labels/${clRenameLabelId}`, {
                      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ name: clLabelName.trim(), color: clLabelColor || '#607d8b', parent_label_id: clParentId ?? null }),
                    })
                    if (res.ok) {
                      const renamedId = clRenameLabelId!
                      const newLabels = await fetchCustomLabels()
                      const newFullPath = computeLabelFullPath(newLabels, renamedId)

                      setShowCreateLabelModal(false); setAddLabelDropdownPos(null); setClIsRenameMode(false); setClRenameLabelId(null)

                      if (newFullPath) {
                        setActiveSidebarSection(`label-${renamedId}`)

                        // Mirror handleLabelClick: if collapsed & has children, include all descendants
                        const findInTree = (labels: LabelNode[], id: number): LabelNode | null => {
                          for (const l of labels) {
                            if (l.id === id) return l
                            if (l.children) { const f = findInTree(l.children, id); if (f) return f }
                          }
                          return null
                        }
                        const node = findInTree(newLabels, renamedId)
                        const hasChildren = !!(node?.children?.length)
                        const isCollapsed = !expandedLabelGroups.has(renamedId)
                        const query = hasChildren && isCollapsed ? '?includeChildren=true' : ''
                        navigate(`/labels/${encodeURIComponent(newFullPath)}${query}`)
                      }

                      setLabelPageKey(prev => prev + 1)
                      await fetchUnreadCounts()
                    } else { const d = await res.json(); setClError(d.error || 'Failed to rename label') }
                  } else {
                    const payload: any = { name: clLabelName, color: clLabelColor || '#607d8b' }
                    if (clParentId) payload.parent_label_id = clParentId
                    const res = await fetch('http://localhost:5050/api/custom-labels', {
                      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify(payload),
                    })
                    if (res.ok) { handleLabelCreated(); setShowCreateLabelModal(false); setAddLabelDropdownPos(null) }
                    else { const d = await res.json(); setClError(d.error || 'Failed to create label') }
                  }
                } catch { setClError(clIsRenameMode ? 'Failed to rename label' : 'Failed to create label') }
                setClLoading(false)
              }}
              className="snooze-popup-save-btn"
              style={{ padding: '8px 22px', borderRadius: '20px', backgroundColor: 'white', border: 'none', background: clLabelName.trim() ? '#0288d1' : '#b3d9f0', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: clLabelName.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
              {clLoading ? (clIsRenameMode ? 'Saving...' : 'Creating...') : (clIsRenameMode ? 'Save' : 'Create Label')}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    {openLabelMenu !== null && labelMenuPos !== null && (() => {
      const menuLabel = findLabelById(customLabels, openLabelMenu)
      if (!menuLabel) return null
      const menuHasChildren = !!(menuLabel.children && menuLabel.children.length > 0)
      const menuIsCollapsed = menuHasChildren && !expandedLabelGroups.has(menuLabel.id)
      const menuCounts = menuIsCollapsed
        ? getAggregateCounts(menuLabel)
        : { unread: unreadCounts[`label-${menuLabel.id}`] || 0, total: totalCounts[`label-${menuLabel.id}`] || 0 }
      const markableCounts = menuIsCollapsed
        ? getMarkableAggregateCounts(menuLabel)
        : { unread: markableUnreadCounts[`label-${menuLabel.id}`] || 0, total: markableTotalCounts[`label-${menuLabel.id}`] || 0 }
      const labelFullPath = computeLabelFullPath(customLabels, menuLabel.id) || menuLabel.name
      const labelSnoozeKey = `label:::${menuLabel.id}:::${labelFullPath}`
      const isLabelSnoozed = snoozedLabels.has(menuLabel.id)
      return createPortal(
        <div
          className="label-menu-dropdown label-menu-portal"
          style={{ position: 'fixed', top: labelMenuPos.top, left: labelMenuPos.left, zIndex: 99999 }}
          onClick={(e) => e.stopPropagation()}
          onMouseOver={scheduleCloseSnoozeMenu}
          onMouseLeave={scheduleCloseSnoozeMenu}
        >
          <div className="label-menu-header">
            {menuHasChildren
              ? menuIsCollapsed
                ? <Folder size={22} style={{ color: 'white', stroke: 'white', fill: menuLabel.color || '#888', flexShrink: 0 }} />
                : <FolderOpen size={22} style={{ color: 'white', stroke: 'white', fill: menuLabel.color || '#888', flexShrink: 0 }} />
              : <Tag size={22} style={{ color: 'white', stroke: 'white', fill: menuLabel.color || '#888', flexShrink: 0 }} />
            }
            <span style={{ fontWeight: 600, fontSize: '17px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{menuLabel.name}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', flexShrink: 0 }}>
              {menuCounts.unread > 0 && (
                <span className="label-menu-unread-pill">{menuCounts.unread}</span>
              )}
              <span className="label-menu-total-pill">{menuCounts.total}</span>
            </span>
          </div>
          <div className="label-menu-divider" />
          <button className="menu-item subfolder" onClick={() => { setClLabelName(''); setClLabelColor(''); setClError(''); setClIsRenameMode(false); setClRenameLabelId(null); setClParentId(menuLabel.id); setShowCreateLabelModal(true); closeLabelMenu(); setLabelMenuPos(null) }}>
            <FolderPlus size={17} /><span>Create sub folder</span>
          </button>
          <button className={`menu-item favourite${(menuCounts.total === 0 || favouriteLabels.has(menuLabel.id)) ? ' no-click' : ''}`} onClick={() => menuCounts.total > 0 && !favouriteLabels.has(menuLabel.id) && handleToggleFavourite(menuLabel.id, true)}>
            <Star size={17} /><span>Add all to star</span>
          </button>
          <button className={`menu-item unfavourite${(menuCounts.total === 0 || !favouriteLabels.has(menuLabel.id)) ? ' no-click' : ''}`} onClick={() => menuCounts.total > 0 && favouriteLabels.has(menuLabel.id) && handleToggleFavourite(menuLabel.id, false)}>
            <StarOff size={17} /><span>Remove all from star</span>
          </button>
          <button className={`menu-item markread${markableCounts.unread === 0 ? ' no-click' : ''}`} onClick={() => markableCounts.unread > 0 && handleMarkAllRead(menuLabel, menuIsCollapsed)}>
            <span style={{ position: 'relative', display: 'inline-flex' }}><MailOpen size={17} /><span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ width: '10.5px', height: '10.5px' }} /></span></span><span>Mark all as read</span>
          </button>
          <button className={`menu-item markunread${markableCounts.unread === markableCounts.total || markableCounts.total === 0 ? ' no-click' : ''}`} onClick={() => markableCounts.unread < markableCounts.total && markableCounts.total > 0 && handleMarkAllUnread(menuLabel, menuIsCollapsed)}>
            <span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={17} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span><span>Mark all as unread</span>
          </button>
          <button className={`menu-item snooze${(menuCounts.total === 0 || isLabelSnoozed) ? ' no-click' : ''}`} onMouseOver={(e) => { e.stopPropagation(); if (menuCounts.total > 0 && !isLabelSnoozed) handleLabelSnoozeHover(e, labelSnoozeKey); else scheduleCloseSnoozeMenu(); }} onClick={(e) => e.stopPropagation()}>
            <AlarmClock size={17} /><span>Add all to snooze</span><ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
          </button>
          <button className={`menu-item unsnooze${(menuCounts.total === 0 || !isLabelSnoozed) ? ' no-click' : ''}`} onClick={() => menuCounts.total > 0 && isLabelSnoozed && handleFolderSnoozeAll(labelSnoozeKey, false)}>
            <AlarmClockOff size={17} /><span>Remove all from snoozed</span>
          </button>
          <div className="label-menu-divider" />
          <button className="menu-item rename" onClick={() => handleRenameLabel(menuLabel.id, menuLabel.name, menuLabel.color)}>
            <Edit3 size={17} /><span>Rename</span>
          </button>
          <button className="menu-item changecolor" onClick={() => handleRenameLabel(menuLabel.id, menuLabel.name, menuLabel.color)}>
            <Paintbrush size={17} /><span>Change color</span>
          </button>
          <button className="menu-item move" onClick={() => handleMoveLabel(menuLabel.id, menuLabel.name, menuLabel.color)}>
            <FolderInput size={17} /><span>Move</span>
          </button>
          <div className="label-menu-divider" />
          <button className={`menu-item empty${menuCounts.total === 0 ? ' no-click' : ''}`} onClick={() => { if (menuCounts.total > 0) { handleEmptyLabel(menuLabel, menuIsCollapsed); setLabelMenuPos(null) } }}>
            <Eraser size={17} /><span>Empty</span>
          </button>
          <button className="menu-item delete" onClick={() => { handleDeleteLabel(menuLabel.id); setLabelMenuPos(null) }}>
            <Trash2 size={17} /><span>Delete</span>
          </button>
          <div className="label-menu-divider" />
          <button className="menu-item newtab" onClick={() => handleOpenLabelInNewTab(menuLabel.name)}>
            <ExternalLink size={17} /><span>Open in new tab</span>
          </button>
        </div>,
        document.body
      )
    })()}
    {appToast && createPortal(
      <div className="toast-notification">
        <span>{appToast.message}</span>
        {appToast.onUndo && (
          <button className="toast-undo-btn" onClick={() => { appToast.onUndo?.(); setAppToast(null) }}>Undo</button>
        )}
      </div>,
      document.body
    )}
    {openFolderMenu !== null && folderMenuPos !== null && (() => {
      const _fcMap: Record<string, { unread: number; total: number }> = {
        inbox:         { unread: unreadCounts.inbox || 0,         total: receivedTotalCounts.inbox || 0 },
        sent:          { unread: 0,                               total: receivedTotalCounts.sent || 0 },
        groups:        { unread: unreadCounts.groups || 0,        total: receivedTotalCounts.groups || 0 },
        starred:       { unread: unreadCounts.starred || 0,       total: receivedTotalCounts.starred || 0 },
        snoozed:       { unread: unreadCounts.snoozed || 0,       total: receivedTotalCounts.snoozed || 0 },
        drafts:        { unread: 0,                               total: receivedTotalCounts.drafts || 0 },
        archive:       { unread: unreadCounts.archived || 0,      total: receivedTotalCounts.archived || 0 },
        'all-mails':   { unread: unreadCounts.all || 0,           total: receivedTotalCounts.all || 0 },
        scheduled:     { unread: unreadCounts.scheduled || 0,     total: receivedTotalCounts.scheduled || 0 },
        reports:       { unread: unreadCounts.reports || 0,       total: receivedTotalCounts.reports || 0 },
        spam:          { unread: unreadCounts.spam || 0,          total: receivedTotalCounts.spam || 0 },
        delete:        { unread: unreadCounts.delete || 0,        total: receivedTotalCounts.delete || 0 },
        subscription:  { unread: 0,                               total: receivedTotalCounts.subscriptions || 0 },
        'manage-labels': { unread: 0,                             total: 0 },
      }
      const fc = _fcMap[openFolderMenu] || { unread: 0, total: 0 }
      const altKey = openFolderMenu === 'archive' ? 'archived' : 
                     openFolderMenu === 'subscription' ? 'subscriptions' : 
                     openFolderMenu === 'all-mails' ? 'all' : 
                     openFolderMenu;
      const isStarred = starredFolders.has(openFolderMenu) || starredFolders.has(altKey)
      const isSnoozed = snoozedFolders.has(openFolderMenu) || snoozedFolders.has(altKey)
      
      const mUnread = fc.unread
      const mTotal = fc.total
      return createPortal(
      <div
        className="folder-menu-dropdown"
        style={{ position: 'fixed', top: folderMenuPos.top, left: folderMenuPos.left, zIndex: 99999 }}
        onClick={(e) => e.stopPropagation()}
        onMouseOver={scheduleCloseSnoozeMenu}
        onMouseLeave={scheduleCloseSnoozeMenu}
      >
        {openFolderMenu === 'inbox' && <>{renderFolderMenuHeader('inbox')}<button className={`menu-item favourite${(fc.total === 0 || isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && !isStarred && handleFolderStarAll('inbox', true)}><Star size={17} /><span>Add all to star</span></button><button className={`menu-item unfavourite${(fc.total === 0 || !isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isStarred && handleFolderStarAll('inbox', false)}><StarOff size={17} /><span>Remove all from star</span></button><div className="label-menu-divider" /><button className={`menu-item markread${mUnread === 0 ? ' no-click' : ''}`} onClick={() => mUnread > 0 && handleFolderMarkAllRead('inbox')}><span style={{ position: 'relative', display: 'inline-flex' }}><MailOpen size={17} /><span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ width: '10.5px', height: '10.5px' }} /></span></span><span>Mark all as read</span></button><button className={`menu-item markunread${mUnread === mTotal || mTotal === 0 ? ' no-click' : ''}`} onClick={() => mUnread < mTotal && mTotal > 0 && handleFolderMarkAllUnread('inbox')}><span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={17} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span><span>Mark all as unread</span></button><div className="label-menu-divider" /><button className={`menu-item snooze${(fc.total === 0 || isSnoozed) ? ' no-click' : ''}`} onMouseOver={(e) => { e.stopPropagation(); if (fc.total > 0 && !isSnoozed) handleFolderSnoozeHover(e, 'inbox'); else scheduleCloseSnoozeMenu(); }} onClick={(e) => e.stopPropagation()}><AlarmClock size={17} /><span>Add all to snooze</span><ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} /></button><button className={`menu-item unsnooze${(fc.total === 0 || !isSnoozed) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isSnoozed && handleFolderSnoozeAll('inbox', false)}><AlarmClockOff size={17} /><span>Remove all from snoozed</span></button><div className="label-menu-divider" /><button className="menu-item empty" onClick={() => handleFolderEmpty('inbox')}><Eraser size={17} /><span>Empty</span></button><button className="menu-item newtab" onClick={() => handleFolderOpenNewTab('inbox')}><ExternalLink size={17} /><span>Open in new tab</span></button></>}
        {openFolderMenu === 'sent' && <>{renderFolderMenuHeader('sent')}<button className={`menu-item favourite${(fc.total === 0 || isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && !isStarred && handleFolderStarAll('sent', true)}><Star size={17} /><span>Add all to star</span></button><button className={`menu-item unfavourite${(fc.total === 0 || !isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isStarred && handleFolderStarAll('sent', false)}><StarOff size={17} /><span>Remove all from star</span></button><div className="label-menu-divider" /><button className={`menu-item snooze${(fc.total === 0 || isSnoozed) ? ' no-click' : ''}`} onMouseOver={(e) => { e.stopPropagation(); if (fc.total > 0 && !isSnoozed) handleFolderSnoozeHover(e, 'sent'); else scheduleCloseSnoozeMenu(); }} onClick={(e) => e.stopPropagation()}><AlarmClock size={17} /><span>Add all to snooze</span><ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} /></button><button className={`menu-item unsnooze${(fc.total === 0 || !isSnoozed) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isSnoozed && handleFolderSnoozeAll('sent', false)}><AlarmClockOff size={17} /><span>Remove all from snoozed</span></button><div className="label-menu-divider" /><button className="menu-item empty" onClick={() => handleFolderEmpty('sent')}><Eraser size={17} /><span>Empty</span></button><button className="menu-item newtab" onClick={() => handleFolderOpenNewTab('sent')}><ExternalLink size={17} /><span>Open in new tab</span></button></>}
        {openFolderMenu === 'groups' && <>{renderFolderMenuHeader('groups')}<button className={`menu-item favourite${(fc.total === 0 || isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && !isStarred && handleFolderStarAll('groups', true)}><Star size={17} /><span>Add all to star</span></button><button className={`menu-item unfavourite${(fc.total === 0 || !isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isStarred && handleFolderStarAll('groups', false)}><StarOff size={17} /><span>Remove all from star</span></button><div className="label-menu-divider" /><button className={`menu-item markread${mUnread === 0 ? ' no-click' : ''}`} onClick={() => mUnread > 0 && handleFolderMarkAllRead('groups')}><span style={{ position: 'relative', display: 'inline-flex' }}><MailOpen size={17} /><span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ width: '10.5px', height: '10.5px' }} /></span></span><span>Mark all as read</span></button><button className={`menu-item markunread${mUnread === mTotal || mTotal === 0 ? ' no-click' : ''}`} onClick={() => mUnread < mTotal && mTotal > 0 && handleFolderMarkAllUnread('groups')}><span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={17} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span><span>Mark all as unread</span></button><div className="label-menu-divider" /><button className={`menu-item snooze${(fc.total === 0 || isSnoozed) ? ' no-click' : ''}`} onMouseOver={(e) => { e.stopPropagation(); if (fc.total > 0 && !isSnoozed) handleFolderSnoozeHover(e, 'groups'); else scheduleCloseSnoozeMenu(); }} onClick={(e) => e.stopPropagation()}><AlarmClock size={17} /><span>Add all to snooze</span><ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} /></button><button className={`menu-item unsnooze${(fc.total === 0 || !isSnoozed) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isSnoozed && handleFolderSnoozeAll('groups', false)}><AlarmClockOff size={17} /><span>Remove all from snoozed</span></button><div className="label-menu-divider" /><button className="menu-item empty" onClick={() => handleFolderEmpty('groups')}><Eraser size={17} /><span>Empty</span></button><button className="menu-item newtab" onClick={() => handleFolderOpenNewTab('groups')}><ExternalLink size={17} /><span>Open in new tab</span></button></>}
        {openFolderMenu === 'starred' && <>{renderFolderMenuHeader('starred')}<button className={`menu-item unfavourite${(fc.total === 0 || !isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isStarred && handleFolderStarAll('starred', false)}><StarOff size={17} /><span>Remove all from star</span></button><div className="label-menu-divider" /><button className={`menu-item markread${mUnread === 0 ? ' no-click' : ''}`} onClick={() => mUnread > 0 && handleFolderMarkAllRead('starred')}><span style={{ position: 'relative', display: 'inline-flex' }}><MailOpen size={17} /><span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ width: '10.5px', height: '10.5px' }} /></span></span><span>Mark all as read</span></button><button className={`menu-item markunread${mUnread === mTotal || mTotal === 0 ? ' no-click' : ''}`} onClick={() => mUnread < mTotal && mTotal > 0 && handleFolderMarkAllUnread('starred')}><span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={17} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span><span>Mark all as unread</span></button><div className="label-menu-divider" /><button className={`menu-item snooze${(fc.total === 0 || isSnoozed) ? ' no-click' : ''}`} onMouseOver={(e) => { e.stopPropagation(); if (fc.total > 0 && !isSnoozed) handleFolderSnoozeHover(e, 'starred'); else scheduleCloseSnoozeMenu(); }} onClick={(e) => e.stopPropagation()}><AlarmClock size={17} /><span>Add all to snooze</span><ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} /></button><button className={`menu-item unsnooze${(fc.total === 0 || !isSnoozed) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isSnoozed && handleFolderSnoozeAll('starred', false)}><AlarmClockOff size={17} /><span>Remove all from snoozed</span></button><div className="label-menu-divider" /><button className="menu-item empty" onClick={() => handleFolderEmpty('starred')}><Eraser size={17} /><span>Empty</span></button><button className="menu-item newtab" onClick={() => handleFolderOpenNewTab('starred')}><ExternalLink size={17} /><span>Open in new tab</span></button></>}
        {openFolderMenu === 'snoozed' && <>{renderFolderMenuHeader('snoozed')}<button className={`menu-item unsnooze${fc.total === 0 ? ' no-click' : ''}`} onClick={() => fc.total > 0 && handleFolderSnoozeAll('snoozed', false)}><AlarmClockOff size={17} /><span>Remove all from snoozed</span></button><div className="label-menu-divider" /><button className={`menu-item favourite${(fc.total === 0 || isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && !isStarred && handleFolderStarAll('snoozed', true)}><Star size={17} /><span>Add all to star</span></button><button className={`menu-item unfavourite${(fc.total === 0 || !isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isStarred && handleFolderStarAll('snoozed', false)}><StarOff size={17} /><span>Remove all from star</span></button><div className="label-menu-divider" /><button className={`menu-item markread${fc.unread === 0 ? ' no-click' : ''}`} onClick={() => fc.unread > 0 && handleFolderMarkAllRead('snoozed')}><span style={{ position: 'relative', display: 'inline-flex' }}><MailOpen size={17} /><span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ width: '10.5px', height: '10.5px' }} /></span></span><span>Mark all as read</span></button><button className={`menu-item markunread${fc.unread === fc.total || fc.total === 0 ? ' no-click' : ''}`} onClick={() => fc.unread < fc.total && fc.total > 0 && handleFolderMarkAllUnread('snoozed')}><span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={17} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span><span>Mark all as unread</span></button><div className="label-menu-divider" /><button className="menu-item empty" onClick={() => handleFolderEmpty('snoozed')}><Eraser size={17} /><span>Empty</span></button><button className="menu-item newtab" onClick={() => handleFolderOpenNewTab('snoozed')}><ExternalLink size={17} /><span>Open in new tab</span></button></>}
        {openFolderMenu === 'drafts' && <>{renderFolderMenuHeader('drafts')}<button className={`menu-item favourite${(fc.total === 0 || isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && !isStarred && handleFolderStarAll('drafts', true)}><Star size={17} /><span>Add all to star</span></button><button className={`menu-item unfavourite${(fc.total === 0 || !isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isStarred && handleFolderStarAll('drafts', false)}><StarOff size={17} /><span>Remove all from star</span></button><div className="label-menu-divider" /><button className={`menu-item snooze${(fc.total === 0 || isSnoozed) ? ' no-click' : ''}`} onMouseOver={(e) => { e.stopPropagation(); if (fc.total > 0 && !isSnoozed) handleFolderSnoozeHover(e, 'drafts'); else scheduleCloseSnoozeMenu(); }} onClick={(e) => e.stopPropagation()}><AlarmClock size={17} /><span>Add all to snooze</span><ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} /></button><button className={`menu-item unsnooze${(fc.total === 0 || !isSnoozed) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isSnoozed && handleFolderSnoozeAll('drafts', false)}><AlarmClockOff size={17} /><span>Remove all from snoozed</span></button><div className="label-menu-divider" /><button className="menu-item empty" onClick={() => handleFolderEmpty('drafts')}><Eraser size={17} /><span>Empty</span></button><button className="menu-item newtab" onClick={() => handleFolderOpenNewTab('drafts')}><ExternalLink size={17} /><span>Open in new tab</span></button></>}
        {openFolderMenu === 'archive' && <>{renderFolderMenuHeader('archive')}<button className={`menu-item favourite${(fc.total === 0 || isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && !isStarred && handleFolderStarAll('archive', true)}><Star size={17} /><span>Add all to star</span></button><button className={`menu-item unfavourite${(fc.total === 0 || !isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isStarred && handleFolderStarAll('archive', false)}><StarOff size={17} /><span>Remove all from star</span></button><div className="label-menu-divider" /><button className={`menu-item markread${mUnread === 0 ? ' no-click' : ''}`} onClick={() => mUnread > 0 && handleFolderMarkAllRead('archive')}><span style={{ position: 'relative', display: 'inline-flex' }}><MailOpen size={17} /><span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ width: '10.5px', height: '10.5px' }} /></span></span><span>Mark all as read</span></button><button className={`menu-item markunread${mUnread === mTotal || mTotal === 0 ? ' no-click' : ''}`} onClick={() => mUnread < mTotal && mTotal > 0 && handleFolderMarkAllUnread('archive')}><span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={17} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span><span>Mark all as unread</span></button><div className="label-menu-divider" /><button className={`menu-item snooze${(fc.total === 0 || isSnoozed) ? ' no-click' : ''}`} onMouseOver={(e) => { e.stopPropagation(); if (fc.total > 0 && !isSnoozed) handleFolderSnoozeHover(e, 'archive'); else scheduleCloseSnoozeMenu(); }} onClick={(e) => e.stopPropagation()}><AlarmClock size={17} /><span>Add all to snooze</span><ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} /></button><button className={`menu-item unsnooze${(fc.total === 0 || !isSnoozed) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isSnoozed && handleFolderSnoozeAll('archive', false)}><AlarmClockOff size={17} /><span>Remove all from snoozed</span></button><div className="label-menu-divider" /><button className="menu-item empty" onClick={() => handleFolderEmpty('archive')}><Eraser size={17} /><span>Empty</span></button><button className="menu-item newtab" onClick={() => handleFolderOpenNewTab('archive')}><ExternalLink size={17} /><span>Open in new tab</span></button></>}
        {openFolderMenu === 'all-mails' && <>{renderFolderMenuHeader('all-mails')}<button className={`menu-item favourite${(fc.total === 0 || isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && !isStarred && handleFolderStarAll('all', true)}><Star size={17} /><span>Add all to star</span></button><button className={`menu-item unfavourite${(fc.total === 0 || !isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isStarred && handleFolderStarAll('all', false)}><StarOff size={17} /><span>Remove all from star</span></button><div className="label-menu-divider" /><button className={`menu-item markread${mUnread === 0 ? ' no-click' : ''}`} onClick={() => mUnread > 0 && handleFolderMarkAllRead('all')}><span style={{ position: 'relative', display: 'inline-flex' }}><MailOpen size={17} /><span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ width: '10.5px', height: '10.5px' }} /></span></span><span>Mark all as read</span></button><button className={`menu-item markunread${mUnread === mTotal || mTotal === 0 ? ' no-click' : ''}`} onClick={() => mUnread < mTotal && mTotal > 0 && handleFolderMarkAllUnread('all')}><span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={17} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span><span>Mark all as unread</span></button><div className="label-menu-divider" /><button className="menu-item moveup" onClick={() => handleFolderMoveUp('all-mails')}><ArrowUp size={17} /><span>Move up</span></button><button className="menu-item movedown" onClick={() => handleFolderMoveDown('all-mails')}><ArrowDown size={17} /><span>Move down</span></button><div className="label-menu-divider" /><button className={`menu-item snooze${(fc.total === 0 || isSnoozed) ? ' no-click' : ''}`} onMouseOver={(e) => { e.stopPropagation(); if (fc.total > 0 && !isSnoozed) handleFolderSnoozeHover(e, 'all'); else scheduleCloseSnoozeMenu(); }} onClick={(e) => e.stopPropagation()}><AlarmClock size={17} /><span>Add all to snooze</span><ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} /></button><button className={`menu-item unsnooze${(fc.total === 0 || !isSnoozed) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isSnoozed && handleFolderSnoozeAll('all', false)}><AlarmClockOff size={17} /><span>Remove all from snoozed</span></button><div className="label-menu-divider" /><button className="menu-item empty" onClick={() => handleFolderEmpty('all')}><Eraser size={17} /><span>Empty</span></button><button className="menu-item newtab" onClick={() => handleFolderOpenNewTab('all-mails')}><ExternalLink size={17} /><span>Open in new tab</span></button></>}
        {openFolderMenu === 'scheduled' && <>{renderFolderMenuHeader('scheduled')}<button className={`menu-item favourite${(fc.total === 0 || isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && !isStarred && handleFolderStarAll('scheduled', true)}><Star size={17} /><span>Add all to star</span></button><button className={`menu-item unfavourite${(fc.total === 0 || !isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isStarred && handleFolderStarAll('scheduled', false)}><StarOff size={17} /><span>Remove all from star</span></button><div className="label-menu-divider" /><button className="menu-item moveup" onClick={() => handleFolderMoveUp('scheduled')}><ArrowUp size={17} /><span>Move up</span></button><button className="menu-item movedown" onClick={() => handleFolderMoveDown('scheduled')}><ArrowDown size={17} /><span>Move down</span></button><div className="label-menu-divider" /><button className={`menu-item snooze${(fc.total === 0 || isSnoozed) ? ' no-click' : ''}`} onMouseOver={(e) => { e.stopPropagation(); if (fc.total > 0 && !isSnoozed) handleFolderSnoozeHover(e, 'scheduled'); else scheduleCloseSnoozeMenu(); }} onClick={(e) => e.stopPropagation()}><AlarmClock size={17} /><span>Add all to snooze</span><ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} /></button><button className={`menu-item unsnooze${(fc.total === 0 || !isSnoozed) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isSnoozed && handleFolderSnoozeAll('scheduled', false)}><AlarmClockOff size={17} /><span>Remove all from snoozed</span></button><div className="label-menu-divider" /><button className="menu-item empty" onClick={() => handleFolderEmpty('scheduled')}><Eraser size={17} /><span>Empty</span></button><button className="menu-item newtab" onClick={() => handleFolderOpenNewTab('scheduled')}><ExternalLink size={17} /><span>Open in new tab</span></button></>}
        {openFolderMenu === 'reports' && <>{renderFolderMenuHeader('reports')}<button className={`menu-item favourite${(fc.total === 0 || isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && !isStarred && handleFolderStarAll('reports', true)}><Star size={17} /><span>Add all to star</span></button><button className={`menu-item unfavourite${(fc.total === 0 || !isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isStarred && handleFolderStarAll('reports', false)}><StarOff size={17} /><span>Remove all from star</span></button><div className="label-menu-divider" /><button className={`menu-item markread${mUnread === 0 ? ' no-click' : ''}`} onClick={() => mUnread > 0 && handleFolderMarkAllRead('reports')}><span style={{ position: 'relative', display: 'inline-flex' }}><MailOpen size={17} /><span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ width: '10.5px', height: '10.5px' }} /></span></span><span>Mark all as read</span></button><button className={`menu-item markunread${mUnread === mTotal || mTotal === 0 ? ' no-click' : ''}`} onClick={() => mUnread < mTotal && mTotal > 0 && handleFolderMarkAllUnread('reports')}><span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={17} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span><span>Mark all as unread</span></button><div className="label-menu-divider" /><button className="menu-item moveup" onClick={() => handleFolderMoveUp('reports')}><ArrowUp size={17} /><span>Move up</span></button><button className="menu-item movedown" onClick={() => handleFolderMoveDown('reports')}><ArrowDown size={17} /><span>Move down</span></button><div className="label-menu-divider" /><button className={`menu-item snooze${(fc.total === 0 || isSnoozed) ? ' no-click' : ''}`} onMouseOver={(e) => { e.stopPropagation(); if (fc.total > 0 && !isSnoozed) handleFolderSnoozeHover(e, 'reports'); else scheduleCloseSnoozeMenu(); }} onClick={(e) => e.stopPropagation()}><AlarmClock size={17} /><span>Add all to snooze</span><ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} /></button><button className={`menu-item unsnooze${(fc.total === 0 || !isSnoozed) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isSnoozed && handleFolderSnoozeAll('reports', false)}><AlarmClockOff size={17} /><span>Remove all from snoozed</span></button><div className="label-menu-divider" /><button className="menu-item empty" onClick={() => handleFolderEmpty('reports')}><Eraser size={17} /><span>Empty</span></button><button className="menu-item newtab" onClick={() => handleFolderOpenNewTab('reports')}><ExternalLink size={17} /><span>Open in new tab</span></button></>}
        {openFolderMenu === 'spam' && <>{renderFolderMenuHeader('spam')}<button className={`menu-item favourite${(fc.total === 0 || isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && !isStarred && handleFolderStarAll('spam', true)}><Star size={17} /><span>Add all to star</span></button><button className={`menu-item unfavourite${(fc.total === 0 || !isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isStarred && handleFolderStarAll('spam', false)}><StarOff size={17} /><span>Remove all from star</span></button><div className="label-menu-divider" /><button className={`menu-item markread${mUnread === 0 ? ' no-click' : ''}`} onClick={() => mUnread > 0 && handleFolderMarkAllRead('spam')}><span style={{ position: 'relative', display: 'inline-flex' }}><MailOpen size={17} /><span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ width: '10.5px', height: '10.5px' }} /></span></span><span>Mark all as read</span></button><button className={`menu-item markunread${mUnread === mTotal || mTotal === 0 ? ' no-click' : ''}`} onClick={() => mUnread < mTotal && mTotal > 0 && handleFolderMarkAllUnread('spam')}><span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={17} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span><span>Mark all as unread</span></button><div className="label-menu-divider" /><button className="menu-item moveup" onClick={() => handleFolderMoveUp('spam')}><ArrowUp size={17} /><span>Move up</span></button><button className="menu-item movedown" onClick={() => handleFolderMoveDown('spam')}><ArrowDown size={17} /><span>Move down</span></button><div className="label-menu-divider" /><button className={`menu-item snooze${(fc.total === 0 || isSnoozed) ? ' no-click' : ''}`} onMouseOver={(e) => { e.stopPropagation(); if (fc.total > 0 && !isSnoozed) handleFolderSnoozeHover(e, 'spam'); else scheduleCloseSnoozeMenu(); }} onClick={(e) => e.stopPropagation()}><AlarmClock size={17} /><span>Add all to snooze</span><ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} /></button><button className={`menu-item unsnooze${(fc.total === 0 || !isSnoozed) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isSnoozed && handleFolderSnoozeAll('spam', false)}><AlarmClockOff size={17} /><span>Remove all from snoozed</span></button><div className="label-menu-divider" /><button className="menu-item empty" onClick={() => handleFolderEmpty('spam')}><Eraser size={17} /><span>Empty</span></button><button className="menu-item newtab" onClick={() => handleFolderOpenNewTab('spam')}><ExternalLink size={17} /><span>Open in new tab</span></button></>}
        {openFolderMenu === 'delete' && <>{renderFolderMenuHeader('delete')}<button className={`menu-item favourite${(fc.total === 0 || isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && !isStarred && handleFolderStarAll('delete', true)}><Star size={17} /><span>Add all to star</span></button><button className={`menu-item unfavourite${(fc.total === 0 || !isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isStarred && handleFolderStarAll('delete', false)}><StarOff size={17} /><span>Remove all from star</span></button><div className="label-menu-divider" /><button className={`menu-item markread${mUnread === 0 ? ' no-click' : ''}`} onClick={() => mUnread > 0 && handleFolderMarkAllRead('delete')}><span style={{ position: 'relative', display: 'inline-flex' }}><MailOpen size={17} /><span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ width: '10.5px', height: '10.5px' }} /></span></span><span>Mark all as read</span></button><button className={`menu-item markunread${mUnread === mTotal || mTotal === 0 ? ' no-click' : ''}`} onClick={() => mUnread < mTotal && mTotal > 0 && handleFolderMarkAllUnread('delete')}><span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={17} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span><span>Mark all as unread</span></button><div className="label-menu-divider" /><button className="menu-item restore" onClick={() => handleFolderRestoreAll()}><RotateCcw size={17} /><span>Restore all</span></button><div className="label-menu-divider" /><button className={`menu-item snooze${(fc.total === 0 || isSnoozed) ? ' no-click' : ''}`} onMouseOver={(e) => { e.stopPropagation(); if (fc.total > 0 && !isSnoozed) handleFolderSnoozeHover(e, 'delete'); else scheduleCloseSnoozeMenu(); }} onClick={(e) => e.stopPropagation()}><AlarmClock size={17} /><span>Add all to snooze</span><ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} /></button><button className={`menu-item unsnooze${(fc.total === 0 || !isSnoozed) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isSnoozed && handleFolderSnoozeAll('delete', false)}><AlarmClockOff size={17} /><span>Remove all from snoozed</span></button><div className="label-menu-divider" /><button className="menu-item empty" onClick={() => handleFolderEmpty('delete')}><Eraser size={17} /><span>Empty</span></button><button className="menu-item newtab" onClick={() => handleFolderOpenNewTab('delete')}><ExternalLink size={17} /><span>Open in new tab</span></button></>}
        {openFolderMenu === 'subscription' && <>{renderFolderMenuHeader('subscription')}<button className={`menu-item favourite${(fc.total === 0 || isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && !isStarred && handleFolderStarAll('subscriptions', true)}><Star size={17} /><span>Add all to star</span></button><button className={`menu-item unfavourite${(fc.total === 0 || !isStarred) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isStarred && handleFolderStarAll('subscriptions', false)}><StarOff size={17} /><span>Remove all from star</span></button><div className="label-menu-divider" /><button className={`menu-item markread${mUnread === 0 ? ' no-click' : ''}`} onClick={() => mUnread > 0 && handleFolderMarkAllRead('subscriptions')}><span style={{ position: 'relative', display: 'inline-flex' }}><MailOpen size={17} /><span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10.5} color="#34a853" strokeWidth={4} style={{ width: '10.5px', height: '10.5px' }} /></span></span><span>Mark all as read</span></button><button className={`menu-item markunread${mUnread === mTotal || mTotal === 0 ? ' no-click' : ''}`} onClick={() => mUnread < mTotal && mTotal > 0 && handleFolderMarkAllUnread('subscriptions')}><span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={17} /><span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span><span>Mark all as unread</span></button><div className="label-menu-divider" /><button className={`menu-item snooze${(fc.total === 0 || isSnoozed) ? ' no-click' : ''}`} onMouseOver={(e) => { e.stopPropagation(); if (fc.total > 0 && !isSnoozed) handleFolderSnoozeHover(e, 'subscriptions'); else scheduleCloseSnoozeMenu(); }} onClick={(e) => e.stopPropagation()}><AlarmClock size={17} /><span>Add all to snooze</span><ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} /></button><button className={`menu-item unsnooze${(fc.total === 0 || !isSnoozed) ? ' no-click' : ''}`} onClick={() => fc.total > 0 && isSnoozed && handleFolderSnoozeAll('subscriptions', false)}><AlarmClockOff size={17} /><span>Remove all from snoozed</span></button><div className="label-menu-divider" /><button className="menu-item empty" onClick={() => handleFolderEmpty('subscriptions')}><Eraser size={17} /><span>Empty</span></button><button className="menu-item newtab" onClick={() => handleFolderOpenNewTab('subscription')}><ExternalLink size={17} /><span>Open in new tab</span></button></>}
        {openFolderMenu === 'manage-labels' && <>{renderFolderMenuHeader('manage-labels')}<button className="menu-item refresh" onClick={() => setOpenFolderMenu(null)}><RefreshCw size={17} /><span>Refresh</span></button></>}
      </div>,
      document.body
    )
    })()}
    {customSnoozePopupFolder !== null && createPortal(
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setCustomSnoozePopupFolder(null); setCustomSnoozeDate('') }}>
        <div style={{ background: '#f0f0f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter' && customSnoozeDate && customSnoozePopupFolder) { e.preventDefault(); const hour24 = snoozePeriod === 'AM' ? snoozeHour % 12 : (snoozeHour % 12) + 12; const dateTimeStr = `${customSnoozeDate}T${String(hour24).padStart(2,'0')}:${String(snoozeMinute).padStart(2,'0')}`; const diff = new Date(dateTimeStr).getTime() - Date.now(); const hours = diff / (1000 * 60 * 60); handleFolderSnoozeAll(customSnoozePopupFolder, true, hours > 0 ? hours : 0.01); setCustomSnoozePopupFolder(null); setCustomSnoozeDate(''); } }} tabIndex={-1}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlarmClock size={17} color="#fb8c00" />
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#333' }}>Pick date &amp; time</span>
          </div>
          {(() => {
            const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
            const todayStr = new Date().toISOString().slice(0, 10)
            const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate()
            const firstDay = new Date(calendarViewYear, calendarViewMonth, 1).getDay()
            return (
              <div style={{ display: 'flex' }}>
                <div style={{ padding: '22px 20px', borderRight: '1px solid #e0e0e0', width: '310px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>{MONTH_NAMES[calendarViewMonth]} {calendarViewYear}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={(e) => { e.stopPropagation(); calendarViewMonth === 0 ? (setCalendarViewMonth(11), setCalendarViewYear(y => y - 1)) : setCalendarViewMonth(m => m - 1) }} style={{ background: 'white', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#666', width: '32px', height: '32px', borderRadius: '50%' }}>‹</button>
                      <button onClick={(e) => { e.stopPropagation(); calendarViewMonth === 11 ? (setCalendarViewMonth(0), setCalendarViewYear(y => y + 1)) : setCalendarViewMonth(m => m + 1) }} style={{ background: 'white', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#666', width: '32px', height: '32px', borderRadius: '50%' }}>›</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)', marginBottom: '6px' }}>
                    {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ fontSize: '12px', color: '#bbb', textAlign: 'center', padding: '4px 0', fontWeight: 600 }}>{d}</div>)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)', gap: '2px', minHeight: '238px' }}>
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                      const dateStr = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                      const isSelected = customSnoozeDate === dateStr
                      const isToday = dateStr === todayStr
                      const isPast = dateStr < todayStr
                      return (
                        <button key={day} disabled={isPast} onClick={(e) => { e.stopPropagation(); setCustomSnoozeDate(dateStr) }} style={{ width: '38px', height: '38px', backgroundColor: 'white', border: 'none', borderRadius: '50%', cursor: isPast ? 'default' : 'pointer', background: isSelected ? '#0288d1' : '#f5f5f5', color: isSelected ? '#fff' : isPast ? '#ddd' : isToday ? '#0288d1' : '#333', fontWeight: isSelected || isToday ? 700 : 400, fontSize: '14px' }}>{day}</button>
                      )
                    })}
                  </div>
                </div>
                <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '28px', width: '230px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '14px', color: '#888', fontWeight: 500 }}>Date</div>
                    <div style={{ fontSize: '15px', color: customSnoozeDate ? '#333' : '#ccc', fontWeight: customSnoozeDate ? 500 : 400, minHeight: '22px' }}>{customSnoozeDate ? (() => { const [y,m,d] = customSnoozeDate.split('-'); return `${d}/${m}/${y}` })() : 'DD/MM/YYYY'}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '14px', color: '#888', fontWeight: 500 }}>Time</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <input type="number" min={1} max={12} value={snoozeHour} onChange={(e) => setSnoozeHour(Number(e.target.value))} style={{ width: '50px', padding: '7px 4px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '15px', textAlign: 'center' }} />
                      <span style={{ fontWeight: 700, color: '#555', fontSize: '16px' }}>:</span>
                      <input type="number" min={0} max={59} value={String(snoozeMinute).padStart(2, '0')} onChange={(e) => setSnoozeMinute(Number(e.target.value))} style={{ width: '50px', padding: '7px 4px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '15px', textAlign: 'center' }} />
                      <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid #c0c0c0', marginLeft: '4px' }}>
                        {(['AM', 'PM'] as const).map(p => <button key={p} onClick={() => setSnoozePeriod(p)} style={{ padding: '6px 4px', border: 'none', cursor: 'pointer', background: snoozePeriod === p ? '#0288d1' : '#fafafa', color: snoozePeriod === p ? '#fff' : '#999' }}>{p}</button>)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid #e0e0e0' }}>
            <button onClick={() => { setCustomSnoozePopupFolder(null); setCustomSnoozeDate('') }} style={{ width: '90px', padding: '8px 0', borderRadius: '20px', border: '1.5px solid #c0c0c0', background: '#fff', color: '#555', fontSize: '15px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
            <button disabled={!customSnoozeDate} onClick={(e) => {
              e.stopPropagation()
              if (!customSnoozeDate) return
              const hour24 = snoozePeriod === 'AM' ? snoozeHour % 12 : (snoozeHour % 12) + 12
              const dateTimeStr = `${customSnoozeDate}T${String(hour24).padStart(2,'0')}:${String(snoozeMinute).padStart(2,'0')}`
              const date = new Date(dateTimeStr)
              const diff = date.getTime() - new Date().getTime()
              const hours = diff / (1000 * 60 * 60)
              handleFolderSnoozeAll(customSnoozePopupFolder, true, hours > 0 ? hours : 0.01)
              setCustomSnoozePopupFolder(null)
              setCustomSnoozeDate('')
            }} style={{ width: '90px', padding: '8px 0', borderRadius: '20px', border: 'none', background: customSnoozeDate ? '#0288d1' : '#b3d9f0', color: '#fff', fontSize: '15px', cursor: customSnoozeDate ? 'pointer' : 'not-allowed', fontWeight: 600 }}>Save</button>
          </div>
        </div>
      </div>,
      document.body
    )}
    {folderSnoozeMenu !== null && createPortal(
      <div
        className="snooze-dropdown"
        style={{ position: 'fixed', top: folderSnoozeMenu.top, left: folderSnoozeMenu.left, zIndex: 99999, width: '300px' }}
        onClick={(e) => e.stopPropagation()}
          onMouseOver={cancelCloseSnoozeMenu}
          onMouseLeave={scheduleCloseSnoozeMenu}
      >
        <div style={{ padding: '8px 14px 6px', fontSize: '12px', fontWeight: 600, color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={13} style={{ flexShrink: 0 }} />
          Snooze until...
        </div>
        {getDynamicSnoozeOptions().map(opt => (
          <button key={opt.label} className="dropdown-option" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }} onClick={() => { handleFolderSnoozeAll(folderSnoozeMenu.folder, true, opt.hours); setFolderSnoozeMenu(null); }}>
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
              onClick={(e) => { e.stopPropagation(); const ref = new Date(); const h = ref.getHours(); setSnoozeHour(h % 12 || 12); setSnoozeMinute(ref.getMinutes()); setSnoozePeriod(h >= 12 ? 'PM' : 'AM'); setCalendarViewMonth(ref.getMonth()); setCalendarViewYear(ref.getFullYear()); setCustomSnoozeDate(''); setCustomSnoozePopupFolder(folderSnoozeMenu.folder); setFolderSnoozeMenu(null); setOpenFolderMenu(null); }}
          >
            <Calendar size={15} style={{ flexShrink: 0 }} />
            Pick date &amp; time
          </button>
        </div>
      </div>,
      document.body
    )}
    {filePreview && createPortal(
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setFilePreview(null)}>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #eee' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={filePreview.name}>{filePreview.name}</h3>
            <button onClick={() => setFilePreview(null)} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#e0e0e0'} onMouseLeave={e => e.currentTarget.style.background = '#f5f5f5'}><X size={18} /></button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9f9f9', borderRadius: '8px', minHeight: '300px' }}>
            {filePreview.dataUrl ? (
              <img src={filePreview.dataUrl} alt={filePreview.name} style={{ maxWidth: '100%', maxHeight: 'calc(90vh - 100px)', objectFit: 'contain' }} />
            ) : (
              <div style={{ padding: '40px', color: '#999', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <FileText size={64} style={{ opacity: 0.5 }} />
                <span style={{ fontSize: '15px', fontWeight: 500 }}>Preview not available for this file type</span>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    )}
    {token && <AiFloatingButton token={token} />}
    {token && showFeedback && <FeedbackModal token={token} onClose={() => setShowFeedback(false)} />}
    </>
    </ErrorBoundary>
  )
}

export default App
