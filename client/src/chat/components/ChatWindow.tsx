import { useState, useEffect, useRef, useCallback } from 'react'
import { Send } from 'lucide-react'

interface Message {
  id: number
  content: string
  timestamp: string
  incoming: boolean
  isUnread: boolean
  emailId?: number
}

interface Props {
  messages: Message[]
  inputValue: string
  onInputChange: (value: string) => void
  onSendMessage: () => void
  onKeyPress: (e: React.KeyboardEvent) => void
  onMarkAsRead?: () => void
  conversationId: number
  zoomLevel?: number
}

export default function ChatWindow({
  messages,
  inputValue,
  onInputChange,
  onSendMessage,
  onKeyPress,
  onMarkAsRead,
  conversationId,
  zoomLevel = 100,
}: Props) {
  const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null)
  const [hasSeen, setHasSeen] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const hasCalledRef = useRef(false)
  const onMarkAsReadRef = useRef(onMarkAsRead)
  onMarkAsReadRef.current = onMarkAsRead

  const markAsSeen = useCallback(() => {
    setHasSeen(true)
    if (!hasCalledRef.current) {
      hasCalledRef.current = true
      onMarkAsReadRef.current?.()
    }
  }, [])

  useEffect(() => {
    setHasSeen(false)
    hasCalledRef.current = false
  }, [conversationId])

  useEffect(() => {
    if (messages.length === 0) return
    const sentinel = sentinelRef.current
    const container = messagesRef.current
    if (!sentinel || !container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) markAsSeen()
      },
      { root: container, threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [conversationId, messages, markAsSeen])

  const messageActions = [
    { icon: '😊', label: 'Emoji', action: 'emoji' },
    { icon: '↩️', label: 'Reply', action: 'reply' },
    { icon: '⋮', label: 'More', action: 'more' },
  ]

  return (
    <div className="chat-main">
      <div className="chat-window" style={{ fontSize: `${zoomLevel}%` }}>
        <div className="chat-messages" ref={messagesRef}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.incoming ? 'incoming' : 'outgoing'}${msg.incoming && !hasSeen ? ' unread' : ''}`}
              onMouseEnter={() => setHoveredMessageId(msg.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
            >
              <div className="message-bubble-wrapper">
                <div className="message-content">{msg.content}</div>
                <div className="message-bottom-bar">
                  <span className="message-time">{msg.timestamp}</span>
                  {hoveredMessageId === msg.id && (
                    <div className="message-actions-bar">
                      {messageActions.map((action) => (
                        <button key={action.action} className="message-action-btn" title={action.label}>
                          <span className="action-icon">{action.icon}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={sentinelRef} style={{ height: 0, flexShrink: 0 }} />
        </div>
        <div className="chat-input-area">
          <input
            type="text"
            placeholder="Type your message..."
            className="chat-input"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={onKeyPress}
          />
          <button className="send-btn" onClick={onSendMessage}>
            <Send size={16} />
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
