import { Plus } from 'lucide-react'

export default function ConferenceHeader() {
  return (
    <div className="conference-page-header">
      <h1>Conference Room</h1>
      <button className="new-conference-btn">
        <Plus size={20} />
        <span>New Conference</span>
      </button>
    </div>
  )
}
