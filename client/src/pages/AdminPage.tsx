import { useEffect, useState, useCallback } from 'react'
import { AlertOctagon, MessageSquare, CheckCircle, Clock, AlertCircle, Trash2, ChevronDown, ChevronUp, Image, RefreshCw, X } from 'lucide-react'
import '../styles/AdminPage.css'

const API = 'http://localhost:5050'

type ErrorStatus = 'new' | 'in_progress' | 'solved'
type FeedbackStatus = 'new' | 'in_progress' | 'resolved'
type Tab = 'overview' | 'errors' | 'feedback'
type ErrorFilter = 'all' | ErrorStatus
type FeedbackFilter = 'all' | FeedbackStatus

interface ErrorReport {
  id: number
  error_message: string
  stack_trace: string
  user_agent: string
  url: string
  screenshot_path: string | null
  status: ErrorStatus
  notes: string
  created_at: string
}

interface FeedbackItem {
  id: number
  user_email: string
  category: string
  subject: string
  message: string
  status: FeedbackStatus
  created_at: string
}

interface Stats {
  errors: { total: number; new: number; in_progress: number; solved: number }
  feedback: { total: number; new: number; in_progress: number; resolved: number }
}

interface Props {
  token: string
}

const STATUS_COLORS: Record<string, string> = {
  new: '#e53935',
  in_progress: '#f57c00',
  solved: '#43a047',
  resolved: '#43a047',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  in_progress: 'In Progress',
  solved: 'Solved',
  resolved: 'Resolved',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString()
}

export default function AdminPage({ token }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [errors, setErrors] = useState<ErrorReport[]>([])
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [errorFilter, setErrorFilter] = useState<ErrorFilter>('all')
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackFilter>('all')
  const [expandedError, setExpandedError] = useState<number | null>(null)
  const [expandedFeedback, setExpandedFeedback] = useState<number | null>(null)
  const [editingNotes, setEditingNotes] = useState<{ id: number; value: string } | null>(null)
  const [screenshotModal, setScreenshotModal] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const fetchStats = useCallback(async () => {
    const r = await fetch(`${API}/api/admin/stats`, { headers })
    if (r.ok) setStats(await r.json())
  }, [token])

  const fetchErrors = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`${API}/api/admin/errors?status=${errorFilter}`, { headers })
    if (r.ok) setErrors(await r.json())
    setLoading(false)
  }, [token, errorFilter])

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`${API}/api/admin/feedback?status=${feedbackFilter}`, { headers })
    if (r.ok) setFeedback(await r.json())
    setLoading(false)
  }, [token, feedbackFilter])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { if (tab === 'errors') fetchErrors() }, [tab, fetchErrors])
  useEffect(() => { if (tab === 'feedback') fetchFeedback() }, [tab, fetchFeedback])

  async function updateErrorStatus(id: number, status: ErrorStatus) {
    await fetch(`${API}/api/admin/errors/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ status }) })
    setErrors(prev => prev.map(e => e.id === id ? { ...e, status } : e))
    fetchStats()
  }

  async function saveErrorNotes(id: number, notes: string) {
    await fetch(`${API}/api/admin/errors/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ notes }) })
    setErrors(prev => prev.map(e => e.id === id ? { ...e, notes } : e))
    setEditingNotes(null)
  }

  async function deleteError(id: number) {
    if (!confirm('Delete this error report?')) return
    await fetch(`${API}/api/admin/errors/${id}`, { method: 'DELETE', headers })
    setErrors(prev => prev.filter(e => e.id !== id))
    fetchStats()
  }

  async function updateFeedbackStatus(id: number, status: FeedbackStatus) {
    await fetch(`${API}/api/admin/feedback/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ status }) })
    setFeedback(prev => prev.map(f => f.id === id ? { ...f, status } : f))
    fetchStats()
  }

  async function deleteFeedback(id: number) {
    if (!confirm('Delete this feedback?')) return
    await fetch(`${API}/api/admin/feedback/${id}`, { method: 'DELETE', headers })
    setFeedback(prev => prev.filter(f => f.id !== id))
    fetchStats()
  }

  return (
    <div className="admin-page">
      {screenshotModal && (
        <div className="admin-modal-overlay" onClick={() => setScreenshotModal(null)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <button className="admin-modal-close" onClick={() => setScreenshotModal(null)}><X size={20} /></button>
            <img src={screenshotModal} alt="Error screenshot" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8 }} />
          </div>
        </div>
      )}

      <div className="admin-header">
        <h1 className="admin-title">
          <AlertOctagon size={24} />
          Admin Dashboard
        </h1>
        <button className="admin-refresh-btn" onClick={() => { fetchStats(); if (tab === 'errors') fetchErrors(); if (tab === 'feedback') fetchFeedback(); }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="admin-tabs">
        {(['overview', 'errors', 'feedback'] as Tab[]).map(t => (
          <button key={t} className={`admin-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' && 'Overview'}
            {t === 'errors' && <>Error Reports {stats && stats.errors.new > 0 && <span className="admin-badge">{stats.errors.new}</span>}</>}
            {t === 'feedback' && <>User Feedback {stats && stats.feedback.new > 0 && <span className="admin-badge">{stats.feedback.new}</span>}</>}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <div className="admin-overview">
          <div className="admin-stat-group">
            <h3 className="admin-stat-group-title"><AlertOctagon size={16} /> Error Reports</h3>
            <div className="admin-stat-cards">
              <div className="admin-stat-card total"><div className="stat-num">{stats.errors.total}</div><div className="stat-label">Total</div></div>
              <div className="admin-stat-card new"><div className="stat-num">{stats.errors.new}</div><div className="stat-label">New</div></div>
              <div className="admin-stat-card progress"><div className="stat-num">{stats.errors.in_progress}</div><div className="stat-label">In Progress</div></div>
              <div className="admin-stat-card solved"><div className="stat-num">{stats.errors.solved}</div><div className="stat-label">Solved</div></div>
            </div>
          </div>
          <div className="admin-stat-group">
            <h3 className="admin-stat-group-title"><MessageSquare size={16} /> User Feedback</h3>
            <div className="admin-stat-cards">
              <div className="admin-stat-card total"><div className="stat-num">{stats.feedback.total}</div><div className="stat-label">Total</div></div>
              <div className="admin-stat-card new"><div className="stat-num">{stats.feedback.new}</div><div className="stat-label">New</div></div>
              <div className="admin-stat-card progress"><div className="stat-num">{stats.feedback.in_progress}</div><div className="stat-label">In Progress</div></div>
              <div className="admin-stat-card solved"><div className="stat-num">{stats.feedback.resolved}</div><div className="stat-label">Resolved</div></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'errors' && (
        <div className="admin-section">
          <div className="admin-filter-bar">
            {(['all', 'new', 'in_progress', 'solved'] as ErrorFilter[]).map(f => (
              <button key={f} className={`admin-filter-btn${errorFilter === f ? ' active' : ''}`} onClick={() => setErrorFilter(f)}>
                {f === 'all' ? 'All' : STATUS_LABELS[f]}
              </button>
            ))}
          </div>

          {loading ? <div className="admin-loading">Loading...</div> : errors.length === 0 ? (
            <div className="admin-empty"><CheckCircle size={40} /><p>No error reports found</p></div>
          ) : (
            <div className="admin-list">
              {errors.map(err => (
                <div key={err.id} className={`admin-item admin-item--${err.status}`}>
                  <div className="admin-item-header" onClick={() => setExpandedError(expandedError === err.id ? null : err.id)}>
                    <div className="admin-item-left">
                      <span className="admin-status-dot" style={{ background: STATUS_COLORS[err.status] }} />
                      <div>
                        <div className="admin-item-title">{err.error_message?.slice(0, 100) || 'Unknown error'}</div>
                        <div className="admin-item-meta">{formatDate(err.created_at)} · {err.url}</div>
                      </div>
                    </div>
                    <div className="admin-item-actions" onClick={e => e.stopPropagation()}>
                      <select
                        className="admin-status-select"
                        value={err.status}
                        onChange={e => updateErrorStatus(err.id, e.target.value as ErrorStatus)}
                      >
                        <option value="new">New</option>
                        <option value="in_progress">In Progress</option>
                        <option value="solved">Solved</option>
                      </select>
                      {err.screenshot_path && (
                        <button className="admin-icon-btn" title="View screenshot" onClick={() => setScreenshotModal(`${API}/api/admin/screenshot?path=${encodeURIComponent(err.screenshot_path!)}`)}>
                          <Image size={15} />
                        </button>
                      )}
                      <button className="admin-icon-btn danger" title="Delete" onClick={() => deleteError(err.id)}>
                        <Trash2 size={15} />
                      </button>
                      {expandedError === err.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {expandedError === err.id && (
                    <div className="admin-item-body">
                      <div className="admin-detail-label">Stack Trace</div>
                      <pre className="admin-stack">{err.stack_trace || 'No stack trace'}</pre>
                      <div className="admin-detail-label">User Agent</div>
                      <div className="admin-detail-value">{err.user_agent || '—'}</div>
                      <div className="admin-detail-label">Notes</div>
                      {editingNotes?.id === err.id ? (
                        <div className="admin-notes-edit">
                          <textarea
                            value={editingNotes.value}
                            onChange={e => setEditingNotes({ id: err.id, value: e.target.value })}
                            rows={3}
                            className="admin-notes-textarea"
                            autoFocus
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            <button className="admin-save-btn" onClick={() => saveErrorNotes(err.id, editingNotes.value)}>Save</button>
                            <button className="admin-cancel-btn" onClick={() => setEditingNotes(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="admin-notes-view" onClick={() => setEditingNotes({ id: err.id, value: err.notes || '' })}>
                          {err.notes || <span style={{ color: '#aaa' }}>Click to add notes…</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'feedback' && (
        <div className="admin-section">
          <div className="admin-filter-bar">
            {(['all', 'new', 'in_progress', 'resolved'] as FeedbackFilter[]).map(f => (
              <button key={f} className={`admin-filter-btn${feedbackFilter === f ? ' active' : ''}`} onClick={() => setFeedbackFilter(f)}>
                {f === 'all' ? 'All' : STATUS_LABELS[f]}
              </button>
            ))}
          </div>

          {loading ? <div className="admin-loading">Loading...</div> : feedback.length === 0 ? (
            <div className="admin-empty"><CheckCircle size={40} /><p>No feedback submitted yet</p></div>
          ) : (
            <div className="admin-list">
              {feedback.map(fb => (
                <div key={fb.id} className={`admin-item admin-item--${fb.status}`}>
                  <div className="admin-item-header" onClick={() => setExpandedFeedback(expandedFeedback === fb.id ? null : fb.id)}>
                    <div className="admin-item-left">
                      <span className="admin-status-dot" style={{ background: STATUS_COLORS[fb.status] }} />
                      <div>
                        <div className="admin-item-title">{fb.subject || fb.message.slice(0, 80)}</div>
                        <div className="admin-item-meta">{formatDate(fb.created_at)} · {fb.user_email} · <span className="admin-category">{fb.category}</span></div>
                      </div>
                    </div>
                    <div className="admin-item-actions" onClick={e => e.stopPropagation()}>
                      <select
                        className="admin-status-select"
                        value={fb.status}
                        onChange={e => updateFeedbackStatus(fb.id, e.target.value as FeedbackStatus)}
                      >
                        <option value="new">New</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                      <button className="admin-icon-btn danger" title="Delete" onClick={() => deleteFeedback(fb.id)}>
                        <Trash2 size={15} />
                      </button>
                      {expandedFeedback === fb.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {expandedFeedback === fb.id && (
                    <div className="admin-item-body">
                      <div className="admin-detail-label">Message</div>
                      <div className="admin-detail-value" style={{ whiteSpace: 'pre-wrap' }}>{fb.message}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'overview' && !stats && (
        <div className="admin-loading">Loading stats…</div>
      )}

      {tab === 'overview' && stats && (
        <div className="admin-quick-links">
          <button className="admin-quick-btn" onClick={() => { setTab('errors'); setErrorFilter('new') }}>
            <AlertCircle size={16} /> View new errors ({stats.errors.new})
          </button>
          <button className="admin-quick-btn" onClick={() => { setTab('feedback'); setFeedbackFilter('new') }}>
            <MessageSquare size={16} /> View new feedback ({stats.feedback.new})
          </button>
        </div>
      )}
    </div>
  )
}
