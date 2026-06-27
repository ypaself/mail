import { useState, useEffect } from 'react'
import './styles/ChatPage.css'
import ChatHeader from './components/ChatHeader'
import ConversationList from './components/ConversationList'
import ChatWindow from './components/ChatWindow'
import ChatNav from './components/ChatNav'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  folder?: string
  isRead?: boolean
}

interface Message {
  id: number
  content: string
  timestamp: string
  incoming: boolean
  isUnread: boolean
  emailId?: number
}

interface Conversation {
  id: number
  name: string
  initials: string
  preview: string
  email?: string
}

export default function ChatPage() {
  const token = localStorage.getItem('token') || ''
  const userEmail = localStorage.getItem('userEmail') || ''
  const [selectedConversation, setSelectedConversation] = useState(1)
  const [activeTab, setActiveTab] = useState<'chat' | 'audio' | 'video' | 'status' | 'files' | 'settings'>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [allEmails, setAllEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)

  // Header action states (per-conversation, keyed by conversation id)
  const [starredConvs, setStarredConvs] = useState<Set<number>>(new Set())
  const [archivedConvs, setArchivedConvs] = useState<Set<number>>(new Set())
  const [pinnedConvs, setPinnedConvs] = useState<Set<number>>(new Set())
  const [mutedConvs, setMutedConvs] = useState<Set<number>>(new Set())
  const [zoomLevel, setZoomLevel] = useState(100)

  useEffect(() => {
    fetchEmails()
  }, [token])

  useEffect(() => {
    if (conversations.length > 0 && selectedConversation) {
      loadConversationMessages(selectedConversation)
    }
  }, [selectedConversation, conversations, allEmails])

  const fetchEmails = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:5050/api/emails', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()

      if (response.ok && data.emails) {
        console.log('Fetched emails:', data.emails.length)
        console.log('User email:', userEmail)
        setAllEmails(data.emails)
        const emailConversations = groupEmailsByContact(data.emails)
        console.log('Conversations:', emailConversations)
        setConversations(emailConversations)
        if (emailConversations.length > 0) {
          setSelectedConversation(emailConversations[0].id)
        }
      } else {
        console.error('No emails found or response not ok')
        setConversations([])
      }
    } catch (err) {
      console.error('Failed to load emails:', err)
      setConversations([])
    } finally {
      setLoading(false)
    }
  }

  const groupEmailsByContact = (emails: Email[]): Conversation[] => {
    const contactMap = new Map<string, { emails: Email[]; name: string }>()

    emails.forEach((email) => {
      const isOutgoing = email.from === userEmail || email.folder === 'sent'
      const contactEmail = isOutgoing ? email.to : email.from
      const contactName = isOutgoing ? email.to : email.from

      if (!contactEmail) return

      if (!contactMap.has(contactEmail)) {
        contactMap.set(contactEmail, {
          emails: [],
          name: contactName,
        })
      }
      contactMap.get(contactEmail)?.emails.push(email)
    })

    return Array.from(contactMap.entries()).map(([email, data], idx) => ({
      id: idx + 1,
      name: data.name.split('@')[0] || data.name,
      initials: data.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2) || 'U',
      preview: data.emails[data.emails.length - 1]?.body.substring(0, 50) || '',
      email,
    }))
  }

  const loadConversationMessages = (conversationId: number) => {
    const contact = conversations.find((c) => c.id === conversationId)
    if (!contact?.email) {
      setMessages([])
      return
    }

    const contactEmails = allEmails.filter((email) => {
      const isOutgoing = email.from === userEmail || email.folder === 'sent'
      const otherEmail = isOutgoing ? email.to : email.from
      return otherEmail === contact.email
    })

    console.log(`Loading messages for ${contact.email}:`, contactEmails.length)

    const msgs: Message[] = contactEmails
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((email, idx) => {
        const isIncoming = !(email.from === userEmail || email.folder === 'sent')
        return {
          id: idx + 1,
          content: `${email.subject}\n\n${email.body}`,
          timestamp: new Date(email.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          incoming: isIncoming,
          isUnread: isIncoming && !email.isRead,
          emailId: email.id,
        }
      })

    setMessages(msgs)
  }

  const handleSendMessage = async () => {
    if (inputValue.trim() && selectedConversation) {
      const contact = conversations.find((c) => c.id === selectedConversation)
      if (!contact?.email) return

      const newMessage: Message = {
        id: messages.length + 1,
        content: inputValue,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        incoming: false,
        isUnread: false,
      }

      setMessages([...messages, newMessage])

      try {
        await fetch('http://localhost:5050/api/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: contact.email,
            subject: 'Message',
            body: inputValue,
          }),
        })
      } catch (err) {
        console.error('Failed to send message:', err)
      }

      setInputValue('')
    }
  }

  const handleMarkConversationAsRead = async () => {
    const unreadEmailIds = messages
      .filter(msg => msg.isUnread && msg.emailId !== undefined)
      .map(msg => msg.emailId as number)
    if (unreadEmailIds.length === 0) return
    try {
      await fetch('http://localhost:5050/api/emails/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: unreadEmailIds, action: 'read', value: true }),
      })
    } catch (err) {
      console.error('Failed to mark messages as read:', err)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Derived state for current conversation
  const isRead = !messages.some(m => m.incoming && m.isUnread)
  const isStarred = starredConvs.has(selectedConversation)
  const isArchived = archivedConvs.has(selectedConversation)
  const isPinned = pinnedConvs.has(selectedConversation)
  const isMuted = mutedConvs.has(selectedConversation)

  const currentContact = conversations.find(c => c.id === selectedConversation)

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<number>>>, id: number) =>
    setter(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  const handleToggleRead = async () => {
    const unreadIds = messages.filter(m => m.incoming && m.isUnread && m.emailId !== undefined).map(m => m.emailId as number)
    const readIds = messages.filter(m => m.incoming && !m.isUnread && m.emailId !== undefined).map(m => m.emailId as number)
    const ids = isRead ? readIds : unreadIds
    if (ids.length === 0) return
    try {
      await fetch('http://localhost:5050/api/emails/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids, action: 'read', value: isRead ? false : true }),
      })
      fetchEmails()
    } catch {}
  }

  return (
    <div className="chat-container">
      <ChatHeader
        contactName={currentContact?.name}
        isRead={isRead}
        isStarred={isStarred}
        isArchived={isArchived}
        isPinned={isPinned}
        isMuted={isMuted}
        zoomLevel={zoomLevel}
        onToggleRead={handleToggleRead}
        onToggleStar={() => toggleSet(setStarredConvs, selectedConversation)}
        onToggleArchive={() => toggleSet(setArchivedConvs, selectedConversation)}
        onTogglePin={() => toggleSet(setPinnedConvs, selectedConversation)}
        onMute={() => toggleSet(setMutedConvs, selectedConversation)}
        onZoom={setZoomLevel}
        onReply={() => console.log('Reply')}
        onReplyAll={() => console.log('Reply All')}
        onForward={() => console.log('Forward')}
        onResend={() => console.log('Resend')}
        onSnooze={() => console.log('Snooze')}
        onMoveTo={(folder) => console.log('Move to', folder)}
        onAddToGroup={() => console.log('Add to Group')}
        onSpam={() => console.log('Spam')}
        onReport={() => console.log('Report')}
        onEmpty={() => { if (window.confirm('Clear this conversation?')) setMessages([]) }}
        onDelete={() => console.log('Delete')}
        onBlock={() => console.log('Block')}
        onImmersiveReader={() => console.log('Immersive Reader')}
      />
      <ChatNav activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="chat-content">
        <ConversationList
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
        />
        {activeTab === 'chat' && (
          <>
            {loading ? (
              <div className="chat-main">
                <div className="feature-placeholder">
                  <p>Loading emails...</p>
                </div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="chat-main">
                <div className="feature-placeholder">
                  <p>No conversations yet. Send or receive emails to start chatting!</p>
                </div>
              </div>
            ) : (
              <ChatWindow
                messages={messages}
                inputValue={inputValue}
                onInputChange={setInputValue}
                onSendMessage={handleSendMessage}
                onKeyPress={handleKeyPress}
                onMarkAsRead={handleMarkConversationAsRead}
                conversationId={selectedConversation}
                zoomLevel={zoomLevel}
              />
            )}
          </>
        )}
        {activeTab === 'audio' && (
          <div className="chat-main">
            <div className="feature-placeholder">
              <div className="feature-icon">🎙️</div>
              <h3>Audio Call</h3>
              <p>Start an audio call with {conversations[selectedConversation - 1]?.name || 'this contact'}</p>
              <button className="feature-btn">Start Audio Call</button>
            </div>
          </div>
        )}
        {activeTab === 'video' && (
          <div className="chat-main">
            <div className="feature-placeholder">
              <div className="feature-icon">📹</div>
              <h3>Video Call</h3>
              <p>Start a video call with {conversations[selectedConversation - 1]?.name || 'this contact'}</p>
              <button className="feature-btn">Start Video Call</button>
            </div>
          </div>
        )}
        {activeTab === 'status' && (
          <div className="chat-main">
            <div className="feature-placeholder">
              <div className="feature-icon">📢</div>
              <h3>Status Updates</h3>
              <p>Share your status with contacts</p>
              <button className="feature-btn">Post Status</button>
            </div>
          </div>
        )}
        {activeTab === 'files' && (
          <div className="chat-main">
            <div className="feature-placeholder">
              <div className="feature-icon">📁</div>
              <h3>Shared Files</h3>
              <p>View and manage shared files</p>
              <button className="feature-btn">Upload File</button>
            </div>
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="chat-main">
            <div className="feature-placeholder">
              <div className="feature-icon">⚙️</div>
              <h3>Chat Settings</h3>
              <p>Manage your chat preferences</p>
              <button className="feature-btn">Configure Settings</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
