import { Plus } from 'lucide-react'

interface Props {
  onNewDoc: () => void
}

export default function DocsHeader({ onNewDoc }: Props) {
  return (
    <div className="docs-header">
      <h2>Google Docs</h2>
      <button className="new-doc-btn" onClick={onNewDoc}>
        <Plus size={20} />
        <span>New Document</span>
      </button>
    </div>
  )
}
