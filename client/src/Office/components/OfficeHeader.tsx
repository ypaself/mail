import { Plus, Settings } from 'lucide-react'

export default function OfficeHeader() {
  return (
    <div className="office-header">
      <div className="header-left">
        <h1>Office Suite</h1>
      </div>
      <div className="header-right">
        <button className="create-btn">
          <Plus size={20} />
          <span>Create</span>
        </button>
        <button className="settings-btn">
          <Settings size={20} />
        </button>
      </div>
    </div>
  )
}
