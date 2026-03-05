interface Message {
  id: number
  content: string
  timestamp: string
  incoming: boolean
}

interface Props {
  messages: Message[]
  inputValue: string
  onInputChange: (value: string) => void
  onSendMessage: () => void
  onKeyPress: (e: React.KeyboardEvent) => void
}

export default function ChatWindow({
  messages,
  inputValue,
  onInputChange,
  onSendMessage,
  onKeyPress,
}: Props) {
  return (
    <div className="chat-main">
      <div className="chat-window">
        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.incoming ? 'incoming' : 'outgoing'}`}>
              <div className="message-content">{msg.content}</div>
              <div className="message-time">{msg.timestamp}</div>
            </div>
          ))}
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
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
