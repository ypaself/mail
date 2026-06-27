import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, X, Users, Calendar, MapPin, Camera, Pencil, User, Check, AlertCircle, Loader2, Send, CalendarPlus, UserPlus, LogOut, Settings, ChevronLeft, ChevronRight, Bold, Italic, Underline, Strikethrough, List, ListOrdered, Indent, Outdent, Smile, Paperclip, Link2, Undo2, Redo2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AllMailsPage from './AllMailsPage'

interface Group {
  id: number
  name: string
  color: string
  description?: string | null
  photoUrl?: string | null
  emailLocal?: string | null
  groupEmail?: string
  memberCount: number
  // True for groups someone else owns and added the current user to as a member —
  // mirrors how an Outlook/Google Group shows up in a member's own client.
  isMemberOf?: boolean
  ownerEmail?: string
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
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash) + email.charCodeAt(i)
    hash = hash & hash
  }
  return mixColors(AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length], '#e8e8e8', 0.4)
}

function getAvatarInitials(email: string): string {
  if (!email) return '?'
  const [name, domain] = email.split('@')
  if (!name || !domain) return '??'
  return name.charAt(0).toUpperCase() + domain.charAt(0).toUpperCase()
}

// Day-view calendar layout — minutes-since-midnight mapped 1:1 to pixels (60px per hour).
const DAY_VIEW_PX_PER_MIN = 1
const DAY_VIEW_SNAP_MIN = 5
const DAY_VIEW_MIN_DURATION_MIN = 15

function roundToNextHalfHour(date: Date): Date {
  const d = new Date(date)
  d.setSeconds(0, 0)
  const mins = d.getMinutes()
  d.setMinutes(mins <= 30 ? 30 : 0, 0, 0)
  if (mins > 30) d.setHours(d.getHours() + 1)
  return d
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}

function snapMinutes(minutes: number): number {
  return Math.round(minutes / DAY_VIEW_SNAP_MIN) * DAY_VIEW_SNAP_MIN
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatEventTimeRange(start: Date, end: Date): string {
  return `${start.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric', year: 'numeric' })} ${formatTimeShort(start)} - ${formatTimeShort(end)}`
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

interface Email {
  id: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  isRead?: boolean
  folder?: string
  hasAttachments?: boolean
  isDraft?: boolean
  isArchived?: boolean
  isDeleted?: boolean
  isScheduled?: boolean
  isSnoozed?: boolean
  isReport?: boolean
  label?: string | null
}

interface GroupEvent {
  id: number
  title: string
  description: string | null
  date: string
  endDate?: string | null
  location: string | null
  isOnline?: boolean
  attendees?: string[]
}

type GroupTab = 'emails' | 'events' | 'members'

type EmailFilter = 'all' | 'inbox' | 'sent' | 'schedule' | 'starred' | 'snoozed' | 'draft' | 'archive' | 'report' | 'delete'

const EMAIL_FILTERS: { key: EmailFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'sent', label: 'Sent' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'starred', label: 'Starred' },
  { key: 'snoozed', label: 'Snoozed' },
  { key: 'draft', label: 'Draft' },
  { key: 'archive', label: 'Archive' },
  { key: 'report', label: 'Report' },
  { key: 'delete', label: 'Delete' },
]

interface GroupsPageProps {
  token: string
  onViewEmail: (email: Email) => void
  onReply?: (action: 'reply' | 'replyAll' | 'forward', email: Email) => void
  onRefreshCounts?: () => void
  // Opens the Chat Mail composer pre-filled with these recipients/subject — used so
  // "Compose to group" uses the same rich composer as the rest of the chat mail flow.
  onComposeToGroup?: (to: string[], subject: string, groupLabel: string, groupId: number) => void
}

export default function GroupsPage({ token, onViewEmail, onReply, onRefreshCounts, onComposeToGroup }: GroupsPageProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<string[]>([])
  const [groupEmails, setGroupEmails] = useState<Email[]>([])
  const [groupEvents, setGroupEvents] = useState<GroupEvent[]>([])
  const [activeTab, setActiveTab] = useState<GroupTab>('emails')
  const [emailFilter, setEmailFilter] = useState<EmailFilter>('all')
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'edit' | null>(null)
  const [editGroupId, setEditGroupId] = useState<number | null>(null)
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#9c27b0')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState('#1976d2')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [newGroupPhotoUrl, setNewGroupPhotoUrl] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [newGroupEmailLocal, setNewGroupEmailLocal] = useState('')
  const [emailLocalEditedByUser, setEmailLocalEditedByUser] = useState(false)
  const [emailAvailability, setEmailAvailability] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)
  const addMemberInputRef = useRef<HTMLInputElement>(null)
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emailCheckSeq = useRef(0)
  const [showEventModal, setShowEventModal] = useState(false)
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventStart, setNewEventStart] = useState<Date>(() => roundToNextHalfHour(new Date()))
  const [newEventEnd, setNewEventEnd] = useState<Date>(() => new Date(roundToNextHalfHour(new Date()).getTime() + 30 * 60000))
  const [newEventLocation, setNewEventLocation] = useState('')
  const [newEventDescription, setNewEventDescription] = useState('')
  const [newEventIsOnline, setNewEventIsOnline] = useState(false)
  const [newEventAttendees, setNewEventAttendees] = useState<string[]>([])
  const [eventViewDate, setEventViewDate] = useState<Date>(() => roundToNextHalfHour(new Date()))
  const [eventDrag, setEventDrag] = useState<{ mode: 'move' | 'resize-start' | 'resize-end'; startY: number; origStart: Date; origEnd: Date } | null>(null)
  const eventDescriptionRef = useRef<HTMLDivElement>(null)
  const eventFileInputRef = useRef<HTMLInputElement>(null)
  const eventToolbarScrollRef = useRef<HTMLDivElement>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [eventFormatTab, setEventFormatTab] = useState<'text' | 'lists' | 'insert'>('text')
  const [eventToolbarOverflow, setEventToolbarOverflow] = useState({ left: false, right: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const navigate = useNavigate()

  const colors = ['#1976d2', '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2', '#0097a7', '#c2185b', '#ff6f00', '#00796b', '#1565c0']
  const ownEmail = localStorage.getItem('userEmail') || ''

  const ensureSelfMember = async (groupId: number, currentMembers: string[]) => {
    if (!ownEmail || currentMembers.some(m => m.toLowerCase() === ownEmail.toLowerCase())) return currentMembers
    try {
      await fetch(`http://localhost:5050/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: ownEmail }),
      })
    } catch (err) {
      // Non-critical — the member list just won't include the self row this time.
    }
    return [ownEmail, ...currentMembers]
  }

  useEffect(() => {
    fetchGroups()
  }, [token])

  // Drag-to-move / drag-to-resize for the event day-view block. Pixel deltas map 1:1 to
  // minutes (DAY_VIEW_PX_PER_MIN), snapped to 5-minute increments, with a 15-minute floor.
  useEffect(() => {
    if (!eventDrag) return
    const handleMouseMove = (e: MouseEvent) => {
      const deltaMin = snapMinutes((e.clientY - eventDrag.startY) / DAY_VIEW_PX_PER_MIN)
      if (eventDrag.mode === 'move') {
        setNewEventStart(addMinutes(eventDrag.origStart, deltaMin))
        setNewEventEnd(addMinutes(eventDrag.origEnd, deltaMin))
      } else if (eventDrag.mode === 'resize-start') {
        const maxStart = addMinutes(eventDrag.origEnd, -DAY_VIEW_MIN_DURATION_MIN)
        let next = addMinutes(eventDrag.origStart, deltaMin)
        if (next.getTime() > maxStart.getTime()) next = maxStart
        setNewEventStart(next)
      } else if (eventDrag.mode === 'resize-end') {
        const minEnd = addMinutes(eventDrag.origStart, DAY_VIEW_MIN_DURATION_MIN)
        let next = addMinutes(eventDrag.origEnd, deltaMin)
        if (next.getTime() < minEnd.getTime()) next = minEnd
        setNewEventEnd(next)
      }
    }
    const handleMouseUp = () => setEventDrag(null)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [eventDrag])

  // Re-measure the description toolbar's scroll overflow whenever the modal opens or the
  // active tab's button set changes width (drives the left/right side-scroll toggle arrows).
  useEffect(() => {
    if (!showEventModal) return
    const id = requestAnimationFrame(updateEventToolbarOverflow)
    return () => cancelAnimationFrame(id)
  }, [showEventModal, eventFormatTab])

  const fetchGroups = async () => {
    setLoading(true)
    setError('')
    try {
      const [ownedRes, memberOfRes] = await Promise.all([
        fetch('http://localhost:5050/api/groups', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5050/api/groups/member-of', { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (ownedRes.ok) {
        const ownedData = await ownedRes.json()
        const memberOfData = memberOfRes.ok ? await memberOfRes.json() : { groups: [] }
        const allGroups: Group[] = [
          ...ownedData.groups,
          ...memberOfData.groups.map((g: Group) => ({ ...g, isMemberOf: true })),
        ]
        setGroups(allGroups)
        if (allGroups.length > 0) {
          handleSelectGroup(allGroups[0])
        }
      } else {
        setError('Failed to fetch groups')
      }
    } catch (err) {
      setError('Failed to fetch groups')
    } finally {
      setLoading(false)
    }
  }

  const slugifyGroupName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'group'

  const checkEmailAvailability = (local: string, excludeId: number | null) => {
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current)
    emailCheckSeq.current += 1
    const seq = emailCheckSeq.current
    if (!local || local.length < 3) {
      setEmailAvailability('invalid')
      return
    }
    setEmailAvailability('checking')
    emailCheckTimer.current = setTimeout(async () => {
      try {
        const url = `http://localhost:5050/api/groups/check-email?local=${encodeURIComponent(local)}${excludeId ? `&excludeId=${excludeId}` : ''}`
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        const data = await response.json()
        // Ignore this result if a newer check has started since (avoids a slower, stale
        // request resolving after a faster, more recent one and overwriting its result).
        if (seq !== emailCheckSeq.current) return
        setEmailAvailability(response.ok && data.available ? 'available' : 'taken')
      } catch (err) {
        if (seq !== emailCheckSeq.current) return
        setEmailAvailability('idle')
      }
    }, 400)
  }

  const handleGroupNameChange = (value: string) => {
    setNewGroupName(value)
    if (!emailLocalEditedByUser) {
      const suggested = slugifyGroupName(value)
      setNewGroupEmailLocal(suggested)
      checkEmailAvailability(suggested, editGroupId)
    }
  }

  const handleGroupEmailLocalChange = (value: string) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 50)
    setEmailLocalEditedByUser(true)
    setNewGroupEmailLocal(normalized)
    checkEmailAvailability(normalized, editGroupId)
  }

  const resetGroupModalFields = () => {
    setNewGroupName('')
    setNewGroupColor('#1976d2')
    setNewGroupDescription('')
    setNewGroupPhotoUrl(null)
    setNewGroupEmailLocal('')
    setEmailLocalEditedByUser(false)
    setEmailAvailability('idle')
  }

  const handleOpenCreateModal = () => {
    resetGroupModalFields()
    setEditGroupId(null)
    setGroupModalMode('create')
  }

  const handleOpenEditModal = (group: Group) => {
    setEditGroupId(group.id)
    setNewGroupName(group.name)
    setNewGroupColor(group.color)
    setNewGroupDescription(group.description || '')
    setNewGroupPhotoUrl(group.photoUrl || null)
    const existingLocal = group.emailLocal || slugifyGroupName(group.name)
    setNewGroupEmailLocal(existingLocal)
    setEmailLocalEditedByUser(true)
    setEmailAvailability('available')
    setGroupModalMode('edit')
  }

  const handleCloseGroupModal = () => {
    setGroupModalMode(null)
    setEditGroupId(null)
    resetGroupModalFields()
  }

  const handlePhotoUpload = async (file: File) => {
    setPhotoUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('http://localhost:5050/api/attachments/upload', {
        method: 'POST',
        body: formData,
      })
      if (response.ok) {
        const data = await response.json()
        setNewGroupPhotoUrl(data.url)
      } else {
        setError('Failed to upload photo')
      }
    } catch (err) {
      setError('Failed to upload photo')
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setError('Group name is required')
      return
    }
    if (emailAvailability === 'taken') {
      setError('Group email address is already taken')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5050/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newGroupName, color: newGroupColor, description: newGroupDescription, photoUrl: newGroupPhotoUrl, emailLocal: newGroupEmailLocal }),
      })
      if (response.ok) {
        const data = await response.json()
        await ensureSelfMember(data.group.id, [])
        setGroups([...groups, { ...data.group, memberCount: ownEmail ? 1 : 0 }])
        handleCloseGroupModal()
        setToast('Group created successfully')
        setTimeout(() => setToast(null), 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create group')
      }
    } catch (err) {
      setError('Failed to create group')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateGroup = async () => {
    if (!editGroupId || !newGroupName.trim()) {
      setError('Group name is required')
      return
    }
    if (emailAvailability === 'taken') {
      setError('Group email address is already taken')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`http://localhost:5050/api/groups/${editGroupId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newGroupName, color: newGroupColor, description: newGroupDescription, photoUrl: newGroupPhotoUrl, emailLocal: newGroupEmailLocal }),
      })
      if (response.ok) {
        const data = await response.json()
        setGroups(groups.map(g => g.id === editGroupId ? { ...g, ...data.group } : g))
        setSelectedGroup(prev => prev && prev.id === editGroupId ? { ...prev, ...data.group } : prev)
        handleCloseGroupModal()
        setToast('Group updated successfully')
        setTimeout(() => setToast(null), 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update group')
      }
    } catch (err) {
      setError('Failed to update group')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Are you sure you want to delete this group?')) return
    setLoading(true)
    try {
      const response = await fetch(`http://localhost:5050/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        setGroups(groups.filter(g => g.id !== groupId))
        if (selectedGroup?.id === groupId) {
          setSelectedGroup(null)
          setMembers([])
          setGroupEmails([])
          setGroupEvents([])
        }
        handleCloseGroupModal()
        setToast('Group deleted')
        setTimeout(() => setToast(null), 3000)
      } else {
        setError('Failed to delete group')
      }
    } catch (err) {
      setError('Failed to delete group')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectGroup = async (group: Group) => {
    setSelectedGroup(group)
    setActiveTab('emails')
    setEmailFilter('all')
    setLoading(true)
    try {
      const [membersRes, emailsRes, eventsRes] = await Promise.all([
        fetch(`http://localhost:5050/api/groups/${group.id}/members`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:5050/api/groups/${group.id}/emails?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:5050/api/groups/${group.id}/events`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      if (membersRes.ok) {
        const data = await membersRes.json()
        setMembers(await ensureSelfMember(group.id, data.members))
      }

      if (emailsRes.ok) {
        const data = await emailsRes.json()
        setGroupEmails(data.emails)
      }

      if (eventsRes.ok) {
        const data = await eventsRes.json()
        setGroupEvents(data.events)
      }
    } catch (err) {
      setError('Failed to load group details')
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async () => {
    if (!newMemberEmail.trim() || !selectedGroup) return
    setLoading(true)
    try {
      const response = await fetch(`http://localhost:5050/api/groups/${selectedGroup.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: newMemberEmail }),
      })
      if (response.ok) {
        setMembers([...members, newMemberEmail])
        setNewMemberEmail('')
        setToast('Member added')
        setTimeout(() => setToast(null), 3000)
      } else {
        setError('Failed to add member')
      }
    } catch (err) {
      setError('Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (email: string) => {
    if (!selectedGroup) return
    setLoading(true)
    try {
      const response = await fetch(`http://localhost:5050/api/groups/${selectedGroup.id}/members/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        setMembers(members.filter(m => m !== email))
        setToast('Member removed')
        setTimeout(() => setToast(null), 3000)
      } else {
        setError('Failed to remove member')
      }
    } catch (err) {
      setError('Failed to remove member')
    } finally {
      setLoading(false)
    }
  }

  const handleLeaveGroup = async (group: Group) => {
    if (!ownEmail) return
    if (!confirm(`Leave "${group.name}"? You'll stop seeing this group and its emails.`)) return
    setLoading(true)
    try {
      const response = await fetch(`http://localhost:5050/api/groups/${group.id}/members/${encodeURIComponent(ownEmail)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        setGroups(groups.filter(g => g.id !== group.id))
        if (selectedGroup?.id === group.id) {
          setSelectedGroup(null)
          setMembers([])
          setGroupEmails([])
          setGroupEvents([])
        }
        setToast('You left the group')
        setTimeout(() => setToast(null), 3000)
      } else {
        setError('Failed to leave group')
      }
    } catch (err) {
      setError('Failed to leave group')
    } finally {
      setLoading(false)
    }
  }

  const resetEventModalFields = () => {
    const start = roundToNextHalfHour(new Date())
    setNewEventTitle('')
    setNewEventStart(start)
    setNewEventEnd(addMinutes(start, 30))
    setNewEventLocation('')
    setNewEventDescription('')
    setNewEventIsOnline(false)
    setNewEventAttendees([])
    setEventViewDate(start)
    setShowEmojiPicker(false)
    setEventFormatTab('text')
    if (eventDescriptionRef.current) eventDescriptionRef.current.innerHTML = ''
  }

  const handleOpenEventModal = () => {
    resetEventModalFields()
    setShowEventModal(true)
  }

  const execDescriptionCommand = (command: string, value?: string) => {
    eventDescriptionRef.current?.focus()
    document.execCommand(command, false, value)
    setNewEventDescription(eventDescriptionRef.current?.innerHTML || '')
  }

  const insertEmoji = (emoji: string) => {
    eventDescriptionRef.current?.focus()
    document.execCommand('insertText', false, emoji)
    setNewEventDescription(eventDescriptionRef.current?.innerHTML || '')
    setShowEmojiPicker(false)
  }

  const handleEventFileAttach = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('http://localhost:5050/api/attachments/upload', { method: 'POST', body: formData })
      if (response.ok) {
        const data = await response.json()
        eventDescriptionRef.current?.focus()
        document.execCommand('insertHTML', false, `<a href="http://localhost:5050${data.url}" target="_blank" rel="noopener noreferrer">📎 ${data.name}</a>&nbsp;`)
        setNewEventDescription(eventDescriptionRef.current?.innerHTML || '')
      } else {
        setError('Failed to upload attachment')
      }
    } catch (err) {
      setError('Failed to upload attachment')
    }
  }

  const handleInsertLink = () => {
    const url = window.prompt('Enter a URL')
    if (!url) return
    eventDescriptionRef.current?.focus()
    document.execCommand('createLink', false, url)
    setNewEventDescription(eventDescriptionRef.current?.innerHTML || '')
  }

  const updateEventToolbarOverflow = () => {
    const el = eventToolbarScrollRef.current
    if (!el) return
    setEventToolbarOverflow({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    })
  }

  const scrollEventToolbar = (dir: -1 | 1) => {
    eventToolbarScrollRef.current?.scrollBy({ left: dir * 120, behavior: 'smooth' })
  }

  const handleCreateEvent = async () => {
    if (!newEventTitle.trim() || !selectedGroup) {
      setError('Event title is required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`http://localhost:5050/api/groups/${selectedGroup.id}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newEventTitle,
          date: newEventStart.toISOString(),
          endDate: newEventEnd.toISOString(),
          location: newEventLocation,
          description: newEventDescription,
          isOnline: newEventIsOnline,
          attendees: newEventAttendees,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setGroupEvents([...groupEvents, data.event].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
        resetEventModalFields()
        setShowEventModal(false)
        setToast('Event created')
        setTimeout(() => setToast(null), 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create event')
      }
    } catch (err) {
      setError('Failed to create event')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEvent = async (eventId: number) => {
    if (!selectedGroup) return
    if (!confirm('Delete this event?')) return
    setLoading(true)
    try {
      const response = await fetch(`http://localhost:5050/api/groups/${selectedGroup.id}/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        setGroupEvents(groupEvents.filter(e => e.id !== eventId))
        setToast('Event deleted')
        setTimeout(() => setToast(null), 3000)
      } else {
        setError('Failed to delete event')
      }
    } catch (err) {
      setError('Failed to delete event')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) {
      setError('Label name is required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5050/api/custom-labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newLabelName, color: newLabelColor }),
      })
      if (response.ok) {
        setNewLabelName('')
        setNewLabelColor('#9c27b0')
        setShowLabelModal(false)
        setToast('Label created successfully')
        setTimeout(() => setToast(null), 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create label')
      }
    } catch (err) {
      setError('Failed to create label')
    } finally {
      setLoading(false)
    }
  }

  const handleComposeToGroup = () => {
    const subject = `To ${selectedGroup?.name}`
    if (onComposeToGroup && selectedGroup) {
      onComposeToGroup(members, subject, selectedGroup.name, selectedGroup.id)
    } else {
      navigate('/compose', { state: { to: members.join(', '), subject } })
    }
  }

  return (
    <div className="groups-page">
      {toast && <div className="toast-notification">{toast}</div>}

      {error && <div className="error-message">{error}</div>}

      <div className="groups-split">
        <div className="groups-sidebar">
          <div className="groups-header">
            <h2>Groups</h2>
            <button className="new-group-btn" onClick={handleOpenCreateModal} title="Create new group">
              <Plus size={20} />
            </button>
          </div>

          {groups.length === 0 ? (
            <div className="groups-empty">
              <Users size={48} />
              <p>No groups yet</p>
              <button className="btn-primary" onClick={handleOpenCreateModal}>Create your first group</button>
            </div>
          ) : (
            <div className="groups-list">
              {groups.map(group => (
                <div
                  key={group.id}
                  className={`group-card ${selectedGroup?.id === group.id ? 'selected' : ''}`}
                  onClick={() => handleSelectGroup(group)}
                >
                  <div className="group-avatar" style={{ backgroundColor: group.color }}>
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="group-info">
                    <div className="group-name">{group.name}</div>
                    <div className="group-member-count">
                      {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                      {group.isMemberOf && <span className="group-member-badge">Member</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="groups-main">
          {!selectedGroup ? (
            <div className="groups-main-empty">
              <Users size={48} />
              <p>Select a group to view its emails</p>
            </div>
          ) : (
            <div className="group-detail-view">
              <div className="group-detail-header">
                <div className="group-detail-title">
                  {selectedGroup.photoUrl ? (
                    <img className="group-avatar-small group-avatar-photo" src={`http://localhost:5050${selectedGroup.photoUrl}`} alt="" />
                  ) : (
                    <div className="group-avatar-small" style={{ backgroundColor: selectedGroup.color }}>
                      {selectedGroup.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="group-detail-title-text">
                    <h2>{selectedGroup.name}</h2>
                    <span className="group-detail-member-count">
                      {members.length} member{members.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {selectedGroup.isMemberOf && (
                    <span className="group-member-badge group-member-badge-inline">Member</span>
                  )}
                </div>
                <div className="group-detail-header-actions">
                  <button className="group-header-action" onClick={handleComposeToGroup} title="Send email to group">
                    <span className="group-header-icon-btn"><Send size={17} /></span>
                    <span className="group-header-action-label">Send</span>
                  </button>
                  {!selectedGroup.isMemberOf && (
                    <>
                      <button
                        className="group-header-action"
                        onClick={() => { setActiveTab('events'); handleOpenEventModal() }}
                        title="Create event"
                      >
                        <span className="group-header-icon-btn"><CalendarPlus size={17} /></span>
                        <span className="group-header-action-label">Event</span>
                      </button>
                      <button
                        className="group-header-action"
                        onClick={() => { setActiveTab('members'); requestAnimationFrame(() => addMemberInputRef.current?.focus()) }}
                        title="Add members"
                      >
                        <span className="group-header-icon-btn"><UserPlus size={17} /></span>
                        <span className="group-header-action-label">Add</span>
                      </button>
                      <button className="group-header-action" onClick={() => handleOpenEditModal(selectedGroup)} title="Edit group">
                        <span className="group-header-icon-btn"><Pencil size={17} /></span>
                        <span className="group-header-action-label">Edit</span>
                      </button>
                      <button className="group-header-action" onClick={() => handleOpenEditModal(selectedGroup)} title="Group settings">
                        <span className="group-header-icon-btn"><Settings size={17} /></span>
                        <span className="group-header-action-label">Settings</span>
                      </button>
                    </>
                  )}
                  {selectedGroup.isMemberOf && (
                    <button className="group-header-action" onClick={() => handleLeaveGroup(selectedGroup)} title="Leave group">
                      <span className="group-header-icon-btn"><LogOut size={17} /></span>
                      <span className="group-header-action-label">Leave</span>
                    </button>
                  )}
                </div>
              </div>
              {selectedGroup.isMemberOf && selectedGroup.ownerEmail && (
                <p className="group-detail-description">Owned by {selectedGroup.ownerEmail}</p>
              )}

              {selectedGroup.description && <p className="group-detail-description">{selectedGroup.description}</p>}

              <div className="group-tabs">
                <button className={`group-tab ${activeTab === 'emails' ? 'active' : ''}`} onClick={() => setActiveTab('emails')}>
                  Emails ({groupEmails.length})
                </button>
                <button className={`group-tab ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>
                  Events ({groupEvents.length})
                </button>
                <button className={`group-tab ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>
                  Members ({members.length})
                </button>
              </div>

              {activeTab === 'members' && (
                <div className="members-section">
                  {members.length === 0 ? (
                    <p className="empty-text">No members yet</p>
                  ) : (
                    <div className="members-list">
                      <div className="member-row member-row-header">
                        <span className="member-name-col">Name/Email</span>
                        <span className="member-role-col">Role</span>
                        <span className="member-action-col" />
                      </div>
                      {members.map(member => {
                        const isSelf = !!ownEmail && member.toLowerCase() === ownEmail.toLowerCase()
                        const isRowOwner = selectedGroup.isMemberOf
                          ? member.toLowerCase() === (selectedGroup.ownerEmail || '').toLowerCase()
                          : isSelf
                        const canRemove = !isSelf && !selectedGroup.isMemberOf
                        const [namePart, domainPart] = member.split('@')
                        return (
                          <div key={member} className="member-row">
                            <span className="member-name-col">
                              <span className="member-avatar" style={{ backgroundColor: getAvatarColor(member) }}>
                                {getAvatarInitials(member)}
                              </span>
                              <span className="member-email-text">
                                <span className="member-email-name">{namePart}</span>
                                {domainPart && <span className="member-email-domain">@{domainPart}</span>}
                              </span>
                              {isSelf && <span className="member-self-tag"> (you)</span>}
                            </span>
                            <span className="member-role-col">{isRowOwner ? 'Owner' : 'Member'}</span>
                            <span className="member-action-col">
                              {canRemove && (
                                <button
                                  className="remove-member-btn"
                                  onClick={() => handleRemoveMember(member)}
                                  title="Remove member"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {!selectedGroup.isMemberOf && (
                    <div className="add-member-row">
                      <input
                        ref={addMemberInputRef}
                        type="email"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        placeholder="Add member email"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
                      />
                      <button className="btn-secondary" onClick={handleAddMember} disabled={loading || !newMemberEmail.trim()}>
                        Add
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'events' && (
                <div className="group-events-section">
                  {!selectedGroup.isMemberOf && (
                    <div className="section-header-row">
                      <button className="btn-secondary" onClick={handleOpenEventModal}>
                        <Plus size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                        New event
                      </button>
                    </div>
                  )}
                  {groupEvents.length === 0 ? (
                    <p className="empty-text">No events scheduled yet</p>
                  ) : (
                    <div className="events-list">
                      {groupEvents.map(event => (
                        <div key={event.id} className="event-card">
                          <div className="event-card-main">
                            <div className="event-title">{event.title}</div>
                            <div className="event-meta">
                              <span>
                                <Calendar size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                {event.endDate
                                  ? formatEventTimeRange(new Date(event.date), new Date(event.endDate))
                                  : new Date(event.date).toLocaleString()}
                              </span>
                              {event.isOnline && <span className="event-online-badge">Online</span>}
                              {event.location && <span><MapPin size={13} style={{ verticalAlign: 'middle', margin: '0 4px 0 12px' }} />{event.location}</span>}
                            </div>
                            {!!event.attendees?.length && (
                              <div className="event-attendees">
                                <Users size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                {event.attendees.join(', ')}
                              </div>
                            )}
                            {event.description && <div className="event-description" dangerouslySetInnerHTML={{ __html: event.description }} />}
                          </div>
                          {!selectedGroup.isMemberOf && (
                            <button
                              className="delete-group-btn"
                              onClick={() => handleDeleteEvent(event.id)}
                              title="Delete event"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'emails' && (
                <div className="group-emails-section">
                  <div className="email-filter-bar">
                    {EMAIL_FILTERS.map(f => (
                      <button
                        key={f.key}
                        className={`email-filter-btn ${emailFilter === f.key ? 'active' : ''}`}
                        onClick={() => setEmailFilter(f.key)}
                      >
                        {f.label}
                      </button>
                    ))}
                    <button className="email-filter-btn new-label-btn" onClick={() => setShowLabelModal(true)}>
                      <Plus size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      New label
                    </button>
                  </div>
                  <div className="group-email-list-wrap">
                    <AllMailsPage
                      token={token}
                      onViewEmail={onViewEmail}
                      onReply={onReply}
                      onRefreshCounts={onRefreshCounts}
                      type="group"
                      groupId={selectedGroup.id}
                      groupFilter={emailFilter}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {groupModalMode && (
        <div className="create-group-modal-overlay" onClick={handleCloseGroupModal}>
          <div className="edit-group-modal" onClick={(e) => e.stopPropagation()}>
            <button className="edit-group-modal-close" onClick={handleCloseGroupModal} title="Close">
              <X size={20} />
            </button>
            <div className="edit-group-modal-body">
              <div className="edit-group-modal-left">
                <h2>{groupModalMode === 'edit' ? 'Edit group' : 'Create group'}</h2>
                <p>You can add a group photo or change the group name or description.</p>
                <div className="edit-group-illustration">
                  <Users size={120} strokeWidth={1} />
                </div>
              </div>
              <div className="edit-group-modal-right">
                <div className="edit-group-modal-form-scroll">
                <div className="edit-group-modal-form">
                  <div className="edit-group-photo-row">
                    <div className="edit-group-photo-wrapper">
                      {newGroupPhotoUrl ? (
                        <img className="edit-group-photo" src={`http://localhost:5050${newGroupPhotoUrl}`} alt="" />
                      ) : (
                        <div className="edit-group-photo edit-group-photo-placeholder" style={{ backgroundColor: newGroupColor }}>
                          <User size={48} color="white" strokeWidth={1.5} />
                        </div>
                      )}
                      <button
                        type="button"
                        className="edit-group-photo-btn"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={photoUploading}
                        title="Add group photo"
                      >
                        <Camera size={16} />
                      </button>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handlePhotoUpload(file)
                          e.target.value = ''
                        }}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Group name</label>
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => handleGroupNameChange(e.target.value)}
                        placeholder="e.g., Team Alpha, Family"
                        maxLength={100}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Color</label>
                    <div className="color-picker-row">
                      {colors.map(color => (
                        <button
                          key={color}
                          className={`color-swatch ${newGroupColor === color ? 'selected' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewGroupColor(color)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Group email address</label>
                    <div className={`group-email-edit-row ${emailAvailability === 'taken' ? 'has-error' : ''}`}>
                      <input
                        type="text"
                        className="group-email-local-input"
                        value={newGroupEmailLocal}
                        onChange={(e) => handleGroupEmailLocalChange(e.target.value)}
                        maxLength={50}
                      />
                      <span className="group-email-domain">@groups.local</span>
                      <span className="group-email-status">
                        {emailAvailability === 'checking' && <Loader2 size={15} className="spin" style={{ color: '#999' }} />}
                        {emailAvailability === 'available' && <Check size={16} style={{ color: '#2e7d32' }} />}
                        {emailAvailability === 'taken' && <AlertCircle size={16} style={{ color: '#d32f2f' }} />}
                      </span>
                    </div>
                    {emailAvailability === 'taken' && <p className="group-email-hint error">This email address is already taken</p>}
                    {emailAvailability === 'available' && <p className="group-email-hint success">This email address is available</p>}
                    {emailAvailability === 'invalid' && <p className="group-email-hint">Must be at least 3 characters</p>}
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      className="edit-group-description-input"
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                      placeholder="Optional"
                      rows={4}
                    />
                  </div>
                </div>
                </div>

                <div className="edit-group-modal-actions">
                  <button className="btn-primary" onClick={groupModalMode === 'edit' ? handleUpdateGroup : handleCreateGroup} disabled={loading || emailAvailability === 'taken'}>
                    Save
                  </button>
                  <button className="btn-secondary" onClick={handleCloseGroupModal}>Discard</button>
                  {groupModalMode === 'edit' && editGroupId && (
                    <button className="delete-group-link" onClick={() => handleDeleteGroup(editGroupId)}>
                      <Trash2 size={16} />
                      Delete group
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEventModal && (
        <div className="event-modal-overlay" onClick={() => setShowEventModal(false)}>
          <div className="event-modal" onClick={(e) => e.stopPropagation()}>
            <div className="event-modal-toolbar">
              <button className="btn-primary event-save-btn" onClick={handleCreateEvent} disabled={loading || !newEventTitle.trim()}>
                <Check size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Save
              </button>
              <button className="event-modal-close" onClick={() => setShowEventModal(false)} title="Close">
                <X size={20} />
              </button>
            </div>
            <div className="event-modal-body">
              <div className="event-modal-left">
                <div className="event-organizer-row">
                  <div className="event-organizer-dot" style={{ backgroundColor: selectedGroup?.color }} />
                  <span>{selectedGroup?.name}</span>
                </div>

                <input
                  className="event-title-input"
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Add title"
                  maxLength={255}
                  autoFocus
                />

                <div className="event-field-row">
                  <UserPlus size={17} className="event-field-icon" />
                  <div className="event-attendees-picker">
                    {members.length === 0 ? (
                      <span className="event-field-placeholder">No members to invite yet</span>
                    ) : (
                      <div className="event-attendees-chips">
                        {members.map(m => {
                          const checked = newEventAttendees.includes(m)
                          return (
                            <button
                              key={m}
                              type="button"
                              className={`event-attendee-chip ${checked ? 'selected' : ''}`}
                              onClick={() => setNewEventAttendees(checked ? newEventAttendees.filter(x => x !== m) : [...newEventAttendees, m])}
                            >
                              {checked && <Check size={12} style={{ marginRight: '4px' }} />}
                              {m}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="event-field-row">
                  <Calendar size={17} className="event-field-icon" />
                  <div className="event-datetime-inputs">
                    <input
                      type="datetime-local"
                      value={toDatetimeLocalValue(newEventStart)}
                      onChange={(e) => {
                        const start = new Date(e.target.value)
                        if (isNaN(start.getTime())) return
                        const duration = newEventEnd.getTime() - newEventStart.getTime()
                        setNewEventStart(start)
                        setNewEventEnd(new Date(start.getTime() + Math.max(duration, DAY_VIEW_MIN_DURATION_MIN * 60000)))
                        setEventViewDate(start)
                      }}
                    />
                    <span className="event-datetime-sep">to</span>
                    <input
                      type="datetime-local"
                      value={toDatetimeLocalValue(newEventEnd)}
                      onChange={(e) => {
                        const end = new Date(e.target.value)
                        if (isNaN(end.getTime())) return
                        if (end.getTime() <= newEventStart.getTime()) return
                        setNewEventEnd(end)
                      }}
                    />
                  </div>
                </div>

                <div className="event-field-row">
                  <MapPin size={17} className="event-field-icon" />
                  <input
                    className="event-plain-input"
                    type="text"
                    value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    placeholder="Search for a location"
                    maxLength={255}
                  />
                </div>

                <div className="event-field-row">
                  <Calendar size={17} className="event-field-icon" />
                  <label className="event-toggle-row">
                    <span
                      className={`event-toggle-switch ${newEventIsOnline ? 'on' : ''}`}
                      onClick={() => setNewEventIsOnline(!newEventIsOnline)}
                    >
                      <span className="event-toggle-knob" />
                    </span>
                    <span>Online meeting</span>
                  </label>
                </div>

                <div className="event-description-wrap">
                  <div
                    ref={eventDescriptionRef}
                    className="event-description-input event-description-editable"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => setNewEventDescription(eventDescriptionRef.current?.innerHTML || '')}
                    data-placeholder="Add a description"
                  />

                  <div className="event-format-toolbar">
                    <div className="event-format-tabbar">
                      <button type="button" className="event-format-undoredo" onMouseDown={(e) => e.preventDefault()} onClick={() => execDescriptionCommand('undo')} title="Undo">
                        <Undo2 size={15} />
                      </button>
                      <button type="button" className="event-format-undoredo" onMouseDown={(e) => e.preventDefault()} onClick={() => execDescriptionCommand('redo')} title="Redo">
                        <Redo2 size={15} />
                      </button>
                      {([
                        { id: 'text' as const, title: 'Text', icon: <Bold size={13} /> },
                        { id: 'lists' as const, title: 'Lists', icon: <List size={13} /> },
                        { id: 'insert' as const, title: 'Insert', icon: <Paperclip size={13} /> },
                      ]).map(({ id, title, icon }) => (
                        <button
                          key={id}
                          type="button"
                          className={`event-format-tab ${eventFormatTab === id ? 'active' : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setEventFormatTab(id)}
                        >
                          {icon}{title}
                        </button>
                      ))}
                    </div>

                    <div className="event-format-content">
                      {eventToolbarOverflow.left && (
                        <button type="button" className="event-toolbar-scroll-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => scrollEventToolbar(-1)} title="Scroll left">
                          <ChevronLeft size={14} />
                        </button>
                      )}
                      <div className="event-format-scroll" ref={eventToolbarScrollRef} onScroll={updateEventToolbarOverflow}>
                        {eventFormatTab === 'text' && (
                          <>
                            <button type="button" className="event-toolbar-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => execDescriptionCommand('bold')} title="Bold">
                              <Bold size={15} />
                            </button>
                            <button type="button" className="event-toolbar-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => execDescriptionCommand('italic')} title="Italic">
                              <Italic size={15} />
                            </button>
                            <button type="button" className="event-toolbar-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => execDescriptionCommand('underline')} title="Underline">
                              <Underline size={15} />
                            </button>
                            <button type="button" className="event-toolbar-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => execDescriptionCommand('strikeThrough')} title="Strikethrough">
                              <Strikethrough size={15} />
                            </button>
                          </>
                        )}
                        {eventFormatTab === 'lists' && (
                          <>
                            <button type="button" className="event-toolbar-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => execDescriptionCommand('insertUnorderedList')} title="Bulleted list">
                              <List size={15} />
                            </button>
                            <button type="button" className="event-toolbar-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => execDescriptionCommand('insertOrderedList')} title="Numbered list">
                              <ListOrdered size={15} />
                            </button>
                            <button type="button" className="event-toolbar-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => execDescriptionCommand('indent')} title="Indent">
                              <Indent size={15} />
                            </button>
                            <button type="button" className="event-toolbar-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => execDescriptionCommand('outdent')} title="Outdent">
                              <Outdent size={15} />
                            </button>
                          </>
                        )}
                        {eventFormatTab === 'insert' && (
                          <>
                            <button type="button" className="event-toolbar-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => eventFileInputRef.current?.click()} title="Attach file">
                              <Paperclip size={15} />
                            </button>
                            <button type="button" className="event-toolbar-btn" onMouseDown={(e) => e.preventDefault()} onClick={handleInsertLink} title="Insert link">
                              <Link2 size={15} />
                            </button>
                            <div className="event-emoji-wrap">
                              <button type="button" className="event-toolbar-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Insert emoji">
                                <Smile size={15} />
                              </button>
                              {showEmojiPicker && (
                                <div className="event-emoji-picker">
                                  {['😀','😂','👍','🎉','❤️','📅','✅','🙌','☕','📌'].map(emoji => (
                                    <button type="button" key={emoji} className="event-emoji-option" onMouseDown={(e) => e.preventDefault()} onClick={() => insertEmoji(emoji)}>
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <input
                              ref={eventFileInputRef}
                              type="file"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleEventFileAttach(file)
                                e.target.value = ''
                              }}
                            />
                          </>
                        )}
                      </div>
                      {eventToolbarOverflow.right && (
                        <button type="button" className="event-toolbar-scroll-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => scrollEventToolbar(1)} title="Scroll right">
                          <ChevronRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="event-modal-right">
                <div className="event-day-nav">
                  <button className="group-header-icon-btn" onClick={() => setEventViewDate(addMinutes(eventViewDate, -1440))} title="Previous day">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="event-day-label">{formatDayLabel(eventViewDate)}</span>
                  <button className="group-header-icon-btn" onClick={() => setEventViewDate(addMinutes(eventViewDate, 1440))} title="Next day">
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="event-day-grid-wrap">
                  <div className="event-day-grid" style={{ height: 24 * 60 * DAY_VIEW_PX_PER_MIN }}>
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div key={hour} className="event-day-hour-row" style={{ top: hour * 60 * DAY_VIEW_PX_PER_MIN }}>
                        <span className="event-day-hour-label">
                          {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                        </span>
                      </div>
                    ))}

                    {groupEvents.filter(ev => sameDay(new Date(ev.date), eventViewDate)).map(ev => {
                      const evStart = new Date(ev.date)
                      const evEnd = ev.endDate ? new Date(ev.endDate) : addMinutes(evStart, 30)
                      const top = minutesSinceMidnight(evStart) * DAY_VIEW_PX_PER_MIN
                      const height = Math.max((minutesSinceMidnight(evEnd) - minutesSinceMidnight(evStart)) * DAY_VIEW_PX_PER_MIN, 16)
                      return (
                        <div key={ev.id} className="event-day-block event-day-block-existing" style={{ top, height }} title={ev.title}>
                          {ev.title}
                        </div>
                      )
                    })}

                    {sameDay(newEventStart, eventViewDate) && (() => {
                      const top = minutesSinceMidnight(newEventStart) * DAY_VIEW_PX_PER_MIN
                      const height = Math.max((minutesSinceMidnight(newEventEnd) - minutesSinceMidnight(newEventStart)) * DAY_VIEW_PX_PER_MIN, 16)
                      return (
                        <div
                          className="event-day-block event-day-block-active"
                          style={{ top, height, backgroundColor: selectedGroup?.color }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setEventDrag({ mode: 'move', startY: e.clientY, origStart: newEventStart, origEnd: newEventEnd })
                          }}
                        >
                          <div
                            className="event-day-handle event-day-handle-top"
                            onMouseDown={(e) => {
                              e.preventDefault(); e.stopPropagation()
                              setEventDrag({ mode: 'resize-start', startY: e.clientY, origStart: newEventStart, origEnd: newEventEnd })
                            }}
                          />
                          <span className="event-day-block-label">{formatTimeShort(newEventStart)} - {formatTimeShort(newEventEnd)}</span>
                          <div
                            className="event-day-handle event-day-handle-bottom"
                            onMouseDown={(e) => {
                              e.preventDefault(); e.stopPropagation()
                              setEventDrag({ mode: 'resize-end', startY: e.clientY, origStart: newEventStart, origEnd: newEventEnd })
                            }}
                          />
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLabelModal && (
        <div className="create-group-modal-overlay" onClick={() => setShowLabelModal(false)}>
          <div className="create-group-modal" onClick={(e) => e.stopPropagation()}>
            <div className="groups-header">
              <h2>New Label</h2>
            </div>
            <div className="create-group-form">
              <div className="form-group">
                <label>Label Name</label>
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="e.g., Urgent, Follow-up"
                  maxLength={50}
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateLabel()}
                />
              </div>
              <div className="form-group">
                <label>Color</label>
                <div className="color-picker-row">
                  {colors.map(color => (
                    <button
                      key={color}
                      className={`color-swatch ${newLabelColor === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewLabelColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="form-actions">
                <button className="btn-secondary" onClick={() => setShowLabelModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleCreateLabel} disabled={loading}>
                  Create Label
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
