import { useEffect, useRef, useState } from 'react'
import { AlertOctagon, Archive, Clock, Paperclip, RotateCcw, Star, Tag, Calendar, AlarmClock, Edit, Reply, Forward } from 'lucide-react'
import { createPortal } from 'react-dom'

interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
  isStarred?: boolean
  isRead?: boolean
  isDeleted?: boolean
  folder?: string
  hasAttachments?: boolean
}

function extractFileCardsHtml(body: string): string {
  if (!body || !/data-file-card/i.test(body)) return ''
  try {
    const doc = new DOMParser().parseFromString(`<div>${body}</div>`, 'text/html')
    const cards = doc.querySelectorAll('[data-file-card]')
    if (!cards.length) return ''
    return Array.from(cards).map(card => {
      card.querySelectorAll('[data-remove-file], [data-upload-overlay], [data-folder-progress]').forEach(el => el.remove())
      card.removeAttribute('contenteditable')
      return card.outerHTML
    }).join('')
  } catch { return '' }
}

interface Label {
  id: number
  name: string
  color: string
}

interface DeletePageProps {
  token: string
  onViewEmail: (email: Email) => void
}

const getSnoozeOptions = () => {
  const now = new Date();
  const opt1 = new Date(now.getTime() + 4 * 3600000);
  const opt2 = new Date(now); opt2.setDate(opt2.getDate() + 1); opt2.setHours(8, 0, 0, 0);
  const opt3 = new Date(now); opt3.setDate(opt3.getDate() + 2); opt3.setHours(8, 0, 0, 0);
  const dayName3 = opt3.toLocaleDateString('en-US', {weekday: 'short'});
  const getDayMon = (d: Date) => (d.getDay() + 6) % 7;
  const prefix3 = getDayMon(opt3) <= getDayMon(now) ? 'Next week' : 'This week';
  const opt4 = new Date(now); opt4.setDate(opt4.getDate() + 3); opt4.setHours(8, 0, 0, 0);
  const dayName4 = opt4.toLocaleDateString('en-US', {weekday: 'short'});
  const prefix4 = getDayMon(opt4) <= getDayMon(now) ? 'Next week later' : 'This week later';
  const opt5 = new Date(now); opt5.setDate(opt5.getDate() + ((7 - now.getDay()) % 7 || 7)); opt5.setHours(8, 0, 0, 0);
  const prefix5 = now.getDay() === 0 ? 'Next weekend' : 'This weekend';
  return [
    { label: 'Later today (4 hours)', shortLabel: 'Later today', timeText: opt1.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }), hours: 4 },
    { label: `Tomorrow (8:00 AM)`, shortLabel: 'Tomorrow', timeText: `${opt2.toLocaleDateString('en-US', {weekday: 'short'})}, 8:00 AM`, hours: (opt2.getTime() - now.getTime()) / 3600000 },
    { label: `${prefix3} (${dayName3}, 8:00 AM)`, shortLabel: prefix3, timeText: `${dayName3}, 8:00 AM`, hours: (opt3.getTime() - now.getTime()) / 3600000 },
    { label: `${prefix4} (${dayName4}, 8:00 AM)`, shortLabel: prefix4, timeText: `${dayName4}, 8:00 AM`, hours: (opt4.getTime() - now.getTime()) / 3600000 },
    { label: `${prefix5} (Sun, 8:00 AM)`, shortLabel: prefix5, timeText: 'Sun, 8:00 AM', hours: (opt5.getTime() - now.getTime()) / 3600000 },
  ];
}

const API = 'http://localhost:5050'

export default function DeletePage({ token, onViewEmail }: DeletePageProps) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [labels, setLabels] = useState<Label[]>([])
  const [snoozeId, setSnoozeId] = useState<number | null>(null)
  const [labelId, setLabelId] = useState<number | null>(null)
  const [customSnoozePopupEmailId, setCustomSnoozePopupEmailId] = useState<number | null>(null)
  const [customSnoozeDate, setCustomSnoozeDate] = useState('')
  const [snoozeHour, setSnoozeHour] = useState(12)
  const [snoozeMinute, setSnoozeMinute] = useState(0)
  const [snoozePeriod, setSnoozePeriod] = useState<'AM' | 'PM'>('PM')
  const [calendarViewMonth, setCalendarViewMonth] = useState(new Date().getMonth())
  const [calendarViewYear, setCalendarViewYear] = useState(new Date().getFullYear())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { load(); fetchLabels() }, [token])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSnoozeId(null)
        setLabelId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/delete`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setEmails(res.ok && data.emails ? data.emails : [])
    } catch {
      setError('Failed to load deleted emails')
      setEmails([])
    } finally {
      setLoading(false)
    }
  }

  const fetchLabels = async () => {
    try {
      const res = await fetch(`${API}/api/custom-labels`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok && data.labels) setLabels(data.labels)
    } catch {}
  }

  const authHeaders = { Authorization: `Bearer ${token}` }
  const jsonHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const removeFromList = (emailId: number) =>
    setEmails(prev => prev.filter(e => e.id !== emailId))

  const restore = async (emailId: number) => {
    const res = await fetch(`${API}/api/emails/${emailId}/restore`, { method: 'PUT', headers: authHeaders })
    if (res.ok) removeFromList(emailId)
    return res.ok
  }

  const handleRestore = async (id: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!id) return
    await restore(id)
  }

  const handleStar = async (id: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!id) return
    if (!await restore(id)) return
    await fetch(`${API}/api/emails/${id}/star`, { method: 'PUT', headers: authHeaders })
  }

  const handleArchive = async (id: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!id) return
    if (!await restore(id)) return
    await fetch(`${API}/api/emails/${id}/archive`, { method: 'PUT', headers: authHeaders })
  }

  const handleSpam = async (id: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!id) return
    if (!await restore(id)) return
    await fetch(`${API}/api/emails/${id}/spam`, { method: 'PUT', headers: authHeaders })
  }

  const handleSnooze = async (id: number, hours: number) => {
    setSnoozeId(null)
    if (!await restore(id)) return
    await fetch(`${API}/api/emails/${id}/snooze`, {
      method: 'PUT', headers: jsonHeaders,
      body: JSON.stringify({ hours }),
    })
  }

  const handleLabel = async (id: number, labelName: string) => {
    setLabelId(null)
    if (!await restore(id)) return
    await fetch(`${API}/api/emails/${id}/label`, {
      method: 'PUT', headers: jsonHeaders,
      body: JSON.stringify({ label_name: labelName }),
    })
  }

  const toggleSnooze = (id: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!id) return
    setSnoozeId(prev => prev === id ? null : id)
    setLabelId(null)
  }

  const toggleLabel = (id: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!id) return
    setLabelId(prev => prev === id ? null : id)
    setSnoozeId(null)
  }

  return (
    <div className="email-container" ref={containerRef}>
      {error && <div className="message error">{error}</div>}
      {loading && <div className="loading">Loading deleted emails...</div>}

      {emails.length > 0 && (
        <div className="email-list">
          {emails.map((email, idx) => (
            <div
              key={email.id ?? idx}
              className={`email-item delete-folder-item${!email.isRead && email.folder !== 'sent' && email.folder !== 'drafts' ? ' unread' : ''}${email.folder === 'sent' ? ' sent' : ''}`}
              onClick={() => onViewEmail(email)}
            >
              {/* Sender column */}
              <div className="email-from">
                {email.folder === 'drafts'
                  ? <><span style={{ color: '#ff5722', fontWeight: 700 }}>Draft:</span>{' '}<span style={{ fontWeight: 600 }}>{(email.to || '').split('@')[0]}</span></>
                  : email.folder === 'sent'
                    ? <><span style={{ color: '#ff9800', fontWeight: 700 }}>To:</span>{' '}<span style={{ fontWeight: 600 }}>{(email.to || '').split('@')[0]}</span></>
                    : <span style={{ fontWeight: 600, color: email.isRead ? '#111' : '#0288d1' }}>{(email.from || '').split('@')[0]}</span>
                }
                <span className="delete-folder-badge">Deleted</span>
              </div>

              {/* Subject + preview column */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div className="email-subject" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'relative' }}>
                  {(() => { const s = (email.subject || '').toLowerCase().trim(); if (s.startsWith('re:')) return <span className="reply-status-icon"><Reply size={14} /></span>; if (s.startsWith('fwd:') || s.startsWith('fw:')) return <span className="reply-status-icon"><Forward size={14} /></span>; return null; })()}
                  {(!!email.hasAttachments || /data-file-card/i.test(email.body || '')) && <Paperclip size={13} style={{ color: '#888', flexShrink: 0, marginRight: '2px', verticalAlign: 'middle' }} />}
                  <span style={{ color: (!email.subject || email.subject === '(No subject)') ? '#888' : 'inherit' }}>{(() => { const raw = email.subject || ''; const low = raw.toLowerCase().trim(); if (low.startsWith('re:') || low.startsWith('fwd:') || low.startsWith('fw:')) return raw.slice(raw.indexOf(':') + 1).trim() || '(No subject)'; return raw || '(No subject)'; })()}</span>
                  <span style={{ color: '#999', fontWeight: 400, marginLeft: 8 }}>{(email.body || '').substring(0, 60)}</span>
                </div>
                {(() => { const html = extractFileCardsHtml(email.body || ''); if (!html) return null; return <div style={{ display:'flex', flexDirection:'row', flexWrap:'nowrap', overflow:'hidden', alignItems:'center', gap:'6px', marginTop:'4px', lineHeight:0 }} dangerouslySetInnerHTML={{ __html: html }} /> })()}
              </div>

              {/* Action buttons — outside email-from so never clipped */}
              <div
                className="delete-action-buttons"
                onClick={e => e.stopPropagation()}
                style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, position: 'relative' }}
              >
                <button className={`action-btn star-btn${email.isStarred ? ' active' : ''}`} onClick={e => handleStar(email.id, e)} title="Restore & Star">
                  <Star size={15} fill={email.isStarred ? 'currentColor' : 'none'} />
                </button>
                <button className="action-btn restore-btn" onClick={e => handleRestore(email.id, e)} title="Restore to inbox">
                  <RotateCcw size={15} />
                </button>
                <button className="action-btn archive-btn" onClick={e => handleArchive(email.id, e)} title="Restore & Archive">
                  <Archive size={15} />
                </button>
                <button className="action-btn spam-btn" onClick={e => handleSpam(email.id, e)} title="Restore & Spam">
                  <AlertOctagon size={15} />
                </button>

                {/* Snooze dropdown */}
                <div style={{ position: 'relative' }}>
                  <button
                    className={`action-btn snooze-btn${snoozeId === email.id ? ' active' : ''}`}
                    onClick={e => toggleSnooze(email.id, e)}
                    title="Restore & Snooze"
                  >
                    <Clock size={15} />
                  </button>
                  {snoozeId === email.id && (
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{ position: 'absolute', bottom: '100%', right: 0, zIndex: 999, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', minWidth: 240, padding: '4px 0' }}
                    >
                      <div style={{ padding: '8px 14px 6px', fontSize: '12px', fontWeight: 600, color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #f0f0f0' }}>
                        <Clock size={13} style={{ flexShrink: 0 }} />
                        Snooze until...
                      </div>
                    {getSnoozeOptions().map(opt => (
                        <div
                        key={opt.label}
                          style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                          onClick={() => handleSnooze(email.id!, opt.hours)}
                        >
                          <span>{opt.shortLabel}</span>
                          <span style={{ color: '#888', fontWeight: 500, fontSize: '13px', whiteSpace: 'nowrap' }}>
                            {opt.timeText}
                          </span>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
                      <div
                        style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                        onClick={(e) => {
                          e.stopPropagation();
                          const ref = new Date();
                          const h = ref.getHours();
                          setSnoozeHour(h % 12 || 12);
                          setSnoozeMinute(ref.getMinutes());
                          setSnoozePeriod(h >= 12 ? 'PM' : 'AM');
                          setCalendarViewMonth(ref.getMonth());
                          setCalendarViewYear(ref.getFullYear());
                          setCustomSnoozeDate('');
                          setCustomSnoozePopupEmailId(email.id!);
                          setSnoozeId(null);
                        }}
                      >
                        <Calendar size={15} style={{ flexShrink: 0, color: '#666' }} />
                        Pick date &amp; time
                      </div>
                    </div>
                  )}
                </div>

                {/* Label dropdown */}
                {labels.length > 0 && (
                  <div style={{ position: 'relative' }}>
                    <button
                      className={`action-btn label-btn${labelId === email.id ? ' active' : ''}`}
                      onClick={e => toggleLabel(email.id, e)}
                      title="Restore & Move to Label"
                    >
                      <Tag size={15} />
                    </button>
                    {labelId === email.id && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ position: 'absolute', bottom: '100%', right: 0, zIndex: 999, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', minWidth: 160, padding: '4px 0' }}
                      >
                        {labels.map(label => (
                          <div
                            key={label.id}
                            style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#333', display: 'flex', alignItems: 'center', gap: 8 }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                            onClick={() => handleLabel(email.id!, label.name)}
                          >
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: label.color, flexShrink: 0 }} />
                            {label.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Date */}
              {email.folder === 'drafts' && <Edit size={16} style={{ color: '#ff5722', flexShrink: 0 }} />}
              <span className="email-date" style={{ color: email.folder === 'drafts' ? '#ff5722' : !email.isRead && email.folder !== 'sent' ? '#0288d1' : '#666', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {new Date(email.date).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {emails.length === 0 && !loading && (
        <div className="empty-state"><p>No emails in deleted folder</p></div>
      )}

      {customSnoozePopupEmailId !== null && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setCustomSnoozePopupEmailId(null); setCustomSnoozeDate('') }}
        >
          <div
            style={{ background: '#f0f0f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customSnoozeDate && customSnoozePopupEmailId !== null) {
                e.preventDefault()
                const hour24 = snoozePeriod === 'AM' ? snoozeHour % 12 : (snoozeHour % 12) + 12
                const dateTimeStr = `${customSnoozeDate}T${String(hour24).padStart(2,'0')}:${String(snoozeMinute).padStart(2,'0')}`
                const date = new Date(dateTimeStr)
                const diff = date.getTime() - new Date().getTime()
                const hours = diff / (1000 * 60 * 60)
                if (hours > 0) handleSnooze(customSnoozePopupEmailId, hours)
                else alert('Please select a future time')
                setCustomSnoozePopupEmailId(null)
                setCustomSnoozeDate('')
              }
            }}
          >
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlarmClock size={17} color="#fb8c00" />
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#333' }}>Pick date &amp; time</span>
            </div>

            {(() => {
              const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
              const todayStr = new Date().toISOString().slice(0, 10)
              const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate()
              const firstDay = new Date(calendarViewYear, calendarViewMonth, 1).getDay()

              return (
                <div style={{ display: 'flex' }}>
                  <div style={{ padding: '22px 20px', borderRight: '1px solid #e0e0e0', width: '310px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 600, color: '#333' }}>{MONTH_NAMES[calendarViewMonth]} {calendarViewYear}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={(e) => { e.stopPropagation(); calendarViewMonth === 0 ? (setCalendarViewMonth(11), setCalendarViewYear(y => y - 1)) : setCalendarViewMonth(m => m - 1) }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} style={{ background: 'transparent', backgroundColor: 'white', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#666', lineHeight: 1, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background-color 0.2s ease', paddingBottom: '2px' }}>‹</button>
                        <button onClick={(e) => { e.stopPropagation(); calendarViewMonth === 11 ? (setCalendarViewMonth(0), setCalendarViewYear(y => y + 1)) : setCalendarViewMonth(m => m + 1) }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} style={{ background: 'transparent', backgroundColor: 'white', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#666', lineHeight: 1, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background-color 0.2s ease', paddingBottom: '2px' }}>›</button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)', marginBottom: '6px' }}>
                      {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                        <div key={d} style={{ fontSize: '12px', color: '#bbb', textAlign: 'center', padding: '4px 0', fontWeight: 600 }}>{d}</div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 38px)', gap: '2px', minHeight: '238px' }}>
                      {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                        const dateStr = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                        const isSelected = customSnoozeDate === dateStr
                        const isToday = dateStr === todayStr
                        const isPast = dateStr < todayStr
                        return (
                          <button key={day} disabled={isPast} onClick={(e) => { e.stopPropagation(); setCustomSnoozeDate(dateStr) }} style={{ width: '38px', height: '38px', backgroundColor: 'white', border: 'none', borderRadius: '50%', cursor: isPast ? 'default' : 'pointer', background: isSelected ? '#0288d1' : '#f5f5f5', color: isSelected ? '#fff' : isPast ? '#ddd' : isToday ? '#0288d1' : '#333', fontWeight: isSelected || isToday ? 700 : 400, fontSize: '14px' }}>{day}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '28px', width: '230px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '14px', color: '#888', fontWeight: 500 }}>Date</div>
                      <div style={{ fontSize: '15px', color: customSnoozeDate ? '#333' : '#ccc', fontWeight: customSnoozeDate ? 500 : 400, minHeight: '22px' }}>
                        {customSnoozeDate ? (() => { const [y,m,d] = customSnoozeDate.split('-'); return `${d}/${m}/${y}` })() : 'DD/MM/YYYY'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '14px', color: '#888', fontWeight: 500 }}>Time</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input type="number" min={1} max={12} value={snoozeHour} onClick={(e) => e.stopPropagation()} onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) setSnoozeHour(Math.min(12, Math.max(1, v))) }} onBlur={(e) => { const v = Number(e.target.value); setSnoozeHour(isNaN(v) || v < 1 ? 1 : v > 12 ? 12 : v) }} style={{ width: '50px', padding: '7px 4px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '15px', outline: 'none', textAlign: 'center', MozAppearance: 'textfield', fontWeight: 500, fontFamily: 'inherit' } as React.CSSProperties} />
                        <span style={{ fontWeight: 700, color: '#555', fontSize: '16px' }}>:</span>
                        <input type="number" min={0} max={59} value={String(snoozeMinute).padStart(2, '0')} onClick={(e) => e.stopPropagation()} onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) setSnoozeMinute(Math.min(59, Math.max(0, v))) }} onBlur={(e) => { const v = Number(e.target.value); setSnoozeMinute(isNaN(v) || v < 0 ? 0 : v > 59 ? 59 : v) }} style={{ width: '50px', padding: '7px 4px', border: '1.5px solid #c0c0c0', borderRadius: '8px', fontSize: '15px', outline: 'none', textAlign: 'center', MozAppearance: 'textfield', fontWeight: 500, fontFamily: 'inherit' } as React.CSSProperties} />
                        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid #c0c0c0', marginLeft: '4px' }}>
                          {(['AM', 'PM'] as const).map(p => (
                            <button key={p} onClick={(e) => { e.stopPropagation(); setSnoozePeriod(p) }} style={{ padding: '6px 4px', backgroundColor: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, background: snoozePeriod === p ? '#0288d1' : '#fafafa', color: snoozePeriod === p ? '#fff' : '#999', transition: 'background 0.15s' }}>{p}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid #e0e0e0' }}>
              <button onClick={(e) => { e.stopPropagation(); setCustomSnoozePopupEmailId(null); setCustomSnoozeDate('') }} style={{ width: '90px', padding: '8px 0', borderRadius: '20px', border: '1.5px solid #c0c0c0', background: '#fff', color: '#555', fontSize: '15px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}>Cancel</button>
              <button disabled={!customSnoozeDate} onClick={async (e) => {
                e.stopPropagation()
                if (!customSnoozeDate || customSnoozePopupEmailId === null) return
                const hour24 = snoozePeriod === 'AM' ? snoozeHour % 12 : (snoozeHour % 12) + 12
                const dateTimeStr = `${customSnoozeDate}T${String(hour24).padStart(2,'0')}:${String(snoozeMinute).padStart(2,'0')}`
                const date = new Date(dateTimeStr)
                const diff = date.getTime() - new Date().getTime()
                const hours = diff / (1000 * 60 * 60)
                if (hours > 0) handleSnooze(customSnoozePopupEmailId, hours)
                else alert('Please select a future time')
                setCustomSnoozePopupEmailId(null)
                setCustomSnoozeDate('')
              }} style={{ width: '90px', padding: '8px 0', borderRadius: '20px', backgroundColor: 'white', border: 'none', background: customSnoozeDate ? '#0288d1' : '#b3d9f0', color: '#fff', fontSize: '15px', cursor: customSnoozeDate ? 'pointer' : 'not-allowed', fontWeight: 600, transition: 'all 0.15s' }}>Save</button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
