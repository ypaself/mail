import { useState } from 'react'
import './styles/DocsPage.css'
import DocsHeader from './components/DocsHeader'
import DocsList from './components/DocsList'
import DocsEditor from './components/DocsEditor'

interface Document {
  id: number
  title: string
  content: string
  date: string
  lastModified: string
}

export default function DocsPage() {
  const [docs, setDocs] = useState<Document[]>([
    {
      id: 1,
      title: 'Project Proposal',
      content: 'This document outlines the key objectives and timeline for our upcoming project...',
      date: 'Today',
      lastModified: '2 hours ago',
    },
    {
      id: 2,
      title: 'Team Guidelines',
      content: 'Guidelines for team collaboration and communication...',
      date: 'Yesterday',
      lastModified: '1 day ago',
    },
    {
      id: 3,
      title: 'Meeting Notes',
      content: 'Summary of key discussion points from the team meeting...',
      date: '2 days ago',
      lastModified: '2 days ago',
    },
  ])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(docs[0])
  const [editTitle, setEditTitle] = useState(selectedDoc?.title || '')
  const [editContent, setEditContent] = useState(selectedDoc?.content || '')

  const handleNewDoc = () => {
    const newDoc: Document = {
      id: Math.max(...docs.map(d => d.id), 0) + 1,
      title: 'Untitled Document',
      content: '',
      date: 'Today',
      lastModified: 'Just now',
    }
    setDocs([newDoc, ...docs])
    setSelectedDoc(newDoc)
    setEditTitle(newDoc.title)
    setEditContent(newDoc.content)
  }

  const handleSaveDoc = () => {
    if (selectedDoc) {
      setDocs(docs.map(d =>
        d.id === selectedDoc.id
          ? { ...d, title: editTitle, content: editContent, lastModified: 'Just now' }
          : d
      ))
      setSelectedDoc({ ...selectedDoc, title: editTitle, content: editContent })
    }
  }

  const handleDeleteDoc = (id: number) => {
    const newDocs = docs.filter(d => d.id !== id)
    setDocs(newDocs)
    if (selectedDoc?.id === id) {
      setSelectedDoc(newDocs[0] || null)
    }
  }

  const handleSelectDoc = (doc: Document) => {
    setSelectedDoc(doc)
    setEditTitle(doc.title)
    setEditContent(doc.content)
  }

  return (
    <div className="docs-container">
      <DocsHeader onNewDoc={handleNewDoc} />
      <div className="docs-content">
        <DocsList
          docs={docs}
          selectedDoc={selectedDoc}
          onSelectDoc={handleSelectDoc}
          onDeleteDoc={handleDeleteDoc}
        />
        {selectedDoc && (
          <DocsEditor
            editTitle={editTitle}
            editContent={editContent}
            onTitleChange={setEditTitle}
            onContentChange={setEditContent}
            onSave={handleSaveDoc}
          />
        )}
      </div>
    </div>
  )
}
