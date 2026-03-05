import { useState } from 'react'
import { Plus } from 'lucide-react'

interface Sheet {
  id: number
  title: string
  rows: number
  columns: number
  date: string
}

export default function SheetsSection() {
  const [sheets] = useState<Sheet[]>([
    { id: 1, title: 'Budget 2024', rows: 50, columns: 10, date: 'Today' },
    { id: 2, title: 'Sales Data', rows: 100, columns: 8, date: 'Yesterday' },
  ])
  const [selectedSheet, setSelectedSheet] = useState<Sheet | null>(sheets[0])

  return (
    <div className="office-section">
      <div className="section-sidebar">
        <h3>Spreadsheets</h3>
        <button className="add-btn"><Plus size={16} /> New Sheet</button>
        <div className="items-list">
          {sheets.map((sheet) => (
            <div
              key={sheet.id}
              className={`item-card ${selectedSheet?.id === sheet.id ? 'active' : ''}`}
              onClick={() => setSelectedSheet(sheet)}
            >
              <div className="item-icon">📊</div>
              <div className="item-info">
                <div className="item-title">{sheet.title}</div>
                <div className="item-date">{sheet.rows}×{sheet.columns}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="section-main">
        {selectedSheet && (
          <div className="sheet-view">
            <h3>{selectedSheet.title}</h3>
            <div className="sheet-grid">
              <table>
                <thead>
                  <tr>
                    {Array.from({ length: selectedSheet.columns }).map((_, i) => (
                      <th key={i}>{String.fromCharCode(65 + i)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.min(selectedSheet.rows, 10) }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: selectedSheet.columns }).map((_, j) => (
                        <td key={j} contentEditable>
                          {`${i + 1}${String.fromCharCode(65 + j)}`}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
