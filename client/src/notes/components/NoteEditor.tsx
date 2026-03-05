import { Check } from 'lucide-react'

interface Note {
  id: number
  title: string
  content: string
  date: string
  color: string
}

interface Props {
  note: Note
  editTitle: string
  editContent: string
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  onSave: () => void
}

export default function NoteEditor({
  note,
  editTitle,
  editContent,
  onTitleChange,
  onContentChange,
  onSave,
}: Props) {
  return (
    <div className="notes-main">
      <div className="note-editor">
        <div className="editor-header">
          <input
            type="text"
            className="note-title-input"
            value={editTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Note title..."
          />
          <button className="save-note-btn" onClick={onSave}>
            <Check size={20} />
            <span>Save</span>
          </button>
        </div>
        <div className="editor-metadata">
          <span className="note-color-dot" style={{ backgroundColor: note.color }}></span>
          <span className="note-date-info">{note.date}</span>
        </div>
        <textarea
          className="note-content-input"
          value={editContent}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="Start typing your note..."
        ></textarea>
      </div>
    </div>
  )
}
