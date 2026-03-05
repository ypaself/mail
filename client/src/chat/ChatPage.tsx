import { useState } from 'react'
import './styles/ChatPage.css'
import ChatHeader from './components/ChatHeader'
import ConversationList from './components/ConversationList'
import ChatWindow from './components/ChatWindow'
import ChatNav from './components/ChatNav'

interface Message {
  id: number
  content: string
  timestamp: string
  incoming: boolean
}

interface Conversation {
  id: number
  name: string
  initials: string
  preview: string
}

export default function ChatPage() {
  const [selectedConversation, setSelectedConversation] = useState(1)
  const [activeTab, setActiveTab] = useState<'chat' | 'audio' | 'video' | 'status' | 'files' | 'settings'>('chat')
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, content: "Hey! How's the project going?", timestamp: '10:30 AM', incoming: true },
    { id: 2, content: 'Going great! Just finished the design phase', timestamp: '10:35 AM', incoming: false },
    { id: 3, content: 'That sounds great!', timestamp: '10:40 AM', incoming: true },
  ])
  const [inputValue, setInputValue] = useState('')

  const conversations: Conversation[] = [
    { id: 1, name: 'John Doe', initials: 'JD', preview: 'That sounds great!' },
    { id: 2, name: 'Sarah Smith', initials: 'SS', preview: 'See you tomorrow' },
    { id: 3, name: 'Mike Johnson', initials: 'MJ', preview: 'Perfect, let\'s do it' },
    { id: 4, name: 'Emily Brown', initials: 'EB', preview: 'Thanks for the update' },
  ]

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      const newMessage: Message = {
        id: messages.length + 1,
        content: inputValue,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        incoming: false,
      }
      setMessages([...messages, newMessage])
      setInputValue('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="chat-container">
      <ChatHeader />
      <ChatNav activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="chat-content">
        <ConversationList
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
        />
        {activeTab === 'chat' && (
          <ChatWindow
            messages={messages}
            inputValue={inputValue}
            onInputChange={setInputValue}
            onSendMessage={handleSendMessage}
            onKeyPress={handleKeyPress}
          />
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
