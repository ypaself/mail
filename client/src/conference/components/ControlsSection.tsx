import { Video, MessageSquare, Users } from 'lucide-react'

export default function ControlsSection() {
  return (
    <div className="controls-section">
      <button className="control-btn">
        <Video size={20} />
        <span>Camera</span>
      </button>
      <button className="control-btn">
        <MessageSquare size={20} />
        <span>Microphone</span>
      </button>
      <button className="control-btn">
        <MessageSquare size={20} />
        <span>Chat</span>
      </button>
      <button className="control-btn">
        <Users size={20} />
        <span>Share Screen</span>
      </button>
      <button className="control-btn end-call">
        <MessageSquare size={20} />
        <span>End Call</span>
      </button>
    </div>
  )
}
