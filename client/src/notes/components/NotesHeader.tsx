import { Plus } from 'lucide-react'

interface Props {
  onNewNote: () => void
}

export default function NotesHeader({ onNewNote }: Props) {
  return (
    <div className="notes-header">
      <h2>Notes</h2>
      <button className="new-note-btn" onClick={onNewNote}>
        <Plus size={20} />
        <span>New Note</span>
      </button>
    </div>
  )
}
