import { FileText, Sheet, File, StickyNote } from 'lucide-react'

type OfficeTab = 'notes' | 'docs' | 'sheets' | 'pdf'

interface Props {
  activeTab: OfficeTab
  onTabChange: (tab: OfficeTab) => void
}

export default function OfficeNav({ activeTab, onTabChange }: Props) {
  return (
    <div className="office-nav">
      <button
        className={`office-nav-btn ${activeTab === 'notes' ? 'active' : ''}`}
        onClick={() => onTabChange('notes')}
        title="Notes"
      >
        <StickyNote size={20} />
        <span>Notes</span>
      </button>
      <button
        className={`office-nav-btn ${activeTab === 'docs' ? 'active' : ''}`}
        onClick={() => onTabChange('docs')}
        title="Word Documents"
      >
        <FileText size={20} />
        <span>Word</span>
      </button>
      <button
        className={`office-nav-btn ${activeTab === 'sheets' ? 'active' : ''}`}
        onClick={() => onTabChange('sheets')}
        title="Excel Sheets"
      >
        <Sheet size={20} />
        <span>Excel</span>
      </button>
      <button
        className={`office-nav-btn ${activeTab === 'pdf' ? 'active' : ''}`}
        onClick={() => onTabChange('pdf')}
        title="PDF Files"
      >
        <File size={20} />
        <span>PDF</span>
      </button>
    </div>
  )
}
