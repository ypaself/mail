import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, X, Send } from 'lucide-react'

interface Message {
  role: 'user' | 'ai'
  content: string
}

interface Props {
  token?: string | null
}

export default function AiFloatingButton({ token }: Props) {
  const [open, setOpen] = useState(false)
  const [pixelPos, setPixelPos] = useState({ x: window.innerWidth - 76, y: window.innerHeight - 76 })
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [didDrag, setDidDrag] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Store position as a fraction of the content area so it moves with layout changes
  const posRatioRef = useRef({ rx: 0.95, ry: 0.9 })

  const getContentRect = (): DOMRect | null => {
    const el = document.querySelector('.middle-bar') as HTMLElement | null
    return el ? el.getBoundingClientRect() : null
  }

  const ratioToPixels = useCallback((rx: number, ry: number) => {
    const rect = getContentRect()
    if (!rect) return { x: window.innerWidth - 76, y: window.innerHeight - 76 }
    return {
      x: Math.max(rect.left, Math.min(rect.right - 52, rect.left + rx * rect.width)),
      y: Math.max(rect.top, Math.min(rect.bottom - 52, rect.top + ry * rect.height)),
    }
  }, [])

  const pixelsToRatio = useCallback((x: number, y: number) => {
    const rect = getContentRect()
    if (!rect || rect.width === 0 || rect.height === 0) return { rx: 0.95, ry: 0.9 }
    return {
      rx: Math.max(0, Math.min(1, (x - rect.left) / rect.width)),
      ry: Math.max(0, Math.min(1, (y - rect.top) / rect.height)),
    }
  }, [])

  const syncPosition = useCallback(() => {
    const { x, y } = ratioToPixels(posRatioRef.current.rx, posRatioRef.current.ry)
    setPixelPos({ x, y })
  }, [ratioToPixels])

  // Initialise position once middle-bar is in the DOM
  useEffect(() => {
    const tryInit = () => {
      const rect = getContentRect()
      if (rect) {
        syncPosition()
        return true
      }
      return false
    }
    if (!tryInit()) {
      const id = setInterval(() => { if (tryInit()) clearInterval(id) }, 50)
      return () => clearInterval(id)
    }
  }, [syncPosition])

  // Watch for layout changes: sidebar collapse/expand and right-sidebar appear/disappear
  useEffect(() => {
    const ro = new ResizeObserver(syncPosition)
    const mo = new MutationObserver(syncPosition)

    const middleBar = document.querySelector('.middle-bar')
    const leftSidebar = document.querySelector('.left-sidebar')

    if (middleBar) ro.observe(middleBar)
    if (leftSidebar) ro.observe(leftSidebar)

    // MutationObserver catches right-sidebar being added/removed from the DOM
    const parent = middleBar?.parentElement ?? document.body
    mo.observe(parent, { childList: true, subtree: false, attributes: true, attributeFilter: ['class', 'style'] })

    window.addEventListener('resize', syncPosition)

    return () => {
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', syncPosition)
    }
  }, [syncPosition])

  // Drag handling
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      setDidDrag(true)
      const x = Math.max(0, Math.min(window.innerWidth - 52, e.clientX - dragOffset.x))
      const y = Math.max(0, Math.min(window.innerHeight - 52, e.clientY - dragOffset.y))
      setPixelPos({ x, y })
      posRatioRef.current = pixelsToRatio(x, y)
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, dragOffset, pixelsToRatio])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleButtonMouseDown = (e: React.MouseEvent) => {
    setDidDrag(false)
    setDragging(true)
    setDragOffset({ x: e.clientX - pixelPos.x, y: e.clientY - pixelPos.y })
    e.preventDefault()
  }

  const handleButtonClick = () => {
    if (!didDrag) setOpen(o => !o)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)
    try {
      const res = await fetch('http://localhost:5050/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'ai', content: data.reply || 'No response.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: "I'm sunnila, your AI assistant! (AI service not connected yet)" }])
    } finally {
      setLoading(false)
    }
  }

  const inRightHalf = pixelPos.x > window.innerWidth / 2
  const inBottomHalf = pixelPos.y > window.innerHeight / 2
  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    width: '320px',
    height: '440px',
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid #e0e0e0',
    ...(inRightHalf ? { right: 0 } : { left: 0 }),
    ...(inBottomHalf ? { bottom: '60px' } : { top: '60px' }),
  }

  return (
    <div style={{ position: 'fixed', left: pixelPos.x, top: pixelPos.y, zIndex: 99999, userSelect: 'none' }}>
      {/* Chat Panel */}
      {open && (
        <div style={panelStyle} onMouseDown={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg, #1565c0 0%, #00897b 100%)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <Sparkles size={17} color="white" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: '15px', flex: 1, letterSpacing: '0.3px' }}>sunnila AI</span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', padding: '2px', borderRadius: '50%' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X size={17} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#bbb', fontSize: '13px', marginTop: '50px' }}>
                <Sparkles size={30} style={{ opacity: 0.25, marginBottom: '10px' }} />
                <div style={{ fontWeight: 600, color: '#999' }}>Hi! I'm sunnila</div>
                <div style={{ marginTop: '4px' }}>How can I help you today?</div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '82%',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  backgroundColor: msg.role === 'user' ? '#1565c0' : '#f1f3f4',
                  color: msg.role === 'user' ? 'white' : '#333',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '8px 14px', borderRadius: '14px 14px 14px 2px', backgroundColor: '#f1f3f4', fontSize: '13px', color: '#aaa', fontStyle: 'italic' }}>
                  thinking…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #eee', display: 'flex', gap: '8px', alignItems: 'flex-end', flexShrink: 0 }}>
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              }}
              placeholder="Ask sunnila anything…"
              style={{
                flex: 1,
                border: '1px solid #ddd',
                borderRadius: '20px',
                padding: '8px 14px',
                fontSize: '13px',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.4',
                overflow: 'hidden',
                minHeight: '36px',
                maxHeight: '100px',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                width: '36px', height: '36px', borderRadius: '50%',
                backgroundColor: input.trim() && !loading ? '#1565c0' : '#ccc',
                border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                transition: 'background-color 0.2s',
              }}
            >
              <Send size={15} color="white" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <div
        onMouseDown={handleButtonMouseDown}
        onClick={handleButtonClick}
        style={{
          width: '52px', height: '52px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #1565c0 0%, #00897b 100%)',
          cursor: dragging ? 'grabbing' : 'grab',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
          gap: '2px',
          transition: dragging ? 'none' : 'box-shadow 0.2s',
        }}
        onMouseEnter={e => { if (!dragging) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.38)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.28)' }}
      >
        <Sparkles size={20} color="white" />
        <span style={{ color: 'white', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }}>sunnila</span>
      </div>
    </div>
  )
}
