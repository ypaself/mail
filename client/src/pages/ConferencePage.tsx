import { useState } from 'react'
import '../conference/styles/ConferencePage.css'
import ConferenceHeader from '../conference/components/ConferenceHeader'
import ConferenceList from '../conference/components/ConferenceList'
import VideoSection from '../conference/components/VideoSection'
import ControlsSection from '../conference/components/ControlsSection'
import ParticipantsSection from '../conference/components/ParticipantsSection'

interface Conference {
  name: string
  time: string
  status: 'active' | 'scheduled' | 'completed'
  participants: number
}

export default function ConferencePage() {
  const [selectedConference, setSelectedConference] = useState('Team Standup')

  const conferences: Conference[] = [
    {
      name: 'Team Standup',
      time: '2:00 PM - Ongoing',
      status: 'active',
      participants: 5,
    },
    {
      name: 'Project Review',
      time: '1:00 PM - Ended',
      status: 'completed',
      participants: 3,
    },
    {
      name: 'Client Meeting',
      time: '3:30 PM - Scheduled',
      status: 'scheduled',
      participants: 4,
    },
    {
      name: 'Weekly Sync',
      time: '12:00 PM - Ended',
      status: 'completed',
      participants: 6,
    },
  ]

  const participants = [
    { name: 'John Doe', initials: 'JD' },
    { name: 'Sarah Smith', initials: 'SS' },
    { name: 'Mike Johnson', initials: 'MJ' },
    { name: 'Emily Brown', initials: 'EB' },
    { name: 'Alex Miller', initials: 'AM' },
  ]

  const activeConference = conferences.find(c => c.name === selectedConference)

  return (
    <div className="conference-page">
      <ConferenceHeader />
      <div className="conference-page-content">
        <ConferenceList
          conferences={conferences}
          selectedConference={selectedConference}
          onSelectConference={setSelectedConference}
        />
        {activeConference && (
          <div className="conference-main-panel">
            <div className="conference-header-section">
              <div className="conf-title-area">
                <h2>{activeConference.name}</h2>
                <span className={`status-badge ${activeConference.status}`}>
                  {activeConference.status.charAt(0).toUpperCase() + activeConference.status.slice(1)}
                </span>
              </div>
              <p className="conf-metadata">
                {activeConference.status === 'active' ? 'Started at' : 'Meeting at'} {activeConference.time.split(' - ')[0]} • {activeConference.participants} participants
              </p>
            </div>
            <VideoSection />
            <ControlsSection />
            <ParticipantsSection
              participants={participants}
              count={activeConference.participants}
            />
          </div>
        )}
      </div>
    </div>
  )
}
