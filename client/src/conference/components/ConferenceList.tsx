interface Conference {
  name: string
  time: string
  status: 'active' | 'scheduled' | 'completed'
  participants: number
}

interface Props {
  conferences: Conference[]
  selectedConference: string
  onSelectConference: (name: string) => void
}

export default function ConferenceList({
  conferences,
  selectedConference,
  onSelectConference,
}: Props) {
  return (
    <div className="conference-list-panel">
      <div className="list-header">
        <h3>Conferences</h3>
        <input type="text" id="conference-search" name="conference-search" placeholder="Search..." className="search-input" />
      </div>
      <div className="conference-list">
        {conferences.map((conf) => (
          <div
            key={conf.name}
            className={`conference-list-item ${selectedConference === conf.name ? 'active' : ''}`}
            onClick={() => onSelectConference(conf.name)}
          >
            <div className={`status-indicator ${conf.status}`}></div>
            <div className="conf-info">
              <div className="conf-name">{conf.name}</div>
              <div className="conf-time">{conf.time}</div>
            </div>
            <div className="conf-count">{conf.participants}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
