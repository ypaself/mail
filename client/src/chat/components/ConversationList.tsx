interface Conversation {
  id: number
  name: string
  initials: string
  preview: string
}

interface Props {
  conversations: Conversation[]
  selectedConversation: number
  onSelectConversation: (id: number) => void
}

export default function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
}: Props) {
  return (
    <div className="chat-sidebar">
      <div className="chat-search">
        <input type="text" placeholder="Search conversations..." />
      </div>
      <div className="chat-list">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`chat-item ${selectedConversation === conv.id ? 'active' : ''}`}
            onClick={() => onSelectConversation(conv.id)}
          >
            <div className="chat-avatar">{conv.initials}</div>
            <div className="chat-info">
              <div className="chat-name">{conv.name}</div>
              <div className="chat-preview">{conv.preview}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
