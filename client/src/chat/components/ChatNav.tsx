import { MessageSquare, Mic, Video, Radio, FileText, Settings } from 'lucide-react'

type TabType = 'chat' | 'audio' | 'video' | 'status' | 'files' | 'settings'

interface Props {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

export default function ChatNav({ activeTab, onTabChange }: Props) {
  return (
    <div className="chat-nav">
      <button
        className={`chat-nav-btn ${activeTab === 'chat' ? 'active' : ''}`}
        title="Chat"
        onClick={() => onTabChange('chat')}
      >
        <MessageSquare size={20} />
        <span>Chat</span>
      </button>
      <button
        className={`chat-nav-btn ${activeTab === 'audio' ? 'active' : ''}`}
        title="Audio Call"
        onClick={() => onTabChange('audio')}
      >
        <Mic size={20} />
        <span>Audio</span>
      </button>
      <button
        className={`chat-nav-btn ${activeTab === 'video' ? 'active' : ''}`}
        title="Video Call"
        onClick={() => onTabChange('video')}
      >
        <Video size={20} />
        <span>Video</span>
      </button>
      <button
        className={`chat-nav-btn ${activeTab === 'status' ? 'active' : ''}`}
        title="Status"
        onClick={() => onTabChange('status')}
      >
        <Radio size={20} />
        <span>Status</span>
      </button>
      <button
        className={`chat-nav-btn ${activeTab === 'files' ? 'active' : ''}`}
        title="Files"
        onClick={() => onTabChange('files')}
      >
        <FileText size={20} />
        <span>Files</span>
      </button>
      <button
        className={`chat-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
        title="Settings"
        onClick={() => onTabChange('settings')}
      >
        <Settings size={20} />
        <span>Settings</span>
      </button>
    </div>
  )
}
