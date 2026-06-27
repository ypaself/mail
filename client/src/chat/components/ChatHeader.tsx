import { useState, useRef } from 'react'
import {
  Mail, MailOpen, Star, Archive, ArchiveRestore,
  Pin, PinOff, Reply, ReplyAll, Forward, RotateCcw,
  Clock, FolderInput, ZoomIn, Users, AlertTriangle,
  Flag, Eraser, Trash2, VolumeX, Ban, BookOpen,
  MoreVertical, ChevronDown,
} from 'lucide-react'

interface ChatHeaderProps {
  contactName?: string
  isRead?: boolean
  isStarred?: boolean
  isArchived?: boolean
  isPinned?: boolean
  isMuted?: boolean
  zoomLevel?: number
  onToggleRead?: () => void
  onToggleStar?: () => void
  onToggleArchive?: () => void
  onTogglePin?: () => void
  onReply?: () => void
  onReplyAll?: () => void
  onForward?: () => void
  onResend?: () => void
  onSnooze?: () => void
  onMoveTo?: (folder: string) => void
  onAddToGroup?: () => void
  onZoom?: (level: number) => void
  onSpam?: () => void
  onReport?: () => void
  onEmpty?: () => void
  onDelete?: () => void
  onMute?: () => void
  onBlock?: () => void
  onImmersiveReader?: () => void
}

const MOVE_TO_FOLDERS = ['Inbox', 'Starred', 'Archive', 'Drafts', 'Spam', 'Trash']
const ZOOM_LEVELS = [75, 100, 125, 150, 200]

export default function ChatHeader({
  contactName,
  isRead = true,
  isStarred = false,
  isArchived = false,
  isPinned = false,
  isMuted = false,
  zoomLevel = 100,
  onToggleRead,
  onToggleStar,
  onToggleArchive,
  onTogglePin,
  onReply,
  onReplyAll,
  onForward,
  onResend,
  onSnooze,
  onMoveTo,
  onAddToGroup,
  onZoom,
  onSpam,
  onReport,
  onEmpty,
  onDelete,
  onMute,
  onBlock,
  onImmersiveReader,
}: ChatHeaderProps) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const zoomLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleZoomEnter = () => {
    if (zoomLeaveTimer.current) clearTimeout(zoomLeaveTimer.current)
    setZoomOpen(true)
  }
  const handleZoomLeave = () => {
    zoomLeaveTimer.current = setTimeout(() => setZoomOpen(false), 180)
  }

  const closeAll = () => {
    setReplyOpen(false)
    setMoveOpen(false)
    setMoreOpen(false)
  }

  return (
    <div className="chat-header">
      <div className="chat-header-left">
        <h2>Chat</h2>
        {contactName && <span className="chat-header-contact">{contactName}</span>}
      </div>

      <div className="chat-header-actions">
        {/* Read / Unread */}
        <button
          className={`cha-btn${!isRead ? ' cha-btn--active' : ''}`}
          title={isRead ? 'Mark as Unread' : 'Mark as Read'}
          onClick={onToggleRead}
        >
          {isRead ? <MailOpen size={15} /> : <Mail size={15} />}
        </button>

        {/* Star / Unstar */}
        <button
          className={`cha-btn${isStarred ? ' cha-btn--starred' : ''}`}
          title={isStarred ? 'Unstar' : 'Star'}
          onClick={onToggleStar}
        >
          <Star size={15} fill={isStarred ? 'currentColor' : 'none'} />
        </button>

        {/* Archive / Unarchive */}
        <button
          className={`cha-btn${isArchived ? ' cha-btn--active' : ''}`}
          title={isArchived ? 'Unarchive' : 'Archive'}
          onClick={onToggleArchive}
        >
          {isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
        </button>

        {/* Pin / Unpin */}
        <button
          className={`cha-btn${isPinned ? ' cha-btn--pinned' : ''}`}
          title={isPinned ? 'Unpin' : 'Pin'}
          onClick={onTogglePin}
        >
          {isPinned ? <PinOff size={15} /> : <Pin size={15} />}
        </button>

        <span className="cha-divider" />

        {/* Reply group */}
        <div className="cha-dropdown-wrap">
          <button
            className="cha-btn cha-btn--arrow"
            title="Reply"
            onClick={() => { closeAll(); setReplyOpen(v => !v) }}
          >
            <Reply size={15} />
            <ChevronDown size={11} />
          </button>
          {replyOpen && (
            <div className="cha-dropdown" onMouseLeave={() => setReplyOpen(false)}>
              <button className="cha-dd-item" onClick={() => { onReply?.(); setReplyOpen(false) }}>
                <Reply size={13} /> Reply
              </button>
              <button className="cha-dd-item" onClick={() => { onReplyAll?.(); setReplyOpen(false) }}>
                <ReplyAll size={13} /> Reply All
              </button>
              <button className="cha-dd-item" onClick={() => { onForward?.(); setReplyOpen(false) }}>
                <Forward size={13} /> Forward
              </button>
              <button className="cha-dd-item" onClick={() => { onResend?.(); setReplyOpen(false) }}>
                <RotateCcw size={13} /> Resend
              </button>
            </div>
          )}
        </div>

        {/* Snooze */}
        <button className="cha-btn" title="Snooze" onClick={onSnooze}>
          <Clock size={15} />
        </button>

        {/* Move To */}
        <div className="cha-dropdown-wrap">
          <button
            className="cha-btn cha-btn--arrow"
            title="Move To"
            onClick={() => { closeAll(); setMoveOpen(v => !v) }}
          >
            <FolderInput size={15} />
            <ChevronDown size={11} />
          </button>
          {moveOpen && (
            <div className="cha-dropdown" onMouseLeave={() => setMoveOpen(false)}>
              {MOVE_TO_FOLDERS.map(folder => (
                <button
                  key={folder}
                  className="cha-dd-item"
                  onClick={() => { onMoveTo?.(folder); setMoveOpen(false) }}
                >
                  {folder}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zoom — hover-triggered dropdown */}
        <div
          className="cha-dropdown-wrap"
          onMouseEnter={handleZoomEnter}
          onMouseLeave={handleZoomLeave}
        >
          <button className="cha-btn" title={`Zoom (${zoomLevel}%)`}>
            <ZoomIn size={15} />
          </button>
          {zoomOpen && (
            <div className="cha-dropdown cha-dropdown--zoom">
              {ZOOM_LEVELS.map(lvl => (
                <button
                  key={lvl}
                  className={`cha-dd-item${zoomLevel === lvl ? ' cha-dd-item--selected' : ''}`}
                  onClick={() => { onZoom?.(lvl); setZoomOpen(false) }}
                >
                  {lvl}%
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        <button className="cha-btn cha-btn--danger cha-btn--discard" title="Delete" onClick={onDelete}>
          <Trash2 size={13} />
          <span className="cha-btn-label">Discarded</span>
        </button>

        <span className="cha-divider" />

        {/* More */}
        <div className="cha-dropdown-wrap">
          <button
            className="cha-btn"
            title="More options"
            onClick={() => { closeAll(); setMoreOpen(v => !v) }}
          >
            <MoreVertical size={15} />
          </button>
          {moreOpen && (
            <div className="cha-dropdown cha-dropdown--more" onMouseLeave={() => setMoreOpen(false)}>
              <button className="cha-dd-item" onClick={() => { onAddToGroup?.(); setMoreOpen(false) }}>
                <Users size={13} /> Add to Group
              </button>
              <button className="cha-dd-item" onClick={() => { onSpam?.(); setMoreOpen(false) }}>
                <AlertTriangle size={13} /> Spam
              </button>
              <button className="cha-dd-item" onClick={() => { onReport?.(); setMoreOpen(false) }}>
                <Flag size={13} /> Report
              </button>
              <button className="cha-dd-item" onClick={() => { onEmpty?.(); setMoreOpen(false) }}>
                <Eraser size={13} /> Empty
              </button>
              <span className="cha-dd-divider" />
              <button
                className={`cha-dd-item${isMuted ? ' cha-dd-item--active' : ''}`}
                onClick={() => { onMute?.(); setMoreOpen(false) }}
              >
                <VolumeX size={13} /> {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button className="cha-dd-item cha-dd-item--danger" onClick={() => { onBlock?.(); setMoreOpen(false) }}>
                <Ban size={13} /> Block
              </button>
              <span className="cha-dd-divider" />
              <button className="cha-dd-item" onClick={() => { onImmersiveReader?.(); setMoreOpen(false) }}>
                <BookOpen size={13} /> Immersive Reader
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
