import { useState } from 'react'
import { Plus } from 'lucide-react'
import './styles/FormsPage.css'

interface Form {
  id: number
  title: string
  responses: number
  lastModified: string
}

export default function FormsPage() {
  const [forms] = useState<Form[]>([
    { id: 1, title: 'Customer Feedback', responses: 24, lastModified: 'Today' },
    { id: 2, title: 'Employee Satisfaction', responses: 18, lastModified: 'Yesterday' },
    { id: 3, title: 'Product Survey', responses: 42, lastModified: '3 days ago' },
  ])

  return (
    <div className="forms-container">
      <div className="forms-header">
        <h2>Google Forms</h2>
        <button className="new-form-btn">
          <Plus size={20} />
          <span>New Form</span>
        </button>
      </div>
      <div className="forms-content">
        <div className="forms-grid">
          {forms.map((form) => (
            <div key={form.id} className="form-card">
              <div className="form-icon">📋</div>
              <h3>{form.title}</h3>
              <p className="form-responses">{form.responses} responses</p>
              <p className="form-date">{form.lastModified}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
