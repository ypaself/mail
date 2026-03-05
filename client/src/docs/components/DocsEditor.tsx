import { Check, Share2 } from 'lucide-react'

interface Props {
  editTitle: string
  editContent: string
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  onSave: () => void
}

export default function DocsEditor({
  editTitle,
  editContent,
  onTitleChange,
  onContentChange,
  onSave,
}: Props) {
  return (
    <div className="docs-main">
      <div className="doc-editor">
        <div className="editor-toolbar">
          <input
            type="text"
            className="doc-title-input"
            value={editTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Document title..."
          />
          <div className="toolbar-buttons">
            <button className="toolbar-btn" title="Share">
              <Share2 size={18} />
            </button>
            <button className="save-doc-btn" onClick={onSave}>
              <Check size={18} />
              <span>Save</span>
            </button>
          </div>
        </div>
        <textarea
          className="doc-content-input"
          value={editContent}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="Start typing your document..."
        ></textarea>
      </div>
    </div>
  )
}
