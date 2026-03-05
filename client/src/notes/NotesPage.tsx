import { useState } from 'react'
import './styles/NotesPage.css'
import NotesHeader from './components/NotesHeader'
import NotesList from './components/NotesList'
import NoteEditor from './components/NoteEditor'

interface Note {
  id: number
  title: string
  content: string
  date: string
  color: string
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([
    {
      id: 1,
      title: 'Project Ideas',
      content: 'Brainstorm ideas for the new feature',
      date: 'Today',
      color: '#FFE082',
    },
    {
      id: 2,
      title: 'Meeting Notes',
      content: 'Discuss timeline and deliverables',
      date: 'Yesterday',
      color: '#F48FB1',
    },
    {
      id: 3,
      title: 'Personal Tasks',
      content: 'Remember to follow up on pending items',
      date: '2 days ago',
      color: '#81C784',
    },
  ])
  const [selectedNote, setSelectedNote] = useState<Note | null>(notes[0])
  const [editTitle, setEditTitle] = useState(selectedNote?.title || '')
  const [editContent, setEditContent] = useState(selectedNote?.content || '')

  const handleNewNote = () => {
    const newNote: Note = {
      id: Math.max(...notes.map(n => n.id), 0) + 1,
      title: 'New Note',
      content: '',
      date: 'Today',
      color: '#FFE082',
    }
    setNotes([newNote, ...notes])
    setSelectedNote(newNote)
    setEditTitle(newNote.title)
    setEditContent(newNote.content)
  }

  const handleSaveNote = () => {
    if (selectedNote) {
      setNotes(notes.map(n =>
        n.id === selectedNote.id
          ? { ...n, title: editTitle, content: editContent }
          : n
      ))
      setSelectedNote({ ...selectedNote, title: editTitle, content: editContent })
    }
  }

  const handleDeleteNote = (id: number) => {
    const newNotes = notes.filter(n => n.id !== id)
    setNotes(newNotes)
    if (selectedNote?.id === id) {
      setSelectedNote(newNotes[0] || null)
    }
  }

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note)
    setEditTitle(note.title)
    setEditContent(note.content)
  }

  return (
    <div className="notes-container">
      <NotesHeader onNewNote={handleNewNote} />
      <div className="notes-content">
        <NotesList
          notes={notes}
          selectedNote={selectedNote}
          onSelectNote={handleSelectNote}
          onDeleteNote={handleDeleteNote}
        />
        {selectedNote && (
          <NoteEditor
            note={selectedNote}
            editTitle={editTitle}
            editContent={editContent}
            onTitleChange={setEditTitle}
            onContentChange={setEditContent}
            onSave={handleSaveNote}
          />
        )}
      </div>
    </div>
  )
}
