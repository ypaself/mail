import { useState } from 'react'
import { Plus, Check } from 'lucide-react'

interface Note {
  id: number
  title: string
  content: string
  date: string
  color: string
}

export default function NotesSection() {
  const [notes, setNotes] = useState<Note[]>([
    { id: 1, title: 'Project Ideas', content: 'Brainstorm ideas for the new feature', date: 'Today', color: '#FFE082' },
    { id: 2, title: 'Meeting Notes', content: 'Discuss timeline and deliverables', date: 'Yesterday', color: '#F48FB1' },
  ])
  const [selectedNote, setSelectedNote] = useState<Note | null>(notes[0])
  const [editTitle, setEditTitle] = useState(selectedNote?.title || '')
  const [editContent, setEditContent] = useState(selectedNote?.content || '')

  const handleSaveNote = () => {
    if (selectedNote) {
      setNotes(notes.map(n =>
        n.id === selectedNote.id ? { ...n, title: editTitle, content: editContent } : n
      ))
    }
  }

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note)
    setEditTitle(note.title)
    setEditContent(note.content)
  }

  return (
    <div className="office-section">
      <div className="section-sidebar">
        <h3>Notes</h3>
        <button className="add-btn"><Plus size={16} /> New Note</button>
        <div className="items-list">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`item-card ${selectedNote?.id === note.id ? 'active' : ''}`}
              onClick={() => handleSelectNote(note)}
            >
              <div className="item-color" style={{ backgroundColor: note.color }}></div>
              <div className="item-info">
                <div className="item-title">{note.title}</div>
                <div className="item-date">{note.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="section-main">
        {selectedNote && (
          <div className="editor">
            <input
              type="text"
              className="editor-title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Note title..."
            />
            <textarea
              className="editor-content"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Start typing..."
            ></textarea>
            <button className="save-btn" onClick={handleSaveNote}>
              <Check size={16} /> Save Note
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
