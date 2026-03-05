import { useState } from 'react'
import { Plus } from 'lucide-react'
import './styles/SheetsPage.css'

interface Sheet {
  id: number
  title: string
  rows: number
  columns: number
  lastModified: string
}

export default function SheetsPage() {
  const [sheets] = useState<Sheet[]>([
    { id: 1, title: 'Budget 2024', rows: 50, columns: 10, lastModified: 'Today' },
    { id: 2, title: 'Sales Data', rows: 100, columns: 8, lastModified: 'Yesterday' },
    { id: 3, title: 'Team Schedule', rows: 30, columns: 7, lastModified: '2 days ago' },
  ])

  return (
    <div className="sheets-container">
      <div className="sheets-header">
        <h2>Google Sheets</h2>
        <button className="new-sheet-btn">
          <Plus size={20} />
          <span>New Sheet</span>
        </button>
      </div>
      <div className="sheets-content">
        <div className="sheets-grid">
          {sheets.map((sheet) => (
            <div key={sheet.id} className="sheet-card">
              <div className="sheet-icon">📊</div>
              <h3>{sheet.title}</h3>
              <p className="sheet-info">{sheet.rows} rows × {sheet.columns} columns</p>
              <p className="sheet-date">{sheet.lastModified}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
