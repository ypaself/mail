interface Email {
  subject: string
  from: string
  to: string
  date: string
  body: string
}

interface EmailViewerProps {
  email: Email
  onBack: () => void
}

export default function EmailViewer({ email, onBack }: EmailViewerProps) {
  return (
    <div className="email-viewer-container">
      <div className="email-viewer-header">
        <button onClick={onBack} className="back-btn">← Back to Inbox</button>
      </div>

      <div className="email-viewer-card">
        <div className="email-viewer-subject">
          <h2>{email.subject}</h2>
        </div>

        <div className="email-viewer-meta">
          <div className="meta-row">
            <label>From:</label>
            <span>{email.from}</span>
          </div>
          <div className="meta-row">
            <label>To:</label>
            <span>{email.to}</span>
          </div>
          <div className="meta-row">
            <label>Date:</label>
            <span>{new Date(email.date).toLocaleString()}</span>
          </div>
        </div>

        <div className="email-viewer-body">
          {email.body.split('\n').map((line, idx) => (
            <p key={idx}>{line || '\u00A0'}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
