import { useState, useEffect, useRef, useCallback, useMemo, cloneElement, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { MessageSquare, ArrowLeft, Mail, MailOpen, Check, Star, StarOff, Reply, Forward, Clock, AlertOctagon, Trash2, Archive, ArchiveRestore, RotateCcw, Send, AlarmClock, AlarmClockOff, Calendar, Sparkles, RefreshCw, Eye, EyeOff, Bold, Italic, Underline, Strikethrough, List, Link, Paperclip, Smile, ChevronDown, ChevronLeft, ChevronRight, Subscript, Superscript, Highlighter, Quote, Image, PenLine, Table2, Undo2, Redo2, MousePointer2, Lasso, Pencil, Eraser, Minus, Square, CheckSquare, Circle, Triangle, Diamond, Hand, ZoomIn, ZoomOut, Flag, FlagOff, FolderInput, Folder, FolderOpen, Tag, Plus, Printer, MoreVertical, BookOpen, Users, UserMinus, X as XIcon, AppWindow, Scissors, Copy, ClipboardPaste, MousePointer, ClipboardList, GitMerge, FileText, Download, CornerRightDown, SlidersHorizontal, ListFilter, SquareStack, Film, ShieldCheck, Pin, PinOff, Bell, BellOff, Ban, Inbox, BarChart2, AlertCircle, Edit } from 'lucide-react'
import ColorPicker from '../components/ColorPicker'

function bodyPreview(body: string, hasAttachments?: boolean, canvasActive?: boolean): string {
  if (!body && !canvasActive && !hasAttachments) return ''
  const hasDrawing = /<img[^>]*data-canvas-draft="1"[^>]*src="data:image/i.test(body)
  const hasCanvas = canvasActive || /data-canvas-draft="1"|data-canvas-saved="1"/i.test(body)
  const text = (() => {
    try {
      const _d = new DOMParser().parseFromString(`<div>${body || ''}</div>`, 'text/html')
      _d.querySelectorAll('[data-file-card],[data-canvas-draft],[data-canvas-saved]').forEach(el => el.remove())
      return (_d.querySelector('div')?.textContent || '').replace(/\s+/g, ' ').trim()
    } catch {
      return (body || '').replace(/<span\b[^>]*data-file-card[^>]*>[\s\S]*?<\/span>/gi, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    }
  })()
  const parts: string[] = []
  if (hasCanvas) parts.push(canvasActive && !hasDrawing ? '📐 Drawing' : hasDrawing ? '📐 Drawing' : '📐 Canvas')
  if (text) parts.push(text.substring(0, 80))
  return parts.join(' · ')
}

function extractAttachments(body: string): { name: string; isFolder: boolean }[] {
  if (!body) return []
  const items: { name: string; isFolder: boolean }[] = []
  const tagRx = /<span\b[^>]*data-file-card[^>]*>/gi
  const attRx = /data-attachment="([^"]+)"/
  const folderRx = /data-folder-card="1"/
  let m
  while ((m = tagRx.exec(body)) !== null) {
    const a = attRx.exec(m[0])
    if (a) {
      const name = (() => { try { return decodeURIComponent(a[1]) } catch { return a[1] } })()
      items.push({ name, isFolder: folderRx.test(m[0]) })
    }
  }
  return items
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

function ChatFileCardsRow({ html }: { html: string }) {
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
      const GAP = 4
      const BADGE_W = 36
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
    <div ref={outerRef} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '5px', width: '100%', minWidth: 0, overflow: 'hidden' }}>
      <Paperclip size={13} style={{ color: '#888', flexShrink: 0 }} />
      {cardHtmls.slice(0, shown).map((cardHtml, i) => (
        <div key={i} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: cardHtml }} />
      ))}
      {hidden > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#666', background: '#e0e0e0', borderRadius: '50%', width: '28px', height: '28px', flexShrink: 0 }}>
          +{hidden}
        </span>
      )}
    </div>
  )
}

const AVATAR_COLORS = [
  '#1565c0', '#c62828', '#2e7d32', '#e65100', '#6a1b9a',
  '#00695c', '#ad1457', '#00838f', '#558b2f', '#5d4037',
  '#37474f', '#4527a0', '#c84315', '#00707b', '#e64a19',
]

function mixColors(color1: string, color2: string, amount: number): string {
  const c1 = parseInt(color1.replace('#', ''), 16)
  const c2 = parseInt(color2.replace('#', ''), 16)
  const r = Math.round(((c1 >> 16) & 255) * (1 - amount) + ((c2 >> 16) & 255) * amount)
  const g = Math.round(((c1 >> 8) & 255) * (1 - amount) + ((c2 >> 8) & 255) * amount)
  const b = Math.round((c1 & 255) * (1 - amount) + (c2 & 255) * amount)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function getAvatarColor(email: string): string {
  if (!email) return '#cccccc'
  const addr = email.match(/<([^>]+)>/)?.[1] ?? email
  let hash = 0
  for (let i = 0; i < addr.length; i++) {
    hash = ((hash << 5) - hash) + addr.charCodeAt(i)
    hash = hash & hash
  }
  return mixColors(AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length], '#e8e8e8', 0.4)
}

function getAvatarInitials(email: string): string {
  if (!email) return '?'
  const addr = email.match(/<([^>]+)>/)?.[1] ?? email
  const [name, domain] = addr.split('@')
  if (!name || !domain) return '??'
  return name.charAt(0).toUpperCase() + domain.charAt(0).toUpperCase()
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

const ActionButton = ({ icon, hoverIcon, title, label, toolbar, onClick, disabled, hoverBg, active, activeColor = 'white', crossColor, noCross, square, noBorder, partial, lightActive }: { icon: React.ReactNode; hoverIcon?: React.ReactNode; title: string; label?: string; toolbar?: boolean; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; disabled?: boolean; hoverBg?: string; active?: boolean; activeColor?: string; crossColor?: string; noCross?: boolean; square?: boolean; noBorder?: boolean; partial?: boolean; lightActive?: boolean }) => {
  const [hovered, setHovered] = useState(false)
  const btn = toolbar ? (
    <button
      onClick={disabled ? undefined : (e) => onClick(e)}
      title={title}
      disabled={disabled}
      style={{
        background: active && hoverBg ? hoverBg : 'transparent',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? '#ccc' : active ? (hoverBg ?? activeColor) : '#666',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '30px',
        width: '30px',
        borderRadius: square ? '6px' : '50%',
        transition: 'background-color 0.15s ease, color 0.15s ease',
        position: 'relative',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        setHovered(true)
        if (!disabled) {
          e.currentTarget.style.backgroundColor = hoverBg ? (active ? hoverBg : hoverBg + '22') : '#e8e8e8'
          e.currentTarget.style.color = hoverBg ?? '#333'
        }
      }}
      onMouseLeave={(e) => {
        setHovered(false)
        if (!disabled) {
          e.currentTarget.style.backgroundColor = active && hoverBg ? hoverBg : 'transparent'
          e.currentTarget.style.color = active ? (hoverBg ?? activeColor) : '#666'
        }
      }}
    >
      {hoverIcon && hovered && !disabled ? hoverIcon : icon}
    </button>
  ) : (
    <button
      onClick={disabled ? undefined : (e) => onClick(e)}
      title={title}
      disabled={disabled}
      style={{
        background: active && lightActive && hoverBg ? hoverBg + '22' : active && hoverBg ? hoverBg : 'none',
        border: noBorder ? 'none' : (disabled ? '1px solid #ccc' : active ? '1px solid #999' : '1px solid #ddd'),
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? '#ccc' : active && lightActive ? (hoverBg ?? activeColor) : active ? activeColor : partial ? (hoverBg ?? activeColor) : '#666',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '30px',
        width: '30px',
        borderRadius: square ? '6px' : '50%',
        transition: 'all 0.2s ease',
        position: 'relative',
        opacity: disabled ? 0.5 : 1,
        boxShadow: active && !lightActive ? '0 2px 4px rgba(0, 0, 0, 0.4)' : 'none',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        setHovered(true)
        if (!disabled) {
          e.currentTarget.style.boxShadow = active && lightActive ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.6)'
          if (!noBorder) e.currentTarget.style.borderColor = '#999'
          if (hoverBg) {
            if (active && lightActive) {
              e.currentTarget.style.backgroundColor = hoverBg + '22'
              e.currentTarget.style.color = hoverBg
            } else if (active) {
              e.currentTarget.style.backgroundColor = hoverBg
              e.currentTarget.style.color = activeColor
            } else {
              e.currentTarget.style.backgroundColor = 'white'
              e.currentTarget.style.color = hoverBg
            }
          }
        }
      }}
      onMouseLeave={(e) => {
        setHovered(false)
        if (!disabled) {
          e.currentTarget.style.boxShadow = active && !lightActive ? '0 2px 4px rgba(0, 0, 0, 0.4)' : 'none'
          if (!noBorder) e.currentTarget.style.borderColor = active ? '#999' : '#ddd'
          e.currentTarget.style.backgroundColor = active && lightActive && hoverBg ? hoverBg + '22' : active && hoverBg ? hoverBg : 'transparent'
          e.currentTarget.style.color = active && lightActive ? (hoverBg ?? activeColor) : active ? activeColor : '#666'
        }
      }}
    >
      {hoverIcon && hovered && !disabled ? hoverIcon : icon}
      {active && hovered && !disabled && !noCross && (
        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ position: 'absolute', width: '20px', height: '1.5px', backgroundColor: crossColor ?? 'currentColor', transform: 'rotate(-45deg)' }} />
        </span>
      )}
    </button>
  )
  if (!label) return btn
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', cursor: 'default' }}>
      {btn}
      <span style={{ fontSize: '9px', lineHeight: 1, whiteSpace: 'nowrap', color: disabled ? '#666' : (active || partial) ? (hoverBg ?? activeColor) : '#666' }}>{label}</span>
    </div>
  )
}

const UndoCountdown = () => {
  const [timeLeft, setTimeLeft] = useState(5)
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(timer)
  }, [])
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{timeLeft > 0 ? `${timeLeft}s` : '...'}</span>
}

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  cc?: string | null
  bcc?: string | null
  date: string
  body: string
  folder?: string
  isRead?: boolean
  isStarred?: boolean
  isImportant?: boolean
  isSnoozed?: boolean
  snoozedUntil?: string
  isSpam?: boolean
  isReport?: boolean
  isPinned?: boolean
  isMuted?: boolean
  isDeleted?: boolean
  isArchived?: boolean
  isScheduled?: boolean
  scheduledFor?: string
  isDraft?: boolean
  label_name?: string | null
  hasAttachments?: boolean
  // Tags a group-compose send — used to route it into a dedicated group conversation
  // instead of folding it into whichever member's individual 1-on-1 thread.
  groupId?: number | null
}
  
interface Message {
  id: number
  subject: string
  content: string
  timestamp: string
  date?: string
  incoming: boolean
  emailId?: number
  cc?: string | null
  bcc?: string | null
  isRead?: boolean
  isStarred?: boolean
  isImportant?: boolean
  isSnoozed?: boolean
  snoozedUntil?: string
  isSpam?: boolean
  isReport?: boolean
  isPinned?: boolean
  isMuted?: boolean
  isDeleted?: boolean
  isArchived?: boolean
  isPending?: boolean
  isRestoredPending?: boolean
  isScheduled?: boolean
  scheduledFor?: string
  attachments?: Array<{ name: string; size: number; dataUrl?: string }>
}

interface Conversation {
  id: string
  name: string
  email: string
  initials: string
  preview: string
  isRead?: boolean
  isSent?: boolean
  isScheduled?: boolean
  isDraft?: boolean
  draftEmail?: Email
  lastEmail?: Email
  nextScheduledEmail?: Email
  unreadCount?: number
  totalCount?: number
  upcomingScheduledCount?: number
  // Set for a dedicated group thread (see groupEmailsByContact) — its messages are
  // matched by group_id rather than by a single contact's address.
  groupId?: number
}

interface Props {
  token: string
  userEmail: string
  contactEmail?: string
  highlightedEmailId?: number | null
  onEmailReadChange?: (emailId: number, isRead: boolean) => void
  externalReadUpdate?: { emailId: number; isRead: boolean } | null
  onEmailDeleteChange?: (emailId: number, isDeleted: boolean) => void
  externalDeleteUpdate?: { emailId: number; isDeleted: boolean } | null
  onClose?: () => void
  // Clears the App-level "this is a composeMode session" flags (without navigating —
  // that's what onClose is for) so clicking back on a reply/forward draft doesn't leave
  // composeMode stuck true, which would otherwise keep the "Chat Mail" sidebar button
  // from ever showing as active again.
  onComposeModeExit?: () => void
  composeMode?: boolean
  draftEmail?: Email | null
  onDraftLoaded?: () => void
  initialReplyMessage?: string | null
  replyData?: { action: 'reply' | 'replyAll' | 'forward'; subject: string; from: string; to: string; body: string; date: string } | null
  onReplyDataLoaded?: () => void
  // Pre-fills the composer with multiple recipients (e.g. "Compose to group") regardless
  // of whether this instance is already mounted — unlike sessionStorage + the
  // openChatMailCompose event, a prop change always re-applies via the effect below.
  // groupLabel, when set, collapses these recipients into a single named chip in the
  // To field (e.g. "Marketing Team (3)") instead of listing every member's email —
  // delivery is unaffected, `to` still holds the real addresses actually sent to.
  composeRecipients?: { to: string[]; subject: string; groupLabel?: string; groupId?: number } | null
  onComposeRecipientsLoaded?: () => void
  onFloatingChange?: (floating: boolean, draftId: number | null) => void
  // Reports whenever this instance's own panel becomes minimized/un-minimized, so the
  // app can reserve space at the bottom of email/conversation lists for the strip row
  // instead of letting it overlay list content.
  onMinimizedChange?: (minimized: boolean) => void
  // True app-wide whenever at least one minimized strip exists anywhere — list
  // containers use this to shrink and leave room for the strip row below them.
  hasMinimizedStrip?: boolean
  // Looks up which contact (or null for the main/generic compose) currently owns an
  // active floating session for a given draftId — lets the list-click handler tell
  // "this draft is mine" apart from "this draft is actually being edited by a
  // different, still-mounted instance" (e.g. a forward/reply card started from inside
  // a contact's thread, which floats within that contact's own instance, not main's).
  getFloatingDraftOwner?: (draftId: number) => string | null | undefined
  onOpenContact?: (email: string) => void
  // Position among all currently-minimized strips (0 = rightmost), so multiple
  // minimized panels line up side-by-side instead of stacking on top of each other.
  floatSlotIndex?: number
  // Changes on every app-level navigation (route change or switching which contact/email
  // is open) regardless of which contact — used to auto re-minimize an expanded floating
  // panel the instant the user navigates anywhere, since expanding a panel never itself
  // changes this key (it floats independently of whatever's the "active" page/thread).
  navKey?: string
  // Whether this contact's thread is the one currently opened/being viewed. Used to
  // auto-expand this contact's own minimized draft the moment its email/conversation
  // item is opened, instead of leaving it collapsed in the bottom row.
  isActiveView?: boolean
}

type FolderEntry = { type: 'file'; name: string } | { type: 'folder'; name: string; children: FolderEntry[] }

const buildFolderTree = (files: File[]): FolderEntry[] => {
  const root: FolderEntry[] = []
  for (const file of files) {
    const parts = ((file as any).webkitRelativePath as string || file.name).split('/')
    let current = root
    for (let i = 1; i < parts.length - 1; i++) {
      let folder = current.find(n => n.type === 'folder' && n.name === parts[i]) as Extract<FolderEntry, { type: 'folder' }> | undefined
      if (!folder) { folder = { type: 'folder', name: parts[i], children: [] }; current.push(folder) }
      current = folder.children
    }
    current.push({ type: 'file', name: parts[parts.length - 1] })
  }
  return root
}

const countFolderItems = (entries: FolderEntry[]): { files: number; folders: number } =>
  entries.reduce((acc, e) => e.type === 'file'
    ? { ...acc, files: acc.files + 1 }
    : { ...acc, folders: acc.folders + 1 },
    { files: 0, folders: 0 })

const REPLY_DRAFT_SEPARATOR = '\n\n--- Original Message ---\n'

function parseReplyDraft(body: string, subject: string): {
  userText: string
  card: { action: 'reply' | 'replyAll' | 'forward'; subject: string; from: string; to: string; body: string; date: string; sourceMessageId?: number } | null
} {
  const idx = body.indexOf(REPLY_DRAFT_SEPARATOR)
  if (idx === -1) return { userText: body, card: null }

  const userText = body.slice(0, idx)
  const quotedBlock = body.slice(idx + REPLY_DRAFT_SEPARATOR.length)
  const lines = quotedBlock.split('\n')

  let from = '', date = '', origSubject = '', sourceMessageId: number | undefined, bodyStart = lines.length
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('From: ')) from = lines[i].slice(6)
    else if (lines[i].startsWith('Date: ')) date = lines[i].slice(6)
    else if (lines[i].startsWith('Subject: ')) origSubject = lines[i].slice(9)
    else if (lines[i].startsWith('SourceId: ')) { const n = parseInt(lines[i].slice(10)); if (!isNaN(n)) sourceMessageId = n }
    else if (lines[i] === '') { bodyStart = i + 1; break }
  }

  const origBody = lines.slice(bodyStart).join('\n')
  const action: 'reply' | 'replyAll' | 'forward' = /^(Fwd:|Fw:)\s/i.test(subject.trim()) ? 'forward' : 'reply'
  return { userText, card: { action, from, date, subject: origSubject, body: origBody, to: '', sourceMessageId } }
}

export default function ChatMailPage({ token, userEmail, contactEmail, highlightedEmailId, onEmailReadChange, externalReadUpdate, onEmailDeleteChange, externalDeleteUpdate, onClose, onComposeModeExit, composeMode, draftEmail, onDraftLoaded, initialReplyMessage, replyData, onReplyDataLoaded, composeRecipients, onComposeRecipientsLoaded, onFloatingChange, onOpenContact, floatSlotIndex = 0, navKey, isActiveView = false, getFloatingDraftOwner, onMinimizedChange, hasMinimizedStrip = false }: Props) {
  const location = useLocation()
  const isPopout = window.name === 'compose_window'
  const [conversations, setConversations] = useState<Conversation[]>([])
  // groupId -> display info, used to route group-tagged emails into their own dedicated
  // conversation entry instead of folding them into a member's individual thread.
  const [groupsById, setGroupsById] = useState<Map<number, { email: string; name: string }>>(new Map())
  const groupsByIdRef = useRef(groupsById)
  groupsByIdRef.current = groupsById
  const [now, setNow] = useState(Date.now())
  // These 'chat_*' sessionStorage keys are global/unscoped, shared by whichever instance
  // last wrote them — fine for the single main/generic instance they were designed for,
  // but a per-contact instance must NOT seed its own draft from them (it would briefly
  // show whatever contact last wrote, until its own contactEmail-driven effect corrects
  // it). Per-contact instances instead restore their content straight from the server's
  // conversation.draftEmail (see the "Auto-select conversation" effect below).
  const [selectedConversation, setSelectedConversation] = useState<string | null>(() => contactEmail ? null : sessionStorage.getItem('chat_selectedConversation'))
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState(() => {
    if (contactEmail) return ''
    const popoutVal = localStorage.getItem('newwin_compose_body')
    return popoutVal !== null ? popoutVal : (sessionStorage.getItem('chat_inputValue') || '')
  })
  const [subjectValue, setSubjectValue] = useState(() => {
    if (contactEmail) return ''
    const popoutVal = localStorage.getItem('newwin_compose_subject')
    return popoutVal !== null ? popoutVal : (sessionStorage.getItem('chat_subjectValue') || '')
  })
  const [toEmails, setToEmails] = useState<string[]>(() => {
    if (contactEmail) return []
    try {
      const popoutVal = localStorage.getItem('newwin_compose_to')
      if (popoutVal !== null) return JSON.parse(popoutVal)
      const s = sessionStorage.getItem('chat_toEmails')
      return s ? JSON.parse(s) : []
    } catch { return [] }
  })
  const [initialToEmails, setInitialToEmails] = useState<string[]>(() => {
    if (contactEmail) return [contactEmail]
    try {
      const s = sessionStorage.getItem('chat_initialToEmails')
      if (s) return JSON.parse(s)
    } catch {}
    try {
      const popoutVal = localStorage.getItem('newwin_compose_to')
      if (popoutVal !== null) return JSON.parse(popoutVal)
      const s = sessionStorage.getItem('chat_toEmails')
      return s ? JSON.parse(s) : []
    } catch { return [] }
  })
  const [toInput, setToInput] = useState(() => contactEmail ? '' : (sessionStorage.getItem('chat_toInput') || ''))
  const [ccEmails, setCcEmails] = useState<string[]>(() => {
    if (contactEmail) return []
    try {
      const popoutVal = localStorage.getItem('newwin_compose_cc')
      if (popoutVal !== null) return JSON.parse(popoutVal)
      const s = sessionStorage.getItem('chat_ccEmails')
      return s ? JSON.parse(s) : []
    } catch { return [] }
  })
  const [ccInput, setCcInput] = useState(() => contactEmail ? '' : (sessionStorage.getItem('chat_ccInput') || ''))
  const [bccEmails, setBccEmails] = useState<string[]>(() => {
    if (contactEmail) return []
    try {
      const popoutVal = localStorage.getItem('newwin_compose_bcc')
      if (popoutVal !== null) return JSON.parse(popoutVal)
      const s = sessionStorage.getItem('chat_bccEmails')
      return s ? JSON.parse(s) : []
    } catch { return [] }
  })
  const [bccInput, setBccInput] = useState(() => contactEmail ? '' : (sessionStorage.getItem('chat_bccInput') || ''))
  const [messageSent, setMessageSent] = useState(false)
  const [showCc, setShowCc] = useState(() => !contactEmail && sessionStorage.getItem('chat_showCc') === 'true')
  const [showBcc, setShowBcc] = useState(() => !contactEmail && sessionStorage.getItem('chat_showBcc') === 'true')
  const [sendDropdownOpen, setSendDropdownOpen] = useState(false)
  const [sendDropdownPos, setSendDropdownPos] = useState<{ bottom: number; right: number } | null>(null)
  const [showSchedulePopup, setShowSchedulePopup] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleHour, setScheduleHour] = useState(12)
  const [scheduleMinute, setScheduleMinute] = useState(0)
  const [schedulePeriod, setSchedulePeriod] = useState<'AM' | 'PM'>('PM')
  const [calendarViewMonth, setCalendarViewMonth] = useState(new Date().getMonth())
  const [calendarViewYear, setCalendarViewYear] = useState(new Date().getFullYear())
  const [hoveredCalendarDay, setHoveredCalendarDay] = useState<string | null>(null)
  const [showSnoozePopup, setShowSnoozePopup] = useState<number | null>(null)
  const [snoozeDate, setSnoozeDate] = useState('')
  const [snoozeHour, setSnoozeHour] = useState(12)
  const [snoozeMinute, setSnoozeMinute] = useState(0)
  const [snoozePeriod, setSnoozePeriod] = useState<'AM' | 'PM'>('PM')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [subjectWarning, setSubjectWarning] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)
  const [allEmails, setAllEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'chat'>(() => {
    // A folder is being (or was being, before a refresh) proxied through Chat Mail — stay
    // on the list view for it instead of falling back to whatever chat_viewMode was stored.
    const persistedTab = sessionStorage.getItem('chat_persistedListTab')
    if (persistedTab && persistedTab !== 'all') return 'list'
    if (contactEmail || composeMode) return 'chat'
    if (window.name === 'compose_window') return 'chat'
    return (sessionStorage.getItem('chat_viewMode') as 'list' | 'chat') || 'list'
  })
  const [reloadKey, setReloadKey] = useState(0)   // incremented only when new emails are fetched
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState<number | null>(null)
  const [viewedDeletedIds, setViewedDeletedIds] = useState<Set<number>>(new Set())
  const [activeField, setActiveField] = useState<'to' | 'cc' | 'bcc' | null>(null)
  const [scrollToBottom, setScrollToBottom] = useState<'smooth' | 'instant' | false>(false)
  const [inputPanelHeight, setInputPanelHeight] = useState(248)
  const [composePanelExpanded, setComposePanelExpanded] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; size: number; dataUrl?: string }>>(() => {
    if (contactEmail) return []
    try {
      const popoutVal = localStorage.getItem('newwin_compose_attachments')
      if (popoutVal !== null) return JSON.parse(popoutVal)
      const s = sessionStorage.getItem('chat_attachments'); return s ? JSON.parse(s) : []
    } catch { return [] }
  })
  const attachedFilesRef = useRef<Array<{ name: string; size: number; dataUrl?: string }>>([])
  attachedFilesRef.current = attachedFiles
  const [lastOpenedConversationId, setLastOpenedConversationId] = useState<string | null>(null)
  const [livePreview, setLivePreview] = useState<{ subject: string; body: string; hasAttachments: boolean; hasCanvas: boolean } | null>(null)
  const prevSelectedConversationRef = useRef<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const commitActiveCanvasToImageRef = useRef<() => string>(() => '')
  // In-app clipboard for the toolbar Copy/Cut/Paste buttons. The OS clipboard
  // (document.execCommand('paste') / navigator.clipboard.read()) is gated behind
  // permission prompts that silently no-op when denied, and canvas elements never
  // carry pixel data through HTML serialization — so file/folder cards and canvas
  // drawings would vanish on paste. Keeping our own copy sidesteps both problems.
  const internalClipboardRef = useRef<string | null>(null)
  // "New window" now floats chatmail-thread-input as an in-page draggable panel
  // instead of opening a real OS window — no separate page load, so no cross-window
  // transfer/sync machinery is needed; it's all the same React state.
  // Scoped per-instance (by contact, or 'main' for the generic compose) so a page
  // refresh restores each floating/minimized panel — and its position/size — exactly
  // as it was left, instead of silently losing it until the user closes it themselves.
  const floatStorageKey = (suffix: string) => `chat_float_${contactEmail || 'main'}_${suffix}`
  const [composeFloating, setComposeFloating] = useState(() => sessionStorage.getItem(floatStorageKey('floating')) === 'true')
  const [composeFloatMinimized, setComposeFloatMinimized] = useState(() => sessionStorage.getItem(floatStorageKey('minimized')) === 'true')
  // Tells the parent (App.tsx) whether THIS instance currently owns an active
  // floating panel, so it knows to keep this instance mounted (hidden) even after
  // the user navigates to a different contact/page — otherwise this contact's
  // floated draft would be torn down the moment it's no longer the active view.
  useEffect(() => { onFloatingChange?.(composeFloating, composeFloating ? draftIdRef.current : null) }, [composeFloating])
  useEffect(() => { onMinimizedChange?.(composeFloating && composeFloatMinimized) }, [composeFloating, composeFloatMinimized])
  useEffect(() => { sessionStorage.setItem(floatStorageKey('floating'), composeFloating ? 'true' : 'false') }, [composeFloating])
  useEffect(() => { sessionStorage.setItem(floatStorageKey('minimized'), composeFloatMinimized ? 'true' : 'false') }, [composeFloatMinimized])
  const [floatPos, setFloatPos] = useState<{ x: number; y: number } | null>(() => {
    try { const s = sessionStorage.getItem(floatStorageKey('pos')); return s ? JSON.parse(s) : null } catch { return null }
  })
  const [floatSize, setFloatSize] = useState<{ width: number; height: number } | null>(() => {
    try { const s = sessionStorage.getItem(floatStorageKey('size')); return s ? JSON.parse(s) : null } catch { return null }
  })
  useEffect(() => {
    if (floatPos) sessionStorage.setItem(floatStorageKey('pos'), JSON.stringify(floatPos))
    else sessionStorage.removeItem(floatStorageKey('pos'))
  }, [floatPos])
  useEffect(() => {
    if (floatSize) sessionStorage.setItem(floatStorageKey('size'), JSON.stringify(floatSize))
    else sessionStorage.removeItem(floatStorageKey('size'))
  }, [floatSize])
  const floatDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const floatResizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; origTop: number; origLeft: number; dir: 'right' | 'bottom' | 'corner' | 'top' | 'left' } | null>(null)
  // Always rendered through a portal (just pointing at different containers) rather
  // than conditionally wrapping with/without one — toggling between "plain child" and
  // "portal-wrapped" changes the tree shape at that position, which makes React unmount
  // and remount the contentEditable DOM node, wiping its (imperatively-held) content.
  const [composeInlineSlot, setComposeInlineSlot] = useState<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const lastMessageRef = useRef<HTMLDivElement>(null)
  const listContainerRef = useRef<HTMLDivElement>(null)
  const savedListScrollPos = useRef<number>(0)
  const initialMountRef = useRef(true)
  const updateReadStatusRef = useRef<(emailId: number, isRead: boolean) => Promise<void>>(async () => {})
  const messagesRef = useRef<Message[]>([])
  messagesRef.current = messages
  const allEmailsRef = useRef<Email[]>([])          // always-current, avoids stale closures
  allEmailsRef.current = allEmails
  const conversationsRef = useRef<Conversation[]>([])
  conversationsRef.current = conversations
  const seenTopRef = useRef<Set<number>>(new Set())
  const highlightScrolledRef = useRef<number | null>(null)
  const pendingTimeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const notifiedScheduledRef = useRef<Set<number>>(new Set())
  const [showPickerDropdown, setShowPickerDropdown] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [attachMenuAnchor, setAttachMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  const [filePreview, setFilePreview] = useState<{ url: string; thumbUrl: string; name: string; ext: string } | null>(null)
  const [previewCodeContent, setPreviewCodeContent] = useState<string | null>(null)
  const [previewCodeLoading, setPreviewCodeLoading] = useState(false)
  const [folderPreview, setFolderPreview] = useState<{ name: string; entries: FolderEntry[] } | null>(null)
  const [folderNavPath, setFolderNavPath] = useState<string[]>([])
  const [sidebarExpanded, setSidebarExpanded] = useState<Set<string>>(new Set(['']))
  const pickerDropdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snoozePickerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showSnoozePickerDropdown, setShowSnoozePickerDropdown] = useState<number | null>(null)
  const [moveToMenuOpen, setMoveToMenuOpen] = useState<number | null>(null)
  const [moveMenuPosition, setMoveMenuPosition] = useState<{ top?: number; bottom?: number; right: number; maxHeight: number } | null>(null)
  const [customLabels, setCustomLabels] = useState<{ id: number; name: string; color: string; children?: any[] }[]>([])
  const [labelSearchQuery, setLabelSearchQuery] = useState('')
  const [expandedMoveLabels, setExpandedMoveLabels] = useState<Set<number>>(new Set())
  const [showCreateLabelModal, setShowCreateLabelModal] = useState(false)
  const [clLabelName, setClLabelName] = useState('')
  const [clLabelColor, setClLabelColor] = useState('')
  const [clParentId, setClParentId] = useState<number | null>(null)
  const [clError, setClError] = useState('')
  const [clLoading, setClLoading] = useState(false)
  const [clShowSubLabelDropdown, setClShowSubLabelDropdown] = useState(false)
  const [expandedCreateSubLabels, setExpandedCreateSubLabels] = useState<Set<number>>(new Set())
  const clSubLabelTriggerRef = useRef<HTMLDivElement>(null)
  const snoozePickerDropdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [snoozePickerPos, setSnoozePickerPos] = useState<{ top: number; left?: number; right?: number } | null>(null)
  const [scheduleNotifications, setScheduleNotifications] = useState<{ id: number; subject: string; to: string }[]>([])
  const draftIdRef = useRef<number | null>(!contactEmail && sessionStorage.getItem('chat_draftId') ? parseInt(sessionStorage.getItem('chat_draftId')!, 10) : null)
  // Tracks which draft the floating panel currently represents, independent of
  // draftIdRef — draftIdRef gets asynchronously nulled by handleBackToList's deferred
  // save-then-clear chain, which raced with the "is this conv's draft the floating one"
  // checks below (intermittently failing to auto-expand depending on whether the user
  // re-clicked the item before or after that async clear landed). This ref only changes
  // when the float itself is created or fully discarded/closed, never on back-navigation.
  // Rehydrated from sessionStorage on mount (mirroring composeFloating/composeFloatMinimized)
  // — without this, a real page reload kept the minimized strip visible (since those two
  // DO persist) but reset this plain ref to null, so the very next click on that draft's
  // row no longer recognized it as "mine" and incorrectly delegated to a fresh, non-floating
  // per-contact view instead of reopening the actual floating panel.
  const floatingDraftIdRef = useRef<number | null>((() => {
    const s = sessionStorage.getItem(floatStorageKey('draftId'))
    return s ? parseInt(s, 10) : null
  })())
  const setFloatingDraftId = (id: number | null) => {
    floatingDraftIdRef.current = id
    if (id != null) sessionStorage.setItem(floatStorageKey('draftId'), id.toString())
    else sessionStorage.removeItem(floatStorageKey('draftId'))
  }
  // Serializes draft save/delete network calls so a second flush triggered
  // immediately after the first (e.g. navigating away right after a debounced
  // save) re-reads draftIdRef AFTER the first request resolves, instead of
  // racing it and creating a duplicate draft.
  const draftSaveChainRef = useRef<Promise<void>>(Promise.resolve())
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveMode = useRef(false)
  const isClearingRef = useRef(false)
  const hasInteractedRef = useRef(false)
  const autoToEmailRef = useRef<string | null>(null)
  const [hideDeletedMessages, setHideDeletedMessages] = useState(false)
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<number>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [listSelectionMode, setListSelectionMode] = useState(false)
  const [pinnedSectionCollapsed, setPinnedSectionCollapsed] = useState(false)
  const [pinnedHeaderHovered, setPinnedHeaderHovered] = useState(false)
  const [chatListTab, setChatListTab] = useState<'all' | 'inbox' | 'sent' | 'group' | 'starred' | 'archive' | 'scheduled' | 'draft' | 'spam' | 'report' | 'delete' | 'snoozed' | string>(
    // Covers the rare case where this component hasn't mounted yet when a folder switch is
    // requested, and restoring the proxied folder after a hard page refresh.
    () => sessionStorage.getItem('chat_persistedListTab') || 'all'
  )
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set())
  const [listSnoozeMenuOpen, setListSnoozeMenuOpen] = useState(false)
  const [listMoveMenuOpen, setListMoveMenuOpen] = useState(false)
  const [listHeaderCheckboxDropdownOpen, setListHeaderCheckboxDropdownOpen] = useState(false)
  const [headerMoreOpen, setHeaderMoreOpen] = useState(false)
  const headerMoreBtnRef = useRef<HTMLButtonElement>(null)
  const [convPinned, setConvPinned] = useState(false)
  const [groupedEmails, setGroupedEmails] = useState<Set<string>>(new Set())
  const [convMuted, setConvMuted] = useState(false)
  const [convBlocked, setConvBlocked] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [immersiveMode, setImmersiveMode] = useState(false)
  const [discardFlash, setDiscardFlash] = useState(false)
  const [replyEmailCard, setReplyEmailCard] = useState<{ action: 'reply' | 'replyAll' | 'forward'; subject: string; from: string; to: string; body: string; date: string; sourceMessageId?: number } | null>(() => {
    try {
      const popoutVal = localStorage.getItem('newwin_compose_replyCard')
      if (popoutVal !== null) return JSON.parse(popoutVal)
      const s = sessionStorage.getItem('chat_replyEmailCard'); return s ? JSON.parse(s) : null
    } catch { return null }
  })
  const [replyCardCollapsed, setReplyCardCollapsed] = useState(false)
  // When set, the To field collapses these member emails into one named chip instead of
  // listing each individually — see the composeRecipients prop doc for why.
  const [composeGroupLabel, setComposeGroupLabel] = useState<string | null>(null)
  const [composeGroupMembers, setComposeGroupMembers] = useState<string[]>([])
  // The actual group id sent to the server so the message is tagged and shows up in the
  // Groups page / Chat Mail's dedicated group thread instead of individual mail folders.
  const [composeGroupId, setComposeGroupId] = useState<number | null>(null)
  const [formatTab, setFormatTab] = useState<'text' | 'lists' | 'insert' | 'draw'>('text')
  const [textToolbarOverflow, setTextToolbarOverflow] = useState({ left: false, right: false })
  const [drawToolbarOverflow, setDrawToolbarOverflow] = useState({ left: false, right: false })
  const [showLivePreview, setShowLivePreview] = useState(false)
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set())
  const [drawTool, setDrawTool] = useState('pen')
  const SIZABLE_DRAW_TOOLS = new Set(['pen', 'effect-pen', 'highlight', 'red-pen', 'text', 'eraser', 'line', 'rect', 'circle', 'triangle', 'diamond', 'star'])
  const [drawColor, setDrawColor] = useState('#000000')
  const [drawLineWidth, setDrawLineWidth] = useState(3)
  const [toolColors, setToolColors] = useState<Record<string, string>>({
    'pen': '#000000', 'effect-pen': '#7c4dff', 'highlight': '#ffe066',
    'text': '#000000', 'line': '#000000', 'rect': '#000000', 'circle': '#000000',
    'triangle': '#000000', 'diamond': '#000000', 'star': '#000000',
  })
  const [toolHighlightColors, setToolHighlightColors] = useState<Record<string, string>>({})
  const [customDrawColors, setCustomDrawColors] = useState<string[]>([])
  const [shapeColorMode, setShapeColorMode] = useState<'regular' | 'highlight'>('regular')
  const [shapeColorModeOpen, setShapeColorModeOpen] = useState(false)
  const hexHsl = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
    const l = (max + min) / 2
    let h = 0
    if (d !== 0) {
      h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
      h *= 60; if (h < 0) h += 360
    }
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
    return { h, s, l }
  }
  // Tier: 0 = very thick (deep/saturated), 1 = thick, 2 = light, 3 = very light (pale)
  const colorTier = (s: number, l: number) => {
    if (l > 0.85) return 3
    if (l > 0.65) return 2
    if (l > 0.45 || s < 0.5) return 1
    return 0
  }
  const FAMILY_ORDER = ['red', 'pink', 'green', 'gray', 'orange', 'black', 'yellow', 'blue']
  const colorFamily = (s: number, l: number, h: number) => {
    if (s < 0.12) return l < 0.18 ? 'black' : 'gray'
    if (h < 15 || h >= 345) return 'red'
    if (h < 45) return 'orange'
    if (h < 70) return 'yellow'
    if (h < 170) return 'green'
    if (h < 270) return 'blue'
    return 'pink'
  }
  const sortByHue = (colors: string[]) => {
    const rest = colors.filter(c => c !== 'transparent').sort((a, b) => {
      const ha = hexHsl(a), hb = hexHsl(b)
      const famA = FAMILY_ORDER.indexOf(colorFamily(ha.s, ha.l, ha.h))
      const famB = FAMILY_ORDER.indexOf(colorFamily(hb.s, hb.l, hb.h))
      if (famA !== famB) return famA - famB
      const tierA = colorTier(ha.s, ha.l), tierB = colorTier(hb.s, hb.l)
      if (tierA !== tierB) return tierA - tierB
      return hb.l - ha.l
    })
    return colors.includes('transparent') ? ['transparent', ...rest] : rest
  }
  const PEN_HIGHLIGHT_COLORS = sortByHue(['transparent','#ffff00','#00ff00','#00ffff','#ff00ff','#ff0000','#0000ff','#ffffff',
    '#fff2cc','#fce5cd','#f4cccc','#d9ead3','#d0e0f3','#d9d2e9','#fce4ec','#f3f3f3',
    '#ffd966','#f6b26b','#e06666','#93c47d','#76a5af','#6fa8dc','#8e7cc3','#c27ba0',
    '#ffeb3b','#ff9800','#f44336','#4caf50','#03a9f4','#9c27b0','#e91e63','#607d8b'])
  const PEN_MAIN_COLORS = sortByHue(['#000000','#757575','#bdbdbd','#f44336','#e91e63','#f06292','#9c27b0','#3f51b5','#2196f3','#00bcd4','#009688','#4caf50','#ffeb3b','#ff9800','#795548','#607d8b']
    .filter(c => !['transparent','#ffff00','#00ff00','#00ffff','#ff00ff','#ff0000','#0000ff','#ffffff',
      '#fff2cc','#fce5cd','#f4cccc','#d9ead3','#d0e0f3','#d9d2e9','#fce4ec','#f3f3f3',
      '#ffd966','#f6b26b','#e06666','#93c47d','#76a5af','#6fa8dc','#8e7cc3','#c27ba0',
      '#ffeb3b','#ff9800','#f44336','#4caf50','#03a9f4','#9c27b0','#e91e63','#607d8b'].includes(c)))
  const [canvasTextInput, setCanvasTextInput] = useState<{ x: number; y: number; canvasX: number; canvasY: number; value: string } | null>(null)
  const [drawFontSize, setDrawFontSize] = useState(16)
  const [showDrawTabTextInput, setShowDrawTabTextInput] = useState(false)
  const [drawTabTextValue, setDrawTabTextValue] = useState('')
  const [openPenDropdown, setOpenPenDropdown] = useState<string | null>(null)
  const [penDropdownPos, setPenDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const penDropdownSnapshotRef = useRef<{ tk: string; color: string; toolColor?: string; highlight?: string } | null>(null)
  const [canvasMode, setCanvasMode] = useState(false)
  const [canvasPortalTarget, setCanvasPortalTarget] = useState<HTMLElement | null>(null)
  const canvasModeRef = useRef<HTMLCanvasElement>(null)
  const lassoOverlayRef = useRef<HTMLCanvasElement>(null)
  const lassoPathRef = useRef<{x: number, y: number}[]>([])
  const lassoSelRef = useRef<{ tempCanvas: HTMLCanvasElement; originalCanvas: HTMLCanvasElement; clipPath: {x: number, y: number}[]; x: number; y: number; w: number; h: number; ox: number; oy: number; angle: number; clipShape: string } | null>(null)
  const [hasLassoSel, setHasLassoSel] = useState(false)
  const [lassoClipShape, setLassoClipShape] = useState('lasso')
  const lassoMarchRef = useRef(0)
  const lassoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isCanvasModeDrawing = useRef(false)
  const lastCanvasModePos = useRef({ x: 0, y: 0 })
  const linePointsRef = useRef<{ x: number; y: number }[]>([])
  const lineDraftRef = useRef<{ bg: ImageData; sx: number; sy: number; ex: number; ey: number; color: string; lineW: number } | null>(null)
  const lineDraftCleanupRef = useRef<(() => void) | null>(null)
  type CanvasBoardSnapshot = { dataUrl: string; width: number | null; height: number; offsetX: number; offsetY: number }
  type HistoryEntry = { kind: 'text'; data: string } | { kind: 'canvas'; data: ImageData } | { kind: 'canvas-board-removed'; data: CanvasBoardSnapshot }
  const unifiedUndoStack = useRef<HistoryEntry[]>([])
  const unifiedRedoStack = useRef<HistoryEntry[]>([])
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)
  // aliases kept for canvas-specific guards
  const canvasUndoCount = undoCount
  const canvasRedoCount = redoCount
  const getCanvasModePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasModeRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }
  const pushCanvasSnapshot = () => {
    const canvas = canvasModeRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    unifiedUndoStack.current.push({ kind: 'canvas', data: ctx.getImageData(0, 0, canvas.width, canvas.height) })
    unifiedRedoStack.current = []
    setUndoCount(unifiedUndoStack.current.length)
    setRedoCount(0)
  }
  const MINIMIZED_STRIP_WIDTH = 300
  const MINIMIZED_STRIP_GAP = 12
  const MAX_VISIBLE_MINIMIZED_STRIPS = 3
  // Beyond the 3rd slot, a minimized strip is folded into the "+N" overflow badge
  // (rendered by the parent) instead of drawing its own — still floating/preserved,
  // just not occupying more of the bottom row.
  const isOverflowedMinimized = composeFloatMinimized && floatSlotIndex >= MAX_VISIBLE_MINIMIZED_STRIPS
  // Docks this panel's minimized strip at slotIndex's position along the bottom of the
  // middle-bar, counting from the left, so each newly-minimized strip is appended to the
  // right of the existing ones instead of displacing them.
  const computeMinimizedPos = (slotIndex: number) => {
    const middleBar = document.querySelector('.middle-bar') as HTMLElement | null
    const rect = middleBar?.getBoundingClientRect()
    if (!rect) return null
    const x = rect.left + MINIMIZED_STRIP_GAP + (MINIMIZED_STRIP_WIDTH + MINIMIZED_STRIP_GAP) * slotIndex
    // Flush with the actual bottom edge of the browser window (plus a small extra dip),
    // not the middle-bar's own rect — guarantees no gap below the strip.
    return { x: Math.max(0, x), y: Math.max(0, window.innerHeight - 50 - 16) }
  }
  // Lands an expanded panel in a safe top-right corner, reserving enough room on the left
  // for this view's own back arrow/header — a fixed top-right corner alone isn't safe on
  // narrower windows, where a full-width panel still covers that header.
  const computeSafeExpandPos = (w: number) => {
    const headerClearance = 300
    const clampedW = Math.min(w, Math.max(300, window.innerWidth - headerClearance))
    return { x: Math.max(headerClearance, window.innerWidth - clampedW - 24), y: 24 }
  }
  // Re-pack this strip's position whenever its slot index changes (e.g. another minimized
  // strip to its right gets closed/restored) so the remaining strips stay lined up with no gaps.
  useEffect(() => {
    if (!composeFloating || !composeFloatMinimized) return
    const pos = computeMinimizedPos(floatSlotIndex)
    if (pos) setFloatPos(pos)
  }, [floatSlotIndex, composeFloating, composeFloatMinimized])
  // Auto re-minimize an expanded floating panel the moment the user navigates away from
  // it (opens a different contact/chatmail item, or leaves this page entirely) — an
  // expanded compose left behind on a view the user isn't looking at would otherwise
  // just sit there; minimizing it folds it back into the bottom row with the others.
  const prevNavKeyRef = useRef(navKey)
  // Set right before deliberately expanding-and-navigating (clicking a minimized strip
  // item) so the navKey change that follows isn't treated as "user navigated away" by
  // the effect below — which would otherwise immediately re-minimize the panel this
  // same click just expanded.
  const suppressAutoReminimizeRef = useRef(false)
  useEffect(() => {
    const navigated = prevNavKeyRef.current !== undefined && prevNavKeyRef.current !== navKey
    prevNavKeyRef.current = navKey
    if (suppressAutoReminimizeRef.current) {
      suppressAutoReminimizeRef.current = false
      return
    }
    if (navigated && composeFloating && !composeFloatMinimized) {
      setComposeFloatMinimized(true)
      const pos = computeMinimizedPos(floatSlotIndex)
      if (pos) setFloatPos(pos)
    }
  }, [navKey])
  // Auto-expand THIS contact's own minimized draft the instant its email/conversation
  // item is opened (becomes the active view) — opening an item that already has a
  // floating draft should bring that draft front-and-center, not leave it collapsed.
  // Scoped to per-contact instances only: opening the generic Chat Mail list shouldn't
  // also pop open the main compose's minimized draft.
  const prevIsActiveViewRef = useRef(isActiveView)
  useEffect(() => {
    const justOpened = !prevIsActiveViewRef.current && isActiveView
    prevIsActiveViewRef.current = isActiveView
    if (contactEmail && justOpened && composeFloating && composeFloatMinimized) {
      setComposeFloatMinimized(false)
      const w = floatSize?.width ?? 760
      const h = floatSize?.height ?? 720
      // Don't just clamp the minimized strip's left-anchored position — expanding from
      // there would cover the thread view's back arrow/header, which sit top-left of the
      // content area. Use the same safe top-right corner as a freshly-opened float.
      setFloatPos(computeSafeExpandPos(w))
    }
  }, [isActiveView])
  // Drag handle for the floating compose panel's header bar.
  const handleFloatDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const panel = (e.currentTarget as HTMLElement).closest('.chatmail-thread-input') as HTMLElement | null
    const rect = panel?.getBoundingClientRect()
    const panelWidth = rect?.width ?? 0
    const panelHeight = rect?.height ?? 0
    floatDragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect?.left ?? 0, origY: rect?.top ?? 0 }
    const onMove = (ev: MouseEvent) => {
      if (!floatDragRef.current) return
      const dx = ev.clientX - floatDragRef.current.startX
      const dy = ev.clientY - floatDragRef.current.startY
      // Keep the panel fully within the visible viewport — can't drag it off-screen.
      const maxX = Math.max(0, window.innerWidth - panelWidth)
      const maxY = Math.max(0, window.innerHeight - panelHeight)
      const x = Math.min(maxX, Math.max(0, floatDragRef.current.origX + dx))
      const y = Math.min(maxY, Math.max(0, floatDragRef.current.origY + dy))
      setFloatPos({ x, y })
    }
    const onUp = () => {
      floatDragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  const FLOAT_MIN_WIDTH = 320
  const FLOAT_MIN_HEIGHT = 280
  const handleFloatResizeStart = (e: React.MouseEvent, dir: 'right' | 'bottom' | 'corner' | 'top' | 'left') => {
    e.preventDefault()
    e.stopPropagation()
    const panel = (e.currentTarget as HTMLElement).closest('.chatmail-thread-input') as HTMLElement | null
    const rect = panel?.getBoundingClientRect()
    floatResizeRef.current = {
      startX: e.clientX, startY: e.clientY, origW: rect?.width ?? 760, origH: rect?.height ?? 720,
      origTop: rect?.top ?? (floatPos?.y ?? 0), origLeft: rect?.left ?? (floatPos?.x ?? 0), dir,
    }
    const onMove = (ev: MouseEvent) => {
      const r = floatResizeRef.current
      if (!r) return
      const dx = ev.clientX - r.startX
      const dy = ev.clientY - r.startY
      setFloatSize(prev => {
        const next = { width: prev?.width ?? r.origW, height: prev?.height ?? r.origH }
        if (r.dir === 'right' || r.dir === 'corner') {
          next.width = Math.min(window.innerWidth - r.origLeft, Math.max(FLOAT_MIN_WIDTH, r.origW + dx))
        }
        if (r.dir === 'bottom' || r.dir === 'corner') {
          next.height = Math.min(window.innerHeight - r.origTop, Math.max(FLOAT_MIN_HEIGHT, r.origH + dy))
        }
        if (r.dir === 'top') {
          // Dragging the top edge up grows height while keeping the bottom edge fixed,
          // so the panel's y position has to shrink by the same amount height grows.
          const bottomEdge = r.origTop + r.origH
          next.height = Math.min(bottomEdge, Math.max(FLOAT_MIN_HEIGHT, r.origH - dy))
        }
        if (r.dir === 'left') {
          // Same idea as 'top' but for the horizontal axis: keep the right edge fixed.
          const rightEdge = r.origLeft + r.origW
          next.width = Math.min(rightEdge, Math.max(FLOAT_MIN_WIDTH, r.origW - dx))
        }
        return next
      })
      if (r.dir === 'top') {
        const bottomEdge = r.origTop + r.origH
        const newHeight = Math.min(bottomEdge, Math.max(FLOAT_MIN_HEIGHT, r.origH - dy))
        setFloatPos(prev => ({ x: prev?.x ?? r.origLeft, y: Math.max(0, bottomEdge - newHeight) }))
      }
      if (r.dir === 'left') {
        const rightEdge = r.origLeft + r.origW
        const newWidth = Math.min(rightEdge, Math.max(FLOAT_MIN_WIDTH, r.origW - dx))
        setFloatPos(prev => ({ x: Math.max(0, rightEdge - newWidth), y: prev?.y ?? r.origTop }))
      }
    }
    const onUp = () => {
      floatResizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  const doUndo = () => {
    if (!unifiedUndoStack.current.length) return
    const entry = unifiedUndoStack.current.pop()!
    if (entry.kind === 'canvas') {
      const canvas = canvasModeRef.current; if (!canvas) { unifiedUndoStack.current.push(entry); return }
      const ctx = canvas.getContext('2d')!
      unifiedRedoStack.current.push({ kind: 'canvas', data: ctx.getImageData(0, 0, canvas.width, canvas.height) })
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.putImageData(entry.data, 0, 0)
      hasInteractedRef.current = true
    } else if (entry.kind === 'canvas-board-removed') {
      if (canvasMode) closeCanvasMode(true)
      unifiedRedoStack.current.push(entry)
      restoreCanvasBoardFromSnapshot(entry.data)
    } else {
      unifiedRedoStack.current.push({ kind: 'text', data: inputValue })
      lastSavedRef.current = entry.data; setInputValue(entry.data); hasInteractedRef.current = true
    }
    setUndoCount(unifiedUndoStack.current.length)
    setRedoCount(unifiedRedoStack.current.length)
  }
  const doRedo = () => {
    if (!unifiedRedoStack.current.length) return
    const entry = unifiedRedoStack.current.pop()!
    if (entry.kind === 'canvas') {
      const canvas = canvasModeRef.current; if (!canvas) { unifiedRedoStack.current.push(entry); return }
      const ctx = canvas.getContext('2d')!
      unifiedUndoStack.current.push({ kind: 'canvas', data: ctx.getImageData(0, 0, canvas.width, canvas.height) })
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.putImageData(entry.data, 0, 0)
      hasInteractedRef.current = true
    } else if (entry.kind === 'canvas-board-removed') {
      // Re-apply the removal: capture whatever is currently on the live board
      // (it may have been redrawn since undo restored it) and close it.
      const canvas = canvasModeRef.current
      if (canvasMode && canvas) {
        unifiedUndoStack.current.push({
          kind: 'canvas-board-removed',
          data: { dataUrl: canvas.toDataURL('image/png'), width: canvasModeWidth, height: canvasModeHeight, offsetX: canvasOffsetX, offsetY: canvasOffsetY }
        })
        closeCanvasMode(true)
      } else {
        unifiedUndoStack.current.push(entry)
      }
      hasInteractedRef.current = true
    } else {
      unifiedUndoStack.current.push({ kind: 'text', data: inputValue })
      lastSavedRef.current = entry.data; setInputValue(entry.data); hasInteractedRef.current = true
    }
    setUndoCount(unifiedUndoStack.current.length)
    setRedoCount(unifiedRedoStack.current.length)
  }
  // kept as named aliases so existing call-sites don't need rewriting
  const canvasUndo = doUndo
  const canvasRedo = doRedo
  const commitCanvasText = (value: string, canvasX: number, canvasY: number, color: string, fontSize: number) => {
    const canvas = canvasModeRef.current; if (!canvas || !value.trim()) return
    pushCanvasSnapshot()
    hasInteractedRef.current = true
    const ctx = canvas.getContext('2d')!
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.fillStyle = color
    ctx.globalAlpha = 1
    ctx.textBaseline = 'top'
    const lines = value.split('\n')
    lines.forEach((line, i) => ctx.fillText(line, canvasX, canvasY + i * (fontSize + 4)))
  }

  const startCanvasModeDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasModeRef.current; if (!canvas) return
    e.preventDefault()
    const tool = drawTool; const color = drawColor; const lineW = drawLineWidth

    // Line phase 2: click to finalize the bezier curve
    if (tool === 'line' && lineDraftRef.current) {
      lineDraftCleanupRef.current?.()
      lineDraftCleanupRef.current = null
      lineDraftRef.current = null
      return
    }

    // Lasso and Select are handled entirely by the overlay canvas
    if (tool === 'lasso' || tool === 'select') return

    // Zoom: single click
    if (tool === 'zoom-in') { setCanvasZoom(z => Math.min(+(z * 1.25).toFixed(2), 4)); return }
    if (tool === 'zoom-out') { setCanvasZoom(z => Math.max(+(z / 1.25).toFixed(2), 0.25)); return }

    // Pan
    if (tool === 'hand') {
      const startX = e.clientX; const startY = e.clientY
      let offX = canvasOffsetX; let offY = canvasOffsetY
      const onPanMove = (ev: MouseEvent) => { setCanvasOffsetX(offX + ev.clientX - startX); setCanvasOffsetY(offY + ev.clientY - startY) }
      const onPanUp = () => { document.removeEventListener('mousemove', onPanMove); document.removeEventListener('mouseup', onPanUp) }
      document.addEventListener('mousemove', onPanMove); document.addEventListener('mouseup', onPanUp)
      return
    }

    // Text: place a text input overlay at click position
    if (tool === 'text') {
      const rect = canvas.getBoundingClientRect()
      const wrapperRect = canvasWrapperRef.current?.getBoundingClientRect() ?? rect
      const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height
      const canvasX = (e.clientX - rect.left) * scaleX
      const canvasY = (e.clientY - rect.top) * scaleY
      setCanvasTextInput({ x: e.clientX - wrapperRect.left, y: e.clientY - wrapperRect.top, canvasX, canvasY, value: '' })
      return
    }

    pushCanvasSnapshot()
    isCanvasModeDrawing.current = true
    hasInteractedRef.current = true
    const pos = getCanvasModePos(e); lastCanvasModePos.current = pos
    const ctx = canvas.getContext('2d')!

    // Resolve actual stroke color for preset-color tools
    const strokeColor = toolColors[tool] !== undefined ? toolColors[tool] : (tool === 'red-pen' ? '#e53935' : color)
    const glowColor = toolHighlightColors[tool]
    const hasGlow = Boolean(glowColor && glowColor !== 'transparent')

    const isPenLike = tool === 'pen' || tool === 'red-pen' || tool === 'eraser'
    if (isPenLike) {
      ctx.save()
      if (hasGlow && tool !== 'eraser') { ctx.shadowColor = glowColor; ctx.shadowBlur = lineW * 2 }
      ctx.beginPath(); ctx.arc(pos.x, pos.y, lineW / 2, 0, Math.PI * 2)
      ctx.fillStyle = tool === 'eraser' ? '#ffffff' : strokeColor; ctx.fill()
      ctx.restore()
    }
    // Effect pen: dot at start
    if (tool === 'effect-pen') {
      ctx.save(); ctx.shadowBlur = lineW * 4; ctx.shadowColor = hasGlow ? glowColor : color; ctx.globalAlpha = 0.85
      ctx.beginPath(); ctx.arc(pos.x, pos.y, lineW / 2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      ctx.restore()
    }
    // Highlight: dot at start
    if (tool === 'highlight') {
      ctx.save(); ctx.globalAlpha = 0.35; ctx.globalCompositeOperation = 'multiply'
      if (hasGlow) { ctx.shadowColor = glowColor; ctx.shadowBlur = lineW * 2 }
      ctx.beginPath(); ctx.arc(pos.x, pos.y, lineW * 3, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
      ctx.restore()
    }

    const startPos = { x: pos.x, y: pos.y }
    if (tool === 'line') linePointsRef.current = [{ x: pos.x, y: pos.y }]
    const shapeSnapshot = (tool === 'line' || tool === 'rect' || tool === 'circle' || tool === 'triangle' || tool === 'diamond' || tool === 'star')
      ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null

    const getDocPos = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: (ev.clientX - rect.left) * (canvas.width / rect.width), y: (ev.clientY - rect.top) * (canvas.height / rect.height) }
    }
    const onMove = (ev: MouseEvent) => {
      if (!isCanvasModeDrawing.current) return
      const ctx = canvas.getContext('2d')!
      const p = getDocPos(ev)
      if (isPenLike) {
        ctx.save()
        if (hasGlow && tool !== 'eraser') { ctx.shadowColor = glowColor; ctx.shadowBlur = lineW * 2 }
        ctx.beginPath(); ctx.moveTo(lastCanvasModePos.current.x, lastCanvasModePos.current.y); ctx.lineTo(p.x, p.y)
        ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : strokeColor
        ctx.lineWidth = tool === 'eraser' ? lineW * 4 : lineW
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 1; ctx.setLineDash([])
        ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1
        ctx.restore()
      } else if (tool === 'effect-pen') {
        ctx.save()
        ctx.shadowBlur = lineW * 4; ctx.shadowColor = hasGlow ? glowColor : color; ctx.globalAlpha = 0.85
        ctx.beginPath(); ctx.moveTo(lastCanvasModePos.current.x, lastCanvasModePos.current.y); ctx.lineTo(p.x, p.y)
        ctx.strokeStyle = color; ctx.lineWidth = lineW; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke()
        ctx.restore()
      } else if (tool === 'highlight') {
        ctx.save()
        ctx.globalAlpha = 0.35; ctx.globalCompositeOperation = 'multiply'
        if (hasGlow) { ctx.shadowColor = glowColor; ctx.shadowBlur = lineW * 2 }
        ctx.beginPath(); ctx.moveTo(lastCanvasModePos.current.x, lastCanvasModePos.current.y); ctx.lineTo(p.x, p.y)
        ctx.strokeStyle = color; ctx.lineWidth = lineW * 6; ctx.lineCap = 'square'; ctx.lineJoin = 'miter'; ctx.stroke()
        ctx.restore()
      } else if (shapeSnapshot) {
        ctx.putImageData(shapeSnapshot, 0, 0)
        ctx.save()
        if (hasGlow) { ctx.shadowColor = glowColor; ctx.shadowBlur = 10 }
        ctx.strokeStyle = color; ctx.lineWidth = lineW; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([])
        if (tool === 'line') {
          ctx.beginPath(); ctx.moveTo(startPos.x, startPos.y); ctx.lineTo(p.x, p.y); ctx.stroke()
        } else if (tool === 'rect') {
          ctx.beginPath(); ctx.strokeRect(startPos.x, startPos.y, p.x - startPos.x, p.y - startPos.y)
        } else if (tool === 'circle') {
          const rx = Math.abs(p.x - startPos.x) / 2; const ry = Math.abs(p.y - startPos.y) / 2
          const cx = startPos.x + (p.x - startPos.x) / 2; const cy = startPos.y + (p.y - startPos.y) / 2
          ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2); ctx.stroke()
        } else if (tool === 'triangle') {
          const x0 = Math.min(startPos.x, p.x); const x1 = Math.max(startPos.x, p.x)
          const y0 = Math.min(startPos.y, p.y); const y1 = Math.max(startPos.y, p.y)
          ctx.beginPath(); ctx.moveTo((x0 + x1) / 2, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.closePath(); ctx.stroke()
        } else if (tool === 'diamond') {
          const x0 = Math.min(startPos.x, p.x); const x1 = Math.max(startPos.x, p.x)
          const y0 = Math.min(startPos.y, p.y); const y1 = Math.max(startPos.y, p.y)
          const mx = (x0 + x1) / 2; const my = (y0 + y1) / 2
          ctx.beginPath(); ctx.moveTo(mx, y0); ctx.lineTo(x1, my); ctx.lineTo(mx, y1); ctx.lineTo(x0, my); ctx.closePath(); ctx.stroke()
        } else if (tool === 'star') {
          const x0 = Math.min(startPos.x, p.x); const x1 = Math.max(startPos.x, p.x)
          const y0 = Math.min(startPos.y, p.y); const y1 = Math.max(startPos.y, p.y)
          const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2
          const rx1 = Math.max((x1 - x0) / 2, 0.5); const ry1 = Math.max((y1 - y0) / 2, 0.5)
          const rx2 = rx1 * 0.45; const ry2 = ry1 * 0.45
          ctx.beginPath()
          for (let i = 0; i < 10; i++) {
            const outer = i % 2 === 0; const a = (i * Math.PI) / 5 - Math.PI / 2
            const sx = cx + (outer ? rx1 : rx2) * Math.cos(a); const sy = cy + (outer ? ry1 : ry2) * Math.sin(a)
            i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)
          }
          ctx.closePath(); ctx.stroke()
        }
        ctx.restore()
      }
      lastCanvasModePos.current = p
    }
    const onUp = () => {
      isCanvasModeDrawing.current = false;
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
      if (tool === 'line') {
        const endPos = lastCanvasModePos.current
        const draft = { bg: shapeSnapshot!, sx: startPos.x, sy: startPos.y, ex: endPos.x, ey: endPos.y, color: strokeColor, lineW }
        lineDraftRef.current = draft
        const phase2Move = (ev: MouseEvent) => {
          const c = canvasModeRef.current; if (!c || !lineDraftRef.current) return
          const ctx2 = c.getContext('2d')!
          const r = c.getBoundingClientRect()
          const cx = (ev.clientX - r.left) * (c.width / r.width)
          const cy = (ev.clientY - r.top) * (c.height / r.height)
          ctx2.putImageData(draft.bg, 0, 0)
          ctx2.save()
          if (hasGlow) { ctx2.shadowColor = glowColor; ctx2.shadowBlur = 10 }
          ctx2.strokeStyle = draft.color; ctx2.lineWidth = draft.lineW; ctx2.lineCap = 'round'; ctx2.lineJoin = 'round'; ctx2.setLineDash([])
          ctx2.beginPath(); ctx2.moveTo(draft.sx, draft.sy); ctx2.quadraticCurveTo(cx, cy, draft.ex, draft.ey); ctx2.stroke()
          ctx2.restore()
        }
        document.addEventListener('mousemove', phase2Move)
        lineDraftCleanupRef.current = () => document.removeEventListener('mousemove', phase2Move)
      }
    }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }
  const clearCanvasMode = () => {
    const canvas = canvasModeRef.current; if (!canvas) return
    pushCanvasSnapshot()
    hasInteractedRef.current = true
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const applyClipShape = (ctx: CanvasRenderingContext2D, shape: string, w: number, h: number, path: {x: number, y: number}[]) => {
    ctx.beginPath()
    if (shape === 'lasso' && path.length > 2) {
      path.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
      ctx.closePath()
    } else if (shape === 'rect') {
      ctx.rect(0, 0, w, h)
    } else if (shape === 'circle') {
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    } else if (shape === 'triangle') {
      ctx.moveTo(w / 2, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath()
    } else if (shape === 'diamond') {
      ctx.moveTo(w / 2, 0); ctx.lineTo(w, h / 2); ctx.lineTo(w / 2, h); ctx.lineTo(0, h / 2); ctx.closePath()
    } else if (shape === 'star') {
      const cx = w / 2; const cy = h / 2; const r1 = Math.min(w, h) / 2; const r2 = r1 * 0.45
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? r1 : r2; const a = (i * Math.PI) / 5 - Math.PI / 2
        i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
      }
      ctx.closePath()
    } else {
      ctx.rect(0, 0, w, h)
    }
  }

  const changeLassoClipShape = useCallback((shape: string) => {
    const sel = lassoSelRef.current; if (!sel) return
    sel.clipShape = shape
    const newTemp = document.createElement('canvas'); newTemp.width = sel.w; newTemp.height = sel.h
    const ctx = newTemp.getContext('2d')!
    ctx.save(); applyClipShape(ctx, shape, sel.w, sel.h, sel.clipPath); ctx.clip()
    ctx.drawImage(sel.originalCanvas, 0, 0); ctx.restore()
    sel.tempCanvas = newTemp
    setLassoClipShape(shape)
    redrawLassoOverlay()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const LASSO_HANDLE_DIST = 28
  const LASSO_RESIZE_R = 6  // radius of resize dots

  // Convert local coords (relative to selection center) to screen coords
  const toScreen = (cx: number, cy: number, angle: number, lx: number, ly: number) => ({
    x: cx + lx * Math.cos(angle) - ly * Math.sin(angle),
    y: cy + lx * Math.sin(angle) + ly * Math.cos(angle),
  })

  // Returns 8 resize handle screen positions: nw n ne e se s sw w
  const getSelHandles = (sel: typeof lassoSelRef.current) => {
    if (!sel) return []
    const cx = sel.x + sel.ox + sel.w / 2; const cy = sel.y + sel.oy + sel.h / 2
    const hw = sel.w / 2; const hh = sel.h / 2; const a = sel.angle
    return [
      { id: 'nw', cursor: 'nw-resize', ...toScreen(cx, cy, a, -hw, -hh) },
      { id: 'n',  cursor: 'n-resize',  ...toScreen(cx, cy, a,   0, -hh) },
      { id: 'ne', cursor: 'ne-resize', ...toScreen(cx, cy, a,  hw, -hh) },
      { id: 'e',  cursor: 'e-resize',  ...toScreen(cx, cy, a,  hw,   0) },
      { id: 'se', cursor: 'se-resize', ...toScreen(cx, cy, a,  hw,  hh) },
      { id: 's',  cursor: 's-resize',  ...toScreen(cx, cy, a,   0,  hh) },
      { id: 'sw', cursor: 'sw-resize', ...toScreen(cx, cy, a, -hw,  hh) },
      { id: 'w',  cursor: 'w-resize',  ...toScreen(cx, cy, a, -hw,   0) },
    ]
  }

  const redrawLassoOverlay = useCallback(() => {
    const ov = lassoOverlayRef.current; if (!ov) return
    const ctx = ov.getContext('2d')!
    ctx.clearRect(0, 0, ov.width, ov.height)
    const sel = lassoSelRef.current
    const path = lassoPathRef.current
    if (sel) {
      const cx = sel.x + sel.ox + sel.w / 2; const cy = sel.y + sel.oy + sel.h / 2
      // Draw rotated selection image
      ctx.save()
      ctx.translate(cx, cy); ctx.rotate(sel.angle)
      ctx.drawImage(sel.tempCanvas, -sel.w / 2, -sel.h / 2, sel.w, sel.h)
      // Draw marching ants border
      ctx.strokeStyle = '#1a73e8'; ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4]); ctx.lineDashOffset = -lassoMarchRef.current
      ctx.strokeRect(-sel.w / 2 + 0.5, -sel.h / 2 + 0.5, sel.w, sel.h)
      ctx.setLineDash([]); ctx.restore()
      // Rotation handle (circle above selection center-top)
      const hx = cx + (-sel.h / 2 - LASSO_HANDLE_DIST) * (-Math.sin(sel.angle))
      const hy = cy + (-sel.h / 2 - LASSO_HANDLE_DIST) * Math.cos(sel.angle)
      const lx = cx + (-sel.h / 2) * (-Math.sin(sel.angle))
      const ly = cy + (-sel.h / 2) * Math.cos(sel.angle)
      ctx.save()
      ctx.strokeStyle = '#1a73e8'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2])
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(hx, hy); ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'; ctx.fill()
      ctx.strokeStyle = '#1a73e8'; ctx.lineWidth = 2; ctx.stroke()
      // Angle label next to rotation handle
      const deg = Math.round(((sel.angle * 180) / Math.PI + 360) % 360)
      const label = `${deg}°`
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif'
      const tw = ctx.measureText(label).width
      const lbx = hx + 12; const lby = hy - 10
      ctx.fillStyle = '#1a73e8'
      ctx.fillRect(lbx - 3, lby - 11, tw + 6, 15)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, lbx, lby)
      ctx.restore()
      // Draw 8 resize dots
      getSelHandles(sel).forEach(h => {
        ctx.save()
        ctx.beginPath(); ctx.arc(h.x, h.y, LASSO_RESIZE_R, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'; ctx.fill()
        ctx.strokeStyle = '#1a73e8'; ctx.lineWidth = 2; ctx.stroke()
        ctx.restore()
      })
    } else if (path.length > 1) {
      ctx.save()
      ctx.beginPath()
      path.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
      ctx.strokeStyle = '#1a73e8'; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.setLineDash([5, 4]); ctx.lineDashOffset = -lassoMarchRef.current; ctx.globalAlpha = 0.85
      ctx.stroke(); ctx.setLineDash([]); ctx.restore()
    }
  }, [])

  const startLassoMarch = useCallback(() => {
    if (lassoTimerRef.current) return
    lassoTimerRef.current = setInterval(() => {
      lassoMarchRef.current = (lassoMarchRef.current + 1) % 20
      redrawLassoOverlay()
    }, 60)
  }, [redrawLassoOverlay])

  const stopLassoMarch = useCallback(() => {
    if (lassoTimerRef.current) { clearInterval(lassoTimerRef.current); lassoTimerRef.current = null }
  }, [])

  const commitLassoSel = useCallback(() => {
    const sel = lassoSelRef.current
    const canvas = canvasModeRef.current
    if (sel && canvas) {
      const ctx = canvas.getContext('2d')!
      const cx = sel.x + sel.ox + sel.w / 2; const cy = sel.y + sel.oy + sel.h / 2
      ctx.save()
      ctx.translate(cx, cy); ctx.rotate(sel.angle)
      ctx.drawImage(sel.tempCanvas, -sel.w / 2, -sel.h / 2, sel.w, sel.h)
      ctx.restore()
    }
    lassoSelRef.current = null; lassoPathRef.current = []
    setHasLassoSel(false); stopLassoMarch()
    const ov = lassoOverlayRef.current
    if (ov) ov.getContext('2d')!.clearRect(0, 0, ov.width, ov.height)
  }, [stopLassoMarch])

  const discardLassoSel = useCallback(() => {
    lassoSelRef.current = null; lassoPathRef.current = []
    setHasLassoSel(false); stopLassoMarch()
    const ov = lassoOverlayRef.current
    if (ov) ov.getContext('2d')!.clearRect(0, 0, ov.width, ov.height)
  }, [stopLassoMarch])

  const finalizeLassoPath = useCallback((canvas: HTMLCanvasElement, shape: string = 'lasso') => {
    const path = lassoPathRef.current
    if (path.length < 3) { lassoPathRef.current = []; redrawLassoOverlay(); return }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    path.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) })
    const x = Math.max(0, Math.floor(minX)); const y = Math.max(0, Math.floor(minY))
    const w = Math.min(canvas.width - x, Math.ceil(maxX - minX)); const h = Math.min(canvas.height - y, Math.ceil(maxY - minY))
    if (w < 2 || h < 2) { lassoPathRef.current = []; redrawLassoOverlay(); return }
    // Store full rect crop (no clip) for shape-changing
    const origCanvas = document.createElement('canvas'); origCanvas.width = w; origCanvas.height = h
    origCanvas.getContext('2d')!.drawImage(canvas, -x, -y)
    // Store lasso-clipped version as tempCanvas
    const tempCanvas = document.createElement('canvas'); tempCanvas.width = w; tempCanvas.height = h
    const tempCtx = tempCanvas.getContext('2d')!
    const relPath = path.map(p => ({ x: p.x - x, y: p.y - y }))
    tempCtx.save()
    tempCtx.beginPath()
    relPath.forEach((p, i) => i === 0 ? tempCtx.moveTo(p.x, p.y) : tempCtx.lineTo(p.x, p.y))
    tempCtx.closePath(); tempCtx.clip()
    tempCtx.drawImage(canvas, -x, -y); tempCtx.restore()
    pushCanvasSnapshot()
    const mainCtx = canvas.getContext('2d')!
    mainCtx.save()
    mainCtx.beginPath()
    path.forEach((p, i) => i === 0 ? mainCtx.moveTo(p.x, p.y) : mainCtx.lineTo(p.x, p.y))
    mainCtx.closePath(); mainCtx.clip()
    mainCtx.clearRect(0, 0, canvas.width, canvas.height); mainCtx.restore()
    lassoSelRef.current = { tempCanvas, originalCanvas: origCanvas, clipPath: relPath, x, y, w, h, ox: 0, oy: 0, angle: 0, clipShape: shape }
    setLassoClipShape(shape)
    lassoPathRef.current = []; setHasLassoSel(true); startLassoMarch(); redrawLassoOverlay()
  }, [pushCanvasSnapshot, redrawLassoOverlay, startLassoMarch])

  const startLassoMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>, mode: 'lasso' | 'rect' = 'lasso') => {
    e.preventDefault()
    const canvas = canvasModeRef.current; const ov = lassoOverlayRef.current
    if (!canvas || !ov) return
    const rect = ov.getBoundingClientRect()
    const scaleX = ov.width / rect.width; const scaleY = ov.height / rect.height
    const cx = (e.clientX - rect.left) * scaleX; const cy = (e.clientY - rect.top) * scaleY
    const sel = lassoSelRef.current
    if (sel) {
      const selCx = sel.x + sel.ox + sel.w / 2; const selCy = sel.y + sel.oy + sel.h / 2
      // Check resize handles (8 dots)
      const handles = getSelHandles(sel)
      const hitHandle = handles.find(h => Math.sqrt((cx - h.x) ** 2 + (cy - h.y) ** 2) <= LASSO_RESIZE_R + 4)
      if (hitHandle) {
        const hid = hitHandle.id
        const startW = sel.w; const startH = sel.h
        const a = sel.angle
        const oppositeId: {[k: string]: string} = { n:'s', s:'n', e:'w', w:'e', ne:'sw', nw:'se', se:'nw', sw:'ne' }
        const anchorHandle = handles.find(h => h.id === oppositeId[hid])!
        const anchorX = anchorHandle.x; const anchorY = anchorHandle.y
        const isEdgeH = hid === 'n' || hid === 's'
        const isEdgeW = hid === 'e' || hid === 'w'
        const onMove = (ev: MouseEvent) => {
          const mx = (ev.clientX - rect.left) * scaleX; const my = (ev.clientY - rect.top) * scaleY
          // Convert anchor→mouse vector to local space to get new dimensions
          const sdx = mx - anchorX; const sdy = my - anchorY
          const ldx = sdx * Math.cos(-a) - sdy * Math.sin(-a)
          const ldy = sdx * Math.sin(-a) + sdy * Math.cos(-a)
          let newW = sel.w; let newH = sel.h
          if (!isEdgeH) newW = Math.max(20, Math.abs(ldx))
          if (!isEdgeW) newH = Math.max(20, Math.abs(ldy))
          // New center = midpoint of anchor + mouse → opposite handle stays perfectly pinned
          sel.w = newW; sel.h = newH
          sel.ox = (mx + anchorX) / 2 - sel.x - newW / 2
          sel.oy = (my + anchorY) / 2 - sel.y - newH / 2
          // Re-clip scaled to new dimensions
          const scaledPath = sel.clipPath.map(p => ({ x: p.x * newW / startW, y: p.y * newH / startH }))
          const newTemp = document.createElement('canvas'); newTemp.width = Math.ceil(newW); newTemp.height = Math.ceil(newH)
          const tctx = newTemp.getContext('2d')!
          tctx.save(); applyClipShape(tctx, sel.clipShape, newW, newH, scaledPath); tctx.clip()
          tctx.drawImage(sel.originalCanvas, 0, 0, newW, newH); tctx.restore()
          sel.tempCanvas = newTemp
          redrawLassoOverlay()
        }
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
        return
      }
      // Check rotation handle
      const hx = selCx + (-sel.h / 2 - LASSO_HANDLE_DIST) * (-Math.sin(sel.angle))
      const hy = selCy + (-sel.h / 2 - LASSO_HANDLE_DIST) * Math.cos(sel.angle)
      const distToHandle = Math.sqrt((cx - hx) ** 2 + (cy - hy) ** 2)
      if (distToHandle <= 12) {
        const onMove = (ev: MouseEvent) => {
          const px = (ev.clientX - rect.left) * scaleX; const py = (ev.clientY - rect.top) * scaleY
          sel.angle = Math.atan2(px - selCx, -(py - selCy))
          redrawLassoOverlay()
        }
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
        return
      }
      // Rotation-aware hit test: transform click into selection local space
      const localX = (cx - selCx) * Math.cos(-sel.angle) - (cy - selCy) * Math.sin(-sel.angle)
      const localY = (cx - selCx) * Math.sin(-sel.angle) + (cy - selCy) * Math.cos(-sel.angle)
      const inBounds = localX >= -sel.w / 2 && localX <= sel.w / 2 && localY >= -sel.h / 2 && localY <= sel.h / 2
      if (inBounds) {
        const startX = cx; const startY = cy; const startOx = sel.ox; const startOy = sel.oy
        const onMove = (ev: MouseEvent) => {
          sel.ox = startOx + (ev.clientX - rect.left) * scaleX - startX
          sel.oy = startOy + (ev.clientY - rect.top) * scaleY - startY
          redrawLassoOverlay()
        }
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
        return
      }
      commitLassoSel()
    }
    if (mode === 'rect') {
      const startCx = cx; const startCy = cy
      lassoPathRef.current = [{ x: startCx, y: startCy }]; startLassoMarch()
      const onMove = (ev: MouseEvent) => {
        const mx = (ev.clientX - rect.left) * scaleX; const my = (ev.clientY - rect.top) * scaleY
        lassoPathRef.current = [
          { x: startCx, y: startCy }, { x: mx, y: startCy }, { x: mx, y: my }, { x: startCx, y: my }, { x: startCx, y: startCy },
        ]
        redrawLassoOverlay()
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
        finalizeLassoPath(canvas, 'rect')
      }
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
      return
    }
    lassoPathRef.current = [{ x: cx, y: cy }]; startLassoMarch()
    const onMove = (ev: MouseEvent) => {
      lassoPathRef.current.push({ x: (ev.clientX - rect.left) * scaleX, y: (ev.clientY - rect.top) * scaleY })
      redrawLassoOverlay()
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
      finalizeLassoPath(canvas)
    }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [commitLassoSel, finalizeLassoPath, redrawLassoOverlay, startLassoMarch])

  const drawTextOnCanvasMode = (text: string, ctx: CanvasRenderingContext2D, canvasWidth: number) => {
    ctx.font = '15px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillStyle = '#333'
    const lines = text.split('\n')
    let y = 24
    for (const rawLine of lines) {
      const words = rawLine.split(' ')
      let line = ''
      for (const word of words) {
        const test = line + (line ? ' ' : '') + word
        if (ctx.measureText(test).width > canvasWidth - 24 && line) {
          ctx.fillText(line, 12, y); y += 22; line = word
        } else { line = test }
      }
      ctx.fillText(line, 12, y); y += 22
    }
  }
  const restoreCanvasFromImage = (imgEl: HTMLImageElement) => {
    if (canvasMode && canvasModeRef.current && canvasPortalTarget) {
      if (canvasPortalTarget.contains(imgEl)) return;
      const dataUrl = canvasModeRef.current.toDataURL('image/png')
      const savedImg = document.createElement('img')
      savedImg.src = dataUrl
      savedImg.setAttribute('data-canvas-saved', '1')
      if (canvasModeWidth != null) savedImg.setAttribute('data-canvas-mode-width', String(canvasModeWidth))
      savedImg.setAttribute('data-canvas-mode-height', String(canvasModeHeight))
      savedImg.setAttribute('data-canvas-offset-x', String(canvasOffsetX))
      savedImg.setAttribute('data-canvas-offset-y', String(canvasOffsetY))
      savedImg.style.cssText = 'max-width:100%;display:block;border-radius:4px;margin:4px 0;cursor:pointer;'
      canvasPortalTarget.replaceWith(savedImg)
      closeCanvasMode(false)
    }

    const placeholder = document.createElement('div')
    placeholder.setAttribute('contenteditable', 'false')
    placeholder.setAttribute('data-canvas-placeholder', 'true')
    placeholder.style.cssText = 'display:block;width:100%;min-height:4px;user-select:none;'
    imgEl.replaceWith(placeholder)
    
    const src = imgEl.src
    const wAttr = imgEl.getAttribute('data-canvas-mode-width')
    const hAttr = imgEl.getAttribute('data-canvas-mode-height')
    const oxAttr = imgEl.getAttribute('data-canvas-offset-x')
    const oyAttr = imgEl.getAttribute('data-canvas-offset-y')

    setCanvasPortalTarget(placeholder)
    setCanvasMode(true)
    setFormatTab('draw')
    hasInteractedRef.current = true

    const newW = wAttr && wAttr !== 'null' ? parseInt(wAttr, 10) : null
    const newH = hAttr && hAttr !== 'null' ? parseInt(hAttr, 10) : 220
    
    setCanvasModeWidth(newW)
    setCanvasModeHeight(newH)
    setCanvasOffsetX(oxAttr && oxAttr !== 'null' ? parseInt(oxAttr, 10) : 0)
    setCanvasOffsetY(oyAttr && oyAttr !== 'null' ? parseInt(oyAttr, 10) : 0)

    if (editorRef.current) setInputValue(editorRef.current.innerHTML)

    let initAttempts = 0
    const initCanvasWhenReady = () => {
      if (initAttempts++ >= 20) return
      const canvas = canvasModeRef.current
      if (!canvas) { requestAnimationFrame(initCanvasWhenReady); return }
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0) { requestAnimationFrame(initCanvasWhenReady); return }
      
      canvas.width = Math.round(rect.width)
      canvas.height = Math.round(rect.height) || newH
      setCanvasNaturalSize({ w: canvas.width, h: canvas.height })
      unifiedUndoStack.current = unifiedUndoStack.current.filter(e => e.kind !== 'canvas')
      unifiedRedoStack.current = unifiedRedoStack.current.filter(e => e.kind !== 'canvas')
      setUndoCount(unifiedUndoStack.current.length); setRedoCount(unifiedRedoStack.current.length)
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      const img = document.createElement('img')
      img.onload = () => {
        const c = canvasModeRef.current; if (!c) return
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      }
      img.src = src
    }
    requestAnimationFrame(initCanvasWhenReady)
  }
  const commitActiveCanvasToImage = (closeCanvas = true) => {
    if (canvasMode && canvasModeRef.current && canvasPortalTarget && canvasPortalTarget.parentNode) {
      const dataUrl = canvasModeRef.current.toDataURL('image/png')
      const savedImg = document.createElement('img')
      savedImg.src = dataUrl
      savedImg.setAttribute('data-canvas-saved', '1')
      if (canvasModeWidth != null) savedImg.setAttribute('data-canvas-mode-width', String(canvasModeWidth))
      savedImg.setAttribute('data-canvas-mode-height', String(canvasModeHeight))
      savedImg.setAttribute('data-canvas-offset-x', String(canvasOffsetX))
      savedImg.setAttribute('data-canvas-offset-y', String(canvasOffsetY))
      savedImg.style.cssText = 'max-width:100%;display:block;border-radius:4px;margin:4px 0;cursor:pointer;'
      
      let newHtml = ''
      if (editorRef.current) {
        if (closeCanvas) {
          canvasPortalTarget.replaceWith(savedImg)
          newHtml = editorRef.current.innerHTML
        } else {
          const temp = document.createElement('div')
          temp.innerHTML = editorRef.current.innerHTML
          const p = temp.querySelector('[data-canvas-placeholder="true"]')
          if (p) p.replaceWith(savedImg)
          newHtml = temp.innerHTML
        }
      } else {
        const temp = document.createElement('div')
        temp.innerHTML = inputValue
        const p = temp.querySelector('[data-canvas-placeholder="true"]')
        if (p) p.replaceWith(savedImg)
        newHtml = temp.innerHTML
      }
      
      if (closeCanvas) {
        setInputValue(newHtml)
        hasInteractedRef.current = true
        closeCanvasMode(false)
      }
      return newHtml
    }
    return editorRef.current?.innerHTML ?? inputValue
  }
  commitActiveCanvasToImageRef.current = commitActiveCanvasToImage
  const openCanvasMode = (html: string) => {
    // If a canvas board is already open, commit it as a static image then open a fresh one
    if (canvasMode && canvasModeRef.current && canvasPortalTarget) {
      commitActiveCanvasToImage()
      // Use setTimeout to let React fully unmount the portal before opening a new one
      setTimeout(() => openCanvasMode(html), 0)
      return
    }
    const editor = editorRef.current
    if (editor) {
      const rowAbove = document.createElement('div')
      rowAbove.setAttribute('contenteditable', 'true')
      rowAbove.appendChild(document.createElement('br'))

      const placeholder = document.createElement('div')
      placeholder.setAttribute('contenteditable', 'false')
      placeholder.setAttribute('data-canvas-placeholder', 'true')
      placeholder.style.cssText = 'display:block;width:100%;min-height:4px;user-select:none;'

      const rowBelow = document.createElement('div')
      rowBelow.setAttribute('contenteditable', 'true')
      rowBelow.appendChild(document.createElement('br'))

      const fragment = document.createDocumentFragment()
      fragment.appendChild(rowAbove)
      fragment.appendChild(placeholder)
      fragment.appendChild(rowBelow)

      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        const range = sel.getRangeAt(0)
        range.collapse(false)
        range.insertNode(fragment)
      } else {
        editor.appendChild(fragment)
      }

      // Place cursor in the row below the canvas
      const newRange = document.createRange()
      newRange.setStart(rowBelow, 0)
      newRange.collapse(true)
      sel?.removeAllRanges()
      sel?.addRange(newRange)
      rowBelow.focus()

      setCanvasPortalTarget(placeholder)
    }
    setCanvasMode(true)
    setFormatTab('draw')
    hasInteractedRef.current = true
    // Expand the compose panel so the full canvas board is visible.
    // 260 = overhead for toolbar + To/Subject rows + text rows above/below canvas.
    setInputPanelHeight(prev => Math.max(prev, canvasModeHeight + 260))
    // Use RAF retry so canvas is guaranteed to be laid out before we touch it.
    // This is critical for draft restore at mount time where a fixed 30ms timeout
    // may fire before the portal has been painted and rect.width would be 0.
    let initAttempts = 0
    const initCanvasWhenReady = () => {
      if (initAttempts++ >= 20) return
      const canvas = canvasModeRef.current
      if (!canvas) { requestAnimationFrame(initCanvasWhenReady); return }
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0) { requestAnimationFrame(initCanvasWhenReady); return }
      canvas.width = Math.round(rect.width)
      canvas.height = Math.round(rect.height) || canvasModeHeight
      setCanvasNaturalSize({ w: canvas.width, h: canvas.height })
      unifiedUndoStack.current = unifiedUndoStack.current.filter(e => e.kind !== 'canvas')
      unifiedRedoStack.current = unifiedRedoStack.current.filter(e => e.kind !== 'canvas')
      setUndoCount(unifiedUndoStack.current.length); setRedoCount(unifiedRedoStack.current.length)
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    requestAnimationFrame(initCanvasWhenReady)
  }
  const closeCanvasMode = (removePlaceholder = true) => {
    if (removePlaceholder && canvasPortalTarget) {
      canvasPortalTarget.remove()
    }
    setCanvasPortalTarget(null)
    setCanvasMode(false)
    setCanvasNaturalSize(null)
    setCanvasOffsetX(0)
    setCanvasOffsetY(0)
  }
  // Re-creates a live canvas board from a snapshot taken when one was removed,
  // so Undo can bring back both the board and its previous drawing.
  const restoreCanvasBoardFromSnapshot = (snapshot: CanvasBoardSnapshot) => {
    const editor = editorRef.current
    if (editor) {
      const rowAbove = document.createElement('div')
      rowAbove.setAttribute('contenteditable', 'true')
      rowAbove.appendChild(document.createElement('br'))

      const placeholder = document.createElement('div')
      placeholder.setAttribute('contenteditable', 'false')
      placeholder.setAttribute('data-canvas-placeholder', 'true')
      placeholder.style.cssText = 'display:block;width:100%;min-height:4px;user-select:none;'

      const rowBelow = document.createElement('div')
      rowBelow.setAttribute('contenteditable', 'true')
      rowBelow.appendChild(document.createElement('br'))

      const fragment = document.createDocumentFragment()
      fragment.appendChild(rowAbove)
      fragment.appendChild(placeholder)
      fragment.appendChild(rowBelow)

      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        const range = sel.getRangeAt(0)
        range.collapse(false)
        range.insertNode(fragment)
      } else {
        editor.appendChild(fragment)
      }

      const newRange = document.createRange()
      newRange.setStart(rowBelow, 0)
      newRange.collapse(true)
      sel?.removeAllRanges()
      sel?.addRange(newRange)
      rowBelow.focus()

      setCanvasPortalTarget(placeholder)
    }
    setCanvasMode(true)
    setFormatTab('draw')
    hasInteractedRef.current = true
    setCanvasModeWidth(snapshot.width)
    setCanvasModeHeight(snapshot.height)
    setCanvasOffsetX(snapshot.offsetX)
    setCanvasOffsetY(snapshot.offsetY)
    setInputPanelHeight(prev => Math.max(prev, snapshot.height + 260))

    let initAttempts = 0
    const initCanvasWhenReady = () => {
      if (initAttempts++ >= 20) return
      const canvas = canvasModeRef.current
      if (!canvas) { requestAnimationFrame(initCanvasWhenReady); return }
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0) { requestAnimationFrame(initCanvasWhenReady); return }
      canvas.width = Math.round(rect.width)
      canvas.height = Math.round(rect.height) || snapshot.height
      setCanvasNaturalSize({ w: canvas.width, h: canvas.height })
      unifiedUndoStack.current = unifiedUndoStack.current.filter(e => e.kind !== 'canvas')
      unifiedRedoStack.current = unifiedRedoStack.current.filter(e => e.kind !== 'canvas')
      setUndoCount(unifiedUndoStack.current.length); setRedoCount(unifiedRedoStack.current.length)
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const img = document.createElement('img')
      img.onload = () => {
        const c = canvasModeRef.current; if (!c) return
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      }
      img.src = snapshot.dataUrl
    }
    requestAnimationFrame(initCanvasWhenReady)
  }
  const [canvasModeHeight, setCanvasModeHeight] = useState(220)
  const [canvasModeWidth, setCanvasModeWidth] = useState<number | null>(null)
  const [canvasNaturalSize, setCanvasNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [canvasResizeActive, setCanvasResizeActive] = useState('')
  const [canvasOffsetX, setCanvasOffsetX] = useState(0)
  const [canvasOffsetY, setCanvasOffsetY] = useState(0)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const isResizingCanvas = useRef(false)
  const resizeStartPos = useRef({ x: 0, y: 0 })
  const resizeStartSize = useRef({ w: 0, h: 0 })
  // NEW STATE FOR CANVAS POSITION
  const [canvasModeX, setCanvasModeX] = useState(0);
  const [canvasModeY, setCanvasModeY] = useState(0);
  const resizeDir = useRef('')


  useEffect(() => {
    if (!canvasMode) return
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return
    const syncCanvasToWrapper = () => {
      if (isResizingCanvas.current) return
      const canvas = canvasModeRef.current
      if (!canvas) return
      const rect = wrapper.getBoundingClientRect()
      const wrapW = Math.round(rect.width)
      const wrapH = Math.round(rect.height)
      if (!wrapW || !wrapH) return
      // Grow-only: shrinking the wrapper must never shrink the canvas bitmap,
      // otherwise drawing outside the new bounds is permanently lost. The
      // wrapper's overflow:hidden clips the oversized canvas visually instead.
      const newW = Math.max(canvas.width, wrapW)
      const newH = Math.max(canvas.height, wrapH)
      if (newW === canvas.width && newH === canvas.height) return
      const saved = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
      canvas.width = newW
      canvas.height = newH
      canvas.getContext('2d')!.putImageData(saved, 0, 0)
      setCanvasNaturalSize({ w: newW, h: newH })
      const ov = lassoOverlayRef.current
      if (ov) { ov.width = newW; ov.height = newH }
    }
    const observer = new ResizeObserver(syncCanvasToWrapper)
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [canvasMode])
  const getDrawingBounds = () => {
    const canvas = canvasModeRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
    let minX = width, maxX = 0, minY = height, maxY = 0, found = false
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        if (data[i + 3] > 10 && (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250)) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
          found = true
        }
      }
    }
    return found ? { left: minX, right: maxX, top: minY, bottom: maxY } : null
  }
  const startCanvasResize = (e: React.MouseEvent, dir: string) => {
    e.preventDefault()
    e.stopPropagation()
    isResizingCanvas.current = true
    hasInteractedRef.current = true
    setCanvasResizeActive(dir)
    resizeDir.current = dir
    resizeStartPos.current = { x: e.clientX, y: e.clientY }
    resizeStartSize.current = {
      w: canvasModeWidth ?? (canvasWrapperRef.current?.offsetWidth ?? 600),
      h: canvasModeHeight,
    }
    const bounds = getDrawingBounds()
    const PAD = 14
    // minimum size = drawing span + padding on both sides
    const minW = bounds ? Math.max(80, bounds.right - bounds.left + PAD * 2) : 80
    const minH = bounds ? Math.max(80, bounds.bottom - bounds.top + PAD * 2) : 80
    let finalW = resizeStartSize.current.w
    let finalH = resizeStartSize.current.h
    const onMove = (ev: MouseEvent) => {
      if (!isResizingCanvas.current) return
      const dx = ev.clientX - resizeStartPos.current.x
      const dy = ev.clientY - resizeStartPos.current.y
      const d = resizeDir.current
      if (d.includes('s') || d.includes('n')) {
        const raw = d.includes('s') ? resizeStartSize.current.h + dy : resizeStartSize.current.h - dy
        const newH = Math.max(minH, Math.min(800, raw))
        finalH = newH
        setCanvasModeHeight(newH)
        // Keep the compose panel tall enough to show the resized canvas fully
        setInputPanelHeight(prev => Math.max(prev, newH + 260))
        // push drawing up when bottom border closes in
        if (bounds) setCanvasOffsetY(Math.min(0, newH - PAD - bounds.bottom))
      }
      if (d.includes('e') || d.includes('w')) {
        const raw = d.includes('e') ? resizeStartSize.current.w + dx : resizeStartSize.current.w - dx
        const newW = Math.max(minW, raw)
        finalW = newW
        setCanvasModeWidth(newW)
        // push drawing left when right border closes in
        if (bounds) setCanvasOffsetX(Math.min(0, newW - PAD - bounds.right))
      }
    }
    const onUp = () => {
      isResizingCanvas.current = false
      setCanvasResizeActive('')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      // Resize the canvas bitmap to the new wrapper dimensions, preserving content.
      // Grow-only: never shrink the bitmap, or drawing outside the new bounds
      // would be permanently lost. The wrapper's overflow:hidden clips the
      // oversized canvas visually instead of erasing it.
      const canvas = canvasModeRef.current
      if (canvas) {
        const newW = Math.max(canvas.width, Math.round(finalW))
        const newH = Math.max(canvas.height, Math.round(finalH))
        if (newW !== canvas.width || newH !== canvas.height) {
          const saved = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
          canvas.width = newW
          canvas.height = newH
          canvas.getContext('2d')!.putImageData(saved, 0, 0)
          setCanvasNaturalSize({ w: newW, h: newH })
          const ov = lassoOverlayRef.current
          if (ov) { ov.width = newW; ov.height = newH }
        }
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  const isDraggingCanvas = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartOffset = useRef({ x: 0, y: 0 });

  const startCanvasDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingCanvas.current = true;
    hasInteractedRef.current = true;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartOffset.current = { x: canvasModeX, y: canvasModeY };

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingCanvas.current) return;
      const dx = ev.clientX - dragStartPos.current.x;
      const dy = ev.clientY - dragStartPos.current.y;
      setCanvasModeX(dragStartOffset.current.x + dx);
      setCanvasModeY(dragStartOffset.current.y + dy);
    };

    const onUp = () => {
      isDraggingCanvas.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const [fontStyleOpen, setFontStyleOpen] = useState(false)
  const [fontStyle, setFontStyle] = useState('Normal')
  const [fontFamilyOpen, setFontFamilyOpen] = useState(false)
  const [fontFamily, setFontFamily] = useState('Default')
  const [fontSizeOpen, setFontSizeOpen] = useState(false)
  const [fontSize, setFontSize] = useState('14')
  const [fontColorOpen, setFontColorOpen] = useState(false)
  const [fontColor, setFontColor] = useState('#000000')
  const [highlightColorOpen, setHighlightColorOpen] = useState(false)
  const [highlightColor, setHighlightColor] = useState('#ffff00')
  const [caseTypeOpen, setCaseTypeOpen] = useState(false)
  const [watermarkOpen, setWatermarkOpen] = useState(false)
  const [watermarkColor, setWatermarkColor] = useState('#ffe0b2')
  const [alignOpen, setAlignOpen] = useState(false)
  const [alignValue, setAlignValue] = useState('Left')
  const [spacingOpen, setSpacingOpen] = useState(false)
  const [spacingValue, setSpacingValue] = useState('1.0')
  const [tableOpen, setTableOpen] = useState(false)
  const [tableHover, setTableHover] = useState([0, 0])
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [pasteMenuOpen, setPasteMenuOpen] = useState(false)
  const [toolbarMenuPos, setToolbarMenuPos] = useState({ bottom: 0, left: 0 })
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [linkOpenNewTab, setLinkOpenNewTab] = useState(true)
  const [editingLinkEl, setEditingLinkEl] = useState<HTMLAnchorElement | null>(null)
  const [signaturePopoverOpen, setSignaturePopoverOpen] = useState(false)
  const [signatureDraft, setSignatureDraft] = useState('')
  const [savedSignature, setSavedSignature] = useState('')
  const [autoInsertSignature, setAutoInsertSignature] = useState(false)
  const signatureStorageKey = `mail_signature_${userEmail || 'default'}`
  const signatureAutoStorageKey = `mail_signature_auto_${userEmail || 'default'}`
  useEffect(() => {
    try {
      setSavedSignature(localStorage.getItem(signatureStorageKey) || '')
      setAutoInsertSignature(localStorage.getItem(signatureAutoStorageKey) === '1')
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail])
  useEffect(() => {
    if (formatTab !== 'text') return
    const el = document.getElementById('text-toolbar-scroll')
    if (!el) return
    const updateOverflow = () => {
      setTextToolbarOverflow({
        left: el.scrollLeft > 0,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      })
    }
    updateOverflow()
    el.addEventListener('scroll', updateOverflow)
    const resizeObserver = new ResizeObserver(updateOverflow)
    resizeObserver.observe(el)
    return () => {
      el.removeEventListener('scroll', updateOverflow)
      resizeObserver.disconnect()
    }
  }, [formatTab])
  useEffect(() => {
    if (formatTab !== 'draw') return
    const el = document.getElementById('draw-toolbar-scroll')
    if (!el) return
    const updateOverflow = () => {
      setDrawToolbarOverflow({
        left: el.scrollLeft > 0,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      })
    }
    updateOverflow()
    el.addEventListener('scroll', updateOverflow)
    const resizeObserver = new ResizeObserver(updateOverflow)
    resizeObserver.observe(el)
    return () => {
      el.removeEventListener('scroll', updateOverflow)
      resizeObserver.disconnect()
    }
  }, [formatTab])
  const closeAllToolbarMenus = () => {
    setFontStyleOpen(false); setFontFamilyOpen(false); setFontSizeOpen(false); setCaseTypeOpen(false)
    setAlignOpen(false); setSpacingOpen(false); setTableOpen(false); setPasteMenuOpen(false)
    setFontColorOpen(false); setHighlightColorOpen(false); setWatermarkOpen(false); setLinkPopoverOpen(false)
    setSignaturePopoverOpen(false)
  }
  const toggleToolbarMenu = (isOpen: boolean, setOpen: (v: boolean) => void, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    saveEditorSelection()
    const willOpen = !isOpen
    const r = e.currentTarget.getBoundingClientRect()
    closeAllToolbarMenus()
    if (willOpen) { setToolbarMenuPos({ bottom: window.innerHeight - r.top + 4, left: r.left }); setOpen(true) }
  }

  const pasteButtonRef = useRef<HTMLButtonElement>(null)
  const [pasteMenuPos, setPasteMenuPos] = useState<{ top: number; left: number } | null>(null)
  const currentConvIdRef = useRef<string | null>(selectedConversation)
  const flushDraftSaveRef = useRef<() => void>(() => {})
  const activeDraftSessionRef = useRef(0)
  const historyDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef('')
  const pushHistory = (val: string) => {
    unifiedUndoStack.current.push({ kind: 'text', data: val })
    unifiedRedoStack.current = []
    setUndoCount(unifiedUndoStack.current.length); setRedoCount(0)
  }
  const pushHistoryDebounced = (prev: string, next: string) => {
    if (historyDebounce.current) clearTimeout(historyDebounce.current)
    historyDebounce.current = setTimeout(() => {
      if (prev !== next && lastSavedRef.current !== prev) {
        unifiedUndoStack.current.push({ kind: 'text', data: prev })
        unifiedRedoStack.current = []
        lastSavedRef.current = prev
        setUndoCount(unifiedUndoStack.current.length); setRedoCount(0)
      }
    }, 500)
  }
  const undo = doUndo
  const redo = doRedo
  // historyStack / futureStack kept as read-only length shims for any remaining UI guards
  const historyStack = { current: { length: undoCount } }
  const futureStack = { current: { length: redoCount } }

  const setDraftId = (id: number | null) => {
    draftIdRef.current = id
    if (contactEmail) return
    if (id) sessionStorage.setItem('chat_draftId', id.toString())
    else sessionStorage.removeItem('chat_draftId')
  }

  useEffect(() => {
    // These keys are global/unscoped — only the single main/generic instance should
    // own them. A per-contact instance writing here would stomp on main's draft (and
    // vice versa), since both would read the same last-writer-wins values on reload.
    if (contactEmail) return
    sessionStorage.setItem('chat_selectedConversation', selectedConversation || '')
    sessionStorage.setItem('chat_viewMode', viewMode)
    safeSessionSet('chat_inputValue', inputValue)
    sessionStorage.setItem('chat_subjectValue', subjectValue)
    sessionStorage.setItem('chat_toEmails', JSON.stringify(toEmails))
    sessionStorage.setItem('chat_initialToEmails', JSON.stringify(initialToEmails))
    sessionStorage.setItem('chat_toInput', toInput)
    sessionStorage.setItem('chat_ccEmails', JSON.stringify(ccEmails))
    sessionStorage.setItem('chat_ccInput', ccInput)
    sessionStorage.setItem('chat_bccEmails', JSON.stringify(bccEmails))
    sessionStorage.setItem('chat_bccInput', bccInput)
    sessionStorage.setItem('chat_showCc', showCc ? 'true' : 'false')
    sessionStorage.setItem('chat_showBcc', showBcc ? 'true' : 'false')
    try {
      // Strip blob: object URLs and large base64 dataUrls — neither survive page reload
      const persistable = attachedFiles.map(f => ({
        name: f.name, size: f.size,
        dataUrl: f.dataUrl && !f.dataUrl.startsWith('blob:') && f.dataUrl.length < 500_000 ? f.dataUrl : undefined
      }))
      sessionStorage.setItem('chat_attachments', JSON.stringify(persistable))
    } catch (_) {}
    if (replyEmailCard) {
      try { sessionStorage.setItem('chat_replyEmailCard', JSON.stringify(replyEmailCard)) } catch (_) {}
    } else {
      sessionStorage.removeItem('chat_replyEmailCard')
    }
  }, [contactEmail, selectedConversation, viewMode, inputValue, subjectValue, toEmails, initialToEmails, toInput, ccEmails, ccInput, bccEmails, bccInput, showCc, showBcc, attachedFiles, replyEmailCard])

  useEffect(() => {
    currentConvIdRef.current = selectedConversation
  }, [selectedConversation])

  // canvas restore is handled after the inputValue sync effect below

  useEffect(() => {
    flushDraftSaveRef.current = () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current)
        draftSaveTimerRef.current = null
      }

      const isAutoSave = autoSaveMode.current
      autoSaveMode.current = false

      if (isClearingRef.current || !hasInteractedRef.current) return

      const currentInput = commitActiveCanvasToImage(!isAutoSave)
      const contact = conversationsRef.current.find(c => c.id === currentConvIdRef.current)
      const autoTo = contact ? contact.email.toLowerCase() : null
      const hasAutoToOnly = autoTo && toEmails.length === 1 && toEmails[0].toLowerCase() === autoTo && !toInput.trim()
      const hasMeaningfulTo = toEmails.length > 0 ? !hasAutoToOnly : false
      const inputTextContent = currentInput.replace(/<br\s*\/?>/gi, '').replace(/<[^>]+>/g, '')
      const hasContent = inputTextContent || subjectValue.trim() || hasMeaningfulTo || toInput.trim() || ccEmails.length > 0 || ccInput.trim() || bccEmails.length > 0 || bccInput.trim() || replyEmailCard !== null || attachedFiles.length > 0 || currentInput.includes('<img')

      if (hasContent) {
        const finalTo = toInput.trim() ? [...toEmails, toInput.trim()] : toEmails
        const finalCc = ccInput.trim() ? [...ccEmails, ccInput.trim()] : ccEmails
        const finalBcc = bccInput.trim() ? [...bccEmails, bccInput.trim()] : bccEmails

        let draftBody = currentInput
        let draftSubject = subjectValue
        if (replyEmailCard && replyEmailCard.action !== 'forward') {
          if (!draftSubject) {
            const cleanSubject = replyEmailCard.subject.replace(/^(Re:\s*|Fwd:\s*|Fw:\s*)+/i, '')
            draftSubject = `Re: ${cleanSubject}`
          }
          const dateStr = replyEmailCard.date ? new Date(replyEmailCard.date).toLocaleString() : ''
          const sourceIdLine = replyEmailCard.sourceMessageId != null ? `\nSourceId: ${replyEmailCard.sourceMessageId}` : ''
          draftBody = `${currentInput}${REPLY_DRAFT_SEPARATOR}From: ${replyEmailCard.from}\nDate: ${dateStr}\nSubject: ${replyEmailCard.subject}${sourceIdLine}\n\n${replyEmailCard.body}`
        }

        const draftTo = finalTo.length > 0 ? finalTo : (replyEmailCard && replyEmailCard.action !== 'forward' ? [replyEmailCard.from] : [])
        const payload = { to: draftTo.join(', '), subject: draftSubject, body: draftBody, cc: finalCc.join(', '), bcc: finalBcc.join(', '), has_attachments: attachedFiles.length > 0 }

        const currentSession = activeDraftSessionRef.current

        const tempDraftEmail: Email = {
          id: draftIdRef.current || -Date.now(),
          to: draftTo.join(', '),
          subject: draftSubject || '(No subject)',
          body: draftBody || '(no content)',
          cc: finalCc.join(', ') || undefined,
          bcc: finalBcc.join(', ') || undefined,
          from: userEmail,
          date: new Date().toISOString(),
          isDraft: true,
          folder: 'drafts',
          hasAttachments: attachedFiles.length > 0
        }

        setAllEmails(prev => {
          if (draftIdRef.current && draftIdRef.current > 0) {
            return prev.map(e => e.id === draftIdRef.current ? { ...e, ...tempDraftEmail } : e)
          } else {
            return [tempDraftEmail, ...prev]
          }
        })

        setConversations(prev => {
          let found = false
          const updated = prev.map(c => {
            if (c.id === currentConvIdRef.current || (draftIdRef.current && c.draftEmail?.id === draftIdRef.current)) {
              found = true
              return { ...c, draftEmail: tempDraftEmail, lastEmail: tempDraftEmail }
            }
            return c
          })
          if (!found) {
            const newDraftConvId = `draft_${tempDraftEmail.id}`
            updated.unshift({
              id: newDraftConvId,
              name: draftTo.join(', ') || 'Draft',
              email: draftTo.join(', ') || newDraftConvId,
              initials: 'Dr',
              preview: tempDraftEmail.body.substring(0, 50),
              isRead: true,
              isSent: false,
              isScheduled: false,
              isDraft: true,
              draftEmail: tempDraftEmail,
              lastEmail: tempDraftEmail,
              totalCount: 1,
            })
            // track the new draft so live-preview applies to it immediately
            setLastOpenedConversationId(newDraftConvId)
          }
          return updated
        })

        // Decide PUT-vs-POST (and read draftIdRef) only once this save actually
        // runs, after any earlier queued save has resolved and assigned an ID —
        // otherwise two near-simultaneous flushes (e.g. flush-on-navigate racing
        // flush-on-unmount) both see no draftId yet and each POST a new draft.
        const runSave = (): Promise<void> => {
          const isRealDraft = draftIdRef.current && draftIdRef.current > 0
          const endpoint = isRealDraft ? `http://localhost:5050/api/emails/${draftIdRef.current}/draft` : 'http://localhost:5050/api/emails/draft'
          const method = isRealDraft ? 'PUT' : 'POST'
          return fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
            keepalive: true // Ensures the request isn't cancelled if the page is navigating away
          })
          .then(res => res.json())
          .then(data => {
            if (method === 'POST' && data.draftId) {
              // Normally only record the new id if we're still in the same compose
              // session (otherwise a late response could stomp on the id of a
              // different draft the user has since switched to). But if nothing
              // has claimed draftIdRef in the meantime, there's nothing to protect —
              // and skipping unconditionally would leave a real, just-created draft
              // permanently unlinked, so a chained save right behind this one would
              // POST a duplicate instead of PUT-updating it.
              if (activeDraftSessionRef.current === currentSession || draftIdRef.current == null) {
                sessionStorage.setItem('chat_draftId', data.draftId.toString());
                draftIdRef.current = data.draftId;
                // Catches up floatingDraftIdRef if the user floated this draft (clicked
                // "New Window") before this autosave POST resolved — at that earlier
                // moment draftIdRef.current (and so floatingDraftIdRef) was still null,
                // since this is the first save that actually creates the draft row.
                if (composeFloating && floatingDraftIdRef.current == null) {
                  setFloatingDraftId(data.draftId)
                }
              }
            }
            // Persist attachments to localStorage keyed by draft ID so they survive page reloads
            const resolvedId = method === 'POST' && data.draftId ? data.draftId : draftIdRef.current
            if (resolvedId && attachedFiles.length > 0) {
              try { localStorage.setItem(`draft_${resolvedId}_attachments`, JSON.stringify(attachedFiles)) } catch {}
            } else if (resolvedId) {
              try { localStorage.removeItem(`draft_${resolvedId}_attachments`) } catch {}
            }
          }).finally(() => {
            // Dispatch on autosave too (not just explicit saves) so drafting in one
            // window/popout is reflected in other open email/chatmail lists without
            // requiring an explicit action — the 2s debounce already throttles this.
            window.dispatchEvent(new Event('mailRefresh'))
          }).catch(() => {})
        }
        draftSaveChainRef.current = draftSaveChainRef.current.then(runSave, runSave)
      } else if (!hasContent && draftIdRef.current) {
        setConversations(prev => prev.map(c => c.id === currentConvIdRef.current ? { ...c, draftEmail: undefined } : c))
        const idToDelete = draftIdRef.current
        try { localStorage.removeItem(`draft_${idToDelete}_attachments`) } catch {}
        const runDelete = (): Promise<void> => fetch(`http://localhost:5050/api/emails/${idToDelete}/draft`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true
        }).then(() => {}).catch(() => {}).finally(() => {
          window.dispatchEvent(new Event('mailRefresh'))
          window.dispatchEvent(new CustomEvent('chatmail:draftDeleted', { detail: { draftId: idToDelete } }))
        })
        draftSaveChainRef.current = draftSaveChainRef.current.then(runDelete, runDelete)
      }
    }
  })

  useEffect(() => {
    const handleBeforeUnload = () => {
      const finalHtml = commitActiveCanvasToImageRef.current()
      // Global key — only the main instance owns it (see the save-effect above); a
      // contact instance writing here on unload would stomp on main's draft text.
      if (!contactEmail) safeSessionSet('chat_inputValue', finalHtml)
      flushDraftSaveRef.current()
      isClearingRef.current = true
      setTimeout(() => {
        isClearingRef.current = false
      }, 1000)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      flushDraftSaveRef.current()
    }
  }, [])

  const clearComposeSession = () => {
    ;['chat_viewMode','chat_selectedConversation','chat_inputValue','chat_subjectValue',
      'chat_toEmails','chat_initialToEmails','chat_toInput','chat_ccEmails','chat_ccInput','chat_bccEmails',
      'chat_bccInput','chat_showCc','chat_showBcc','chat_draftId','chat_attachments',
      'chat_replyEmailCard'].forEach(k => sessionStorage.removeItem(k))
  }

  useEffect(() => {
    const handleResetChatMail = () => {
      if (contactEmail) return
      // While the compose panel is floating, the user has deliberately kept that
      // draft session alive — only restore the list view, don't wipe its fields.
      if (composeFloating) {
        setViewMode('list')
        setSelectedConversation(null)
        // Same navKey blind spot as handleBackToList — clicking "Chat Mail" while
        // already on /chatmail with no contact open doesn't change navKey, so the
        // auto-reminimize effect never fires; minimize explicitly here too.
        if (!composeFloatMinimized) {
          setComposeFloatMinimized(true)
          const pos = computeMinimizedPos(floatSlotIndex)
          if (pos) setFloatPos(pos)
        }
        requestAnimationFrame(() => {
          if (listContainerRef.current) {
            listContainerRef.current.scrollTop = savedListScrollPos.current
          }
        })
        return
      }
      flushDraftSaveRef.current()
      // flushDraftSaveRef saves the current (pre-reset) viewMode to sessionStorage;
      // clear everything so a remount also starts fresh.
      clearComposeSession()
      isClearingRef.current = true
      hasInteractedRef.current = false
      activeDraftSessionRef.current += 1
      // Defer nulling the draft id until the flush just queued above has actually run —
      // flushDraftSaveRef's save reads draftIdRef.current asynchronously (it's chained,
      // not synchronous), so clearing it here immediately would make that pending save
      // think there's no existing draft and POST a duplicate instead of updating it.
      draftSaveChainRef.current = draftSaveChainRef.current.then(() => setDraftId(null))
      setViewMode('list')
      setSelectedConversation(null)
      setInputValue('')
      setSubjectValue('')
      setToEmails([])
      setInitialToEmails([])
      setToInput('')
      setCcEmails([])
      setCcInput('')
      setBccEmails([])
      setBccInput('')
      setShowCc(false)
      setShowBcc(false)
      setReplyEmailCard(null)
      setAttachedFiles([])
      requestAnimationFrame(() => {
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop = savedListScrollPos.current
        }
      })
      setTimeout(() => { isClearingRef.current = false }, 250)
    }
    window.addEventListener('resetChatMail', handleResetChatMail)
    return () => window.removeEventListener('resetChatMail', handleResetChatMail)
  }, [contactEmail, composeFloating])

  // Sidebar folders/labels can ask the already-mounted Chat Mail instance to jump to a
  // specific folder tab (see App.tsx's goToChatMailTab) — this instance never unmounts
  // across Inbox/Sent/etc. navigation, so a live event is required instead of initial state.
  useEffect(() => {
    const handleSetListTab = (e: Event) => {
      const tab = (e as CustomEvent).detail as string
      setChatListTab(tab)
      sessionStorage.setItem('chat_persistedListTab', tab)
      setViewMode('list')
      setSelectedConversation(null)
    }
    window.addEventListener('chatmail:setListTab', handleSetListTab)
    return () => window.removeEventListener('chatmail:setListTab', handleSetListTab)
  }, [])

  // Flush draft when user navigates away via sidebar/app-bar (before unmount)
  useEffect(() => {
    const handleFlushDraft = () => { flushDraftSaveRef.current() }
    window.addEventListener('chatmail:flushDraft', handleFlushDraft)
    return () => window.removeEventListener('chatmail:flushDraft', handleFlushDraft)
  }, [])

  // A draft can be deleted from somewhere other than the instance that's floating it
  // (e.g. the Drafts folder, or Trash's permanent-delete) — when that happens, this
  // instance must close its own floating/minimized panel and clear its fields instead
  // of leaving a strip around for a draft that no longer exists.
  useEffect(() => {
    const handleDraftDeleted = (e: Event) => {
      const deletedId = (e as CustomEvent<{ draftId: number }>).detail?.draftId
      if (deletedId == null || draftIdRef.current !== deletedId) return
      if (composeFloating) { setComposeFloating(false); setComposeFloatMinimized(false); setFloatPos(null); setFloatingDraftId(null) }
      draftIdRef.current = null
      sessionStorage.removeItem('chat_draftId')
      setReplyEmailCard(null)
      setSubjectValue('')
      setInputValue('')
      if (!contactEmail) {
        setToEmails([]); setInitialToEmails([]); setToInput('')
        setCcEmails([]); setBccEmails([]); setCcInput(''); setBccInput('')
        setShowCc(false); setShowBcc(false)
      }
      setAttachedFiles([])
    }
    window.addEventListener('chatmail:draftDeleted', handleDraftDeleted)
    return () => window.removeEventListener('chatmail:draftDeleted', handleDraftDeleted)
  }, [contactEmail, composeFloating])

  const getTimeAgo = (date?: string) => {
    const diff = Math.floor((now - new Date(date || now).getTime()) / 1000)
    if (diff < 60) return `${diff} ${diff === 1 ? 'sec' : 'secs'} ago`
    if (diff < 3600) { const m = Math.floor(diff / 60); return `${m} ${m === 1 ? 'min' : 'mins'} ago` }
    if (diff < 86400) { const h = Math.floor(diff / 3600); return `${h} ${h === 1 ? 'hour' : 'hours'} ago` }
    if (diff < 2592000) { const d = Math.floor(diff / 86400); return `${d} ${d === 1 ? 'day' : 'days'} ago` }
    if (diff < 31536000) { const mo = Math.floor(diff / 2592000); return `${mo} ${mo === 1 ? 'month' : 'months'} ago` }
    const y = Math.floor(diff / 31536000); return `${y} ${y === 1 ? 'year' : 'years'} ago`
  }

  const userResizedTextareaRef = useRef(false)

  const autoResizeTextarea = () => {
    // triggered via useEffect after render — see below
  }

  useEffect(() => {
    if (canvasMode) return  // don't wipe editor while canvas is active
    if (editorRef.current && editorRef.current.innerHTML !== inputValue) {
      editorRef.current.innerHTML = inputValue;
      // Restore file card thumbnails whose base64 src was stripped for sessionStorage quota
      editorRef.current.querySelectorAll('[data-file-card]').forEach((card) => {
        const img = card.querySelector('img')
        if (img && (!img.getAttribute('src') || img.getAttribute('src') === '')) {
          const filename = decodeURIComponent((card as HTMLElement).dataset.attachment || '')
          if (filename) img.src = generateFileSVGUrl(filename)
        }
      })
      const match = inputValue.match(/font-size:\s*(\d+)px/);
      if (match) setFontSize(match[1]);
      else setFontSize('14');

      const hasContent = inputValue.replace(/<br\s*\/?>/gi, '').replace(/<[^>]+>/g, '').trim().length > 0
        || inputValue.includes('<img')

      if (hasContent) {
        // Draft has content — expand panel to fit then scroll to the end so the
        // latest typed text is immediately visible (two rAF frames: first flushes
        // the height state, second waits for browser layout to finish).
        requestAnimationFrame(() => {
          const editor = editorRef.current
          if (!editor) return
          const overflow = editor.scrollHeight - editor.clientHeight
          if (overflow > 0) {
            setInputPanelHeight(prev => Math.min(600, prev + overflow))
          }
          requestAnimationFrame(() => {
            if (editorRef.current) {
              editorRef.current.scrollTop = editorRef.current.scrollHeight
            }
          })
        })
      } else {
        // Empty draft / new compose — reset panel to default height so the
        // empty field is shown prominently at the bottom ("dragged up").
        const minH = 248 + (showCc ? 40 : 0) + (showBcc ? 40 : 0)
        setInputPanelHeight(minH)
        requestAnimationFrame(() => { editorRef.current?.focus() })
      }
    }
  // composeInlineSlot is included so this retries once the inline portal target (and
  // therefore editorRef.current) actually mounts — on a cold restore with a static,
  // already-populated inputValue (e.g. after a page reload), the very first run can
  // land before the slot ref attaches, and since none of the other deps change again
  // afterward, the editor would otherwise stay empty forever despite correct state.
  }, [inputValue, viewMode, canvasMode, composeFloating, composeInlineSlot]);

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const overflow = editor.scrollHeight - editor.clientHeight
    if (overflow > 0) {
      // Add one extra row so the newly-typed line + one empty row below it are visible
      const lineH = Math.round(parseFloat(getComputedStyle(editor).lineHeight) || 21)
      setInputPanelHeight(prev => Math.min(600, prev + overflow + lineH))
    }
  }, [inputValue])

  // Live-preview: update conversation list item in real time as user types / attaches / draws
  useEffect(() => {
    const activeId = lastOpenedConversationId ?? selectedConversation
    if (!activeId || viewMode !== 'chat') { setLivePreview(null); return }
    setLivePreview({
      subject: subjectValue,
      body: inputValue,
      hasAttachments: attachedFiles.length > 0,
      hasCanvas: canvasMode,
    })
  }, [inputValue, subjectValue, attachedFiles, canvasMode, lastOpenedConversationId, selectedConversation, viewMode])

  // Scroll the editor so the newly-inserted canvas board is fully visible.
  // canvasPortalTarget changes every time a new canvas is opened.
  useEffect(() => {
    if (!canvasPortalTarget) return
    // Two rAF frames: first lets the panel height expansion render,
    // second waits for the browser to finish layout, then scrollIntoView.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      canvasPortalTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }))
  }, [canvasPortalTarget])

  useEffect(() => {
    const minH = 248 + (showCc ? 40 : 0) + (showBcc ? 40 : 0)
    setInputPanelHeight(prev => Math.max(minH, prev))
  }, [showCc, showBcc])

  const CODE_EXTS = new Set(['js','ts','jsx','tsx','py','html','css','json','xml','java','c','cpp','go','rb','php','swift','sh','yaml','yml','toml','csv','txt','md','rtf','ini','env','sql','graphql','vue','svelte','kt','rs','dart'])
  useEffect(() => {
    setPreviewCodeContent(null)
    if (!filePreview || !CODE_EXTS.has(filePreview.ext)) return
    if (!filePreview.url || !filePreview.url.startsWith('http')) return
    setPreviewCodeLoading(true)
    fetch(filePreview.url)
      .then(r => r.text())
      .then(text => { setPreviewCodeContent(text); setPreviewCodeLoading(false) })
      .catch(() => setPreviewCodeLoading(false))
  }, [filePreview])

  useEffect(() => {
    if (replyEmailCard) {
      setInputPanelHeight(prev => Math.min(600, prev + 210))
      return () => {
        setInputPanelHeight(prev => Math.max(248, prev - 210))
      }
    }
  }, [Boolean(replyEmailCard)])

  // Commit lasso/select selection when switching away from those tools
  useEffect(() => {
    if (drawTool !== 'lasso' && drawTool !== 'select' && lassoSelRef.current) commitLassoSel()
  }, [drawTool, commitLassoSel])

  // Delete/Escape key handling for lasso selection
  useEffect(() => {
    if (!canvasMode) return
    const onKey = (e: KeyboardEvent) => {
      if (!lassoSelRef.current) return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); discardLassoSel() }
      if (e.key === 'Escape') { e.preventDefault(); commitLassoSel() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [canvasMode, commitLassoSel, discardLassoSel])

  // Sync overlay canvas size whenever main canvas natural size changes
  useEffect(() => {
    if (!canvasNaturalSize || !lassoOverlayRef.current) return
    lassoOverlayRef.current.width = canvasNaturalSize.w
    lassoOverlayRef.current.height = canvasNaturalSize.h
  }, [canvasNaturalSize])

  const applyCase = (caseType: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const selected = sel.toString()
    if (!selected) return

    let result = selected
    switch (caseType) {
      case 'UPPERCASE': result = selected.toUpperCase(); break
      case 'lowercase': result = selected.toLowerCase(); break
      case 'Title Case': result = selected.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()); break
      case 'Sentence case': result = selected.charAt(0).toUpperCase() + selected.slice(1).toLowerCase(); break
      case 'tOGGLE cASE': result = selected.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join(''); break
    }
    document.execCommand('insertText', false, result)
    setInputValue(editorRef.current.innerHTML)
    hasInteractedRef.current = true
    setCaseTypeOpen(false)
  }

  const applyFontStyle = (style: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    let arg = 'P'
    if (style === 'Heading 1') arg = 'H1'
    if (style === 'Heading 2') arg = 'H2'
    if (style === 'Heading 3') arg = 'H3'
    if (style === 'Quote') arg = 'BLOCKQUOTE'
    if (style === 'Code') arg = 'PRE'

    document.execCommand('formatBlock', false, arg)
    setInputValue(editorRef.current.innerHTML)
    setFontStyle(style)
    setFontStyleOpen(false)
    hasInteractedRef.current = true
  }

  const insertTable = (rows: number, cols: number) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    let html = '<table style="border-collapse: collapse; width: 100%; border: 1px solid #ddd;"><tbody>'
    for (let r = 0; r < rows; r++) {
      html += '<tr>'
      for (let c = 0; c < cols; c++) {
        html += `<td style="border: 1px solid #ddd; padding: 6px;">${r === 0 ? 'Header' : 'Cell'}</td>`
      }
      html += '</tr>'
    }
    html += '</tbody></table><br>'
    document.execCommand('insertHTML', false, html)
    setInputValue(editorRef.current.innerHTML)
    hasInteractedRef.current = true
    setTableOpen(false)
    setTableHover([0, 0])
  }

  const toRoman = (n: number) => {
    const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1]
    const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I']
    let result = ''
    for (let i = 0; i < vals.length; i++) { while (n >= vals[i]) { result += syms[i]; n -= vals[i] } }
    return result
  }

  const updateActiveFormats = () => {
    const active = new Set<string>()
    if (document.queryCommandState('bold')) active.add('bold')
    if (document.queryCommandState('italic')) active.add('italic')
    if (document.queryCommandState('underline')) active.add('underline')
    if (document.queryCommandState('strikeThrough')) active.add('strike')
    if (document.queryCommandState('subscript')) active.add('sub')
    if (document.queryCommandState('superscript')) active.add('sup')
    
    if (document.queryCommandState('insertUnorderedList')) {
      const sel = window.getSelection()
      let listStyleType = ''
      let listStyleImage = ''
      let ulElement: HTMLElement | null = null
      if (sel && sel.rangeCount > 0) {
        let node = sel.anchorNode
        while (node && node !== editorRef.current) {
          if (node.nodeName === 'UL') {
            ulElement = node as HTMLElement
            break
          }
          node = node.parentNode
        }
      }
      if (!ulElement && editorRef.current) {
        const lists = editorRef.current.querySelectorAll('ul')
        if (lists.length === 1) ulElement = lists[0] as HTMLElement
      }
      if (ulElement) {
        listStyleType = ulElement.style.listStyleType
        listStyleImage = ulElement.style.listStyleImage
      }
      if (ulElement?.classList.contains('star-marker-list')) {
        active.add('star-list')
      } else if (listStyleImage.includes("x1='2' y1='5' x2='8' y2='5'") || listStyleImage.includes("x1='2'%20y1='5'%20x2='8'%20y2='5'")) {
        active.add('dash-list')
      } else if (listStyleType.includes('→')) {
        active.add('arrow-list')
      } else {
        active.add('ul')
      }
    }
    if (document.queryCommandState('insertOrderedList')) {
      const sel = window.getSelection()
      let listType = ''
      let olElement: HTMLElement | null = null
      if (sel && sel.rangeCount > 0) {
        let node = sel.anchorNode
        while (node && node !== editorRef.current) {
          if (node.nodeName === 'OL') {
            olElement = node as HTMLElement
            break
          }
          node = node.parentNode
        }
      }
      if (!olElement && editorRef.current) {
        const lists = editorRef.current.querySelectorAll('ol')
        if (lists.length === 1) olElement = lists[0] as HTMLElement
      }
      if (olElement) listType = olElement.style.listStyleType
      if (listType === 'upper-alpha') active.add('upper-list')
      else if (listType === 'lower-alpha') active.add('lower-list')
      else if (listType === 'upper-roman') active.add('roman-list')
      else active.add('ol')
    }
    if (document.queryCommandState('justifyLeft')) active.add('align-Left')
    if (document.queryCommandState('justifyCenter')) active.add('align-Center')
    if (document.queryCommandState('justifyRight')) active.add('align-Right')
    if (document.queryCommandState('justifyFull')) active.add('align-Justify')

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node = sel.anchorNode;
      let detectedSize: string | null = null;
      let detectedDir: string | null = null;
      while (node && node !== editorRef.current) {
        if (node.nodeName === 'BLOCKQUOTE') active.add('quote');
        if (node.nodeName === 'CODE' || node.nodeName === 'PRE') { active.add('code'); active.add('codeblock'); }
        if (!detectedSize && (node as HTMLElement).style?.fontSize) {
          const match = (node as HTMLElement).style.fontSize.match(/(\d+)px/);
          if (match) detectedSize = match[1];
        }
        if (!detectedDir && (node as HTMLElement).getAttribute?.('dir')) {
          detectedDir = (node as HTMLElement).getAttribute('dir');
        }
        node = node.parentNode;
      }
      if (detectedSize) setFontSize(detectedSize);
      else setFontSize('14');

      if (detectedDir === 'rtl') active.add('rtl');
      else if (detectedDir === 'ltr') active.add('ltr');
    }
    setActiveFormats(active)
  }

  const applyFormat = (format: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    pushHistory(inputValue)

    let command = ''
    let arg: string | undefined = undefined
    let shouldExecuteCommand = true

    const isUl = document.queryCommandState('insertUnorderedList')
    const isOl = document.queryCommandState('insertOrderedList')

    switch (format) {
      case 'bold': command = 'bold'; break
      case 'italic': command = 'italic'; break
      case 'underline': command = 'underline'; break
      case 'strike': command = 'strikeThrough'; break
      case 'sub': command = 'subscript'; break
      case 'sup': command = 'superscript'; break
      case 'ul':
      case 'star-list':
      case 'dash-list':
      case 'arrow-list':
        command = 'insertUnorderedList'
        if (isUl) {
          const sel = window.getSelection()
          let currentListStyle = ''
          let currentListImage = ''
          let curUlEl: HTMLElement | null = null
          if (sel && sel.rangeCount > 0) {
            let node = sel.anchorNode
            while (node && node !== editorRef.current) {
              if (node.nodeName === 'UL') {
                curUlEl = node as HTMLElement
                break
              }
              node = node.parentNode
            }
          }
          if (!curUlEl && editorRef.current) {
            const lists = editorRef.current.querySelectorAll('ul')
            if (lists.length === 1) curUlEl = lists[0] as HTMLElement
          }
          if (curUlEl) {
            currentListStyle = curUlEl.style.listStyleType
            currentListImage = curUlEl.style.listStyleImage
          }
          let currentFmt = 'ul'
          if (curUlEl?.classList.contains('star-marker-list')) currentFmt = 'star-list'
          else if (currentListImage.includes("x1='2' y1='5' x2='8' y2='5'") || currentListImage.includes("x1='2'%20y1='5'%20x2='8'%20y2='5'")) currentFmt = 'dash-list'
          else if (currentListStyle.includes('→')) currentFmt = 'arrow-list'
          if (currentFmt !== format) {
             shouldExecuteCommand = false
          }
        }
        break
      case 'ol':
      case 'upper-list':
      case 'lower-list':
      case 'roman-list':
        command = 'insertOrderedList'
        if (isOl) {
          const sel = window.getSelection()
          let currentListStyle = ''
          let curOlEl: HTMLElement | null = null
          if (sel && sel.rangeCount > 0) {
            let node = sel.anchorNode
            while (node && node !== editorRef.current) {
              if (node.nodeName === 'OL') {
                curOlEl = node as HTMLElement
                break
              }
              node = node.parentNode
            }
          }
          if (!curOlEl && editorRef.current) {
            const lists = editorRef.current.querySelectorAll('ol')
            if (lists.length === 1) curOlEl = lists[0] as HTMLElement
          }
          if (curOlEl) currentListStyle = curOlEl.style.listStyleType
          let currentFmt = 'ol'
          if (currentListStyle === 'upper-alpha') currentFmt = 'upper-list'
          else if (currentListStyle === 'lower-alpha') currentFmt = 'lower-list'
          else if (currentListStyle === 'upper-roman') currentFmt = 'roman-list'

          if (currentFmt !== format) {
            shouldExecuteCommand = false
          }
        }
        break
      case 'indent': command = 'indent'; break
      case 'outdent': command = 'outdent'; break
      case 'align-Left': command = 'justifyLeft'; break
      case 'align-Center': command = 'justifyCenter'; break
      case 'align-Right': command = 'justifyRight'; break
      case 'align-Justify': command = 'justifyFull'; break
      case 'clear': command = 'removeFormat'; break
      case 'quote': {
        let quoteNode: HTMLElement | null = null;
        const sel = window.getSelection();
        let savedNode: Node | null = null;
        let savedOffset = 0;
        if (sel && sel.rangeCount > 0) {
          savedNode = sel.anchorNode;
          savedOffset = sel.anchorOffset;
          let node = sel.anchorNode;
          while (node && node !== editorRef.current) {
            if (node.nodeName === 'BLOCKQUOTE') {
              quoteNode = node as HTMLElement;
              break;
            }
            node = node.parentNode;
          }
        }
        if (quoteNode) {
          const div = document.createElement('div');
          while (quoteNode.firstChild) {
            div.appendChild(quoteNode.firstChild);
          }
          quoteNode.parentNode?.replaceChild(div, quoteNode);
          if (sel && savedNode && editorRef.current?.contains(savedNode)) {
            try {
              const range = document.createRange();
              range.setStart(savedNode, savedOffset);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            } catch (e) {}
          }
          shouldExecuteCommand = false;
        } else {
          command = 'formatBlock';
          arg = 'BLOCKQUOTE';
        }
        break;
      }
      case 'code': {
        const sel = window.getSelection();
        command = 'insertHTML';
        arg = `<code style="background:rgba(0,0,0,0.08);padding:2px 4px;border-radius:4px;font-family:monospace;">${sel?.toString() || 'code'}</code>`;
        break;
      }
      case 'codeblock': {
        const sel = window.getSelection();
        const text = sel?.toString() || 'code block';
        command = 'insertHTML';
        arg = `<pre style="background:#f4f4f4;border:1px solid #ddd;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:0.9em;overflow-x:auto;margin:4px 0;white-space:pre-wrap;display:block">${text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`;
        break;
      }
      case 'hr': command = 'insertHorizontalRule'; break;
      case 'ltr':
      case 'rtl': {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          let node = sel.anchorNode;
          let blockNode: HTMLElement | null = null;
          while (node && node !== editorRef.current) {
            if (node.nodeType === 1) {
              const name = node.nodeName;
              if (name === 'DIV' || name === 'P' || name === 'LI' || name === 'H1' || name === 'H2' || name === 'H3' || name === 'BLOCKQUOTE' || name === 'PRE') {
                blockNode = node as HTMLElement;
                break;
              }
            }
            if (node.parentNode) node = node.parentNode; else break;
          }
          if (blockNode) {
            blockNode.setAttribute('dir', format);
            blockNode.style.textAlign = format === 'rtl' ? 'right' : 'left';
          } else {
            document.execCommand('formatBlock', false, 'DIV');
            const newSel = window.getSelection();
            if (newSel && newSel.rangeCount > 0) {
              let newNode = newSel.anchorNode;
              while (newNode && newNode !== editorRef.current) {
                if (newNode.nodeName === 'DIV') {
                  (newNode as HTMLElement).setAttribute('dir', format);
                  (newNode as HTMLElement).style.textAlign = format === 'rtl' ? 'right' : 'left';
                  break;
                }
                if (newNode.parentNode) newNode = newNode.parentNode; else break;
              }
            }
          }
        }
        shouldExecuteCommand = false;
        break;
      }
      case 'space-before':
      case 'space-after': {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          let node = sel.anchorNode;
          let blockNode: HTMLElement | null = null;
          while (node && node !== editorRef.current) {
            if (node.nodeType === 1) {
              const name = node.nodeName;
              if (name === 'DIV' || name === 'P' || name === 'LI' || name === 'H1' || name === 'H2' || name === 'H3' || name === 'BLOCKQUOTE' || name === 'PRE') {
                blockNode = node as HTMLElement;
                break;
              }
            }
            if (node.parentNode) node = node.parentNode; else break;
          }
          if (blockNode) {
            if (format === 'space-before') {
              blockNode.style.marginTop = blockNode.style.marginTop ? '' : '16px';
            } else {
              blockNode.style.marginBottom = blockNode.style.marginBottom ? '' : '16px';
            }
          } else {
            document.execCommand('formatBlock', false, 'DIV');
            const newSel = window.getSelection();
            if (newSel && newSel.rangeCount > 0) {
              let newNode = newSel.anchorNode;
              while (newNode && newNode !== editorRef.current) {
                if (newNode.nodeName === 'DIV') {
                  if (format === 'space-before') (newNode as HTMLElement).style.marginTop = '16px';
                  else (newNode as HTMLElement).style.marginBottom = '16px';
                  break;
                }
                if (newNode.parentNode) newNode = newNode.parentNode; else break;
              }
            }
          }
        }
        shouldExecuteCommand = false;
        break;
      }
    }

    if (command && shouldExecuteCommand) {
      document.execCommand(command, false, arg)
    }

    if (['ul', 'star-list', 'dash-list', 'arrow-list', 'ol', 'upper-list', 'lower-list', 'roman-list'].includes(format)) {
      const applyListStyle = (el: HTMLElement) => {
        el.style.listStyleImage = 'none'
        el.style.listStyleType = ''
        el.classList.remove('star-marker-list')

        if (format === 'ul' || format === 'ol') { /* default */ }
        else if (format === 'upper-list') el.style.listStyleType = 'upper-alpha'
        else if (format === 'lower-list') el.style.listStyleType = 'lower-alpha'
        else if (format === 'roman-list') el.style.listStyleType = 'upper-roman'
        else if (format === 'star-list') el.classList.add('star-marker-list')
        else if (format === 'dash-list') el.style.listStyleImage = "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3e%3cline x1='2' y1='5' x2='8' y2='5' stroke='black' stroke-width='1.5'/%3e%3c/svg%3e\")"
        else if (format === 'arrow-list') el.style.listStyleType = '"→ "'
      }

      let targetEl: HTMLElement | null = null
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        let node = sel.anchorNode
        while (node && node !== editorRef.current) {
          if (node.nodeName === 'OL' || node.nodeName === 'UL') {
            targetEl = node as HTMLElement
            break
          }
          node = node.parentNode
        }
      }
      // Selection sometimes doesn't anchor inside the newly created list
      // (e.g. when the editor was empty before the command ran) — fall back
      // to the only matching list in the editor.
      if (!targetEl && editorRef.current) {
        const tag = (format === 'ol' || format === 'upper-list' || format === 'lower-list' || format === 'roman-list') ? 'ol' : 'ul'
        const lists = editorRef.current.querySelectorAll(tag)
        if (lists.length === 1) targetEl = lists[0] as HTMLElement
      }
      if (targetEl) applyListStyle(targetEl)
    }

    updateActiveFormats()
    setInputValue(editorRef.current.innerHTML)
    hasInteractedRef.current = true
  }

  // Strip base64 data URLs from img src before writing to sessionStorage to avoid quota errors.
  // Inline file previews are re-rendered from attachedFiles on load, so their data doesn't need to persist.
  const stripBase64ForStorage = (html: string): string =>
    html.replace(/(<img[^>]*?\ssrc=")data:[^"]*"/gi, '$1"')

  const safeSessionSet = (key: string, value: string) => {
    try { sessionStorage.setItem(key, value) } catch (_) {
      try { sessionStorage.setItem(key, stripBase64ForStorage(value)) } catch (_2) { /* quota still exceeded, skip */ }
    }
  }

  const saveEditorSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }

  // Resolves where a file/folder attachment card should land. The canvas board's
  // placeholder lives inside editorRef, so a plain "is this inside the editor?"
  // check accepts a stale or canvas-internal selection — landing the card inside
  // the canvas board. When canvas mode is open, always insert right after it instead.
  const getSafeAttachRange = (): Range => {
    const editor = editorRef.current
    if (editor && canvasMode && canvasPortalTarget && editor.contains(canvasPortalTarget)) {
      const r = document.createRange()
      r.setStartAfter(canvasPortalTarget)
      r.collapse(true)
      return r
    }
    const sel = window.getSelection()
    if (editor && savedRangeRef.current && editor.contains(savedRangeRef.current.startContainer)) {
      return savedRangeRef.current.cloneRange()
    }
    if (editor && sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).startContainer)) {
      return sel.getRangeAt(0).cloneRange()
    }
    const r = document.createRange()
    if (editor) { r.selectNodeContents(editor); r.collapse(false) }
    return r
  }

  // If the insertion point is touching an existing attachment card (cursor placed
  // right inside, right before, or right after it), returns that card so newly
  // attached files can be merged into it instead of creating a separate one.
  const findCardAtInsertionPoint = (range: Range): HTMLElement | null => {
    const node = range.startContainer
    const container = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element) || null
    if (!container) return null
    const selfCard = container.closest?.('[data-file-card="1"]') as HTMLElement | null
    if (selfCard) return selfCard
    const children = Array.from(container.childNodes)
    const before = children[range.startOffset - 1]
    const after = children[range.startOffset]
    for (const n of [before, after]) {
      if (n instanceof HTMLElement && n.matches('[data-file-card="1"]')) return n
    }
    return null
  }

  // Serializes a selection's contents for the in-app clipboard, flattening any
  // live <canvas> elements into static images first (canvas pixels never survive
  // HTML serialization, so a raw clone would paste back as a blank board).
  const serializeRangeForClipboard = (range: Range): string => {
    const frag = range.cloneContents()
    const container = document.createElement('div')
    container.appendChild(frag)
    const liveCanvases = container.querySelectorAll('canvas')
    const sourceCanvases = editorRef.current ? Array.from(editorRef.current.querySelectorAll('canvas')) : []
    liveCanvases.forEach((clonedCanvas, i) => {
      const match = sourceCanvases.find(c => c.width === clonedCanvas.width && c.height === clonedCanvas.height) || sourceCanvases[i]
      const img = document.createElement('img')
      img.src = match ? match.toDataURL('image/png') : clonedCanvas.toDataURL('image/png')
      img.style.cssText = clonedCanvas.style.cssText
      clonedCanvas.replaceWith(img)
    })
    return container.innerHTML
  }

  const copySelectionToInternalClipboard = (): Range | null => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
    const range = sel.getRangeAt(0)
    if (!editorRef.current || !editorRef.current.contains(range.startContainer)) return null
    internalClipboardRef.current = serializeRangeForClipboard(range)
    return range
  }

  const pasteFromInternalClipboard = (): boolean => {
    if (!internalClipboardRef.current || !editorRef.current) return false
    editorRef.current.focus()
    const sel = window.getSelection()
    sel?.removeAllRanges(); sel?.addRange(getSafeAttachRange())
    document.execCommand('insertHTML', false, internalClipboardRef.current)
    setInputValue(editorRef.current.innerHTML)
    hasInteractedRef.current = true
    return true
  }

  const openLinkPopover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    saveEditorSelection()
    const sel = window.getSelection()
    let linkEl: HTMLAnchorElement | null = null
    let node = sel?.anchorNode || null
    while (node && node !== editorRef.current) {
      if (node.nodeName === 'A') { linkEl = node as HTMLAnchorElement; break }
      node = node.parentNode
    }
    if (linkEl) {
      setEditingLinkEl(linkEl)
      setLinkUrl(linkEl.getAttribute('href') || '')
      setLinkText(linkEl.textContent || '')
      setLinkOpenNewTab(linkEl.getAttribute('target') === '_blank')
    } else {
      setEditingLinkEl(null)
      setLinkUrl('')
      setLinkText(sel?.toString() || '')
      setLinkOpenNewTab(true)
    }
    const r = e.currentTarget.getBoundingClientRect()
    closeAllToolbarMenus()
    setToolbarMenuPos({ bottom: window.innerHeight - r.top + 4, left: r.left })
    setLinkPopoverOpen(true)
  }

  const insertOrUpdateLink = () => {
    if (!linkUrl.trim()) return
    const href = /^[a-z][a-z0-9+.-]*:/i.test(linkUrl.trim()) ? linkUrl.trim() : `https://${linkUrl.trim()}`
    if (editingLinkEl) {
      pushHistory(inputValue)
      editingLinkEl.setAttribute('href', href)
      editingLinkEl.textContent = linkText.trim() || href
      if (linkOpenNewTab) { editingLinkEl.setAttribute('target', '_blank'); editingLinkEl.setAttribute('rel', 'noopener noreferrer') }
      else { editingLinkEl.removeAttribute('target'); editingLinkEl.removeAttribute('rel') }
      if (editorRef.current) setInputValue(editorRef.current.innerHTML)
    } else {
      if (!editorRef.current) return
      editorRef.current.focus()
      const sel = window.getSelection()
      if (savedRangeRef.current) {
        sel?.removeAllRanges()
        sel?.addRange(savedRangeRef.current)
      }
      const activeSel = window.getSelection()
      if (activeSel && activeSel.rangeCount > 0) {
        pushHistory(inputValue)
        const text = linkText.trim() || activeSel.toString() || href
        const targetAttr = linkOpenNewTab ? ' target="_blank" rel="noopener noreferrer"' : ''
        document.execCommand('insertHTML', false, `<a href="${href}"${targetAttr}>${text}</a>`)
        if (editorRef.current) setInputValue(editorRef.current.innerHTML)
      }
    }
    savedRangeRef.current = null
    setLinkPopoverOpen(false)
    setEditingLinkEl(null)
  }

  const removeLink = () => {
    if (editingLinkEl) {
      pushHistory(inputValue)
      const textNode = document.createTextNode(editingLinkEl.textContent || '')
      editingLinkEl.parentNode?.replaceChild(textNode, editingLinkEl)
      if (editorRef.current) setInputValue(editorRef.current.innerHTML)
    }
    setLinkPopoverOpen(false)
    setEditingLinkEl(null)
  }

  const openSignaturePopover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    saveEditorSelection()
    setSignatureDraft(savedSignature || '--\nBest regards,\n[Your Name]')
    const r = e.currentTarget.getBoundingClientRect()
    closeAllToolbarMenus()
    setToolbarMenuPos({ bottom: window.innerHeight - r.top + 4, left: r.left })
    setSignaturePopoverOpen(true)
  }

  const saveSignature = () => {
    setSavedSignature(signatureDraft)
    try { localStorage.setItem(signatureStorageKey, signatureDraft) } catch { /* ignore */ }
  }

  const toggleAutoInsertSignature = (checked: boolean) => {
    setAutoInsertSignature(checked)
    try { localStorage.setItem(signatureAutoStorageKey, checked ? '1' : '0') } catch { /* ignore */ }
  }

  const insertSignature = (text: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    const sel = window.getSelection()
    if (savedRangeRef.current) {
      sel?.removeAllRanges()
      sel?.addRange(savedRangeRef.current)
    }
    pushHistory(inputValue)
    const html = text.split('\n').map(line => line === '--' ? '<br>--' : line).join('<br>')
    document.execCommand('insertHTML', false, `<br><br>${html}`)
    if (editorRef.current) setInputValue(editorRef.current.innerHTML)
    savedRangeRef.current = null
  }

  const wrapSpan = (style: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    const sel = window.getSelection()
    // Restore saved selection if current selection is empty (lost when dropdown opened)
    if (savedRangeRef.current && (!sel || sel.rangeCount === 0 || sel.toString().length === 0)) {
      sel?.removeAllRanges()
      sel?.addRange(savedRangeRef.current)
    }
    const activeSel = window.getSelection()
    if (activeSel && activeSel.rangeCount > 0) {
      pushHistory(inputValue)
      if (activeSel.toString().length > 0) {
        document.execCommand('insertHTML', false, `<span style="${style}">${activeSel.toString()}</span>`)
      } else {
        // No text selected — insert a zero-width-space inside a styled span so
        // the cursor lands inside it and subsequent typing inherits the style.
        const span = document.createElement('span')
        span.setAttribute('style', style)
        span.textContent = '​'
        const range = activeSel.getRangeAt(0)
        range.insertNode(span)
        range.setStart(span.firstChild!, 1)
        range.setEnd(span.firstChild!, 1)
        activeSel.removeAllRanges()
        activeSel.addRange(range)
      }
      setInputValue(editorRef.current.innerHTML)
      hasInteractedRef.current = true
    }
    savedRangeRef.current = null
  }

  const applyInlineMarkdown = (text: string): string => {
    text = text.replace(/__([\s\S]*?)__/g, '<u>$1</u>')
    text = text.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>')
    text = text.replace(/~~([\s\S]*?)~~/g, '<s>$1</s>')
    text = text.replace(/\^([\s\S]*?)\^/g, '<sup>$1</sup>')
    text = text.replace(/~([\s\S]*?)~/g, '<sub>$1</sub>')
    text = text.replace(/_([\s\S]*?)_/g, '<em>$1</em>')
    text = text.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.08);padding:0 3px;border-radius:2px;font-family:monospace;font-size:0.9em">$1</code>')
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#1a73e8;text-decoration:underline">$1</a>')
    return text
  }

  const renderContent = (raw: string, mode: 'all' | 'card' | 'main' = 'all'): string => {
    // Canvas-board images carry `cursor:pointer` from compose (where clicking
    // reopens them for editing) — strip it here since the read-only message
    // view has no such handler, to avoid a misleading clickable-looking cursor.
    // Done on the raw string (not per-line below) since these images are often
    // adjacent to empty placeholder divs with no newline between them.
    raw = raw.replace(/<img\b[^>]*data-canvas-(?:saved|draft)="1"[^>]*>/gi, tag => tag.replace(/cursor:\s*pointer;?/gi, ''))
    const parts = raw.split('--- Original Message ---')
    let mainContent = raw
    let quotedContent = ''
    
    if (parts.length > 1) {
      mainContent = parts[0].replace(/\n+$/, '')
      quotedContent = parts.slice(1).join('\n<hr style="border:none;border-top:1px dashed rgba(0,0,0,0.2);margin:16px 0"/>\n').replace(/^\n+/, '')
    }

    const renderLines = (text: string): string => {
      // Pre-process triple-backtick code blocks
      const codeBlockified = text.replace(/```([\s\S]*?)```/g, (_, code) =>
        `<pre style="background:#f4f4f4;border:1px solid #ddd;border-radius:4px;padding:6px 10px;font-family:monospace;font-size:0.85em;overflow-x:auto;margin:2px 0;white-space:pre-wrap">${code.trim().replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`
      )
      const lines = codeBlockified.split('\n')
      const out: string[] = []
      for (const line of lines) {
        if (line.startsWith('<pre ')) { out.push(line); continue }
        let rendered = ''
        const alignMatch = line.match(/^<div align="(left|center|right|justify)">(.*)<\/div>$/)
        const dirMatch = line.match(/^<div dir="(ltr|rtl)">(.*)<\/div>$/)
        if (alignMatch) {
          rendered = `<div style="text-align:${alignMatch[1]}">${applyInlineMarkdown(alignMatch[2])}</div>`
        } else if (dirMatch) {
          rendered = `<div dir="${dirMatch[1]}">${applyInlineMarkdown(dirMatch[2])}</div>`
        } else if (line.startsWith('### ')) {
          rendered = `<h3 style="margin:2px 0;font-size:1.1em;font-weight:700">${applyInlineMarkdown(line.slice(4))}</h3>`
        } else if (line.startsWith('## ')) {
          rendered = `<h2 style="margin:2px 0;font-size:1.3em;font-weight:700">${applyInlineMarkdown(line.slice(3))}</h2>`
        } else if (line.startsWith('# ')) {
          rendered = `<h1 style="margin:2px 0;font-size:1.5em;font-weight:700">${applyInlineMarkdown(line.slice(2))}</h1>`
        } else if (line.startsWith('> ')) {
          rendered = `<div style="border-left:3px solid #aaa;padding-left:8px;color:#666;margin:1px 0;font-style:italic">${applyInlineMarkdown(line.slice(2))}</div>`
        } else if (line.startsWith('• ')) {
          rendered = `<div style="padding-left:4px">• ${applyInlineMarkdown(line.slice(2))}</div>`
        } else if (/^\* /.test(line)) {
          rendered = `<div style="padding-left:4px">* ${applyInlineMarkdown(line.slice(2))}</div>`
        } else if (/^\d+\. /.test(line)) {
          const m = line.match(/^(\d+\. )(.*)/)!
          rendered = `<div style="padding-left:4px">${m[1]}${applyInlineMarkdown(m[2])}</div>`
        } else if (/^[A-Z]\. /.test(line)) {
          const m = line.match(/^([A-Z]\. )(.*)/)!
          rendered = `<div style="padding-left:4px">${m[1]}${applyInlineMarkdown(m[2])}</div>`
        } else if (/^[a-z]\. /.test(line)) {
          const m = line.match(/^([a-z]\. )(.*)/)!
          rendered = `<div style="padding-left:4px">${m[1]}${applyInlineMarkdown(m[2])}</div>`
        } else if (/^[IVXLCDM]+\. /.test(line)) {
          const m = line.match(/^([IVXLCDM]+\. )(.*)/)!
          rendered = `<div style="padding-left:4px">${m[1]}${applyInlineMarkdown(m[2])}</div>`
        } else if (line.startsWith('    ')) {
          rendered = `<div style="padding-left:24px">${applyInlineMarkdown(line.slice(4))}</div>`
        } else if (line === '---' || line === '--') {
          rendered = '<hr style="border:none;border-top:1px solid #ddd;margin:3px 0"/>'
        } else if (line === '') {
          rendered = '<div style="height:3px"></div>'
        } else if (line.startsWith('|') && line.endsWith('|')) {
          if (/^\|[\s|-]+\|$/.test(line)) {
            rendered = ''
          } else {
            const cells = line.split('|').slice(1, -1)
            rendered = `<div style="display:inline-flex">${cells.map(c => `<span style="border:1px solid #ccc;padding:2px 6px;font-size:0.9em">${applyInlineMarkdown(c.trim())}</span>`).join('')}</div>`
          }
        } else if (line.includes('data-file-card=')) {
          // File card span — strip remove button and contenteditable for read-only view
          rendered = line
            .replace(/\s+contenteditable="false"/g, '')
            .replace(/<span\b[^>]*\bdata-remove-file\b[^>]*>[^<]*<\/span>/g, '')
        } else if (/^<img\s/i.test(line)) {
          rendered = line
        } else if (/^📎 /.test(line)) {
          rendered = `<div style="display:inline-flex;align-items:center;gap:4px;background:#f0f4ff;border:1px solid #c5d8fc;border-radius:4px;padding:2px 8px;font-size:0.85em">${line}</div>`
        } else if (line.startsWith('From: ') || line.startsWith('Date: ') || line.startsWith('Subject: ')) {
          rendered = `<div style="font-size:0.85em; opacity:0.85; margin-bottom:2px;"><strong>${line.substring(0, line.indexOf(': ') + 1)}</strong> ${applyInlineMarkdown(line.substring(line.indexOf(': ') + 2))}</div>`
        } else if (line.startsWith('SourceId: ')) {
          rendered = ''
        } else {
          rendered = `<div style="min-height:1.2em">${applyInlineMarkdown(line) || '&nbsp;'}</div>`
        }
        if (rendered !== '') out.push(rendered)
      }
      return out.join('')
    }

    let htmlCard = ''
    
    if (quotedContent) {
      const bgColor = '#e0f2f1'
      const borderColor = '#4db6ac'
      const shadowColor = 'rgba(77, 182, 172, 0.55)'

      const lines = quotedContent.split('\n')
      const headerLines: string[] = []
      const bodyLines: string[] = []
      let inHeader = true
      
      for (const line of lines) {
        if (inHeader) {
          if (line.startsWith('From: ') || line.startsWith('Date: ') || line.startsWith('Subject: ') || line.startsWith('SourceId: ')) {
            headerLines.push(line)
          } else if (line.trim() === '') {
            inHeader = false
          } else {
            inHeader = false
            bodyLines.push(line)
          }
        } else {
          bodyLines.push(line)
        }
      }
      
      const quotedHeaders = headerLines.join('\n')
      const quotedBody = bodyLines.join('\n')

      htmlCard += `<div style="margin-bottom: 10px; padding: 8px 12px; border-radius: 8px; background-color: #ffffff; border: 2px solid ${borderColor}; box-shadow: 0 0 12px ${shadowColor}; font-size: 0.85em; opacity: 0.9;">`
      if (quotedHeaders) {
        htmlCard += renderLines(quotedHeaders)
      }
      if (quotedBody) {
        htmlCard += `<div style="margin-top: ${quotedHeaders ? '8px' : '0'};">`
        htmlCard += `<div style="max-height: 250px; overflow-y: auto; padding-right: 4px;">`
        htmlCard += renderLines(quotedBody)
        htmlCard += `</div></div>`
      }
      htmlCard += `</div>`
    }

    let htmlMain = mainContent;
    // Skip running Markdown parser if HTML input is detected (allows mixing legacy markdown messages with new rich-text emails)
    if (!/<(div|b|strong|i|em|u|s|strike|span|h[1-6]|ul|ol|li|br|p|table|img|blockquote)[>\s]/i.test(mainContent)) {
      htmlMain = renderLines(mainContent);
    }

    if (mode === 'card') return htmlCard
    if (mode === 'main') return htmlMain
    return htmlCard + htmlMain
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchEmails()
  }, [token])

  // Fetch the groups this user owns or belongs to once, so group-tagged emails can be
  // routed into a dedicated conversation entry (see groupEmailsByContact) instead of
  // folding into whichever member's individual 1-on-1 thread.
  useEffect(() => {
    Promise.all([
      fetch('http://localhost:5050/api/groups', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ groups: [] })),
      fetch('http://localhost:5050/api/groups/member-of', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ groups: [] })),
    ]).then(([owned, memberOf]) => {
      const map = new Map<number, { email: string; name: string }>()
      for (const g of [...(owned.groups || []), ...(memberOf.groups || [])]) {
        map.set(g.id, { email: g.groupEmail, name: g.name })
      }
      setGroupsById(map)
    }).catch(() => {})
  }, [token])

  // The groups fetch above runs in parallel with fetchEmails and may resolve after it —
  // once group data lands, re-group any already-fetched emails so group-tagged messages
  // that were processed before groupsById was ready get correctly routed into their
  // dedicated conversation instead of staying folded into a member's individual thread.
  useEffect(() => {
    if (groupsById.size === 0 || allEmailsRef.current.length === 0) return
    setConversations(groupEmailsByContact(allEmailsRef.current))
  }, [groupsById])

  // Restore in-progress sends that survived a page refresh
  useEffect(() => {
    if (!token) return
    const pending = loadPendingSends()
    if (pending.length === 0) return
    pending.forEach(({ messageId, message, payload }) => {
      setMessages(prev => prev.some(m => m.id === messageId) ? prev : [...prev, { ...message, isPending: true, isRestoredPending: true }])
      const attemptSend = async () => {
        if (!navigator.onLine) {
          const onOnline = () => { window.removeEventListener('online', onOnline); attemptSend() }
          window.addEventListener('online', onOnline)
          return
        }
        try {
          const res = await fetch('http://localhost:5050/api/send', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (res.ok) {
            removePendingSend(messageId)
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPending: false } : m))
            fetchEmails(true)
            window.dispatchEvent(new Event('mailRefresh'))
          } else setTimeout(attemptSend, 3000)
        } catch { setTimeout(attemptSend, 3000) }
      }
      attemptSend()
    })
  }, [token])

  useEffect(() => {
    if (!token) return
    fetch('http://localhost:5050/api/custom-labels', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.labels) setCustomLabels(data.labels) })
      .catch(() => {})
  }, [token])

  // Lets the Group/Ungroup toolbar buttons know whether a contact is already in any
  // group, without an N+1 fetch per selected conversation.
  useEffect(() => {
    if (!token) return
    fetch('http://localhost:5050/api/group-members/all', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.emails) setGroupedEmails(new Set(data.emails.map((e: string) => e.toLowerCase()))) })
      .catch(() => {})
  }, [token])

  const flattenLabelsTree = (nodes: any[], prefix = '', depth = 0, parentId: number | null = null): any[] =>
    nodes.flatMap(label => {
      const fullPath = prefix ? `${prefix} / ${label.name}` : label.name
      return [
        { id: label.id, leafName: label.name, fullPath, color: label.color, hasChildren: !!(label.children?.length), depth, parentId },
        ...(label.children ? flattenLabelsTree(label.children, fullPath, depth + 1, label.id) : [])
      ]
    })

  const isMoveItemVisible = (item: any, allItems: any[]): boolean => {
    if (item.parentId === null) return true
    if (!expandedMoveLabels.has(item.parentId)) return false
    const parent = allItems.find((l: any) => l.id === item.parentId)
    return parent ? isMoveItemVisible(parent, allItems) : true
  }

  const isCreateSubVisible = (item: { parentId: number | null }, all: Array<{ id: number; parentId: number | null }>): boolean => {
    if (item.parentId === null) return true
    if (!expandedCreateSubLabels.has(item.parentId)) return false
    const parent = all.find(l => l.id === item.parentId)
    return parent ? isCreateSubVisible(parent, all) : true
  }

  const handleMoveClick = (emailId: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!emailId) return
    if (moveToMenuOpen === emailId) {
      setMoveToMenuOpen(null)
      setMoveMenuPosition(null)
      return
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    if (spaceBelow >= spaceAbove) {
      setMoveMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right, maxHeight: Math.max(spaceBelow, 300) })
    } else {
      setMoveMenuPosition({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right, maxHeight: Math.max(spaceAbove, 300) })
    }
    setLabelSearchQuery('')
    const collectParentIds = (nodes: any[]): number[] =>
      nodes.flatMap((n: any) => n.children?.length ? [n.id, ...collectParentIds(n.children)] : [])
    setExpandedMoveLabels(new Set(collectParentIds(customLabels)))
    setMoveToMenuOpen(emailId)
  }

  useEffect(() => {
    const handler = () => fetchEmails(true)
    window.addEventListener('mailRefresh', handler)
    return () => window.removeEventListener('mailRefresh', handler)
  }, [])

  // Reset initialMountRef on unmount so StrictMode's second invocation also skips clearing
  useEffect(() => {
    return () => { initialMountRef.current = true }
  }, [])

  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false
      return
    }
    if (isPopout) {
      // Popout already has its data restored from localStorage on mount —
      // just switch to the chat/compose view, don't clear the restored content.
      if (composeMode) {
        setViewMode('chat')
        setActiveField('to')
      }
      return
    }
    if (composeMode) {
      flushDraftSaveRef.current()
      isClearingRef.current = true
      hasInteractedRef.current = false
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current)
        draftSaveTimerRef.current = null
      }
      setInputValue('')
      setSubjectValue('')
      setToEmails([])
      setInitialToEmails([])
      setToInput('')
      setCcEmails([])
      setBccEmails([])
      setCcInput('')
      setBccInput('')
      setShowCc(false)
      setShowBcc(false)
      setMessageSent(false)
      setSendDropdownOpen(false)
      setShowSchedulePopup(false)
      setScheduleDate('')
      setDraftId(null)
      setAttachedFiles([])
      try { sessionStorage.setItem('chat_attachments', '[]') } catch (_) {}
      setSelectedConversation(null)
      setMessages([])
      setInputPanelHeight(248)
      setViewMode('chat')
      setActiveField('to')
      setReplyEmailCard(null)
      setTimeout(() => { isClearingRef.current = false }, 250)
    } else {
      flushDraftSaveRef.current()
    }
  }, [composeMode])

  useEffect(() => {
    const handleOpenCompose = () => {
      flushDraftSaveRef.current()
      isClearingRef.current = true
      hasInteractedRef.current = false
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current)
        draftSaveTimerRef.current = null
      }
      setInputValue('')
      setSubjectValue('')
      setToEmails([])
      setInitialToEmails([])
      setToInput('')
      setCcEmails([])
      setBccEmails([])
      setCcInput('')
      setBccInput('')
      setShowCc(false)
      setShowBcc(false)
      setMessageSent(false)
      setSendDropdownOpen(false)
      setShowSchedulePopup(false)
      setScheduleDate('')
      setDraftId(null)
      setSelectedConversation(null)
      setComposeGroupLabel(null)
      setComposeGroupMembers([])
      setComposeGroupId(null)
      setMessages([])
      setInputPanelHeight(248)
      setViewMode('chat')
      setActiveField('to')
      setTimeout(() => { isClearingRef.current = false }, 250)
    }
    window.addEventListener('openChatMailCompose', handleOpenCompose)
    return () => window.removeEventListener('openChatMailCompose', handleOpenCompose)
  }, [])

  // Pre-fill fields when opening a draft
  useEffect(() => {
    if (!draftEmail) return
    // This draft (opened via the Drafts folder / Inbox, not the Chat Mail list) may
    // already be floating in THIS instance, or — if it was started from inside a
    // contact's thread (e.g. a per-message Forward) — in a different, still-mounted
    // contact instance. Delegate to that instance instead of loading it here, and
    // auto-expand instead of just loading inline when it's already ours.
    // This effect only ever runs on the main (no-contactEmail) instance, so any owner
    // other than null (main) means a different, still-mounted contact instance owns it.
    const floatOwner = draftEmail.id != null ? getFloatingDraftOwner?.(draftEmail.id) : undefined
    if (floatOwner != null && onOpenContact) {
      onDraftLoaded?.()
      onOpenContact(floatOwner)
      return
    }
    const wasFloatingThisDraft = composeFloating && composeFloatMinimized && draftEmail.id != null && floatingDraftIdRef.current === draftEmail.id
    isClearingRef.current = true
    hasInteractedRef.current = false
    setViewMode('chat')

    const me = userEmail.toLowerCase()
    const rawContact = draftEmail.to
    const contactEmail = rawContact?.split(',')[0].trim().toLowerCase()
    const isValidContact = contactEmail && contactEmail.includes('@') && contactEmail !== me

    const loadedTo = draftEmail.to ? draftEmail.to.split(',').map(e => e.trim()).filter(Boolean) : []
    setToEmails(loadedTo)
    setInitialToEmails(loadedTo)
    const _dSubject = draftEmail.subject === '(No subject)' ? '' : draftEmail.subject || ''
    const _dRawBody = draftEmail.body === '(No content)' || draftEmail.body === '(no content)' ? '' : draftEmail.body || ''

    if (canvasMode) closeCanvasMode(true)

    const { userText: _dUserText, card: _dCard } = parseReplyDraft(_dRawBody, _dSubject)
    setSubjectValue(_dSubject)
    setInputValue(_dUserText)
    setReplyEmailCard(_dCard)
    if (_dCard) hasInteractedRef.current = true
    if (draftEmail.cc) {
      setCcEmails(draftEmail.cc.split(',').map(e => e.trim()).filter(Boolean))
      setShowCc(true)
    } else {
      setCcEmails([])
      setShowCc(false)
    }
    if (draftEmail.bcc) {
      setBccEmails(draftEmail.bcc.split(',').map(e => e.trim()).filter(Boolean))
      setShowBcc(true)
    } else {
      setBccEmails([])
      setShowBcc(false)
    }
    setCcInput('')
    setBccInput('')
    setToInput('')
    setMessageSent(false)
    setDraftId(draftEmail.id ?? null)
    if (draftEmail.id != null) setLastOpenedConversationId(`draft_${draftEmail.id}`)

    // Restore attachments: localStorage (persists across sessions) → sessionStorage fallback
    let restoredAtts: Array<{ name: string; size: number; dataUrl?: string }> = []
    if (draftEmail.id != null) {
      try {
        const lsAtts = localStorage.getItem(`draft_${draftEmail.id}_attachments`)
        if (lsAtts) restoredAtts = JSON.parse(lsAtts)
      } catch {}
    }
    if (restoredAtts.length === 0) {
      try {
        const savedDraftId = sessionStorage.getItem('chat_draftId')
        const savedAtts = sessionStorage.getItem('chat_attachments')
        if (savedDraftId && draftEmail.id != null && parseInt(savedDraftId, 10) === draftEmail.id && savedAtts) {
          restoredAtts = JSON.parse(savedAtts)
        }
      } catch {}
    }
    setAttachedFiles(restoredAtts)

    if (isValidContact) {
      setSelectedConversation(contactEmail)
    } else {
      setSelectedConversation(null)
    }

    onDraftLoaded?.()
    if (wasFloatingThisDraft) {
      setComposeFloatMinimized(false)
      const w = floatSize?.width ?? 760
      const h = floatSize?.height ?? 720
      // Safe top-right corner — clamping the minimized strip's left-anchored position
      // instead would cover this view's back arrow/header.
      setFloatPos(computeSafeExpandPos(w))
    }
    setTimeout(() => { isClearingRef.current = false }, 250)
  }, [draftEmail, userEmail])

  // Reset card collapsed state whenever a new card is opened
  useEffect(() => {
    if (replyEmailCard) setReplyCardCollapsed(false)
  }, [replyEmailCard?.sourceMessageId, replyEmailCard?.action])

  // Pre-fill compose input when opening from reply/forward action
  useEffect(() => {
    if (initialReplyMessage) {
      setInputValue(initialReplyMessage)
    }
  }, [initialReplyMessage])

  // Pre-fill compose area when forwarding an email
  useEffect(() => {
    if (!replyData || replyData.action !== 'forward') return
    const cleanSubject = replyData.subject.replace(/^(Fwd:\s*|Fw:\s*)+/i, '')
    
    setSelectedConversation(null)
    setToEmails([])
    setInitialToEmails([])
    setToInput('')
    setComposeGroupLabel(null)
    setComposeGroupMembers([])
    setComposeGroupId(null)
    setCcEmails([])
    setBccEmails([])
    setCcInput('')
    setBccInput('')
    setShowCc(false)
    setShowBcc(false)
    setSubjectValue(`Fwd: ${cleanSubject}`)
    
    const dateStr = replyData.date ? new Date(replyData.date).toLocaleString() : ''
    const fwdContent = `\n\n---------- Forwarded message ---------\nFrom: ${replyData.from}\nDate: ${dateStr}\nSubject: ${replyData.subject}\nTo: ${replyData.to}\n\n${replyData.body}`
    setInputValue(fwdContent)
    
    setReplyEmailCard(replyData)
    setScrollToBottom('smooth')
    setTimeout(() => {
      const toEl = document.querySelector('input[placeholder="Recipients..."]') as HTMLInputElement;
      if (toEl) toEl.focus();
    }, 100)
    onReplyDataLoaded?.()
  }, [replyData])

  // Pre-fill multi-recipient compose (e.g. "Compose to group") — a prop change re-applies
  // this even when the instance is already mounted, unlike the openChatMailCompose event.
  useEffect(() => {
    if (!composeRecipients) return
    setSelectedConversation(null)
    setInputValue('')
    setToEmails(composeRecipients.to)
    setInitialToEmails(composeRecipients.to)
    setToInput('')
    setSubjectValue(composeRecipients.subject)
    setCcEmails([])
    setBccEmails([])
    setCcInput('')
    setBccInput('')
    setShowCc(false)
    setShowBcc(false)
    setReplyEmailCard(null)
    setViewMode('chat')
    setActiveField('to')
    setScrollToBottom('smooth')
    setComposeGroupLabel(composeRecipients.groupLabel || null)
    setComposeGroupMembers(composeRecipients.groupLabel ? composeRecipients.to : [])
    setComposeGroupId(composeRecipients.groupId ?? null)
    onComposeRecipientsLoaded?.()
  }, [composeRecipients])

  // Auto-save draft: debounced 2s after any compose field change.
  // Skip when canvas mode is active — commitActiveCanvasToImage() inside the flush
  // would close the canvas board. Navigation-flush handles that case correctly.
  useEffect(() => {
    if (!hasInteractedRef.current || isClearingRef.current || canvasMode) return
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current)
    draftSaveTimerRef.current = setTimeout(() => {
      if (hasInteractedRef.current && !isClearingRef.current && !canvasMode) {
        autoSaveMode.current = true
        flushDraftSaveRef.current()
      }
    }, 2000)
    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current)
        draftSaveTimerRef.current = null
      }
    }
  }, [inputValue, subjectValue, toEmails, ccEmails, bccEmails, attachedFiles, replyEmailCard, canvasMode])

  // Background auto-save interval for Canvas mode
  useEffect(() => {
    if (!canvasMode) return
    const intervalId = setInterval(() => {
      if (hasInteractedRef.current && !isClearingRef.current) {
        autoSaveMode.current = true
        flushDraftSaveRef.current()
      }
    }, 5000)
    return () => clearInterval(intervalId)
  }, [canvasMode])

  useEffect(() => {
    const contact = conversationsRef.current.find(c => c.id === selectedConversation)
    messagesRef.current.forEach(msg => {
      if (!msg.isScheduled || !msg.scheduledFor || !msg.id) return
      if (new Date(msg.scheduledFor).getTime() > now) return
      if (notifiedScheduledRef.current.has(msg.id)) return
      notifiedScheduledRef.current.add(msg.id)
      const notif = { id: msg.id, subject: msg.subject, to: contact?.email ?? '' }
      setScheduleNotifications(prev => [...prev, notif])
      setTimeout(() => setScheduleNotifications(prev => prev.filter(n => n.id !== msg.id)), 5000)
      fetchEmails()
    })
  }, [now])

  useEffect(() => {
    if (selectedConversation && conversationsRef.current.length > 0) {
      const isNewConversation = prevSelectedConversationRef.current !== selectedConversation
      loadConversationMessages(selectedConversation, isNewConversation)
      prevSelectedConversationRef.current = selectedConversation
      setViewMode('chat')
    } else if (!selectedConversation) {
      prevSelectedConversationRef.current = null
    }
  }, [selectedConversation, reloadKey])

  // Auto-select conversation when contactEmail is provided
  useEffect(() => {
    if (contactEmail && conversations.length > 0) {
      const targetEmail = contactEmail.split(',')[0]?.trim()?.toLowerCase()
      const conversation = conversations.find(c => c.email === targetEmail)
      if (conversation && selectedConversation !== conversation.id) {
        flushDraftSaveRef.current()
        isClearingRef.current = true
        setSelectedConversation(conversation.id)
        if (conversation.draftEmail) {
          const d = conversation.draftEmail
          setToEmails(d.to ? d.to.split(',').map(e => e.trim()).filter(Boolean) : [conversation.email])
          const _cSubject = d.subject || ''
          const _cRawBody = d.body || ''
          const { userText: _cUserText, card: _cCard } = parseReplyDraft(_cRawBody, _cSubject)
          setSubjectValue(_cSubject)
          setInputValue(_cUserText)
          setReplyEmailCard(_cCard)
          if (_cCard) hasInteractedRef.current = true
          if (d.cc) { setCcEmails(d.cc.split(',').map(e => e.trim()).filter(Boolean)); setShowCc(true) } else { setCcEmails([]); setShowCc(false) }
          if (d.bcc) { setBccEmails(d.bcc.split(',').map(e => e.trim()).filter(Boolean)); setShowBcc(true) } else { setBccEmails([]); setShowBcc(false) }
          setCcInput('')
          setBccInput('')
          setToInput('')
          setMessageSent(false)
          setDraftId(d.id ?? null)
        } else {
          setToEmails([conversation.email])
          setToInput('')
          setSubjectValue('')
          setInputValue('')
          setCcEmails([])
          setBccEmails([])
          setCcInput('')
          setBccInput('')
          setShowCc(false)
          setShowBcc(false)
          setMessageSent(false)
          setDraftId(null)
        }
        setTimeout(() => { isClearingRef.current = false }, 250)
      }
    }
  }, [contactEmail, conversations])

  // Pre-fill compose area when opening from reply/replyAll action in chat view
  useEffect(() => {
    if (!replyData || replyData.action === 'forward') return
    if (!contactEmail || conversations.length === 0) return
    const targetEmail = contactEmail.split(',')[0].trim().toLowerCase()
    const conversation = conversations.find(c => c.email === targetEmail)
    if (!conversation) return
    setSubjectValue('')
    setInputValue('')
    setReplyEmailCard(replyData)
    setScrollToBottom('smooth')
    onReplyDataLoaded?.()
  }, [replyData, contactEmail, conversations])

  // --- Read-on-scroll logic (defined before effects that reference it) ---

  // emailIds already queued for mark-as-read (prevents duplicates)
  const pendingReadRef = useRef<Set<number>>(new Set())
  // emailIds whose bottom edge has been seen (required before top-entry marks as read)
  const seenBottomRef = useRef<Set<number>>(new Set())
  // AbortControllers for in-flight read-status requests, keyed by emailId
  const readRequestControllers = useRef<Map<number, AbortController>>(new Map())

  // Reset when switching conversations
  useEffect(() => {
    pendingReadRef.current = new Set()
    seenTopRef.current = new Set()
    seenBottomRef.current = new Set()
    readRequestControllers.current.forEach(c => c.abort())
    readRequestControllers.current = new Map()
    highlightScrolledRef.current = null
    setViewedDeletedIds(new Set())
  }, [selectedConversation])

  // Close Schedule and Snooze dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.send-dropdown-btn') && !target.closest('.send-dropdown-menu')) {
        setSendDropdownOpen(false)
      }
      if (!target.closest('.snooze-btn-wrapper') && !target.closest('.snooze-dropdown-menu')) {
        setSnoozeMenuOpen(null)
        setMoveToMenuOpen(null)
      }
      if (!target.closest('[data-toolbar-menu]') && !target.closest('[data-toolbar-menu-toggle]')) {
        closeAllToolbarMenus()
      }
      if (!target.closest('.checkbox-dropdown')) {
        setListHeaderCheckboxDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Apply read status changes that originated outside this component (e.g. AllMailsPage)
  useEffect(() => {
    if (!externalReadUpdate) return
    const { emailId, isRead } = externalReadUpdate
    // Skip if already in sync (avoids re-processing our own changes echoed back via App.tsx)
    const current = allEmailsRef.current.find(e => e.id === emailId)
    if (current && current.isRead === isRead) return
    setMessages(prev => prev.map(msg => msg.emailId === emailId ? { ...msg, isRead } : msg))
    setAllEmails(prev => prev.map(e => e.id === emailId ? { ...e, isRead } : e))
    setConversations(prev => {
      const email = allEmailsRef.current.find(e => e.id === emailId)
      if (!email) return prev
      const me = userEmail.toLowerCase()
      const isOutgoing = email.from?.toLowerCase() === me || email.folder === 'sent'
        const otherEmail = (isOutgoing ? email.to : email.from)?.split(',')[0]?.trim()?.toLowerCase()
      return prev.map(conv => {
        if (conv.groupId ? conv.groupId !== email.groupId : conv.email !== otherEmail) return conv
        const delta = isRead ? -1 : 1
        const newCount = Math.max(0, (conv.unreadCount ?? 0) + delta)
        const isLastEmail = conv.lastEmail?.id === emailId
        return { ...conv, unreadCount: newCount > 0 ? newCount : undefined, ...(isLastEmail ? { isRead } : {}) }
      })
    })
  }, [externalReadUpdate])

  // Apply delete status changes that originated outside this component (e.g. AllMailsPage)
  useEffect(() => {
    if (!externalDeleteUpdate) return
    const { emailId, isDeleted } = externalDeleteUpdate
    const current = allEmailsRef.current.find(e => e.id === emailId)
    if (current && current.isDeleted === isDeleted) return
    setMessages(prev => prev.map(msg => msg.emailId === emailId ? { ...msg, isDeleted } : msg))
    setAllEmails(prev => prev.map(e => e.id === emailId ? { ...e, isDeleted } : e))
  }, [externalDeleteUpdate])

  // Mark a message read only after BOTH its top and bottom edges have entered the viewport.
  // This handles every case without direction tracking:
  //   • Message opens at top   → top seen first → user scrolls down → bottom seen → read ✓
  //   • Message opens at bottom → bottom seen first → user scrolls up → top seen → read ✓
  //   • Short message (fully visible) → both seen at once → read immediately ✓
  //   • Older message above → bottom enters first as user scrolls up, then top → read ✓
  const checkVisibleAndMarkRead = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const cRect = container.getBoundingClientRect()
    messagesRef.current.forEach(msg => {
      if (!msg.incoming || !msg.emailId || msg.isRead) return
      if (pendingReadRef.current.has(msg.emailId)) return
      const bubble = container.querySelector(
        `[data-bubble-email-id="${msg.emailId}"]`,
      ) as HTMLElement | null
      if (!bubble) return
      const bRect = bubble.getBoundingClientRect()
      const bottomVisible = bRect.bottom >= cRect.top && bRect.bottom <= cRect.bottom
      const topVisible = bRect.top >= cRect.top && bRect.top <= cRect.bottom
      if (bottomVisible) seenBottomRef.current.add(msg.emailId)
      if (topVisible) seenTopRef.current.add(msg.emailId)
      if (seenTopRef.current.has(msg.emailId) && seenBottomRef.current.has(msg.emailId)) {
        pendingReadRef.current.add(msg.emailId)
        updateReadStatusRef.current(msg.emailId, true)
      }
    })
  }, [])

  // Attach scroll listener once on entering chat view; remove on leaving
  useEffect(() => {
    if (viewMode !== 'chat') return
    const container = messagesContainerRef.current
    if (!container) return
    container.addEventListener('scroll', checkVisibleAndMarkRead, { passive: true })
    return () => container.removeEventListener('scroll', checkVisibleAndMarkRead)
  }, [viewMode, checkVisibleAndMarkRead])

  // --- End read-on-scroll logic ---

  // Auto-scroll — on open: top of last message; on send: smooth to end
  useEffect(() => {
    if (scrollToBottom) {
      if (scrollToBottom === 'instant') {
        lastMessageRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' })
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: scrollToBottom })
      }
      setScrollToBottom(false)
      requestAnimationFrame(() => requestAnimationFrame(checkVisibleAndMarkRead))
    }
  }, [messages, scrollToBottom, checkVisibleAndMarkRead])

  // Jump to highlighted message once on first load — skip on every subsequent messages update
  // (e.g. when isRead changes) to prevent the view jumping back during the color transition
  useEffect(() => {
    if (!highlightedEmailId || messages.length === 0) return
    if (highlightScrolledRef.current === highlightedEmailId) return
    requestAnimationFrame(() => {
      const el = document.getElementById(`message-${highlightedEmailId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'start' })
        highlightScrolledRef.current = highlightedEmailId
        requestAnimationFrame(checkVisibleAndMarkRead)
      } else {
        setScrollToBottom('instant')
      }
    })
  }, [highlightedEmailId, messages, checkVisibleAndMarkRead])

  const fetchEmails = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const folders = [
        'inbox',
        'sent',
        'starred',
        'snoozed',
        'drafts',
        'archived',
        'allmails',
        'scheduled',
        'important',
        'spam',
        'delete',
        'subscriptions',
        'reports',
        'purchased',
      ]

      const emailResults = await Promise.all(
        folders.map(folder =>
          fetch(`http://localhost:5050/api/${folder}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then(res => res.json())
            .catch(() => ({ emails: [] }))
        )
      )

      const allEmails = emailResults.flatMap(result => result.emails || [])
      const emailMap = new Map<number, Email>()
      for (const email of allEmails) {
        if (emailMap.has(email.id!)) {
          const existing = emailMap.get(email.id!)!
          emailMap.set(email.id!, {
            ...existing,
            ...email,
            body: email.body || existing.body,
            isArchived: existing.isArchived ?? email.isArchived,
            isStarred: existing.isStarred ?? email.isStarred,
            isSnoozed: existing.isSnoozed ?? email.isSnoozed,
            isImportant: existing.isImportant ?? email.isImportant,
            isSpam: existing.isSpam ?? email.isSpam,
            isReport: existing.isReport ?? email.isReport,
            isPinned: existing.isPinned ?? email.isPinned,
            isMuted: existing.isMuted ?? email.isMuted,
            isDeleted: existing.isDeleted ?? email.isDeleted,
            isRead: existing.isRead ?? email.isRead,
            isScheduled: existing.isScheduled ?? email.isScheduled,
            isDraft: existing.isDraft ?? email.isDraft,
            hasAttachments: existing.hasAttachments ?? email.hasAttachments,
            folder: existing.folder ?? email.folder,
            cc: existing.cc ?? email.cc,
            bcc: existing.bcc ?? email.bcc,
            snoozedUntil: existing.snoozedUntil ?? email.snoozedUntil,
            scheduledFor: existing.scheduledFor ?? email.scheduledFor,
          })
        } else {
          emailMap.set(email.id!, email)
        }
      }
      const uniqueEmails = Array.from(emailMap.values())

      setAllEmails(uniqueEmails)
      const emailConversations = groupEmailsByContact(uniqueEmails)
      setConversations(emailConversations)
      setReloadKey(k => k + 1)   // signal that real emails changed → reload open conversation
    } catch (err) {
      console.error('Failed to load emails:', err)
      if (!silent) setConversations([])
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const groupEmailsByContact = (emails: Email[]): Conversation[] => {
    const contactMap = new Map<string, { emails: Email[]; name: string; groupId?: number }>()
    const me = userEmail.toLowerCase()
    const standaloneDs: Email[] = []

    emails.forEach((email) => {
      // A deleted draft (moved to Trash) must never represent "the active draft" for a
      // standalone item or a contact's conversation — otherwise it keeps showing in the
      // Chat Mail list indefinitely even after being removed from the Drafts folder.
      if (email.isDraft && email.isDeleted) return

      // Group-compose sends are tagged with group_id — route them into their own
      // dedicated conversation instead of picking "the first recipient" as the contact,
      // which would otherwise fold the message into that one member's individual thread.
      if (email.groupId && groupsByIdRef.current.has(email.groupId)) {
        const group = groupsByIdRef.current.get(email.groupId)!
        const key = group.email
        if (!contactMap.has(key)) {
          contactMap.set(key, { emails: [], name: group.name, groupId: email.groupId })
        }
        contactMap.get(key)?.emails.push(email)
        return
      }

      const isOutgoing = email.from?.toLowerCase() === me || email.folder === 'sent' || email.isDraft
      const rawContact = isOutgoing ? email.to : email.from
      const contactEmail = rawContact?.split(',')[0]?.trim()?.toLowerCase()
      const contactName = rawContact?.split(',')[0]?.trim()

      if (email.isDraft && (!contactEmail || !contactEmail.includes('@'))) {
        standaloneDs.push(email)
        return
      }

      if (!contactEmail || !contactEmail.includes('@') || contactEmail === me) return

      if (!contactMap.has(contactEmail)) {
        contactMap.set(contactEmail, { emails: [], name: contactName })
      }
      contactMap.get(contactEmail)?.emails.push(email)
    })

    const contactConversations = Array.from(contactMap.entries())
      .map(([email, data], idx) => {
        const sortedEmails = [...data.emails].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        const lastNonDraft = sortedEmails.find(e => !e.isDraft)
        const lastEmail = lastNonDraft || sortedEmails[0]
        const draftEmail = sortedEmails.find(e => e.isDraft)

        const upcomingScheduledEmails = sortedEmails
          .filter(e => e.isScheduled && e.scheduledFor && new Date(e.scheduledFor).getTime() > Date.now())
          .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime());
        const nextScheduledEmail = upcomingScheduledEmails[0];
        const upcomingScheduledCount = upcomingScheduledEmails.length;
        const isOutgoing = lastEmail?.from?.toLowerCase() === me || lastEmail?.folder === 'sent'
        const unreadCount = data.emails.filter(e => !e.isRead && !(e.from?.toLowerCase() === me || e.folder === 'sent' || e.folder === 'drafts' || e.isScheduled || e.isDraft)).length

        return {
          id: email,
          name: data.name.split('@')[0] || data.name,
          email,
          groupId: data.groupId,
          initials: data.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2) || 'U',
          preview: (lastEmail?.body ?? '').substring(0, 50) || '',
          isRead: lastEmail?.isRead ?? true,
          isSent: isOutgoing,
          isScheduled: !!nextScheduledEmail,
          isDraft: !!draftEmail,
          draftEmail,
          lastEmail: lastEmail,
          nextScheduledEmail: nextScheduledEmail,
          unreadCount: unreadCount > 0 ? unreadCount : undefined,
          totalCount: data.emails.length,
          upcomingScheduledCount: upcomingScheduledCount > 0 ? upcomingScheduledCount : undefined,
        }
      })
      .sort((a, b) => {
        const dateA = Math.max(a.lastEmail?.date ? new Date(a.lastEmail.date).getTime() : 0, a.draftEmail?.date ? new Date(a.draftEmail.date).getTime() : 0)
        const dateB = Math.max(b.lastEmail?.date ? new Date(b.lastEmail.date).getTime() : 0, b.draftEmail?.date ? new Date(b.draftEmail.date).getTime() : 0)
        return dateB - dateA
      })

    const draftEntries: Conversation[] = standaloneDs.map((email, i) => {
      const draftContact = email.to?.split(',')[0].trim() || ''
      return {
      id: `draft_${email.id ?? i + 1}`,
      name: draftContact || 'Draft',
      email: draftContact || `draft_${email.id ?? i + 1}`,
      initials: 'Dr',
      preview: email.body?.substring(0, 50) || '(no content)',
      isRead: true,
      isSent: false,
      isScheduled: false,
      isDraft: true,
      draftEmail: email,
      lastEmail: email,
      totalCount: 1,
    }
    })

    return [...contactConversations, ...draftEntries].sort((a, b) => {
      const pinnedA = a.lastEmail?.isPinned ? 1 : 0
      const pinnedB = b.lastEmail?.isPinned ? 1 : 0
      if (pinnedA !== pinnedB) return pinnedB - pinnedA
      const dateA = Math.max(a.lastEmail?.date ? new Date(a.lastEmail.date).getTime() : 0, a.draftEmail?.date ? new Date(a.draftEmail.date).getTime() : 0)
      const dateB = Math.max(b.lastEmail?.date ? new Date(b.lastEmail.date).getTime() : 0, b.draftEmail?.date ? new Date(b.draftEmail.date).getTime() : 0)
      return dateB - dateA
    })
  }

  const loadConversationMessages = (conversationId: string, isNewConversation: boolean = true) => {
    const contact = conversationsRef.current.find((c) => c.id === conversationId)
    if (!contact) {
      setMessages(prev => prev.filter(m => m.isPending))
      return
    }

    const me = userEmail.toLowerCase()
    const contactEmails = allEmailsRef.current.filter((email) => {
      if (contact.groupId) return email.groupId === contact.groupId && !email.isDraft
      const isOutgoing = email.from?.toLowerCase() === me || email.folder === 'sent' || !!email.isDraft
      const rawOther = isOutgoing ? email.to : email.from
      const otherEmail = rawOther?.split(',')[0]?.trim()?.toLowerCase()
      return otherEmail === contact.email && !email.isDraft
    })

    const msgs: Message[] = contactEmails
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((email, idx) => ({
        id: idx + 1,
        subject: email.subject || '(No subject)',
        content: email.body || '',
        timestamp: new Date(email.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        date: email.date,
        incoming: !(email.from?.toLowerCase() === userEmail.toLowerCase() || email.folder === 'sent'),
        emailId: email.id,
        cc: email.cc || null,
        bcc: email.bcc || null,
        isRead: email.isRead,
        isStarred: email.isStarred,
        isImportant: email.isImportant,
        isSnoozed: email.isSnoozed,
        snoozedUntil: email.snoozedUntil,
        isSpam: email.isSpam,
        isReport: email.isReport,
        isPinned: email.isPinned,
        isDeleted: email.isDeleted,
        isArchived: email.isArchived,
        isScheduled: email.isScheduled,
        scheduledFor: email.scheduledFor,
      }))

    setMessages(prev => {
      const pendingMsgs = prev.filter(m => m.isPending)
      const msgsWithAttachments = msgs.map(msg => {
        const fromPrev = prev.find(m => !m.isPending && m.content === msg.content && m.attachments?.length)
        const fromStore = loadAttachmentStore(msg.content)
        const attachments = fromPrev?.attachments ?? fromStore ?? undefined
        return attachments ? { ...msg, attachments } : msg
      })
      return [...msgsWithAttachments, ...pendingMsgs]
    })
    if (!highlightedEmailId && isNewConversation) {
      setScrollToBottom('instant')
    }
  }

  const updateReadStatus = async (emailId: number, isRead: boolean) => {
    // Cancel any previous in-flight request for this email so the last intent always wins
    const prev = readRequestControllers.current.get(emailId)
    if (prev) prev.abort()
    const controller = new AbortController()
    readRequestControllers.current.set(emailId, controller)

    // 1. Optimistic: update the message bubble instantly
    setMessages(prev => prev.map(msg => msg.emailId === emailId ? { ...msg, isRead } : msg))

    // 2. Update allEmails data store
    setAllEmails(prev => prev.map(email => email.id === emailId ? { ...email, isRead } : email))

    // 3. Update the affected conversation's unread count and isRead (if this is the last email)
    setConversations(prev => {
      const email = allEmailsRef.current.find(e => e.id === emailId)
      if (!email) return prev
      const me = userEmail.toLowerCase()
      const isOutgoing = email.from?.toLowerCase() === me || email.folder === 'sent'
      const otherEmail = (isOutgoing ? email.to : email.from)
        ?.split(',')[0]?.trim()?.toLowerCase()
      return prev.map(conv => {
        if (conv.groupId ? conv.groupId !== email.groupId : conv.email !== otherEmail) return conv
        const delta = isRead ? -1 : 1
        const newCount = Math.max(0, (conv.unreadCount ?? 0) + delta)
        const isLastEmail = conv.lastEmail?.id === emailId
        return {
          ...conv,
          unreadCount: newCount > 0 ? newCount : undefined,
          ...(isLastEmail ? { isRead } : {}),
        }
      })
    })

    try {
      await fetch(`http://localhost:5050/api/emails/${emailId}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_read: isRead }),
        signal: controller.signal,
      })
      readRequestControllers.current.delete(emailId)
      onEmailReadChange?.(emailId, isRead)
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      console.error('Failed to update read status:', err)
      // Revert on failure
      setMessages(prev => prev.map(msg => msg.emailId === emailId ? { ...msg, isRead: !isRead } : msg))
      setAllEmails(prev => prev.map(email => email.id === emailId ? { ...email, isRead: !isRead } : email))
      setConversations(prev => {
        const email = allEmailsRef.current.find(e => e.id === emailId)
        if (!email) return prev
        const me = userEmail.toLowerCase()
        const isOutgoing = email.from?.toLowerCase() === me || email.folder === 'sent'
        const otherEmail = (isOutgoing ? email.to : email.from)
          ?.split(',')[0]?.trim()?.toLowerCase()
        return prev.map(conv => {
          if (conv.groupId ? conv.groupId !== email.groupId : conv.email !== otherEmail) return conv
          const delta = isRead ? 1 : -1
          const newCount = Math.max(0, (conv.unreadCount ?? 0) + delta)
          const isLastEmail = conv.lastEmail?.id === emailId
          return {
            ...conv,
            unreadCount: newCount > 0 ? newCount : undefined,
            ...(isLastEmail ? { isRead: !isRead } : {}),
          }
        })
      })
    }
  }
  updateReadStatusRef.current = updateReadStatus

  const isValidEmail = (email: string) =>
    email.includes('@') && email.split('@')[1]?.length >= 1 && !email.includes(' ')

  const addTag = (
    raw: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    setInput: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const email = raw.trim().replace(/,$/, '')
    if (!email) return
    if (!email.includes('@') || email.split('@')[1]?.length < 1) {
      setValidationError(`"${email}" is not a valid email address. Email must contain '@' followed by at least one character.`)
      return
    }
    if (email.includes(' ')) {
      setValidationError(`"${email}" is not a valid email address. Spaces are not allowed in email addresses.`)
      return
    }
    if (!list.includes(email)) setList([...list, email])
    setInput('')
  }

  const addTagSilent = (
    raw: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    setInput: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const email = raw.trim().replace(/,$/, '')
    if (!email || !isValidEmail(email) || list.includes(email)) return
    setList([...list, email])
      hasInteractedRef.current = true
      setMessageSent(false)
    setInput('')
  }

  const getSuggestions = (input: string, existingEmails: string[]) => {
    if (!input.trim()) return []
    const q = input.toLowerCase()
    return conversations
      .filter(c =>
        (c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) &&
        !existingEmails.includes(c.email)
      )
      .slice(0, 5)
  }

  const removeTag = (
    email: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
      setList(list.filter(e => e !== email))
      hasInteractedRef.current = true
      setMessageSent(false)
    }

  const handleTagKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    input: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    setInput: React.Dispatch<React.SetStateAction<string>>,
    lockedEmail?: string
  ) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab' || e.key === ' ') {
      e.preventDefault()
      addTag(input, list, setList, setInput)
    } else if (e.key === 'Backspace' && input === '' && list.length > 0) {
      const last = list[list.length - 1]
      if (lockedEmail && last === lockedEmail) return
      setList(list.slice(0, -1))
    }
  }

  const handleUndoSend = (msgId: number) => {
    const timeoutId = pendingTimeouts.current.get(msgId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      pendingTimeouts.current.delete(msgId)
      removePendingSend(msgId)
      const msg = messagesRef.current.find(m => m.id === msgId)
      if (msg) {
        setInputValue(msg.content)
        setSubjectValue(msg.subject === '(No subject)' ? '' : msg.subject)
        if (msg.cc) {
          setCcEmails(msg.cc.split(',').map(e => e.trim()).filter(Boolean))
          setShowCc(true)
        }
        if (msg.bcc) {
          setBccEmails(msg.bcc.split(',').map(e => e.trim()).filter(Boolean))
          setShowBcc(true)
        }
      }
      setMessageSent(false)
      setMessages(prev => prev.filter(m => m.id !== msgId))
    }
  }

  const bumpConvToTop = (convId: string | null, emails: string[], preview: string, isScheduled: boolean = false) => {
    const nowISO = new Date().toISOString()
    setConversations(prev => {
      let found = false
      const updated = prev.map(conv => {
        const isMatch = conv.id === convId || emails.some(e => e.toLowerCase() === conv.email.toLowerCase())
        if (!isMatch) return conv
        found = true
        return { ...conv, lastEmail: conv.lastEmail ? { ...conv.lastEmail, date: nowISO } : conv.lastEmail, isSent: !isScheduled, isScheduled: isScheduled ? true : conv.isScheduled, isDraft: false, draftEmail: undefined, isRead: true, preview: preview.substring(0, 50), upcomingScheduledCount: (conv.upcomingScheduledCount || 0) + (isScheduled ? 1 : 0) }
      })

      if (!found && emails.length > 0) {
        const email = emails[0]
        updated.push({
          id: email,
          name: email.split('@')[0],
          email: email,
          initials: getAvatarInitials(email),
          preview: preview.substring(0, 50),
          isRead: true,
          isSent: !isScheduled,
          isScheduled: isScheduled,
          isDraft: false,
          lastEmail: {
            subject: subjectValue || '(No subject)',
            from: userEmail,
            to: email,
            date: nowISO,
            body: preview
          },
          upcomingScheduledCount: isScheduled ? 1 : undefined
        } as Conversation)
      }

      return [...updated].sort((a, b) => {
        const dA = Math.max(a.lastEmail?.date ? new Date(a.lastEmail.date).getTime() : 0, a.draftEmail?.date ? new Date(a.draftEmail.date).getTime() : 0)
        const dB = Math.max(b.lastEmail?.date ? new Date(b.lastEmail.date).getTime() : 0, b.draftEmail?.date ? new Date(b.draftEmail.date).getTime() : 0)
        return dB - dA
      })
    })
  }

  const getFileTypeInfo = (fileName: string): { label: string | null; bg: string; color: string; borderColor: string } => {
    const ext = (fileName.split('.').pop() || '').toLowerCase()
    if (ext === 'pdf') return { label: 'PDF', bg: '#fff0f0', color: '#e53935', borderColor: '#ffcdd2' }
    if (['doc', 'docx'].includes(ext)) return { label: 'DOC', bg: '#e8f0fe', color: '#1a73e8', borderColor: '#bbdefb' }
    if (['xls', 'xlsx', 'csv'].includes(ext)) return { label: 'XLS', bg: '#e8f5e9', color: '#2e7d32', borderColor: '#c8e6c9' }
    if (['ppt', 'pptx'].includes(ext)) return { label: 'PPT', bg: '#fff3e0', color: '#e65100', borderColor: '#ffe0b2' }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return { label: 'ZIP', bg: '#fdf3e3', color: '#795548', borderColor: '#d7ccc8' }
    if (['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'].includes(ext)) return { label: 'AUD', bg: '#f3e5f5', color: '#7b1fa2', borderColor: '#e1bee7' }
    if (['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'].includes(ext)) return { label: 'VID', bg: '#e8eaf6', color: '#283593', borderColor: '#c5cae9' }
    if (['txt', 'md', 'rtf'].includes(ext)) return { label: 'TXT', bg: '#f5f5f5', color: '#616161', borderColor: '#e0e0e0' }
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'json', 'xml', 'java', 'c', 'cpp', 'go', 'rb', 'php', 'swift'].includes(ext)) return { label: 'CODE', bg: '#e0f2f1', color: '#00695c', borderColor: '#b2dfdb' }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) return { label: 'IMG', bg: '#fce4ec', color: '#c2185b', borderColor: '#f8bbd0' }
    return { label: null, bg: '#ebebeb', color: '#888', borderColor: '#ddd' }
  }

  const generateFileSVGUrl = (fileName: string): string => {
    const { label, bg, color, borderColor } = getFileTypeInfo(fileName)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="114">` +
      `<rect x=".5" y=".5" width="149" height="113" fill="${bg}" stroke="${borderColor}"/>` +
      (label ? `<text x="75" y="57" font-size="28" font-weight="bold" fill="${color}" text-anchor="middle" font-family="-apple-system,sans-serif" dominant-baseline="middle">${label}</text>` : '') +
      `</svg>`
    return 'data:image/svg+xml,' + encodeURIComponent(svg)
  }

  // Strip large base64 src values from file-card thumbnails before sending to server.
  // The local display keeps base64 for instant preview; the server only needs the server URL.
  const cleanBodyForServer = (html: string): string => {
    try {
      const div = document.createElement('div')
      div.innerHTML = html
      div.querySelectorAll<HTMLElement>('[data-file-card]').forEach(card => {
        const img = card.querySelector('img')
        if (!img) return
        const src = img.getAttribute('src') || ''
        if (src.startsWith('data:')) {
          const serverUrl = card.getAttribute('data-file-url') || ''
          img.setAttribute('src', serverUrl)
        }
      })
      return div.innerHTML
    } catch { return html }
  }

  // Persist in-progress sends across page refreshes
  const PENDING_SEND_KEY = 'chat_pending_sends'
  interface PendingSend {
    messageId: number
    conversationId: string | null
    message: Message
    payload: { to: string; subject: string; body: string; cc?: string; bcc?: string; attachments?: Array<{ name: string; size: number; dataUrl?: string }> }
  }
  const savePendingSend = (data: PendingSend) => {
    try {
      const store: Record<string, PendingSend> = JSON.parse(localStorage.getItem(PENDING_SEND_KEY) || '{}')
      // Strip base64 from content for quota safety
      store[data.messageId] = { ...data, message: { ...data.message, content: data.payload.body } }
      localStorage.setItem(PENDING_SEND_KEY, JSON.stringify(store))
    } catch {}
  }
  const removePendingSend = (messageId: number) => {
    try {
      const store: Record<string, PendingSend> = JSON.parse(localStorage.getItem(PENDING_SEND_KEY) || '{}')
      delete store[messageId]
      localStorage.setItem(PENDING_SEND_KEY, JSON.stringify(store))
    } catch {}
  }
  const loadPendingSends = (): PendingSend[] => {
    try { return Object.values(JSON.parse(localStorage.getItem(PENDING_SEND_KEY) || '{}')) } catch { return [] }
  }

  const ATTACH_KEY = 'mail_msg_attachments'
  const saveAttachmentStore = (content: string, attachments: Array<{ name: string; size: number; dataUrl?: string }>) => {
    try {
      const store: Record<string, typeof attachments> = JSON.parse(localStorage.getItem(ATTACH_KEY) || '{}')
      const key = content.slice(0, 150) + '|' + content.length
      store[key] = attachments
      const keys = Object.keys(store)
      if (keys.length > 50) delete store[keys[0]]
      localStorage.setItem(ATTACH_KEY, JSON.stringify(store))
    } catch (_) {}
  }
  const loadAttachmentStore = (content: string): Array<{ name: string; size: number; dataUrl?: string }> | null => {
    try {
      const store: Record<string, Array<{ name: string; size: number; dataUrl?: string }>> = JSON.parse(localStorage.getItem(ATTACH_KEY) || '{}')
      const key = content.slice(0, 150) + '|' + content.length
      return store[key] ?? null
    } catch (_) { return null }
  }

  const handleSendMessage = async () => {
    const currentInput = commitActiveCanvasToImage()
    const contact = conversations.find((c) => c.id === selectedConversation)
    const finalTo = toInput.trim() ? [...toEmails, toInput.trim()] : toEmails.length > 0 ? toEmails : contact ? [contact.email] : []

    if (finalTo.length === 0) {
      setValidationError('Please specify at least one recipient.')
      return
    }

    const invalidEmail = finalTo.find(e => !isValidEmail(e))
    if (invalidEmail) {
      setValidationError(`The address "${invalidEmail}" in the "To" field is invalid. Please ensure it is properly formatted (e.g., user@example.com).`)
      return
    }

    if (!currentInput.replace(/<[^>]+>/g, '').trim() && !currentInput.includes('<img')) {
      setValidationError('Please enter a message to send.')
      return
    }

    if (!subjectValue.trim()) {
      setSubjectWarning('You are sending message without subject')
      await new Promise(resolve => setTimeout(resolve, 2000))
      setSubjectWarning(null)
    }

    // Flush any pending tag input before sending
    const finalCc = ccInput.trim() ? [...ccEmails, ccInput.trim()] : ccEmails
    const finalBcc = bccInput.trim() ? [...bccEmails, bccInput.trim()] : bccEmails

    if (ccInput.trim()) setCcEmails(finalCc)
    if (bccInput.trim()) setBccEmails(finalBcc)
    setToEmails(finalTo)
    setToInput('')
    setMessageSent(true)
    setReplyEmailCard(null)

    setScrollToBottom('smooth')
    
    let finalBody = currentInput;
    if (replyEmailCard && replyEmailCard.action !== 'forward') {
      const dateStr = replyEmailCard.date ? new Date(replyEmailCard.date).toLocaleString() : ''
      finalBody = `${currentInput}${REPLY_DRAFT_SEPARATOR}From: ${replyEmailCard.from}\nDate: ${dateStr}\nSubject: ${replyEmailCard.subject}\n\n${replyEmailCard.body}`
    }

    const messageId = Date.now()
    const newMessage: Message = {
      id: messageId,
      subject: subjectValue || '(No subject)',
      content: finalBody,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      date: new Date().toISOString(),
      incoming: false,
      cc: finalCc.join(', ') || null,
      bcc: finalBcc.join(', ') || null,
      isPending: true,
      attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    }

    if (attachedFiles.length > 0) saveAttachmentStore(finalBody, attachedFiles)
    setMessages(prev => [...prev, newMessage])
    bumpConvToTop(selectedConversation, finalTo, currentInput)

    const payload = {
      to: finalTo.join(', '),
      subject: subjectValue || '(No subject)',
      body: cleanBodyForServer(finalBody),
      cc: finalCc.join(', ') || undefined,
      bcc: finalBcc.join(', ') || undefined,
      attachments: attachedFiles.filter(f => f.dataUrl && f.dataUrl.includes(',')).map(f => ({ name: f.name, size: f.size, dataUrl: f.dataUrl! })),
      // Tags the send with the active group compose session (if any) so it's delivered
      // to every member and shows up in the Groups page / Chat Mail's dedicated group
      // thread instead of being treated as a regular individual message.
      ...(composeGroupId ? { groupId: composeGroupId } : {}),
    }

    if (window.name === 'compose_window') {
      const attemptSendImmediate = async () => {
        try {
          await fetch('http://localhost:5050/api/send', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } catch (err) {
          console.error(err)
        } finally {
          window.close()
        }
      }
      attemptSendImmediate()
      clearInputs(true, true)
      return
    }

    savePendingSend({ messageId, conversationId: selectedConversation, message: newMessage, payload })

    const timeoutId = setTimeout(() => {
      pendingTimeouts.current.delete(messageId)
      const attemptSend = async () => {
        if (!navigator.onLine) {
          const onOnline = () => { window.removeEventListener('online', onOnline); attemptSend(); }
          window.addEventListener('online', onOnline)
          return
        }
        try {
          const res = await fetch('http://localhost:5050/api/send', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (res.ok) {
            removePendingSend(messageId)
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPending: false } : m))
            fetchEmails(true)
            window.dispatchEvent(new Event('mailRefresh'))
          } else setTimeout(attemptSend, 3000)
        } catch (err) {
          console.error('Failed to send message:', err)
          setTimeout(attemptSend, 3000)
        }
      }
      attemptSend()
    }, 5000)
    pendingTimeouts.current.set(messageId, timeoutId)

    clearInputs(true, true)
  }

  const handleResend = (msg: Message) => {
    const contact = conversations.find(c => c.id === selectedConversation)
    const to = contact ? contact.email : ''
    setScrollToBottom('smooth')
    
    const messageId = Date.now()
    const newMessage: Message = {
      id: messageId,
      subject: msg.subject || '(No subject)',
      content: msg.content,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      date: new Date().toISOString(),
      incoming: false,
      cc: msg.cc || null,
      bcc: msg.bcc || null,
      isPending: true,
    }
    setMessages(prev => [...prev, newMessage])
    bumpConvToTop(selectedConversation, to ? [to] : [], msg.content)

    const payload = {
      to,
      subject: msg.subject || '(No subject)',
      body: cleanBodyForServer(msg.content),
      ...(msg.cc ? { cc: msg.cc } : {}),
      ...(msg.bcc ? { bcc: msg.bcc } : {}),
      ...(contact?.groupId ? { groupId: contact.groupId } : {}),
    }
    
    const timeoutId = setTimeout(() => {
      pendingTimeouts.current.delete(messageId)
      const attemptSend = async () => {
        if (!navigator.onLine) {
          const onOnline = () => { window.removeEventListener('online', onOnline); attemptSend(); }
          window.addEventListener('online', onOnline)
          return
        }
        try {
          const res = await fetch('http://localhost:5050/api/send', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          if (res.ok) {
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPending: false } : m))
            fetchEmails(true)
            window.dispatchEvent(new Event('mailRefresh'))
          } else setTimeout(attemptSend, 3000)
        } catch (err) { console.error('Failed to resend message:', err); setTimeout(attemptSend, 3000) }
      }
      attemptSend()
    }, 5000)
    pendingTimeouts.current.set(messageId, timeoutId)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); doUndo() }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); doRedo() }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b' && !e.shiftKey) { e.preventDefault(); applyFormat('bold') }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i' && !e.shiftKey) { e.preventDefault(); applyFormat('italic') }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u' && !e.shiftKey) { e.preventDefault(); applyFormat('underline') }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'x') { e.preventDefault(); applyFormat('strike') }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      saveEditorSelection()
      const sel = window.getSelection()
      let linkEl: HTMLAnchorElement | null = null
      let node = sel?.anchorNode || null
      while (node && node !== editorRef.current) {
        if (node.nodeName === 'A') { linkEl = node as HTMLAnchorElement; break }
        node = node.parentNode
      }
      const rect = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).getBoundingClientRect() : editorRef.current?.getBoundingClientRect()
      if (linkEl) {
        setEditingLinkEl(linkEl)
        setLinkUrl(linkEl.getAttribute('href') || '')
        setLinkText(linkEl.textContent || '')
        setLinkOpenNewTab(linkEl.getAttribute('target') === '_blank')
      } else {
        setEditingLinkEl(null)
        setLinkUrl('')
        setLinkText(sel?.toString() || '')
        setLinkOpenNewTab(true)
      }
      closeAllToolbarMenus()
      if (rect) setToolbarMenuPos({ bottom: window.innerHeight - rect.bottom + 4, left: rect.left })
      setLinkPopoverOpen(true)
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'e') { e.preventDefault(); applyFormat('code') }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '7') { e.preventDefault(); applyFormat('ol') }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '8') { e.preventDefault(); applyFormat('ul') }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '9') { e.preventDefault(); applyFormat('quote') }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSendMessage() }
  }

  const buildPayload = (currentInput: string, extra?: object) => {
    const contact = conversations.find(c => c.id === selectedConversation)
    const finalTo = toInput.trim() ? [...toEmails, toInput.trim()] : toEmails.length > 0 ? toEmails : [contact?.email ?? '']
    const finalCc = ccInput.trim() ? [...ccEmails, ccInput.trim()] : ccEmails
    const finalBcc = bccInput.trim() ? [...bccEmails, bccInput.trim()] : bccEmails
    
    let finalBody = currentInput;
    if (replyEmailCard && replyEmailCard.action !== 'forward') {
      const dateStr = replyEmailCard.date ? new Date(replyEmailCard.date).toLocaleString() : ''
      finalBody = `${currentInput}${REPLY_DRAFT_SEPARATOR}From: ${replyEmailCard.from}\nDate: ${dateStr}\nSubject: ${replyEmailCard.subject}\n\n${replyEmailCard.body}`
    }

    return {
      to: finalTo.join(', '),
      subject: subjectValue || '(No subject)',
      body: cleanBodyForServer(finalBody),
      ...(finalCc.length ? { cc: finalCc.join(', ') } : {}),
      ...(finalBcc.length ? { bcc: finalBcc.join(', ') } : {}),
      has_attachments: attachedFiles.length > 0,
      // Tags the send with the active group compose session (if any) so it's delivered
      // to every member and shows up in the Groups page / Chat Mail's dedicated group
      // thread instead of being treated as a regular individual message.
      ...(composeGroupId ? { groupId: composeGroupId } : {}),
      ...extra,
    }
  }

  const clearInputs = (keepTo = false, skipRefresh = false) => {
    isClearingRef.current = true
    hasInteractedRef.current = false
    setAttachedFiles([])
    try { sessionStorage.setItem('chat_attachments', '[]') } catch (_) {}
    activeDraftSessionRef.current += 1
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current)
      draftSaveTimerRef.current = null
    }

    const finalizeClear = () => {
      if (!skipRefresh) {
        window.dispatchEvent(new Event('mailRefresh'))
      }
    }

    if (draftIdRef.current) {
      const deletedDraftId = draftIdRef.current
      setConversations(prev => prev.map(c => c.id === currentConvIdRef.current ? { ...c, draftEmail: undefined } : c))
      try { localStorage.removeItem(`draft_${draftIdRef.current}_attachments`) } catch {}
      fetch(`http://localhost:5050/api/emails/${draftIdRef.current}/draft`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {}).finally(() => {
        finalizeClear()
        // Safety net for the (normally impossible) case where another instance also
        // references this same draftId — most of the time this is a no-op since this
        // instance already closed/cleared itself via the code that called clearInputs.
        window.dispatchEvent(new CustomEvent('chatmail:draftDeleted', { detail: { draftId: deletedDraftId } }))
      })
      setDraftId(null)
    }
    setInputValue('')
    setSubjectValue('')
    if (!keepTo) {
      const contact = conversationsRef.current.find(c => c.id === selectedConversation)
      if (contact) {
        setToEmails([contact.email])
        setInitialToEmails([contact.email])
      } else {
        setToEmails([])
        setInitialToEmails([])
      }
      setToInput('')
      setMessageSent(false)
    }
    setCcInput('')
    setBccInput('')
    setCcEmails([])
    setBccEmails([])
    setSendDropdownOpen(false)
    setShowSchedulePopup(false)
    setScheduleDate('')
    if (editorRef.current) editorRef.current.innerHTML = ''

    setTimeout(() => {
      isClearingRef.current = false
    }, 250)
  }

  const flushTo = () => {
    const contact = conversations.find(c => c.id === selectedConversation)
    const finalTo = toInput.trim() ? [...toEmails, toInput.trim()] : toEmails.length > 0 ? toEmails : contact ? [contact.email] : []
    setToEmails(finalTo)
    setToInput('')
    setMessageSent(true)
    return finalTo
  }

  const handleScheduleSend = async (dateTimeStr: string) => {
    if (!dateTimeStr) return
    const currentInput = commitActiveCanvasToImage()
    const contact = conversations.find(c => c.id === selectedConversation)

    const finalToAttempt = toInput.trim() ? [...toEmails, toInput.trim()] : toEmails.length > 0 ? toEmails : contact ? [contact.email] : []

    if (finalToAttempt.length === 0) {
      setValidationError('Please specify at least one recipient.')
      return
    }

    const invalidEmail = finalToAttempt.find(e => !isValidEmail(e))
    if (invalidEmail) {
      setValidationError(`The address "${invalidEmail}" in the "To" field is invalid. Please ensure it is properly formatted (e.g., user@example.com).`)
      return
    }

    if (!currentInput.replace(/<[^>]+>/g, '').trim() && !currentInput.includes('<img')) {
      setValidationError('Please enter a message to send.')
      return
    }

    if (!subjectValue.trim()) {
      setSubjectWarning('You are scheduled sending message without subject')
      await new Promise(resolve => setTimeout(resolve, 2000))
      setSubjectWarning(null)
    }

    const finalTo = flushTo()
    setScrollToBottom('smooth')
    
    let finalBody = currentInput;
    if (replyEmailCard && replyEmailCard.action !== 'forward') {
      const dateStr = replyEmailCard.date ? new Date(replyEmailCard.date).toLocaleString() : ''
      finalBody = `${currentInput}${REPLY_DRAFT_SEPARATOR}From: ${replyEmailCard.from}\nDate: ${dateStr}\nSubject: ${replyEmailCard.subject}\n\n${replyEmailCard.body}`
    }

    const messageId = Date.now()
    const newMessage: Message = {
      id: messageId,
      subject: subjectValue || '(No subject)',
      content: finalBody,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      date: new Date().toISOString(),
      incoming: false,
      isPending: false,
      isScheduled: true,
      scheduledFor: dateTimeStr,
    }
    setMessages(prev => [...prev, newMessage])
    bumpConvToTop(selectedConversation, finalTo, currentInput, true)

    const payload = { ...buildPayload(currentInput), scheduled_for: dateTimeStr, is_scheduled: true }
    clearInputs(true, true)

    const attemptSend = async () => {
      if (!navigator.onLine) {
        const onOnline = () => { window.removeEventListener('online', onOnline); attemptSend(); }
        window.addEventListener('online', onOnline)
        return
      }
      try {
        const res = await fetch('http://localhost:5050/api/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          fetchEmails(true)
          window.dispatchEvent(new Event('mailRefresh'))
        } else setTimeout(attemptSend, 3000)
      } catch (err) { console.error('Failed to schedule:', err); setTimeout(attemptSend, 3000) }
    }
    attemptSend()
  }

  const handleQuickSchedule = (hours: number) => {
    const date = new Date(Date.now() + hours * 3600000)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const dateTimeStr = `${year}-${month}-${day}T${hour}:${minute}`

    handleScheduleSend(dateTimeStr)
  }

  const handleMergeSend = async () => {
    const currentInput = commitActiveCanvasToImage()
    const contact = conversations.find(c => c.id === selectedConversation)

    const finalToAttempt = toInput.trim() ? [...toEmails, toInput.trim()] : toEmails.length > 0 ? toEmails : contact ? [contact.email] : []

    if (finalToAttempt.length === 0) {
      setValidationError('Please specify at least one recipient.')
      return
    }

    const invalidEmail = finalToAttempt.find(e => !isValidEmail(e))
    if (invalidEmail) {
      setValidationError(`The address "${invalidEmail}" in the "To" field is invalid. Please ensure it is properly formatted (e.g., user@example.com).`)
      return
    }

    if (!currentInput.replace(/<[^>]+>/g, '').trim() && !currentInput.includes('<img')) {
      setValidationError('Please enter a message to send.')
      return
    }

    if (!subjectValue.trim()) {
      setSubjectWarning('You are sending message without subject')
      await new Promise(resolve => setTimeout(resolve, 2000))
      setSubjectWarning(null)
    }

    const finalTo = flushTo()
    setScrollToBottom('smooth')
    
    let finalBody = currentInput;
    if (replyEmailCard && replyEmailCard.action !== 'forward') {
      const dateStr = replyEmailCard.date ? new Date(replyEmailCard.date).toLocaleString() : ''
      finalBody = `${currentInput}${REPLY_DRAFT_SEPARATOR}From: ${replyEmailCard.from}\nDate: ${dateStr}\nSubject: ${replyEmailCard.subject}\n\n${replyEmailCard.body}`
    }

    const messageId = Date.now()
    const newMessage: Message = {
      id: messageId,
      subject: subjectValue || '(No subject)',
      content: finalBody,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      incoming: false,
      isPending: true,
    }
    setMessages(prev => [...prev, newMessage])
    bumpConvToTop(selectedConversation, finalTo, currentInput)
    
    const payload = buildPayload(currentInput)
    clearInputs(true, true)

    const attemptSend = async () => {
      if (!navigator.onLine) {
        const onOnline = () => { window.removeEventListener('online', onOnline); attemptSend(); }
        window.addEventListener('online', onOnline)
        return
      }
      try {
        const res = await fetch('http://localhost:5050/api/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPending: false } : m))
          fetchEmails(true)
          window.dispatchEvent(new Event('mailRefresh'))
        } else setTimeout(attemptSend, 3000)
      } catch (err) { console.error('Failed to merge send:', err); setTimeout(attemptSend, 3000) }
    }
    attemptSend()
  }

  // ── Conversation-level helpers for header toolbar ──────────────────────────
  const convEmailIds = messages.filter(m => m.emailId).map(m => m.emailId!)
  const convNonDeleted = messages.filter(m => !m.isDeleted)
  const convIncomingNonDel = convNonDeleted.filter(m => m.incoming)
  const convAllRead = convIncomingNonDel.length === 0 || convIncomingNonDel.every(m => m.isRead)
  const convAllUnread = convIncomingNonDel.length > 0 && convIncomingNonDel.every(m => !m.isRead)
  const convAllStarred = convNonDeleted.length > 0 && convNonDeleted.every(m => m.isStarred)
  const convAllUnstarred = convNonDeleted.length > 0 && convNonDeleted.every(m => !m.isStarred)
  const convAnyArchived = convNonDeleted.some(m => m.isArchived)
  const convAllArchived = convNonDeleted.length > 0 && convNonDeleted.every(m => m.isArchived)
  const convAllUnarchived = convNonDeleted.length > 0 && convNonDeleted.every(m => !m.isArchived)
  const convAllSnoozed = convNonDeleted.length > 0 && convNonDeleted.every(m => m.isSnoozed)
  const convAllUnsnoozed = convNonDeleted.length > 0 && convNonDeleted.every(m => !m.isSnoozed)
  const convContactEmail = (conversations.find(c => c.id === selectedConversation)?.email || '').toLowerCase()
  const convAllGrouped = !!convContactEmail && groupedEmails.has(convContactEmail)
  const convAllUngrouped = !!convContactEmail && !groupedEmails.has(convContactEmail)
  const convAnySpam = convNonDeleted.some(m => m.isSpam)
  const convAllSpam = convNonDeleted.length > 0 && convNonDeleted.every(m => m.isSpam)
  const convAllUnspam = convNonDeleted.length > 0 && convNonDeleted.every(m => !m.isSpam)
  const convAnyReported = convNonDeleted.some(m => m.isReport)
  const convAllReported = convNonDeleted.length > 0 && convNonDeleted.every(m => m.isReport)
  const convAllUnreported = convNonDeleted.length > 0 && convNonDeleted.every(m => !m.isReport)
  const convAnyPinned = convNonDeleted.some(m => m.isPinned)
  const convAllPinned = convNonDeleted.length > 0 && convNonDeleted.every(m => m.isPinned)
  const convAllUnpinned = convNonDeleted.length > 0 && convNonDeleted.every(m => !m.isPinned)
  const convAnyMuted = convNonDeleted.some(m => m.isMuted)
  const convAllMuted = convNonDeleted.length > 0 && convNonDeleted.every(m => m.isMuted)
  const convAllUnmuted = convNonDeleted.length > 0 && convNonDeleted.every(m => !m.isMuted)
  const convAnyDeleted = messages.some(m => m.isDeleted)
  const convAllDeleted = messages.length > 0 && messages.every(m => m.isDeleted)
  const convAllUndeleted = messages.length > 0 && messages.every(m => !m.isDeleted)
  const lastNonDeletedMsg = convNonDeleted.at(-1)

  const handleConvMarkRead = async (isRead: boolean) => {
    const targetMessages = messages.filter(m => m.incoming && m.emailId && m.isRead !== isRead)
    const ids = targetMessages.map(m => m.emailId!)
    if (ids.length === 0) return
    setMessages(prev => prev.map(m => ids.includes(m.emailId!) ? { ...m, isRead } : m))
    setAllEmails(prev => prev.map(e => e.id != null && ids.includes(e.id) ? { ...e, isRead } : e))
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/read`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_read: isRead }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
  }

  const handleSelectedMarkRead = async (isRead: boolean) => {
    const targetMessages = messages.filter(m => m.incoming && m.emailId && selectedMsgIds.has(m.emailId) && m.isRead !== isRead)
    const ids = targetMessages.map(m => m.emailId!)
    if (ids.length === 0) return
    setMessages(prev => prev.map(m => ids.includes(m.emailId!) ? { ...m, isRead } : m))
    setAllEmails(prev => prev.map(e => e.id != null && ids.includes(e.id) ? { ...e, isRead } : e))
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/read`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_read: isRead }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
    setSelectionMode(false)
    setSelectedMsgIds(new Set())
  }

  const handleConvSetStar = async (force?: boolean) => {
    const nextStarred = force ?? !convAllStarred
    setMessages(prev => prev.map(m => ({ ...m, isStarred: nextStarred })))
    setAllEmails(prev => prev.map(e => e.id != null && convEmailIds.includes(e.id) ? { ...e, isStarred: nextStarred } : e))
    try {
      await Promise.all(convEmailIds.map(id => fetch(`http://localhost:5050/api/emails/${id}/star`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_starred: nextStarred }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
  }

  const handleConvSetArchive = async (force?: boolean) => {
    const nextArchived = force ?? !convAnyArchived
    setMessages(prev => prev.map(m => ({ ...m, isArchived: nextArchived })))
    setAllEmails(prev => prev.map(e => e.id != null && convEmailIds.includes(e.id) ? { ...e, isArchived: nextArchived } : e))
    try {
      await Promise.all(convEmailIds.map(id => fetch(`http://localhost:5050/api/emails/${id}/archive`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_archived: nextArchived }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
  }

  const handleConvDeleteAllConfirmed = async () => {
    setMessages(prev => prev.map(m => ({ ...m, isDeleted: true })))
    setAllEmails(prev => prev.map(e => e.id != null && convEmailIds.includes(e.id) ? { ...e, isDeleted: true } : e))
    try {
      await Promise.all(convEmailIds.map(id => fetch(`http://localhost:5050/api/emails/${id}/delete`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_deleted: true }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
    setHeaderMoreOpen(false)
  }
  const handleConvDeleteAll = () => {
    setConfirmDialog({
      title: 'Delete conversation?',
      message: `Move all ${convEmailIds.length} message(s) in this conversation to Trash?`,
      onConfirm: handleConvDeleteAllConfirmed,
    })
  }

  const handleConvRestore = async () => {
    setMessages(prev => prev.map(m => ({ ...m, isDeleted: false })))
    setAllEmails(prev => prev.map(e => e.id != null && convEmailIds.includes(e.id) ? { ...e, isDeleted: false } : e))
    try {
      await Promise.all(convEmailIds.map(id => fetch(`http://localhost:5050/api/emails/${id}/restore`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
    setHeaderMoreOpen(false)
  }

  const handleConvToggleDeleteRestore = () => convAnyDeleted ? handleConvRestore() : handleConvDeleteAll()

  const handleConvApplyLabel = async (labelName: string) => {
    // Optimistic update — without this, an already-open message's label pill (which reads
    // from allEmails, not msg directly) wouldn't reflect the new label until the background
    // 'mailRefresh' refetch completes.
    setAllEmails(prev => prev.map(e => e.id != null && convEmailIds.includes(e.id) ? { ...e, label_name: labelName } : e))
    try {
      await Promise.all(convEmailIds.map(id => fetch(`http://localhost:5050/api/emails/${id}/label`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ label_name: labelName }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
  }

  const handleConvSetSpam = async (force?: boolean) => {
    const nextSpam = force ?? !convAnySpam
    setMessages(prev => prev.map(m => ({ ...m, isSpam: nextSpam })))
    setAllEmails(prev => prev.map(e => e.id != null && convEmailIds.includes(e.id) ? { ...e, isSpam: nextSpam } : e))
    try {
      await Promise.all(convEmailIds.map(id => fetch(`http://localhost:5050/api/emails/${id}/spam`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_spam: nextSpam }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
    setHeaderMoreOpen(false)
  }

  const handleConvSetReport = async (force?: boolean) => {
    const nextReport = force ?? !convAnyReported
    setMessages(prev => prev.map(m => ({ ...m, isReport: nextReport })))
    setAllEmails(prev => prev.map(e => e.id != null && convEmailIds.includes(e.id) ? { ...e, isReport: nextReport } : e))
    try {
      await Promise.all(convEmailIds.map(id => fetch(`http://localhost:5050/api/emails/${id}/report`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_report: nextReport }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
    setHeaderMoreOpen(false)
  }

  const handleConvSetPin = async (force?: boolean) => {
    const nextPinned = force ?? !convAnyPinned
    setMessages(prev => prev.map(m => ({ ...m, isPinned: nextPinned })))
    setAllEmails(prev => prev.map(e => e.id != null && convEmailIds.includes(e.id) ? { ...e, isPinned: nextPinned } : e))
    setConversations(prev => {
      const updated = prev.map(c => c.id === selectedConversation && c.lastEmail ? { ...c, lastEmail: { ...c.lastEmail, isPinned: nextPinned } } : c)
      return updated.sort((a, b) => {
        const pinnedA = a.lastEmail?.isPinned ? 1 : 0
        const pinnedB = b.lastEmail?.isPinned ? 1 : 0
        if (pinnedA !== pinnedB) return pinnedB - pinnedA
        const dateA = Math.max(a.lastEmail?.date ? new Date(a.lastEmail.date).getTime() : 0, a.draftEmail?.date ? new Date(a.draftEmail.date).getTime() : 0)
        const dateB = Math.max(b.lastEmail?.date ? new Date(b.lastEmail.date).getTime() : 0, b.draftEmail?.date ? new Date(b.draftEmail.date).getTime() : 0)
        return dateB - dateA
      })
    })
    try {
      await Promise.all(convEmailIds.map(id => fetch(`http://localhost:5050/api/emails/${id}/pin`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_pinned: nextPinned }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
    setHeaderMoreOpen(false)
  }

  const handleConvSetMute = async (force?: boolean) => {
    const nextMuted = force ?? !convAnyMuted
    setMessages(prev => prev.map(m => ({ ...m, isMuted: nextMuted })))
    setAllEmails(prev => prev.map(e => e.id != null && convEmailIds.includes(e.id) ? { ...e, isMuted: nextMuted } : e))
    setConvMuted(nextMuted)
    try {
      await Promise.all(convEmailIds.map(id => fetch(`http://localhost:5050/api/emails/${id}/mute`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_muted: nextMuted }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
    setHeaderMoreOpen(false)
  }

  const handleConvSnoozeHours = async (hours: number) => {
    try {
      await Promise.all(convEmailIds.map(id => fetch(`http://localhost:5050/api/emails/${id}/snooze`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_snoozed: hours > 0, hours }) })))
      setHeaderMoreOpen(false)
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
  }

  // ────────────────────────────────────────────────────────────────────────────

  // Conversation-list-level bulk selection toolbar ────────────────────────────
  const getConvEmailIds = (conv: Conversation): number[] => {
    if (conv.id.startsWith('draft_')) return conv.draftEmail?.id != null ? [conv.draftEmail.id] : []
    const me = userEmail.toLowerCase()
    return allEmails.filter(e => {
      if (e.isDraft && e.isDeleted) return false
      if (conv.groupId) return e.groupId === conv.groupId
      const isOutgoing = e.from?.toLowerCase() === me || e.folder === 'sent' || e.isDraft
      const rawContact = isOutgoing ? e.to : e.from
      const contactEmail = rawContact?.split(',')[0]?.trim()?.toLowerCase()
      return contactEmail === conv.email.toLowerCase()
    }).map(e => e.id).filter((id): id is number => id != null)
  }

  const selectedConvsList = conversations.filter(c => selectedConvIds.has(c.id))
  const selectedListEmailIds = Array.from(new Set(selectedConvsList.flatMap(getConvEmailIds)))
  const matchesChatListTab = (conv: Conversation, tab: string): boolean => {
    // 'all' = true chat-native default (no folder proxy); 'allmails' = the sidebar's All
    // Mails folder proxied through Chat Mail — both show every conversation, but they're
    // kept as distinct keys so the header can tell "no folder" apart from "this folder".
    if (tab === 'all' || tab === 'allmails') return true
    if (tab === 'group') return groupedEmails.has(conv.email.toLowerCase())
    if (tab.startsWith('label:')) {
      const labelPath = tab.slice('label:'.length)
      // Parent labels with children aggregate their descendants' emails too — mirrors
      // AllMailsPage's includeChildren behavior, which fetches each child label's emails
      // separately and merges them into the parent label's view.
      const labelNode = flattenLabelsTree(customLabels).find(l => l.fullPath === labelPath)
      const convEmails = getConvEmailIds(conv).map(id => allEmails.find(e => e.id === id)).filter((e): e is Email => !!e)
      return convEmails.some(e => e.label_name === labelPath || (!!labelNode?.hasChildren && !!e.label_name?.startsWith(labelPath + ' / ')))
    }
    const convEmails = getConvEmailIds(conv).map(id => allEmails.find(e => e.id === id)).filter((e): e is Email => !!e)
    if (tab === 'inbox') return convEmails.some(e => e.folder === 'inbox')
    if (tab === 'sent') return convEmails.some(e => e.folder === 'sent') || conv.isSent
    if (tab === 'starred') return convEmails.some(e => e.isStarred)
    if (tab === 'archive') return convEmails.some(e => e.isArchived)
    // Matches AllMailsPage's /api/scheduled (scheduled_for IS NOT NULL) — includes emails
    // that are still pending AND ones already sent via their schedule, not just pending ones.
    if (tab === 'scheduled') return convEmails.some(e => !!e.scheduledFor) || conv.isScheduled || !!conv.nextScheduledEmail
    if (tab === 'draft') return convEmails.some(e => e.isDraft) || conv.isDraft || !!conv.draftEmail
    if (tab === 'spam') return convEmails.some(e => e.isSpam)
    if (tab === 'report') return convEmails.some(e => e.isReport)
    if (tab === 'delete') return convEmails.some(e => e.isDeleted)
    if (tab === 'snoozed') return convEmails.some(e => e.isSnoozed)
    return true
  }
  const tabFilteredConversations = conversations.filter(conv => matchesChatListTab(conv, chatListTab))
  // When a sidebar folder/label is being proxied through Chat Mail (chatListTab !== 'all'),
  // the header should show that folder's own icon + name instead of the generic Chat Mail
  // branding — same lookup is used whichever direction the switch button was used from.
  const folderHeaderInfo: { icon: JSX.Element; label: string; color: string } = (() => {
    // Mirrors AllMailsPage's own `sectionIcon`/`sectionName` exactly (same icon component,
    // color, and size per folder) so the header reads as "the same folder" as the All Mails
    // page, not a generic placeholder built from a different palette.
    const folderMap: Record<string, { color: string; label: string; Icon: typeof Inbox }> = {
      inbox: { Icon: Inbox, color: '#64b5f6', label: 'Inbox' },
      allmails: { Icon: Mail, color: '#1e88e5', label: 'All Mails' },
      sent: { Icon: Send, color: '#4db6ac', label: 'Sent' },
      starred: { Icon: Star, color: '#ffc107', label: 'Starred' },
      snoozed: { Icon: Clock, color: '#fb8c00', label: 'Snoozed' },
      draft: { Icon: Edit, color: '#ff5722', label: 'Drafts' },
      archive: { Icon: Archive, color: '#7986cb', label: 'Archive' },
      group: { Icon: Users, color: '#888', label: 'Group' },
      report: { Icon: BarChart2, color: '#7b5ea7', label: 'Reports' },
      spam: { Icon: AlertOctagon, color: '#e91e63', label: 'Spam' },
      delete: { Icon: Trash2, color: '#f48fb1', label: 'Trash' },
    }
    if (chatListTab.startsWith('label:')) {
      const fullPath = chatListTab.slice('label:'.length)
      const found = flattenLabelsTree(customLabels).find(l => l.fullPath === fullPath)
      const color = found?.color || '#888'
      const ls = { flexShrink: 0 as const, color: 'white', stroke: 'white', fill: color }
      // Matches AllMailsPage's sectionIcon exactly: parent labels (with sub-labels) use a
      // folder icon (open/closed per the same shared expand state), leaf labels use a tag.
      let icon: JSX.Element
      if (found?.hasChildren) {
        let isExpanded = false
        try {
          const expandedIds: number[] = JSON.parse(localStorage.getItem('expandedLabelGroups') || '[]')
          isExpanded = found.id != null && expandedIds.includes(found.id)
        } catch { /* ignore malformed storage */ }
        icon = isExpanded ? <FolderOpen size={22} style={ls} /> : <Folder size={22} style={ls} />
      } else {
        icon = <Tag size={22} style={ls} />
      }
      return { icon, label: found?.leafName || fullPath, color }
    }
    if (chatListTab === 'scheduled') {
      // AllMailsPage's sectionIcon for 'scheduled' is a CSS background-image, not a
      // colorable lucide icon — reuse the exact same class for a pixel-identical match.
      return { icon: <span className="active-scheduled-icon-bg" style={{ width: 22, height: 22, backgroundSize: '22px 22px', margin: 0, flexShrink: 0 }} />, label: 'Scheduled', color: '#4db6ac' }
    }
    const entry = folderMap[chatListTab]
    if (!entry) return { icon: <Inbox size={22} style={{ color: '#64b5f6' }} />, label: chatListTab, color: '#64b5f6' }
    const { Icon, color, label } = entry
    return { icon: <Icon size={22} style={{ color, ...(chatListTab === 'starred' ? { fill: color } : {}) }} />, label, color }
  })()
  const listAllSnoozed = selectedConvsList.length > 0 && selectedConvsList.every(c => c.lastEmail?.isSnoozed)
  const listAllUnsnoozed = selectedConvsList.length > 0 && selectedConvsList.every(c => !c.lastEmail?.isSnoozed)
  const listAllGrouped = selectedConvsList.length > 0 && selectedConvsList.every(c => groupedEmails.has(c.email.toLowerCase()))
  const listAllUngrouped = selectedConvsList.length > 0 && selectedConvsList.every(c => !groupedEmails.has(c.email.toLowerCase()))
  const listAnySpam = selectedConvsList.some(c => c.lastEmail?.isSpam)
  const listAllSpam = selectedConvsList.length > 0 && selectedConvsList.every(c => c.lastEmail?.isSpam)
  const listAllUnspam = selectedConvsList.length > 0 && selectedConvsList.every(c => !c.lastEmail?.isSpam)
  const listAnyReported = selectedConvsList.some(c => c.lastEmail?.isReport)
  const listAllReported = selectedConvsList.length > 0 && selectedConvsList.every(c => c.lastEmail?.isReport)
  const listAllUnreported = selectedConvsList.length > 0 && selectedConvsList.every(c => !c.lastEmail?.isReport)
  const listAnyPinned = selectedConvsList.some(c => c.lastEmail?.isPinned)
  const listAllPinned = selectedConvsList.length > 0 && selectedConvsList.every(c => c.lastEmail?.isPinned)
  const listAllUnpinned = selectedConvsList.length > 0 && selectedConvsList.every(c => !c.lastEmail?.isPinned)
  const listAnyMuted = selectedConvsList.some(c => c.lastEmail?.isMuted)
  const listAllMuted = selectedConvsList.length > 0 && selectedConvsList.every(c => c.lastEmail?.isMuted)
  const listAllUnmuted = selectedConvsList.length > 0 && selectedConvsList.every(c => !c.lastEmail?.isMuted)
  const listAnyDeleted = selectedListEmailIds.some(id => allEmails.find(e => e.id === id)?.isDeleted)
  const listAllDeleted = selectedListEmailIds.length > 0 && selectedListEmailIds.every(id => allEmails.find(e => e.id === id)?.isDeleted)
  const listAllUndeleted = selectedListEmailIds.length > 0 && selectedListEmailIds.every(id => !allEmails.find(e => e.id === id)?.isDeleted)

  const handleListSelectAll = () => {
    if (selectedConvIds.size === conversations.length) setSelectedConvIds(new Set())
    else setSelectedConvIds(new Set(conversations.map(c => c.id)))
  }

  const handleListDropdownSelect = (selectionType: string) => {
    setListHeaderCheckboxDropdownOpen(false)
    switch (selectionType) {
      case 'all':
        setSelectedConvIds(new Set(conversations.map(c => c.id)))
        break
      case 'none':
        setSelectedConvIds(new Set())
        break
      case 'read':
        setSelectedConvIds(new Set(conversations.filter(c => c.isRead).map(c => c.id)))
        break
      case 'unread':
        setSelectedConvIds(new Set(conversations.filter(c => !c.isRead).map(c => c.id)))
        break
      case 'starred':
        setSelectedConvIds(new Set(conversations.filter(c => c.lastEmail?.isStarred).map(c => c.id)))
        break
      case 'unstarred':
        setSelectedConvIds(new Set(conversations.filter(c => !c.lastEmail?.isStarred).map(c => c.id)))
        break
      default:
        break
    }
  }

  const handleListToggleConv = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelectedConvIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const handleListMarkRead = async (isRead: boolean) => {
    const me = userEmail.toLowerCase()
    const ids = selectedListEmailIds.filter(id => {
      const e = allEmails.find(em => em.id === id)
      return !!e && e.from?.toLowerCase() !== me && e.folder !== 'sent' && e.isRead !== isRead
    })
    if (!ids.length) return
    setAllEmails(prev => prev.map(e => e.id != null && ids.includes(e.id) ? { ...e, isRead } : e))
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/read`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_read: isRead }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
  }

  const handleListSetStar = async (force?: boolean) => {
    const nextStarred = force ?? !(selectedConvsList.length > 0 && selectedConvsList.every(c => c.lastEmail?.isStarred))
    const ids = selectedListEmailIds
    if (!ids.length) return
    setAllEmails(prev => prev.map(e => e.id != null && ids.includes(e.id) ? { ...e, isStarred: nextStarred } : e))
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/star`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_starred: nextStarred }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
  }

  const handleListSetArchive = async (force?: boolean) => {
    const ids = selectedListEmailIds
    if (!ids.length) return
    const nextArchived = force ?? !ids.every(id => allEmails.find(e => e.id === id)?.isArchived)
    setAllEmails(prev => prev.map(e => e.id != null && ids.includes(e.id) ? { ...e, isArchived: nextArchived } : e))
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/archive`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_archived: nextArchived }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
  }

  const handleListSnoozeHours = async (hours: number) => {
    const ids = selectedListEmailIds
    if (!ids.length) return
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/snooze`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_snoozed: hours > 0, hours }) })))
      setListSnoozeMenuOpen(false)
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
  }

  const handleListToggleSnooze = () => handleListSnoozeHours(listAllSnoozed ? 0 : 24)

  const handleListSetSpam = async (force?: boolean) => {
    const ids = selectedListEmailIds
    if (!ids.length) return
    const nextSpam = force ?? !listAnySpam
    setAllEmails(prev => prev.map(e => e.id != null && ids.includes(e.id) ? { ...e, isSpam: nextSpam } : e))
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/spam`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_spam: nextSpam }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
  }

  const handleListSetReport = async (force?: boolean) => {
    const ids = selectedListEmailIds
    if (!ids.length) return
    const nextReport = force ?? !listAnyReported
    setAllEmails(prev => prev.map(e => e.id != null && ids.includes(e.id) ? { ...e, isReport: nextReport } : e))
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/report`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_report: nextReport }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
  }

  const handleListSetPin = async (force?: boolean) => {
    const ids = selectedListEmailIds
    if (!ids.length) return
    const nextPinned = force ?? !listAnyPinned
    setAllEmails(prev => prev.map(e => e.id != null && ids.includes(e.id) ? { ...e, isPinned: nextPinned } : e))
    setConversations(prev => {
      const updated = prev.map(c => selectedConvIds.has(c.id) && c.lastEmail ? { ...c, lastEmail: { ...c.lastEmail, isPinned: nextPinned } } : c)
      return updated.sort((a, b) => {
        const pinnedA = a.lastEmail?.isPinned ? 1 : 0
        const pinnedB = b.lastEmail?.isPinned ? 1 : 0
        if (pinnedA !== pinnedB) return pinnedB - pinnedA
        const dateA = Math.max(a.lastEmail?.date ? new Date(a.lastEmail.date).getTime() : 0, a.draftEmail?.date ? new Date(a.draftEmail.date).getTime() : 0)
        const dateB = Math.max(b.lastEmail?.date ? new Date(b.lastEmail.date).getTime() : 0, b.draftEmail?.date ? new Date(b.draftEmail.date).getTime() : 0)
        return dateB - dateA
      })
    })
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/pin`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_pinned: nextPinned }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
  }

  const handleListSetMute = async (force?: boolean) => {
    const ids = selectedListEmailIds
    if (!ids.length) return
    const nextMuted = force ?? !listAnyMuted
    setAllEmails(prev => prev.map(e => e.id != null && ids.includes(e.id) ? { ...e, isMuted: nextMuted } : e))
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/mute`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_muted: nextMuted }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
  }

  const handleListApplyLabel = async (labelName: string) => {
    const ids = selectedListEmailIds
    if (!ids.length) return
    setAllEmails(prev => prev.map(e => e.id != null && ids.includes(e.id) ? { ...e, label_name: labelName } : e))
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/label`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ label_name: labelName }) })))
      setListMoveMenuOpen(false)
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
  }

  const handleListEmptyConfirmed = async () => {
    const ids = selectedListEmailIds
    if (!ids.length) return
    setAllEmails(prev => prev.map(e => e.id != null && ids.includes(e.id) ? { ...e, isDeleted: true } : e))
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/delete`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_deleted: true }) })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
    setListSelectionMode(false)
    setSelectedConvIds(new Set())
  }
  const handleListEmpty = () => {
    const ids = selectedListEmailIds
    if (!ids.length) return
    setConfirmDialog({
      title: 'Delete conversations?',
      message: `Move ${ids.length} message(s) to Trash?`,
      onConfirm: handleListEmptyConfirmed,
    })
  }

  const handleListRestore = async () => {
    const ids = selectedListEmailIds
    if (!ids.length) return
    setAllEmails(prev => prev.map(e => e.id != null && ids.includes(e.id) ? { ...e, isDeleted: false } : e))
    try {
      await Promise.all(ids.map(id => fetch(`http://localhost:5050/api/emails/${id}/restore`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } })))
      window.dispatchEvent(new Event('mailRefresh'))
    } catch (err) { console.error(err) }
    setListSelectionMode(false)
    setSelectedConvIds(new Set())
  }

  const handleListToggleDeleteRestore = () => listAnyDeleted ? handleListRestore() : handleListEmpty()

  // ────────────────────────────────────────────────────────────────────────────

  const handleBackToList = () => {
    flushDraftSaveRef.current()
    isClearingRef.current = true
    hasInteractedRef.current = false

    activeDraftSessionRef.current += 1
    // Deferred until the just-queued flush's save actually runs — see the matching
    // comment in handleResetChatMail for why nulling this synchronously here would
    // make that pending save POST a duplicate draft instead of updating the real one.
    draftSaveChainRef.current = draftSaveChainRef.current.then(() => setDraftId(null))
    setReplyEmailCard(null)
    setViewMode('list')
    setSelectedConversation(null)
    setSelectedMsgIds(new Set())
    setSelectionMode(false)
    // Switching to the list view never changes navKey (same route, same contact) so the
    // navKey-driven auto-reminimize effect never fires for this specific transition —
    // minimize explicitly here instead of leaving an expanded panel behind.
    if (composeFloating && !composeFloatMinimized) {
      setComposeFloatMinimized(true)
      const pos = computeMinimizedPos(floatSlotIndex)
      if (pos) setFloatPos(pos)
    }

    // Only a true contactEmail-locked instance needs the parent to unmount/hide it via
    // onClose. composeMode alone used to also trigger this — meaning a reply/forward
    // draft (which sets composeMode) navigated back to wherever it was originally opened
    // from, while a plain draft just showed Chat Mail's own list — an inconsistency.
    // Now every draft type behaves the same way: back always shows this list.
    const returnPath = sessionStorage.getItem('chatMailReturnPath');
    const hasReturnPath = returnPath && returnPath !== '/chatmail';
    if ((contactEmail || hasReturnPath || (location.state as any)?.fromDraft) && onClose) {
      onClose()
    } else {
      if (composeMode) onComposeModeExit?.()
      requestAnimationFrame(() => {
        const lastId = lastOpenedConversationId
        if (lastId && listContainerRef.current) {
          // Scroll the last-opened item into view so the user lands right on it
          const el = listContainerRef.current.querySelector(`[data-conv-id="${lastId.replace(/"/g, '\\"')}"]`) as HTMLElement | null
          if (el) {
            el.scrollIntoView({ behavior: 'instant', block: 'nearest' })
            return
          }
        }
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop = savedListScrollPos.current
        }
      })
    }
    setTimeout(() => { isClearingRef.current = false }, 250)
  }

  const handleInputResizeDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = inputPanelHeight
    const minH = 248 + (showCc ? 40 : 0) + (showBcc ? 40 : 0)
    const onMove = (ev: MouseEvent) => {
      const dy = startY - ev.clientY
      setInputPanelHeight(Math.max(minH, Math.min(600, startH + dy)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const selectedContactName = conversations.find((c) => c.id === selectedConversation)?.name || 'Chat'
  const selectedContactEmail = conversations.find((c) => c.id === selectedConversation)?.email || ''

  // Immersive Reader in list view has no open thread to read, so it targets a conversation
  // explicitly — the one checked (if exactly one), else the last one opened, else the first
  // in the list — without disturbing the shared `messages`/`selectedConversation` state.
  const getReaderMessagesForConv = (conversationId: string | null) => {
    if (!conversationId) return []
    const contact = conversations.find(c => c.id === conversationId)
    if (!contact) return []
    const me = userEmail.toLowerCase()
    return allEmails.filter(email => {
      if (email.isDraft || email.isDeleted) return false
      if (contact.groupId) return email.groupId === contact.groupId
      const isOutgoing = email.from?.toLowerCase() === me || email.folder === 'sent'
      const rawOther = isOutgoing ? email.to : email.from
      const otherEmail = rawOther?.split(',')[0]?.trim()?.toLowerCase()
      return otherEmail === contact.email.toLowerCase()
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }
  const listReaderConvId = (listSelectionMode && selectedConvIds.size === 1 ? Array.from(selectedConvIds)[0] : null)
    ?? lastOpenedConversationId
    ?? conversations[0]?.id
    ?? null
  const listReaderConv = conversations.find(c => c.id === listReaderConvId) || null
  const listReaderMessages = getReaderMessagesForConv(listReaderConvId)

  // Broadcast conversation toolbar state to App.tsx search-bar buttons
  const _handlersRef = useRef<{
    setRead: (force?: boolean) => void; setStar: (force?: boolean) => void; setArchive: (force?: boolean) => void;
    setSpam: (force?: boolean) => void; setReport: (force?: boolean) => void; setPin: (force?: boolean) => void; setMute: (force?: boolean) => void; setDeleted: (force?: boolean) => void;
    snooze: (hours: number) => void; applyLabel: (labelName: string) => void
  }>({ setRead: () => {}, setStar: () => {}, setArchive: () => {}, setSpam: () => {}, setReport: () => {}, setPin: () => {}, setMute: () => {}, setDeleted: () => {}, snooze: () => {}, applyLabel: () => {} })
  useEffect(() => {
    _handlersRef.current = {
      setRead: (force) => { if (viewMode === 'list') { const listAllRead = selectedConvsList.length > 0 && selectedConvsList.every(c => c.isRead); handleListMarkRead(force ?? !listAllRead) } else handleConvMarkRead(force ?? !convAllRead) },
      setStar: (force) => { if (viewMode === 'list') handleListSetStar(force); else handleConvSetStar(force) },
      setArchive: (force) => { if (viewMode === 'list') handleListSetArchive(force); else handleConvSetArchive(force) },
      setSpam: (force) => { if (viewMode === 'list') handleListSetSpam(force); else handleConvSetSpam(force) },
      setReport: (force) => { if (viewMode === 'list') handleListSetReport(force); else handleConvSetReport(force) },
      setPin: (force) => { if (viewMode === 'list') handleListSetPin(force); else handleConvSetPin(force) },
      setMute: (force) => { if (viewMode === 'list') handleListSetMute(force); else handleConvSetMute(force) },
      setDeleted: (force) => {
        const deleted = force ?? !(viewMode === 'list' ? listAnyDeleted : convAnyDeleted)
        if (viewMode === 'list') { deleted ? handleListEmpty() : handleListRestore() } else { deleted ? handleConvDeleteAll() : handleConvRestore() }
      },
      snooze: (hours: number) => { if (viewMode === 'list') handleListSnoozeHours(hours); else handleConvSnoozeHours(hours) },
      applyLabel: (labelName: string) => { if (viewMode === 'list') handleListApplyLabel(labelName); else handleConvApplyLabel(labelName) },
    }
  })

  const broadcastChatMailStateRef = useRef<() => void>(() => {})
  useEffect(() => {
    broadcastChatMailStateRef.current = () => {
      const convNDel = messages.filter(m => !m.isDeleted)
      const convInc = convNDel.filter(m => m.incoming)
      const active = isActiveView && ((viewMode === 'chat' && !!selectedConversation && !composeMode) || viewMode === 'list')
      const allRead = viewMode === 'list'
        ? (selectedConvsList.length > 0 && selectedConvsList.every(c => c.isRead))
        : (convInc.length === 0 || convInc.every(m => m.isRead))
      const allUnread = viewMode === 'list'
        ? (selectedConvsList.length > 0 && selectedConvsList.every(c => !c.isRead))
        : (convInc.length > 0 && convInc.every(m => !m.isRead))
      const allStarred = viewMode === 'list'
        ? (selectedConvsList.length > 0 && selectedConvsList.every(c => c.lastEmail?.isStarred))
        : (convNDel.length > 0 && convNDel.every(m => m.isStarred))
      const allUnstarred = viewMode === 'list'
        ? (selectedConvsList.length > 0 && selectedConvsList.every(c => !c.lastEmail?.isStarred))
        : (convNDel.length > 0 && convNDel.every(m => !m.isStarred))
      const anyArchived = viewMode === 'list'
        ? selectedListEmailIds.some(id => allEmails.find(e => e.id === id)?.isArchived)
        : convNDel.some(m => m.isArchived)
      const listSelectedArchived = viewMode === 'list' ? selectedListEmailIds.map(id => allEmails.find(e => e.id === id)) : []
      const allArchived = viewMode === 'list'
        ? (listSelectedArchived.length > 0 && listSelectedArchived.every(e => e?.isArchived))
        : convAllArchived
      const allUnarchived = viewMode === 'list'
        ? (listSelectedArchived.length > 0 && listSelectedArchived.every(e => !e?.isArchived))
        : convAllUnarchived
      const allSnoozed = viewMode === 'list' ? listAllSnoozed : convAllSnoozed
      const allUnsnoozed = viewMode === 'list' ? listAllUnsnoozed : convAllUnsnoozed
      const allGrouped = viewMode === 'list' ? listAllGrouped : convAllGrouped
      const allUngrouped = viewMode === 'list' ? listAllUngrouped : convAllUngrouped
      const anySpam = viewMode === 'list' ? listAnySpam : convAnySpam
      const allSpam = viewMode === 'list' ? listAllSpam : convAllSpam
      const allUnspam = viewMode === 'list' ? listAllUnspam : convAllUnspam
      const anyReported = viewMode === 'list' ? listAnyReported : convAnyReported
      const allReported = viewMode === 'list' ? listAllReported : convAllReported
      const allUnreported = viewMode === 'list' ? listAllUnreported : convAllUnreported
      const anyPinned = viewMode === 'list' ? listAnyPinned : convAnyPinned
      const allPinned = viewMode === 'list' ? listAllPinned : convAllPinned
      const allUnpinned = viewMode === 'list' ? listAllUnpinned : convAllUnpinned
      const anyMuted = viewMode === 'list' ? listAnyMuted : convAnyMuted
      const allMuted = viewMode === 'list' ? listAllMuted : convAllMuted
      const allUnmuted = viewMode === 'list' ? listAllUnmuted : convAllUnmuted
      const anyDeleted = viewMode === 'list' ? listAnyDeleted : convAnyDeleted
      const allDeleted = viewMode === 'list' ? listAllDeleted : convAllDeleted
      const allUndeleted = viewMode === 'list' ? listAllUndeleted : convAllUndeleted
      const effectiveSelectionMode = viewMode === 'list' ? listSelectionMode : selectionMode
      const hasSelection = viewMode === 'list' ? selectedConvIds.size > 0 : selectedMsgIds.size > 0
      window.dispatchEvent(new CustomEvent('chatmail:state', {
        detail: { active, convAllRead: allRead, convAllUnread: allUnread, convAllStarred: allStarred, convAllUnstarred: allUnstarred, convAnyArchived: anyArchived, convAllArchived: allArchived, convAllUnarchived: allUnarchived, convAllSnoozed: allSnoozed, convAllUnsnoozed: allUnsnoozed, convAllGrouped: allGrouped, convAllUngrouped: allUngrouped, convAnySpam: anySpam, convAllSpam: allSpam, convAllUnspam: allUnspam, convAnyReported: anyReported, convAllReported: allReported, convAllUnreported: allUnreported, convAnyPinned: anyPinned, convAllPinned: allPinned, convAllUnpinned: allUnpinned, convAnyMuted: anyMuted, convMuted: allMuted, convAllUnmuted: allUnmuted, convAnyDeleted: anyDeleted, convAllDeleted: allDeleted, convAllUndeleted: allUndeleted, convBlocked, zoomLevel, convPinned, immersiveMode, hasDeletedMessages: messages.some(m => m.isDeleted), hideDeletedMessages, selectionMode: effectiveSelectionMode, hasSelection, viewMode, chatListTab }
      }))
    }
    broadcastChatMailStateRef.current()
  }, [messages, convMuted, convBlocked, zoomLevel, viewMode, selectedConversation, composeMode, convPinned, immersiveMode, hideDeletedMessages, selectionMode, listSelectionMode, selectedConvIds, selectedMsgIds, allEmails, conversations, isActiveView, groupedEmails, chatListTab])

  // App.tsx's listener for 'chatmail:state' may register after this component's mount
  // effect above already fired (child effects run before parent effects on first commit),
  // so the very first broadcast can be missed. Resend on request instead of relying on
  // some unrelated re-render to repair the toolbar.
  useEffect(() => {
    const handler = () => broadcastChatMailStateRef.current()
    window.addEventListener('chatmail:requestState', handler)
    return () => window.removeEventListener('chatmail:requestState', handler)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const { action, payload } = (e as CustomEvent).detail
      if (action === 'setRead') _handlersRef.current.setRead(payload)
      else if (action === 'setStar') _handlersRef.current.setStar(payload)
      else if (action === 'setArchive') _handlersRef.current.setArchive(payload)
      else if (action === 'setZoom') setZoomLevel(payload)
      else if (action === 'setMute') _handlersRef.current.setMute(payload)
      else if (action === 'setBlock') setConvBlocked(payload)
      else if (action === 'setSpam') _handlersRef.current.setSpam(payload)
      else if (action === 'setReport') _handlersRef.current.setReport(payload)
      else if (action === 'setPin') _handlersRef.current.setPin(payload)
      else if (action === 'toggleImmersive') setImmersiveMode(v => !v)
      else if (action === 'setDeleted') _handlersRef.current.setDeleted(payload)
      else if (action === 'toggleHideDeleted') setHideDeletedMessages(v => !v)
      else if (action === 'snooze') _handlersRef.current.snooze(payload)
      else if (action === 'group' || action === 'ungroup') { /* no group-picker UI yet */ }
      else if (action === 'printConv') window.print()
      else if (action === 'applyLabel') _handlersRef.current.applyLabel(payload)
    }
    window.addEventListener('chatmail:action', handler)
    return () => window.removeEventListener('chatmail:action', handler)
  }, [])

  useEffect(() => {
    return () => { window.dispatchEvent(new CustomEvent('chatmail:state', { detail: { active: false } })) }
  }, [])

  useEffect(() => {
    if (!openPenDropdown) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-pen-dropdown]') && !target.closest('[data-pen-toggle]')) {
        setOpenPenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openPenDropdown])

  return (
    <>
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column', backgroundColor: 'white', position: 'relative' }}>
      {/* Schedule Sent Notifications */}
      {scheduleNotifications.length > 0 && (
        <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 999, display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
          {scheduleNotifications.map(n => (
            <div key={n.id} style={{ backgroundColor: '#4db6ac', color: 'white', borderRadius: '20px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
              <Sparkles size={14} color="white" />
              <span>Scheduled mail sent — <span style={{ fontWeight: 400 }}>{n.subject}</span>{n.to ? ` to ${n.to}` : ''}</span>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'list' ? (
        <>
        {/* Conversation List View */}
        <div className="chat-email-list" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="chatmail-list-header" style={{ padding: '4px 12px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', backgroundColor: 'white', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Icon + name only shown in regular mode (hidden once Select is active) */}
            {!listSelectionMode && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', marginLeft: '-8px' }}>
                {chatListTab === 'all' ? (
                  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flexShrink: 0 }}>
                    <MessageSquare size={22} strokeWidth={1.5} />
                    <span className="chatmail-mail-icon chatmail-mail-gap"><Mail size={11} stroke="white" strokeWidth={2.5} /></span>
                    <span className="chatmail-mail-icon"><Mail size={11} strokeWidth={1.5} /></span>
                  </span>
                ) : folderHeaderInfo.icon}
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#444' }}>{chatListTab === 'all' ? 'Chat Mail' : folderHeaderInfo.label}</span>
              </span>
            )}
            {/* Icon + checkbox + dropdown only appear once Select is active */}
            {listSelectionMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0', flexShrink: 0 }}>
                {chatListTab === 'all' ? (
                  <span style={{ position: 'relative', left: '-6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, marginRight: '1px' }}>
                    <MessageSquare size={22} strokeWidth={1.5} />
                    <span className="chatmail-mail-icon chatmail-mail-gap"><Mail size={11} stroke="white" strokeWidth={2.5} /></span>
                    <span className="chatmail-mail-icon"><Mail size={11} strokeWidth={1.5} /></span>
                  </span>
                ) : (
                  <span style={{ position: 'relative', left: '-6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: '1px' }}>
                    {folderHeaderInfo.icon}
                  </span>
                )}
                <div className="checkbox-dropdown" style={{ position: 'relative', marginRight: '8px' }}>
                  <input
                    type="checkbox"
                    title={selectedConvIds.size === conversations.length ? 'Deselect all' : 'Select all'}
                    checked={conversations.length > 0 && selectedConvIds.size === conversations.length}
                    ref={el => { if (el) el.indeterminate = selectedConvIds.size > 0 && selectedConvIds.size < conversations.length }}
                    onChange={handleListSelectAll}
                    className="mail-checkbox"
                    style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <button
                    className="checkbox-dropdown-btn"
                    onClick={(e) => { e.stopPropagation(); setListHeaderCheckboxDropdownOpen(v => !v) }}
                    title="Filter options"
                    style={{ width: '15px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ChevronDown size={16} />
                  </button>
                  {listHeaderCheckboxDropdownOpen && (
                    <div className="checkbox-dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 10003 }} onClick={(e) => e.stopPropagation()}>
                      <button className="dropdown-option" onClick={() => handleListDropdownSelect('all')}>All</button>
                      <button className="dropdown-option" onClick={() => handleListDropdownSelect('none')}>None</button>
                      <button className="dropdown-option" onClick={() => handleListDropdownSelect('read')}>Read</button>
                      <button className="dropdown-option" onClick={() => handleListDropdownSelect('unread')}>Unread</button>
                      <button className="dropdown-option" onClick={() => handleListDropdownSelect('starred')}>Starred</button>
                      <button className="dropdown-option" onClick={() => handleListDropdownSelect('unstarred')}>Unstarred</button>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '13px', color: '#666', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap', display: 'inline-block', minWidth: '68px' }}>{selectedConvIds.size} selected</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px', flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden' }}>
              <ActionButton
                icon={
                  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, transform: 'translate(1px, 2px)' }}>
                    <span style={{ position: 'absolute', top: -0.5, left: -0.5, width: 12, height: 12, borderTop: '1.5px solid currentColor', borderLeft: '1.5px solid currentColor', borderRadius: '3px 0 0 0' }} />
                    <Square size={20} strokeWidth={1.5} />
                  </span>
                }
                label={listSelectionMode ? 'Cancel' : 'Select'}
                title={listSelectionMode ? 'Exit selection mode' : 'Select conversations'}
                active={listSelectionMode}
                activeColor="#667eea"
                hoverBg="#eeeeff"
                onClick={() => {
                  if (listSelectionMode) { setSelectedConvIds(new Set()); setListSnoozeMenuOpen(false); setListMoveMenuOpen(false) }
                  setListSelectionMode(v => !v)
                }}
              />
              <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0', flexShrink: 0, margin: '0 4px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', cursor: 'default', flexShrink: 0 }}>
                <button
                  onClick={() => fetchEmails()}
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
              {listSelectionMode && (
                <>
                  <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0', flexShrink: 0, margin: '0 4px' }} />
                  {[
                    { icon: <span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={20} strokeWidth={1.5} /><span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span>, label: 'Unread', title: 'Mark as unread', accent: '#2196f3', onClick: () => handleListMarkRead(false) },
                    { icon: <ArchiveRestore size={20} strokeWidth={1.5} />, label: 'Unarchive', title: 'Unarchive', accent: '#7986cb', onClick: () => handleListSetArchive(false) },
                    { icon: <StarOff size={20} strokeWidth={1.5} />, label: 'Unstar', title: 'Unstar', accent: '#ffc107', onClick: () => handleListSetStar(false) },
                    { icon: <AlarmClockOff size={20} strokeWidth={1.5} />, label: 'Unsnooze', title: 'Remove snooze', accent: '#fb8c00', onClick: () => handleListSnoozeHours(0) },
                    { icon: <UserMinus size={20} strokeWidth={1.5} />, label: 'Ungroup', title: 'Remove from group', accent: '#ab47bc', onClick: () => {} },
                    { icon: <RotateCcw size={20} strokeWidth={1.5} />, label: 'Restore', title: 'Restore', accent: '#f44336', onClick: () => handleListRestore() },
                    { icon: hideDeletedMessages ? <Eye size={20} strokeWidth={1.5} /> : <EyeOff size={20} strokeWidth={1.5} />, label: hideDeletedMessages ? 'Show' : 'Hide', title: hideDeletedMessages ? 'Show deleted' : 'Hide deleted', accent: '#90a4ae', onClick: () => setHideDeletedMessages(v => !v) },
                    { icon: <ShieldCheck size={20} strokeWidth={1.5} />, label: 'Unspam', title: 'Not spam', accent: '#e91e63', onClick: () => handleListSetSpam(false) },
                    { icon: <FlagOff size={20} strokeWidth={1.5} />, label: 'Unreport', title: 'Unreport', accent: '#f57c00', onClick: () => handleListSetReport(false) },
                    { icon: <PinOff size={20} strokeWidth={1.5} />, label: 'Unpin', title: 'Unpin', accent: '#f44336', onClick: () => handleListSetPin(false) },
                    { icon: <Bell size={20} strokeWidth={1.5} />, label: 'Unmute', title: 'Unmute', accent: '#7986cb', onClick: () => handleListSetMute(false) },
                    { icon: <Ban size={20} strokeWidth={1.5} />, label: 'Unblock', title: 'Unblock sender', accent: '#e53935', onClick: () => setConvBlocked(false) },
                  ].map(({ icon, label, title, accent, onClick }) => {
                    const noSelection = selectedConvIds.size === 0
                    const listAllUnread = selectedConvsList.length > 0 && selectedConvsList.every(c => !c.isRead)
                    const listAllRead = selectedConvsList.length > 0 && selectedConvsList.every(c => c.isRead)
                    const listSelectedEmails = selectedListEmailIds.map(id => allEmails.find(e => e.id === id))
                    const listAllArchived = listSelectedEmails.length > 0 && listSelectedEmails.every(e => e?.isArchived)
                    const listAllUnarchived = listSelectedEmails.length > 0 && listSelectedEmails.every(e => !e?.isArchived)
                    const listAllStarred = selectedConvsList.length > 0 && selectedConvsList.every(c => c.lastEmail?.isStarred)
                    const listAllUnstarred = selectedConvsList.length > 0 && selectedConvsList.every(c => !c.lastEmail?.isStarred)
                    const isActive = (label === 'Unread' && listAllUnread) || (label === 'Unarchive' && listAllUnarchived) || (label === 'Unstar' && listAllUnstarred) || (label === 'Unsnooze' && listAllUnsnoozed) || (label === 'Ungroup' && listAllUngrouped) || (label === 'Unspam' && listAllUnspam) || (label === 'Unreport' && listAllUnreported) || (label === 'Unpin' && listAllUnpinned) || (label === 'Unmute' && listAllUnmuted) || (label === 'Restore' && listAllUndeleted)
                    const isPartial = !noSelection && (
                      (label === 'Unread' && !listAllUnread && !listAllRead) ||
                      (label === 'Unarchive' && !listAllUnarchived && !listAllArchived) ||
                      (label === 'Unstar' && !listAllUnstarred && !listAllStarred) ||
                      (label === 'Unsnooze' && !listAllUnsnoozed && !listAllSnoozed) ||
                      (label === 'Ungroup' && !listAllUngrouped && !listAllGrouped) ||
                      (label === 'Unspam' && !listAllUnspam && !listAllSpam) ||
                      (label === 'Unreport' && !listAllUnreported && !listAllReported) ||
                      (label === 'Unpin' && !listAllUnpinned && !listAllPinned) ||
                      (label === 'Unmute' && !listAllUnmuted && !listAllMuted) ||
                      (label === 'Restore' && !listAllUndeleted && !listAllDeleted)
                    )
                    const alreadyTitle = label === 'Unread' ? 'Already unread' : label === 'Unarchive' ? 'Already unarchived' : label === 'Unstar' ? 'Already unstarred' : label === 'Unsnooze' ? 'Already unsnoozed' : label === 'Ungroup' ? 'Already ungrouped' : label === 'Unspam' ? 'Already unspammed' : label === 'Unreport' ? 'Already unreported' : label === 'Unpin' ? 'Already unpinned' : label === 'Unmute' ? 'Already unmuted' : label === 'Restore' ? 'Already restored' : ''
                    return <ActionButton key={label} icon={icon} label={label} title={noSelection ? `${title} (select conversations first)` : isActive ? alreadyTitle : isPartial ? `${title} (mixed)` : title} hoverBg={accent} activeColor="#fff" active={isActive} partial={isPartial} lightActive={label === 'Unarchive' || label === 'Unsnooze' || label === 'Ungroup' || label === 'Unspam' || label === 'Unreport' || label === 'Unpin' || label === 'Unmute' || label === 'Restore'} onClick={() => { if (!isActive) onClick() }} disabled={noSelection} />
                  })}
                </>
              )}
            </div>
          </div>

          <div ref={listContainerRef} className={`chat-list-container${listSelectionMode ? ' selection-mode' : ''}`} style={{ flex: 1, overflowY: 'auto', marginBottom: hasMinimizedStrip ? '60px' : 0 }}>
            {loading ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
                <p>Loading conversations...</p>
              </div>
            ) : tabFilteredConversations.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
                <MessageSquare size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <p>No conversations yet</p>
              </div>
            ) : (
              <>
                {tabFilteredConversations.some(c => c.lastEmail?.isPinned) && (
                  <div
                    onClick={() => setPinnedSectionCollapsed(v => !v)}
                    onMouseEnter={() => setPinnedHeaderHovered(true)}
                    onMouseLeave={() => setPinnedHeaderHovered(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: '25px',
                      margin: '4px 8px 5px 8px',
                      padding: '0 12px',
                      borderRadius: '24px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      gap: '6px',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#333',
                      position: 'sticky',
                      top: '1px',
                      zIndex: 10,
                      transition: 'padding 0.2s ease',
                      backgroundColor: pinnedHeaderHovered ? '#f9f9f9' : '#f0f0f0',
                      border: '0.5px solid #888888',
                      boxShadow: pinnedHeaderHovered ? '0 2px 8px rgba(0, 0, 0, 0.4)' : 'none',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {pinnedSectionCollapsed ? <ChevronRight size={18} style={{ color: '#999', flexShrink: 0 }} /> : <ChevronDown size={18} style={{ color: '#999', flexShrink: 0 }} />}
                    <Pin size={16} style={{ color: '#4caf50', transform: 'rotate(-45deg)', flexShrink: 0 }} />
                    <span style={{ color: '#4caf50' }}>Pinned</span>
                    <span style={{ backgroundColor: '#d4d4d4', color: '#111', fontSize: '13.5px', fontWeight: 500, padding: '1px 4px', borderRadius: '10px', flexShrink: 0, display: 'inline-block', textTransform: 'none', letterSpacing: 'normal' }}>
                      {tabFilteredConversations.filter(c => c.lastEmail?.isPinned).length}
                    </span>
                  </div>
                )}
                {tabFilteredConversations.filter(conv => !(pinnedSectionCollapsed && conv.lastEmail?.isPinned)).map((conv) => (
                <div
                  key={conv.id}
                  data-conv-id={conv.id}
                  className={`chat-email-items ${conv.unreadCount && conv.unreadCount > 0 ? 'unread' : ''} ${conv.isSent ? 'sent' : ''} ${conv.isDraft ? 'draft' : ''} ${conv.isScheduled ? 'scheduled' : ''} ${conv.id === lastOpenedConversationId ? 'active' : ''} ${selectedConvIds.has(conv.id) ? 'selected' : ''}`}
                  style={listSelectionMode && selectedConvIds.has(conv.id) ? { backgroundColor: '#eef2ff' } : undefined}
                  onClick={() => {
                    if (listSelectionMode) { handleListToggleConv(conv.id); return }
                    savedListScrollPos.current = listContainerRef.current?.scrollTop ?? 0
                    // Opening a conversation thread (not a draft) is delegated to the parent
                    // so it mounts as its own isolated instance — otherwise, while a draft is
                    // floating in this (shared) instance, switching conversations here would
                    // overwrite that floating draft's To/subject/body with this conversation's
                    // data instead of leaving it untouched.
                    // A draft with a valid recipient gets re-keyed by groupEmailsByContact to a
                    // contact-email id (not "draft_...") after any refetch — but if it's the
                    // SAME draft currently active/floating in this instance, it must still be
                    // handled locally, not delegated to a separate contact instance (that would
                    // split one draft into two divergent views of the same data).
                    const isOwnActiveDraft = (draftIdRef.current != null && conv.draftEmail?.id === draftIdRef.current) || (composeFloating && floatingDraftIdRef.current != null && conv.draftEmail?.id === floatingDraftIdRef.current)
                    // A draft started from within a contact's thread (e.g. a per-message
                    // "Forward" card) floats inside THAT contact's own instance — even though
                    // it shows up here as a standalone "draft_..." item (no recipient yet).
                    // Reopening it must delegate to that same contact instance instead of this
                    // (main) instance trying to handle a draft it never actually owned.
                    const floatOwner = conv.draftEmail?.id != null ? getFloatingDraftOwner?.(conv.draftEmail.id) : undefined
                    const ownedByOtherContact = floatOwner != null && floatOwner !== contactEmail
                    if (((!conv.id.startsWith('draft_') && !isOwnActiveDraft) || ownedByOtherContact) && !contactEmail && onOpenContact) {
                      setLastOpenedConversationId(conv.id)
                      onOpenContact(ownedByOtherContact ? floatOwner! : conv.email)
                      return
                    }
                    setLastOpenedConversationId(conv.id)
                    flushDraftSaveRef.current()
                  isClearingRef.current = true
                    hasInteractedRef.current = false
                    activeDraftSessionRef.current += 1
                    if (conv.id.startsWith('draft_')) {
                      const d = conv.draftEmail!
                      // Captured BEFORE setDraftId below mutates draftIdRef — this tells us
                      // whether the draft being opened IS the one currently floating-minimized
                      // in this same (main, non-contact) instance, so we can auto-expand it
                      // instead of leaving the user staring at an inline view while their
                      // actual draft stays collapsed.
                      const wasFloatingThisDraft = composeFloating && composeFloatMinimized && floatingDraftIdRef.current === ((d.id && d.id > 0) ? d.id : null)
                      const _dSubjectRaw = d.subject === '(No subject)' ? '' : d.subject || ''
                      const _dRawBody = d.body === '(No content)' || d.body === '(no content)' ? '' : d.body || ''
                      if (canvasMode) closeCanvasMode(true)
                      const { userText: _dUserText, card: _dCard } = parseReplyDraft(_dRawBody, _dSubjectRaw)
                      const loadedTo = d.to ? d.to.split(',').map(e => e.trim()).filter(Boolean) : []
                      setToEmails(loadedTo)
                      setInitialToEmails(loadedTo)
                      setSubjectValue(_dSubjectRaw)
                      setInputValue(_dUserText)
                      if (d.cc) { setCcEmails(d.cc.split(',').map(e => e.trim()).filter(Boolean)); setShowCc(true) } else { setCcEmails([]); setShowCc(false) }
                      if (d.bcc) { setBccEmails(d.bcc.split(',').map(e => e.trim()).filter(Boolean)); setShowBcc(true) } else { setBccEmails([]); setShowBcc(false) }
                      setCcInput('')
                      setBccInput('')
                      setToInput('')
                      setMessageSent(false)
                      setDraftId((d.id && d.id > 0) ? d.id : null)
                      setReplyEmailCard(_dCard)
                      if (_dCard) hasInteractedRef.current = true
                      setSelectedConversation(null)
                      setViewMode('chat')
                      if (wasFloatingThisDraft) {
                        setComposeFloatMinimized(false)
                        const w = floatSize?.width ?? 760
                        const h = floatSize?.height ?? 720
                        // Safe top-right corner — clamping the minimized strip's
                        // left-anchored position instead would cover this view's back
                        // arrow/header.
                        setFloatPos(computeSafeExpandPos(w))
                      }
                    } else {
                      // Captured before setDraftId below mutates draftIdRef — see the matching
                      // comment in the draft_-branch above for why this drives auto-expand.
                      const wasFloatingThisConvDraft = composeFloating && composeFloatMinimized && floatingDraftIdRef.current != null && conv.draftEmail?.id === floatingDraftIdRef.current
                      setSelectedConversation(conv.id)
                      if (conv.draftEmail) {
                        const d = conv.draftEmail
                        const loadedTo = d.to ? d.to.split(',').map(e => e.trim()).filter(Boolean) : [conv.email]
                        setToEmails(loadedTo)
                        setInitialToEmails(loadedTo)
                        const _ccSubject = d.subject === '(No subject)' ? '' : d.subject || ''
                        const _ccRawBodyFull = d.body === '(No content)' || d.body === '(no content)' ? '' : d.body || ''
                        if (canvasMode) closeCanvasMode(true)
                        const { userText: _ccUserText, card: _ccCard } = parseReplyDraft(_ccRawBodyFull, _ccSubject)
                        // If DB body is empty, fall back to sessionStorage content for the same draft
                        const _savedDraftId = parseInt(sessionStorage.getItem('chat_draftId') || '0')
                        const _savedBody = sessionStorage.getItem('chat_inputValue') || ''
                        const _bodyToUse = _ccUserText || (_savedDraftId > 0 && d.id != null && _savedDraftId === d.id && _savedBody ? _savedBody : '')
                        setSubjectValue(_ccSubject)
                        setInputValue(_bodyToUse)
                        setReplyEmailCard(_ccCard)
                        if (_ccCard) hasInteractedRef.current = true
                        if (d.cc) { setCcEmails(d.cc.split(',').map(e => e.trim()).filter(Boolean)); setShowCc(true) } else { setCcEmails([]); setShowCc(false) }
                        if (d.bcc) { setBccEmails(d.bcc.split(',').map(e => e.trim()).filter(Boolean)); setShowBcc(true) } else { setBccEmails([]); setShowBcc(false) }
                        setCcInput('')
                        setBccInput('')
                        setToInput('')
                        setMessageSent(false)
                        setDraftId((d.id && d.id > 0) ? d.id : null)
                      } else {
                        setToEmails([conv.email])
                        setToInput('')
                        setSubjectValue('')
                        setInputValue('')
                        setCcEmails([])
                        setBccEmails([])
                        setCcInput('')
                        setBccInput('')
                        setShowCc(false)
                        setShowBcc(false)
                        setMessageSent(false)
                        setDraftId(null)
                        setReplyEmailCard(null)
                        setInputPanelHeight(248)
                      }
                      setViewMode('chat')
                      if (wasFloatingThisConvDraft) {
                        setComposeFloatMinimized(false)
                        const w = floatSize?.width ?? 760
                        const h = floatSize?.height ?? 720
                        // Safe top-right corner — clamping the minimized strip's
                        // left-anchored position instead would cover this view's back
                        // arrow/header.
                        setFloatPos(computeSafeExpandPos(w))
                      }
                    }
                    setTimeout(() => { isClearingRef.current = false }, 250)
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', paddingRight: (/data-file-card/i.test((livePreview !== null && (conv.id === lastOpenedConversationId || conv.id === selectedConversation) ? livePreview.body : (conv.lastEmail ?? conv.draftEmail)?.body ?? '')) || conv.lastEmail?.hasAttachments) ? '205px' : '68px' }}>
                    <div
                      className="chat-checkbox-wrapper"
                      style={{ position: 'relative', width: '40px', height: '40px', flexShrink: 0, marginLeft: '10px', cursor: listSelectionMode ? 'pointer' : 'inherit' }}
                      onClick={listSelectionMode ? (e) => { e.stopPropagation(); handleListToggleConv(conv.id) } : undefined}
                    >
                      <div className="chat-profile-icon" style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: conv.groupId ? '#7b5ea7' : getAvatarColor(conv.email), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '15px' }}>
                        {conv.groupId ? <Users size={18} /> : getAvatarInitials(conv.email)}
                      </div>
                      <span className="chat-checkbox-icon" style={{ position: 'absolute', top: 0, left: 0, width: '40px', height: '40px' }}>
                        {selectedConvIds.has(conv.id) ? <CheckSquare size={18} style={{ color: '#1a73e8' }} /> : <Square size={18} style={{ color: '#999' }} />}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', padding: '0px 0' }}>
                      {/* Email address — top */}
                      {(() => {
                        const hasUnread = !!(conv.unreadCount && conv.unreadCount > 0)
                        const hasDraftItem = conv.isDraft || !!conv.draftEmail
                        const nameColor = hasDraftItem ? '#e53935' : (hasUnread ? '#0288d1' : '#111')
                        const domainColor = hasDraftItem ? '#e53935' : (hasUnread ? '#0288d1' : '#555')
                        return (
                          <div style={{ fontSize: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.3', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {conv.groupId ? (
                                <span style={{ fontWeight: 600, color: nameColor }}>{conv.name}</span>
                              ) : (
                                <>
                                  <span style={{ fontWeight: 600, color: nameColor }}>{conv.email.split('@')[0]}</span>
                                  {conv.email.includes('@') && <span style={{ fontWeight: 300, color: domainColor }}>@{conv.email.split('@')[1]}</span>}
                                </>
                              )}
                            </span>
                            {conv.lastEmail?.isPinned && (
                              <Pin size={14} style={{ color: '#4caf50', flexShrink: 0, transform: 'rotate(-45deg)' }} title="Pinned" />
                            )}
                          </div>
                        )
                      })()}
                      {/* Subject + Message — separate lines, only if present */}
                      {(() => {
                        const isLive = livePreview !== null && (conv.id === lastOpenedConversationId || conv.id === selectedConversation)
                        // prefer draftEmail so a saved reply-draft immediately overwrites the old lastEmail preview
                        const hasDraft = !isLive && !!conv.draftEmail
                        const storedSrc = hasDraft ? conv.draftEmail! : (conv.lastEmail ?? conv.draftEmail)
                        const displaySubject = isLive ? livePreview!.subject : storedSrc?.subject
                        const displayPreview = isLive
                          ? bodyPreview(livePreview!.body, livePreview!.hasAttachments, livePreview!.hasCanvas)
                          : bodyPreview(storedSrc?.body ?? '', storedSrc?.hasAttachments)
                        const showDraftLabel = isLive ? true : hasDraft || conv.isDraft
                        const attBody = isLive ? livePreview!.body : storedSrc?.body ?? ''
                        const hasAtts = isLive
                          ? (!!livePreview!.hasAttachments || /data-file-card/i.test(livePreview!.body))
                          : (!!storedSrc?.hasAttachments || /data-file-card/i.test(attBody))
                        // Was scheduled but its send time has already passed — matches
                        // AllMailsPage's getFolderIcon "Scheduled Sent" badge distinction.
                        const wasScheduledNowSent = !showDraftLabel && !conv.isScheduled && !!storedSrc?.scheduledFor && new Date(storedSrc.scheduledFor).getTime() <= Date.now()
                        // Matches AllMailsPage's per-row getFolderIcon label badge (outline
                        // Folder for parent labels with sub-labels, outline Tag for leaf labels).
                        // When viewing a label-filtered tab, show the label that actually matched
                        // this conversation into that tab, not just the most recent message's label
                        // — a conversation can have different messages under different labels.
                        const currentLabelFilter = chatListTab.startsWith('label:') ? chatListTab.slice('label:'.length) : null
                        const currentLabelNode = currentLabelFilter ? flattenLabelsTree(customLabels).find(l => l.fullPath === currentLabelFilter) : null
                        const rowLabelName = currentLabelFilter
                          ? (getConvEmailIds(conv).map(id => allEmails.find(e => e.id === id)).find(e => e?.label_name === currentLabelFilter || (!!currentLabelNode?.hasChildren && !!e?.label_name?.startsWith(currentLabelFilter + ' / ')))?.label_name ?? storedSrc?.label_name)
                          : storedSrc?.label_name
                        const rowLabelInfo = rowLabelName ? flattenLabelsTree(customLabels).find(l => l.fullPath === rowLabelName || l.leafName === rowLabelName.split(' / ').pop()) : null
                        const rowLabelColor = rowLabelInfo?.color || '#999'
                        return (
                          <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                              {showDraftLabel ? (
                                <span style={{ color: '#ff5722', fontWeight: 700, flexShrink: 0 }}>Draft:</span>
                              ) : conv.isScheduled ? (
                                <span style={{ color: '#4db6ac', fontWeight: 700, flexShrink: 0 }}>Scheduled:</span>
                              ) : conv.isSent ? (
                                <>
                                  {wasScheduledNowSent && <span title="Scheduled Sent" className="active-scheduled-sent-icon-bg" style={{ width: '16px', height: '16px', backgroundSize: '16px 16px', margin: 0, flexShrink: 0 }} />}
                                  <span style={{ color: '#ff9800', fontWeight: 700, flexShrink: 0 }}>You:</span>
                                </>
                              ) : null}
                              {rowLabelName && (
                                rowLabelInfo?.hasChildren
                                  ? <Folder size={14} title={rowLabelName} style={{ color: rowLabelColor, stroke: rowLabelColor, fill: 'none', flexShrink: 0 }} />
                                  : <Tag size={14} title={rowLabelName} style={{ color: rowLabelColor, stroke: rowLabelColor, fill: 'none', flexShrink: 0 }} />
                              )}
                              {hasAtts && <Paperclip size={13} style={{ color: '#888', flexShrink: 0, marginRight: '2px' }} />}
                              {displaySubject && displaySubject !== '(No subject)' ? (
                                <span style={{
                                  color: conv.isSent ? '#222' : !conv.isRead ? '#0288d1' : '#222',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                }}>
                                  {displaySubject}
                                </span>
                              ) : (
                                <span style={{
                                  color: '#aaa',
                                  fontStyle: 'italic',
                                  fontWeight: 400,
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                }}>
                                  No subject
                                </span>
                              )}
                              {displayPreview && (
                                <span style={{
                                  color: '#888',
                                  fontWeight: 400,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  flexShrink: 1,
                                }}>
                                  - {displayPreview}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                  <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '50px' }}>
                    {/* LEFT: file/folder cards */}
                    {(() => {
                      const _isLive = livePreview !== null && (conv.id === lastOpenedConversationId || conv.id === selectedConversation)
                      const _hasDraft = !_isLive && !!conv.draftEmail
                      const _src = _hasDraft ? conv.draftEmail! : (conv.lastEmail ?? conv.draftEmail)
                      const _body = _isLive ? livePreview!.body : _src?.body ?? ''
                      const _hasAtts = _isLive
                        ? (!!livePreview!.hasAttachments || /data-file-card/i.test(_body))
                        : (!!_src?.hasAttachments || /data-file-card/i.test(_body))
                      if (!_hasAtts) return null
                      const _cardHtmls: string[] = (() => {
                        try {
                          const doc = new DOMParser().parseFromString(`<div>${_body}</div>`, 'text/html')
                          return Array.from(doc.querySelectorAll('[data-file-card]')).map(el => {
                            el.querySelectorAll('[data-remove-file],[data-upload-overlay],[data-folder-progress]').forEach(x => x.remove())
                            el.removeAttribute('contenteditable')
                            return el.outerHTML
                          })
                        } catch { return [] }
                      })()
                      if (!_cardHtmls.length) return null
                      const _hidden = _cardHtmls.length - 1
                      const _fileName = (() => {
                        const m = /data-attachment="([^"]+)"/.exec(_cardHtmls[0])
                        if (!m) return ''
                        try { return decodeURIComponent(m[1]) } catch { return '' }
                      })()
                      const _fileBadge = _fileName ? getFileTypeInfo(_fileName) : { label: null, bg: '#ebebeb', color: '#888', borderColor: '#ddd' }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'row', gap: '4px', alignItems: 'center' }}>
                          <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                            <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: _cardHtmls[0] }} />
                            {_fileBadge.label && (
                              <span style={{ position: 'absolute', top: 5, left: 5, padding: '0 5px', borderRadius: '3px', backgroundColor: _fileBadge.color, color: '#fff', fontSize: '9px', fontWeight: 700, lineHeight: '15px', fontFamily: '-apple-system, sans-serif', flexShrink: 0 }}>
                                {_fileBadge.label}
                              </span>
                            )}
                          </div>
                          {_hidden > 0 && (
                            <span title={`+${_hidden} more`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#666', background: '#e0e0e0', borderRadius: '50%', width: '44px', height: '44px', flexShrink: 0 }}>
                              +{_hidden}
                            </span>
                          )}
                        </div>
                      )
                    })()}
                    {/* RIGHT: date on top, badges below */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                      {(conv.nextScheduledEmail || conv.lastEmail)?.scheduledFor ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#4db6ac', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                          <span className={new Date((conv.nextScheduledEmail || conv.lastEmail)!.scheduledFor!).getTime() <= now ? "active-scheduled-sent-icon-bg" : "active-scheduled-icon-bg"} style={{ width: '11px', height: '11px', backgroundSize: '11px 11px', margin: 0, flexShrink: 0 }} />
                          {(() => {
                            const targetEmail = conv.nextScheduledEmail || conv.lastEmail;
                            const scheduledDate = new Date(targetEmail!.scheduledFor!);
                            const nowTime = new Date(now);
                            const time = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                            const isToday = scheduledDate.getFullYear() === nowTime.getFullYear()
                              && scheduledDate.getMonth() === nowTime.getMonth()
                              && scheduledDate.getDate() === nowTime.getDate();
                            let dateStr = '';
                            if (isToday) { dateStr = `Today ${time}`; } else {
                              const day = scheduledDate.getDate();
                              const month = scheduledDate.toLocaleString('default', { month: 'short' });
                              dateStr = scheduledDate.getFullYear() === nowTime.getFullYear() ? `${day} ${month} ${nowTime.getFullYear()}` : `${day} ${month} ${scheduledDate.getFullYear()}`;
                              dateStr = `${dateStr} ${time}`;
                            }
                            if (scheduledDate.getTime() <= nowTime.getTime()) {
                              return <>{dateStr} <span style={{ opacity: 0.7, fontWeight: 400 }}>· {getTimeAgo(targetEmail!.scheduledFor)}</span></>;
                            }
                            return dateStr;
                          })()}
                        </span>
                      ) : conv.isDraft ? (
                        <span style={{ fontSize: '13px', color: '#ff5722', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {getTimeAgo(conv.draftEmail?.date)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '13px', color: conv.draftEmail ? '#e53935' : (conv.unreadCount && conv.unreadCount > 0) ? '#0288d1' : conv.isSent ? '#222' : '#666', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {conv.lastEmail?.date ? (() => {
                            const d = new Date(conv.lastEmail!.date)
                            const nowTime = new Date()
                            const isToday = d.toDateString() === nowTime.toDateString()
                            return isToday
                              ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                              : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          })() : ''}
                        </span>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px' }}>
                        {conv.nextScheduledEmail?.scheduledFor && new Date(conv.nextScheduledEmail.scheduledFor).getTime() > Date.now() && (
                          <div style={{ width: '40px', height: '4px', backgroundColor: '#b2dfdb', borderRadius: '2px', overflow: 'hidden', marginRight: '4px' }}>
                            <div style={{ height: '100%', animation: `schedule-progress ${Math.max(0, new Date(conv.nextScheduledEmail.scheduledFor).getTime() - new Date(conv.nextScheduledEmail.date).getTime())}ms linear forwards`, animationDelay: `-${Math.max(0, Date.now() - new Date(conv.nextScheduledEmail.date).getTime())}ms` }} />
                          </div>
                        )}
                        {conv.upcomingScheduledCount && conv.upcomingScheduledCount > 0 && (
                          <div style={{ backgroundColor: '#fb8c00', color: 'white', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0 }} title="Upcoming scheduled messages">
                            {conv.upcomingScheduledCount}
                          </div>
                        )}
                        {conv.unreadCount && conv.unreadCount > 0 && (
                          <div style={{ backgroundColor: '#2196f3', color: 'white', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 'bold', display: 'inline-block', flexShrink: 0 }}>
                            {conv.unreadCount}
                          </div>
                        )}
                        {conv.totalCount && conv.totalCount > 0 && (
                          <div style={{ backgroundColor: '#d4d4d4', color: '#111', borderRadius: '10px', padding: '1px 4px', fontSize: '13.5px', fontWeight: 500, display: 'inline-block', flexShrink: 0 }}>
                            {conv.totalCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                ))}
              </>
            )}
          </div>
        </div>
        {immersiveMode && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '720px', maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <BookOpen size={18} color="#4db6ac" />
                <span style={{ fontWeight: 600, fontSize: '15px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Immersive Reader{listReaderConv ? ` — ${listReaderConv.name || listReaderConv.email}` : ''}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {[80, 90, 100, 110, 125].map(lv => <button key={lv} onClick={() => setZoomLevel(lv)} style={{ padding: '2px 7px', borderRadius: '4px', border: '1px solid #ddd', background: zoomLevel === lv ? '#e3f2fd' : 'white', color: zoomLevel === lv ? '#2196f3' : '#666', fontSize: '11px', cursor: 'pointer' }}>{lv}%</button>)}
                </div>
                <button onClick={() => setImmersiveMode(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', color: '#666' }}><XIcon size={18} /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 36px', display: 'flex', flexDirection: 'column', gap: '24px', lineHeight: 1.8, fontFamily: 'Georgia, serif', fontSize: `${zoomLevel}%` }}>
                {listReaderMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#999', marginTop: '40px' }}>No conversation to read yet</div>
                ) : listReaderMessages.map(email => {
                  const incoming = !(email.from?.toLowerCase() === userEmail.toLowerCase() || email.folder === 'sent')
                  // Matches the full thread view's per-message label pill — the reader pane
                  // is a separate, simpler render path that was missing this entirely.
                  const labelName = email.label_name
                  const flatLabel = labelName ? flattenLabelsTree(customLabels).find(l => l.fullPath === labelName) : null
                  const labelColor = flatLabel?.color || '#888'
                  const labelLeafName = flatLabel?.leafName || labelName?.split(' / ').pop() || labelName
                  return (
                    <div key={email.id} style={{ maxWidth: '580px', alignSelf: incoming ? 'flex-start' : 'flex-end' }}>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px', textAlign: incoming ? 'left' : 'right' }}>
                        {incoming ? (listReaderConv?.email || 'Contact') : userEmail} · {new Date(email.date).toLocaleString()}
                      </div>
                      {email.subject && <div style={{ fontWeight: 700, marginBottom: '6px', color: '#222' }}>{email.subject}</div>}
                      <div style={{ whiteSpace: 'pre-wrap', color: '#222', background: incoming ? '#f5f5f5' : '#e3f2fd', padding: '12px 16px', borderRadius: '8px' }}>{email.body}</div>
                      {labelName && (
                        <div style={{ display: 'flex', justifyContent: incoming ? 'flex-start' : 'flex-end', marginTop: '6px' }}>
                          <span title={labelName} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: labelColor, background: `${labelColor}18`, border: `1px solid ${labelColor}55`, borderRadius: '10px', padding: '2px 7px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {flatLabel?.hasChildren
                              ? <Folder size={11} style={{ flexShrink: 0, stroke: labelColor, fill: 'none' }} />
                              : <Tag size={11} style={{ flexShrink: 0, stroke: labelColor }} />}
                            {labelLeafName}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
        </>
      ) : (
        // Chat Window View
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', overflow: 'hidden', marginBottom: hasMinimizedStrip ? '60px' : 0 }}>
          {/* Header with Back Button + Toolbar */}
          <div className="chatmail-thread-header" style={{ padding: '4px 12px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <button onClick={handleBackToList} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#2196f3', flexShrink: 0 }}>
              <ArrowLeft size={20} />
            </button>
            {/* Select-all checkbox */}
            {(() => {
              const selectableMsgs = messages.filter(m => !m.isDeleted && m.emailId)
              const allSelected = selectableMsgs.length > 0 && selectableMsgs.every(m => selectedMsgIds.has(m.emailId!))
              const someSelected = selectableMsgs.some(m => selectedMsgIds.has(m.emailId!))
              return (
                <input
                  type="checkbox"
                  title={allSelected ? 'Deselect all' : 'Select all'}
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                  onChange={() => {
                    if (allSelected) {
                      setSelectedMsgIds(new Set())
                    } else {
                      setSelectedMsgIds(new Set(selectableMsgs.map(m => m.emailId!)))
                    }
                  }}
                  style={{ width: '15px', height: '15px', cursor: 'pointer', flexShrink: 0, accentColor: '#667eea', display: selectionMode ? 'inline-block' : 'none' }}
                />
              )
            })()}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
              {(() => {
                const displayEmail = selectedContactEmail || toEmails[0] || toInput || ''
                if (displayEmail) return <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: getAvatarColor(displayEmail), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '13px', flexShrink: 0 }}>{getAvatarInitials(displayEmail)}</div>
                return <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#e0e0e0', flexShrink: 0 }} />
              })()}
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(() => {
                  const displayEmail = selectedContactEmail || toEmails[0] || toInput || ''
                  if (displayEmail.includes('@')) {
                    const [name, domain] = displayEmail.split('@')
                    return <><span style={{ fontWeight: 600, color: '#111' }}>{name}</span><span style={{ fontWeight: 300, color: '#555' }}>@{domain}</span>{toEmails.length > 1 && <span style={{ fontSize: '12px', color: '#888', fontWeight: 400, marginLeft: '4px' }}>+{toEmails.length - 1}</span>}</>
                  }
                  return <span style={{ color: displayEmail ? '#111' : '#999' }}>{displayEmail || 'New Message'}</span>
                })()}
              </h2>
              {convAnyPinned && (
                <Pin size={16} style={{ color: '#4caf50', flexShrink: 0, transform: 'rotate(-45deg)' }} title="Pinned" />
              )}
            </div>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1px', flexShrink: 0 }}>

              {/* Select button */}
              <ActionButton
                icon={
                  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, transform: 'translate(1px, 2px)' }}>
                    <span style={{ position: 'absolute', top: -0.5, left: -0.5, width: 12, height: 12, borderTop: '1.5px solid currentColor', borderLeft: '1.5px solid currentColor', borderRadius: '3px 0 0 0' }} />
                    <Square size={20} strokeWidth={1.5} />
                  </span>
                }
                label={selectionMode ? 'Cancel' : 'Select'}
                title={selectionMode ? 'Exit selection mode' : 'Select messages'}
                active={selectionMode}
                activeColor="#667eea"
                hoverBg="#eeeeff"
                onClick={() => {
                  setSelectionMode(v => !v)
                  if (selectionMode) setSelectedMsgIds(new Set())
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', cursor: 'default', flexShrink: 0 }}>
                <button
                  onClick={() => fetchEmails()}
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

              {/* Show/Hide deleted + Restore — always visible whenever this conversation has
                  any deleted message, independent of selection mode (view controls, not bulk
                  actions tied to a selection). */}
              {convAnyDeleted && (
                <>
                  <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0', flexShrink: 0, margin: '0 4px' }} />
                  <ActionButton
                    icon={hideDeletedMessages ? <Eye size={20} strokeWidth={1.5} /> : <EyeOff size={20} strokeWidth={1.5} />}
                    label={hideDeletedMessages ? 'Show' : 'Hide'}
                    title={hideDeletedMessages ? 'Show deleted' : 'Hide deleted'}
                    hoverBg="#90a4ae"
                    onClick={() => setHideDeletedMessages(v => !v)}
                  />
                  <ActionButton
                    icon={<RotateCcw size={20} strokeWidth={1.5} />}
                    label="Restore"
                    title="Restore"
                    hoverBg="#f44336"
                    onClick={() => handleConvRestore()}
                  />
                </>
              )}

              {selectionMode && (
                <>
                  <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0', flexShrink: 0, margin: '0 4px' }} />
                  {[
                    { icon: <span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={20} strokeWidth={1.5} /><span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span>, label: 'Unread', title: 'Mark as unread', accent: '#2196f3', onClick: () => handleConvMarkRead(false) },
                    { icon: <ArchiveRestore size={20} strokeWidth={1.5} />, label: 'Unarchive', title: 'Unarchive', accent: '#7986cb', onClick: () => handleConvSetArchive(false) },
                    { icon: <StarOff size={20} strokeWidth={1.5} />, label: 'Unstar', title: 'Unstar', accent: '#ffc107', onClick: () => handleConvSetStar(false) },
                    { icon: <AlarmClockOff size={20} strokeWidth={1.5} />, label: 'Unsnooze', title: 'Remove snooze', accent: '#fb8c00', onClick: () => handleConvSnoozeHours(0) },
                    { icon: <UserMinus size={20} strokeWidth={1.5} />, label: 'Ungroup', title: 'Remove from group', accent: '#ab47bc', onClick: () => {} },
                    { icon: <ShieldCheck size={20} strokeWidth={1.5} />, label: 'Unspam', title: 'Not spam', accent: '#e91e63', onClick: () => handleConvSetSpam(false) },
                    { icon: <FlagOff size={20} strokeWidth={1.5} />, label: 'Unreport', title: 'Unreport', accent: '#f57c00', onClick: () => handleConvSetReport(false) },
                    { icon: <PinOff size={20} strokeWidth={1.5} />, label: 'Unpin', title: 'Unpin', accent: '#f44336', onClick: () => handleConvSetPin(false) },
                    { icon: <Bell size={20} strokeWidth={1.5} />, label: 'Unmute', title: 'Unmute', accent: '#7986cb', onClick: () => handleConvSetMute(false) },
                    { icon: <Ban size={20} strokeWidth={1.5} />, label: 'Unblock', title: 'Unblock sender', accent: '#e53935', onClick: () => setConvBlocked(false) },
                  ].map(({ icon, label, title, accent, onClick }) => {
                    const noSelection = selectedMsgIds.size === 0
                    const isActive = (label === 'Unread' && convAllUnread) || (label === 'Unarchive' && convAllUnarchived) || (label === 'Unstar' && convAllUnstarred) || (label === 'Unsnooze' && convAllUnsnoozed) || (label === 'Ungroup' && convAllUngrouped) || (label === 'Unspam' && convAllUnspam) || (label === 'Unreport' && convAllUnreported) || (label === 'Unpin' && convAllUnpinned) || (label === 'Unmute' && convAllUnmuted)
                    const isPartial = !noSelection && (
                      (label === 'Unread' && !convAllUnread && !convAllRead) ||
                      (label === 'Unarchive' && !convAllUnarchived && !convAllArchived) ||
                      (label === 'Unstar' && !convAllUnstarred && !convAllStarred) ||
                      (label === 'Unsnooze' && !convAllUnsnoozed && !convAllSnoozed) ||
                      (label === 'Ungroup' && !convAllUngrouped && !convAllGrouped) ||
                      (label === 'Unspam' && !convAllUnspam && !convAllSpam) ||
                      (label === 'Unreport' && !convAllUnreported && !convAllReported) ||
                      (label === 'Unpin' && !convAllUnpinned && !convAllPinned) ||
                      (label === 'Unmute' && !convAllUnmuted && !convAllMuted)
                    )
                    const alreadyTitle = label === 'Unread' ? 'Already unread' : label === 'Unarchive' ? 'Already unarchived' : label === 'Unstar' ? 'Already unstarred' : label === 'Unsnooze' ? 'Already unsnoozed' : label === 'Ungroup' ? 'Already ungrouped' : label === 'Unspam' ? 'Already unspammed' : label === 'Unreport' ? 'Already unreported' : label === 'Unpin' ? 'Already unpinned' : label === 'Unmute' ? 'Already unmuted' : ''
                    return <ActionButton key={label} icon={icon} label={label} title={noSelection ? `${title} (select messages first)` : isActive ? alreadyTitle : isPartial ? `${title} (mixed)` : title} hoverBg={accent} activeColor="#fff" active={isActive} partial={isPartial} lightActive={label === 'Unarchive' || label === 'Unsnooze' || label === 'Ungroup' || label === 'Unspam' || label === 'Unreport' || label === 'Unpin' || label === 'Unmute'} onClick={() => { if (!isActive) onClick() }} disabled={noSelection} />
                  })}
                </>
              )}

            </div>
          </div>
          {/* Immersive Reader Overlay */}
          {immersiveMode && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '720px', maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <BookOpen size={18} color="#4db6ac"/>
                  <span style={{ fontWeight: 600, fontSize: '15px', flex: 1 }}>Immersive Reader</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {[80,90,100,110,125].map(lv => <button key={lv} onClick={() => setZoomLevel(lv)} style={{ padding: '2px 7px', borderRadius: '4px', border: '1px solid #ddd', background: zoomLevel===lv?'#e3f2fd':'white', color: zoomLevel===lv?'#2196f3':'#666', fontSize: '11px', cursor: 'pointer' }}>{lv}%</button>)}
                  </div>
                  <button onClick={() => setImmersiveMode(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', color: '#666' }}><XIcon size={18}/></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 36px', display: 'flex', flexDirection: 'column', gap: '24px', lineHeight: 1.8, fontFamily: 'Georgia, serif', fontSize: `${zoomLevel}%` }}>
                  {messages.filter(m => !m.isDeleted).map(msg => (
                    <div key={msg.id} style={{ maxWidth: '580px', alignSelf: msg.incoming ? 'flex-start' : 'flex-end' }}>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px', textAlign: msg.incoming ? 'left' : 'right' }}>
                        {msg.incoming ? (selectedContactEmail||'Contact') : userEmail} · {msg.date ? new Date(msg.date).toLocaleString() : msg.timestamp}
                      </div>
                      {msg.subject && <div style={{ fontWeight: 700, marginBottom: '6px', color: '#222' }}>{msg.subject}</div>}
                      <div style={{ whiteSpace: 'pre-wrap', color: '#222', background: msg.incoming ? '#f5f5f5' : '#e3f2fd', padding: '12px 16px', borderRadius: '8px' }}>{msg.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="chatmail-thread-messages"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 10px 48px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              minHeight: 0,
              zoom: zoomLevel !== 100 ? zoomLevel / 100 : undefined,
            }}
          >
            {messages.filter(msg => !(hideDeletedMessages && msg.isDeleted)).map((msg, index, filteredArr) => {
              const msgDate = msg.date ? new Date(msg.date) : null
              const prevDate = index > 0 && filteredArr[index - 1].date ? new Date(filteredArr[index - 1].date!) : null
              const showDateSeparator = msgDate && (
                !prevDate ||
                msgDate.toDateString() !== prevDate.toDateString()
              )
              const dateSeparatorLabel = (() => {
                if (!msgDate) return null
                const today = new Date()
                const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
                if (msgDate.toDateString() === today.toDateString()) return 'Today'
                if (msgDate.toDateString() === yesterday.toDateString()) return 'Yesterday'
                const sameYear = msgDate.getFullYear() === today.getFullYear()
                return msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(!sameYear ? { year: 'numeric' } : {}) })
              })()

              const isReplierMsg = msg.content.includes('--- Original Message ---') || msg.content.includes('---------- Forwarded message ---------');
              const isFwdMsg = (msg.subject ? /^(Fwd:|Fw:)\s/i.test(msg.subject.trim()) : false) || msg.content.includes('---------- Forwarded message ---------');
              const activeAction = replyEmailCard?.sourceMessageId === msg.id ? replyEmailCard.action : (isFwdMsg ? 'forward' : isReplierMsg ? 'reply' : null);
              const isHighlightedUnread = msg.emailId === highlightedEmailId && !msg.isRead && msg.incoming && !msg.isDeleted;

              return (
              <div key={msg.id} data-msg-id={msg.id}>
              {showDateSeparator && dateSeparatorLabel && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0 12px' }}>
                  <span style={{ backgroundColor: '#e8eaf6', color: '#555', fontSize: '12px', fontWeight: 600, padding: '4px 14px', borderRadius: '12px', letterSpacing: '0.3px' }}>
                    {dateSeparatorLabel}
                  </span>
                </div>
              )}
              <div
                ref={index === filteredArr.length - 1 ? lastMessageRef : null}
                id={`message-${msg.emailId}`}
                data-email-id={msg.emailId}
                style={{
                  backgroundColor: selectionMode && msg.emailId && selectedMsgIds.has(msg.emailId) ? '#eef2ff' : 'transparent',
                  borderRadius: '8px',
                  transition: 'background-color 0.15s',
                  margin: selectionMode ? '0 -8px' : '0',
                  padding: selectionMode ? '0 8px' : '0',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: msg.incoming ? '8px' : '0',
                    gap: '8px',
                  }}
                >
                  {/* Checkbox — only rendered (takes space) when in selection mode */}
                  {selectionMode && msg.emailId && (
                    <input
                      type="checkbox"
                      checked={selectedMsgIds.has(msg.emailId)}
                      onChange={() => setSelectedMsgIds(prev => {
                        const next = new Set(prev)
                        next.has(msg.emailId!) ? next.delete(msg.emailId!) : next.add(msg.emailId!)
                        return next
                      })}
                      onClick={e => e.stopPropagation()}
                      style={{
                        width: '15px', height: '15px', cursor: 'pointer',
                        accentColor: '#667eea', flexShrink: 0,
                      }}
                    />
                  )}
                  {/* Incoming avatar */}
                  {msg.incoming && (() => {
                    const avatarEmail = selectedContactEmail || conversations.find(c => c.id === selectedConversation)?.email || ''
                    return (
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: getAvatarColor(avatarEmail), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '11px', flexShrink: 0, alignSelf: 'flex-start', marginTop: '4px' }}>
                        {getAvatarInitials(avatarEmail)}
                      </div>
                    )
                  })()}
                  <div style={{ position: 'relative', maxWidth: !msg.incoming ? 'calc(100% - 60px)' : 'calc(85% - 36px)', marginLeft: !msg.incoming ? 'auto' : '0' }}>
                    {/* Tail for received */}
                    {msg.incoming && (() => {
                      const isUnread = !msg.isRead && msg.incoming && !msg.isDeleted && msg.emailId !== highlightedEmailId;
                      const has2pxBorder = !msg.isDeleted && (activeAction || msg.emailId === highlightedEmailId || isUnread);
                      const borderColor = msg.emailId === highlightedEmailId ? '#d4af37' : activeAction === 'forward' ? '#8e24aa' : activeAction ? '#4db6ac' : !msg.isRead ? '#2196f3' : '#888888'
                      const topBgColor = isFwdMsg ? '#f3e5f5' : isReplierMsg ? '#e0f2f1' : activeAction === 'forward' ? '#f3e5f5' : activeAction ? '#e0f2f1' : (!msg.isRead ? '#ecf3fe' : '#ffffff')
                      const bgColor = msg.isDeleted ? '#f5f5f5' : ((!msg.isRead && msg.incoming) ? '#ecf3fe' : (msg.emailId === highlightedEmailId ? 'white' : topBgColor))
                      
                      const innerTop = isHighlightedUnread ? '4px' : has2pxBorder ? '2px' : '0.5px';
                      const innerLeft = isHighlightedUnread ? '0.5px' : has2pxBorder ? '-4.2px' : '-7.8px';
                      const innerBorderTop = isHighlightedUnread ? '5.5px' : has2pxBorder ? '7.5px' : '9px';
                      const innerBorderLeft = isHighlightedUnread ? '5.5px' : has2pxBorder ? '7.5px' : '9px';

                      const shadowColor = msg.isDeleted ? 'transparent' : activeAction ? (activeAction === 'forward' ? 'rgba(142, 36, 170, 0.45)' : 'rgba(77, 182, 172, 0.55)') : msg.emailId === highlightedEmailId ? 'rgba(255, 215, 0, 0.7)' : (!msg.isRead && msg.incoming) ? 'rgba(33, 150, 243, 0.45)' : 'rgba(0, 0, 0, 0.3)';
                      const dropShadow = has2pxBorder ? `drop-shadow(-1px 0px 3px ${shadowColor})` : `drop-shadow(-1px 0px 2px ${shadowColor})`;

                      return (
                        <>
                          <div style={{ position: 'absolute', top: 0, left: '-9px', width: 0, height: 0, borderTop: `9.5px solid ${borderColor}`, borderLeft: '9.5px solid transparent', filter: dropShadow, clipPath: 'inset(-10px 0px -10px -10px)', zIndex: 1, transition: 'border-top-color 0.4s ease, filter 0.3s ease' }} />
                          {isHighlightedUnread && (
                            <div style={{ position: 'absolute', top: '2px', left: '-4.2px', width: 0, height: 0, borderTop: `7.5px solid #2196f3`, borderLeft: `7.5px solid transparent`, zIndex: 1, transition: 'border-top-color 0.4s ease' }} />
                          )}
                          <div style={{ position: 'absolute', top: innerTop, left: innerLeft, width: 0, height: 0, borderTop: `${innerBorderTop} solid ${bgColor}`, borderLeft: `${innerBorderLeft} solid transparent`, zIndex: 1, transition: 'border-top-color 0.4s ease' }} />
                        </>
                      )
                    })()}
                    {/* Tail for sent */}
                    {!msg.incoming && (() => {
                      const has2pxBorder = !msg.isDeleted && (activeAction || msg.emailId === highlightedEmailId);
                      const borderColor = msg.emailId === highlightedEmailId ? '#d4af37' : activeAction === 'forward' ? '#8e24aa' : activeAction ? '#4db6ac' : '#888888'
                      const topBgColor = isFwdMsg ? '#f3e5f5' : isReplierMsg ? '#e0f2f1' : activeAction === 'forward' ? '#f3e5f5' : activeAction ? '#e0f2f1' : '#ffffff'
                      const bgColor = msg.isDeleted ? '#f5f5f5' : (msg.emailId === highlightedEmailId ? 'white' : topBgColor)
                      
                      const innerTop = has2pxBorder ? '2px' : '0.5px';
                      const innerRight = has2pxBorder ? '-4.2px' : '-7.8px';
                      const innerBorderTop = has2pxBorder ? '7.5px' : '9px';
                      const innerBorderRight = has2pxBorder ? '7.5px' : '9px';

                      const shadowColor = msg.isDeleted ? 'transparent' : activeAction ? (activeAction === 'forward' ? 'rgba(142, 36, 170, 0.45)' : 'rgba(77, 182, 172, 0.55)') : msg.emailId === highlightedEmailId ? 'rgba(255, 215, 0, 0.7)' : 'rgba(0, 0, 0, 0.3)';
                      const dropShadow = has2pxBorder ? `drop-shadow(1px 0px 3px ${shadowColor})` : `drop-shadow(1px 0px 2px ${shadowColor})`;

                      return (
                        <>
                          <div style={{ position: 'absolute', top: 0, right: '-9px', width: 0, height: 0, borderTop: `9.5px solid ${borderColor}`, borderRight: '9.5px solid transparent', filter: dropShadow, clipPath: 'inset(-10px -10px -10px 0px)', zIndex: 1, transition: 'border-top-color 0.4s ease, filter 0.3s ease' }} />
                          <div style={{ position: 'absolute', top: innerTop, right: innerRight, width: 0, height: 0, borderTop: `${innerBorderTop} solid ${bgColor}`, borderRight: `${innerBorderRight} solid transparent`, zIndex: 1, transition: 'border-top-color 0.4s ease' }} />
                        </>
                      )
                    })()}
                  <div
                    {...(msg.incoming && msg.emailId ? { 'data-bubble-email-id': msg.emailId } : {})}
                    className={(!msg.isRead && msg.incoming && !msg.isDeleted) ? 'unread-bubble' : undefined}
                    style={{
                      backgroundColor: msg.isDeleted
                        ? '#f5f5f5'
                        : (!msg.isRead && msg.incoming)
                          ? 'rgba(66,133,244,0.10)'
                          : isFwdMsg
                            ? '#ffffff'
                            : msg.emailId === highlightedEmailId
                              ? 'white'
                              : '#ffffff',
                      backgroundImage: (msg.isDeleted && viewedDeletedIds.has(msg.id))
                        ? 'repeating-linear-gradient(45deg, rgba(244, 67, 54, 0.08) 0px, rgba(244, 67, 54, 0.08) 10px, transparent 10px, transparent 20px)'
                        : (isReplierMsg && !isFwdMsg && !msg.isDeleted)
                          ? 'linear-gradient(to right, #e0f2f1 10px, transparent 10px), linear-gradient(to left, #e0f2f1 10px, transparent 10px), linear-gradient(to top, #e0f2f1 10px, transparent 10px)'
                          : 'none',
                      color: (msg.isDeleted && !viewedDeletedIds.has(msg.id)) ? '#aaa' : '#333',
                      padding: '12px 16px 12px 16px',
                      borderRadius: msg.incoming ? '0px 12px 12px 12px' : '12px 0px 12px 12px',
                      border: msg.isDeleted
                        ? '0.5px dashed #ccc'
                        : (replyEmailCard?.sourceMessageId === msg.id && replyEmailCard?.action === 'forward')
                          ? '2px solid #8e24aa'
                          : isFwdMsg
                            ? '2px solid #8e24aa'
                            : activeAction
                              ? '2px solid #4db6ac'
                              : isHighlightedUnread
                                ? '2px solid #d4af37'
                                : msg.emailId === highlightedEmailId
                                  ? '2px solid #d4af37'
                                  : (!msg.isRead && msg.incoming)
                                    ? '2px solid #2196f3'
                                    : '0.5px solid #888888',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-wrap',
                      boxShadow: msg.isDeleted
                        ? 'none'
                        : (replyEmailCard?.sourceMessageId === msg.id && replyEmailCard?.action === 'forward')
                          ? '0 0 12px rgba(142, 36, 170, 0.45)'
                          : isFwdMsg
                            ? 'inset 0 0 0 10px rgba(142,36,170,0.10), 0 0 12px rgba(142,36,170,0.35)'
                            : activeAction
                              ? '0 0 12px rgba(77, 182, 172, 0.55)'
                              : isHighlightedUnread
                                ? 'inset 0 0 0 2px #2196f3, 0 0 10px rgba(255, 215, 0, 0.7)'
                                : msg.emailId === highlightedEmailId
                                  ? '0 0 10px rgba(255, 215, 0, 0.7)'
                                  : (!msg.isRead && msg.incoming)
                                    ? '0 0 12px rgba(33, 150, 243, 0.45)'
                                    : '0 2px 8px rgba(0, 0, 0, 0.4)',
                      transition: 'background-color 0.4s ease, border 0.3s ease, box-shadow 0.3s ease',
                      opacity: msg.isPending ? 0.7 : (msg.isDeleted && !viewedDeletedIds.has(msg.id)) ? 0.6 : 1,
                      fontSize: '14px',
                    }}
                  >
                    {msg.isDeleted && !viewedDeletedIds.has(msg.id) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#999', fontStyle: 'italic' }}>
                        <Trash2 size={14} color="#bbb" />
                        <span>This message was deleted</span>
                      </div>
                    ) : (
                      <>
                        {replyEmailCard?.sourceMessageId === msg.id && !isReplierMsg && (
                          <div style={{
                            backgroundColor: replyEmailCard.action === 'forward' ? '#f3e5f5' : '#e0f2f1',
                            margin: '-12px -16px 10px -16px',
                            padding: '7px 14px',
                            borderTopLeftRadius: msg.incoming ? '0px' : '10px',
                            borderTopRightRadius: msg.incoming ? '10px' : '0px',
                            borderBottom: replyEmailCard.action === 'forward' ? '1px solid rgba(142,36,170,0.15)' : '1px solid rgba(77,182,172,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: replyEmailCard.action === 'forward' ? '#6a1b9a' : '#00796b',
                          }}>
                            {replyEmailCard.action === 'forward' ? <Forward size={13} /> : <Reply size={13} />}
                            {replyEmailCard.action === 'forward' ? 'Forwarding' : replyEmailCard.action === 'replyAll' ? 'Replying to all' : 'Replying'}
                          </div>
                        )}
                        {(() => {
                          if (!isReplierMsg) return null;
                          const emailData = allEmailsRef.current.find(e => e.id === msg.emailId);
                          const msgTo = emailData?.to || (msg.incoming ? userEmail : (toEmails.join(', ') || selectedContactEmail));
                          const isFwd = msg.subject ? /^(Fwd:|Fw:)\s/i.test(msg.subject.trim()) : false;
                          const isReply = msg.subject ? /^(Re:)\s/i.test(msg.subject.trim()) : false;
                          const isReplyAll = isReply && (msgTo?.includes(',') || msg.cc);
                          const ActionIcon = isFwd ? <Forward size={16} /> : isReplyAll ? <span style={{ display: 'inline-flex', alignItems: 'center' }}><Reply size={16} /><Reply size={16} style={{ marginLeft: '-6px' }} /></span> : <Reply size={16} />;
                          
                          const headerBgColor = msg.isDeleted 
                            ? 'transparent' 
                            : msg.emailId === highlightedEmailId 
                              ? 'transparent' 
                              : (isFwd ? '#f3e5f5' : '#e0f2f1');
                              
                          return (
                            <div style={{
                              backgroundColor: headerBgColor,
                              margin: '-12px -16px 0 -16px',
                              padding: '12px 16px 8px 16px',
                              borderTopLeftRadius: msg.incoming ? '0px' : '10px',
                              borderTopRightRadius: msg.incoming ? '10px' : '0px',
                              borderBottom: headerBgColor !== 'transparent' ? '1px solid rgba(0,0,0,0.05)' : 'none'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#555', fontSize: '13px', fontWeight: 600 }}>
                                {ActionIcon}
                                <strong>{isFwd ? 'Forwarded' : isReplyAll ? 'Replied to all' : 'Replied'}</strong>
                                <span style={{ color: '#888', fontWeight: 500, fontSize: '15px', marginLeft: '4px' }}>
                                  To:{' '}
                                  {msgTo ? msgTo.split(',').map((emailStr, idx, arr) => {
                                    const email = emailStr.trim();
                                    if (email.includes('@')) {
                                      const [name, domain] = email.split('@');
                                      return (
                                        <span key={idx}>
                                          <span style={{ fontWeight: 600, color: '#111' }}>{name}</span>
                                          <span style={{ fontWeight: 300, color: '#555' }}>@{domain}</span>
                                          {idx < arr.length - 1 ? ', ' : ''}
                                        </span>
                                      );
                                    }
                                    return <span key={idx}>{email}{idx < arr.length - 1 ? ', ' : ''}</span>;
                                  }) : 'Unknown'}
                                </span>
                              </div>
                              <div style={{ fontSize: '14px' }} dangerouslySetInnerHTML={{ __html: renderContent(msg.content, 'card') }} />
                            </div>
                          );
                        })()}
                        {/* From (for replier message) */}
                        {isReplierMsg && (() => {
                          const emailData = allEmailsRef.current.find(e => e.id === msg.emailId);
                          const msgFrom = msg.incoming ? (emailData?.from || selectedContactEmail) : userEmail;
                          return (
                            <div style={{ marginTop: '8px', marginBottom: '2px', fontSize: '15px' }}>
                              <span style={{ fontSize: '14px', opacity: 0.6, marginRight: '4px' }}>From:</span>
                              {msgFrom ? msgFrom.split(',').map((emailStr, idx, arr) => {
                                let email = emailStr.trim();
                                const match = email.match(/<([^>]+)>/);
                                if (match) email = match[1];
                                if (email.includes('@')) {
                                  const [name, domain] = email.split('@');
                                  return (
                                    <span key={idx}>
                                      <span style={{ fontWeight: 600, color: '#111' }}>{name}</span>
                                      <span style={{ fontWeight: 300, color: '#555' }}>@{domain}</span>
                                      {idx < arr.length - 1 ? ', ' : ''}
                                    </span>
                                  );
                                }
                                return <span key={idx} style={{ fontWeight: 600, color: '#111' }}>{email}{idx < arr.length - 1 ? ', ' : ''}</span>;
                              }) : 'Unknown'}
                            </div>
                          );
                        })()}
                        {/* Subject */}
                        <div style={{ marginTop: isReplierMsg ? '4px' : '0', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #ccc' }}>
                          {msg.isDeleted && viewedDeletedIds.has(msg.id) && (
                            <span style={{ fontSize: '12px', color: '#f44336', fontWeight: 600, display: 'block', marginBottom: '4px' }}>[Deleted Message]</span>
                          )}
                          <span style={{ fontSize: '14px', opacity: 0.6, marginRight: '4px' }}>Subject:</span>
                        <span style={{ 
                          fontSize: '18px', 
                          fontWeight: 700,
                          color: msg.subject === '(No subject)' ? '#888' : 'inherit'
                        }}>
                          {msg.subject}
                        </span>
                        </div>
                        {/* CC/BCC if available */}
                        {(msg.cc || msg.bcc) && (
                          <div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '6px' }}>
                            {msg.cc && <div><span style={{ fontWeight: 600 }}>CC</span> {msg.cc}</div>}
                            {msg.bcc && <div><span style={{ fontWeight: 600 }}>BCC</span> {msg.bcc}</div>}
                          </div>
                        )}
                        {/* Body */}
                        {isReplierMsg ? (
                          <div style={{ fontSize: '14px' }} dangerouslySetInnerHTML={{ __html: renderContent(msg.content, 'main') }} onClick={(e) => { const card = (e.target as HTMLElement).closest('[data-file-card]') as HTMLElement | null; if (card) { const n = decodeURIComponent(card.dataset.attachment || ''); if (!n) return; if (card.dataset.folderCard === '1') { const fs: FolderEntry[] = (() => { try { return JSON.parse(card.dataset.folderFiles || '[]') } catch { return [] } })(); setFolderPreview({ name: n, entries: fs }); setFolderNavPath([]) } else { const ex = (n.split('.').pop() || '').toLowerCase(); setFilePreview({ url: card.getAttribute('data-file-url') || '', thumbUrl: card.querySelector('img')?.src || '', name: n, ext: ex }) } } }} />
                        ) : (
                          <div style={{ fontSize: '14px' }} dangerouslySetInnerHTML={{ __html: renderContent(msg.content, 'all') }} onClick={(e) => { const card = (e.target as HTMLElement).closest('[data-file-card]') as HTMLElement | null; if (card) { const n = decodeURIComponent(card.dataset.attachment || ''); if (!n) return; if (card.dataset.folderCard === '1') { const fs: FolderEntry[] = (() => { try { return JSON.parse(card.dataset.folderFiles || '[]') } catch { return [] } })(); setFolderPreview({ name: n, entries: fs }); setFolderNavPath([]) } else { const ex = (n.split('.').pop() || '').toLowerCase(); setFilePreview({ url: card.getAttribute('data-file-url') || '', thumbUrl: card.querySelector('img')?.src || '', name: n, ext: ex }) } } }} />
                        )}
                      </>
                    )}
                    {/* Timestamp — above bottom bar, right-aligned (shared by all messages) */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', fontSize: '12px', opacity: 0.7, marginTop: '6px', backgroundColor: 'transparent', marginLeft: '-16px', marginRight: '-16px', padding: '2px 16px 0' }}>
                      {!msg.incoming && (
                        msg.isPending ? (
                          msg.isRestoredPending
                            ? <Clock size={12} style={{ opacity: 0.7 }} />
                            : <><Clock size={12} /><UndoCountdown /></>
                        ) : (
                          (!msg.isScheduled || (msg.scheduledFor && new Date(msg.scheduledFor).getTime() <= now)) && <Check size={14} strokeWidth={2.5} />
                        )
                      )}
                      <span>{msg.timestamp}</span>
                    </div>
                    {/* Bottom bar — shared by all messages */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '0', paddingTop: '6px', paddingBottom: '2px', borderTop: '1px solid #e0e0e0', minHeight: '28px', backgroundColor: 'transparent', marginLeft: '-16px', marginRight: '-16px', paddingLeft: '16px', paddingRight: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', alignItems: 'center' }}>
                        {/* Undo Send */}
                        {msg.isPending && !msg.isRestoredPending && !msg.incoming && !msg.isDeleted && (
                          <ActionButton icon={<RotateCcw size={24} strokeWidth={1.5} />} title="Undo Send" hoverBg="#4db6ac" onClick={() => handleUndoSend(msg.id)} />
                        )}
                        {/* Read/Unread */}
                        {msg.incoming && !msg.isDeleted && (() => {
                          const unreadIcon = <span style={{ position: 'relative', display: 'inline-flex' }}><Mail size={24} strokeWidth={1.5} /><span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#1a73e8', border: '1.5px solid white' }} /></span>;
                          const readIcon = <span style={{ position: 'relative', display: 'inline-flex' }}><MailOpen size={24} strokeWidth={1.5} /><span style={{ position: 'absolute', bottom: -2, right: -2.5, width: 9, height: 9, borderRadius: '100% 50% 50% 50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={9} color="#34a853" strokeWidth={4} /></span></span>;
                          return (
                            <ActionButton icon={!msg.isRead ? unreadIcon : readIcon} hoverIcon={!msg.isRead ? readIcon : unreadIcon} title={msg.isRead ? 'Mark as unread' : 'Mark as read'} hoverBg={msg.isRead ? '#64b5f6' : '#2196f3'} active={!msg.isRead} noCross onClick={() => { if (!msg.emailId) return; pendingReadRef.current.add(msg.emailId); seenTopRef.current.add(msg.emailId); seenBottomRef.current.add(msg.emailId); updateReadStatus(msg.emailId, !msg.isRead) }} />
                          );
                        })()}
                        {/* Resend */}
                        {!msg.incoming && !msg.isDeleted && (
                          <ActionButton icon={<div style={{ position: 'relative', width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><RotateCcw size={24} strokeWidth={1.5} style={{ transform: 'scaleX(-1) scaleY(-1)' }} /><Send size={13} style={{ position: 'absolute', bottom: '4px', left: '4px', backgroundColor: 'transparent' }} /></div>} title="Resend" hoverBg="#4db6ac" onClick={() => handleResend(msg)} />
                        )}
                        {/* Star */}
                        {!msg.isDeleted && (
                          <ActionButton icon={<Star size={24} strokeWidth={1.5} fill={msg.isStarred ? 'currentColor' : 'none'} />} title={msg.isStarred ? 'Unstar' : 'Star'} hoverBg="#ffc107" active={!!msg.isStarred} crossColor="black" onClick={async () => { if (!msg.emailId || !token) return; const nextStarred = !msg.isStarred; setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isStarred: nextStarred } : m)); setAllEmails(prev => prev.map(e => e.id === msg.emailId ? { ...e, isStarred: nextStarred } : e)); try { await fetch(`http://localhost:5050/api/emails/${msg.emailId}/star`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_starred: nextStarred }) }); window.dispatchEvent(new Event('mailRefresh')) } catch (err) { console.error('Error:', err); setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isStarred: msg.isStarred } : m)); setAllEmails(prev => prev.map(e => e.id === msg.emailId ? { ...e, isStarred: msg.isStarred } : e)) } }} />
                        )}
                        {/* Reply */}
                        {!msg.isDeleted && (
                          <ActionButton icon={<Reply size={24} strokeWidth={1.5} />} title={selectedContactName?.toLowerCase().includes('noreply') ? 'Cannot reply to no-reply address' : (replyEmailCard?.sourceMessageId === msg.id && replyEmailCard?.action === 'reply') ? 'Cancel Reply' : 'Reply'} disabled={!!selectedContactName?.toLowerCase().includes('noreply')} hoverBg="#4db6ac" active={replyEmailCard?.sourceMessageId === msg.id && replyEmailCard?.action === 'reply'} onClick={() => {
                            if (replyEmailCard?.sourceMessageId === msg.id && replyEmailCard?.action === 'reply') {
                              setSubjectValue(''); setInputValue(''); setReplyEmailCard(null)
                              document.querySelector(`[data-msg-id="${msg.id}"]`)?.scrollIntoView({ behavior: 'instant', block: 'start' })
                              return
                            }
                            const contact = conversations.find(c => c.id === selectedConversation)
                            const fromAddr = msg.incoming ? (contact?.email || '') : userEmail
                            const toAddr = msg.incoming ? userEmail : (contact?.email || '')
                            const reCleanSubject = (msg.subject || '').replace(/^(Re:\s*)+/i, '')
                            if (contact?.email) setToEmails([contact.email])
                            setToInput('')
                            setSubjectValue(`Re: ${reCleanSubject}`)
                            setInputValue('')
                            hasInteractedRef.current = true
                            setReplyEmailCard({ action: 'reply', subject: msg.subject || '', from: fromAddr, to: toAddr, body: msg.content, date: msg.date || msg.timestamp, sourceMessageId: msg.id })
                            setTimeout(() => document.querySelector(`[data-msg-id="${msg.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                          }} />
                        )}
                        {/* Forward */}
                        {!msg.isDeleted && (
                          <ActionButton icon={<Forward size={24} strokeWidth={1.5} />} title={(replyEmailCard?.sourceMessageId === msg.id && replyEmailCard?.action === 'forward') ? 'Cancel Forward' : 'Forward'} hoverBg="#8e24aa" active={replyEmailCard?.sourceMessageId === msg.id && replyEmailCard?.action === 'forward'} onClick={() => {
                            if (replyEmailCard?.sourceMessageId === msg.id && replyEmailCard?.action === 'forward') {
                              setSubjectValue(''); setInputValue(''); setReplyEmailCard(null)
                              document.querySelector(`[data-msg-id="${msg.id}"]`)?.scrollIntoView({ behavior: 'instant', block: 'start' })
                              return
                            }
                            const contact = conversations.find(c => c.id === selectedConversation)
                            const fromAddr = msg.incoming ? (contact?.email || '') : userEmail
                            const toAddr = msg.incoming ? userEmail : (contact?.email || '')
                            const cleanSubject = (msg.subject || '').replace(/^(Fwd:\s*|Fw:\s*)+/i, '')
                            const dateStr = msg.date ? new Date(msg.date).toLocaleString() : ''
                            const fwdContent = `\n\n---------- Forwarded message ---------\nFrom: ${fromAddr}\nDate: ${dateStr}\nSubject: ${msg.subject}\nTo: ${toAddr}\n\n${msg.content}`
                            setToEmails([])
                            setToInput('')
                            setSubjectValue(`Fwd: ${cleanSubject}`)
                            setInputValue(fwdContent)
                            hasInteractedRef.current = true
                            setReplyEmailCard({ action: 'forward', subject: msg.subject || '', from: fromAddr, to: toAddr, body: msg.content, date: msg.date || msg.timestamp, sourceMessageId: msg.id })
                            setTimeout(() => document.querySelector(`[data-msg-id="${msg.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                          }} />
                        )}
                        {/* Print */}
                        <ActionButton icon={<Printer size={24} strokeWidth={1.5} />} title="Print" hoverBg="#455a64" onClick={() => {
                          const subject = msg.subject || '(No subject)'
                          const date = msg.date ? new Date(msg.date).toLocaleString() : ''
                          const from = msg.incoming ? (conversations.find(c => c.id === selectedConversation)?.email || '') : userEmail
                          const to = msg.incoming ? userEmail : (conversations.find(c => c.id === selectedConversation)?.email || '')
                          const html = `<!DOCTYPE html><html><head><title>${subject}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#222}h2{margin-bottom:8px}table{border-collapse:collapse;margin-bottom:16px}td{padding:4px 12px 4px 0;vertical-align:top}td:first-child{font-weight:600;color:#555;white-space:nowrap}.body{white-space:pre-wrap;line-height:1.6;border-top:1px solid #ddd;padding-top:16px}@media print{body{padding:0}}</style></head><body><h2>${subject}</h2><table><tr><td>From:</td><td>${from}</td></tr><tr><td>To:</td><td>${to}</td></tr><tr><td>Date:</td><td>${date}</td></tr></table><div class="body">${msg.content}</div></body></html>`
                          const blob = new Blob([html], { type: 'text/html' })
                          const url = URL.createObjectURL(blob)
                          const iframe = document.createElement('iframe')
                          iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none'
                          iframe.src = url
                          iframe.onload = () => {
                            iframe.contentWindow?.focus()
                            iframe.contentWindow?.print()
                            setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(iframe) }, 2000)
                          }
                          document.body.appendChild(iframe)
                        }} />
                        {/* Archive / Unarchive */}
                        {!msg.isDeleted && (
                          <ActionButton
                            icon={<Archive size={24} strokeWidth={1.5} />}
                            title={msg.isArchived ? 'Unarchive' : 'Archive'} hoverBg="#7986cb" active={!!msg.isArchived} onClick={async () => { if (!msg.emailId || !token) return; const nextArchived = !msg.isArchived; setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isArchived: nextArchived } : m)); setAllEmails(prev => prev.map(e => e.id === msg.emailId ? { ...e, isArchived: nextArchived } : e)); try { await fetch(`http://localhost:5050/api/emails/${msg.emailId}/archive`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }); window.dispatchEvent(new Event('mailRefresh')) } catch (err) { console.error('Error:', err); setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isArchived: msg.isArchived } : m)); setAllEmails(prev => prev.map(e => e.id === msg.emailId ? { ...e, isArchived: msg.isArchived } : e)) } }} />
                        )}
                        {/* Snooze */}
                        {!msg.isDeleted && (
                          <div className="snooze-btn-wrapper" style={{ position: 'relative' }}>
                            <ActionButton icon={<Clock size={24} strokeWidth={1.5} />} title="Snooze" hoverBg="#fb8c00" active={snoozeMenuOpen === msg.id || !!msg.isSnoozed} onClick={() => setSnoozeMenuOpen(snoozeMenuOpen === msg.id ? null : msg.id)} />
                            {snoozeMenuOpen === msg.id && (
                              <div className="snooze-dropdown-menu" style={{ position: 'absolute', bottom: '100%', ...(msg.incoming ? { left: 0 } : { right: 0 }), marginBottom: '4px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000, minWidth: '250px' }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ padding: '8px 16px 6px', fontSize: '12px', fontWeight: 600, color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #f0f0f0' }}><Clock size={13} style={{ flexShrink: 0 }} />Snooze until...</div>
                                {getDynamicSnoozeOptions().map(opt => (
                                  <button key={opt.label} style={{ width: '100%', padding: '10px 16px', backgroundColor: 'white', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', cursor: 'pointer', fontSize: '13px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f5f5'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'} onClick={async () => { if (!msg.emailId || !token) return; try { await fetch(`http://localhost:5050/api/emails/${msg.emailId}/snooze`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_snoozed: true, hours: opt.hours }) }); setSnoozeMenuOpen(null); window.dispatchEvent(new Event('mailRefresh')) } catch (err) { console.error('Error:', err) } }}>
                                    <span>{opt.shortLabel}</span><span style={{ color: '#888', fontWeight: 500, fontSize: '13px', whiteSpace: 'nowrap' }}>{opt.timeText}</span>
                                  </button>
                                ))}
                                <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
                                {/* Pick date & time */}
                                <div style={{ position: 'relative' }}>
                                  <div
                                    style={{ width: '100%', padding: '10px 16px', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', boxSizing: 'border-box' as const }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#f5f5f5'
                                      if (snoozePickerTimer.current) clearTimeout(snoozePickerTimer.current)
                                      const ref = new Date(); const h = ref.getHours()
                                      setScheduleHour(h % 12 || 12); setScheduleMinute(ref.getMinutes())
                                      setSchedulePeriod(h >= 12 ? 'PM' : 'AM')
                                      setCalendarViewMonth(ref.getMonth()); setCalendarViewYear(ref.getFullYear())
                                      setScheduleDate('')
                                      const rect = e.currentTarget.getBoundingClientRect()
                                      const pickerWidth = 386
                                      if (rect.right + 8 + pickerWidth <= window.innerWidth) {
                                        setSnoozePickerPos({ top: rect.top, left: rect.right + 8 })
                                      } else {
                                        setSnoozePickerPos({ top: rect.top, right: window.innerWidth - rect.left + 8 })
                                      }
                                      setShowSnoozePickerDropdown(msg.id)
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'white'
                                      snoozePickerTimer.current = setTimeout(() => setShowSnoozePickerDropdown(null), 150)
                                    }}
                                  >
                                    <Calendar size={15} style={{ flexShrink: 0, color: '#fb8c00' }} />
                                    Pick date &amp; time
                                    <span style={{ marginLeft: 'auto', color: '#fb8c00', fontSize: '20px', lineHeight: 1, fontWeight: 400 }}>›</span>
                                  </div>
                                  {showSnoozePickerDropdown === msg.id && (() => {
                                    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
                                    const todayStr = new Date().toISOString().slice(0, 10)
                                    const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate()
                                    const firstDay = new Date(calendarViewYear, calendarViewMonth, 1).getDay()
                                    return (
                                      <div
                                        onMouseEnter={() => { if (snoozePickerTimer.current) clearTimeout(snoozePickerTimer.current) }}
                                        onMouseLeave={() => { snoozePickerTimer.current = setTimeout(() => setShowSnoozePickerDropdown(null), 150) }}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ position: 'fixed', top: snoozePickerPos?.top ?? 0, ...(snoozePickerPos?.left != null ? { left: snoozePickerPos.left } : { right: snoozePickerPos?.right ?? 0 }), background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', boxShadow: '0 6px 24px rgba(0,0,0,0.18)', zIndex: 9999, display: 'flex', flexDirection: 'column', minWidth: '380px' }}
                                      >
                                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <Clock size={15} color="#fb8c00" />
                                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>Snooze until...</span>
                                        </div>
                                        <div style={{ display: 'flex' }}>
                                          <div style={{ padding: '16px', borderRight: '1px solid #e0e0e0' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                              <span style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>{MONTH_NAMES[calendarViewMonth]} {calendarViewYear}</span>
                                              <div style={{ display: 'flex', gap: '2px' }}>
                                                <button onClick={(e) => { e.stopPropagation(); calendarViewMonth === 0 ? (setCalendarViewMonth(11), setCalendarViewYear(y => y - 1)) : setCalendarViewMonth(m => m - 1) }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background 0.15s' }}>‹</button>
                                                <button onClick={(e) => { e.stopPropagation(); calendarViewMonth === 11 ? (setCalendarViewMonth(0), setCalendarViewYear(y => y + 1)) : setCalendarViewMonth(m => m + 1) }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background 0.15s' }}>›</button>
                                              </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 34px)', marginBottom: '4px' }}>
                                              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ fontSize: '11px', color: '#bbb', textAlign: 'center', padding: '3px 0', fontWeight: 600 }}>{d}</div>)}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 34px)', gap: '2px' }}>
                                              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                                              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                                const dateStr = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                                                const isSelected = scheduleDate === dateStr
                                                const isToday = dateStr === todayStr
                                                const isPast = dateStr < todayStr
                                                return <button key={day} disabled={isPast} onClick={(e) => { e.stopPropagation(); setScheduleDate(dateStr) }} onMouseEnter={() => { if (!isPast) setHoveredCalendarDay(dateStr) }} onMouseLeave={() => setHoveredCalendarDay(null)} style={{ width: '34px', height: '34px', border: 'none', borderRadius: '50%', cursor: isPast ? 'default' : 'pointer', background: isSelected ? '#fb8c00' : hoveredCalendarDay === dateStr ? '#fff3e0' : 'transparent', color: isSelected ? '#fff' : isPast ? '#ddd' : isToday ? '#fb8c00' : '#333', fontWeight: isSelected || isToday ? 700 : 400, fontSize: '13px', transition: 'background 0.12s' }}>{day}</button>
                                              })}
                                            </div>
                                          </div>
                                          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '180px' }}>
                                            <div>
                                              <div style={{ fontSize: '12px', color: '#888', fontWeight: 500, marginBottom: '4px' }}>Date</div>
                                              <div style={{ fontSize: '14px', color: scheduleDate ? '#333' : '#ccc', fontWeight: scheduleDate ? 500 : 400 }}>
                                                {scheduleDate ? (() => { const [y,m,d] = scheduleDate.split('-'); return `${d}/${m}/${y}` })() : 'DD/MM/YYYY'}
                                              </div>
                                            </div>
                                            <div>
                                              <div style={{ fontSize: '12px', color: '#888', fontWeight: 500, marginBottom: '8px' }}>Time</div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <input type="number" min={1} max={12} value={scheduleHour} onClick={(e) => e.stopPropagation()} onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) setScheduleHour(Math.min(12, Math.max(1, v))) }} onBlur={(e) => { const v = Number(e.target.value); setScheduleHour(isNaN(v) || v < 1 ? 1 : v > 12 ? 12 : v) }} style={{ width: '48px', padding: '7px 4px', border: '1.5px solid #c0c0c0', borderRadius: '7px', fontSize: '15px', outline: 'none', textAlign: 'center', MozAppearance: 'textfield', fontWeight: 600, fontFamily: 'inherit' } as React.CSSProperties} />
                                                <span style={{ fontWeight: 700, color: '#555', fontSize: '15px' }}>:</span>
                                                <input type="number" min={0} max={59} value={String(scheduleMinute).padStart(2, '0')} onClick={(e) => e.stopPropagation()} onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) setScheduleMinute(Math.min(59, Math.max(0, v))) }} onBlur={(e) => { const v = Number(e.target.value); setScheduleMinute(isNaN(v) || v < 0 ? 0 : v > 59 ? 59 : v) }} style={{ width: '48px', padding: '7px 4px', border: '1.5px solid #c0c0c0', borderRadius: '7px', fontSize: '15px', outline: 'none', textAlign: 'center', MozAppearance: 'textfield', fontWeight: 600, fontFamily: 'inherit' } as React.CSSProperties} />
                                                <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '7px', overflow: 'hidden', border: '1.5px solid #c0c0c0', marginLeft: '2px' }}>
                                                  {(['AM', 'PM'] as const).map(p => <button key={p} onClick={(e) => { e.stopPropagation(); setSchedulePeriod(p) }} style={{ padding: '6px 8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: schedulePeriod === p ? '#fb8c00' : '#fafafa', color: schedulePeriod === p ? '#fff' : '#999', transition: 'background 0.15s' }}>{p}</button>)}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '10px 16px', borderTop: '1px solid #e0e0e0' }}>
                                          <button onClick={() => setShowSnoozePickerDropdown(null)} style={{ padding: '6px 16px', borderRadius: '16px', border: '1px solid #e0e0e0', background: '#fff', color: '#555', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                                          <button disabled={!scheduleDate} onClick={async (e) => { e.stopPropagation(); if (!msg.emailId || !token || !scheduleDate) return; const hour24 = schedulePeriod === 'AM' ? scheduleHour % 12 : (scheduleHour % 12) + 12; const target = new Date(`${scheduleDate}T${String(hour24).padStart(2,'0')}:${String(scheduleMinute).padStart(2,'0')}`); const hours = Math.max(0.1, (target.getTime() - Date.now()) / 3600000); try { await fetch(`http://localhost:5050/api/emails/${msg.emailId}/snooze`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_snoozed: true, hours }) }); setShowSnoozePickerDropdown(null); setSnoozeMenuOpen(null); window.dispatchEvent(new Event('mailRefresh')) } catch (err) { console.error('Error:', err) } }} style={{ padding: '6px 16px', borderRadius: '16px', border: 'none', background: scheduleDate ? '#fb8c00' : '#ffe0b2', color: '#fff', fontSize: '13px', cursor: scheduleDate ? 'pointer' : 'not-allowed', fontWeight: 600 }}>Snooze</button>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Spam */}
                        {msg.incoming && !msg.isDeleted && (
                          <ActionButton icon={<AlertOctagon size={24} strokeWidth={1.5} />} title={msg.isSpam ? 'Not spam' : 'Mark as spam'} hoverBg="#e91e63" active={!!msg.isSpam} onClick={async () => { if (!msg.emailId || !token) return; const nextSpam = !msg.isSpam; setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isSpam: nextSpam } : m)); setAllEmails(prev => prev.map(e => e.id === msg.emailId ? { ...e, isSpam: nextSpam } : e)); try { await fetch(`http://localhost:5050/api/emails/${msg.emailId}/spam`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_spam: nextSpam }) }); window.dispatchEvent(new Event('mailRefresh')) } catch (err) { console.error('Error:', err); setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isSpam: msg.isSpam } : m)); setAllEmails(prev => prev.map(e => e.id === msg.emailId ? { ...e, isSpam: msg.isSpam } : e)) } }} />
                        )}
                        {/* Report */}
                        {msg.incoming && !msg.isDeleted && (
                          <ActionButton icon={<span style={{ position: 'relative', display: 'inline-flex' }}><Flag size={24} strokeWidth={1.5} fill={msg.isReport ? 'currentColor' : 'none'} /><span style={{ position: 'absolute', top: -2, right: -3, width: 11, height: 11, borderRadius: '50%', backgroundColor: '#7b5ea7', color: 'white', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid white' }}>!</span></span>} title={msg.isReport ? 'Unreport' : 'Report'} hoverBg="#7b5ea7" active={!!msg.isReport} onClick={async () => { if (!msg.emailId || !token) return; const nextReport = !msg.isReport; setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isReport: nextReport } : m)); setAllEmails(prev => prev.map(e => e.id === msg.emailId ? { ...e, isReport: nextReport } : e)); try { await fetch(`http://localhost:5050/api/emails/${msg.emailId}/report`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_report: nextReport }) }); window.dispatchEvent(new Event('mailRefresh')) } catch (err) { console.error('Error:', err); setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isReport: msg.isReport } : m)); setAllEmails(prev => prev.map(e => e.id === msg.emailId ? { ...e, isReport: msg.isReport } : e)) } }} />
                        )}
                        {/* View/Hide deleted */}
                        {msg.isDeleted && (
                          <ActionButton icon={viewedDeletedIds.has(msg.id) ? <EyeOff size={24} strokeWidth={1.5} /> : <Eye size={24} strokeWidth={1.5} />} title={viewedDeletedIds.has(msg.id) ? 'Hide deleted message' : 'View deleted message'} hoverBg="#f48fb1" onClick={() => { setViewedDeletedIds(prev => { const next = new Set(prev); if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id); return next }) }} />
                        )}
                        {/* Delete / Restore */}
                        <ActionButton icon={msg.isDeleted ? <RotateCcw size={24} strokeWidth={1.5} /> : <Trash2 size={24} strokeWidth={1.5} />} title={msg.isDeleted ? 'Restore' : 'Delete'} hoverBg={msg.isDeleted ? undefined : '#f48fb1'} onClick={() => {
                          const doDelete = async () => {
                            if (!msg.emailId || !token) return
                            const nextDeleted = !msg.isDeleted
                            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isDeleted: nextDeleted } : m)); setAllEmails(prev => prev.map(e => e.id === msg.emailId ? { ...e, isDeleted: nextDeleted } : e)); onEmailDeleteChange?.(msg.emailId, nextDeleted)
                            try { await fetch(`http://localhost:5050/api/emails/${msg.emailId}/delete`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ is_deleted: nextDeleted }) }); window.dispatchEvent(new Event('mailRefresh')) } catch (err) { console.error('Error:', err); setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isDeleted: msg.isDeleted } : m)); setAllEmails(prev => prev.map(e => e.id === msg.emailId ? { ...e, isDeleted: msg.isDeleted } : e)); onEmailDeleteChange?.(msg.emailId, msg.isDeleted ?? false) }
                          }
                          if (msg.isDeleted) { doDelete(); return }
                          setConfirmDialog({ title: 'Delete message?', message: 'Move this message to Trash?', onConfirm: doDelete })
                        }} />
                        {/* Permanently delete */}
                        {msg.isDeleted && (
                          <ActionButton icon={<Trash2 size={24} strokeWidth={1.5} />} title="Permanently delete" hoverBg="#f48fb1" onClick={() => {
                            setConfirmDialog({
                              title: 'Permanently delete?',
                              message: 'This message will be permanently deleted and cannot be recovered.',
                              onConfirm: async () => {
                                if (!msg.emailId || !token) return
                                setMessages(prev => prev.filter(m => m.id !== msg.id)); setAllEmails(prev => prev.filter(e => e.id !== msg.emailId))
                                try { await fetch(`http://localhost:5050/api/emails/${msg.emailId}/permanent`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); window.dispatchEvent(new Event('mailRefresh')) } catch (err) { console.error('Error:', err) }
                              },
                            })
                          }} />
                        )}
                        {/* Move to */}
                        {!msg.isDeleted && (
                          <ActionButton icon={<FolderInput size={24} strokeWidth={1.5} />} title="Move to" hoverBg="#78909c" onClick={(e) => handleMoveClick(msg.emailId, e)} />
                        )}
                        {/* Label badge */}
                        {(() => {
                          const email = allEmails.find(e => e.id === msg.emailId)
                          const labelName = email?.label_name
                          if (!labelName) return null
                          const flatLabel = flattenLabelsTree(customLabels).find(l => l.fullPath === labelName)
                          const color = flatLabel?.color || '#888'
                          const leafName = flatLabel?.leafName || labelName.split(' / ').pop() || labelName
                          const isFolder = flatLabel?.hasChildren
                          return (
                            <span title={labelName} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color, background: `${color}18`, border: `1px solid ${color}55`, borderRadius: '10px', padding: '2px 7px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {isFolder
                                ? <Folder size={11} style={{ flexShrink: 0, stroke: color, fill: 'none' }} />
                                : <Tag size={11} style={{ flexShrink: 0, stroke: color }} />}
                              {leafName}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                  {/* Scheduled Info */}
                  {msg.scheduledFor && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: '6px', marginRight: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4db6ac', fontSize: '12px', fontWeight: 600 }}>
                        <span className={new Date(msg.scheduledFor).getTime() <= now ? "active-scheduled-sent-icon-bg" : "active-scheduled-icon-bg"} style={{ width: '14px', height: '14px', backgroundSize: '14px 14px', margin: 0 }} />
                        {(() => {
                          const scheduledDate = new Date(msg.scheduledFor!);
                          const nowTime = new Date(now);
                          const time = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                          const isToday = scheduledDate.getFullYear() === nowTime.getFullYear()
                            && scheduledDate.getMonth() === nowTime.getMonth()
                            && scheduledDate.getDate() === nowTime.getDate();
                          
                          let dateStr = '';
                          if (isToday) {
                            dateStr = `Today ${time}`;
                          } else {
                            const day = scheduledDate.getDate();
                            const month = scheduledDate.toLocaleString('default', { month: 'short' });
                            dateStr = scheduledDate.getFullYear() === nowTime.getFullYear() ? `${day} ${month} ${nowTime.getFullYear()}` : `${day} ${month} ${scheduledDate.getFullYear()}`;
                            dateStr = `${dateStr} ${time}`;
                          }

                          if (scheduledDate.getTime() <= nowTime.getTime()) {
                            return <>Scheduled for {dateStr} <span style={{ opacity: 0.7, fontWeight: 400 }}>· {getTimeAgo(msg.scheduledFor)}</span></>;
                          }
                          
                          return <>Scheduled for {dateStr}</>;
                        })()}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        {new Date(msg.scheduledFor).getTime() > now && (
                          <div style={{ width: '120px', height: '3px', backgroundColor: '#b2dfdb', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', animation: `schedule-progress ${Math.max(0, new Date(msg.scheduledFor).getTime() - new Date(msg.date || Date.now()).getTime())}ms linear forwards`, animationDelay: `-${Math.max(0, Date.now() - new Date(msg.date || Date.now()).getTime())}ms` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Snoozed Info */}
                  {msg.isSnoozed && msg.snoozedUntil && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', paddingLeft: msg.incoming ? '4px' : '0', paddingRight: msg.incoming ? '0' : '4px', justifyContent: msg.incoming ? 'flex-start' : 'flex-end' }}>
                      <Clock size={12} color="#ff8c00" />
                      <span style={{ fontSize: '11px', color: '#ff8c00', fontWeight: 600 }}>
                        {(() => {
                          const d = new Date(msg.snoozedUntil!)
                          const nowTime = new Date()
                          const isPast = d.getTime() <= nowTime.getTime()
                          const isToday = d.getFullYear() === nowTime.getFullYear() && d.getMonth() === nowTime.getMonth() && d.getDate() === nowTime.getDate()
                          const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                          let dateStr = ''
                          if (isToday) dateStr = `Today ${time}`
                          else {
                            const day = d.getDate()
                            const month = d.toLocaleString('default', { month: 'short' })
                            dateStr = d.getFullYear() === nowTime.getFullYear() ? `${day} ${month} ${time}` : `${day} ${month} ${d.getFullYear()} ${time}`
                          }
                          return isPast
                            ? <span>Snoozed until {dateStr} <span style={{ opacity: 0.7, fontWeight: 400 }}>· {getTimeAgo(msg.snoozedUntil)}</span></span>
                            : `Snoozed until ${dateStr}`
                        })()}
                      </span>
                    </div>
                  )}
                  </div>
                  {/* Outgoing avatar */}
                  {!msg.incoming && (() => {
                    const avatarEmail = userEmail || ''
                    return (
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: getAvatarColor(avatarEmail), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '11px', flexShrink: 0, alignSelf: 'flex-start', marginTop: '4px' }}>
                        {getAvatarInitials(avatarEmail)}
                      </div>
                    )
                  })()}
                </div>
              </div>
              </div>
            )
            })}
            <div ref={messagesEndRef} />
          </div>


          {/* Resize handle */}
          <div
            className="chatmail-thread-resize-handle"
            onMouseDown={handleInputResizeDrag}
            style={{ height: '6px', flexShrink: 0, cursor: 'row-resize', backgroundColor: '#f0f0f0', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ width: '40px', height: '2px', borderRadius: '2px', backgroundColor: '#bbb' }} />
          </div>

          {/* Input */}
          <div ref={setComposeInlineSlot} style={{ display: 'contents' }} />
        </div>
      )}
          {(() => { const composeBox = (
          <div className="chatmail-thread-input" style={composeFloating ? {
            position: 'fixed', zIndex: 500,
            top: floatPos?.y ?? 0, left: floatPos?.x ?? 0,
            width: composeFloatMinimized ? '300px' : `${floatSize?.width ?? 760}px`,
            height: composeFloatMinimized ? '50px' : `${floatSize?.height ?? 720}px`,
            visibility: isOverflowedMinimized ? 'hidden' : 'visible', pointerEvents: isOverflowedMinimized ? 'none' : 'auto',
            overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0px 0px 0px', boxSizing: 'border-box',
            backgroundColor: discardFlash ? '#ffebee' : '#fff',
            border: '1px solid #ddd', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
            transition: 'background-color 0.4s ease',
          } : { flexShrink: 0, height: `${inputPanelHeight}px`, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '10px 16px 6px', margin: '1px', boxSizing: 'border-box', backgroundColor: discardFlash ? '#ffebee' : 'transparent', transition: 'height 0.2s ease, background-color 0.4s ease' }}>
            {composeFloating && !composeFloatMinimized && (<>
              <div onMouseDown={e => handleFloatResizeStart(e, 'top')} style={{ position: 'absolute', top: 0, left: 12, right: 12, height: '8px', cursor: 'ns-resize', zIndex: 3 }} />
              <div onMouseDown={e => handleFloatResizeStart(e, 'left')} style={{ position: 'absolute', top: 12, left: 0, bottom: 12, width: '10px', cursor: 'ew-resize', zIndex: 1 }} />
              <div onMouseDown={e => handleFloatResizeStart(e, 'right')} style={{ position: 'absolute', top: 12, right: 0, bottom: 12, width: '10px', cursor: 'ew-resize', zIndex: 1 }} />
              <div onMouseDown={e => handleFloatResizeStart(e, 'bottom')} style={{ position: 'absolute', left: 0, bottom: 0, right: 12, height: '10px', cursor: 'ns-resize', zIndex: 1 }} />
              <div onMouseDown={e => handleFloatResizeStart(e, 'corner')} style={{ position: 'absolute', right: 0, bottom: 0, width: '16px', height: '16px', cursor: 'nwse-resize', zIndex: 2 }} />
            </>)}
            {composeFloating && (
              <div
                onMouseDown={handleFloatDragStart}
                onClick={() => {
                  if (!composeFloatMinimized) return
                  setComposeFloatMinimized(false)
                  
                  if (window.location.pathname !== '/chatmail') {
                    sessionStorage.setItem('chatMailReturnPath', window.location.pathname)
                  }

                  // Restore the chat view so the draft is what's actually shown.
                  setViewMode('chat')
                  setSelectedConversation(null)

                  if (contactEmail) {
                    if (onOpenContact) {
                      onOpenContact(contactEmail)
                    }
                  }

                  suppressAutoReminimizeRef.current = true
                  window.dispatchEvent(new Event('chatmail:openDraftView'))
                  // Safety net: if we were already on /chatmail, navKey never changes
                  // and the effect that consumes/clears this flag never runs — clear it
                  // here so a later, unrelated navigation isn't wrongly suppressed too.
                  setTimeout(() => { suppressAutoReminimizeRef.current = false }, 300)

                  // The minimized strip is anchored left/bottom; expanding from that same
                  // position would cover whatever view's back arrow/header sits top-left
                  // of the content area. Land in the safe top-right corner instead.
                  const w = floatSize?.width ?? 760
                  const h = floatSize?.height ?? 720
                  setFloatPos(computeSafeExpandPos(w))
                }}
                style={{ flexShrink: 0, height: '36px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px 0 12px', backgroundColor: '#1a73e8', color: '#fff', cursor: composeFloatMinimized ? 'pointer' : 'move', borderRadius: '11px 11px 0 0', userSelect: 'none' }}
              >
                <Mail size={15} />
                <span style={{ flex: 1, fontSize: '17px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {toEmails.length > 0 ? toEmails.map((email, i) => {
                    const [name, domain] = email.split('@')
                    return (
                      <span key={email}>
                        {i > 0 && <span style={{ color: 'rgba(255,255,255,0.6)' }}>, </span>}
                        <span style={{ fontWeight: 600 }}>{name}</span>
                        {domain && <span style={{ fontWeight: 300, color: 'rgba(255,255,255,0.8)' }}>@{domain}</span>}
                      </span>
                    )
                  }) : <span style={{ fontWeight: 600 }}>{subjectValue || 'New message'}</span>}
                </span>
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => {
                    setComposeFloatMinimized(m => {
                      const next = !m
                      // Dock the minimized strip at the bottom of the middle-bar (the main
                      // content column), offset by slot index so it lines up alongside any
                      // other already-minimized strips instead of overlapping them.
                      if (next) {
                        const pos = computeMinimizedPos(floatSlotIndex)
                        if (pos) setFloatPos(pos)
                      }
                      return next
                    })
                  }}
                  title={composeFloatMinimized ? 'Expand' : 'Minimize'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {composeFloatMinimized ? <Square size={12} /> : <Minus size={14} />}
                </button>
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => { setComposeFloating(false); setComposeFloatMinimized(false); setFloatPos(null); setFloatingDraftId(null) }}
                  title="Close floating panel"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <XIcon size={14} />
                </button>
              </div>
            )}
            {/* Reply/Forward indicator */}
            {(inputValue.startsWith('@') || inputValue.startsWith('Fwd:')) && (
              <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#f0f0f0', borderRadius: '4px', fontSize: '13px' }}>
                <span style={{ flex: 1, color: '#666' }}>
                  {inputValue.startsWith('Fwd:') ? '↪️ Forwarding' : '↩️ Replying'}
                </span>
                <button
                  onClick={() => {
                    const sourceId = replyEmailCard?.sourceMessageId
                    setSubjectValue(''); setInputValue(''); setReplyEmailCard(null)
                    if (sourceId) document.querySelector(`[data-msg-id="${sourceId}"]`)?.scrollIntoView({ behavior: 'instant', block: 'start' })
                  }}
                  style={{
                    background: 'none',
                    backgroundColor: 'white', border: 'none',
                    cursor: 'pointer',
                    color: '#666',
                    fontSize: '13px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e0e0e0'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  title="Cancel reply/forward"
                >
                  Cancel
                </button>
              </div>
            )}
            {/* Original email card shown when replying/forwarding */}
            {replyEmailCard && (
              <div style={{ marginBottom: '10px', overflow: 'hidden' }}>
                <div style={{ height: replyCardCollapsed ? 'auto' : '200px', border: replyEmailCard.action === 'forward' ? '2px solid #8e24aa' : '2px solid #4db6ac', borderRadius: '10px', backgroundColor: '#ffffff', boxShadow: replyEmailCard.action === 'forward' ? '0 0 12px rgba(142, 36, 170, 0.45)' : '0 0 12px rgba(77, 182, 172, 0.55)', display: 'flex', flexDirection: 'column', overflow: 'hidden', marginRight: '20px', transition: 'height 0.2s ease' }}>
                  {/* Card header */}
                  <div style={{ padding: '10px 12px 8px', borderBottom: replyCardCollapsed ? 'none' : (replyEmailCard.action === 'forward' ? '1px solid rgba(142,36,170,0.2)' : '1px solid rgba(77,182,172,0.2)'), display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, backgroundColor: replyEmailCard.action === 'forward' ? '#f3e5f5' : '#e0f2f1' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: replyEmailCard.action === 'forward' ? '#8e24aa' : '#4db6ac', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                      {(replyEmailCard.from.match(/<([^>]+)>/)?.[1] ?? replyEmailCard.from).charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: replyEmailCard.action === 'forward' ? '#6a1b9a' : '#00796b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {replyEmailCard.action === 'forward' ? 'Forwarding' : 'Replying to'}
                      </div>
                      <div style={{ fontSize: '14px', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                        {replyEmailCard.from.includes('@') ? (
                          <>
                            <span style={{ fontWeight: 600, color: '#111' }}>{replyEmailCard.from.split('@')[0]}</span>
                            <span style={{ fontWeight: 300, color: '#555' }}>@{replyEmailCard.from.split('@')[1]}</span>
                          </>
                        ) : replyEmailCard.from}
                      </div>
                    </div>
                    {/* Collapse / Expand toggle */}
                    <button
                      onClick={() => setReplyCardCollapsed(c => !c)}
                      title={replyCardCollapsed ? 'Expand' : 'Collapse'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '20px', height: '20px', flexShrink: 0, transition: 'transform 0.2s ease' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = '#333' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#888' }}
                    >
                      <ChevronDown size={14} style={{ transform: replyCardCollapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s ease' }} />
                    </button>
                    {replyEmailCard.action !== 'forward' && (
                    <button
                      onClick={() => {
                        setInputValue(replyEmailCard.body);
                        setReplyEmailCard(null);
                      }}
                      title="Edit message"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '20px', height: '20px', flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = '#333' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#888' }}
                    >
                      <PenLine size={13} />
                    </button>
                    )}
                    <button
                      onClick={() => {
                        setConfirmDialog({
                          title: replyEmailCard.action === 'forward' ? 'Discard forward?' : 'Discard reply?',
                          message: 'This will remove the quoted message and any text you\'ve typed. This cannot be undone.',
                          onConfirm: () => {
                            const sourceId = replyEmailCard.sourceMessageId
                            setSubjectValue(''); setInputValue(''); setReplyEmailCard(null)
                            if (sourceId) document.querySelector(`[data-msg-id="${sourceId}"]`)?.scrollIntoView({ behavior: 'instant', block: 'start' })
                            // Flush immediately (rather than waiting for the 2s autosave debounce)
                            // so other open email/chatmail lists reflect the discard right away —
                            // deferred a tick so flushDraftSaveRef sees the just-cleared fields.
                            setTimeout(() => flushDraftSaveRef.current(), 0)
                          }
                        })
                      }}
                      title="Dismiss"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '20px', height: '20px', flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = '#333' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#888' }}
                    >
                      ×
                    </button>
                  </div>
                  {/* Card body — hidden when collapsed */}
                  {!replyCardCollapsed && (
                    <div style={{ padding: '10px 12px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {replyEmailCard.subject || '(No subject)'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', flexShrink: 0 }}>
                        {replyEmailCard.date ? new Date(replyEmailCard.date).toLocaleString() : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: '#555', overflowY: 'auto', flex: 1, lineHeight: 1.5 }}>
                        {replyEmailCard.body}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* To field + Send/Discard */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '6px', flexShrink: 0, padding: composeFloating ? '5px 5px 0' : 0 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '4px', padding: '3px 10px', flexWrap: 'wrap', gap: '4px', backgroundColor: '#fff' }}>
                <span style={{ fontSize: '14px', color: '#666', fontWeight: 600, marginRight: '4px', flexShrink: 0 }}>To</span>
                {(() => {
                  const groupChipEmails = composeGroupMembers.length > 0 ? toEmails.filter(e => composeGroupMembers.includes(e)) : []
                  if (groupChipEmails.length === 0) return null
                  return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#ede7f6', borderRadius: '12px', padding: '2px 8px', fontSize: '17px' }}>
                      <Users size={14} style={{ color: '#6a1b9a' }} />
                      <span style={{ fontWeight: 600, color: '#6a1b9a' }}>{composeGroupLabel}</span>
                      <span style={{ fontWeight: 300, color: '#8d5fb3' }}>({groupChipEmails.length})</span>
                      {!messageSent && (
                        <button
                          onClick={() => {
                            setToEmails(toEmails.filter(e => !composeGroupMembers.includes(e)))
                            setInitialToEmails(initialToEmails.filter(e => !composeGroupMembers.includes(e)))
                            setComposeGroupLabel(null)
                            setComposeGroupMembers([])
                            setComposeGroupId(null)
                          }}
                          style={{ background: 'none', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#6a1b9a', padding: '0', lineHeight: 1, fontSize: '14px' }}
                        >×</button>
                      )}
                    </span>
                  )
                })()}
                {toEmails.filter(email => !composeGroupMembers.includes(email)).map(email => {
                  const isExisting = initialToEmails.includes(email)
                  const isLocked = messageSent || isExisting || (contactEmail && email.toLowerCase() === contactEmail.toLowerCase())
                  const [name, domain] = email.split('@')
                  return (
                    <span key={email} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: isLocked ? '#f5f5f5' : '#e8f0fe', borderRadius: '12px', padding: '2px 8px', fontSize: '17px' }}>
                      <span style={{ fontWeight: 600, color: isLocked ? '#555' : '#1a73e8' }}>{name}</span>
                      {domain && <span style={{ fontWeight: 300, color: isLocked ? '#888' : '#5a90c8' }}>@{domain}</span>}
                      {!isLocked && (
                        <button onClick={() => removeTag(email, toEmails, setToEmails)} style={{ background: 'none', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#1a73e8', padding: '0', lineHeight: 1, fontSize: '14px' }}>×</button>
                      )}
                    </span>
                  )
                })}
                {!messageSent && (
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <input
                      type="text"
                      value={toInput}
                      onChange={e => { setToInput(e.target.value); hasInteractedRef.current = true; setMessageSent(false); }}
                      onFocus={() => setActiveField('to')}
                      onBlur={() => {
                        const blurConv = currentConvIdRef.current;
                        setTimeout(() => {
                          if (currentConvIdRef.current !== blurConv) return;
                          if (isClearingRef.current) return;
                          setActiveField(null)
                        }, 150)
                      }}
                      onKeyDown={e => handleTagKeyDown(e, toInput, toEmails, setToEmails, setToInput, conversations.find(c => c.id === selectedConversation)?.email)}
                      placeholder={toEmails.length === 0 ? 'Recipients...' : ''}
                      style={{ width: '100%', backgroundColor: 'white', border: 'none', outline: 'none', fontSize: '17px', fontFamily: 'inherit', padding: '4px 0' }}
                    />
                  </div>
                )}
                {!messageSent && (
                  <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                    <button onClick={() => setShowCc(!showCc)} style={{ fontSize: '12px', padding: '2px 8px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: showCc ? '#e8f0fe' : '#fff', color: showCc ? '#1a73e8' : '#666', fontWeight: 600 }}>CC</button>
                    <button onClick={() => setShowBcc(!showBcc)} style={{ fontSize: '12px', padding: '2px 8px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: showBcc ? '#e8f0fe' : '#fff', color: showBcc ? '#1a73e8' : '#666', fontWeight: 600 }}>BCC</button>
                  </div>
                )}
              </div>
              {activeField === 'to' && toInput.trim().length > 0 && (() => {
                const suggestions = getSuggestions(toInput, toEmails)
                return (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: '#fff', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', marginTop: '2px', overflow: 'hidden' }}>
                    {suggestions.length > 0 ? (
                      suggestions.map(c => (
                        <div key={c.email} onMouseDown={e => { e.preventDefault(); addTagSilent(c.email, toEmails, setToEmails, setToInput) }}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer', fontSize: '13px' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                          <span style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#1a73e8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>{c.initials}</span>
                          <span style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 500, color: '#222' }}>{c.name}</span>
                            <span style={{ color: '#888', fontSize: '12px' }}>{c.email}</span>
                          </span>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '8px 12px', fontSize: '12px', color: '#666' }}>
                        Press <strong>Space</strong>, <strong>Enter</strong>, or <strong>,</strong> to add <span style={{ color: '#1a73e8', fontWeight: 500 }}>{toInput.trim()}</span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
              {/* Split Send Button */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0, gap: '6px' }}>
                 {/* Expand / Collapse compose panel toggle */}
                 <button
                   className="chatmail-expand-toggle"
                   onClick={() => {
                     const next = !composePanelExpanded
                     setComposePanelExpanded(next)
                     setInputPanelHeight(next ? 600 : 248)
                   }}
                   style={{ width: '25px', height: '25px', padding: '0', backgroundColor: 'transparent', color: '#555', border: '1px solid #ccc', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                   onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f0f0f0'; e.currentTarget.style.borderColor = '#999' }}
                   onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = '#ccc' }}
                   title={composePanelExpanded ? 'Collapse compose panel' : 'Expand compose panel to maximum'}
                 >
                   <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                     {composePanelExpanded
                       ? <polyline points='18 15 12 9 6 15' />
                       : <polyline points='6 9 12 15 18 9' />}
                   </svg>
                 </button>
                <div style={{ display: 'flex' }}>
                  <button
                    onClick={handleSendMessage}
                    style={{ padding: '8px 14px', backgroundColor: '#2196f3', color: 'white', border: 'none', borderRight: '1px solid rgba(255,255,255,0.3)', borderRadius: '20px 0 0 20px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Send size={15} />
                    Send
                  </button>
                  <button
                    className="send-dropdown-btn"
                    onClick={(e) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setSendDropdownPos({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }); setSendDropdownOpen(o => !o); setShowSchedulePopup(false) }}
                    style={{ padding: '8px 7px', backgroundColor: '#2196f3', color: 'white', border: 'none', borderRadius: '0 20px 20px 0', cursor: 'pointer', fontSize: '12px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                    title="More send options"
                  >
                    <span style={{ fontSize: '20px', lineHeight: 1 }}>▾</span>
                  </button>
                </div>
                <button
                  onClick={() => {
                    setConfirmDialog({
                      title: 'Discard draft?',
                      message: 'This will permanently discard the current draft, including any text, attachments, and canvas drawing. This cannot be undone.',
                      onConfirm: () => {
                        setDiscardFlash(true)
                        setTimeout(() => setDiscardFlash(false), 400)
                        const sourceId = replyEmailCard?.sourceMessageId
                        setSubjectValue(''); setReplyEmailCard(null)
                        if (canvasMode) closeCanvasMode(true)
                        clearInputs(false)
                        // The draft itself is correctly deleted by clearInputs, but the floating
                        // panel otherwise stays open (now empty) — closing it here avoids leaving
                        // a hollow strip behind that looks like the discard didn't take effect.
                        if (composeFloating) {
                          setComposeFloating(false)
                          setComposeFloatMinimized(false)
                          setFloatPos(null)
                          setFloatingDraftId(null)
                        }
                        if (window.name === 'compose_window') {
                          window.close()
                        } else if (sourceId) {
                          document.querySelector(`[data-msg-id="${sourceId}"]`)?.scrollIntoView({ behavior: 'instant', block: 'start' })
                        }
                      }
                    })
                  }}
                  style={{ padding: '3px', backgroundColor: 'transparent', color: '#f44336', border: '1px solid #f44336', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#ffebee' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                  title="Discard draft"
                >
                  <Trash2 size={16} />
                  <span style={{ fontSize: '8px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Discard</span>
                </button>
                 {/* Float compose as an in-page draggable panel */}
                 {!composeFloating && (
                 <button
                   className="chatmail-new-window-btn"
                   onClick={() => {
                     setComposeFloating(true)
                     setFloatingDraftId(draftIdRef.current)
                     const w = floatSize?.width ?? 760
                     // Safe top-right corner — bottom-right anchoring can overlap this
                     // view's back arrow/header on smaller viewports, blocking the very
                     // click needed to minimize it.
                     setFloatPos(computeSafeExpandPos(w))
                   }}
                   style={{ padding: '2px', backgroundColor: 'transparent', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', transition: 'all 0.15s' }}
                   onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e8f0fe' }}
                   onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                   title='Open compose in floating window'
                 >
                   <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                     <polyline points='15 3 21 3 21 9' />
                     <path d='M10 14L21 3' />
                     <path d='M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6' />
                   </svg>
                   <span style={{ fontSize: '8px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.2 }}>New<br />window</span>
                 </button>
                 )}
                {sendDropdownOpen && sendDropdownPos && createPortal(
                  <div className="send-dropdown-menu" style={{ position: 'fixed', bottom: sendDropdownPos.bottom, right: sendDropdownPos.right, backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minWidth: '320px', zIndex: 99999 }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ padding: '8px 16px 6px', fontSize: '12px', fontWeight: 600, color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="active-scheduled-icon-bg" style={{ width: '13px', height: '13px', backgroundSize: '13px 13px', margin: 0 }} />
                      Schedule send
                    </div>
                    {getDynamicSnoozeOptions().map(opt => (
                      <button key={opt.label} style={{ width: '100%', padding: '10px 16px', backgroundColor: 'white', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', cursor: 'pointer', fontSize: '13px' }} onClick={() => handleQuickSchedule(opt.hours)} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f5f5'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                        <span>{opt.shortLabel}</span>
                        <span style={{ color: '#888', fontWeight: 500, fontSize: '13px', whiteSpace: 'nowrap' }}>{opt.timeText}</span>
                      </button>
                    ))}
                    <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
                    {/* Pick date & time — hover sub-menu */}
                    <div style={{ position: 'relative' }}>
                      <div
                        style={{ width: '100%', padding: '13px 16px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', boxSizing: 'border-box', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f5f5f5'
                          if (pickerDropdownTimer.current) clearTimeout(pickerDropdownTimer.current)
                          const ref = new Date(); const h = ref.getHours()
                          setScheduleHour(h % 12 || 12); setScheduleMinute(ref.getMinutes())
                          setSchedulePeriod(h >= 12 ? 'PM' : 'AM')
                          setCalendarViewMonth(ref.getMonth()); setCalendarViewYear(ref.getFullYear())
                          setScheduleDate('')
                          setShowPickerDropdown(true)
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white'
                          pickerDropdownTimer.current = setTimeout(() => setShowPickerDropdown(false), 150)
                        }}
                      >
                        <Calendar size={17} style={{ flexShrink: 0, color: '#0288d1' }} />
                        Pick date &amp; time
                        <span style={{ marginLeft: 'auto', color: '#0288d1', fontSize: '22px', lineHeight: 1, fontWeight: 400 }}>›</span>
                      </div>

                      {showPickerDropdown && (() => {
                        const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
                        const todayStr = new Date().toISOString().slice(0, 10)
                        const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate()
                        const firstDay = new Date(calendarViewYear, calendarViewMonth, 1).getDay()
                        return (
                          <div
                            onMouseEnter={() => { if (pickerDropdownTimer.current) clearTimeout(pickerDropdownTimer.current) }}
                            onMouseLeave={() => { pickerDropdownTimer.current = setTimeout(() => setShowPickerDropdown(false), 150) }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ position: 'fixed', bottom: sendDropdownPos ? sendDropdownPos.bottom : 0, right: sendDropdownPos ? sendDropdownPos.right + 328 : 0, background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', boxShadow: '0 6px 24px rgba(0,0,0,0.15)', zIndex: 99999, display: 'flex', flexDirection: 'column', minWidth: '380px' }}
                          >
                            {/* Header */}
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Calendar size={15} color="#0288d1" />
                              <span style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>Pick date &amp; time</span>
                            </div>

                            {/* Body: calendar left, date+time right */}
                            <div style={{ display: 'flex' }}>
                              {/* Left: calendar */}
                              <div style={{ padding: '16px', borderRight: '1px solid #e0e0e0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>{MONTH_NAMES[calendarViewMonth]} {calendarViewYear}</span>
                                  <div style={{ display: 'flex', gap: '2px' }}>
                                    <button onClick={(e) => { e.stopPropagation(); calendarViewMonth === 0 ? (setCalendarViewMonth(11), setCalendarViewYear(y => y - 1)) : setCalendarViewMonth(m => m - 1) }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background 0.15s' }}>‹</button>
                                    <button onClick={(e) => { e.stopPropagation(); calendarViewMonth === 11 ? (setCalendarViewMonth(0), setCalendarViewYear(y => y + 1)) : setCalendarViewMonth(m => m + 1) }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background 0.15s' }}>›</button>
                                  </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 34px)', marginBottom: '4px' }}>
                                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ fontSize: '11px', color: '#bbb', textAlign: 'center', padding: '3px 0', fontWeight: 600 }}>{d}</div>)}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 34px)', gap: '2px' }}>
                                  {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                    const dateStr = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                                    const isSelected = scheduleDate === dateStr
                                    const isToday = dateStr === todayStr
                                    const isPast = dateStr < todayStr
                                    return <button key={day} disabled={isPast} onClick={(e) => { e.stopPropagation(); setScheduleDate(dateStr) }} onMouseEnter={() => { if (!isPast) setHoveredCalendarDay(dateStr) }} onMouseLeave={() => setHoveredCalendarDay(null)} style={{ width: '34px', height: '34px', border: 'none', borderRadius: '50%', cursor: isPast ? 'default' : 'pointer', background: isSelected ? '#0288d1' : hoveredCalendarDay === dateStr ? '#e0f0fa' : 'transparent', color: isSelected ? '#fff' : isPast ? '#ddd' : isToday ? '#0288d1' : '#333', fontWeight: isSelected || isToday ? 700 : 400, fontSize: '13px', transition: 'background 0.12s' }}>{day}</button>
                                  })}
                                </div>
                              </div>

                              {/* Right: date display + time inputs */}
                              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '180px' }}>
                                <div>
                                  <div style={{ fontSize: '12px', color: '#888', fontWeight: 500, marginBottom: '4px' }}>Date</div>
                                  <div style={{ fontSize: '14px', color: scheduleDate ? '#333' : '#ccc', fontWeight: scheduleDate ? 500 : 400 }}>
                                    {scheduleDate ? (() => { const [y,m,d] = scheduleDate.split('-'); return `${d}/${m}/${y}` })() : 'DD/MM/YYYY'}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '12px', color: '#888', fontWeight: 500, marginBottom: '8px' }}>Time</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <input type="number" min={1} max={12} value={scheduleHour} onClick={(e) => e.stopPropagation()} onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) setScheduleHour(Math.min(12, Math.max(1, v))) }} onBlur={(e) => { const v = Number(e.target.value); setScheduleHour(isNaN(v) || v < 1 ? 1 : v > 12 ? 12 : v) }} style={{ width: '48px', padding: '7px 4px', border: '1.5px solid #c0c0c0', borderRadius: '7px', fontSize: '15px', outline: 'none', textAlign: 'center', MozAppearance: 'textfield', fontWeight: 600, fontFamily: 'inherit' } as React.CSSProperties} />
                                    <span style={{ fontWeight: 700, color: '#555', fontSize: '15px' }}>:</span>
                                    <input type="number" min={0} max={59} value={String(scheduleMinute).padStart(2, '0')} onClick={(e) => e.stopPropagation()} onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) setScheduleMinute(Math.min(59, Math.max(0, v))) }} onBlur={(e) => { const v = Number(e.target.value); setScheduleMinute(isNaN(v) || v < 0 ? 0 : v > 59 ? 59 : v) }} style={{ width: '48px', padding: '7px 4px', border: '1.5px solid #c0c0c0', borderRadius: '7px', fontSize: '15px', outline: 'none', textAlign: 'center', MozAppearance: 'textfield', fontWeight: 600, fontFamily: 'inherit' } as React.CSSProperties} />
                                    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '7px', overflow: 'hidden', border: '1.5px solid #c0c0c0', marginLeft: '2px' }}>
                                      {(['AM', 'PM'] as const).map(p => <button key={p} onClick={(e) => { e.stopPropagation(); setSchedulePeriod(p) }} style={{ padding: '6px 8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: schedulePeriod === p ? '#0288d1' : '#fafafa', color: schedulePeriod === p ? '#fff' : '#999', transition: 'background 0.15s' }}>{p}</button>)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Footer */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '10px 16px', borderTop: '1px solid #e0e0e0' }}>
                              <button onClick={() => setShowPickerDropdown(false)} style={{ padding: '6px 16px', borderRadius: '16px', border: '1px solid #e0e0e0', background: '#fff', color: '#555', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                              <button disabled={!scheduleDate} onClick={(e) => { e.stopPropagation(); if (!scheduleDate) return; const hour24 = schedulePeriod === 'AM' ? scheduleHour % 12 : (scheduleHour % 12) + 12; handleScheduleSend(`${scheduleDate}T${String(hour24).padStart(2,'0')}:${String(scheduleMinute).padStart(2,'0')}`); setShowPickerDropdown(false); setSendDropdownOpen(false) }} style={{ padding: '6px 16px', borderRadius: '16px', border: 'none', background: scheduleDate ? '#0288d1' : '#b3d9f0', color: '#fff', fontSize: '13px', cursor: scheduleDate ? 'pointer' : 'not-allowed', fontWeight: 600 }}>Schedule send</button>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                    <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
                    <button
                      onClick={handleMergeSend}
                      style={{ width: '100%', padding: '10px 16px', backgroundColor: 'white', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}
                    >
                      ⤴ Merge Send
                    </button>
                  </div>,
                  document.body
                )}
              </div>
            </div>

            {/* CC field */}
            {showCc && (
              <div style={{ position: 'relative', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '4px', padding: '4px 8px', flexWrap: 'wrap', gap: '4px', backgroundColor: '#fff' }}>
                  <span style={{ fontSize: '13px', color: '#666', fontWeight: 600, marginRight: '4px', flexShrink: 0 }}>CC</span>
                  {ccEmails.map(email => (
                    <span key={email} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#fce8e6', color: '#d93025', borderRadius: '12px', padding: '2px 8px', fontSize: '13px' }}>
                      {email}
                      <button onClick={() => removeTag(email, ccEmails, setCcEmails)} style={{ background: 'none', backgroundColor: 'white', border: 'none', cursor: 'pointer', color: '#d93025', padding: '0', lineHeight: 1, fontSize: '14px' }}>×</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={ccInput}
                    onChange={e => { setCcInput(e.target.value); hasInteractedRef.current = true; setMessageSent(false); }}
                    onFocus={() => setActiveField('cc')}
                    onBlur={() => {
                      const blurConv = currentConvIdRef.current;
                      setTimeout(() => {
                        if (currentConvIdRef.current !== blurConv) return;
                        if (isClearingRef.current) return;
                        setActiveField(null);
                        addTagSilent(ccInput, ccEmails, setCcEmails, setCcInput)
                      }, 150)
                    }}
                    onKeyDown={e => handleTagKeyDown(e, ccInput, ccEmails, setCcEmails, setCcInput)}
                    placeholder={ccEmails.length === 0 ? 'CC recipients...' : ''}
                    style={{ flex: 1, minWidth: '120px', backgroundColor: 'white', border: 'none', outline: 'none', fontSize: '14px', fontFamily: 'inherit', padding: '4px 0' }}
                  />
                </div>
                {activeField === 'cc' && ccInput.trim().length > 0 && (() => {
                  const suggestions = getSuggestions(ccInput, ccEmails)
                  return (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: '#fff', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', marginTop: '2px', overflow: 'hidden' }}>
                      {suggestions.length > 0 ? (
                        suggestions.map(c => (
                          <div key={c.email} onMouseDown={e => { e.preventDefault(); addTagSilent(c.email, ccEmails, setCcEmails, setCcInput) }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer', fontSize: '13px' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                            <span style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#d93025', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>{c.initials}</span>
                            <span style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 500, color: '#222' }}>{c.name}</span>
                              <span style={{ color: '#888', fontSize: '12px' }}>{c.email}</span>
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '8px 12px', fontSize: '12px', color: '#666' }}>
                          Press <strong>Space</strong>, <strong>Enter</strong>, or <strong>,</strong> to add <span style={{ color: '#d93025', fontWeight: 500 }}>{ccInput.trim()}</span>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* BCC field */}
            {showBcc && (
              <div style={{ position: 'relative', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '4px', padding: '4px 8px', flexWrap: 'wrap', gap: '4px', backgroundColor: '#fff' }}>
                  <span style={{ fontSize: '13px', color: '#666', fontWeight: 600, marginRight: '4px', flexShrink: 0 }}>BCC</span>
                  {bccEmails.map(email => (
                    <span key={email} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#e6f4ea', color: '#188038', borderRadius: '12px', padding: '2px 8px', fontSize: '13px' }}>
                      {email}
                      <button onClick={() => removeTag(email, bccEmails, setBccEmails)} style={{ background: 'none', backgroundColor: 'white', border: 'none', cursor: 'pointer', color: '#188038', padding: '0', lineHeight: 1, fontSize: '14px' }}>×</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={bccInput}
                    onChange={e => { setBccInput(e.target.value); hasInteractedRef.current = true; setMessageSent(false); }}
                    onFocus={() => setActiveField('bcc')}
                    onBlur={() => {
                      const blurConv = currentConvIdRef.current;
                      setTimeout(() => {
                        if (currentConvIdRef.current !== blurConv) return;
                        if (isClearingRef.current) return;
                        setActiveField(null);
                        addTagSilent(bccInput, bccEmails, setBccEmails, setBccInput)
                      }, 150)
                    }}
                    onKeyDown={e => handleTagKeyDown(e, bccInput, bccEmails, setBccEmails, setBccInput)}
                    placeholder={bccEmails.length === 0 ? 'BCC recipients...' : ''}
                    style={{ flex: 1, minWidth: '120px', backgroundColor: 'white', border: 'none', outline: 'none', fontSize: '14px', fontFamily: 'inherit', padding: '4px 0' }}
                  />
                </div>
                {activeField === 'bcc' && bccInput.trim().length > 0 && (() => {
                  const suggestions = getSuggestions(bccInput, bccEmails)
                  return (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: '#fff', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', marginTop: '2px', overflow: 'hidden' }}>
                      {suggestions.length > 0 ? (
                        suggestions.map(c => (
                          <div key={c.email} onMouseDown={e => { e.preventDefault(); addTagSilent(c.email, bccEmails, setBccEmails, setBccInput) }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer', fontSize: '13px' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                            <span style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#188038', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>{c.initials}</span>
                            <span style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 500, color: '#222' }}>{c.name}</span>
                              <span style={{ color: '#888', fontSize: '12px' }}>{c.email}</span>
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '8px 12px', fontSize: '12px', color: '#666' }}>
                          Press <strong>Space</strong>, <strong>Enter</strong>, or <strong>,</strong> to add <span style={{ color: '#188038', fontWeight: 500 }}>{bccInput.trim()}</span>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Subject field */}
            <input
              type="text"
              value={subjectValue}
              onChange={(e) => { setSubjectValue(e.target.value); hasInteractedRef.current = true; setMessageSent(false); }}
              placeholder="Subject..."
              style={{
                width: composeFloating ? 'calc(100% - 10px)' : '100%',
                padding: composeFloating ? '8px 5px' : '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                margin: composeFloating ? '0 5px 6px' : '0 0 6px 0',
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
            />
            {canvasResizeActive && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: `${canvasResizeActive}-resize` }} />
            )}
            {/* Message textarea / canvas area */}
            <div style={{ position: 'relative', flex: 1, minHeight: '50px', marginBottom: '4px', display: 'flex', flexDirection: 'column', padding: composeFloating ? '0 5px' : 0 }}>
              <div style={{ border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', background: '#fff', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '50px' }}>
                {(() => {
                  if (!canvasPortalTarget) return null
                  return createPortal(
                    <div ref={canvasWrapperRef} style={{ position: 'relative', display: 'block', width: canvasModeWidth ? `${canvasModeWidth}px` : '100%', height: `${canvasModeHeight}px`, overflow: 'hidden', border: '1px solid #1a73e8', borderRadius: '4px', background: '#fff', boxSizing: 'border-box', zIndex: 10 }}>
                      <canvas
                        ref={canvasModeRef}
                        style={{ position: 'absolute', left: `${canvasOffsetX}px`, top: `${canvasOffsetY}px`, width: canvasNaturalSize ? `${canvasNaturalSize.w}px` : '100%', height: canvasNaturalSize ? `${canvasNaturalSize.h}px` : '100%', transform: `scale(${canvasZoom})`, transformOrigin: '0 0', cursor: drawTool === 'eraser' ? (() => { const sz = Math.max(10, Math.min(128, Math.round(drawLineWidth * 4 * canvasZoom))); const hs = Math.round(sz / 2); return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${sz}' height='${sz}' viewBox='0 0 ${sz} ${sz}'%3E%3Ccircle cx='${hs}' cy='${hs}' r='${hs - 1}' fill='white' fill-opacity='0.85' stroke='%23555' stroke-width='1.5'/%3E%3Ccircle cx='${hs}' cy='${hs}' r='1.5' fill='%23555'/%3E%3C/svg%3E") ${hs} ${hs}, crosshair`; })() : drawTool === 'hand' ? 'grab' : drawTool === 'zoom-in' ? 'zoom-in' : drawTool === 'zoom-out' ? 'zoom-out' : drawTool === 'select' ? 'crosshair' : drawTool === 'text' ? 'text' : drawTool === 'line' || drawTool === 'rect' || drawTool === 'circle' || drawTool === 'triangle' || drawTool === 'diamond' || drawTool === 'star' ? 'crosshair' : "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cpath d='M0 0 L3 6 L6 3 Z' fill='%23111'/%3E%3Cpath d='M3 6 L6 3 L18 15 L15 18 Z' fill='%23333'/%3E%3Cpath d='M15 18 L18 15 L20 17 L18 20 Z' fill='%23bbb'/%3E%3C/svg%3E\") 0 0, crosshair", background: '#fff', borderRadius: '4px 4px 0 0' }}
                        onMouseDown={startCanvasModeDown}
                      />
                      {/* Lasso/Select overlay canvas */}
                      <canvas
                        ref={lassoOverlayRef}
                        style={{ position: 'absolute', left: `${canvasOffsetX}px`, top: `${canvasOffsetY}px`, width: canvasNaturalSize ? `${canvasNaturalSize.w}px` : '100%', height: canvasNaturalSize ? `${canvasNaturalSize.h}px` : '100%', transform: `scale(${canvasZoom})`, transformOrigin: '0 0', cursor: (drawTool === 'lasso' || drawTool === 'select') ? (hasLassoSel ? 'move' : 'crosshair') : 'default', pointerEvents: (drawTool === 'lasso' || drawTool === 'select') ? 'auto' : 'none', zIndex: 5, background: 'transparent' }}
                        onMouseDown={drawTool === 'lasso' ? (e => startLassoMouseDown(e, 'lasso')) : drawTool === 'select' ? (e => startLassoMouseDown(e, 'rect')) : undefined}
                      />
                      {/* Canvas text input overlay */}
                      {canvasTextInput && (
                        <div style={{ position: 'absolute', left: `${canvasTextInput.x}px`, top: `${canvasTextInput.y}px`, zIndex: 20 }}>
                          <textarea
                            autoFocus
                            value={canvasTextInput.value}
                            onChange={e => setCanvasTextInput(prev => prev ? { ...prev, value: e.target.value } : null)}
                            onKeyDown={e => {
                              if (e.key === 'Escape') { setCanvasTextInput(null); return }
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                commitCanvasText(canvasTextInput.value, canvasTextInput.canvasX, canvasTextInput.canvasY, drawColor, drawFontSize)
                                setCanvasTextInput(null)
                              }
                            }}
                            onBlur={e => {
                              if ((e.relatedTarget as HTMLElement | null)?.closest('[data-text-size-control], [data-canvas-text-actions]')) return
                              if (canvasTextInput?.value.trim()) commitCanvasText(canvasTextInput.value, canvasTextInput.canvasX, canvasTextInput.canvasY, drawColor, drawFontSize)
                              setCanvasTextInput(null)
                            }}
                            style={{ display: 'block', minWidth: '120px', minHeight: `${drawFontSize + 8}px`, background: 'rgba(255,255,255,0.85)', border: `1.5px dashed ${drawColor}`, borderRadius: '3px', padding: '2px 36px 2px 4px', font: `${drawFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`, color: drawColor, resize: 'none', outline: 'none', lineHeight: 1.4 }}
                            placeholder="Type here…"
                          />
                          <div data-canvas-text-actions style={{ position: 'absolute', top: '2px', right: '2px', display: 'flex', gap: '3px' }}>
                            <button title="Save" onMouseDown={e => { e.preventDefault(); if (canvasTextInput.value.trim()) commitCanvasText(canvasTextInput.value, canvasTextInput.canvasX, canvasTextInput.canvasY, drawColor, drawFontSize); setCanvasTextInput(null) }}
                              style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '3px', background: '#34a853', color: '#fff', cursor: 'pointer', padding: 0 }}>
                              <Check size={12} strokeWidth={3} />
                            </button>
                            <button title="Cancel" onMouseDown={e => { e.preventDefault(); setCanvasTextInput(null) }}
                              style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '3px', background: '#e53935', color: '#fff', cursor: 'pointer', padding: 0 }}>
                              <XIcon size={12} strokeWidth={3} />
                            </button>
                          </div>
                        </div>
                      )}
                      {/* Edge hit zones (invisible) */}
                      <div onMouseDown={e => startCanvasResize(e, 'n')}  style={{ position: 'absolute', top: 0,    left: 8,  right: 8,  height: '5px', cursor: 'n-resize',  zIndex: 10 }} />
                      <div onMouseDown={e => startCanvasResize(e, 's')}  style={{ position: 'absolute', bottom: 0, left: 8,  right: 8,  height: '5px', cursor: 's-resize',  zIndex: 10 }} />
                      <div onMouseDown={e => startCanvasResize(e, 'w')}  style={{ position: 'absolute', left: 0,   top: 8,   bottom: 8, width: '5px',  cursor: 'w-resize',  zIndex: 10 }} />
                      <div onMouseDown={e => startCanvasResize(e, 'e')}  style={{ position: 'absolute', right: 0,  top: 8,   bottom: 8, width: '5px',  cursor: 'e-resize',  zIndex: 10 }} />
                      {/* Mid-edge round handles */}
                      <div onMouseDown={e => startCanvasResize(e, 'n')}  style={{ position: 'absolute', top: '-7px',   left: '50%', transform: 'translateX(-50%)', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', border: '2px solid #1a73e8', cursor: 'n-resize',  zIndex: 12 }} />
                      <div onMouseDown={e => startCanvasResize(e, 's')}  style={{ position: 'absolute', bottom: '-7px', left: '50%', transform: 'translateX(-50%)', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', border: '2px solid #1a73e8', cursor: 's-resize',  zIndex: 12 }} />
                      <div onMouseDown={e => startCanvasResize(e, 'w')}  style={{ position: 'absolute', left: '-7px',  top: '50%',  transform: 'translateY(-50%)', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', border: '2px solid #1a73e8', cursor: 'w-resize',  zIndex: 12 }} />
                      <div onMouseDown={e => startCanvasResize(e, 'e')}  style={{ position: 'absolute', right: '-7px', top: '50%',  transform: 'translateY(-50%)', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', border: '2px solid #1a73e8', cursor: 'e-resize',  zIndex: 12 }} />
                      {/* Corner handles */}
                      <div onMouseDown={e => startCanvasResize(e, 'nw')} style={{ position: 'absolute', top: '-9px',    left: '-9px',  width: '18px', height: '18px', cursor: 'nw-resize', zIndex: 13, background: '#fff', border: '2px solid #1a73e8', borderRadius: '50%' }} />
                      <div onMouseDown={e => startCanvasResize(e, 'ne')} style={{ position: 'absolute', top: '-9px',    right: '-9px', width: '18px', height: '18px', cursor: 'ne-resize', zIndex: 13, background: '#fff', border: '2px solid #1a73e8', borderRadius: '50%' }} />
                      <div onMouseDown={e => startCanvasResize(e, 'sw')} style={{ position: 'absolute', bottom: '-9px', left: '-9px',  width: '18px', height: '18px', cursor: 'sw-resize', zIndex: 13, background: '#fff', border: '2px solid #1a73e8', borderRadius: '50%' }} />
                      <div onMouseDown={e => startCanvasResize(e, 'se')} style={{ position: 'absolute', bottom: '-9px', right: '-9px', width: '18px', height: '18px', cursor: 'se-resize', zIndex: 13, background: '#fff', border: '2px solid #1a73e8', borderRadius: '50%' }} />
                    </div>,
                    canvasPortalTarget
                  )
                })()}
                  <style>{`
                    .rich-text-editor:empty:before {
                      content: attr(data-placeholder);
                      color: #999;
                      pointer-events: none;
                      display: block;
                    }
                    .rich-text-editor ul, .rich-text-editor ol {
                      padding-left: 24px;
                      margin: 4px 0;
                    }
                    .rich-text-editor li {
                      margin-bottom: 2px;
                    }
                    blockquote {
                      border-left: 3px solid #ccc;
                      padding-left: 10px;
                      margin: 4px 0;
                      color: #666;
                      font-style: italic;
                    }
                  `}</style>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="rich-text-editor"
                    data-placeholder="Type a message..."
                    onInput={(e) => {
                      const prev = inputValue;
                      const newHtml = e.currentTarget.innerHTML;
                      pushHistoryDebounced(prev, newHtml);
                      setInputValue(newHtml);
                      hasInteractedRef.current = true;
                      setMessageSent(false);
                      updateActiveFormats();
                      // The canvas board placeholder can be deleted natively (e.g. backspace)
                      // without going through closeCanvasMode — re-sync state when that happens
                      // so the draw toolbar goes back to untouchable, and snapshot the board so
                      // Undo can bring it (and its drawing) back.
                      if (canvasMode && canvasPortalTarget && !e.currentTarget.contains(canvasPortalTarget)) {
                        const canvas = canvasModeRef.current
                        if (canvas) {
                          if (historyDebounce.current) { clearTimeout(historyDebounce.current); historyDebounce.current = null }
                          unifiedUndoStack.current.push({
                            kind: 'canvas-board-removed',
                            data: { dataUrl: canvas.toDataURL('image/png'), width: canvasModeWidth, height: canvasModeHeight, offsetX: canvasOffsetX, offsetY: canvasOffsetY }
                          })
                          unifiedRedoStack.current = []
                          setUndoCount(unifiedUndoStack.current.length)
                          setRedoCount(0)
                        }
                        closeCanvasMode(false)
                      }
                    }}
                    onKeyUp={updateActiveFormats}
                    onMouseUp={updateActiveFormats}
                    onKeyDown={handleKeyDown}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                    onDrop={async e => {
                      e.preventDefault(); e.stopPropagation()

                      const readFiles = (dir: FileSystemDirectoryEntry): Promise<File[]> =>
                        new Promise(res => {
                          const reader = dir.createReader(); const all: File[] = []
                          const read = () => reader.readEntries(async batch => {
                            if (!batch.length) { res(all); return }
                            for (const en of batch) {
                              if (en.isFile) await new Promise<void>(r => (en as FileSystemFileEntry).file(f => { all.push(f); r() }, () => r()))
                              else if (en.isDirectory) all.push(...await readFiles(en as FileSystemDirectoryEntry))
                            }
                            read()
                          }, () => res(all))
                          read()
                        })

                      const insertFolderCard = (folderName: string, fileCount: number, structure: FolderEntry[]): string => {
                        if (!editorRef.current) return ''
                        const range0 = getSafeAttachRange()
                        const sel = window.getSelection()
                        sel?.removeAllRanges(); sel?.addRange(range0)
                        const cardId = Date.now().toString(36) + Math.random().toString(36).slice(2)
                        const card = document.createElement('span')
                        card.setAttribute('contenteditable', 'false')
                        card.dataset.fileCard = '1'; card.dataset.cardId = cardId
                        card.dataset.attachment = encodeURIComponent(folderName)
                        card.dataset.folderCard = '1'
                        try { card.dataset.folderFiles = JSON.stringify(structure) } catch {}
                        card.style.cssText = 'position:relative;display:inline-block;width:150px;margin:4px;vertical-align:middle;border:1px solid #b0bec5;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);cursor:pointer'

                        const body = document.createElement('span')
                        body.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:114px;background:#e8f4fd;gap:4px;pointer-events:none'
                        body.innerHTML = `<svg width="52" height="52" viewBox="0 0 24 24" fill="#42a5f5" stroke="none"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg><span style="font-size:10px;color:#1565c0;font-weight:600;font-family:inherit">${fileCount} file${fileCount !== 1 ? 's' : ''}</span>`
                        card.appendChild(body)

                        const footer = document.createElement('span')
                        footer.style.cssText = 'display:block;height:36px;line-height:36px;padding:0 28px 0 8px;background:#f9f9f9;border-top:1px solid #b0bec5;font-size:10px;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:inherit;pointer-events:none'
                        footer.title = folderName; footer.textContent = folderName
                        card.appendChild(footer)

                        const removeBtn = document.createElement('span')
                        removeBtn.dataset.removeFile = '1'
                        removeBtn.style.cssText = 'position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.45);color:#fff;font-size:14px;line-height:18px;text-align:center;cursor:pointer;z-index:3;display:inline-block;user-select:none'
                        removeBtn.textContent = '×'
                        card.appendChild(removeBtn)

                        // Progress bar added BEFORE setInputValue so it's part of the saved HTML snapshot
                        const progressTrack = document.createElement('div')
                        progressTrack.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:4px;background:rgba(0,0,0,0.08);z-index:5;overflow:hidden'
                        const progressFill = document.createElement('div')
                        progressFill.setAttribute('data-folder-progress', '1')
                        progressFill.style.cssText = 'height:100%;width:0%;background:#1a73e8;transition:width 0.15s ease'
                        progressTrack.appendChild(progressFill)
                        card.appendChild(progressTrack)

                        const range = sel!.getRangeAt(0)
                        range.deleteContents(); range.insertNode(card)
                        range.setStartAfter(card); range.collapse(true)
                        sel!.removeAllRanges(); sel!.addRange(range)
                        savedRangeRef.current = range.cloneRange()
                        setInputValue(editorRef.current.innerHTML) // snapshot includes progress bar at 0%
                        hasInteractedRef.current = true
                        return cardId
                      }

                      const readStructure = (dir: FileSystemDirectoryEntry): Promise<FolderEntry[]> =>
                        new Promise(res => {
                          const reader = dir.createReader(); const all: FolderEntry[] = []
                          const read = () => reader.readEntries(async batch => {
                            if (!batch.length) { res(all); return }
                            for (const en of batch) {
                              if (en.isFile) all.push({ type: 'file', name: en.name })
                              else if (en.isDirectory) all.push({ type: 'folder', name: en.name, children: await readStructure(en as FileSystemDirectoryEntry) })
                            }
                            read()
                          }, () => res(all))
                          read()
                        })

                      for (const item of Array.from(e.dataTransfer.items)) {
                        const entry = item.webkitGetAsEntry?.()
                        if (!entry) continue
                        if (entry.isDirectory) {
                          const [files, structure] = await Promise.all([readFiles(entry as FileSystemDirectoryEntry), readStructure(entry as FileSystemDirectoryEntry)])
                          const cardId = insertFolderCard(entry.name, files.length, structure)
                          if (!cardId) continue
                          setAttachedFiles(prev => [...prev, { name: entry.name, size: files.reduce((s, f) => s + f.size, 0) }])
                          await new Promise(res => requestAnimationFrame(res))
                          let done = 0
                          const total = Math.max(files.length, 1)
                          const updateProgress = () => {
                            const fill = editorRef.current?.querySelector(`[data-card-id="${cardId}"] [data-folder-progress]`) as HTMLElement | null
                            if (fill) { fill.style.width = Math.round((done / total) * 100) + '%'; if (editorRef.current) setInputValue(editorRef.current.innerHTML) }
                          }
                          await Promise.all(files.map(file => {
                            const fd = new FormData(); fd.append('file', file); fd.append('thumbnail', '')
                            return fetch('http://localhost:5050/api/attachments/upload', { method: 'POST', body: fd })
                              .then(() => { done++; updateProgress() }).catch(() => { done++; updateProgress() })
                          }))
                          editorRef.current?.querySelector(`[data-card-id="${cardId}"] [data-folder-progress]`)?.parentElement?.remove()
                          if (editorRef.current) setInputValue(editorRef.current.innerHTML)
                        } else if (entry.isFile) {
                          await new Promise<void>(res => (entry as FileSystemFileEntry).file(file => {
                            const dt = new DataTransfer(); dt.items.add(file)
                            const inp = document.getElementById('chatmail-file-input') as HTMLInputElement
                            if (inp) { inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })) }
                            res()
                          }, () => res()))
                        }
                      }
                    }}
                    onFocus={() => {
                      // Expand to at least 400px when the user clicks into the field
                      setInputPanelHeight(prev => Math.max(400, prev))
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement
                      if (target.tagName === 'IMG' && target.hasAttribute('data-canvas-saved')) {
                        restoreCanvasFromImage(target as HTMLImageElement)
                      }
                      const card = target.closest('[data-file-card]') as HTMLElement | null
                      if (card) {
                        if (target.dataset.removeFile) {
                          const name = decodeURIComponent(card.dataset.attachment || 'this attachment')
                          setConfirmDialog({
                            title: 'Delete attachment?',
                            message: `Remove "${name}" from this message?`,
                            onConfirm: () => {
                              card.remove(); setInputValue(editorRef.current?.innerHTML || ''); hasInteractedRef.current = true
                            }
                          })
                        } else if (card.dataset.folderCard === '1') {
                          const name = decodeURIComponent(card.dataset.attachment || '')
                          const entries: FolderEntry[] = (() => { try { return JSON.parse(card.dataset.folderFiles || '[]') } catch { return [] } })()
                          setFolderPreview({ name, entries }); setFolderNavPath([])
                        } else {
                          const name = decodeURIComponent(card.dataset.attachment || '')
                          const ext = (name.split('.').pop() || '').toLowerCase()
                          const fileUrl = card.getAttribute('data-file-url') || ''
                          const thumbUrl = card.querySelector('img')?.src || ''
                          setFilePreview({ url: fileUrl, thumbUrl, name, ext })
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      flex: 1,
                      padding: '12px',
                      border: 'none',
                      outline: 'none',
                      borderRadius: '4px 4px 0 0',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      overflow: 'auto',
                      lineHeight: '1.5',
                      boxSizing: 'border-box',
                      display: 'block',
                      minHeight: '50px',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      backgroundColor: 'white'
                    }}
                  />
                  {showLivePreview && (
                    <div style={{ borderTop: '1px solid #e8e8e8', background: '#fafefe' }}>
                      <div style={{ padding: '2px 10px', background: '#f0f9f0', borderBottom: '1px solid #e0f0e0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Eye size={11} color="#34a853" />
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#34a853', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Live Preview</span>
                      </div>
                      {inputValue.trim() ? (
                        <div
                          style={{ padding: '6px 12px', fontSize: '14px', lineHeight: '1.55', color: '#222', minHeight: '30px', maxHeight: '160px', overflowY: 'auto', wordBreak: 'break-word' }}
                          dangerouslySetInnerHTML={{ __html: renderContent(inputValue, 'main') }}
                        />
                      ) : (
                        <div style={{ padding: '6px 12px', fontSize: '13px', color: '#bbb', fontStyle: 'italic' }}>Nothing to preview yet…</div>
                      )}
                    </div>
                  )}
                </div>
            </div>
            {/* Formatting toolbar */}
            <div onMouseDown={saveEditorSelection} style={{ marginTop: '2px', border: '1px solid #e8e8e8', borderRadius: '6px', position: 'relative', flexShrink: 0, padding: composeFloating ? '0 3px 3px' : 0 }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', background: '#f5f5f5', borderBottom: '1px solid #e8e8e8' }}>
                {/* Undo / Redo */}
                <button onMouseDown={e => { e.preventDefault(); doUndo() }} title="Undo (Ctrl+Z / Cmd+Z)"
                  style={{ padding: '2px 10px 1px', border: 'none', borderRight: '1px solid #e8e8e8', background: 'transparent', cursor: undoCount ? 'pointer' : 'default', color: undoCount ? '#555' : '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' }}
                  onMouseEnter={e => { if (undoCount) e.currentTarget.style.backgroundColor = '#ebebeb' }}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  <Undo2 size={16} />
                </button>
                <button onMouseDown={e => { e.preventDefault(); doRedo() }} title="Redo (Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z)"
                  style={{ padding: '2px 10px 1px', border: 'none', borderRight: '1px solid #e8e8e8', background: 'transparent', cursor: redoCount ? 'pointer' : 'default', color: redoCount ? '#555' : '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' }}
                  onMouseEnter={e => { if (redoCount) e.currentTarget.style.backgroundColor = '#ebebeb' }}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  <Redo2 size={16} />
                </button>
                {([
                  { id: 'text', title: 'Text', icon: <Bold size={13} strokeWidth={1} /> },
                  { id: 'draw', title: 'Draw', icon: <Pencil size={13} strokeWidth={1} /> },
                  { id: 'lists', title: 'Lists', icon: <List size={13} strokeWidth={1} /> },
                  { id: 'insert', title: 'Insert', icon: <Paperclip size={13} strokeWidth={1} /> },
                ] as const).map(({ id, title, icon }) => (
                  <button key={id} title={title} onMouseDown={e => { e.preventDefault(); setFormatTab(id) }}
                    style={{
                      flex: 1, padding: '2px 4px 1px', margin: '0',
                      cursor: 'pointer', border: 'none', borderBottom: formatTab === id ? '2px solid #1a73e8' : '2px solid transparent',
                      background: formatTab === id ? '#fff' : 'transparent', color: formatTab === id ? '#1a73e8' : '#888',
                      transition: 'background 0.15s, color 0.15s',
                      display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '3px', alignSelf: 'stretch',
                      fontSize: '11px', fontWeight: 500,
                    }}>
                    {icon}{title}
                  </button>
                ))}
              </div>
              {/* Tab content */}
              <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', minHeight: '118px' }}>
                {formatTab === 'text' && <>
                  {/* Toolbar row with left/right scroll toggles */}
                  <div style={{ display: 'flex', alignItems: 'stretch', flex: 1 }}>
                    {textToolbarOverflow.left && (
                      <button onMouseDown={e => { e.preventDefault(); document.getElementById('text-toolbar-scroll')?.scrollBy({ left: -160, behavior: 'smooth' }) }}
                        style={{ flexShrink: 0, background: '#e8f0fe', border: 'none', borderRight: '1px solid #e8e8e8', cursor: 'pointer', padding: '0', color: '#1a73e8', display: 'flex', alignItems: 'center', alignSelf: 'stretch' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#1a73e8'; e.currentTarget.style.backgroundColor = '#d2e3fc' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#1a73e8'; e.currentTarget.style.backgroundColor = '#e8f0fe' }}>
                        <ChevronLeft size={20} />
                      </button>
                    )}
                  <div id="text-toolbar-scroll" style={{ display: 'flex', alignItems: 'stretch', padding: '4px 6px 2px', gap: '4px', overflowX: 'auto', flex: 1, scrollbarWidth: 'none' }}>
                    {/* CLIPBOARD group */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                      {/* Row 1: Copy, Cut */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        {([
                          { title: 'Copy (Ctrl+C)', label: 'Copy', icon: <Copy     size={22} strokeWidth={1} />, action: () => {
                            editorRef.current?.focus()
                            copySelectionToInternalClipboard()
                            try { document.execCommand('copy') } catch (_) {}
                          } },
                          { title: 'Cut (Ctrl+X)',  label: 'Cut',  icon: <Scissors size={22} strokeWidth={1} />, action: () => {
                            editorRef.current?.focus()
                            copySelectionToInternalClipboard()
                            try { document.execCommand('cut') } catch (_) {}
                            if (editorRef.current) {
                              setInputValue(editorRef.current.innerHTML)
                              hasInteractedRef.current = true
                            }
                          } },
                        ]).map(({ title, label, icon, action }) => (
                          <button key={title} title={title} onMouseDown={e => { e.preventDefault(); action() }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                            {icon}
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
                          </button>
                        ))}
                      </div>
                      {/* Row 2: Paste (below Copy), Select All (below Cut) */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden', width: '26px' }}>
                            <button title="Paste – Keep Source Formatting (Ctrl+V)" onMouseDown={async e => {
                              e.preventDefault()
                              editorRef.current?.focus()
                              // Prefer our own in-app clipboard: it's set deterministically by the
                              // Copy/Cut buttons, unlike the OS clipboard which silently no-ops
                              // (execCommand('paste') returns false, clipboard.read() can reject)
                              // when the page lacks clipboard-read permission.
                              if (pasteFromInternalClipboard()) return
                              if (document.execCommand('paste')) return
                              try {
                                const items = await (navigator.clipboard as any).read()
                                let done = false
                                for (const item of items) {
                                  if (item.types.includes('text/html')) { const b = await item.getType('text/html'); document.execCommand('insertHTML', false, await b.text()); done = true; break }
                                }
                                if (!done) document.execCommand('paste')
                              } catch { document.execCommand('paste') }
                            }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                              <ClipboardList size={22} strokeWidth={1} />
                            </button>
                            <div style={{ height: '1px', background: '#ddd', alignSelf: 'stretch' }} />
                            <button ref={pasteButtonRef} data-toolbar-menu-toggle title="Paste options" onMouseDown={e => {
                              e.preventDefault()
                              const willOpen = !pasteMenuOpen
                              const rect = pasteButtonRef.current?.getBoundingClientRect()
                              closeAllToolbarMenus()
                              if (willOpen && rect) { setPasteMenuPos({ top: rect.top, left: rect.left }); setPasteMenuOpen(true) }
                            }}
                              style={{ background: pasteMenuOpen ? '#e8e8e8' : 'none', border: 'none', cursor: 'pointer', padding: '0', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '12px', overflow: 'visible' }}
                              onMouseEnter={e => { if (!pasteMenuOpen) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = pasteMenuOpen ? '#e8e8e8' : 'transparent' }}>
                              <ChevronDown size={14} color="#888" />
                            </button>
                          </div>
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', textAlign: 'center', color: '#555' }}>Paste</span>
                        </div>
                        <button title="Select All (Ctrl+A)" onMouseDown={e => {
                          e.preventDefault()
                          const el = editorRef.current; if (!el) return
                          el.focus()
                          const range = document.createRange()
                          range.selectNodeContents(el)
                          const sel = window.getSelection()
                          sel?.removeAllRanges()
                          sel?.addRange(range)
                          saveEditorSelection()
                        }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                          <MousePointer size={22} strokeWidth={1} />
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.2 }}>Select<br />All</span>
                        </button>
                      </div>
                      {pasteMenuOpen && pasteMenuPos && createPortal(
                        <div
                          data-toolbar-menu
                          onMouseDown={e => e.stopPropagation()}
                          style={{ position: 'fixed', top: pasteMenuPos.top, left: pasteMenuPos.left, transform: 'translateY(-100%) translateY(-4px)', zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.15)', minWidth: '190px', overflow: 'hidden' }}>
                          {([
                            { label: 'Keep Source Formatting', action: 'paste-source', icon: <ClipboardList size={14} strokeWidth={1.5} /> },
                            { label: 'Merge Formatting',       action: 'paste-merge',  icon: <GitMerge     size={14} strokeWidth={1.5} /> },
                            { label: 'Paste Text Only',        action: 'paste-text',   icon: <FileText     size={14} strokeWidth={1.5} /> },
                          ]).map(({ label, action, icon }) => (
                            <button key={action} onMouseDown={async e => {
                              e.preventDefault()
                              editorRef.current?.focus()
                              try {
                                if (action === 'paste-text') {
                                  if (internalClipboardRef.current) {
                                    const tmp = document.createElement('div'); tmp.innerHTML = internalClipboardRef.current
                                    document.execCommand('insertText', false, tmp.textContent || '')
                                  } else {
                                    const t = await navigator.clipboard.readText()
                                    document.execCommand('insertText', false, t)
                                  }
                                } else if (action === 'paste-source') {
                                  if (pasteFromInternalClipboard()) { setPasteMenuOpen(false); return }
                                  if (document.execCommand('paste')) { setPasteMenuOpen(false); return }
                                  const items = await (navigator.clipboard as any).read()
                                  let done = false
                                  for (const item of items) {
                                    if (item.types.includes('text/html')) { const b = await item.getType('text/html'); document.execCommand('insertHTML', false, await b.text()); done = true; break }
                                  }
                                  if (!done) document.execCommand('paste')
                                } else if (action === 'paste-merge') {
                                  const sourceHtml = internalClipboardRef.current
                                  if (sourceHtml != null) {
                                    const tmp = document.createElement('div')
                                    tmp.innerHTML = sourceHtml
                                    tmp.querySelectorAll('*').forEach(el => {
                                      el.removeAttribute('style')
                                      el.removeAttribute('color')
                                      el.removeAttribute('face')
                                      el.removeAttribute('size')
                                      el.removeAttribute('bgcolor')
                                    })
                                    editorRef.current?.focus()
                                    const sel = window.getSelection()
                                    sel?.removeAllRanges(); sel?.addRange(getSafeAttachRange())
                                    document.execCommand('insertHTML', false, tmp.innerHTML)
                                    if (editorRef.current) { setInputValue(editorRef.current.innerHTML); hasInteractedRef.current = true }
                                  } else {
                                    const items = await (navigator.clipboard as any).read()
                                    let done = false
                                    for (const item of items) {
                                      if (item.types.includes('text/html')) {
                                        const b = await item.getType('text/html')
                                        const tmp = document.createElement('div')
                                        tmp.innerHTML = await b.text()
                                        tmp.querySelectorAll('*').forEach(el => {
                                          el.removeAttribute('style')
                                          el.removeAttribute('color')
                                          el.removeAttribute('face')
                                          el.removeAttribute('size')
                                          el.removeAttribute('bgcolor')
                                        })
                                        document.execCommand('insertHTML', false, tmp.innerHTML)
                                        done = true; break
                                      }
                                    }
                                    if (!done) { const t = await navigator.clipboard.readText(); document.execCommand('insertText', false, t) }
                                  }
                                }
                              } catch { document.execCommand('paste') }
                              setPasteMenuOpen(false)
                            }}
                              style={{ width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: '12px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                              {icon}{label}
                            </button>
                          ))}
                        </div>,
                        document.body
                      )}
                    </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Clipboard</span>
                    </div>
                    {/* Column divider */}
                    <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                    {/* TEXT group: dropdowns row + buttons row */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1px' }}>
                      {/* Dropdowns row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0' }}>
                        {/* Font style */}
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', borderRadius: '4px' }}
                          onMouseEnter={e => { if (!fontStyleOpen) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f0f0f0' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent' }}>
                          <button data-toolbar-menu-toggle onMouseDown={e => toggleToolbarMenu(fontStyleOpen, setFontStyleOpen, e)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', border: fontStyleOpen ? '1px solid #1a73e8' : '1px solid #ddd', borderRadius: '4px', background: fontStyleOpen ? '#e8f0fe' : '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 500, fontFamily: 'inherit', color: '#333', minWidth: '70px', justifyContent: 'space-between' }}>
                            <span>{fontStyle}</span>
                            <ChevronDown size={12} color="#888" />
                          </button>
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', color: '#555' }}>Format</span>
                          {fontStyleOpen && createPortal(
                            <div data-toolbar-menu style={{ position: 'fixed', bottom: toolbarMenuPos.bottom, left: toolbarMenuPos.left, zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.12)', minWidth: '150px', overflow: 'hidden' }}>
                              {([
                                { label: 'Normal',    preview: { fontSize: '13px', fontWeight: 400 } },
                                { label: 'Heading 1', preview: { fontSize: '18px', fontWeight: 700 } },
                                { label: 'Heading 2', preview: { fontSize: '15px', fontWeight: 700 } },
                                { label: 'Heading 3', preview: { fontSize: '13px', fontWeight: 700 } },
                                { label: 'Quote',     preview: { fontSize: '13px', fontStyle: 'italic', color: '#888' } },
                                { label: 'Code',      preview: { fontSize: '12px', fontFamily: 'monospace', color: '#c7254e', background: '#f9f2f4' } },
                              ]).map(({ label, preview }) => (
                                <button key={label} onMouseDown={e => { e.preventDefault(); applyFontStyle(label) }}
                                  style={{ width: '100%', padding: '7px 14px', border: 'none', background: fontStyle === label ? '#e8f0fe' : 'transparent', cursor: 'pointer', textAlign: 'left', display: 'block', ...preview }}
                                  onMouseEnter={e => { if (fontStyle !== label) e.currentTarget.style.background = '#f5f5f5' }}
                                  onMouseLeave={e => { if (fontStyle !== label) e.currentTarget.style.background = 'transparent' }}>
                                  {label}
                                </button>
                              ))}
                            </div>,
                            document.body
                          )}
                        </div>
                        {/* Font family */}
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', borderRadius: '4px' }}
                          onMouseEnter={e => { if (!fontFamilyOpen) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f0f0f0' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent' }}>
                          <button data-toolbar-menu-toggle onMouseDown={e => toggleToolbarMenu(fontFamilyOpen, setFontFamilyOpen, e)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', border: fontFamilyOpen ? '1px solid #1a73e8' : '1px solid #ddd', borderRadius: '4px', background: fontFamilyOpen ? '#e8f0fe' : '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 500, fontFamily: 'inherit', color: '#333', minWidth: '80px', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: fontFamily === 'Default' ? 'inherit' : fontFamily, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fontFamily}</span>
                            <ChevronDown size={12} color="#888" />
                          </button>
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', color: '#555' }}>Style</span>
                          {fontFamilyOpen && createPortal(
                            <div data-toolbar-menu style={{ position: 'fixed', bottom: toolbarMenuPos.bottom, left: toolbarMenuPos.left, zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.12)', minWidth: '180px', overflow: 'hidden', maxHeight: '220px', overflowY: 'auto' }}>
                              {([
                                { label: 'Default',         font: 'inherit' },
                                { label: 'Arial',           font: 'Arial, sans-serif' },
                                { label: 'Helvetica',       font: 'Helvetica, sans-serif' },
                                { label: 'Times New Roman', font: '"Times New Roman", serif' },
                                { label: 'Georgia',         font: 'Georgia, serif' },
                                { label: 'Garamond',        font: 'Garamond, serif' },
                                { label: 'Courier New',     font: '"Courier New", monospace' },
                                { label: 'Verdana',         font: 'Verdana, sans-serif' },
                                { label: 'Trebuchet MS',    font: '"Trebuchet MS", sans-serif' },
                                { label: 'Impact',          font: 'Impact, sans-serif' },
                                { label: 'Comic Sans MS',   font: '"Comic Sans MS", cursive' },
                                { label: 'Palatino',        font: 'Palatino, serif' },
                                { label: 'Tahoma',          font: 'Tahoma, sans-serif' },
                              ]).map(({ label, font }) => (
                                <button key={label} onMouseDown={e => { e.preventDefault(); setFontFamily(label); setFontFamilyOpen(false); if (font !== 'inherit') wrapSpan(`font-family:${font}`) }}
                                  style={{ width: '100%', padding: '7px 14px', border: 'none', background: fontFamily === label ? '#e8f0fe' : 'transparent', cursor: 'pointer', textAlign: 'left', display: 'block', fontSize: '13px', color: fontFamily === label ? '#1a73e8' : '#333', fontFamily: font }}
                                  onMouseEnter={e => { if (fontFamily !== label) e.currentTarget.style.background = '#f5f5f5' }}
                                  onMouseLeave={e => { if (fontFamily !== label) e.currentTarget.style.background = 'transparent' }}>
                                  {label}
                                </button>
                              ))}
                            </div>,
                            document.body
                          )}
                        </div>
                        {/* Font size */}
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', borderRadius: '4px' }}
                          onMouseEnter={e => { if (!fontSizeOpen) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f0f0f0' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent' }}>
                          <button data-toolbar-menu-toggle onMouseDown={e => toggleToolbarMenu(fontSizeOpen, setFontSizeOpen, e)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', border: fontSizeOpen ? '1px solid #1a73e8' : '1px solid #ddd', borderRadius: '4px', background: fontSizeOpen ? '#e8f0fe' : '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 500, fontFamily: 'inherit', color: '#333', minWidth: '54px', justifyContent: 'space-between' }}>
                            <span>{fontSize}</span>
                            <ChevronDown size={12} color="#888" />
                          </button>
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', color: '#555' }}>Size</span>
                          {fontSizeOpen && createPortal(
                            <div data-toolbar-menu style={{ position: 'fixed', bottom: toolbarMenuPos.bottom, left: toolbarMenuPos.left, zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.12)', minWidth: '80px', overflow: 'hidden', maxHeight: '200px', overflowY: 'auto' }}>
                              {['8','10','11','12','14','16','18','20','24','28','32','36','48','72'].map(size => (
                                <button key={size} onMouseDown={e => { e.preventDefault(); setFontSize(size); setFontSizeOpen(false); wrapSpan(`font-size:${size}px`) }}
                                  style={{ width: '100%', padding: '6px 14px', border: 'none', background: fontSize === size ? '#e8f0fe' : 'transparent', cursor: 'pointer', textAlign: 'left', display: 'block', fontSize: '13px', color: fontSize === size ? '#1a73e8' : '#333' }}
                                  onMouseEnter={e => { if (fontSize !== size) e.currentTarget.style.background = '#f5f5f5' }}
                                  onMouseLeave={e => { if (fontSize !== size) e.currentTarget.style.background = 'transparent' }}>
                                  {size}
                                </button>
                              ))}
                            </div>,
                            document.body
                          )}
                        </div>
                        {/* Case type */}
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', borderRadius: '4px' }}
                          onMouseEnter={e => { if (!caseTypeOpen) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f0f0f0' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent' }}>
                          <button data-toolbar-menu-toggle onMouseDown={e => toggleToolbarMenu(caseTypeOpen, setCaseTypeOpen, e)}
                            title="Case type"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', border: caseTypeOpen ? '1px solid #1a73e8' : '1px solid #ddd', borderRadius: '4px', background: caseTypeOpen ? '#e8f0fe' : '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', color: '#333', justifyContent: 'space-between' }}>
                            <span style={{ letterSpacing: '0.5px' }}>Aa</span>
                            <ChevronDown size={12} color="#888" />
                          </button>
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', color: '#555' }}>Case</span>
                          {caseTypeOpen && createPortal(
                            <div data-toolbar-menu style={{ position: 'fixed', bottom: toolbarMenuPos.bottom, left: toolbarMenuPos.left, zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.12)', minWidth: '160px', overflow: 'hidden' }}>
                              {([
                                { label: 'Sentence case', preview: 'Sentence case' },
                                { label: 'lowercase',     preview: 'lowercase' },
                                { label: 'UPPERCASE',     preview: 'UPPERCASE' },
                                { label: 'Title Case',    preview: 'Title Case' },
                                { label: 'tOGGLE cASE',   preview: 'tOGGLE cASE' },
                              ]).map(({ label, preview }) => (
                                <button key={label} onMouseDown={e => { e.preventDefault(); applyCase(label) }}
                                  style={{ width: '100%', padding: '7px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', display: 'block', fontSize: '13px', color: '#333' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                  {preview}
                                </button>
                              ))}
                            </div>,
                            document.body
                          )}
                        </div>
                        {/* Subscript / Superscript */}
                        {([
                          { title: 'Subscript', label: 'Sub', icon: <Subscript size={30} strokeWidth={1} />, action: 'sub' },
                          { title: 'Superscript', label: 'Super', icon: <Superscript size={30} strokeWidth={1} />, action: 'sup' },
                        ] as const).map(({ title, label, icon, action }) => {
                          const isActive = activeFormats.has(action)
                          return (
                          <button key={action} title={title} onMouseDown={e => { e.preventDefault(); applyFormat(action) }}
                            style={{ background: isActive ? '#e8e8e8' : 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: isActive ? '#333' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: 'none' }}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? '#e8e8e8' : 'transparent' }}>
                            {icon}
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
                          </button>
                          )
                        })}
                      </div>
                      {/* Buttons row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {([
                          { title: 'Bold (Ctrl+B)', label: 'Bold', icon: <Bold size={30} strokeWidth={3} />, action: 'bold' },
                          { title: 'Italic (Ctrl+I)', label: 'Italic', icon: <Italic size={30} strokeWidth={1} />, action: 'italic' },
                          { title: 'Underline (Ctrl+U)', label: 'Underline', icon: <Underline size={30} strokeWidth={1} />, action: 'underline' },
                          { title: 'Strikethrough (Ctrl+Shift+X)', label: 'Strike', icon: <Strikethrough size={30} strokeWidth={1} />, action: 'strike' },
                        ] as const).map(({ title, label, icon, action }) => {
                          const isActive = activeFormats.has(action)
                          return (
                          <button key={action} title={title} onMouseDown={e => { e.preventDefault(); applyFormat(action) }}
                            style={{ background: isActive ? '#e8e8e8' : 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: isActive ? '#333' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: 'none' }}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? '#e8e8e8' : 'transparent' }}>
                            {icon}
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
                          </button>
                          )
                        })}
                        {/* Font color */}
                        <div style={{ position: 'relative' }}>
                          <button data-toolbar-menu-toggle onMouseDown={e => toggleToolbarMenu(fontColorOpen, setFontColorOpen, e)}
                            title="Font color"
                            style={{ background: fontColorOpen ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                            onMouseEnter={e => { if (!fontColorOpen) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = fontColorOpen ? '#e8f0fe' : 'transparent' }}>
                            <span style={{ fontSize: '30px', fontWeight: 700, color: fontColor, lineHeight: 1 }}>A</span>
                            <div style={{ width: '30px', height: '3px', borderRadius: '1px', background: fontColor }} />
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', color: '#555' }}>Color</span>
                          </button>
                          {fontColorOpen && createPortal(
                            <div data-toolbar-menu style={{ position: 'fixed', bottom: toolbarMenuPos.bottom, left: toolbarMenuPos.left, zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.12)', padding: '12px' }}>
                              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 30px)', gap: '8px' }}>
                                    {['#000000','#434343','#666666','#999999','#b7b7b7','#cccccc','#d9d9d9','#ffffff',
                                      '#ff0000','#ff4500','#ff8c00','#ffd700','#00cc00','#00ced1','#1a73e8','#9c27b0',
                                      '#f4cccc','#fce5cd','#fff2cc','#d9ead3','#d0e0f3','#cfe2f3','#d9d2e9','#fce4ec',
                                      '#ea4335','#fbbc04','#34a853','#4285f4','#ab47bc','#26c6da','#ff7043','#78909c'].map(c => (
                                      <button key={c} onMouseDown={e => { e.preventDefault(); setFontColor(c); setFontColorOpen(false); wrapSpan(`color:${c}`) }}
                                        style={{ width: '30px', height: '30px', borderRadius: '50%', background: c, border: fontColor === c ? '3px solid #1a73e8' : '2px solid rgba(0,0,0,0.08)', cursor: 'pointer', outline: 'none' }} />
                                    ))}
                                  </div>
                                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Selected color</span>
                                    <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #c0c0c0', borderRadius: '6px', overflow: 'hidden', width: 'fit-content' }}>
                                      <div style={{ width: '50px', height: '56px', background: fontColor, flexShrink: 0 }} />
                                      <input type="text" value={fontColor} maxLength={7}
                                        onChange={e => { if (/^#[0-9a-f]{0,6}$/i.test(e.target.value)) { setFontColor(e.target.value); wrapSpan(`color:${e.target.value}`) } }}
                                        onMouseDown={e => e.stopPropagation()}
                                        placeholder="#607d8b"
                                        style={{ padding: '18px 10px', backgroundColor: 'white', border: 'none', fontSize: '14px', fontFamily: 'monospace', outline: 'none', width: '110px' }} />
                                    </div>
                                  </div>
                                </div>
                                <ColorPicker value={fontColor} onChange={c => { setFontColor(c); wrapSpan(`color:${c}`) }} showHex={false} />
                              </div>
                            </div>,
                            document.body
                          )}
                        </div>
                        {/* Highlight color */}
                        <div style={{ position: 'relative' }}>
                          <button data-toolbar-menu-toggle onMouseDown={e => toggleToolbarMenu(highlightColorOpen, setHighlightColorOpen, e)}
                            title="Highlight color"
                            style={{ background: highlightColorOpen ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                            onMouseEnter={e => { if (!highlightColorOpen) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = highlightColorOpen ? '#e8f0fe' : 'transparent' }}>
                            <span style={{ fontSize: '30px', fontWeight: 700, color: '#333', lineHeight: 1, background: highlightColor === 'transparent' ? 'none' : highlightColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', boxSizing: 'border-box' }}>A</span>
                            <div style={{ width: '30px', height: '3px', borderRadius: '1px', background: highlightColor === 'transparent' ? 'linear-gradient(to right, #f00, #ff0, #0f0)' : highlightColor }} />
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', color: '#555' }}>Highlight</span>
                          </button>
                          {highlightColorOpen && createPortal(
                            <div data-toolbar-menu style={{ position: 'fixed', bottom: toolbarMenuPos.bottom, left: toolbarMenuPos.left, zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.12)', padding: '12px' }}>
                              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 30px)', gap: '8px' }}>
                                    {['transparent','#ffff00','#00ff00','#00ffff','#ff00ff','#ff0000','#0000ff','#ffffff',
                                      '#fff2cc','#fce5cd','#f4cccc','#d9ead3','#d0e0f3','#d9d2e9','#fce4ec','#f3f3f3',
                                      '#ffd966','#f6b26b','#e06666','#93c47d','#76a5af','#6fa8dc','#8e7cc3','#c27ba0',
                                      '#ffeb3b','#ff9800','#f44336','#4caf50','#03a9f4','#9c27b0','#e91e63','#607d8b'].map(c => (
                                      <button key={c} onMouseDown={e => { e.preventDefault(); setHighlightColor(c); setHighlightColorOpen(false); if (c !== 'transparent') wrapSpan(`background-color:${c}`) }}
                                        style={{ width: '30px', height: '30px', borderRadius: '50%', background: c === 'transparent' ? 'linear-gradient(to bottom right, #fff 45%, #f00 45%, #f00 55%, #fff 55%)' : c, border: highlightColor === c ? '3px solid #1a73e8' : '2px solid rgba(0,0,0,0.08)', cursor: 'pointer', outline: 'none' }} />
                                    ))}
                                  </div>
                                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Selected color</span>
                                    <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #c0c0c0', borderRadius: '6px', overflow: 'hidden', width: 'fit-content' }}>
                                      <div style={{ width: '50px', height: '56px', background: highlightColor === 'transparent' ? 'linear-gradient(to bottom right, #fff 45%, #f00 45%, #f00 55%, #fff 55%)' : highlightColor, flexShrink: 0 }} />
                                      <input type="text" value={highlightColor} maxLength={7}
                                        onChange={e => { if (/^#[0-9a-f]{0,6}$/i.test(e.target.value)) { setHighlightColor(e.target.value); wrapSpan(`background-color:${e.target.value}`) } }}
                                        onMouseDown={e => e.stopPropagation()}
                                        placeholder="#607d8b"
                                        style={{ padding: '18px 10px', backgroundColor: 'white', border: 'none', fontSize: '14px', fontFamily: 'monospace', outline: 'none', width: '110px' }} />
                                    </div>
                                  </div>
                                </div>
                                <ColorPicker value={highlightColor === 'transparent' ? '#ffff00' : highlightColor} onChange={c => { setHighlightColor(c); wrapSpan(`background-color:${c}`) }} showHex={false} />
                              </div>
                            </div>,
                            document.body
                          )}
                        </div>
                        {/* Watermark background */}
                        <div style={{ position: 'relative' }}>
                          <button data-toolbar-menu-toggle onMouseDown={e => toggleToolbarMenu(watermarkOpen, setWatermarkOpen, e)}
                            title="Text background (watermark)"
                            style={{ background: watermarkOpen ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                            onMouseEnter={e => { if (!watermarkOpen) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = watermarkOpen ? '#e8f0fe' : 'transparent' }}>
                            <Highlighter size={30} color="#555" style={{ background: watermarkColor, borderRadius: '2px', padding: '1px' }} />
                            <div style={{ width: '16px', height: '3px', borderRadius: '1px', background: watermarkColor }} />
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', color: '#555' }}>Watermark</span>
                          </button>
                          {watermarkOpen && createPortal(
                            <div data-toolbar-menu style={{ position: 'fixed', bottom: toolbarMenuPos.bottom, left: toolbarMenuPos.left, zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.12)', padding: '12px' }}>
                              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 30px)', gap: '8px' }}>
                                    {['transparent','#ffe0b2','#fff9c4','#c8e6c9','#b3e5fc','#e1bee7','#fce4ec','#f8bbd0','#ffffff',
                                      '#ffccbc','#fff59d','#a5d6a7','#81d4fa','#ce93d8','#f48fb1','#ffab91','#f5f5f5',
                                      '#ff8a65','#ffd54f','#66bb6a','#29b6f6','#ab47bc','#ec407a','#ff7043','#bdbdbd',
                                      '#e64a19','#f9a825','#2e7d32','#0277bd','#6a1b9a','#880e4f','#bf360c','#424242'].map(c => (
                                      <button key={c} onMouseDown={e => { e.preventDefault(); setWatermarkColor(c); setWatermarkOpen(false); wrapSpan(`background-color:${c};display:inline-block;width:100%`) }}
                                        style={{ width: '30px', height: '30px', borderRadius: '50%', background: c === 'transparent' ? 'linear-gradient(to bottom right, #fff 45%, #f00 45%, #f00 55%, #fff 55%)' : c, border: watermarkColor === c ? '3px solid #1a73e8' : '2px solid rgba(0,0,0,0.08)', cursor: 'pointer', outline: 'none' }} />
                                    ))}
                                  </div>
                                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Selected color</span>
                                    <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #c0c0c0', borderRadius: '6px', overflow: 'hidden', width: 'fit-content' }}>
                                      <div style={{ width: '50px', height: '56px', background: watermarkColor === 'transparent' ? 'linear-gradient(to bottom right, #fff 45%, #f00 45%, #f00 55%, #fff 55%)' : watermarkColor, flexShrink: 0 }} />
                                      <input type="text" value={watermarkColor} maxLength={7}
                                        onChange={e => { if (/^#[0-9a-f]{0,6}$/i.test(e.target.value)) { setWatermarkColor(e.target.value); wrapSpan(`background-color:${e.target.value};display:inline-block;width:100%`) } }}
                                        onMouseDown={e => e.stopPropagation()}
                                        placeholder="#607d8b"
                                        style={{ padding: '18px 10px', backgroundColor: 'white', border: 'none', fontSize: '14px', fontFamily: 'monospace', outline: 'none', width: '110px' }} />
                                    </div>
                                  </div>
                                </div>
                                <ColorPicker value={watermarkColor === 'transparent' ? '#ffe0b2' : watermarkColor} onChange={c => { setWatermarkColor(c); wrapSpan(`background-color:${c};display:inline-block;width:100%`) }} showHex={false} />
                              </div>
                            </div>,
                            document.body
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase', alignSelf: 'center' }}>Text</span>
                    </div>
                    {/* Column divider */}
                    <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                    {/* QUOTE/CODE group: HR (top-left), Quote (bottom-left), Inline code (top-right), Code block (bottom-right) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, auto)', gap: '2px', alignSelf: 'flex-start' }}>
                      <button title="Horizontal rule (divider)" onMouseDown={e => { e.preventDefault(); applyFormat('hr') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <svg width="30" height="18" viewBox="3 0 18 24" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <line x1="3" y1="12" x2="21" y2="12"/>
                          <line x1="3" y1="8" x2="9" y2="8"/><line x1="15" y1="8" x2="21" y2="8"/>
                          <line x1="3" y1="16" x2="9" y2="16"/><line x1="15" y1="16" x2="21" y2="16"/>
                          <line x1="3" y1="4" x2="21" y2="4"/>
                          <line x1="3" y1="20" x2="21" y2="20"/>
                        </svg>
                        <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.4 }}>Horizontal<br />Divider</span>
                      </button>
                      {(() => { const isActive = activeFormats.has('code'); return (
                      <button title="Inline code (Ctrl+Shift+E)" onMouseDown={e => { e.preventDefault(); applyFormat('code') }}
                        style={{ background: isActive ? '#e8e8e8' : 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', margin: '0', borderRadius: '4px', color: isActive ? '#333' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: 'none' }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? '#e8e8e8' : 'transparent' }}>
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/>
                        </svg>
                        <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Code</span>
                      </button>
                      )})()}
                      {(() => { const isActive = activeFormats.has('quote'); return (
                      <button title="Quote" onMouseDown={e => { e.preventDefault(); applyFormat('quote') }}
                        style={{ background: isActive ? '#e8e8e8' : 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: isActive ? '#333' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: 'none' }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? '#e8e8e8' : 'transparent' }}>
                        <Quote size={24} strokeWidth={1} />
                        <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Quote</span>
                      </button>
                      )})()}
                      <button title="Code block" onMouseDown={e => { e.preventDefault(); applyFormat('codeblock') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="4" width="20" height="16" rx="3"/>
                          <polyline points="8,10 5,13 8,16"/><polyline points="16,10 19,13 16,16"/>
                        </svg>
                        <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Block</span>
                      </button>
                    </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Quote/Code</span>
                    </div>
                    {/* Column divider */}
                    <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                    {/* LISTS group */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px' }}>
                      {/* Row 1: list type buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {([
                        { fmt: 'ul', title: 'Bullet list', label: 'Bullet', svg: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="3.5" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="3.5" cy="19" r="1.5" fill="currentColor" stroke="none"/><line x1="6.5" y1="5" x2="22" y2="5"/><line x1="6.5" y1="12" x2="22" y2="12"/><line x1="6.5" y1="19" x2="22" y2="19"/></svg> },
                        { fmt: 'ol', title: 'Numbered list', label: 'Number', svg: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><text x="1" y="5" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">1</text><text x="1" y="12" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">2</text><text x="1" y="19" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">3</text><line x1="6.5" y1="5" x2="22" y2="5"/><line x1="6.5" y1="12" x2="22" y2="12"/><line x1="6.5" y1="19" x2="22" y2="19"/></svg> },
                        { fmt: 'star-list', title: 'Star list', label: 'Star', svg: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><text x="0" y="8" fontSize="14" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">*</text><text x="0" y="15" fontSize="14" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">*</text><text x="0" y="22" fontSize="14" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">*</text><line x1="6.5" y1="5" x2="22" y2="5"/><line x1="6.5" y1="12" x2="22" y2="12"/><line x1="6.5" y1="19" x2="22" y2="19"/></svg> },
                        { fmt: 'dash-list', title: 'Dash list', label: 'Dash', svg: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="5" x2="7" y2="5" /><line x1="3" y1="12" x2="7" y2="12" /><line x1="3" y1="19" x2="7" y2="19" /><line x1="10" y1="5" x2="22" y2="5" /><line x1="10" y1="12" x2="22" y2="12" /><line x1="10" y1="19" x2="22" y2="19" /></svg> },
                        { fmt: 'arrow-list', title: 'Arrow list', label: 'Arrow', svg: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="5" x2="5" y2="5" /><polyline points="5,4 7,5 5,6" /><line x1="3" y1="12" x2="5" y2="12" /><polyline points="5,11 7,12 5,13" /><line x1="3" y1="19" x2="5" y2="19" /><polyline points="5,18 7,19 5,20" /><line x1="10" y1="5" x2="22" y2="5" /><line x1="10" y1="12" x2="22" y2="12" /><line x1="10" y1="19" x2="22" y2="19" /></svg> },
                        { fmt: 'upper-list', title: 'Uppercase letter list (A. B. C.)', label: 'Upper', svg: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><text x="0" y="5" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">A</text><text x="0" y="12" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">B</text><text x="0" y="19" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">C</text><line x1="6.5" y1="5" x2="22" y2="5"/><line x1="6.5" y1="12" x2="22" y2="12"/><line x1="6.5" y1="19" x2="22" y2="19"/></svg> },
                        { fmt: 'lower-list', title: 'Lowercase letter list (a. b. c.)', label: 'Lower', svg: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><text x="0" y="5" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">a</text><text x="0" y="12" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">b</text><text x="0" y="19" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">c</text><line x1="6.5" y1="5" x2="22" y2="5"/><line x1="6.5" y1="12" x2="22" y2="12"/><line x1="6.5" y1="19" x2="22" y2="19"/></svg> },
                        { fmt: 'roman-list', title: 'Roman numeral list (I. II. III.)', label: 'Roman', svg: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><text x="0" y="5" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">I</text><text x="0" y="12" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">II</text><text x="0" y="19" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">III</text><line x1="8.5" y1="5" x2="22" y2="5"/><line x1="8.5" y1="12" x2="22" y2="12"/><line x1="8.5" y1="19" x2="22" y2="19"/></svg> },
                        ]).map(({ fmt, title, label, svg }) => {
                          const isActive = activeFormats.has(fmt)
                          return (
                          <button key={fmt} title={title} onMouseDown={e => { e.preventDefault(); applyFormat(fmt) }}
                            style={{ background: isActive ? '#e8e8e8' : 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: isActive ? '#333' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: 'none' }}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? '#e8e8e8' : 'transparent' }}>
                            {svg}
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
                          </button>
                          )
                        })}
                      </div>
                      {/* Row 2: indent, align, spacing, ltr/rtl, clear formatting */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {/* Decrease indent */}
                        <button title="Decrease indent" onMouseDown={e => { e.preventDefault(); applyFormat('outdent') }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="4" x2="21" y2="4"/>
                            <line x1="9" y1="12" x2="3" y2="12"/>
                            <polyline points="7,8 3,12 7,16"/>
                            <line x1="11" y1="8" x2="21" y2="8"/>
                            <line x1="11" y1="12" x2="21" y2="12"/>
                            <line x1="11" y1="16" x2="21" y2="16"/>
                            <line x1="3" y1="20" x2="21" y2="20"/>
                          </svg>
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Outdent</span>
                        </button>
                        {/* Increase indent */}
                        {(() => { const isActive = activeFormats.has('indent'); return (
                        <button title="Increase indent" onMouseDown={e => { e.preventDefault(); applyFormat('indent') }}
                          style={{ background: isActive ? '#e8e8e8' : 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: isActive ? '#333' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: 'none' }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? '#e8e8e8' : 'transparent' }}>
                          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="4" x2="21" y2="4"/>
                            <line x1="2" y1="12" x2="8" y2="12"/>
                            <polyline points="4,8 8,12 4,16"/>
                            <line x1="11" y1="8" x2="21" y2="8"/>
                            <line x1="11" y1="12" x2="21" y2="12"/>
                            <line x1="11" y1="16" x2="21" y2="16"/>
                            <line x1="3" y1="20" x2="21" y2="20"/>
                          </svg>
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Indent</span>
                        </button>
                        )})()}
                        {/* Align dropdown */}
                        <div style={{ position: 'relative' }}>
                          <button data-toolbar-menu-toggle onMouseDown={e => toggleToolbarMenu(alignOpen, setAlignOpen, e)}
                            title="Alignment"
                            style={{ background: alignOpen ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0 1px', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                            onMouseEnter={e => { if (!alignOpen) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = alignOpen ? '#e8f0fe' : 'transparent' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                              {alignValue === 'Left' && <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="4" x2="21" y2="4"/><line x1="3" y1="8" x2="15" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="16" x2="15" y2="16"/><line x1="3" y1="20" x2="21" y2="20"/></svg>}
                              {alignValue === 'Center' && <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="4" x2="21" y2="4"/><line x1="6" y1="8" x2="18" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="6" y1="16" x2="18" y2="16"/><line x1="3" y1="20" x2="21" y2="20"/></svg>}
                              {alignValue === 'Right' && <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="4" x2="21" y2="4"/><line x1="9" y1="8" x2="21" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="9" y1="16" x2="21" y2="16"/><line x1="3" y1="20" x2="21" y2="20"/></svg>}
                              {alignValue === 'Justify' && <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="4" x2="21" y2="4"/><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="16" x2="21" y2="16"/><line x1="3" y1="20" x2="21" y2="20"/></svg>}
                              <ChevronDown size={11} color="#888" />
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Align</span>
                          </button>
                          {alignOpen && createPortal(
                            <div data-toolbar-menu style={{ position: 'fixed', bottom: toolbarMenuPos.bottom, left: toolbarMenuPos.left, zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                              {([
                                { label: 'Left',    icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="4" x2="21" y2="4"/><line x1="3" y1="8" x2="15" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="16" x2="15" y2="16"/><line x1="3" y1="20" x2="21" y2="20"/></svg> },
                                { label: 'Center',  icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="4" x2="21" y2="4"/><line x1="6" y1="8" x2="18" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="6" y1="16" x2="18" y2="16"/><line x1="3" y1="20" x2="21" y2="20"/></svg> },
                                { label: 'Right',   icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="4" x2="21" y2="4"/><line x1="9" y1="8" x2="21" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="9" y1="16" x2="21" y2="16"/><line x1="3" y1="20" x2="21" y2="20"/></svg> },
                                { label: 'Justify', icon: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="4" x2="21" y2="4"/><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="16" x2="21" y2="16"/><line x1="3" y1="20" x2="21" y2="20"/></svg> },
                              ]).map(({ label, icon }) => (
                                <button key={label} onMouseDown={e => { e.preventDefault(); setAlignValue(label); setAlignOpen(false); applyFormat(`align-${label}`) }}
                                  style={{ width: '100%', padding: '7px 14px', border: 'none', background: alignValue === label ? '#e8f0fe' : 'transparent', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: alignValue === label ? '#1a73e8' : '#333', whiteSpace: 'nowrap' }}
                                  onMouseEnter={e => { if (alignValue !== label) e.currentTarget.style.background = '#f5f5f5' }}
                                  onMouseLeave={e => { if (alignValue !== label) e.currentTarget.style.background = 'transparent' }}>
                                  {icon} {label}
                                </button>
                              ))}
                            </div>,
                            document.body
                          )}
                        </div>
                        {/* Spacing dropdown */}
                        <div style={{ position: 'relative' }}>
                          <button data-toolbar-menu-toggle onMouseDown={e => toggleToolbarMenu(spacingOpen, setSpacingOpen, e)}
                            title="Line spacing"
                            style={{ background: spacingOpen ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0 1px', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', fontSize: '12px', fontWeight: 500 }}
                            onMouseEnter={e => { if (!spacingOpen) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = spacingOpen ? '#e8f0fe' : 'transparent' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="10" y1="5" x2="21" y2="5"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="19" x2="21" y2="19"/>
                                <line x1="4" y1="4" x2="4" y2="10"/><line x1="4" y1="14" x2="4" y2="20"/>
                                <polyline points="1,7 4,4 7,7"/><polyline points="1,17 4,20 7,17"/>
                              </svg>
                              <ChevronDown size={11} color="#888" />
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Spacing</span>
                          </button>
                          {spacingOpen && createPortal(
                            <div data-toolbar-menu style={{ position: 'fixed', bottom: toolbarMenuPos.bottom, left: toolbarMenuPos.left, zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.12)', minWidth: '200px', overflow: 'hidden' }}>
                              {['1.0','1.15','1.5','2.0','2.5','3.0'].map(s => (
                                <button key={s} onMouseDown={e => { e.preventDefault(); setSpacingValue(s); setSpacingOpen(false); wrapSpan(`line-height:${s};display:inline-block`) }}
                                  style={{ width: '100%', padding: '7px 14px', border: 'none', background: spacingValue === s ? '#e8f0fe' : 'transparent', cursor: 'pointer', textAlign: 'left', display: 'block', fontSize: '13px', color: spacingValue === s ? '#1a73e8' : '#333' }}
                                  onMouseEnter={e => { if (spacingValue !== s) e.currentTarget.style.background = '#f5f5f5' }}
                                  onMouseLeave={e => { if (spacingValue !== s) e.currentTarget.style.background = 'transparent' }}>
                                  {s}
                                </button>
                              ))}
                              <div style={{ height: '1px', backgroundColor: '#e0e0e0', margin: '4px 0' }} />
                              <button onMouseDown={e => { e.preventDefault(); setSpacingOpen(false); applyFormat('space-before') }}
                                style={{ width: '100%', padding: '7px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#333', whiteSpace: 'nowrap' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                  <line x1="4" y1="14" x2="20" y2="14"/>
                                  <line x1="4" y1="19" x2="20" y2="19"/>
                                  <polyline points="8,6 12,10 16,6"/>
                                  <line x1="12" y1="2" x2="12" y2="10"/>
                                </svg>
                                Add space before paragraph
                              </button>
                              <button onMouseDown={e => { e.preventDefault(); setSpacingOpen(false); applyFormat('space-after') }}
                                style={{ width: '100%', padding: '7px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#333', whiteSpace: 'nowrap' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                  <line x1="4" y1="5" x2="20" y2="5"/>
                                  <line x1="4" y1="10" x2="20" y2="10"/>
                                  <polyline points="8,18 12,22 16,18"/>
                                  <line x1="12" y1="14" x2="12" y2="22"/>
                                </svg>
                                Add space after paragraph
                              </button>
                            </div>,
                            document.body
                          )}
                        </div>
                        {/* LTR */}
                        {(() => { const isActive = activeFormats.has('ltr'); return (
                        <button title="Left to Right" onMouseDown={e => { e.preventDefault(); applyFormat('ltr') }}
                          style={{ background: isActive ? '#e8e8e8' : 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: isActive ? '#333' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: 'none' }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? '#e8e8e8' : 'transparent' }}>
                          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="13" y1="3" x2="18" y2="3"/>
                            <polyline points="16 1 18 3 16 5"/>
                            <text x="12" y="14.5" textAnchor="middle" fontSize="12" fontWeight="normal" fill="currentColor" stroke="none" fontFamily="sans-serif">Aa</text>
                            <line x1="4" y1="20" x2="20" y2="20"/>
                            <polyline points="17 17 20 20 17 23"/>
                          </svg>
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>LTR</span>
                        </button>
                        )})()}
                        {/* RTL */}
                        {(() => { const isActive = activeFormats.has('rtl'); return (
                        <button title="Right to Left" onMouseDown={e => { e.preventDefault(); applyFormat('rtl') }}
                          style={{ background: isActive ? '#e8e8e8' : 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: isActive ? '#333' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: 'none' }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? '#e8e8e8' : 'transparent' }}>
                          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="3" x2="13" y2="3"/>
                            <polyline points="15 1 13 3 15 5"/>
                            <text x="12" y="14.5" textAnchor="middle" fontSize="12" fontWeight="normal" fill="currentColor" stroke="none" fontFamily="sans-serif">Aa</text>
                            <line x1="20" y1="20" x2="4" y2="20"/>
                            <polyline points="7 17 4 20 7 23"/>
                          </svg>
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>RTL</span>
                        </button>
                        )})()}
                        {/* Clear formatting (A with clear slash) */}
                        <button title="Clear formatting" onMouseDown={e => { e.preventDefault(); applyFormat('clear') }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                              <text x="1" y="18" fontSize="19" fontWeight="bold" fontFamily="serif" fill="currentColor" stroke="none">A</text>
                              <line x1="3" y1="21" x2="21" y2="21"/>
                              <line x1="17" y1="3" x2="23" y2="21"/>
                            </svg>
                            <Eraser size={14} />
                          </div>
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.2 }}>Clear<br />Formatting</span>
                        </button>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Lists</span>
                    </div>
                    {/* Column divider */}
                    <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                    {/* INSERT group */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px' }}>
                      {/* Row 1: Link, Attach, Picture */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button data-toolbar-menu-toggle title="Insert link (Ctrl+K)" onMouseDown={openLinkPopover}
                          style={{ background: linkPopoverOpen ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: linkPopoverOpen ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                          onMouseEnter={e => { if (!linkPopoverOpen) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = linkPopoverOpen ? '#e8f0fe' : 'transparent' }}>
                          <Link size={30} strokeWidth={1} />
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Link</span>
                        </button>
                        <div style={{ position: 'relative' }}>
                          <button title="Attach files" onMouseDown={e => {
                              e.preventDefault(); saveEditorSelection()
                              if (showAttachMenu) { setShowAttachMenu(false); return }
                              const rect = e.currentTarget.getBoundingClientRect()
                              setAttachMenuAnchor({ x: rect.left, y: rect.top })
                              setShowAttachMenu(true)
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                            <Paperclip size={30} strokeWidth={1} />
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Attach</span>
                          </button>
                          {showAttachMenu && attachMenuAnchor && (<>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onMouseDown={() => setShowAttachMenu(false)} />
                            <div style={{ position: 'fixed', bottom: window.innerHeight - attachMenuAnchor.y + 6, left: attachMenuAnchor.x, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 4px 18px rgba(0,0,0,0.18)', zIndex: 9999, minWidth: '130px', overflow: 'hidden', padding: '4px 0' }}>
                              <div style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '13px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                onMouseDown={e => {
                                  e.preventDefault(); setShowAttachMenu(false)
                                  const input = document.getElementById('chatmail-file-input') as HTMLInputElement
                                  if (input) { input.accept = ''; input.multiple = true; input.click() }
                                }}>
                                <FileText size={14} strokeWidth={1.5} /> Files
                              </div>
                              <div style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '13px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                onMouseDown={e => {
                                  e.preventDefault(); setShowAttachMenu(false)
                                  const input = document.getElementById('chatmail-folder-input') as HTMLInputElement
                                  if (input) input.click()
                                }}>
                                <Folder size={14} strokeWidth={1.5} /> Folder
                              </div>
                            </div>
                          </>)}
                        </div>
                        <button title="Insert picture" onMouseDown={e => { e.preventDefault(); document.getElementById('chatmail-image-input')?.click() }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                          <Image size={30} strokeWidth={1} />
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Picture</span>
                        </button>
                      </div>
                      {/* Row 2: Emoji, Signature, Table */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ position: 'relative' }}>
                          <button title="Emoji" onMouseDown={e => { e.preventDefault(); setEmojiPickerOpen(o => !o) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                            <Smile size={30} strokeWidth={1} />
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Emoji</span>
                          </button>
                          {emojiPickerOpen && (
                            <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 300, background: '#fff', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 -4px 16px rgba(0,0,0,0.15)', padding: '8px', marginBottom: '4px', width: '220px' }}>
                              <div style={{ fontSize: '10px', fontWeight: 600, color: '#aaa', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: '6px' }}>Emoji</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                {['😊','😂','❤️','👍','🎉','😍','😢','😎','🤔','👋','🙏','😁','😅','🤣','😘','😭','🔥','✨','💯','🎊','👀','🚀','💪','🤝','😴','😡','🤯','😇','🥳','😏','🤩','😬','😜','🥺','😞','💀','🤦','🤷','🙄','😤','📝','📌','📎','📚','💡','🎯','✅','❌','⚡','💬','🎵','🌟','🌈','🍕','☕','🌸','🐶','🐱','🦋','🌍'].map(em => (
                                  <button key={em} onMouseDown={e => {
                                    e.preventDefault()
                                    if (!editorRef.current) return;
                                    editorRef.current.focus();
                                    document.execCommand('insertText', false, em);
                                    setInputValue(editorRef.current.innerHTML);
                                    hasInteractedRef.current = true;
                                    setEmojiPickerOpen(false);
                                  }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '2px', borderRadius: '4px', lineHeight: 1 }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                    {em}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <button data-toolbar-menu-toggle title="Signature" onMouseDown={openSignaturePopover}
                          style={{ background: signaturePopoverOpen ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: signaturePopoverOpen ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                          onMouseEnter={e => { if (!signaturePopoverOpen) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = signaturePopoverOpen ? '#e8f0fe' : 'transparent' }}>
                          <PenLine size={30} strokeWidth={1} />
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Signature</span>
                        </button>
                        <div style={{ position: 'relative' }}>
                          <button data-toolbar-menu-toggle onMouseDown={e => toggleToolbarMenu(tableOpen, setTableOpen, e)}
                            title="Insert table"
                            style={{ background: tableOpen ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0 1px', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                            onMouseEnter={e => { if (!tableOpen) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = tableOpen ? '#e8f0fe' : 'transparent' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Table2 size={30} strokeWidth={1} />
                              <ChevronDown size={11} color="#888" />
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Table</span>
                          </button>
                          {tableOpen && createPortal(
                            <div data-toolbar-menu style={{ position: 'fixed', bottom: toolbarMenuPos.bottom, left: toolbarMenuPos.left, zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.12)', padding: '8px' }}>
                              <div style={{ fontSize: '10px', color: '#888', marginBottom: '6px', textAlign: 'center' }}>
                                {tableHover[0] > 0 ? `${tableHover[1]} × ${tableHover[0]}` : 'Insert Table'}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 16px)', gap: '4px' }}>
                                {Array.from({ length: 5 }, (_, r) =>
                                  Array.from({ length: 6 }, (_, c) => (
                                    <div key={`${r}-${c}`}
                                      onMouseEnter={() => setTableHover([r + 1, c + 1])}
                                      onMouseLeave={() => setTableHover([0, 0])}
                                      onMouseDown={e => { e.preventDefault(); insertTable(r + 1, c + 1) }}
                                      style={{ width: '16px', height: '16px', border: '1px solid', borderColor: r < tableHover[0] && c < tableHover[1] ? '#1a73e8' : '#ddd', borderRadius: '2px', cursor: 'pointer', background: r < tableHover[0] && c < tableHover[1] ? '#e8f0fe' : '#fff' }}
                                    />
                                  ))
                                )}
                              </div>
                            </div>,
                            document.body
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Insert</span>
                    </div>
                    {/* Column divider */}
                    <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                    {/* DRAW: Canvas Board button */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px' }}>
                      <button
                        onMouseDown={e => { e.preventDefault(); openCanvasMode(inputValue) }}
                        title="Add Canvas Board to field"
                        style={{ background: canvasMode ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: canvasMode ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', height: '70px' }}
                        onMouseEnter={e => { if (!canvasMode) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                        onMouseLeave={e => { if (!canvasMode) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <svg width="55" height="55" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 14l3-3 2 2 3-4 2 3"/>
                        </svg>
                        <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Canvas</span>
                      </button>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Board</span>
                    </div>
                    {/* Column divider */}
                    <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                    {/* DRAW: Selection group */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px', opacity: canvasMode ? 1 : 0.4, pointerEvents: canvasMode ? 'auto' : 'none' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {([
                            { key: 'select', icon: <MousePointer2 size={30} strokeWidth={1} />, label: 'Select' },
                            { key: 'lasso',  icon: <Lasso size={30} strokeWidth={1} />,         label: 'Lasso'  },
                          ]).map(({ key, icon, label }) => (
                            <button key={key} title={label} onMouseDown={e => { e.preventDefault(); setDrawTool(key); if (toolColors[key]) setDrawColor(toolColors[key]) }}
                              style={{ background: drawTool === key ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: drawTool === key ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                              onMouseEnter={e => { if (drawTool !== key) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                              onMouseLeave={e => { if (drawTool !== key) e.currentTarget.style.backgroundColor = 'transparent' }}>
                              {icon}
                              <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>{label}</span>
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button title="Pan" onMouseDown={e => { e.preventDefault(); setDrawTool('hand'); if (toolColors['hand']) setDrawColor(toolColors['hand']) }}
                            style={{ background: drawTool === 'hand' ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: drawTool === 'hand' ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                            onMouseEnter={e => { if (drawTool !== 'hand') e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { if (drawTool !== 'hand') e.currentTarget.style.backgroundColor = 'transparent' }}>
                            <Hand size={30} strokeWidth={1} />
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Pan</span>
                          </button>
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Selection</span>
                    </div>
                    {/* DRAW: Lasso shape selector — visible only when a lasso selection is active */}
                    {hasLassoSel && (<>
                      <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          {([
                            { key: 'lasso',    title: 'Lasso shape',    svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3C7 3 3 6.5 3 10.5c0 2.5 1.5 4.5 3.5 5.5L8 21l4-2 4 2 1.5-5C19.5 15 21 13 21 10.5 21 6.5 17 3 12 3z"/></svg> },
                            { key: 'rect',     title: 'Rectangle',      svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="1"/></svg> },
                            { key: 'circle',   title: 'Circle',         svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/></svg> },
                            { key: 'triangle', title: 'Triangle',       svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12,3 22,21 2,21"/></svg> },
                            { key: 'diamond',  title: 'Diamond',        svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12,2 22,12 12,22 2,12"/></svg> },
                            { key: 'star',     title: 'Star',           svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg> },
                          ]).map(({ key, title, svg }) => (
                            <button key={key} title={title}
                              onMouseDown={e => { e.preventDefault(); changeLassoClipShape(key) }}
                              style={{ background: lassoClipShape === key ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '2px', borderRadius: '4px', color: lassoClipShape === key ? '#1a73e8' : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onMouseEnter={e => { if (lassoClipShape !== key) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                              onMouseLeave={e => { if (lassoClipShape !== key) e.currentTarget.style.backgroundColor = 'transparent' }}>
                              {svg}
                            </button>
                          ))}
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Shape</span>
                      </div>
                    </>)}
                    {/* Column divider */}
                    <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                    {/* DRAW: Drawing group */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px', opacity: canvasMode ? 1 : 0.4, pointerEvents: canvasMode ? 'auto' : 'none' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gridTemplateRows: 'auto auto', columnGap: '4px', rowGap: '8px', alignItems: 'start' }}>
                        {/* Pens section */}
                        {([
                          { key: 'pen',        label: 'Pen',       icon: <svg width="24" height="18" viewBox="0 0 12 18" preserveAspectRatio="none"><polygon points="5.3,1.8 6.7,1.8 6,0" fill="#444"/><polygon points="2.5,5 9.5,5 6,0" fill="#e0c88a"/><rect x="2.5" y="5" width="7" height="9" fill={toolColors['pen'] || '#000000'}/><rect x="2.5" y="14" width="7" height="1.5" fill="#bbb"/><rect x="2.5" y="15.5" width="7" height="2.5" rx="1" fill="#f0b8b8"/></svg> },
                          { key: 'effect-pen', label: 'Effect',    icon: <svg width="24" height="18" viewBox="0 0 12 18" preserveAspectRatio="none"><polygon points="5.3,1.8 6.7,1.8 6,0" fill="#444"/><polygon points="2.5,5 9.5,5 6,0" fill="#e0c88a"/><rect x="2.5" y="5" width="7" height="9" fill={toolColors['effect-pen'] || '#7c4dff'}/><rect x="2.5" y="14" width="7" height="1.5" fill="#bbb"/><rect x="2.5" y="15.5" width="7" height="2.5" rx="1" fill="#f0b8b8"/></svg> },
                          { key: 'highlight',  label: 'Highlight', icon: <Highlighter width={24} height={18} preserveAspectRatio="none" strokeWidth={1} color="#444" fill={toolColors['highlight'] || '#ffe066'} style={{ transform: 'rotate(135deg)' }} /> },
                          { key: 'text',       label: 'Text',      icon: <svg width="24" height="18" viewBox="0 0 24 24" preserveAspectRatio="none" fill="none"><text x="4" y="18" fontSize="16" fontWeight="700" fill="currentColor" fontFamily="serif">T</text><line x1="4" y1="21" x2="20" y2="21" stroke="currentColor" strokeWidth="1.2"/></svg> },
                          { key: 'eraser',     label: 'Erase',     icon: <Eraser width={24} height={18} preserveAspectRatio="none" strokeWidth={1} /> },
                        ]).map(({ key, label, icon }) => {
                          const gridPos: Record<string, { gridColumn: number; gridRow: number }> = {
                            'pen':        { gridColumn: 1, gridRow: 1 },
                            'effect-pen': { gridColumn: 2, gridRow: 1 },
                            'highlight':  { gridColumn: 3, gridRow: 1 },
                            'text':       { gridColumn: 2, gridRow: 2 },
                            'eraser':     { gridColumn: 3, gridRow: 2 },
                          }
                          return (
                          <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', position: 'relative', ...gridPos[key] }}>
                            <button title={label} onMouseDown={e => { e.preventDefault(); setDrawTool(key); if (toolColors[key]) setDrawColor(toolColors[key]) }}
                              style={{ background: (drawTool === key || openPenDropdown === key) ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: (drawTool === key || openPenDropdown === key) ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                              onMouseEnter={e => { if (drawTool !== key && openPenDropdown !== key) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = (drawTool === key || openPenDropdown === key) ? '#e8f0fe' : 'transparent' }}>
                              {icon}
                              <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>{label}</span>
                            </button>
                            {key !== 'eraser' && <button data-pen-toggle onMouseDown={e => { e.preventDefault(); if (openPenDropdown !== key) { const r = (e.currentTarget.parentElement || e.currentTarget).getBoundingClientRect(); setPenDropdownPos({ top: r.top - 4, left: r.left + r.width / 2 }); penDropdownSnapshotRef.current = { tk: key, color: toolColors[key] || drawColor, toolColor: toolColors[key], highlight: toolHighlightColors[key] } } setOpenPenDropdown(openPenDropdown === key ? null : key) }}
                              style={{ padding: '0 10px', border: '1px solid #e0e0e0', borderRadius: '3px', background: openPenDropdown === key ? '#e8f0fe' : '#f8f8f8', cursor: 'pointer', fontSize: '16px', color: '#888', lineHeight: 1, height: '10px', display: 'flex', alignItems: 'center' }}>▾</button>}
                            {key !== 'eraser' && openPenDropdown === key && penDropdownPos && (
                              <div data-pen-dropdown style={{ position: 'fixed', top: penDropdownPos.top, left: penDropdownPos.left, transform: 'translateX(-50%) translateY(-100%)', zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                  {/* Left: swatches + selected color */}
                                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontSize: '13px', fontWeight: 600, color: (toolHighlightColors[key] && toolHighlightColors[key] !== 'transparent') ? toolHighlightColors[key] : '#555' }}>{label}</span>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 30px)', gap: '8px' }}>
                                        {PEN_HIGHLIGHT_COLORS.map(c => {
                                          const tk = openPenDropdown ? (openPenDropdown.startsWith('shape-') ? openPenDropdown.slice(6) : openPenDropdown) : ''
                                          const active = (toolHighlightColors[tk] || 'transparent') === c
                                          return (
                                            <button key={c} onMouseDown={e => { e.preventDefault(); if (tk === 'highlight') { setToolHighlightColors(prev => ({ ...prev, [tk]: c })) } else if (tk) { setToolColors(prev => ({ ...prev, [tk]: c })) } setDrawColor(c); if (tk) setDrawTool(tk); setOpenPenDropdown(null) }}
                                              style={{ width: '30px', height: '30px', borderRadius: '50%', background: c === 'transparent' ? 'linear-gradient(to bottom right, #fff 45%, #f00 45%, #f00 55%, #fff 55%)' : c, border: active ? '3px solid #1a73e8' : '2px solid rgba(0,0,0,0.08)', cursor: 'pointer', outline: 'none' }} />
                                          )
                                        })}
                                      </div>
                                    </div>
                                    <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(4, 30px)', gap: '8px' }}>
                                      {[...PEN_MAIN_COLORS, ...customDrawColors].map(c => (
                                        <button key={c} onMouseDown={e => { e.preventDefault(); if (openPenDropdown) { const tk = openPenDropdown.startsWith('shape-') ? openPenDropdown.slice(6) : openPenDropdown; setToolColors(prev => ({ ...prev, [tk]: c })); setDrawTool(openPenDropdown.startsWith('shape-') ? openPenDropdown.slice(6) : openPenDropdown) } setDrawColor(c); setOpenPenDropdown(null) }}
                                          style={{ width: '30px', height: '30px', borderRadius: '50%', background: c, border: drawColor === c ? '3px solid #1a73e8' : '2px solid rgba(0,0,0,0.08)', cursor: 'pointer', outline: 'none' }} />
                                      ))}
                                    </div>
                                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Selected color</span>
                                      <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #c0c0c0', borderRadius: '6px', overflow: 'hidden', width: 'fit-content' }}>
                                        <div style={{ width: '50px', height: '56px', background: drawColor, flexShrink: 0 }} />
                                        <input type="text" value={drawColor} maxLength={7}
                                          onChange={e => { if (/^#[0-9a-f]{0,6}$/i.test(e.target.value)) { const c = e.target.value; setDrawColor(c); if (openPenDropdown) { const tk = openPenDropdown.startsWith('shape-') ? openPenDropdown.slice(6) : openPenDropdown; setToolColors(prev => ({ ...prev, [tk]: c })); setDrawTool(openPenDropdown.startsWith('shape-') ? openPenDropdown.slice(6) : openPenDropdown) } } }}
                                          onMouseDown={e => e.stopPropagation()}
                                          placeholder="#607d8b"
                                          style={{ padding: '18px 10px', backgroundColor: 'white', border: 'none', fontSize: '14px', fontFamily: 'monospace', outline: 'none', width: '110px' }} />
                                      </div>
                                    </div>
                                  </div>
                                  {/* Right: ColorPicker */}
                                  <ColorPicker value={drawColor} onChange={setDrawColor} showHex={false} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                                  <button onMouseDown={e => { e.preventDefault(); const snap = penDropdownSnapshotRef.current; if (snap) { setDrawColor(snap.color); if (snap.toolColor !== undefined) setToolColors(prev => ({ ...prev, [snap.tk]: snap.toolColor as string })); if (snap.highlight !== undefined) setToolHighlightColors(prev => ({ ...prev, [snap.tk]: snap.highlight as string })) } setOpenPenDropdown(null) }}
                                    style={{ padding: '6px 16px', border: '1px solid #ddd', borderRadius: '16px', background: '#fff', color: '#555', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                                  <button onMouseDown={e => { e.preventDefault(); setOpenPenDropdown(null) }}
                                    style={{ padding: '6px 16px', border: 'none', borderRadius: '16px', background: '#1a73e8', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Save</button>
                                </div>
                              </div>
                            )}
                          </div>
                          )
                        })}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Drawing</span>
                    </div>
                    {/* Size divider between Drawing and Shapes */}
                    <div data-text-size-control style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', margin: '0 4px', opacity: canvasMode ? 1 : 0.4, pointerEvents: canvasMode ? 'auto' : 'none' }}>
                      {drawTool === 'text' ? (
                        <>
                          <input type="range" min={8} max={72} value={drawFontSize} disabled={!SIZABLE_DRAW_TOOLS.has(drawTool)} onChange={e => setDrawFontSize(Number(e.target.value))} style={{ width: '60px', cursor: SIZABLE_DRAW_TOOLS.has(drawTool) ? 'pointer' : 'not-allowed', opacity: SIZABLE_DRAW_TOOLS.has(drawTool) ? 1 : 0.4 }} />
                          <input type="number" min={8} max={72} value={drawFontSize} disabled={!SIZABLE_DRAW_TOOLS.has(drawTool)} onChange={e => setDrawFontSize(Math.max(8, Math.min(72, Number(e.target.value))))} onMouseDown={e => e.stopPropagation()} style={{ width: '44px', height: '22px', fontSize: '14px', fontWeight: 600, color: '#555', textAlign: 'center', border: '1px solid #ddd', borderRadius: '3px', padding: '0 2px', outline: 'none', cursor: SIZABLE_DRAW_TOOLS.has(drawTool) ? 'text' : 'not-allowed', opacity: SIZABLE_DRAW_TOOLS.has(drawTool) ? 1 : 0.4 }} />
                        </>
                      ) : (
                        <>
                          <input type="range" min={1} max={20} value={drawLineWidth} disabled={!SIZABLE_DRAW_TOOLS.has(drawTool)} onChange={e => setDrawLineWidth(Number(e.target.value))} style={{ width: '60px', cursor: SIZABLE_DRAW_TOOLS.has(drawTool) ? 'pointer' : 'not-allowed', opacity: SIZABLE_DRAW_TOOLS.has(drawTool) ? 1 : 0.4 }} />
                          <input type="number" min={1} max={20} value={drawLineWidth} disabled={!SIZABLE_DRAW_TOOLS.has(drawTool)} onChange={e => setDrawLineWidth(Math.max(1, Math.min(20, Number(e.target.value))))} onMouseDown={e => e.stopPropagation()} style={{ width: '44px', height: '22px', fontSize: '14px', fontWeight: 600, color: '#555', textAlign: 'center', border: '1px solid #ddd', borderRadius: '3px', padding: '0 2px', outline: 'none', cursor: SIZABLE_DRAW_TOOLS.has(drawTool) ? 'text' : 'not-allowed', opacity: SIZABLE_DRAW_TOOLS.has(drawTool) ? 1 : 0.4 }} />
                        </>
                      )}
                      <span style={{ fontSize: '9px', fontWeight: 600, color: '#555', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Size</span>
                      <div style={{ width: '1px', flex: 1, minHeight: '6px', background: '#e0e0e0' }} />
                    </div>
                    {/* DRAW: Shapes group */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px', opacity: canvasMode ? 1 : 0.4, pointerEvents: canvasMode ? 'auto' : 'none' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gridTemplateRows: 'auto auto', columnGap: '4px', rowGap: '8px', alignItems: 'start' }}>
                        {/* Line, Rect, Circle */}
                        {([
                          { key: 'line',     icon: <Minus    width={24} height={18} preserveAspectRatio="none" strokeWidth={1} />, label: 'Line'    },
                          { key: 'rect',     icon: <Square   width={24} height={18} preserveAspectRatio="none" strokeWidth={1} />, label: 'Rectangle' },
                          { key: 'circle',   icon: <Circle   size={18} strokeWidth={1} />, label: 'Circle'  },
                          { key: 'triangle', icon: <Triangle width={24} height={18} preserveAspectRatio="none" strokeWidth={1} />, label: 'Triangle'},
                          { key: 'diamond',  icon: <Diamond  width={24} height={18} preserveAspectRatio="none" strokeWidth={1} />, label: 'Diamond' },
                          { key: 'star',     icon: <Star     width={24} height={18} preserveAspectRatio="none" strokeWidth={1} />, label: 'Star'    },
                        ]).map(({ key, icon, label }) => {
                          const dkey = `shape-${key}`
                          const gridPos: Record<string, { gridColumn: number; gridRow: number }> = {
                            'line': { gridColumn: 1, gridRow: 1 }, 'rect': { gridColumn: 2, gridRow: 1 }, 'circle': { gridColumn: 3, gridRow: 1 },
                            'triangle': { gridColumn: 1, gridRow: 2 }, 'diamond': { gridColumn: 2, gridRow: 2 }, 'star': { gridColumn: 3, gridRow: 2 },
                          }
                          return (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', position: 'relative', ...gridPos[key] }}>
                              <button title={label} onMouseDown={e => { e.preventDefault(); setDrawTool(key); if (toolColors[key]) setDrawColor(toolColors[key]) }}
                                style={{ background: (drawTool === key || openPenDropdown === dkey) ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: (drawTool === key || openPenDropdown === dkey) ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                                onMouseEnter={e => { if (drawTool !== key && openPenDropdown !== dkey) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = (drawTool === key || openPenDropdown === dkey) ? '#e8f0fe' : 'transparent' }}>
                                {icon}
                                <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', color: (drawTool === key || openPenDropdown === dkey) ? '#1a73e8' : (toolColors[key] || '#555') }}>{label}</span>
                              </button>
                              <button data-pen-toggle onMouseDown={e => { e.preventDefault(); if (openPenDropdown !== dkey) { const r = (e.currentTarget.parentElement || e.currentTarget).getBoundingClientRect(); setPenDropdownPos({ top: r.top - 4, left: r.left + r.width / 2 }); const tk = dkey.slice(6); penDropdownSnapshotRef.current = { tk, color: toolColors[tk] || drawColor, toolColor: toolColors[tk], highlight: toolHighlightColors[tk] } } setOpenPenDropdown(openPenDropdown === dkey ? null : dkey) }}
                                style={{ padding: '0 10px', border: '1px solid #e0e0e0', borderRadius: '3px', background: openPenDropdown === dkey ? '#e8f0fe' : '#f8f8f8', cursor: 'pointer', fontSize: '16px', color: '#888', lineHeight: 1, height: '10px', display: 'flex', alignItems: 'center' }}>▾</button>
                              {openPenDropdown === dkey && penDropdownPos && (
                                <div data-pen-dropdown style={{ position: 'fixed', top: penDropdownPos.top, left: penDropdownPos.left, transform: 'translateX(-50%) translateY(-100%)', zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 0 8px', marginBottom: '10px', borderBottom: '1px solid #f0f0f0', fontSize: '12px', fontWeight: 600, color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                    <span style={{ display: 'flex', alignItems: 'center' }}>{cloneElement(icon, { size: 14 })}</span>
                                    {label} Color
                                  </div>
                                  {dkey.startsWith('shape-') && (
                                    <div style={{ position: 'relative', marginBottom: '10px' }}>
                                      <button onMouseDown={e => { e.preventDefault(); setShapeColorModeOpen(v => !v) }}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '6px', background: '#fafafa', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#333' }}>
                                        {shapeColorMode === 'highlight' ? <Highlighter size={14} /> : <Pencil size={14} />}
                                        <span style={{ flex: 1, textAlign: 'left', textTransform: 'capitalize' }}>{shapeColorMode}</span>
                                        <ChevronDown size={12} color="#888" />
                                      </button>
                                      {shapeColorModeOpen && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '2px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1, overflow: 'hidden' }}>
                                          {(['regular', 'highlight'] as const).map(m => (
                                            <button key={m} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setShapeColorMode(m); setShapeColorModeOpen(false) }}
                                              style={{ width: '100%', padding: '7px 10px', border: 'none', background: shapeColorMode === m ? '#e8f0fe' : 'transparent', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 500, color: shapeColorMode === m ? '#1a73e8' : '#333', textTransform: 'capitalize' }}
                                              onMouseEnter={e => { if (shapeColorMode !== m) e.currentTarget.style.background = '#f5f5f5' }}
                                              onMouseLeave={e => { if (shapeColorMode !== m) e.currentTarget.style.background = 'transparent' }}>
                                              {m === 'highlight' ? <Highlighter size={14} /> : <Pencil size={14} />}
                                              {m}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 30px)', gap: '8px' }}>
                                          {PEN_HIGHLIGHT_COLORS.map(c => {
                                            const tk = openPenDropdown ? (openPenDropdown.startsWith('shape-') ? openPenDropdown.slice(6) : openPenDropdown) : ''
                                            const useHighlight = dkey.startsWith('shape-') ? shapeColorMode === 'highlight' : tk === 'highlight'
                                            const active = (toolHighlightColors[tk] || 'transparent') === c
                                            return (
                                              <button key={c} onMouseDown={e => { e.preventDefault(); if (useHighlight) { setToolHighlightColors(prev => ({ ...prev, [tk]: c })) } else if (tk) { setToolColors(prev => ({ ...prev, [tk]: c })); if (dkey.startsWith('shape-')) setToolHighlightColors(prev => ({ ...prev, [tk]: 'transparent' })) } setDrawColor(c); if (tk) setDrawTool(tk); setOpenPenDropdown(null) }}
                                                style={{ width: '30px', height: '30px', borderRadius: '50%', background: c === 'transparent' ? 'linear-gradient(to bottom right, #fff 45%, #f00 45%, #f00 55%, #fff 55%)' : c, border: active ? '3px solid #1a73e8' : '2px solid rgba(0,0,0,0.08)', cursor: 'pointer', outline: 'none' }} />
                                            )
                                          })}
                                        </div>
                                      </div>
                                      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(4, 30px)', gap: '8px' }}>
                                        {[...PEN_MAIN_COLORS, ...customDrawColors].map(c => (
                                          <button key={c} onMouseDown={e => { e.preventDefault(); if (openPenDropdown) { const tk = openPenDropdown.startsWith('shape-') ? openPenDropdown.slice(6) : openPenDropdown; if (dkey.startsWith('shape-') && shapeColorMode === 'highlight') { setToolHighlightColors(prev => ({ ...prev, [tk]: c })) } else { setToolColors(prev => ({ ...prev, [tk]: c })); if (dkey.startsWith('shape-')) setToolHighlightColors(prev => ({ ...prev, [tk]: 'transparent' })) } setDrawTool(tk) } setDrawColor(c); setOpenPenDropdown(null) }}
                                            style={{ width: '30px', height: '30px', borderRadius: '50%', background: c, border: drawColor === c ? '3px solid #1a73e8' : '2px solid rgba(0,0,0,0.08)', cursor: 'pointer', outline: 'none' }} />
                                        ))}
                                      </div>
                                      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Selected color</span>
                                        <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #c0c0c0', borderRadius: '6px', overflow: 'hidden', width: 'fit-content' }}>
                                          <div style={{ width: '50px', height: '56px', background: drawColor, flexShrink: 0 }} />
                                          <input type="text" value={drawColor} maxLength={7}
                                            onChange={e => { if (/^#[0-9a-f]{0,6}$/i.test(e.target.value)) setDrawColor(e.target.value) }}
                                            onMouseDown={e => e.stopPropagation()} placeholder="#607d8b"
                                            style={{ padding: '18px 10px', backgroundColor: 'white', border: 'none', fontSize: '14px', fontFamily: 'monospace', outline: 'none', width: '110px' }} />
                                        </div>
                                      </div>
                                    </div>
                                    <ColorPicker value={drawColor} onChange={setDrawColor} showHex={false} />
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                                    <button onMouseDown={e => { e.preventDefault(); const snap = penDropdownSnapshotRef.current; if (snap) { setDrawColor(snap.color); if (snap.toolColor !== undefined) setToolColors(prev => ({ ...prev, [snap.tk]: snap.toolColor as string })); if (snap.highlight !== undefined) setToolHighlightColors(prev => ({ ...prev, [snap.tk]: snap.highlight as string })) } setOpenPenDropdown(null) }}
                                      style={{ padding: '6px 16px', border: '1px solid #ddd', borderRadius: '16px', background: '#fff', color: '#555', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                                    <button onMouseDown={e => { e.preventDefault(); setOpenPenDropdown(null) }}
                                      style={{ padding: '6px 16px', border: 'none', borderRadius: '16px', background: '#1a73e8', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Save</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Shapes</span>
                    </div>
                    {/* Column divider */}
                    <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                    {/* DRAW: Zoom group */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px', opacity: canvasMode ? 1 : 0.4, pointerEvents: canvasMode ? 'auto' : 'none' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        {([
                          { key: 'zoom-in',  icon: <ZoomIn  size={30} strokeWidth={1} />, label: 'Zoom In' },
                          { key: 'zoom-out', icon: <ZoomOut size={30} strokeWidth={1} />, label: 'Zoom Out'},
                        ]).map(({ key, icon, label }) => (
                          <button key={key} title={label} onMouseDown={e => { e.preventDefault(); setDrawTool(key); if (toolColors[key]) setDrawColor(toolColors[key]) }}
                            style={{ background: drawTool === key ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: drawTool === key ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                            onMouseEnter={e => { if (drawTool !== key) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { if (drawTool !== key) e.currentTarget.style.backgroundColor = 'transparent' }}>
                            {icon}
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
                          </button>
                        ))}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Zoom</span>
                    </div>
                    {/* Column divider */}
                    <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                    {/* DRAW: Clear group */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: canvasMode ? 1 : 0.4, pointerEvents: canvasMode ? 'auto' : 'none' }}>
                      <button title="Clear canvas" onMouseDown={e => { e.preventDefault(); setConfirmDialog({ title: 'Clear canvas?', message: 'This will clear the current drawing on the canvas board. This can be undone with Undo.', onConfirm: clearCanvasMode }) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: '#e53935', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fce4e4' }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}>
                        <Trash2 size={20} strokeWidth={1} />
                        <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.4, color: '#e53935' }}>Clear<br />Canvas</span>
                      </button>
                    </div>
                  </div>
                    {textToolbarOverflow.right && (
                      <button onMouseDown={e => { e.preventDefault(); document.getElementById('text-toolbar-scroll')?.scrollBy({ left: 160, behavior: 'smooth' }) }}
                        style={{ flexShrink: 0, background: '#e8f0fe', border: 'none', borderLeft: '1px solid #e8e8e8', cursor: 'pointer', padding: '0', color: '#1a73e8', display: 'flex', alignItems: 'center', alignSelf: 'stretch' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#1a73e8'; e.currentTarget.style.backgroundColor = '#d2e3fc' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#1a73e8'; e.currentTarget.style.backgroundColor = '#e8f0fe' }}>
                        <ChevronRight size={20} />
                      </button>
                    )}
                  </div>
                  <input id="chatmail-folder-input" type="file" multiple style={{ display: 'none' }}
                    {...{ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>}
                    onChange={async e => {
                      const folderFiles = Array.from(e.target.files || [])
                      e.target.value = ''
                      if (!folderFiles.length || !editorRef.current) return
                      const editor = editorRef.current
                      const folderName = (folderFiles[0] as any).webkitRelativePath?.split('/')[0] || 'Folder'

                      // Restore saved editor selection before inserting card
                      editor.focus()
                      const sel = window.getSelection()
                      sel?.removeAllRanges(); sel?.addRange(getSafeAttachRange())

                      const cardId = Date.now().toString(36) + Math.random().toString(36).slice(2)
                      const card = document.createElement('span')
                      card.setAttribute('contenteditable', 'false')
                      card.dataset.fileCard = '1'; card.dataset.cardId = cardId
                      card.dataset.attachment = encodeURIComponent(folderName)
                      card.dataset.folderCard = '1'
                      try { card.dataset.folderFiles = JSON.stringify(buildFolderTree(folderFiles)) } catch {}
                      card.style.cssText = 'position:relative;display:inline-block;width:150px;margin:4px;vertical-align:middle;border:1px solid #b0bec5;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);cursor:pointer'
                      const body = document.createElement('span')
                      body.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:114px;background:#e8f4fd;gap:4px;pointer-events:none'
                      body.innerHTML = `<svg width="52" height="52" viewBox="0 0 24 24" fill="#42a5f5" stroke="none"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg><span style="font-size:10px;color:#1565c0;font-weight:600;font-family:inherit">${folderFiles.length} file${folderFiles.length !== 1 ? 's' : ''}</span>`
                      card.appendChild(body)
                      const footer = document.createElement('span')
                      footer.style.cssText = 'display:block;height:36px;line-height:36px;padding:0 28px 0 8px;background:#f9f9f9;border-top:1px solid #b0bec5;font-size:10px;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:inherit;pointer-events:none'
                      footer.title = folderName; footer.textContent = folderName
                      card.appendChild(footer)
                      const removeBtn = document.createElement('span')
                      removeBtn.dataset.removeFile = '1'
                      removeBtn.style.cssText = 'position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.45);color:#fff;font-size:14px;line-height:18px;text-align:center;cursor:pointer;z-index:3;display:inline-block;user-select:none'
                      removeBtn.textContent = '×'
                      card.appendChild(removeBtn)
                      const progressTrack = document.createElement('div')
                      progressTrack.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:4px;background:rgba(0,0,0,0.08);z-index:5;overflow:hidden'
                      const progressFill = document.createElement('div')
                      progressFill.setAttribute('data-folder-progress', '1')
                      progressFill.style.cssText = 'height:100%;width:0%;background:#1a73e8;transition:width 0.15s ease'
                      progressTrack.appendChild(progressFill)
                      card.appendChild(progressTrack)

                      const currentSel = window.getSelection()
                      const selRange = currentSel && currentSel.rangeCount > 0 ? currentSel.getRangeAt(0) : null
                      const range = (selRange && editor.contains(selRange.startContainer))
                        ? selRange
                        : (() => { const r = document.createRange(); r.selectNodeContents(editor); r.collapse(false); return r })()
                      range.deleteContents(); range.insertNode(card)
                      range.setStartAfter(card); range.collapse(true)
                      currentSel?.removeAllRanges(); currentSel?.addRange(range)
                      savedRangeRef.current = range.cloneRange()
                      setInputValue(editor.innerHTML)
                      hasInteractedRef.current = true

                      setAttachedFiles(prev => [...prev, { name: folderName, size: folderFiles.reduce((s, f) => s + f.size, 0) }])
                      await new Promise(res => requestAnimationFrame(res))

                      let done = 0
                      const total = Math.max(folderFiles.length, 1)
                      const updateProgress = () => {
                        const fill = editor.querySelector(`[data-card-id="${cardId}"] [data-folder-progress]`) as HTMLElement | null
                        if (fill) { fill.style.width = Math.round((done / total) * 100) + '%'; setInputValue(editor.innerHTML) }
                      }
                      await Promise.all(folderFiles.map(file => {
                        const fd = new FormData(); fd.append('file', file); fd.append('thumbnail', '')
                        return fetch('http://localhost:5050/api/attachments/upload', { method: 'POST', body: fd })
                          .then(() => { done++; updateProgress() }).catch(() => { done++; updateProgress() })
                      }))
                      editor.querySelector(`[data-card-id="${cardId}"] [data-folder-progress]`)?.parentElement?.remove()
                      setInputValue(editor.innerHTML)
                    }} />
                  <input id="chatmail-file-input" type="file" multiple style={{ display: 'none' }} onChange={e => {
                    let files = Array.from(e.target.files || [])
                    if (!files.length) return

                    const MAX_SIZE = 50 * 1024 * 1024 // 50MB limit
                    const oversized = files.filter(f => f.size > MAX_SIZE)

                    if (oversized.length > 0) {
                      setValidationError(`The following files exceed the 50MB size limit: ${oversized.map(f => f.name).join(', ')}`)
                      files = files.filter(f => f.size <= MAX_SIZE) // Keep the valid ones
                      if (!files.length) {
                        e.target.value = ''
                        return
                      }
                    }

                    // Multiple files: if the cursor is at an existing attachment card, merge
                    // the new files into it; otherwise let them fall through to the per-file
                    // loop below so each gets its own individual card.
                    if (files.length > 1) {
                      const editor = editorRef.current
                      const existingCard = editor ? findCardAtInsertionPoint(getSafeAttachRange()) : null
                      if (editor && existingCard) {
                        const newFiles = files
                        e.target.value = ''
                        ;(async () => {
                          try {
                            let priorEntries: FolderEntry[] = []
                            if (existingCard.dataset.folderCard === '1') {
                              try { priorEntries = JSON.parse(existingCard.dataset.folderFiles || '[]') } catch {}
                            } else {
                              priorEntries = [{ type: 'file', name: decodeURIComponent(existingCard.dataset.attachment || 'File') }]
                            }
                            const newEntries: FolderEntry[] = newFiles.map(f => ({ type: 'file' as const, name: f.name }))
                            const merged = [...priorEntries, ...newEntries]
                            const bundleName = `${merged.length} Files`
                            const cardId = existingCard.dataset.cardId || (Date.now().toString(36) + Math.random().toString(36).slice(2))

                            existingCard.dataset.cardId = cardId
                            existingCard.dataset.folderCard = '1'
                            existingCard.dataset.attachment = encodeURIComponent(bundleName)
                            try { existingCard.dataset.folderFiles = JSON.stringify(merged) } catch {}
                            existingCard.style.cssText = 'position:relative;display:inline-block;width:150px;margin:4px;vertical-align:middle;border:1px solid #a5d6a7;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);cursor:pointer'
                            existingCard.innerHTML = ''

                            const body = document.createElement('span')
                            body.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:114px;background:#e8f5e9;gap:4px;pointer-events:none'
                            body.innerHTML = `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#43a047" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg><span style="font-size:10px;color:#2e7d32;font-weight:600;font-family:inherit">${merged.length} files</span>`
                            existingCard.appendChild(body)

                            const footer = document.createElement('span')
                            footer.style.cssText = 'display:block;height:36px;line-height:36px;padding:0 28px 0 8px;background:#f9f9f9;border-top:1px solid #a5d6a7;font-size:10px;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:inherit;pointer-events:none'
                            const footerText = `${merged[0].name} +${merged.length - 1} more`
                            footer.title = footerText; footer.textContent = footerText
                            existingCard.appendChild(footer)

                            const removeBtn = document.createElement('span')
                            removeBtn.dataset.removeFile = '1'
                            removeBtn.style.cssText = 'position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.45);color:#fff;font-size:14px;line-height:18px;text-align:center;cursor:pointer;z-index:3;display:inline-block;user-select:none'
                            removeBtn.textContent = '×'
                            existingCard.appendChild(removeBtn)

                            const progressTrack = document.createElement('div')
                            progressTrack.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:4px;background:rgba(0,0,0,0.08);z-index:5;overflow:hidden'
                            const progressFill = document.createElement('div')
                            progressFill.setAttribute('data-folder-progress', '1')
                            progressFill.style.cssText = 'height:100%;width:0%;background:#43a047;transition:width 0.15s ease'
                            progressTrack.appendChild(progressFill)
                            existingCard.appendChild(progressTrack)

                            setInputValue(editor.innerHTML)
                            hasInteractedRef.current = true
                            setAttachedFiles(prev => [...prev, ...newFiles.map(f => ({ name: f.name, size: f.size }))])
                            await new Promise(r => requestAnimationFrame(r))

                            let done = 0
                            const total = Math.max(newFiles.length, 1)
                            const updateProgress = () => {
                              const fill = editor.querySelector(`[data-card-id="${cardId}"] [data-folder-progress]`) as HTMLElement | null
                              if (fill) { fill.style.width = Math.round((done / total) * 100) + '%'; if (editorRef.current) setInputValue(editorRef.current.innerHTML) }
                            }
                            await Promise.all(newFiles.map(file => {
                              const fd = new FormData(); fd.append('file', file); fd.append('thumbnail', '')
                              return fetch('http://localhost:5050/api/attachments/upload', { method: 'POST', body: fd })
                                .then(() => { done++; updateProgress() }).catch(() => { done++; updateProgress() })
                            }))
                            editor.querySelector(`[data-card-id="${cardId}"] [data-folder-progress]`)?.parentElement?.remove()
                            if (editorRef.current) setInputValue(editorRef.current.innerHTML)
                          } catch (err) {
                            console.error('Merge into existing attachment card error:', err)
                          }
                        })()
                        return
                      }
                      // No existing card at the cursor: fall through to the per-file loop
                      // below so each newly attached file becomes its own individual card.
                    }

                    const insertIntoEditor = (src: string, fileName: string): string => {
                      const { borderColor } = getFileTypeInfo(fileName)
                      if (!editorRef.current) return ''
                      editorRef.current.focus()
                      const sel = window.getSelection()
                      // Always use the live ref so each card chains after the previous one
                      try { sel?.removeAllRanges(); sel?.addRange(getSafeAttachRange()) } catch (_) {}
                      // Build card DOM directly — execCommand('insertHTML') sanitizes & strips inner spans/styles
                      const cardId = Date.now().toString(36) + Math.random().toString(36).slice(2)
                      const card = document.createElement('span')
                      card.setAttribute('contenteditable', 'false')
                      card.dataset.fileCard = '1'
                      card.dataset.cardId = cardId
                      card.dataset.attachment = encodeURIComponent(fileName)
                      card.style.cssText = `position:relative;display:inline-block;width:150px;margin:4px;vertical-align:middle;border:1px solid ${borderColor};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);cursor:pointer`

                      const imgEl = document.createElement('img')
                      imgEl.src = src
                      imgEl.style.cssText = 'width:150px;height:114px;object-fit:cover;display:block;pointer-events:none'
                      card.appendChild(imgEl)

                      const footer = document.createElement('span')
                      footer.style.cssText = `display:block;height:36px;line-height:36px;padding:0 28px 0 8px;background:#f9f9f9;border-top:1px solid ${borderColor};font-size:10px;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:inherit;pointer-events:none`
                      footer.title = fileName
                      footer.textContent = fileName
                      card.appendChild(footer)

                      const removeBtn = document.createElement('span')
                      removeBtn.dataset.removeFile = '1'
                      removeBtn.style.cssText = 'position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.45);color:#fff;font-size:14px;line-height:18px;text-align:center;cursor:pointer;z-index:3;display:inline-block;user-select:none'
                      removeBtn.textContent = '×'
                      card.appendChild(removeBtn)

                      const range = sel!.getRangeAt(0)
                      range.deleteContents()
                      range.insertNode(card)
                      range.setStartAfter(card)
                      range.collapse(true)
                      sel!.removeAllRanges()
                      sel!.addRange(range)
                      // Advance the saved range so the next file inserts after this card
                      savedRangeRef.current = range.cloneRange()

                      setInputValue(editorRef.current.innerHTML)
                      hasInteractedRef.current = true
                      return cardId
                    }

                    const uploadFileToServer = (file: File, thumbDataUrl: string, cardId: string) => {
                      const formData = new FormData()
                      formData.append('file', file)
                      formData.append('thumbnail', thumbDataUrl)

                      const getCard = () => editorRef.current?.querySelector(`[data-card-id="${cardId}"]`) as HTMLElement | null

                      // Full-card semi-transparent overlay with centered % text + thin bar
                      const injectOverlay = () => {
                        const card = getCard()
                        if (!card || card.querySelector('[data-upload-overlay]')) return
                        card.style.position = 'relative'
                        const overlay = document.createElement('div')
                        overlay.setAttribute('data-upload-overlay', '1')
                        overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.52);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;z-index:5;border-radius:6px;pointer-events:none'
                        const pct = document.createElement('span')
                        pct.setAttribute('data-upload-pct', '1')
                        pct.style.cssText = 'color:#fff;font-size:15px;font-weight:700;font-family:-apple-system,sans-serif;letter-spacing:0.5px'
                        pct.textContent = '0%'
                        const track = document.createElement('div')
                        track.style.cssText = 'width:72%;height:3px;background:rgba(255,255,255,0.25);border-radius:2px;overflow:hidden'
                        const fill = document.createElement('div')
                        fill.setAttribute('data-upload-fill', '1')
                        fill.style.cssText = 'height:100%;width:0%;background:#fff;transition:width 0.15s ease'
                        track.appendChild(fill)
                        overlay.appendChild(pct)
                        overlay.appendChild(track)
                        card.appendChild(overlay)
                      }

                      const updateOverlay = (percent: number) => {
                        const card = getCard()
                        if (!card) return
                        const pct = card.querySelector('[data-upload-pct]') as HTMLElement | null
                        const fill = card.querySelector('[data-upload-fill]') as HTMLElement | null
                        if (pct) pct.textContent = percent + '%'
                        if (fill) fill.style.width = percent + '%'
                      }

                      const removeOverlay = () => getCard()?.querySelector('[data-upload-overlay]')?.remove()

                      const xhr = new XMLHttpRequest()
                      xhr.open('POST', 'http://localhost:5050/api/attachments/upload', true)

                      xhr.upload.onloadstart = () => injectOverlay()

                      xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) updateOverlay(Math.round((e.loaded / e.total) * 100))
                      }

                      xhr.onload = () => {
                        removeOverlay()
                        if (xhr.status >= 200 && xhr.status < 300) {
                          try {
                            const data: { thumbUrl?: string; url?: string } = JSON.parse(xhr.responseText)
                            if (data.thumbUrl && editorRef.current) {
                              const card = getCard()
                              if (card) {
                                const img = card.querySelector('img')
                                if (img) img.src = 'http://localhost:5050' + data.thumbUrl
                                card.setAttribute('data-file-url', 'http://localhost:5050' + (data.url || ''))
                                setInputValue(editorRef.current.innerHTML)
                              }
                            }
                          } catch {}
                        }
                      }

                      xhr.onerror = () => removeOverlay()

                      xhr.send(formData)
                    }

                    const W = 150, H = 114
                    const makeThumb = (draw: (ctx: CanvasRenderingContext2D) => void, jpeg = true, badge?: { label: string; color: string }): string => {
                      const c = document.createElement('canvas'); c.width = W; c.height = H
                      const ctx = c.getContext('2d')!
                      draw(ctx)
                      if (badge?.label) {
                        ctx.save()
                        ctx.font = 'bold 9px -apple-system,sans-serif'
                        const tw = ctx.measureText(badge.label).width
                        const bx = 5, by = 5, bw = tw + 10, bh = 15, r = 3
                        ctx.fillStyle = badge.color
                        ctx.beginPath()
                        ctx.moveTo(bx + r, by); ctx.lineTo(bx + bw - r, by); ctx.arcTo(bx + bw, by, bx + bw, by + r, r)
                        ctx.lineTo(bx + bw, by + bh - r); ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r)
                        ctx.lineTo(bx + r, by + bh); ctx.arcTo(bx, by + bh, bx, by + bh - r, r)
                        ctx.lineTo(bx, by + r); ctx.arcTo(bx, by, bx + r, by, r)
                        ctx.closePath(); ctx.fill()
                        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
                        ctx.fillText(badge.label, bx + 5, by + bh / 2 + 0.5)
                        ctx.restore()
                      }
                      return c.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.85)
                    }

                    files.forEach(file => {
                      const ext = (file.name.split('.').pop() || '').toLowerCase()
                      const { label, color, bg, borderColor } = getFileTypeInfo(file.name)
                      const badge = label ? { label, color } : undefined
                      const isImage = /\.(png|jpe?g|gif|webp|bmp|ico)$/i.test(file.name)
                      const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'].includes(ext)
                      const isAudio = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(ext)
                      const isPDF = ext === 'pdf'
                      const isText = ['txt', 'md', 'rtf', 'js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'json', 'xml', 'java', 'c', 'cpp', 'go', 'rb', 'php', 'swift', 'sh', 'yaml', 'yml', 'toml', 'csv'].includes(ext)

                      setAttachedFiles(prev => [...prev, { name: file.name, size: file.size }])

                      if (isImage) {
                        const url = URL.createObjectURL(file)
                        const img = new window.Image()
                        img.src = url
                        img.decode()
                          .then(() => {
                            const src = makeThumb(ctx => {
                              const scale = Math.max(W / img.width, H / img.height)
                              const sw = W / scale, sh = H / scale
                              ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H)
                            }, true, badge)
                            URL.revokeObjectURL(url)
                            const cid = insertIntoEditor(src, file.name)
                            if (cid) uploadFileToServer(file, src, cid)
                          })
                          .catch(() => { URL.revokeObjectURL(url); insertIntoEditor(generateFileSVGUrl(file.name), file.name) })

                      } else if (isVideo) {
                        const url = URL.createObjectURL(file)
                        const video = document.createElement('video')
                        video.muted = true; video.preload = 'metadata'; video.playsInline = true
                        video.onseeked = () => {
                          try {
                            const src = makeThumb(ctx => ctx.drawImage(video, 0, 0, W, H), true, badge)
                            URL.revokeObjectURL(url)
                            const cid = insertIntoEditor(src, file.name)
                            if (cid) uploadFileToServer(file, src, cid)
                          } catch { URL.revokeObjectURL(url); insertIntoEditor(generateFileSVGUrl(file.name), file.name) }
                        }
                        video.onloadedmetadata = () => { video.currentTime = Math.min(0.5, video.duration || 0) }
                        video.onerror = () => { URL.revokeObjectURL(url); insertIntoEditor(generateFileSVGUrl(file.name), file.name) }
                        video.src = url; video.load()

                      } else if (isAudio) {
                        const src = makeThumb(ctx => {
                          const grad = ctx.createLinearGradient(0, 0, 0, H)
                          grad.addColorStop(0, bg); grad.addColorStop(1, color + '55')
                          ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
                          ctx.fillStyle = color + 'bb'
                          for (let i = 0; i < 22; i++) {
                            const h = 10 + Math.abs(Math.sin(i * 1.1 + 0.4) * 20 + Math.cos(i * 0.7) * 12)
                            ctx.fillRect(7 + i * 6.5, H / 2 - h / 2, 4, h)
                          }
                          ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 22px sans-serif'
                          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♪', W / 2, H / 2)
                        }, false, badge)
                        const cidAudio = insertIntoEditor(src, file.name)
                        if (cidAudio) uploadFileToServer(file, src, cidAudio)

                      } else if (isPDF) {
                        const pdfUrl = URL.createObjectURL(file)
                        import('pdfjs-dist').then(async (pdfjsLib) => {
                          try {
                            pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href
                            const pdf = await pdfjsLib.getDocument({ url: pdfUrl, disableStream: true, disableAutoFetch: true }).promise
                            const page = await pdf.getPage(1)
                            const viewport = page.getViewport({ scale: 1 })
                            const scale = W / viewport.width
                            const scaledViewport = page.getViewport({ scale })
                            const offsetY = scaledViewport.height < H ? (H - scaledViewport.height) / 2 : 0
                            const c = document.createElement('canvas')
                            c.width = W; c.height = H
                            const pdfCtx = c.getContext('2d')!
                            pdfCtx.fillStyle = '#fff'; pdfCtx.fillRect(0, 0, W, H)
                            if (offsetY > 0) pdfCtx.translate(0, offsetY)
                            await page.render({ canvasContext: pdfCtx as unknown as Parameters<typeof page.render>[0]['canvasContext'], canvas: c as unknown as Parameters<typeof page.render>[0]['canvas'], viewport: scaledViewport }).promise
                            if (offsetY > 0) pdfCtx.setTransform(1, 0, 0, 1, 0, 0)
                            if (badge?.label) {
                              pdfCtx.save()
                              pdfCtx.font = 'bold 9px -apple-system,sans-serif'
                              const tw = pdfCtx.measureText(badge.label).width
                              const bx = 5, by = 5, bw = tw + 10, bh = 15, r = 3
                              pdfCtx.fillStyle = badge.color
                              pdfCtx.beginPath()
                              pdfCtx.moveTo(bx + r, by); pdfCtx.lineTo(bx + bw - r, by); pdfCtx.arcTo(bx + bw, by, bx + bw, by + r, r)
                              pdfCtx.lineTo(bx + bw, by + bh - r); pdfCtx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r)
                              pdfCtx.lineTo(bx + r, by + bh); pdfCtx.arcTo(bx, by + bh, bx, by + bh - r, r)
                              pdfCtx.lineTo(bx, by + r); pdfCtx.arcTo(bx, by, bx + r, by, r)
                              pdfCtx.closePath(); pdfCtx.fill()
                              pdfCtx.fillStyle = '#fff'; pdfCtx.textAlign = 'left'; pdfCtx.textBaseline = 'middle'
                              pdfCtx.fillText(badge.label, bx + 5, by + bh / 2 + 0.5)
                              pdfCtx.restore()
                            }
                            URL.revokeObjectURL(pdfUrl)
                            const thumbSrc = c.toDataURL('image/jpeg', 0.85)
                            const cidPdf = insertIntoEditor(thumbSrc, file.name)
                            if (cidPdf) uploadFileToServer(file, thumbSrc, cidPdf)
                          } catch {
                            URL.revokeObjectURL(pdfUrl)
                            insertIntoEditor(generateFileSVGUrl(file.name), file.name)
                          }
                        }).catch(() => {
                          URL.revokeObjectURL(pdfUrl)
                          insertIntoEditor(generateFileSVGUrl(file.name), file.name)
                        })

                      } else if (isText && file.size <= 256 * 1024) {
                        const reader = new FileReader()
                        reader.onload = () => {
                          const text = reader.result as string
                          const src = makeThumb(ctx => {
                            ctx.fillStyle = '#f8f9fa'; ctx.fillRect(0, 0, W, H)
                            ctx.fillStyle = '#263238'; ctx.font = '5.5px "Courier New", monospace'
                            text.split('\n').slice(0, 19).forEach((line, i) => {
                              if (line.trim()) ctx.fillText(line.slice(0, 34), 4, 9 + i * 6)
                            })
                          }, false, badge)
                          const cidTxt = insertIntoEditor(src, file.name)
                          if (cidTxt) uploadFileToServer(file, src, cidTxt)
                        }
                        reader.onerror = () => insertIntoEditor(generateFileSVGUrl(file.name), file.name)
                        reader.readAsText(file)

                      } else {
                        const isArchive = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)
                        const isWord = ['doc', 'docx'].includes(ext)
                        const isExcel = ['xls', 'xlsx', 'csv'].includes(ext)
                        const isPPT = ['ppt', 'pptx'].includes(ext)
                        const src = makeThumb(ctx => {
                          ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
                          if (isArchive) {
                            ctx.fillStyle = color + '22'; ctx.fillRect(22, 20, 106, 72); ctx.strokeStyle = borderColor; ctx.lineWidth = 1.5; ctx.strokeRect(22, 20, 106, 72)
                            ctx.fillStyle = color + '44'; ctx.fillRect(18, 13, 114, 12); ctx.strokeRect(18, 13, 114, 12)
                            ctx.strokeStyle = color + '88'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(65, 13); ctx.lineTo(65, 92); ctx.stroke()
                            ctx.fillStyle = color; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label || 'ZIP', W / 2, H / 2 + 8)
                          } else if (isWord) {
                            ctx.fillStyle = '#fff'; ctx.fillRect(20, 4, 88, 106); ctx.strokeStyle = borderColor; ctx.lineWidth = 1; ctx.strokeRect(20, 4, 88, 106)
                            ctx.fillStyle = '#1a73e8'; ctx.fillRect(20, 4, 88, 22)
                            ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('W', 64, 15)
                            ctx.fillStyle = '#bbdefb'; for (let i = 0; i < 9; i++) ctx.fillRect(28, 33 + i * 8, 30 + (i % 4) * 12, 4)
                          } else if (isExcel) {
                            ctx.fillStyle = '#fff'; ctx.fillRect(17, 4, 100, 106); ctx.strokeStyle = borderColor; ctx.lineWidth = 1; ctx.strokeRect(17, 4, 100, 106)
                            ctx.fillStyle = '#2e7d32'; ctx.fillRect(17, 4, 100, 20)
                            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('X', 67, 14)
                            ctx.strokeStyle = '#c8e6c9'; ctx.lineWidth = 0.5
                            for (let c = 0; c < 5; c++) { ctx.beginPath(); ctx.moveTo(17 + c * 25, 24); ctx.lineTo(17 + c * 25, 110); ctx.stroke() }
                            for (let r = 0; r < 9; r++) { ctx.beginPath(); ctx.moveTo(17, 24 + r * 10); ctx.lineTo(117, 24 + r * 10); ctx.stroke() }
                            ctx.fillStyle = color + '55'; for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) ctx.fillRect(18 + c * 25, 25 + r * 10, 23, 9)
                          } else if (isPPT) {
                            ctx.fillStyle = '#fff'; ctx.fillRect(14, 6, 108, 80); ctx.strokeStyle = borderColor; ctx.lineWidth = 1; ctx.strokeRect(14, 6, 108, 80)
                            ctx.fillStyle = '#e65100'; ctx.fillRect(14, 6, 108, 24)
                            ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Presentation', 20, 18)
                            ctx.fillStyle = borderColor; for (let i = 0; i < 4; i++) ctx.fillRect(22, 38 + i * 13, 50 + (i % 3) * 20, 6)
                          } else {
                            const fX = 30, fY = 7, fW = 76, fH = 90, fold = 20
                            ctx.fillStyle = '#fff'
                            ctx.beginPath(); ctx.moveTo(fX, fY); ctx.lineTo(fX + fW - fold, fY); ctx.lineTo(fX + fW, fY + fold); ctx.lineTo(fX + fW, fY + fH); ctx.lineTo(fX, fY + fH); ctx.closePath(); ctx.fill()
                            ctx.strokeStyle = borderColor; ctx.lineWidth = 1.5; ctx.stroke()
                            ctx.fillStyle = borderColor; ctx.beginPath(); ctx.moveTo(fX + fW - fold, fY); ctx.lineTo(fX + fW - fold, fY + fold); ctx.lineTo(fX + fW, fY + fold); ctx.closePath(); ctx.fill()
                          }
                        }, false, badge)
                        const cidGen = insertIntoEditor(src, file.name)
                        if (cidGen) uploadFileToServer(file, src, cidGen)
                      }
                    })
                    hasInteractedRef.current = true; e.target.value = ''
                  }} />
                  <input id="chatmail-image-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                    const file = e.target.files?.[0]; if (!file) return

                    if (file.size > 50 * 1024 * 1024) {
                      setValidationError(`The image "${file.name}" exceeds the 50MB size limit.`)
                      e.target.value = ''
                      return
                    }
                    const reader = new FileReader()
                    reader.onload = () => {
                      const imgTag = `<img src="${reader.result as string}" style="max-width:200px;border-radius:4px;display:block">`
                      if (editorRef.current) {
                        editorRef.current.focus();
                        document.execCommand('insertHTML', false, imgTag);
                        setInputValue(editorRef.current.innerHTML);
                        hasInteractedRef.current = true;
                      }
                    }
                    reader.readAsDataURL(file); e.target.value = ''
                  }} />
                </>}
                {formatTab === 'lists' && <>
                  <div style={{ display: 'flex', alignItems: 'stretch', padding: '4px 6px 2px', gap: '4px' }}>
                    {/* QUOTE/CODE group: HR (top-left), Quote (bottom-left), Inline code (top-right), Code block (bottom-right) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, auto)', gap: '2px', alignSelf: 'flex-start' }}>
                      <button title="Horizontal rule (divider)" onMouseDown={e => { e.preventDefault(); applyFormat('hr') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <svg width="30" height="18" viewBox="3 0 18 24" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <line x1="3" y1="12" x2="21" y2="12"/>
                          <line x1="3" y1="8" x2="9" y2="8"/><line x1="15" y1="8" x2="21" y2="8"/>
                          <line x1="3" y1="16" x2="9" y2="16"/><line x1="15" y1="16" x2="21" y2="16"/>
                          <line x1="3" y1="4" x2="21" y2="4"/>
                          <line x1="3" y1="20" x2="21" y2="20"/>
                        </svg>
                        <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.4 }}>Horizontal<br />Divider</span>
                      </button>
                      {(() => { const isActive = activeFormats.has('code'); return (
                      <button title="Inline code (Ctrl+Shift+E)" onMouseDown={e => { e.preventDefault(); applyFormat('code') }}
                        style={{ background: isActive ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', margin: '0', borderRadius: '4px', color: isActive ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: isActive ? 'inset 0 -2px 0 #1a73e8' : 'none' }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? '#e8f0fe' : 'transparent' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/>
                        </svg>
                        <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Code</span>
                      </button>
                      )})()}
                      {(() => { const isActive = activeFormats.has('quote'); return (
                      <button title="Quote" onMouseDown={e => { e.preventDefault(); applyFormat('quote') }}
                        style={{ background: isActive ? '#e8e8e8' : 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: isActive ? '#333' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: 'none' }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? '#e8e8e8' : 'transparent' }}>
                        <Quote size={24} strokeWidth={1} />
                        <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Quote</span>
                      </button>
                      )})()}
                      <button title="Code block" onMouseDown={e => { e.preventDefault(); applyFormat('codeblock') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="4" width="20" height="16" rx="3"/>
                          <polyline points="8,10 5,13 8,16"/><polyline points="16,10 19,13 16,16"/>
                        </svg>
                        <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Block</span>
                      </button>
                    </div>
                    {/* Column divider */}
                    <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {([
                          { fmt: 'ul', title: 'Bullet list', label: 'Bullet', svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="4" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="19" r="1.5" fill="currentColor" stroke="none"/><line x1="10" y1="5" x2="22" y2="5"/><line x1="10" y1="12" x2="22" y2="12"/><line x1="10" y1="19" x2="22" y2="19"/></svg> },
                          { fmt: 'ol', title: 'Numbered list', label: 'Number', svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><text x="1" y="5" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">1</text><text x="1" y="12" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">2</text><text x="1" y="19" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">3</text><line x1="10" y1="5" x2="22" y2="5"/><line x1="10" y1="12" x2="22" y2="12"/><line x1="10" y1="19" x2="22" y2="19"/></svg> },
                          { fmt: 'star-list', title: 'Star list', label: 'Star', svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><text x="0" y="8" fontSize="14" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">*</text><text x="0" y="15" fontSize="14" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">*</text><text x="0" y="22" fontSize="14" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">*</text><line x1="10" y1="5" x2="22" y2="5"/><line x1="10" y1="12" x2="22" y2="12"/><line x1="10" y1="19" x2="22" y2="19"/></svg> },
                          { fmt: 'dash-list', title: 'Dash list', label: 'Dash', svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="5" x2="7" y2="5" /><line x1="3" y1="12" x2="7" y2="12" /><line x1="3" y1="19" x2="7" y2="19" /><line x1="10" y1="5" x2="22" y2="5" /><line x1="10" y1="12" x2="22" y2="12" /><line x1="10" y1="19" x2="22" y2="19" /></svg> },
                          { fmt: 'arrow-list', title: 'Arrow list', label: 'Arrow', svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><text x="1" y="5" fontSize="10" fontWeight="lighter" fill="currentColor" stroke="none" dominantBaseline="central">→</text><text x="1" y="12" fontSize="10" fontWeight="lighter" fill="currentColor" stroke="none" dominantBaseline="central">→</text><text x="1" y="19" fontSize="10" fontWeight="lighter" fill="currentColor" stroke="none" dominantBaseline="central">→</text><line x1="10" y1="5" x2="22" y2="5" /><line x1="10" y1="12" x2="22" y2="12" /><line x1="10" y1="19" x2="22" y2="19" /></svg> },
                          { fmt: 'lower-list', title: 'Lowercase letter list (a. b. c.)', label: 'Lower', svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><text x="0" y="5" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">a</text><text x="0" y="12" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">b</text><text x="0" y="19" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">c</text><line x1="10" y1="5" x2="22" y2="5"/><line x1="10" y1="12" x2="22" y2="12"/><line x1="10" y1="19" x2="22" y2="19"/></svg> },
                          { fmt: 'roman-list', title: 'Roman numeral list (I. II. III.)', label: 'Roman', svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><text x="0" y="5" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">I</text><text x="0" y="12" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">II</text><text x="0" y="19" fontSize="7" fontWeight="bold" fill="currentColor" stroke="none" dominantBaseline="central">III</text><line x1="8.5" y1="5" x2="22" y2="5"/><line x1="8.5" y1="12" x2="22" y2="12"/><line x1="8.5" y1="19" x2="22" y2="19"/></svg> },
                          { fmt: 'outdent', title: 'Decrease indent', label: 'Outdent', svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="4" x2="21" y2="4"/><line x1="9" y1="12" x2="3" y2="12"/><polyline points="7,8 3,12 7,16"/><line x1="11" y1="8" x2="21" y2="8"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="11" y1="16" x2="21" y2="16"/><line x1="3" y1="20" x2="21" y2="20"/></svg> },
                          { fmt: 'indent', title: 'Increase indent', label: 'Indent', svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="4" x2="21" y2="4"/><line x1="2" y1="12" x2="8" y2="12"/><polyline points="4,8 8,12 4,16"/><line x1="11" y1="8" x2="21" y2="8"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="11" y1="16" x2="21" y2="16"/><line x1="3" y1="20" x2="21" y2="20"/></svg> },
                        ]).map(({ fmt, title, label, svg }) => {
                          const isActive = activeFormats.has(fmt)
                          return (
                          <button key={fmt} title={title} onMouseDown={e => { e.preventDefault(); applyFormat(fmt) }}
                            style={{ background: isActive ? '#e8e8e8' : 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: isActive ? '#333' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: 'none' }}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? '#e8e8e8' : 'transparent' }}>
                            {svg}
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
                          </button>
                          )
                        })}
                        <button title="Clear formatting" onMouseDown={e => { e.preventDefault(); applyFormat('clear') }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                            <text x="2" y="17" fontSize="15" fontWeight="bold" fontFamily="serif" fill="currentColor" stroke="none">A</text>
                            <line x1="3" y1="21" x2="21" y2="21"/>
                            <line x1="17" y1="3" x2="23" y2="21"/>
                          </svg>
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Clear</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>}
                {formatTab === 'insert' && <>
                  <div style={{ display: 'flex', alignItems: 'stretch', padding: '4px 6px 2px', gap: '4px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px' }}>
                      {/* Row 1: Link, Attach, Picture */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button data-toolbar-menu-toggle title="Insert link (Ctrl+K)" onMouseDown={openLinkPopover}
                          style={{ background: linkPopoverOpen ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: linkPopoverOpen ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                          onMouseEnter={e => { if (!linkPopoverOpen) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = linkPopoverOpen ? '#e8f0fe' : 'transparent' }}>
                          <Link size={22} strokeWidth={1} />
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Link</span>
                        </button>
                        <div style={{ position: 'relative' }}>
                          <button title="Attach files" onMouseDown={e => {
                              e.preventDefault(); saveEditorSelection()
                              if (showAttachMenu) { setShowAttachMenu(false); return }
                              const rect = e.currentTarget.getBoundingClientRect()
                              setAttachMenuAnchor({ x: rect.left, y: rect.top })
                              setShowAttachMenu(true)
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                            <Paperclip size={22} strokeWidth={1} />
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Attach</span>
                          </button>
                          {showAttachMenu && attachMenuAnchor && (<>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onMouseDown={() => setShowAttachMenu(false)} />
                            <div style={{ position: 'fixed', bottom: window.innerHeight - attachMenuAnchor.y + 6, left: attachMenuAnchor.x, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 4px 18px rgba(0,0,0,0.18)', zIndex: 9999, minWidth: '130px', overflow: 'hidden', padding: '4px 0' }}>
                              <div style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '13px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                onMouseDown={e => {
                                  e.preventDefault(); setShowAttachMenu(false)
                                  const input = document.getElementById('chatmail-file-input') as HTMLInputElement
                                  if (input) { input.accept = ''; input.multiple = true; input.click() }
                                }}>
                                <FileText size={14} strokeWidth={1.5} /> Files
                              </div>
                              <div style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '13px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                onMouseDown={e => {
                                  e.preventDefault(); setShowAttachMenu(false)
                                  const input = document.getElementById('chatmail-folder-input') as HTMLInputElement
                                  if (input) input.click()
                                }}>
                                <Folder size={14} strokeWidth={1.5} /> Folder
                              </div>
                            </div>
                          </>)}
                        </div>
                        <button title="Insert picture" onMouseDown={e => { e.preventDefault(); document.getElementById('chatmail-image-input')?.click() }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                          <Image size={22} strokeWidth={1} />
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Picture</span>
                        </button>
                      </div>
                      {/* Row 2: Emoji, Signature, Table */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ position: 'relative' }}>
                          <button title="Emoji" onMouseDown={e => { e.preventDefault(); setEmojiPickerOpen(o => !o) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                            <Smile size={22} strokeWidth={1} />
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Emoji</span>
                          </button>
                          {emojiPickerOpen && (
                            <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 300, background: '#fff', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 -4px 16px rgba(0,0,0,0.15)', padding: '8px', marginBottom: '4px', width: '220px' }}>
                              <div style={{ fontSize: '10px', fontWeight: 600, color: '#aaa', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: '6px' }}>Emoji</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                {['😊','😂','❤️','👍','🎉','😍','😢','😎','🤔','👋','🙏','😁','😅','🤣','😘','😭','🔥','✨','💯','🎊','👀','🚀','💪','🤝','😴','😡','🤯','😇','🥳','😏','🤩','😬','😜','🥺','😞','💀','🤦','🤷','🙄','😤','📝','📌','📎','📚','💡','🎯','✅','❌','⚡','💬','🎵','🌟','🌈','🍕','☕','🌸','🐶','🐱','🦋','🌍'].map(em => (
                                  <button key={em} onMouseDown={e => {
                                    e.preventDefault()
                                    if (!editorRef.current) return
                                    editorRef.current.focus()
                                    document.execCommand('insertText', false, em)
                                    setInputValue(editorRef.current.innerHTML)
                                    hasInteractedRef.current = true
                                    setEmojiPickerOpen(false)
                                  }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '2px', borderRadius: '4px', lineHeight: 1 }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                    {em}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <button data-toolbar-menu-toggle title="Signature" onMouseDown={openSignaturePopover}
                          style={{ background: signaturePopoverOpen ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0 4px', margin: '0', borderRadius: '4px', color: signaturePopoverOpen ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                          onMouseEnter={e => { if (!signaturePopoverOpen) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = signaturePopoverOpen ? '#e8f0fe' : 'transparent' }}>
                          <PenLine size={22} strokeWidth={1} />
                          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Signature</span>
                        </button>
                        <div style={{ position: 'relative' }}>
                          <button data-toolbar-menu-toggle onMouseDown={e => toggleToolbarMenu(tableOpen, setTableOpen, e)}
                            title="Insert table"
                            style={{ background: tableOpen ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0 1px', borderRadius: '4px', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                            onMouseEnter={e => { if (!tableOpen) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = tableOpen ? '#e8f0fe' : 'transparent' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Table2 size={22} strokeWidth={1} />
                              <ChevronDown size={11} color="#888" />
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Table</span>
                          </button>
                          {tableOpen && createPortal(
                            <div data-toolbar-menu style={{ position: 'fixed', bottom: toolbarMenuPos.bottom, left: toolbarMenuPos.left, zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.12)', padding: '8px' }}>
                              <div style={{ fontSize: '10px', color: '#888', marginBottom: '6px', textAlign: 'center' }}>
                                {tableHover[0] > 0 ? `${tableHover[1]} × ${tableHover[0]}` : 'Insert Table'}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 16px)', gap: '4px' }}>
                                {Array.from({ length: 5 }, (_, r) =>
                                  Array.from({ length: 6 }, (_, c) => (
                                    <div key={`${r}-${c}`}
                                      onMouseEnter={() => setTableHover([r + 1, c + 1])}
                                      onMouseLeave={() => setTableHover([0, 0])}
                                      onMouseDown={e => { e.preventDefault(); insertTable(r + 1, c + 1) }}
                                      style={{ width: '16px', height: '16px', border: '1px solid', borderColor: r < tableHover[0] && c < tableHover[1] ? '#1a73e8' : '#ddd', borderRadius: '2px', cursor: 'pointer', background: r < tableHover[0] && c < tableHover[1] ? '#e8f0fe' : '#fff' }}
                                    />
                                  ))
                                )}
                              </div>
                            </div>,
                            document.body
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>}
                {formatTab === 'draw' && <>
                  {/* Tool groups row with left/right scroll toggles */}
                  <div style={{ display: 'flex', alignItems: 'stretch', flex: 1 }}>
                    {drawToolbarOverflow.left && (
                      <button onMouseDown={e => { e.preventDefault(); document.getElementById('draw-toolbar-scroll')?.scrollBy({ left: -160, behavior: 'smooth' }) }}
                        style={{ flexShrink: 0, background: '#e8f0fe', border: 'none', borderRight: '1px solid #e8e8e8', cursor: 'pointer', padding: '0', color: '#1a73e8', display: 'flex', alignItems: 'center', alignSelf: 'stretch' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#1a73e8'; e.currentTarget.style.backgroundColor = '#d2e3fc' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#1a73e8'; e.currentTarget.style.backgroundColor = '#e8f0fe' }}>
                        <ChevronLeft size={20} />
                      </button>
                    )}
                  <div id="draw-toolbar-scroll" style={{ display: 'flex', alignItems: 'stretch', padding: '4px 6px 2px', gap: '4px', overflowX: 'auto', flex: 1, scrollbarWidth: 'none' }}>
                    {/* CANVAS Board button */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px' }}>
                      <button
                        onMouseDown={e => { e.preventDefault(); openCanvasMode(inputValue) }}
                        title="Add Canvas Board to field"
                        style={{ background: canvasMode ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: canvasMode ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', height: '70px' }}
                        onMouseEnter={e => { if (!canvasMode) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                        onMouseLeave={e => { if (!canvasMode) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <svg width="55" height="55" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 14l3-3 2 2 3-4 2 3"/>
                        </svg>
                        <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Canvas</span>
                      </button>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Board</span>
                    </div>
                    {/* Column divider */}
                    <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                    {/* SELECTION group */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px', opacity: canvasMode ? 1 : 0.4, pointerEvents: canvasMode ? 'auto' : 'none' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {([
                            { key: 'select', icon: <MousePointer2 size={30} strokeWidth={1} />, label: 'Select' },
                            { key: 'lasso',  icon: <Lasso size={30} strokeWidth={1} />,         label: 'Lasso'  },
                          ]).map(({ key, icon, label }) => (
                            <button key={key} title={label} onMouseDown={e => { e.preventDefault(); setDrawTool(key); if (toolColors[key]) setDrawColor(toolColors[key]) }}
                              style={{ background: drawTool === key ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: drawTool === key ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                              onMouseEnter={e => { if (drawTool !== key) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                              onMouseLeave={e => { if (drawTool !== key) e.currentTarget.style.backgroundColor = 'transparent' }}>
                              {icon}
                              <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>{label}</span>
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button title="Pan" onMouseDown={e => { e.preventDefault(); setDrawTool('hand'); if (toolColors['hand']) setDrawColor(toolColors['hand']) }}
                            style={{ background: drawTool === 'hand' ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: drawTool === 'hand' ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                            onMouseEnter={e => { if (drawTool !== 'hand') e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { if (drawTool !== 'hand') e.currentTarget.style.backgroundColor = 'transparent' }}>
                            <Hand size={30} strokeWidth={1} />
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Pan</span>
                          </button>
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Selection</span>
                    </div>
                    {/* Column divider */}
                    <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                    {/* PENS group */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px', opacity: canvasMode ? 1 : 0.4, pointerEvents: canvasMode ? 'auto' : 'none' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gridTemplateRows: 'auto auto', columnGap: '4px', rowGap: '8px', alignItems: 'start' }}>
                        {([
                          { key: 'pen',        label: 'Pen',       icon: <svg width="24" height="18" viewBox="0 0 12 18" preserveAspectRatio="none"><polygon points="5.3,1.8 6.7,1.8 6,0" fill="#444"/><polygon points="2.5,5 9.5,5 6,0" fill="#e0c88a"/><rect x="2.5" y="5" width="7" height="9" fill={toolColors['pen'] || '#000000'}/><rect x="2.5" y="14" width="7" height="1.5" fill="#bbb"/><rect x="2.5" y="15.5" width="7" height="2.5" rx="1" fill="#f0b8b8"/></svg> },
                          { key: 'effect-pen', label: 'Effect',    icon: <svg width="24" height="18" viewBox="0 0 12 18" preserveAspectRatio="none"><polygon points="5.3,1.8 6.7,1.8 6,0" fill="#444"/><polygon points="2.5,5 9.5,5 6,0" fill="#e0c88a"/><rect x="2.5" y="5" width="7" height="9" fill={toolColors['effect-pen'] || '#7c4dff'}/><rect x="2.5" y="14" width="7" height="1.5" fill="#bbb"/><rect x="2.5" y="15.5" width="7" height="2.5" rx="1" fill="#f0b8b8"/></svg> },
                          { key: 'highlight',  label: 'Highlight', icon: <Highlighter width={24} height={18} preserveAspectRatio="none" strokeWidth={1} color="#444" fill={toolColors['highlight'] || '#ffe066'} style={{ transform: 'rotate(135deg)' }} /> },
                          { key: 'text',       label: 'Text',      icon: <svg width="24" height="18" viewBox="0 0 24 24" preserveAspectRatio="none" fill="none"><text x="4" y="18" fontSize="16" fontWeight="700" fill="currentColor" fontFamily="serif">T</text><line x1="4" y1="21" x2="20" y2="21" stroke="currentColor" strokeWidth="1.2"/></svg> },
                          { key: 'eraser',     label: 'Erase',     icon: <Eraser width={24} height={18} preserveAspectRatio="none" strokeWidth={1} /> },
                        ]).map(({ key, label, icon }) => {
                          const gridPos: Record<string, { gridColumn: number; gridRow: number }> = {
                            'pen':        { gridColumn: 1, gridRow: 1 },
                            'effect-pen': { gridColumn: 2, gridRow: 1 },
                            'highlight':  { gridColumn: 3, gridRow: 1 },
                            'text':       { gridColumn: 2, gridRow: 2 },
                            'eraser':     { gridColumn: 3, gridRow: 2 },
                          }
                          return (
                          <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', position: 'relative', ...gridPos[key] }}>
                            <button title={label} onMouseDown={e => { e.preventDefault(); setDrawTool(key); if (toolColors[key]) setDrawColor(toolColors[key]) }}
                              style={{ background: (drawTool === key || openPenDropdown === key) ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: (drawTool === key || openPenDropdown === key) ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                              onMouseEnter={e => { if (drawTool !== key && openPenDropdown !== key) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = (drawTool === key || openPenDropdown === key) ? '#e8f0fe' : 'transparent' }}>
                              {icon}
                              <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>{label}</span>
                            </button>
                            {key !== 'eraser' && <button data-pen-toggle onMouseDown={e => { e.preventDefault(); if (openPenDropdown !== key) { const r = (e.currentTarget.parentElement || e.currentTarget).getBoundingClientRect(); setPenDropdownPos({ top: r.top - 4, left: r.left + r.width / 2 }); penDropdownSnapshotRef.current = { tk: key, color: toolColors[key] || drawColor, toolColor: toolColors[key], highlight: toolHighlightColors[key] } } setOpenPenDropdown(openPenDropdown === key ? null : key) }}
                              style={{ padding: '0 10px', border: '1px solid #e0e0e0', borderRadius: '3px', background: openPenDropdown === key ? '#e8f0fe' : '#f8f8f8', cursor: 'pointer', fontSize: '16px', color: '#888', lineHeight: 1, height: '10px', display: 'flex', alignItems: 'center' }}>▾</button>}
                            {key !== 'eraser' && openPenDropdown === key && penDropdownPos && (
                              <div data-pen-dropdown style={{ position: 'fixed', top: penDropdownPos.top, left: penDropdownPos.left, transform: 'translateX(-50%) translateY(-100%)', zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                  {/* Left: swatches + selected color */}
                                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontSize: '13px', fontWeight: 600, color: (toolHighlightColors[key] && toolHighlightColors[key] !== 'transparent') ? toolHighlightColors[key] : '#555' }}>{label}</span>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 30px)', gap: '8px' }}>
                                        {PEN_HIGHLIGHT_COLORS.map(c => {
                                          const tk = openPenDropdown ? (openPenDropdown.startsWith('shape-') ? openPenDropdown.slice(6) : openPenDropdown) : ''
                                          const active = (toolHighlightColors[tk] || 'transparent') === c
                                          return (
                                            <button key={c} onMouseDown={e => { e.preventDefault(); if (tk === 'highlight') { setToolHighlightColors(prev => ({ ...prev, [tk]: c })) } else if (tk) { setToolColors(prev => ({ ...prev, [tk]: c })) } setDrawColor(c); if (tk) setDrawTool(tk); setOpenPenDropdown(null) }}
                                              style={{ width: '30px', height: '30px', borderRadius: '50%', background: c === 'transparent' ? 'linear-gradient(to bottom right, #fff 45%, #f00 45%, #f00 55%, #fff 55%)' : c, border: active ? '3px solid #1a73e8' : '2px solid rgba(0,0,0,0.08)', cursor: 'pointer', outline: 'none' }} />
                                          )
                                        })}
                                      </div>
                                    </div>
                                    <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(4, 30px)', gap: '8px' }}>
                                      {[...PEN_MAIN_COLORS, ...customDrawColors].map(c => (
                                        <button key={c} onMouseDown={e => { e.preventDefault(); if (openPenDropdown) { const tk = openPenDropdown.startsWith('shape-') ? openPenDropdown.slice(6) : openPenDropdown; setToolColors(prev => ({ ...prev, [tk]: c })); setDrawTool(openPenDropdown.startsWith('shape-') ? openPenDropdown.slice(6) : openPenDropdown) } setDrawColor(c); setOpenPenDropdown(null) }}
                                          style={{ width: '30px', height: '30px', borderRadius: '50%', background: c, border: drawColor === c ? '3px solid #1a73e8' : '2px solid rgba(0,0,0,0.08)', cursor: 'pointer', outline: 'none' }} />
                                      ))}
                                    </div>
                                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Selected color</span>
                                      <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #c0c0c0', borderRadius: '6px', overflow: 'hidden', width: 'fit-content' }}>
                                        <div style={{ width: '50px', height: '56px', background: drawColor, flexShrink: 0 }} />
                                        <input type="text" value={drawColor} maxLength={7}
                                          onChange={e => { if (/^#[0-9a-f]{0,6}$/i.test(e.target.value)) { const c = e.target.value; setDrawColor(c); if (openPenDropdown) { const tk = openPenDropdown.startsWith('shape-') ? openPenDropdown.slice(6) : openPenDropdown; setToolColors(prev => ({ ...prev, [tk]: c })); setDrawTool(openPenDropdown.startsWith('shape-') ? openPenDropdown.slice(6) : openPenDropdown) } } }}
                                          onMouseDown={e => e.stopPropagation()}
                                          placeholder="#607d8b"
                                          style={{ padding: '18px 10px', backgroundColor: 'white', border: 'none', fontSize: '14px', fontFamily: 'monospace', outline: 'none', width: '110px' }} />
                                      </div>
                                    </div>
                                  </div>
                                  {/* Right: ColorPicker */}
                                  <ColorPicker value={drawColor} onChange={setDrawColor} showHex={false} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                                  <button onMouseDown={e => { e.preventDefault(); const snap = penDropdownSnapshotRef.current; if (snap) { setDrawColor(snap.color); if (snap.toolColor !== undefined) setToolColors(prev => ({ ...prev, [snap.tk]: snap.toolColor as string })); if (snap.highlight !== undefined) setToolHighlightColors(prev => ({ ...prev, [snap.tk]: snap.highlight as string })) } setOpenPenDropdown(null) }}
                                    style={{ padding: '6px 16px', border: '1px solid #ddd', borderRadius: '16px', background: '#fff', color: '#555', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                                  <button onMouseDown={e => { e.preventDefault(); setOpenPenDropdown(null) }}
                                    style={{ padding: '6px 16px', border: 'none', borderRadius: '16px', background: '#1a73e8', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Save</button>
                                </div>
                              </div>
                            )}
                          </div>
                          )
                        })}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Drawing</span>
                    </div>
                    {/* Size divider between Drawing and Shapes */}
                    <div data-text-size-control style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', margin: '0 4px', opacity: canvasMode ? 1 : 0.4, pointerEvents: canvasMode ? 'auto' : 'none' }}>
                      {drawTool === 'text' ? (
                        <>
                          <input type="range" min={8} max={72} value={drawFontSize} disabled={!SIZABLE_DRAW_TOOLS.has(drawTool)} onChange={e => setDrawFontSize(Number(e.target.value))} style={{ width: '60px', cursor: SIZABLE_DRAW_TOOLS.has(drawTool) ? 'pointer' : 'not-allowed', opacity: SIZABLE_DRAW_TOOLS.has(drawTool) ? 1 : 0.4 }} />
                          <input type="number" min={8} max={72} value={drawFontSize} disabled={!SIZABLE_DRAW_TOOLS.has(drawTool)} onChange={e => setDrawFontSize(Math.max(8, Math.min(72, Number(e.target.value))))} onMouseDown={e => e.stopPropagation()} style={{ width: '44px', height: '22px', fontSize: '14px', fontWeight: 600, color: '#555', textAlign: 'center', border: '1px solid #ddd', borderRadius: '3px', padding: '0 2px', outline: 'none', cursor: SIZABLE_DRAW_TOOLS.has(drawTool) ? 'text' : 'not-allowed', opacity: SIZABLE_DRAW_TOOLS.has(drawTool) ? 1 : 0.4 }} />
                        </>
                      ) : (
                        <>
                          <input type="range" min={1} max={20} value={drawLineWidth} disabled={!SIZABLE_DRAW_TOOLS.has(drawTool)} onChange={e => setDrawLineWidth(Number(e.target.value))} style={{ width: '60px', cursor: SIZABLE_DRAW_TOOLS.has(drawTool) ? 'pointer' : 'not-allowed', opacity: SIZABLE_DRAW_TOOLS.has(drawTool) ? 1 : 0.4 }} />
                          <input type="number" min={1} max={20} value={drawLineWidth} disabled={!SIZABLE_DRAW_TOOLS.has(drawTool)} onChange={e => setDrawLineWidth(Math.max(1, Math.min(20, Number(e.target.value))))} onMouseDown={e => e.stopPropagation()} style={{ width: '44px', height: '22px', fontSize: '14px', fontWeight: 600, color: '#555', textAlign: 'center', border: '1px solid #ddd', borderRadius: '3px', padding: '0 2px', outline: 'none', cursor: SIZABLE_DRAW_TOOLS.has(drawTool) ? 'text' : 'not-allowed', opacity: SIZABLE_DRAW_TOOLS.has(drawTool) ? 1 : 0.4 }} />
                        </>
                      )}
                      <span style={{ fontSize: '9px', fontWeight: 600, color: '#555', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Size</span>
                      <div style={{ width: '1px', flex: 1, minHeight: '6px', background: '#e0e0e0' }} />
                    </div>
                    {/* DRAWING group */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px', opacity: canvasMode ? 1 : 0.4, pointerEvents: canvasMode ? 'auto' : 'none' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gridTemplateRows: 'auto auto', columnGap: '4px', rowGap: '8px', alignItems: 'start' }}>
                        {([
                          { key: 'line',     icon: <Minus    width={24} height={18} preserveAspectRatio="none" strokeWidth={1} />, label: 'Line'    },
                          { key: 'rect',     icon: <Square   width={24} height={18} preserveAspectRatio="none" strokeWidth={1} />, label: 'Rectangle' },
                          { key: 'circle',   icon: <Circle   size={18} strokeWidth={1} />, label: 'Circle'  },
                          { key: 'triangle', icon: <Triangle width={24} height={18} preserveAspectRatio="none" strokeWidth={1} />, label: 'Triangle'},
                          { key: 'diamond',  icon: <Diamond  width={24} height={18} preserveAspectRatio="none" strokeWidth={1} />, label: 'Diamond' },
                          { key: 'star',     icon: <Star     width={24} height={18} preserveAspectRatio="none" strokeWidth={1} />, label: 'Star'    },
                        ]).map(({ key, icon, label }) => {
                          const dkey = `shape-${key}`
                          const gridPos: Record<string, { gridColumn: number; gridRow: number }> = {
                            'line': { gridColumn: 1, gridRow: 1 }, 'rect': { gridColumn: 2, gridRow: 1 }, 'circle': { gridColumn: 3, gridRow: 1 },
                            'triangle': { gridColumn: 1, gridRow: 2 }, 'diamond': { gridColumn: 2, gridRow: 2 }, 'star': { gridColumn: 3, gridRow: 2 },
                          }
                          return (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', position: 'relative', ...gridPos[key] }}>
                              <button title={label} onMouseDown={e => { e.preventDefault(); setDrawTool(key); if (toolColors[key]) setDrawColor(toolColors[key]) }}
                                style={{ background: (drawTool === key || openPenDropdown === dkey) ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: (drawTool === key || openPenDropdown === dkey) ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                                onMouseEnter={e => { if (drawTool !== key && openPenDropdown !== dkey) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = (drawTool === key || openPenDropdown === dkey) ? '#e8f0fe' : 'transparent' }}>
                                {icon}
                                <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', color: (drawTool === key || openPenDropdown === dkey) ? '#1a73e8' : (toolColors[key] || '#555') }}>{label}</span>
                              </button>
                              <button data-pen-toggle onMouseDown={e => { e.preventDefault(); if (openPenDropdown !== dkey) { const r = (e.currentTarget.parentElement || e.currentTarget).getBoundingClientRect(); setPenDropdownPos({ top: r.top - 4, left: r.left + r.width / 2 }); const tk = dkey.slice(6); penDropdownSnapshotRef.current = { tk, color: toolColors[tk] || drawColor, toolColor: toolColors[tk], highlight: toolHighlightColors[tk] } } setOpenPenDropdown(openPenDropdown === dkey ? null : dkey) }}
                                style={{ padding: '0 10px', border: '1px solid #e0e0e0', borderRadius: '3px', background: openPenDropdown === dkey ? '#e8f0fe' : '#f8f8f8', cursor: 'pointer', fontSize: '16px', color: '#888', lineHeight: 1, height: '10px', display: 'flex', alignItems: 'center' }}>▾</button>
                              {openPenDropdown === dkey && penDropdownPos && (
                                <div data-pen-dropdown style={{ position: 'fixed', top: penDropdownPos.top, left: penDropdownPos.left, transform: 'translateX(-50%) translateY(-100%)', zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 0 8px', marginBottom: '10px', borderBottom: '1px solid #f0f0f0', fontSize: '12px', fontWeight: 600, color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                    <span style={{ display: 'flex', alignItems: 'center' }}>{cloneElement(icon, { size: 14 })}</span>
                                    {label} Color
                                  </div>
                                  {dkey.startsWith('shape-') && (
                                    <div style={{ position: 'relative', marginBottom: '10px' }}>
                                      <button onMouseDown={e => { e.preventDefault(); setShapeColorModeOpen(v => !v) }}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '6px', background: '#fafafa', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#333' }}>
                                        {shapeColorMode === 'highlight' ? <Highlighter size={14} /> : <Pencil size={14} />}
                                        <span style={{ flex: 1, textAlign: 'left', textTransform: 'capitalize' }}>{shapeColorMode}</span>
                                        <ChevronDown size={12} color="#888" />
                                      </button>
                                      {shapeColorModeOpen && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '2px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1, overflow: 'hidden' }}>
                                          {(['regular', 'highlight'] as const).map(m => (
                                            <button key={m} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setShapeColorMode(m); setShapeColorModeOpen(false) }}
                                              style={{ width: '100%', padding: '7px 10px', border: 'none', background: shapeColorMode === m ? '#e8f0fe' : 'transparent', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 500, color: shapeColorMode === m ? '#1a73e8' : '#333', textTransform: 'capitalize' }}
                                              onMouseEnter={e => { if (shapeColorMode !== m) e.currentTarget.style.background = '#f5f5f5' }}
                                              onMouseLeave={e => { if (shapeColorMode !== m) e.currentTarget.style.background = 'transparent' }}>
                                              {m === 'highlight' ? <Highlighter size={14} /> : <Pencil size={14} />}
                                              {m}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 30px)', gap: '8px' }}>
                                          {PEN_HIGHLIGHT_COLORS.map(c => {
                                            const tk = openPenDropdown ? (openPenDropdown.startsWith('shape-') ? openPenDropdown.slice(6) : openPenDropdown) : ''
                                            const useHighlight = dkey.startsWith('shape-') ? shapeColorMode === 'highlight' : tk === 'highlight'
                                            const active = (toolHighlightColors[tk] || 'transparent') === c
                                            return (
                                              <button key={c} onMouseDown={e => { e.preventDefault(); if (useHighlight) { setToolHighlightColors(prev => ({ ...prev, [tk]: c })) } else if (tk) { setToolColors(prev => ({ ...prev, [tk]: c })); if (dkey.startsWith('shape-')) setToolHighlightColors(prev => ({ ...prev, [tk]: 'transparent' })) } setDrawColor(c); if (tk) setDrawTool(tk); setOpenPenDropdown(null) }}
                                                style={{ width: '30px', height: '30px', borderRadius: '50%', background: c === 'transparent' ? 'linear-gradient(to bottom right, #fff 45%, #f00 45%, #f00 55%, #fff 55%)' : c, border: active ? '3px solid #1a73e8' : '2px solid rgba(0,0,0,0.08)', cursor: 'pointer', outline: 'none' }} />
                                            )
                                          })}
                                        </div>
                                      </div>
                                      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(4, 30px)', gap: '8px' }}>
                                        {[...PEN_MAIN_COLORS, ...customDrawColors].map(c => (
                                          <button key={c} onMouseDown={e => { e.preventDefault(); if (openPenDropdown) { const tk = openPenDropdown.startsWith('shape-') ? openPenDropdown.slice(6) : openPenDropdown; if (dkey.startsWith('shape-') && shapeColorMode === 'highlight') { setToolHighlightColors(prev => ({ ...prev, [tk]: c })) } else { setToolColors(prev => ({ ...prev, [tk]: c })); if (dkey.startsWith('shape-')) setToolHighlightColors(prev => ({ ...prev, [tk]: 'transparent' })) } setDrawTool(tk) } setDrawColor(c); setOpenPenDropdown(null) }}
                                            style={{ width: '30px', height: '30px', borderRadius: '50%', background: c, border: drawColor === c ? '3px solid #1a73e8' : '2px solid rgba(0,0,0,0.08)', cursor: 'pointer', outline: 'none' }} />
                                        ))}
                                      </div>
                                      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Selected color</span>
                                        <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #c0c0c0', borderRadius: '6px', overflow: 'hidden', width: 'fit-content' }}>
                                          <div style={{ width: '50px', height: '56px', background: drawColor, flexShrink: 0 }} />
                                          <input type="text" value={drawColor} maxLength={7}
                                            onChange={e => { if (/^#[0-9a-f]{0,6}$/i.test(e.target.value)) setDrawColor(e.target.value) }}
                                            onMouseDown={e => e.stopPropagation()} placeholder="#607d8b"
                                            style={{ padding: '18px 10px', backgroundColor: 'white', border: 'none', fontSize: '14px', fontFamily: 'monospace', outline: 'none', width: '110px' }} />
                                        </div>
                                      </div>
                                    </div>
                                    <ColorPicker value={drawColor} onChange={setDrawColor} showHex={false} />
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                                    <button onMouseDown={e => { e.preventDefault(); const snap = penDropdownSnapshotRef.current; if (snap) { setDrawColor(snap.color); if (snap.toolColor !== undefined) setToolColors(prev => ({ ...prev, [snap.tk]: snap.toolColor as string })); if (snap.highlight !== undefined) setToolHighlightColors(prev => ({ ...prev, [snap.tk]: snap.highlight as string })) } setOpenPenDropdown(null) }}
                                      style={{ padding: '6px 16px', border: '1px solid #ddd', borderRadius: '16px', background: '#fff', color: '#555', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                                    <button onMouseDown={e => { e.preventDefault(); setOpenPenDropdown(null) }}
                                      style={{ padding: '6px 16px', border: 'none', borderRadius: '16px', background: '#1a73e8', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Save</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Shapes</span>
                    </div>
                    {/* Column divider */}
                    <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                    {/* DRAW: Zoom group */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '1px', opacity: canvasMode ? 1 : 0.4, pointerEvents: canvasMode ? 'auto' : 'none' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        {([
                          { key: 'zoom-in',  icon: <ZoomIn  size={30} strokeWidth={1} />, label: 'Zoom In' },
                          { key: 'zoom-out', icon: <ZoomOut size={30} strokeWidth={1} />, label: 'Zoom Out'},
                        ]).map(({ key, icon, label }) => (
                          <button key={key} title={label} onMouseDown={e => { e.preventDefault(); setDrawTool(key); if (toolColors[key]) setDrawColor(toolColors[key]) }}
                            style={{ background: drawTool === key ? '#e8f0fe' : 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: drawTool === key ? '#1a73e8' : '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                            onMouseEnter={e => { if (drawTool !== key) e.currentTarget.style.backgroundColor = '#f0f0f0' }}
                            onMouseLeave={e => { if (drawTool !== key) e.currentTarget.style.backgroundColor = 'transparent' }}>
                            {icon}
                            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
                          </button>
                        ))}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#bbb', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Zoom</span>
                    </div>
                    {/* Column divider */}
                    <div style={{ width: '1px', background: '#e0e0e0', margin: '4px 6px', flexShrink: 0 }} />
                    {/* DRAW: Clear group */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: canvasMode ? 1 : 0.4, pointerEvents: canvasMode ? 'auto' : 'none' }}>
                      <button title="Clear canvas" onMouseDown={e => { e.preventDefault(); setConfirmDialog({ title: 'Clear canvas?', message: 'This will clear the current drawing on the canvas board. This can be undone with Undo.', onConfirm: clearCanvasMode }) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', borderRadius: '4px', color: '#e53935', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fce4e4' }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}>
                        <Trash2 size={20} strokeWidth={1} />
                        <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.4, color: '#e53935' }}>Clear<br />Canvas</span>
                      </button>
                    </div>
                  </div>
                    {drawToolbarOverflow.right && (
                      <button onMouseDown={e => { e.preventDefault(); document.getElementById('draw-toolbar-scroll')?.scrollBy({ left: 160, behavior: 'smooth' }) }}
                        style={{ flexShrink: 0, background: '#e8f0fe', border: 'none', borderLeft: '1px solid #e8e8e8', cursor: 'pointer', padding: '0', color: '#1a73e8', display: 'flex', alignItems: 'center', alignSelf: 'stretch' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#1a73e8'; e.currentTarget.style.backgroundColor = '#d2e3fc' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#1a73e8'; e.currentTarget.style.backgroundColor = '#e8f0fe' }}>
                        <ChevronRight size={20} />
                      </button>
                    )}
                  </div>
                </>}
                {linkPopoverOpen && createPortal(
                  <div data-toolbar-menu style={{ position: 'fixed', bottom: toolbarMenuPos.bottom, left: toolbarMenuPos.left, zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.12)', padding: '14px', width: '260px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '10px' }}>{editingLinkEl ? 'Edit link' : 'Insert link'}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '11px', color: '#888' }}>URL</span>
                        <input type="text" autoFocus value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                          onMouseDown={e => e.stopPropagation()}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); insertOrUpdateLink() } if (e.key === 'Escape') setLinkPopoverOpen(false) }}
                          placeholder="https://example.com"
                          style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', outline: 'none' }} />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '11px', color: '#888' }}>Text to display</span>
                        <input type="text" value={linkText} onChange={e => setLinkText(e.target.value)}
                          onMouseDown={e => e.stopPropagation()}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); insertOrUpdateLink() } if (e.key === 'Escape') setLinkPopoverOpen(false) }}
                          placeholder="(optional)"
                          style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', outline: 'none' }} />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#555', cursor: 'pointer' }}>
                        <input type="checkbox" checked={linkOpenNewTab} onChange={e => setLinkOpenNewTab(e.target.checked)} onMouseDown={e => e.stopPropagation()} />
                        Open in new tab
                      </label>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                      {editingLinkEl ? (
                        <button onMouseDown={e => { e.preventDefault(); removeLink() }}
                          style={{ padding: '6px 14px', border: 'none', borderRadius: '16px', background: 'none', color: '#e53935', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Remove link</button>
                      ) : <span />}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onMouseDown={e => { e.preventDefault(); setLinkPopoverOpen(false) }}
                          style={{ padding: '6px 16px', border: '1px solid #ddd', borderRadius: '16px', background: '#fff', color: '#555', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                        <button onMouseDown={e => { e.preventDefault(); insertOrUpdateLink() }} disabled={!linkUrl.trim()}
                          style={{ padding: '6px 16px', border: 'none', borderRadius: '16px', background: linkUrl.trim() ? '#1a73e8' : '#9fc1ef', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: linkUrl.trim() ? 'pointer' : 'not-allowed' }}>{editingLinkEl ? 'Update' : 'Insert'}</button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
                {signaturePopoverOpen && createPortal(
                  <div data-toolbar-menu style={{ position: 'fixed', bottom: toolbarMenuPos.bottom, left: toolbarMenuPos.left, zIndex: 9999, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 -4px 12px rgba(0,0,0,0.12)', padding: '14px', width: '280px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '10px' }}>Signature</div>
                    <textarea autoFocus value={signatureDraft} onChange={e => setSignatureDraft(e.target.value)}
                      onMouseDown={e => e.stopPropagation()}
                      onKeyDown={e => { if (e.key === 'Escape') setSignaturePopoverOpen(false) }}
                      rows={4}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#555', cursor: 'pointer', marginTop: '8px' }}>
                      <input type="checkbox" checked={autoInsertSignature} onChange={e => toggleAutoInsertSignature(e.target.checked)} onMouseDown={e => e.stopPropagation()} />
                      Automatically add signature to new emails
                    </label>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                      <button onMouseDown={e => { e.preventDefault(); saveSignature() }}
                        style={{ padding: '6px 14px', border: '1px solid #ddd', borderRadius: '16px', background: '#fff', color: '#555', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Save</button>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onMouseDown={e => { e.preventDefault(); setSignaturePopoverOpen(false) }}
                          style={{ padding: '6px 16px', border: '1px solid #ddd', borderRadius: '16px', background: '#fff', color: '#555', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                        <button onMouseDown={e => { e.preventDefault(); saveSignature(); insertSignature(signatureDraft); setSignaturePopoverOpen(false) }} disabled={!signatureDraft.trim()}
                          style={{ padding: '6px 16px', border: 'none', borderRadius: '16px', background: signatureDraft.trim() ? '#1a73e8' : '#9fc1ef', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: signatureDraft.trim() ? 'pointer' : 'not-allowed' }}>Insert</button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            </div>
          </div>
          ); const target = composeFloating ? document.body : composeInlineSlot
            return target ? createPortal(composeBox, target) : null })()}

      {showSchedulePopup && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setShowSchedulePopup(false); setScheduleDate('') }}
        >
          <div
            style={{ background: '#f0f0f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && scheduleDate) {
                e.preventDefault()
                const hour24 = schedulePeriod === 'AM' ? scheduleHour % 12 : (scheduleHour % 12) + 12
                const dateTimeStr = `${scheduleDate}T${String(hour24).padStart(2,'0')}:${String(scheduleMinute).padStart(2,'0')}`
                handleScheduleSend(dateTimeStr)
                setShowSchedulePopup(false)
                setScheduleDate('')
              }
            }}
          >
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="active-scheduled-icon-bg" style={{ width: '18px', height: '18px', backgroundSize: '18px 18px', margin: 0 }} />
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)', marginBottom: '6px' }}>
                      {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                        <div key={d} style={{ fontSize: '12px', color: '#bbb', textAlign: 'center', padding: '4px 0', fontWeight: 600 }}>{d}</div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)', gap: '4px', minHeight: '238px' }}>
                      {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                        const dateStr = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                        const isSelected = scheduleDate === dateStr
                        const isToday = dateStr === todayStr
                        const isPast = dateStr < todayStr
                        return (
                          <button
                            key={day}
                            disabled={isPast}
                            onClick={(e) => { e.stopPropagation(); setScheduleDate(dateStr) }}
                            style={{ width: '38px', height: '38px', backgroundColor: 'white', border: 'none', borderRadius: '50%', cursor: isPast ? 'default' : 'pointer', background: isSelected ? '#0288d1' : '#f5f5f5', color: isSelected ? '#fff' : isPast ? '#ddd' : isToday ? '#0288d1' : '#333', fontWeight: isSelected || isToday ? 700 : 400, fontSize: '14px' }}
                          >{day}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '28px', width: '230px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '14px', color: '#888', fontWeight: 500 }}>Date</div>
                      <div style={{ fontSize: '15px', color: scheduleDate ? '#333' : '#ccc', fontWeight: scheduleDate ? 500 : 400, minHeight: '22px' }}>
                        {scheduleDate
                          ? (() => { const [y,m,d] = scheduleDate.split('-'); return `${d}/${m}/${y}` })()
                          : 'DD/MM/YYYY'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '14px', color: '#888', fontWeight: 500 }}>Time</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input type="number" min={1} max={12} value={scheduleHour} onClick={(e) => e.stopPropagation()} onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) setScheduleHour(Math.min(12, Math.max(1, v))) }} onBlur={(e) => { const v = Number(e.target.value); setScheduleHour(isNaN(v) || v < 1 ? 1 : v > 12 ? 12 : v) }} style={{ width: '50px', padding: '7px 4px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '15px', outline: 'none', textAlign: 'center', MozAppearance: 'textfield', fontWeight: 500, fontFamily: 'inherit' } as React.CSSProperties} />
                        <span style={{ fontWeight: 700, color: '#555', fontSize: '16px' }}>:</span>
                        <input type="number" min={0} max={59} value={String(scheduleMinute).padStart(2, '0')} onClick={(e) => e.stopPropagation()} onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) setScheduleMinute(Math.min(59, Math.max(0, v))) }} onBlur={(e) => { const v = Number(e.target.value); setScheduleMinute(isNaN(v) || v < 0 ? 0 : v > 59 ? 59 : v) }} style={{ width: '50px', padding: '7px 4px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '15px', outline: 'none', textAlign: 'center', MozAppearance: 'textfield', fontWeight: 500, fontFamily: 'inherit' } as React.CSSProperties} />
                        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid #c0c0c0', marginLeft: '4px' }}>
                          {(['AM', 'PM'] as const).map(p => (
                            <button key={p} onClick={(e) => { e.stopPropagation(); setSchedulePeriod(p) }} style={{ padding: '6px 4px', backgroundColor: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, background: schedulePeriod === p ? '#0288d1' : '#fafafa', color: schedulePeriod === p ? '#fff' : '#999', transition: 'background 0.15s' }}>{p}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid #e0e0e0' }}>
              <button onClick={(e) => { e.stopPropagation(); setShowSchedulePopup(false); setScheduleDate('') }} style={{ width: '90px', padding: '8px 0', borderRadius: '20px', border: '1.5px solid #c0c0c0', background: '#fff', color: '#555', fontSize: '15px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}>Cancel</button>
              <button disabled={!scheduleDate} onClick={(e) => {
                e.stopPropagation()
                if (!scheduleDate) return
                const hour24 = schedulePeriod === 'AM' ? scheduleHour % 12 : (scheduleHour % 12) + 12
                const dateTimeStr = `${scheduleDate}T${String(hour24).padStart(2,'0')}:${String(scheduleMinute).padStart(2,'0')}`
                handleScheduleSend(dateTimeStr)
                setShowSchedulePopup(false)
                setScheduleDate('')
              }} style={{ width: '130px', padding: '8px 0', borderRadius: '20px', backgroundColor: 'white', border: 'none', background: scheduleDate ? '#0288d1' : '#b3d9f0', color: '#fff', fontSize: '15px', cursor: scheduleDate ? 'pointer' : 'not-allowed', fontWeight: 600, transition: 'all 0.15s' }}>Schedule send</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showSnoozePopup !== null && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setShowSnoozePopup(null); setSnoozeDate('') }}
        >
          <div
            style={{ background: '#f0f0f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && snoozeDate && showSnoozePopup !== null) {
                e.preventDefault()
                const hour24 = snoozePeriod === 'AM' ? snoozeHour % 12 : (snoozeHour % 12) + 12
                const dateTimeStr = `${snoozeDate}T${String(hour24).padStart(2,'0')}:${String(snoozeMinute).padStart(2,'0')}`
                const diff = new Date(dateTimeStr).getTime() - Date.now()
                const hours = diff / 3600000
                if (hours > 0) {
                  const msg = messages.find(m => m.id === showSnoozePopup)
                  if (msg && msg.emailId) {
                    try {
                      await fetch(`http://localhost:5050/api/emails/${msg.emailId}/snooze`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ is_snoozed: true, hours }),
                      })
                      window.dispatchEvent(new Event('mailRefresh'))
                    } catch (err) { console.error('Error:', err) }
                  }
                }
                setShowSnoozePopup(null)
                setSnoozeDate('')
              }
            }}
          >
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
                        <button onClick={(e) => { e.stopPropagation(); calendarViewMonth === 0 ? (setCalendarViewMonth(11), setCalendarViewYear(y => y - 1)) : setCalendarViewMonth(m => m - 1) }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} style={{ background: 'transparent', backgroundColor: 'white', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#666', lineHeight: 1, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background-color 0.2s ease', paddingBottom: '2px' }}>‹</button>
                        <button onClick={(e) => { e.stopPropagation(); calendarViewMonth === 11 ? (setCalendarViewMonth(0), setCalendarViewYear(y => y + 1)) : setCalendarViewMonth(m => m + 1) }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} style={{ background: 'transparent', backgroundColor: 'white', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#666', lineHeight: 1, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background-color 0.2s ease', paddingBottom: '2px' }}>›</button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)', marginBottom: '6px' }}>
                      {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                        <div key={d} style={{ fontSize: '12px', color: '#bbb', textAlign: 'center', padding: '4px 0', fontWeight: 600 }}>{d}</div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)', gap: '4px', minHeight: '238px' }}>
                      {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                        const dateStr = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                        const isSelected = snoozeDate === dateStr
                        const isToday = dateStr === todayStr
                        const isPast = dateStr < todayStr
                        return (
                          <button key={day} disabled={isPast} onClick={(e) => { e.stopPropagation(); setSnoozeDate(dateStr) }} style={{ width: '38px', height: '38px', backgroundColor: 'white', border: 'none', borderRadius: '50%', cursor: isPast ? 'default' : 'pointer', background: isSelected ? '#0288d1' : '#f5f5f5', color: isSelected ? '#fff' : isPast ? '#ddd' : isToday ? '#0288d1' : '#333', fontWeight: isSelected || isToday ? 700 : 400, fontSize: '14px' }}>{day}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '28px', width: '230px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '14px', color: '#888', fontWeight: 500 }}>Date</div>
                      <div style={{ fontSize: '15px', color: snoozeDate ? '#333' : '#ccc', fontWeight: snoozeDate ? 500 : 400, minHeight: '22px' }}>
                        {snoozeDate ? (() => { const [y,m,d] = snoozeDate.split('-'); return `${d}/${m}/${y}` })() : 'DD/MM/YYYY'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '14px', color: '#888', fontWeight: 500 }}>Time</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input type="number" min={1} max={12} value={snoozeHour} onClick={(e) => e.stopPropagation()} onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) setSnoozeHour(Math.min(12, Math.max(1, v))) }} onBlur={(e) => { const v = Number(e.target.value); setSnoozeHour(isNaN(v) || v < 1 ? 1 : v > 12 ? 12 : v) }} style={{ width: '50px', padding: '7px 4px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '15px', outline: 'none', textAlign: 'center', MozAppearance: 'textfield', fontWeight: 500, fontFamily: 'inherit' } as React.CSSProperties} />
                        <span style={{ fontWeight: 700, color: '#555', fontSize: '16px' }}>:</span>
                        <input type="number" min={0} max={59} value={String(snoozeMinute).padStart(2, '0')} onClick={(e) => e.stopPropagation()} onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) setSnoozeMinute(Math.min(59, Math.max(0, v))) }} onBlur={(e) => { const v = Number(e.target.value); setSnoozeMinute(isNaN(v) || v < 0 ? 0 : v > 59 ? 59 : v) }} style={{ width: '50px', padding: '7px 4px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '15px', outline: 'none', textAlign: 'center', MozAppearance: 'textfield', fontWeight: 500, fontFamily: 'inherit' } as React.CSSProperties} />
                        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid #c0c0c0', marginLeft: '4px' }}>
                          {(['AM', 'PM'] as const).map(p => (
                            <button key={p} onClick={(e) => { e.stopPropagation(); setSnoozePeriod(p) }} style={{ padding: '6px 4px', backgroundColor: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, background: snoozePeriod === p ? '#0288d1' : '#fafafa', color: snoozePeriod === p ? '#fff' : '#999', transition: 'background 0.15s' }}>{p}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid #e0e0e0' }}>
              <button onClick={(e) => { e.stopPropagation(); setShowSnoozePopup(null); setSnoozeDate('') }} style={{ width: '90px', padding: '8px 0', borderRadius: '20px', border: '1.5px solid #c0c0c0', background: '#fff', color: '#555', fontSize: '15px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}>Cancel</button>
              <button disabled={!snoozeDate} onClick={async (e) => {
                e.stopPropagation()
                if (!snoozeDate || showSnoozePopup === null) return
                const hour24 = snoozePeriod === 'AM' ? snoozeHour % 12 : (snoozeHour % 12) + 12
                const dateTimeStr = `${snoozeDate}T${String(hour24).padStart(2,'0')}:${String(snoozeMinute).padStart(2,'0')}`
                const diff = new Date(dateTimeStr).getTime() - Date.now()
                const hours = diff / 3600000
                if (hours > 0) {
                  const msg = messages.find(m => m.id === showSnoozePopup)
                  if (msg && msg.emailId) {
                    try {
                      await fetch(`http://localhost:5050/api/emails/${msg.emailId}/snooze`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ is_snoozed: true, hours }),
                      })
                    } catch (err) { console.error('Error:', err) }
                  }
                }
                setShowSnoozePopup(null)
                setSnoozeDate('')
              }} style={{ width: '90px', padding: '8px 0', borderRadius: '20px', backgroundColor: 'white', border: 'none', background: snoozeDate ? '#0288d1' : '#b3d9f0', color: '#fff', fontSize: '15px', cursor: snoozeDate ? 'pointer' : 'not-allowed', fontWeight: 600, transition: 'all 0.15s' }}>Save</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {validationError && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setValidationError(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxWidth: '400px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertOctagon size={20} color="#f44336" />
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>{validationError.includes('exceed') ? 'File Too Large' : 'Invalid Address'}</span>
            </div>
            <div style={{ padding: '20px', fontSize: '14px', color: '#555', lineHeight: '1.5' }}>
              {validationError}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #e0e0e0', backgroundColor: '#f9f9f9' }}>
              <button onClick={() => setValidationError(null)} style={{ padding: '8px 24px', borderRadius: '20px', backgroundColor: '#2196f3', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: 600, transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1976d2'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#2196f3'}>OK</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmDialog && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setConfirmDialog(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxWidth: '400px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertOctagon size={20} color="#f44336" />
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>{confirmDialog.title}</span>
            </div>
            <div style={{ padding: '20px', fontSize: '14px', color: '#555', lineHeight: '1.5' }}>
              {confirmDialog.message}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: '1px solid #e0e0e0', backgroundColor: '#f9f9f9' }}>
              <button onClick={() => setConfirmDialog(null)} style={{ padding: '8px 20px', borderRadius: '20px', backgroundColor: 'transparent', border: '1px solid #ccc', color: '#555', fontSize: '14px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn() }} style={{ padding: '8px 20px', borderRadius: '20px', backgroundColor: '#f44336', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: 600, transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#d32f2f'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f44336'}>Confirm</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {subjectWarning && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            style={{ background: '#fff', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxWidth: '400px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertOctagon size={20} color="#fb8c00" />
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>Missing Subject</span>
            </div>
            <div style={{ padding: '20px', fontSize: '14px', color: '#555', lineHeight: '1.5' }}>
              {subjectWarning}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
    {moveToMenuOpen !== null && moveMenuPosition && createPortal(
      (() => {
        const currentEmail = allEmails.find(e => e.id === moveToMenuOpen)
        const currentLabelName = currentEmail?.label_name ?? null
        const allItems = flattenLabelsTree(customLabels)
        const searching = labelSearchQuery.trim() !== ''
        const visible = searching
          ? allItems.filter(l => l.fullPath.toLowerCase().includes(labelSearchQuery.toLowerCase()))
          : allItems.filter(l => isMoveItemVisible(l, allItems))
        return (
          <div
            className="move-to-dropdown"
            style={{ position: 'fixed', top: moveMenuPosition.top ?? 'auto', bottom: moveMenuPosition.bottom ?? 'auto', right: moveMenuPosition.right, left: 'auto', width: '320px', minHeight: '200px', maxHeight: moveMenuPosition.maxHeight, background: '#fff', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)', border: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '8px', borderBottom: '1px solid #e8e8e8', background: '#f8f8f8', borderRadius: '10px 10px 0 0' }}>
              <input
                type="text"
                className="label-search-input"
                placeholder="Search labels..."
                value={labelSearchQuery}
                onChange={e => setLabelSearchQuery(e.target.value)}
                onClick={e => e.stopPropagation()}
                autoFocus
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {visible.length === 0
                ? <div style={{ padding: '12px 14px', color: '#999', fontSize: '13px' }}>No labels found</div>
                : visible.map(label => {
                  const isExpanded = expandedMoveLabels.has(label.id)
                  const isSelected = label.fullPath === currentLabelName
                  const iconColor = label.color
                  const depth = searching ? 0 : label.depth
                  return (
                    <div key={label.id} style={{ display: 'flex', alignItems: 'center', paddingLeft: `${6 + depth * 16}px`, paddingRight: '10px', borderBottom: '1px solid #f5f5f5', background: isSelected ? '#e8f0fe' : undefined }}>
                      {label.hasChildren ? (
                        <button onClick={e => { e.stopPropagation(); setExpandedMoveLabels(prev => { const next = new Set(prev); next.has(label.id) ? next.delete(label.id) : next.add(label.id); return next }) }} style={{ background: 'none', backgroundColor: 'white', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: isExpanded ? iconColor : '#888', flexShrink: 0 }}>
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                      ) : <span style={{ width: '17px', flexShrink: 0 }} />}
                      <div
                        onClick={async () => {
                          if (!moveToMenuOpen || !token) return
                          const targetId = moveToMenuOpen
                          // Optimistic update — the per-message label pill reads from
                          // allEmails, so without this it wouldn't show the new label until
                          // the background 'mailRefresh' refetch completes.
                          setAllEmails(prev => prev.map(e => e.id === targetId ? { ...e, label_name: label.fullPath } : e))
                          setMoveToMenuOpen(null); setMoveMenuPosition(null); setLabelSearchQuery('')
                          try {
                            await fetch(`http://localhost:5050/api/emails/${targetId}/label`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ label_name: label.fullPath }) })
                            window.dispatchEvent(new Event('mailRefresh'))
                          } catch (err) { console.error('Error:', err) }
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f5f5f5' }}
                        onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#e8f0fe' : 'transparent' }}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '9px', paddingBottom: '9px', cursor: 'pointer', fontSize: '14px', color: '#333' }}
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
              }
            </div>
            <div style={{ height: '1px', backgroundColor: '#ddd' }} />
            <button
              onClick={() => { setMoveToMenuOpen(null); setMoveMenuPosition(null); setClLabelName(''); setClLabelColor(''); setClParentId(null); setClError(''); setClLoading(false); setClShowSubLabelDropdown(false); setShowCreateLabelModal(true) }}
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
    {showCreateLabelModal && createPortal(
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => setShowCreateLabelModal(false)}
      >
        <div
          style={{ background: '#f0f0f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', width: '560px', height: '560px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          onClick={(e) => { e.stopPropagation(); setClShowSubLabelDropdown(false) }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0' }}>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>Create New Label</span>
          </div>

          <div style={{ padding: '16px 20px 10px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
            {clError && <div style={{ color: '#e53935', fontSize: '13px', background: '#fff0f0', padding: '8px 12px', borderRadius: '8px' }}>{clError}</div>}

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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Sub-label under (optional)</label>
              <div
                ref={clSubLabelTriggerRef}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!clShowSubLabelDropdown) {
                    const collectParents = (nodes: any[]): number[] =>
                      nodes.flatMap((n: any) => n.children?.length ? [n.id, ...collectParents(n.children)] : [])
                    setExpandedCreateSubLabels(new Set(collectParents(customLabels)))
                  }
                  setClShowSubLabelDropdown(!clShowSubLabelDropdown)
                }}
                style={{ display: 'flex', alignItems: 'center', padding: '9px 12px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '14px', background: '#fff', cursor: 'pointer', justifyContent: 'space-between' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#333' }}>
                  {clParentId ? (() => {
                    const sel = flattenLabelsTree(customLabels).find((l: any) => l.id === clParentId)
                    return sel ? (
                      <>
                        {sel.hasChildren
                          ? <Folder size={16} style={{ color: sel.color, stroke: sel.color, fill: 'none', flexShrink: 0 }} />
                          : <Tag size={16} style={{ color: sel.color, stroke: sel.color, fill: 'none', flexShrink: 0 }} />}
                        {sel.leafName}
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
                  const allItems = flattenLabelsTree(customLabels)
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
                                  <span style={{ fontWeight: l.depth === 0 ? 600 : 400 }}>{l.leafName}</span>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#555' }}>Color</label>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 30px)', gap: '8px' }}>
                    {['#000000','#757575','#bdbdbd','#f44336','#e91e63','#f06292','#9c27b0','#3f51b5','#2196f3','#00bcd4','#009688','#4caf50','#ffeb3b','#ff9800','#795548','#607d8b'].map(c => (
                      <button key={c} onClick={(e) => { e.stopPropagation(); setClLabelColor(c) }}
                        style={{ width: '30px', height: '30px', borderRadius: '50%', background: c, border: clLabelColor === c ? '3px solid #333' : '2px solid rgba(0,0,0,0.08)', cursor: 'pointer', outline: 'none' }} />
                    ))}
                  </div>
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
                <ColorPicker value={clLabelColor || '#607d8b'} onChange={setClLabelColor} showHex={false} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid #e0e0e0' }}>
            <button
              className="snooze-cancel-btn"
              onClick={() => setShowCreateLabelModal(false)}
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
                    const updated = await fetch('http://localhost:5050/api/custom-labels', { headers: { Authorization: `Bearer ${token}` } })
                    if (updated.ok) { const d = await updated.json(); setCustomLabels(d.labels || []) }
                    setShowCreateLabelModal(false)
                  } else {
                    const d = await res.json(); setClError(d.error || 'Failed to create label')
                  }
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

    {/* File preview modal */}
    {filePreview && (() => {
      const { url, thumbUrl, name, ext } = filePreview
      const isImg = ['png','jpg','jpeg','gif','webp','bmp','ico','svg'].includes(ext)
      const isVid = ['mp4','webm','mov','avi','mkv'].includes(ext)
      const isAud = ['mp3','wav','ogg','aac','m4a','flac'].includes(ext)
      const isPdf = ext === 'pdf'
      const isCode = CODE_EXTS.has(ext)
      const previewSrc = url || thumbUrl
      const { color: typeColor, bg: typeBg, label: typeLabel } = getFileTypeInfo(name)
      return (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseDown={() => setFilePreview(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', width: isCode ? 'min(900px, 92vw)' : undefined, maxWidth: '92vw', maxHeight: '90vh', minWidth: 320, boxShadow: '0 8px 40px rgba(0,0,0,0.35)' }}
            onMouseDown={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #eee', background: '#fafafa' }}>
              {typeLabel && <span style={{ fontSize: 10, background: typeColor + '22', color: typeColor, padding: '2px 7px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.4px', flexShrink: 0 }}>{typeLabel}</span>}
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</span>
              {previewSrc && (
                <a href={previewSrc} download={name} style={{ fontSize: 12, color: '#1a73e8', textDecoration: 'none', padding: '4px 10px', border: '1px solid #1a73e8', borderRadius: 6, whiteSpace: 'nowrap' }}>Download</a>
              )}
              <button onMouseDown={() => setFilePreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#666', lineHeight: 1, padding: '0 2px' }}>×</button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: isCode ? 'flex-start' : 'center', justifyContent: 'center', padding: isCode ? 0 : 16, background: isCode ? '#1e1e2e' : '#f5f5f5', minHeight: 200 }}>
              {isImg && (
                <img src={previewSrc} alt={name} style={{ maxWidth: '80vw', maxHeight: '72vh', borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', objectFit: 'contain' }} />
              )}
              {isPdf && previewSrc && (
                <embed src={previewSrc} type="application/pdf" style={{ width: 'min(700px, 80vw)', height: '72vh', borderRadius: 6 }} />
              )}
              {isVid && previewSrc && (
                <video src={previewSrc} controls style={{ maxWidth: '80vw', maxHeight: '72vh', borderRadius: 6, background: '#000' }} />
              )}
              {isAud && previewSrc && (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
                  <div style={{ fontSize: 14, color: '#555', marginBottom: 16 }}>{name}</div>
                  <audio src={previewSrc} controls style={{ width: 320 }} />
                </div>
              )}
              {isCode && (
                previewCodeLoading ? (
                  <div style={{ color: '#888', padding: 40, fontSize: 14 }}>Loading…</div>
                ) : previewCodeContent !== null ? (
                  <div style={{ width: '100%', height: '100%', overflow: 'auto', padding: '16px 0' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",Consolas,monospace', fontSize: 13.5, lineHeight: '1.6' }}>
                      <tbody>
                        {previewCodeContent.split('\n').map((line, i) => (
                          <tr key={i} style={{ verticalAlign: 'top' }}>
                            <td style={{ textAlign: 'right', paddingLeft: 16, paddingRight: 14, width: 1, whiteSpace: 'nowrap', color: '#555', userSelect: 'none', borderRight: '1px solid #313244', fontSize: 12, paddingTop: 1, paddingBottom: 1 }}>{i + 1}</td>
                            <td style={{ paddingLeft: 16, paddingRight: 24, color: '#cdd6f4', whiteSpace: 'pre', paddingTop: 1, paddingBottom: 1 }}>{line || ' '}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <FileText size={52} strokeWidth={1.2} color={typeColor} />
                    <div style={{ fontSize: 13, color: '#888' }}>File preview not available — upload the file first</div>
                    {previewSrc && <a href={previewSrc} download={name} style={{ fontSize: 13, color: '#fff', background: '#1a73e8', padding: '8px 22px', borderRadius: 20, textDecoration: 'none' }}>Download file</a>}
                  </div>
                )
              )}
              {!isImg && !isPdf && !isVid && !isAud && !isCode && (
                <div style={{ textAlign: 'center', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <div style={{ padding: '24px 28px', borderRadius: 14, background: typeBg, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, border: `1px solid ${typeColor}33` }}>
                    <FileText size={64} strokeWidth={1.2} color={typeColor} />
                    {typeLabel && <span style={{ fontSize: 13, background: typeColor + '22', color: typeColor, padding: '3px 12px', borderRadius: 6, fontWeight: 700 }}>{typeLabel}</span>}
                  </div>
                  <div style={{ fontSize: 15, color: '#222', fontWeight: 600 }}>{name}</div>
                  {previewSrc && (
                    <a href={previewSrc} download={name} style={{ fontSize: 13, color: '#fff', background: '#1a73e8', padding: '8px 22px', borderRadius: 20, textDecoration: 'none', display: 'inline-block', fontWeight: 500 }}>Download file</a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    })()}

    {/* Folder navigation preview modal */}
    {folderPreview && (() => {
      // Derive current entries by following folderNavPath into the structure
      let currentEntries = folderPreview.entries
      for (const seg of folderNavPath) {
        const found = currentEntries.find(e => e.type === 'folder' && e.name === seg) as Extract<FolderEntry, { type: 'folder' }> | undefined
        if (found) currentEntries = found.children; else break
      }
      const { files: fileCount, folders: folderCount } = countFolderItems(currentEntries)
      const breadcrumb = [folderPreview.name, ...folderNavPath]

      const toggleSidebar = (key: string) => setSidebarExpanded(prev => {
        const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
      })

      // Sidebar tree renderer: shows folders (with toggle) and files
      const renderSidebarTree = (entries: FolderEntry[], depth: number, pathArr: string[]): React.ReactNode[] =>
        entries.flatMap((e, idx) => {
          if (e.type === 'file') {
            const { color: fc, label: fl } = getFileTypeInfo(e.name)
            return [(
              <div key={`${pathArr.join('/')}/file-${idx}`}
                style={{ paddingLeft: 6 + depth * 14, paddingRight: 8, paddingTop: 1, paddingBottom: 1, display: 'flex', alignItems: 'center', userSelect: 'none' as const }}>
                <span style={{ width: 18, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', fontSize: 12, color: '#555' }}>
                  <FileText size={13} color={fc} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{e.name}</span>
                  {fl && <span style={{ fontSize: 9, background: fc + '22', color: fc, padding: '1px 4px', borderRadius: 3, fontWeight: 700, flexShrink: 0, letterSpacing: '0.3px' }}>{fl}</span>}
                </div>
              </div>
            )]
          }
          const folder = e as Extract<FolderEntry, { type: 'folder' }>
          const folderPath = [...pathArr, folder.name]
          const pathKey = folderPath.join('/')
          const isActive = JSON.stringify(folderNavPath) === JSON.stringify(folderPath)
          const isExpanded = sidebarExpanded.has(pathKey)
          const hasChildren = folder.children.length > 0
          return [
            <div key={pathKey}
              style={{ paddingLeft: 6 + depth * 14, paddingRight: 8, paddingTop: 1, paddingBottom: 1, display: 'flex', alignItems: 'center', userSelect: 'none' as const }}>
              {/* Toggle chevron */}
              <span onClick={ev => { ev.stopPropagation(); if (hasChildren) toggleSidebar(pathKey) }}
                style={{ width: 18, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: hasChildren ? 'pointer' : 'default' }}>
                {hasChildren
                  ? (isExpanded ? <ChevronDown size={16} color="#888" /> : <ChevronRight size={16} color="#888" />)
                  : <span style={{ width: 16 }} />}
              </span>
              {/* Folder row — click navigates + auto-expands */}
              <div onClick={() => { setFolderNavPath(folderPath); if (hasChildren) setSidebarExpanded(prev => new Set([...prev, pathKey])) }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? '#1a73e8' : '#333', background: isActive ? '#e8f0fe' : 'transparent' }}
                onMouseEnter={el => { if (!isActive) el.currentTarget.style.background = '#f1f3f4' }}
                onMouseLeave={el => { el.currentTarget.style.background = isActive ? '#e8f0fe' : 'transparent' }}>
                {(isExpanded || isActive)
                  ? <FolderOpen size={14} color={isActive ? '#1a73e8' : '#42a5f5'} style={{ flexShrink: 0 }} />
                  : <Folder size={14} color="#42a5f5" style={{ flexShrink: 0 }} />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{folder.name}</span>
              </div>
            </div>,
            ...(isExpanded ? renderSidebarTree(folder.children, depth + 1, folderPath) : [])
          ]
        })

      return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseDown={() => { setFolderPreview(null); setFolderNavPath([]) }}>
          <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', width: '92vw', height: '88vh', maxWidth: '1200px', boxShadow: '0 8px 40px rgba(0,0,0,0.35)' }}
            onMouseDown={e => e.stopPropagation()}>

            {/* Header: breadcrumb + close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid #e0e0e0', background: '#fff', minHeight: 50, flexShrink: 0 }}>
              {folderNavPath.length > 0 && (
                <button onMouseDown={() => setFolderNavPath(p => p.slice(0, -1))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, display: 'flex', alignItems: 'center', color: '#555', flexShrink: 0 }}>
                  <ArrowLeft size={24} strokeWidth={2} />
                </button>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, overflow: 'hidden' }}>
                {breadcrumb.map((seg, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                    {i > 0 && <ChevronRight size={16} color="#bbb" style={{ flexShrink: 0 }} />}
                    <span onClick={() => setFolderNavPath(breadcrumb.slice(1, i + 1))}
                      style={{ fontSize: i === breadcrumb.length - 1 ? 14 : 13, fontWeight: i === breadcrumb.length - 1 ? 600 : 400, color: i === breadcrumb.length - 1 ? '#222' : '#1a73e8', cursor: i === breadcrumb.length - 1 ? 'default' : 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {seg}
                    </span>
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {fileCount} file{fileCount !== 1 ? 's' : ''}{folderCount > 0 ? `, ${folderCount} folder${folderCount !== 1 ? 's' : ''}` : ''}
              </span>
              {/* Download current view as file list */}
              <button title="Download file list"
                onMouseDown={() => {
                  const collectPaths = (entries: FolderEntry[], prefix: string): string[] =>
                    entries.flatMap(e => e.type === 'file'
                      ? [`${prefix}${e.name}`]
                      : collectPaths(e.children, `${prefix}${e.name}/`))
                  const lines = collectPaths(folderPreview.entries, `${folderPreview.name}/`)
                  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                  a.download = `${folderPreview.name}-files.txt`; a.click()
                  URL.revokeObjectURL(a.href)
                }}
                style={{ background: 'none', border: '1px solid #d0d0d0', borderRadius: 6, cursor: 'pointer', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6, color: '#555', fontSize: 13, flexShrink: 0, marginLeft: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.borderColor = '#bbb' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = '#d0d0d0' }}>
                <Download size={14} strokeWidth={1.8} /> Download list
              </button>
              <button onMouseDown={() => { setFolderPreview(null); setFolderNavPath([]) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#666', lineHeight: 1, padding: '0 2px', flexShrink: 0, marginLeft: 4 }}>×</button>
            </div>

            {/* Body: sidebar + content */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Left sidebar — folder tree */}
              <div style={{ width: 220, borderRight: '1px solid #e8e8e8', overflowY: 'auto', padding: '8px 0', background: '#f9fafb', flexShrink: 0 }}>
                {/* Root row with toggle */}
                {(() => {
                  const rootHasSubs = folderPreview.entries.length > 0
                  const rootExpanded = sidebarExpanded.has('')
                  const rootActive = folderNavPath.length === 0
                  return (<>
                    <div style={{ paddingLeft: 6, paddingRight: 8, paddingTop: 1, paddingBottom: 1, display: 'flex', alignItems: 'center', userSelect: 'none' as const }}>
                      <span onClick={() => { if (rootHasSubs) toggleSidebar('') }}
                        style={{ width: 18, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: rootHasSubs ? 'pointer' : 'default' }}>
                        {rootHasSubs
                          ? (rootExpanded ? <ChevronDown size={16} color="#888" /> : <ChevronRight size={16} color="#888" />)
                          : <span style={{ width: 16 }} />}
                      </span>
                      <div onClick={() => setFolderNavPath([])}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: rootActive ? 700 : 500, color: rootActive ? '#1a73e8' : '#333', background: rootActive ? '#e8f0fe' : 'transparent' }}
                        onMouseEnter={el => { if (!rootActive) el.currentTarget.style.background = '#f1f3f4' }}
                        onMouseLeave={el => { el.currentTarget.style.background = rootActive ? '#e8f0fe' : 'transparent' }}>
                        {(rootExpanded || rootActive)
                          ? <FolderOpen size={14} color={rootActive ? '#1a73e8' : '#42a5f5'} style={{ flexShrink: 0 }} />
                          : <Folder size={14} color="#42a5f5" style={{ flexShrink: 0 }} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{folderPreview.name}</span>
                      </div>
                    </div>
                    {rootExpanded && renderSidebarTree(folderPreview.entries, 1, [])}
                  </>)
                })()}
              </div>

              {/* Right content — grid */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#fafafa' }}>
                {currentEntries.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#aaa', fontSize: 15 }}>Empty folder</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                    {/* Sub-folders */}
                    {currentEntries.filter(e => e.type === 'folder').map((e, i) => {
                      const folder = e as Extract<FolderEntry, { type: 'folder' }>
                      const { files: fc, folders: sfc } = countFolderItems(folder.children)
                      return (
                        <div key={`f-${i}`} onClick={() => { setFolderNavPath(p => [...p, folder.name]); setSidebarExpanded(prev => new Set([...prev, [...folderNavPath, folder.name].join('/')])) }}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 12px 14px', borderRadius: 10, background: '#fff', border: '1px solid #e8e8e8', cursor: 'pointer', gap: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', userSelect: 'none' as const }}
                          onMouseEnter={el => (el.currentTarget.style.background = '#f0f4ff')}
                          onMouseLeave={el => (el.currentTarget.style.background = '#fff')}>
                          <Folder size={52} color="#42a5f5" strokeWidth={1} />
                          <span style={{ fontSize: 12, color: '#222', fontWeight: 500, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{folder.name}</span>
                          <span style={{ fontSize: 11, color: '#aaa', textAlign: 'center' }}>{fc} file{fc !== 1 ? 's' : ''}{sfc > 0 ? `, ${sfc} folder${sfc !== 1 ? 's' : ''}` : ''}</span>
                        </div>
                      )
                    })}
                    {/* Files */}
                    {currentEntries.filter(e => e.type === 'file').map((e, i) => {
                      const { color: gc, bg: gb, borderColor: gbc, label: gl } = getFileTypeInfo(e.name)
                      return (
                        <div key={`file-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 10, background: '#fff', border: `1px solid ${gbc}`, gap: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '18px 12px 12px', background: gb, gap: 8 }}>
                            <FileText size={40} strokeWidth={1.2} color={gc} />
                            {gl && <span style={{ fontSize: 10, background: gc + '22', color: gc, padding: '2px 8px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.5px' }}>{gl}</span>}
                          </div>
                          <div style={{ width: '100%', padding: '8px 10px', borderTop: `1px solid ${gbc}` }}>
                            <span style={{ fontSize: 11, color: '#444', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>{e.name}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )
    })()}
    </>
  )
}