interface Participant {
  name: string
  initials: string
}

interface Props {
  participants: Participant[]
  count: number
}

export default function ParticipantsSection({ participants, count }: Props) {
  return (
    <div className="participants-section">
      <h3>Participants ({count})</h3>
      <div className="participants-list">
        {participants.slice(0, count).map((p) => (
          <div key={p.initials} className="participant-card">
            <div className="participant-avatar">{p.initials}</div>
            <div className="participant-details">
              <p className="participant-name">{p.name}</p>
              <p className="participant-status">Online</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
