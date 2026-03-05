import { useState } from 'react'
import { Upload } from 'lucide-react'

interface PdfFile {
  id: number
  title: string
  pages: number
  size: string
  date: string
}

export default function PdfSection() {
  const [pdfs] = useState<PdfFile[]>([
    { id: 1, title: 'Project Report', pages: 12, size: '2.5 MB', date: 'Today' },
    { id: 2, title: 'Contract', pages: 5, size: '1.8 MB', date: 'Yesterday' },
  ])
  const [selectedPdf, setSelectedPdf] = useState<PdfFile | null>(pdfs[0])

  return (
    <div className="office-section">
      <div className="section-sidebar">
        <h3>PDF Files</h3>
        <button className="add-btn"><Upload size={16} /> Upload PDF</button>
        <div className="items-list">
          {pdfs.map((pdf) => (
            <div
              key={pdf.id}
              className={`item-card ${selectedPdf?.id === pdf.id ? 'active' : ''}`}
              onClick={() => setSelectedPdf(pdf)}
            >
              <div className="item-icon">📕</div>
              <div className="item-info">
                <div className="item-title">{pdf.title}</div>
                <div className="item-date">{pdf.pages} pages • {pdf.size}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="section-main">
        {selectedPdf && (
          <div className="pdf-view">
            <div className="pdf-viewer">
              <div className="pdf-placeholder">
                <div className="placeholder-icon">📕</div>
                <h3>{selectedPdf.title}</h3>
                <p>{selectedPdf.pages} pages</p>
                <p className="file-size">{selectedPdf.size}</p>
                <button className="view-btn">View Full Document</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
