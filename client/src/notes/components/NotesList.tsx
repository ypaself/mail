import { Trash2 } from 'lucide-react'

interface Note {
  id: number
  title: string
  content: string
  date: string
  color: string
}

interface Props {
  notes: Note[]
  selectedNote: Note | null
  onSelectNote: (note: Note) => void
  onDeleteNote: (id: number) => void
}

export default function NotesList({ notes, selectedNote, onSelectNote, onDeleteNote }: Props) {
  return (
    <div className="notes-sidebar">
      <div className="notes-search">
        <input type="text" id="notes-search" name="notes-search" placeholder="Search notes..." />
      </div>
      <div className="notes-list">
        {notes.map((note) => (
          <div
            key={note.id}
            className={`note-item ${selectedNote?.id === note.id ? 'active' : ''}`}
            style={{ backgroundColor: selectedNote?.id === note.id ? '#e8e8ff' : 'white' }}
            onClick={() => onSelectNote(note)}
          >
            <div className="note-color" style={{ backgroundColor: note.color }}></div>
            <div className="note-preview">
              <div className="note-title">{note.title}</div>
              <div className="note-excerpt">{note.content.substring(0, 40)}...</div>
              <div className="note-date">{note.date}</div>
            </div>
            <button
              className="delete-note-btn"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteNote(note.id)
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
