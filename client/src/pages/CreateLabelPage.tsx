import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'

interface ChildLabel {
  id: string
  name: string
  color: string
}

interface LabelNode {
  id: number
  name: string
  color: string
  children?: LabelNode[]
}

interface CreateLabelPageProps {
  token: string
  onLabelCreated: () => void
  parentLabels?: LabelNode[]
}

const colors = ['#9c27b0', '#f44336', '#2196f3', '#4caf50', '#ff9800', '#e91e63', '#00bcd4', '#3f51b5', '#009688', '#cddc39']

export default function CreateLabelPage({ token, onLabelCreated, parentLabels = [] }: CreateLabelPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [labelName, setLabelName] = useState('')
  const [labelColor, setLabelColor] = useState('#9c27b0')
  const [parentLabelId, setParentLabelId] = useState<number | null>(null)
  const [childLabels, setChildLabels] = useState<ChildLabel[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Get parent label ID from location state if creating sub-label
    if (location.state?.parentLabelId) {
      setParentLabelId(location.state.parentLabelId)
    }
    // Get child labels from the location state if coming from child labels page
    if (location.state?.childLabels) {
      setChildLabels(location.state.childLabels)
    }
  }, [location.state])

  const handleAddChildLabels = () => {
    navigate('/create-child-labels')
  }

  const handleRemoveChildLabels = () => {
    setChildLabels([])
  }

  const handleCreateLabel = async () => {
    if (!labelName.trim()) {
      setError('Label name is required')
      return
    }

    // Validate child labels if any
    if (childLabels.length > 0) {
      for (const child of childLabels) {
        if (!child.name.trim()) {
          setError('All child label names are required')
          return
        }
      }
    }

    setLoading(true)
    setError('')

    try {
      // Create parent label
      const parentPayload: any = { name: labelName, color: labelColor }
      if (parentLabelId) {
        parentPayload.parent_label_id = parentLabelId
      }

      const parentResponse = await fetch('http://localhost:5050/api/custom-labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(parentPayload),
      })

      if (!parentResponse.ok) {
        const data = await parentResponse.json()
        setError(data.error || 'Failed to create label')
        setLoading(false)
        return
      }

      const parentData = await parentResponse.json()
      const parentLabelIdNew = parentData.id

      // Create child labels if any
      if (childLabels.length > 0) {
        for (const child of childLabels) {
          const childPayload = {
            name: child.name,
            color: child.color,
            parent_label_id: parentLabelIdNew
          }

          const childResponse = await fetch('http://localhost:5050/api/custom-labels', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(childPayload),
          })

          if (!childResponse.ok) {
            const data = await childResponse.json()
            setError(`Failed to create child label "${child.name}": ${data.error || 'Unknown error'}`)
            setLoading(false)
            return
          }
        }
      }

      onLabelCreated()
      navigate('/inbox')
    } catch (err) {
      console.error('Failed to create label:', err)
      setError('Failed to create label')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/inbox')
  }

  // Flatten label tree to show all labels in parent dropdown, including nested ones
  const flattenLabels = (labels: LabelNode[], prefix = ''): {id: number, name: string, color: string}[] => {
    return labels.flatMap(label => [
      {
        id: label.id,
        name: prefix ? `${prefix} / ${label.name}` : label.name,
        color: label.color
      },
      ...(label.children ? flattenLabels(label.children, prefix ? `${prefix} / ${label.name}` : label.name) : [])
    ])
  }

  const flatParentLabels = flattenLabels(parentLabels || [])

  return (
    <div className="create-label-page">
      <div className="create-label-container">
        <div className="create-label-header">
          <h2>Create New Label</h2>
          <button
            className="close-btn"
            onClick={handleCancel}
            title="Close"
          >
            <X size={24} />
          </button>
        </div>

        {error && <div className="message error">{error}</div>}

        <div className="create-label-form">
          <div className="form-group">
            <label htmlFor="label-name">Label Name</label>
            <input
              id="label-name"
              type="text"
              placeholder="Enter label name (e.g., Project A, Important, Review)"
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateLabel()}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="parent-label">Create as sub-label under... (optional)</label>
            <select
              id="parent-label"
              value={parentLabelId || ''}
              onChange={(e) => setParentLabelId(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">None (top-level label)</option>
              {flatParentLabels.map(label => (
                <option key={label.id} value={label.id}>
                  {label.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="label-color">Color</label>
            <div className="color-input-wrapper">
              <input
                id="label-color"
                type="color"
                value={labelColor}
                onChange={(e) => setLabelColor(e.target.value)}
              />
              <div className="color-preview" style={{ backgroundColor: labelColor }}></div>
              <span className="color-code">{labelColor}</span>
            </div>
          </div>

          {childLabels.length === 0 ? (
            <div className="form-group"></div>
          ) : (
            <div className="child-labels-info">
              <div className="child-labels-status">
                <p>Child Labels: <strong>{childLabels.length}</strong></p>
                <ul className="child-labels-preview">
                  {childLabels.map((child, index) => (
                    <li key={child.id}>
                      <span className="color-dot" style={{ backgroundColor: child.color }}></span>
                      {child.name}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="child-labels-buttons">
                <button
                  type="button"
                  className="btn-remove-child"
                  onClick={handleRemoveChildLabels}
                  title="Remove child labels"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              className="btn-create"
              onClick={handleCreateLabel}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Label'}
            </button>
            <button
              className="btn-cancel"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
