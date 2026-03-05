import { useState, useEffect } from 'react'
import './styles/OfficePage.css'
import OfficeHeader from './components/OfficeHeader'
import OfficeNav from './components/OfficeNav'
import NotesSection from './sections/NotesSection'
import DocsSection from './sections/DocsSection'
import SheetsSection from './sections/SheetsSection'
import PdfSection from './sections/PdfSection'

type OfficeTab = 'notes' | 'docs' | 'sheets' | 'pdf'

export default function OfficePage() {
  const [activeTab, setActiveTab] = useState<OfficeTab>('notes')

  useEffect(() => {
    // Get the tab from URL query parameter
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab') as OfficeTab
    if (tab && ['notes', 'docs', 'sheets', 'pdf'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [])

  return (
    <div className="office-container">
      <OfficeHeader />
      <OfficeNav activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="office-content">
        {activeTab === 'notes' && <NotesSection />}
        {activeTab === 'docs' && <DocsSection />}
        {activeTab === 'sheets' && <SheetsSection />}
        {activeTab === 'pdf' && <PdfSection />}
      </div>
    </div>
  )
}
