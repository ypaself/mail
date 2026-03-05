import { useState } from 'react'
import { Plus, Check } from 'lucide-react'

interface Document {
  id: number
  title: string
  content: string
  date: string
}

export default function DocsSection() {
  const [docs, setDocs] = useState<Document[]>([
    { id: 1, title: 'Project Proposal', content: 'This document outlines the key objectives...', date: 'Today' },
    { id: 2, title: 'Team Guidelines', content: 'Guidelines for team collaboration...', date: 'Yesterday' },
  ])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(docs[0])
  const [editTitle, setEditTitle] = useState(selectedDoc?.title || '')
  const [editContent, setEditContent] = useState(selectedDoc?.content || '')

  const handleSaveDoc = () => {
    if (selectedDoc) {
      setDocs(docs.map(d =>
        d.id === selectedDoc.id ? { ...d, title: editTitle, content: editContent } : d
      ))
    }
  }

  const handleSelectDoc = (doc: Document) => {
    setSelectedDoc(doc)
    setEditTitle(doc.title)
    setEditContent(doc.content)
  }

  return (
    <div className="office-section">
      <div className="section-sidebar">
        <h3>Documents</h3>
        <button className="add-btn"><Plus size={16} /> New Document</button>
        <div className="items-list">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className={`item-card ${selectedDoc?.id === doc.id ? 'active' : ''}`}
              onClick={() => handleSelectDoc(doc)}
            >
              <div className="item-icon">📄</div>
              <div className="item-info">
                <div className="item-title">{doc.title}</div>
                <div className="item-date">{doc.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="section-main">
        {selectedDoc && (
          <div className="editor">
            <input
              type="text"
              className="editor-title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Document title..."
            />
            <textarea
              className="editor-content"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Start typing..."
            ></textarea>
            <button className="save-btn" onClick={handleSaveDoc}>
              <Check size={16} /> Save Document
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
