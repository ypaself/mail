import { ArrowLeft, CheckCircle, Circle, Reply, Forward } from 'lucide-react'
import { useState } from 'react'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isRead?: boolean
  folder?: string
  isScheduled?: boolean
  isDraft?: boolean
}

interface EmailViewerProps {
  email: Email
  onBack: () => void
  token?: string
  onReply?: (action: 'reply' | 'replyAll' | 'forward', email: Email) => void
}

export default function EmailViewer({ email, onBack, token = '', onReply }: EmailViewerProps) {
  const [isRead, setIsRead] = useState(email.isRead ?? true)
  const [loading, setLoading] = useState(false)

  const handleToggleRead = async () => {
    if (!email.id || !token) {
      setIsRead(!isRead)
      return
    }

    setLoading(true)
    try {
      await fetch(`http://localhost:5050/api/emails/${email.id}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_read: !isRead }),
      })
      setIsRead(!isRead)
    } catch (err) {
      console.error('Failed to toggle read status:', err)
    } finally {
      setLoading(false)
    }
  }

  const isOutgoing = email.folder === 'sent' || email.from === email.to

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column', backgroundColor: 'white' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#2196f3',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={20} />
          Back
        </button>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, flex: 1 }}>{isOutgoing ? email.to : email.from}</h2>
      </div>

      {/* Email Message */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: isOutgoing ? 'flex-end' : 'flex-start',
          }}
        >
          <div
            style={{
              maxWidth: '95%',
              background: isOutgoing
                ? '#2196f3'
                : !isRead
                  ? 'linear-gradient(to right, rgba(66, 133, 244, 0.12) 10px, #f0f0f0 10px)'
                  : '#f0f0f0',
              borderLeft: !isOutgoing && !isRead ? '4px solid #4285F4' : undefined,
              color: isOutgoing ? 'white' : '#333',
              padding: '16px',
              borderRadius: '12px',
              wordWrap: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px', color: (!email.subject || email.subject === '(No subject)') ? '#888' : 'inherit' }}>{email.subject || '(No subject)'}</div>
            <div style={{ fontSize: '13px', marginBottom: '12px' }} dangerouslySetInnerHTML={{ __html: email.body }} />
            <div style={{ fontSize: '12px', opacity: 0.7 }}>
              {new Date(email.date).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      {!email.isDraft && <div style={{ padding: '16px', borderTop: '1px solid #eee', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {onReply && email.folder !== 'sent' && (
          <button
            onClick={() => onReply('reply', email)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', backgroundColor: '#e3f2fd', color: '#1976d2', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
          >
            <Reply size={16} />
            Reply
          </button>
        )}
        {onReply && (
          <button
            onClick={() => onReply('forward', email)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', backgroundColor: '#f3e5f5', color: '#7b1fa2', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
          >
            <Forward size={16} />
            Forward
          </button>
        )}
        <button
          onClick={handleToggleRead}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: isRead ? '#f0f0f0' : '#2196f3',
            color: isRead ? '#333' : 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {isRead ? (
            <>
              <Circle size={18} />
              Mark as Unread
            </>
          ) : (
            <>
              <CheckCircle size={18} />
              Mark as Read
            </>
          )}
        </button>
      </div>}
    </div>
  )
}
