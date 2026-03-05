import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom'
import './App.css'
import LoginPage from './pages/LoginPage'
import InboxPage from './pages/InboxPage'
import SentPage from './pages/SentPage'
import StarredPage from './pages/StarredPage'
import SnoozedPage from './pages/SnoozedPage'
import DraftsPage from './pages/DraftsPage'
import ArchivedPage from './pages/ArchivedPage'
import PurchasedPage from './pages/PurchasedPage'
import AllMailsPage from './pages/AllMailsPage'
import ScheduledPage from './pages/ScheduledPage'
import ImportantPage from './pages/ImportantPage'
import SpamPage from './pages/SpamPage'
import TrashPage from './pages/TrashPage'
import SubscriptionsPage from './pages/SubscriptionsPage'
import LabelsPage from './pages/LabelsPage'
import CreateLabelPage from './pages/CreateLabelPage'
import ComposePage from './pages/ComposePage'
import EmailPage from './pages/EmailPage'
import EmailViewer from './pages/EmailViewer'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ConferencePage from './pages/ConferencePage'
import ChatPage from './chat/ChatPage'
import OfficePage from './Office/OfficePage'
import {
  Inbox,
  Send,
  Star,
  Clock,
  FileText,
  Archive,
  ShoppingBag,
  Mail,
  Calendar,
  Flag,
  AlertCircle,
  Trash2,
  Tag,
  Bell,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit3,
  MessageSquare,
  Users,
  FileCode,
  MoreHorizontal,
  Layers,
  Video,
  StickyNote,
  Sheet,
  FileJson
} from 'lucide-react'


interface Email {
  id?: number
  subject: string
  from: string
  to: string
  date: string
  body: string
}

interface LabelNode {
  id: number
  name: string
  color: string
  children?: LabelNode[]
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem('userEmail'))
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [resetEmail, setResetEmail] = useState<string>('')
  const [resetToken, setResetToken] = useState<string>('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [moreExpanded, setMoreExpanded] = useState(false)
  const [activeApp, setActiveApp] = useState<'mail' | 'calendar' | 'contacts' | 'groups' | 'notes' | 'sheets' | 'docs' | 'more'>('mail')
  const [activeSidebarSection, setActiveSidebarSection] = useState<string>('inbox')
  const [customLabels, setCustomLabels] = useState<LabelNode[]>([])
  const [expandedLabelGroups, setExpandedLabelGroups] = useState<Set<number>>(new Set())
  const [openLabelMenu, setOpenLabelMenu] = useState<number | null>(null)
  const [menuButtonClicked, setMenuButtonClicked] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()



  const handleLogin = (newToken: string, email: string) => {
    setToken(newToken)
    setUserEmail(email)
    localStorage.setItem('token', newToken)
    localStorage.setItem('userEmail', email)
    navigate('/inbox')
  }

  const handleLogout = () => {
    setToken(null)
    setUserEmail(null)
    localStorage.removeItem('token')
    localStorage.removeItem('userEmail')
    navigate('/login')
  }

  const handleViewEmail = (email: Email) => {
    setSelectedEmail(email)
    navigate('/view')
  }

  const handleForgotPassword = (email: string, token: string) => {
    setResetEmail(email)
    setResetToken(token)
    navigate('/reset')
  }

  const handlePasswordReset = () => {
    navigate('/login')
    setResetEmail('')
    setResetToken('')
  }

  const fetchCustomLabels = async () => {
    if (!token) return
    try {
      const response = await fetch('http://localhost:5050/api/custom-labels', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setCustomLabels(data.labels)
      }
    } catch (err) {
      console.error('Failed to fetch custom labels:', err)
    }
  }

  useEffect(() => {
    if (token) {
      fetchCustomLabels()
    }
  }, [token])

  // Auto-collapse sidebar based on width and user action
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 350) {
        // Always expand sidebar at width >= 350px
        setSidebarCollapsed(false)
        setMenuButtonClicked(false)
      } else if (window.innerWidth < 350 && !menuButtonClicked) {
        // Auto-collapse at width < 350px only if no menu button was clicked
        setSidebarCollapsed(true)
      }
    }

    window.addEventListener('resize', handleResize)
    // Check on initial load
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [menuButtonClicked])

  const handleMailBtnClick = () => {
    setActiveApp(activeApp === 'mail' ? '' as any : 'mail')
    setMenuButtonClicked(true)
    setSidebarCollapsed(false)
  }

  const handleCalendarBtnClick = () => {
    setActiveApp(activeApp === 'calendar' ? '' as any : 'calendar')
    setMenuButtonClicked(true)
    setSidebarCollapsed(false)
  }

  const handleContactsClick = () => {
    setActiveApp(activeApp === 'contacts' ? '' as any : 'contacts')
    setMenuButtonClicked(true)
    setSidebarCollapsed(false)
  }

  const handleGroupsClick = () => {
    setActiveApp(activeApp === 'groups' ? '' as any : 'groups')
    setMenuButtonClicked(true)
    setSidebarCollapsed(false)
  }

  const handleConferenceClick = () => {
    window.open('/conference', 'Conference', 'width=1200,height=800,resizable=yes,scrollbars=yes')
  }

  const handleChatClick = () => {
    window.open('/chat', 'Chat', 'width=1200,height=800,resizable=yes,scrollbars=yes')
  }

  const handleOfficeClick = (tab: string = 'notes') => {
    window.open(`/office?tab=${tab}`, 'Office', 'width=1400,height=900,resizable=yes,scrollbars=yes')
  }

  const handleNotesClick = () => {
    handleOfficeClick('notes')
  }

  const handleWordClick = () => {
    handleOfficeClick('docs')
  }

  const handlePdfClick = () => {
    handleOfficeClick('pdf')
  }

  const handleExcelClick = () => {
    handleOfficeClick('sheets')
  }

  // Sidebar section handlers
  const handleSidebarSection = (section: string) => {
    setActiveSidebarSection(section)
    setActiveApp('mail')
  }

  const handleInboxClick = () => {
    handleSidebarSection('inbox')
    navigate('/inbox')
  }
  const handleSentClick = () => {
    handleSidebarSection('sent')
    navigate('/sent')
  }
  const handleStarredClick = () => {
    handleSidebarSection('starred')
    navigate('/starred')
  }
  const handleSnoozedClick = () => {
    handleSidebarSection('snoozed')
    navigate('/snoozed')
  }
  const handleDraftsClick = () => {
    handleSidebarSection('drafts')
    navigate('/drafts')
  }
  const handleArchiveClick = () => {
    handleSidebarSection('archive')
    navigate('/archived')
  }
  const handlePurchasesClick = () => {
    handleSidebarSection('purchases')
    navigate('/purchased')
  }
  const handleGroupsSidebarClick = () => {
    setActiveApp('groups')
    setMenuButtonClicked(true)
    setSidebarCollapsed(false)
  }
  const handleAllMailsClick = () => {
    handleSidebarSection('all-mails')
    navigate('/allmails')
  }
  const handleScheduledClick = () => {
    handleSidebarSection('scheduled')
    navigate('/scheduled')
  }
  const handleImportantClick = () => {
    handleSidebarSection('important')
    navigate('/important')
  }
  const handleSpamClick = () => {
    handleSidebarSection('spam')
    navigate('/spam')
  }
  const handleTrashClick = () => {
    handleSidebarSection('trash')
    navigate('/trash')
  }
  const handleManageSubscriptionClick = () => {
    handleSidebarSection('manage-subscription')
    navigate('/subscriptions')
  }
  const handleManageLabelsClick = () => {
    handleSidebarSection('manage-labels')
    navigate('/labels')
  }
  const handleLabelClick = (label: {id: number, name: string, color: string}, parentName?: string) => {
    handleSidebarSection(`label-${label.id}`)
    const displayName = parentName ? `${parentName} / ${label.name}` : label.name
    navigate(`/labels/${encodeURIComponent(displayName)}`)
  }

  const handleAddLabelClick = () => {
    navigate('/create-label')
  }

  const handleLabelCreated = () => {
    fetchCustomLabels()
  }

  const handleDeleteLabel = async (labelId: number) => {
    if (!window.confirm('Are you sure you want to delete this label?')) {
      return
    }
    try {
      const response = await fetch(`http://localhost:5050/api/custom-labels/${labelId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        // Recursively remove label from tree
        const removeFromTree = (labels: LabelNode[]): LabelNode[] => {
          return labels
            .filter(label => label.id !== labelId)
            .map(label => ({
              ...label,
              children: label.children ? removeFromTree(label.children) : []
            }))
        }
        setCustomLabels(removeFromTree(customLabels))
      } else {
        alert('Failed to delete label')
      }
    } catch (err) {
      console.error('Failed to delete label:', err)
      alert('Failed to delete label')
    }
  }

  const handleToggleLabelGroup = (labelId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const newExpanded = new Set(expandedLabelGroups)
    if (newExpanded.has(labelId)) {
      newExpanded.delete(labelId)
    } else {
      newExpanded.add(labelId)
    }
    setExpandedLabelGroups(newExpanded)
  }

  const handleMoveLabel = async (_labelId: number) => {
    // TODO: Implement move functionality
    // For now, just close the menu
    setOpenLabelMenu(null)
  }

  const handleCreateSubLabel = (parentId: number) => {
    navigate('/create-label', { state: { parentLabelId: parentId } })
    setOpenLabelMenu(null)
  }

  // Recursive function to render label tree
  // Collect all expanded labels for collapsed sidebar vertical display
  const getExpandedLabelsList = (labels: LabelNode[], result: LabelNode[] = []): LabelNode[] => {
    labels.forEach(label => {
      result.push(label)
      if (label.children && expandedLabelGroups.has(label.id)) {
        getExpandedLabelsList(label.children, result)
      }
    })
    return result
  }

  const renderLabelNode = (label: LabelNode, depth: number, pathNames: string[] = []): React.ReactNode => {
    const currentPath = [...pathNames, label.name]
    const displayName = currentPath.join(' / ')
    const hasChildren = label.children && label.children.length > 0

    // In collapsed sidebar, only show labels that are expanded (or top-level labels)
    // Collapsed sidebar: render only icon in vertical line
    if (sidebarCollapsed) {
      return (
        <div key={label.id}>
          <button
            className={`sidebar-item custom-label ${activeSidebarSection === `label-${label.id}` ? 'active' : ''}`}
            title={displayName}
            onClick={() => handleLabelClick(label, pathNames.join(' / '))}
            style={{ color: label.color, padding: '8px', justifyContent: 'center' }}
          >
            <Tag size={20} className="label-icon" style={{ color: label.color, fill: 'currentColor', opacity: 0.8 }} />
          </button>
          {/* Recursively render children if expanded */}
          {hasChildren && expandedLabelGroups.has(label.id) && (
            <div>
              {label.children!.map(child => renderLabelNode(child, depth + 1, currentPath))}
            </div>
          )}
        </div>
      )
    }

    // Regular sidebar: render with hierarchy
    return (
      <div key={label.id}>
        <div className="sidebar-label-item-wrapper" style={{ marginLeft: `${depth * 12}px` }}>
          {/* Toggle Button - Only show if children exist */}
          {hasChildren && (
            <button
              className="label-toggle-btn"
              onClick={(e) => handleToggleLabelGroup(label.id, e)}
              title={expandedLabelGroups.has(label.id) ? 'Collapse' : 'Expand'}
            >
              {expandedLabelGroups.has(label.id) ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          )}
          <button
            className={`sidebar-item custom-label ${activeSidebarSection === `label-${label.id}` ? 'active' : ''}`}
            title={displayName}
            onClick={() => handleLabelClick(label, pathNames.join(' / '))}
            style={{ color: label.color }}
          >
            <Tag size={20} className="label-icon" style={{ color: label.color, fill: 'currentColor', opacity: 0.8 }} />
            <span>{label.name}</span>
          </button>
          <div className="label-actions">
            <button
              className="label-more-btn"
              onClick={(e) => {
                e.stopPropagation()
                setOpenLabelMenu(openLabelMenu === label.id ? null : label.id)
              }}
              title="More options"
            >
              <MoreHorizontal size={18} />
            </button>
            {openLabelMenu === label.id && (
              <div className="label-menu-dropdown">
                <button className="menu-item" onClick={() => { handleCreateSubLabel(label.id) }}>
                  Create Sub-Label
                </button>
                <button className="menu-item" onClick={() => { handleMoveLabel(label.id); setOpenLabelMenu(null) }}>
                  Move
                </button>
                <button className="menu-item delete" onClick={() => { handleDeleteLabel(label.id); setOpenLabelMenu(null) }}>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Recursively render children if expanded */}
        {hasChildren && expandedLabelGroups.has(label.id) && (
          <div>
            {label.children!.map(child => renderLabelNode(child, depth + 1, currentPath))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-container">
      {token && (
        <header className="app-header">
          <div className="header-left">
            <h1>📧 Mail</h1>
          </div>
          <div className="header-right">
            <span>{userEmail}</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </header>
      )}

      {token && !['/conference', '/chat', '/office'].includes(location.pathname) && (
        <div className="app-bar">
          <button className={`app-bar-btn ${activeApp === 'mail' ? 'active' : ''}`} title="Mail" onClick={handleMailBtnClick}>
            <Mail size={20} />
          </button>
          <button className={`app-bar-btn ${activeApp === 'calendar' ? 'active' : ''}`} title="Calendar" onClick={handleCalendarBtnClick}>
            <Calendar size={20} />
          </button>
          <button className={`app-bar-btn ${activeApp === 'contacts' ? 'active' : ''}`} title="Contacts" onClick={handleContactsClick}>
            <Users size={20} />
          </button>
          <button className={`app-bar-btn ${activeApp === 'groups' ? 'active' : ''}`} title="Groups" onClick={handleGroupsClick}>
            <Layers size={20} />
          </button>
          <button className="app-bar-btn" title="Conference" onClick={handleConferenceClick}>
            <Video size={20} />
          </button>
          <button className="app-bar-btn" title="Chat" onClick={handleChatClick}>
            <MessageSquare size={20} />
          </button>
          <button className="app-bar-btn" title="Notes" onClick={() => handleNotesClick()}>
            <StickyNote size={20} />
          </button>
          <button className="app-bar-btn" title="Word" onClick={() => handleWordClick()}>
            <FileText size={20} />
          </button>
          <button className="app-bar-btn" title="PDF" onClick={() => handlePdfClick()}>
            <FileJson size={20} />
          </button>
          <button className="app-bar-btn" title="Excel" onClick={() => handleExcelClick()}>
            <Sheet size={20} />
          </button>
          <button className="app-bar-btn" title="Office" onClick={() => handleOfficeClick('notes')}>
            <FileCode size={20} />
          </button>
          <button className="app-bar-btn" title="More Apps">
            <MoreHorizontal size={20} />
          </button>
        </div>
      )}

      <main className="app-main">
        {/* Login and special pages - shown when not logged in or on special routes */}
        {!token || ['/login', '/reset', '/conference', '/chat', '/office'].includes(location.pathname) ? (
          <Routes>
            <Route path="/" element={<Navigate to={token ? '/inbox' : '/login'} />} />
            <Route path="/login" element={<LoginPage onLogin={handleLogin} onForgotPassword={handleForgotPassword} />} />
            <Route path="/reset" element={<ResetPasswordPage email={resetEmail} resetToken={resetToken} onReset={handlePasswordReset} onCancel={() => { navigate('/login'); setResetEmail(''); setResetToken(''); }} />} />
            <Route path="/conference" element={<ConferencePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/office" element={<OfficePage />} />
            <Route path="*" element={<Navigate to={token ? '/inbox' : '/login'} />} />
          </Routes>
        ) : null}

        {/* Sidebar and content layout - only show when logged in and not on special pages */}
        {token && !['/conference', '/chat', '/office', '/login', '/reset'].includes(location.pathname) && (
          <>
            <div className="app-middle">
              <button
                className="menu-btn"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                ☰
              </button>
            </div>

            {(activeApp === 'mail' || activeApp === 'groups') && (
            <div className={`left-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
              <div className="compose-btn-container">
                <button className="compose-btn" onClick={() => navigate('/compose')}>
                  <Edit3 size={20} />
                  <span>Compose</span>
                </button>
                <button className="chatmail-btn" onClick={() => navigate('/compose')} title="Chat Mail">
                  <MessageSquare size={20} />
                  <span>Chat Mail</span>
                </button>
              </div>

              <div className="sidebar-menu">
              {/* Main Navigation Section - Only show in mail view */}
              {activeApp === 'mail' && (
                <div className="sidebar-section">
                  <button className={`sidebar-item ${activeSidebarSection === 'inbox' ? 'active' : ''}`} title="Inbox" onClick={handleInboxClick}>
                    <Inbox size={20} />
                    <span>Inbox</span>
                  </button>
                  <button className={`sidebar-item ${activeSidebarSection === 'sent' ? 'active' : ''}`} title="Sent" onClick={handleSentClick}>
                    <Send size={20} />
                    <span>Sent</span>
                  </button>
                  <button className={`sidebar-item ${activeSidebarSection === 'starred' ? 'active' : ''}`} title="Starred" onClick={handleStarredClick}>
                    <Star size={20} />
                    <span>Starred</span>
                  </button>
                  <button className={`sidebar-item ${activeSidebarSection === 'snoozed' ? 'active' : ''}`} title="Snoozed" onClick={handleSnoozedClick}>
                    <Clock size={20} />
                    <span>Snoozed</span>
                  </button>
                  <button className={`sidebar-item ${activeSidebarSection === 'drafts' ? 'active' : ''}`} title="Drafts" onClick={handleDraftsClick}>
                    <FileText size={20} />
                    <span>Drafts</span>
                  </button>
                  <button className={`sidebar-item ${activeSidebarSection === 'archive' ? 'active' : ''}`} title="Archive" onClick={handleArchiveClick}>
                    <Archive size={20} />
                    <span>Archive</span>
                  </button>
                  <button className={`sidebar-item ${activeSidebarSection === 'purchases' ? 'active' : ''}`} title="Purchases" onClick={handlePurchasesClick}>
                    <ShoppingBag size={20} />
                    <span>Purchases</span>
                  </button>
                </div>
              )}

              {/* More Section Toggle - Only show in mail view */}
              {activeApp === 'mail' && (
                <div className={`sidebar-item more-toggle ${moreExpanded ? 'expanded' : ''}`}>
                  <button onClick={() => setMoreExpanded(!moreExpanded)}>
                    {moreExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <span>{moreExpanded ? 'Less' : 'More'}</span>
                  </button>
                </div>
              )}

              {/* More Section - Initially Hidden, Only show in mail view */}
              {activeApp === 'mail' && (
                <div className={`sidebar-section more-section ${moreExpanded ? 'expanded' : ''}`}>
                  <button className={`sidebar-item ${activeSidebarSection === 'all-mails' ? 'active' : ''}`} title="All Mails" onClick={handleAllMailsClick}>
                    <Mail size={20} />
                    <span>All Mails</span>
                  </button>
                  <button className={`sidebar-item ${activeSidebarSection === 'scheduled' ? 'active' : ''}`} title="Scheduled" onClick={handleScheduledClick}>
                    <Calendar size={20} />
                    <span>Scheduled</span>
                  </button>
                  <button className={`sidebar-item ${activeSidebarSection === 'important' ? 'active' : ''}`} title="Important" onClick={handleImportantClick}>
                    <Flag size={20} />
                    <span>Important</span>
                  </button>
                  <button className={`sidebar-item ${activeSidebarSection === 'spam' ? 'active' : ''}`} title="Spam" onClick={handleSpamClick}>
                    <AlertCircle size={20} />
                    <span>Spam</span>
                  </button>
                  <button className={`sidebar-item ${activeSidebarSection === 'trash' ? 'active' : ''}`} title="Trash" onClick={handleTrashClick}>
                    <Trash2 size={20} />
                    <span>Trash</span>
                  </button>
                  <button className="sidebar-item" title="Manage Subscription" onClick={handleManageSubscriptionClick}>
                    <Bell size={20} />
                    <span>Manage Subscription</span>
                  </button>
                  <button className="sidebar-item" title="Manage Labels" onClick={handleManageLabelsClick}>
                    <Settings size={20} />
                    <span>Manage Labels</span>
                  </button>
                </div>
              )}

              {/* Labels Section - Only show in mail view */}
              {activeApp === 'mail' && (
                <>
                  <div className="sidebar-section-label">
                    <span>Labels</span>
                    <button className="add-btn" title="Add Label" onClick={handleAddLabelClick}><Plus size={20} /></button>
                  </div>
                  <div className="sidebar-section labels-section">
                    {customLabels.map(label => renderLabelNode(label, 0))}
                  </div>
                </>
              )}

            </div>

            {/* Groups Button - Always visible at bottom of sidebar (outside scroll area) */}
            <button className={`sidebar-item ${activeApp === 'groups' ? 'active' : ''}`} title="Groups" onClick={handleGroupsSidebarClick}>
              <Users size={20} />
              <span>Groups</span>
            </button>
            </div>
            )}

            {activeApp === 'mail' && (
            <div className={`middle-bar ${!token ? 'full-width' : ''}`}>
              <Routes>
                <Route path="/inbox" element={<InboxPage token={token} onViewEmail={handleViewEmail} />} />
                <Route path="/sent" element={<SentPage token={token} onViewEmail={handleViewEmail} />} />
                <Route path="/starred" element={<StarredPage token={token} onViewEmail={handleViewEmail} />} />
                <Route path="/snoozed" element={<SnoozedPage token={token} onViewEmail={handleViewEmail} />} />
                <Route path="/drafts" element={<DraftsPage token={token} onViewEmail={handleViewEmail} />} />
                <Route path="/archived" element={<ArchivedPage token={token} onViewEmail={handleViewEmail} />} />
                <Route path="/purchased" element={<PurchasedPage token={token} onViewEmail={handleViewEmail} />} />
                <Route path="/allmails" element={<AllMailsPage token={token} onViewEmail={handleViewEmail} />} />
                <Route path="/scheduled" element={<ScheduledPage token={token} onViewEmail={handleViewEmail} />} />
                <Route path="/important" element={<ImportantPage token={token} onViewEmail={handleViewEmail} />} />
                <Route path="/spam" element={<SpamPage token={token} onViewEmail={handleViewEmail} />} />
                <Route path="/trash" element={<TrashPage token={token} onViewEmail={handleViewEmail} />} />
                <Route path="/subscriptions" element={<SubscriptionsPage token={token} onViewEmail={handleViewEmail} />} />
                <Route path="/labels/:labelName?" element={<LabelsPage token={token} onViewEmail={handleViewEmail} />} />
                <Route path="/create-label" element={<CreateLabelPage token={token} onLabelCreated={handleLabelCreated} parentLabels={customLabels} />} />
                <Route path="/compose" element={<ComposePage token={token} userEmail={userEmail || ''} onSent={() => navigate('/inbox')} onCancel={() => navigate('/inbox')} />} />
                <Route path="/email" element={<EmailPage token={token} selectedEmail={selectedEmail} onBack={() => navigate('/inbox')} />} />
                <Route path="/view" element={selectedEmail ? <EmailViewer email={selectedEmail} onBack={() => navigate('/inbox')} /> : <Navigate to="/inbox" />} />
                <Route path="/" element={<Navigate to="/inbox" />} />
              </Routes>
            </div>
            )}

            {activeApp === 'mail' && token && (
              <div className="right-sidebar">
                {/* Right details/preview will go here */}
              </div>
            )}

            {/* Calendar View */}
            {activeApp === 'calendar' && (
              <div className="calendar-container">
                <div className="calendar-header">
                  <h2>Calendar</h2>
                </div>
                <div className="calendar-content">
                  <div className="calendar-sidebar">
                    <div className="mini-calendar">
                      <div className="mini-calendar-header">
                        <button>&lt;</button>
                        <span>Today</span>
                        <button>&gt;</button>
                      </div>
                      <div className="mini-calendar-grid">
                        <div className="calendar-day-name">Sun</div>
                        <div className="calendar-day-name">Mon</div>
                        <div className="calendar-day-name">Tue</div>
                        <div className="calendar-day-name">Wed</div>
                        <div className="calendar-day-name">Thu</div>
                        <div className="calendar-day-name">Fri</div>
                        <div className="calendar-day-name">Sat</div>
                        {Array.from({ length: 35 }).map((_, i) => (
                          <div key={i} className={`calendar-day ${i === 14 ? 'today' : ''}`}>{i % 7 === 0 && i > 0 ? Math.floor(i / 7) * 7 - 20 : i - 5}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="calendar-main">
                    <div className="calendar-view">
                      <div className="calendar-week-header">
                        <div className="week-day">Sunday</div>
                        <div className="week-day">Monday</div>
                        <div className="week-day">Tuesday</div>
                        <div className="week-day">Wednesday</div>
                        <div className="week-day">Thursday</div>
                        <div className="week-day">Friday</div>
                        <div className="week-day">Saturday</div>
                      </div>
                      <div className="calendar-week-grid">
                        {Array.from({ length: 7 }).map((_, i) => (
                          <div key={i} className="week-slot"></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Contacts View */}
            {activeApp === 'contacts' && (
              <div className="contacts-container">
                <div className="contacts-header">
                  <h2>Contacts</h2>
                  <button className="add-contact-btn">
                    <Plus size={20} />
                    <span>Add Contact</span>
                  </button>
                </div>
                <div className="contacts-content">
                  <div className="contacts-sidebar">
                    <div className="contacts-search">
                      <input type="text" placeholder="Search contacts..." />
                    </div>
                    <div className="contacts-list">
                      <div className="contact-item">
                        <div className="contact-avatar">J</div>
                        <div className="contact-info">
                          <div className="contact-name">John Doe</div>
                          <div className="contact-email">john@example.com</div>
                        </div>
                      </div>
                      <div className="contact-item">
                        <div className="contact-avatar">S</div>
                        <div className="contact-info">
                          <div className="contact-name">Sarah Smith</div>
                          <div className="contact-email">sarah@example.com</div>
                        </div>
                      </div>
                      <div className="contact-item">
                        <div className="contact-avatar">M</div>
                        <div className="contact-info">
                          <div className="contact-name">Mike Johnson</div>
                          <div className="contact-email">mike@example.com</div>
                        </div>
                      </div>
                      <div className="contact-item">
                        <div className="contact-avatar">E</div>
                        <div className="contact-info">
                          <div className="contact-name">Emily Brown</div>
                          <div className="contact-email">emily@example.com</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="contacts-main">
                    <div className="contact-detail">
                      <div className="contact-header">
                        <div className="contact-detail-avatar">J</div>
                        <div className="contact-detail-info">
                          <h3>John Doe</h3>
                          <p>john@example.com</p>
                        </div>
                      </div>
                      <div className="contact-actions">
                        <button className="action-btn">
                          <Mail size={18} />
                          Email
                        </button>
                        <button className="action-btn">
                          <MessageSquare size={18} />
                          Chat
                        </button>
                        <button className="action-btn">
                          <Star size={18} />
                          Favorite
                        </button>
                      </div>
                      <div className="contact-details-section">
                        <h4>Contact Details</h4>
                        <div className="detail-item">
                          <label>Email</label>
                          <p>john@example.com</p>
                        </div>
                        <div className="detail-item">
                          <label>Phone</label>
                          <p>+1 (555) 123-4567</p>
                        </div>
                        <div className="detail-item">
                          <label>Address</label>
                          <p>123 Main St, New York, NY 10001</p>
                        </div>
                      </div>
                      <div className="contact-notes-section">
                        <h4>Notes</h4>
                        <p>Regular contact for business matters</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Groups View */}
            {activeApp === 'groups' && (
              <div className="groups-container">
                <div className="groups-header">
                  <h2>Groups</h2>
                  <button className="create-group-btn">
                    <Plus size={20} />
                    <span>Create Group</span>
                  </button>
                </div>
                <div className="groups-content">
                  <div className="groups-sidebar">
                    <div className="groups-search">
                      <input type="text" placeholder="Search groups..." />
                    </div>
                    <div className="groups-list">
                      <div className="group-item">
                        <div className="group-avatar">TM</div>
                        <div className="group-info">
                          <div className="group-name">Team Members</div>
                          <div className="group-count">5 members</div>
                        </div>
                      </div>
                      <div className="group-item">
                        <div className="group-avatar">PM</div>
                        <div className="group-info">
                          <div className="group-name">Project Managers</div>
                          <div className="group-count">3 members</div>
                        </div>
                      </div>
                      <div className="group-item">
                        <div className="group-avatar">DP</div>
                        <div className="group-info">
                          <div className="group-name">Design Partners</div>
                          <div className="group-count">4 members</div>
                        </div>
                      </div>
                      <div className="group-item">
                        <div className="group-avatar">CS</div>
                        <div className="group-info">
                          <div className="group-name">Client Support</div>
                          <div className="group-count">6 members</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="groups-main">
                    <div className="group-detail">
                      <div className="group-header">
                        <div className="group-detail-avatar">TM</div>
                        <div className="group-detail-info">
                          <h3>Team Members</h3>
                          <p>5 members • Created 3 months ago</p>
                        </div>
                      </div>
                      <div className="group-actions">
                        <button className="action-btn">
                          <MessageSquare size={18} />
                          Email All
                        </button>
                        <button className="action-btn">
                          <Plus size={18} />
                          Add Member
                        </button>
                        <button className="action-btn">
                          <FileText size={18} />
                          Settings
                        </button>
                      </div>
                      <div className="group-members-section">
                        <h4>Members ({5})</h4>
                        <div className="members-list">
                          <div className="member-item">
                            <div className="member-avatar">JD</div>
                            <div className="member-info">
                              <div className="member-name">John Doe</div>
                              <div className="member-email">john@example.com</div>
                            </div>
                          </div>
                          <div className="member-item">
                            <div className="member-avatar">SS</div>
                            <div className="member-info">
                              <div className="member-name">Sarah Smith</div>
                              <div className="member-email">sarah@example.com</div>
                            </div>
                          </div>
                          <div className="member-item">
                            <div className="member-avatar">MJ</div>
                            <div className="member-info">
                              <div className="member-name">Mike Johnson</div>
                              <div className="member-email">mike@example.com</div>
                            </div>
                          </div>
                          <div className="member-item">
                            <div className="member-avatar">EB</div>
                            <div className="member-info">
                              <div className="member-name">Emily Brown</div>
                              <div className="member-email">emily@example.com</div>
                            </div>
                          </div>
                          <div className="member-item">
                            <div className="member-avatar">AM</div>
                            <div className="member-info">
                              <div className="member-name">Alex Miller</div>
                              <div className="member-email">alex@example.com</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="group-description-section">
                        <h4>Description</h4>
                        <p>A group for all team members to collaborate and communicate effectively. Everyone in this group can participate in team discussions and activities.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
