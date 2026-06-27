import { Trash2 } from 'lucide-react'

interface Document {
  id: number
  title: string
  content: string
  date: string
  lastModified: string
}

interface Props {
  docs: Document[]
  selectedDoc: Document | null
  onSelectDoc: (doc: Document) => void
  onDeleteDoc: (id: number) => void
}

export default function DocsList({ docs, selectedDoc, onSelectDoc, onDeleteDoc }: Props) {
  return (
    <div className="docs-sidebar">
      <div className="docs-search">
        <input type="text" id="docs-search" name="docs-search" placeholder="Search documents..." />
      </div>
      <div className="docs-list">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className={`doc-item ${selectedDoc?.id === doc.id ? 'active' : ''}`}
            onClick={() => onSelectDoc(doc)}
          >
            <div className="doc-icon">📄</div>
            <div className="doc-preview">
              <div className="doc-title">{doc.title}</div>
              <div className="doc-modified">{doc.lastModified}</div>
            </div>
            <button
              className="delete-doc-btn"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteDoc(doc.id)
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
