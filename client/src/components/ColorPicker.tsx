import { useRef, useEffect, useCallback } from 'react'

interface Props {
  value: string
  onChange: (color: string) => void
  showHex?: boolean
}

function hsvToHex(h: number, s: number, v: number): string {
  s /= 100; v /= 100
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(Math.min(k, 4 - k, 1), 0)
  }
  return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

function hexToHsv(hex: string): [number, number, number] {
  const safe = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#607d8b'
  const r = parseInt(safe.slice(1, 3), 16) / 255
  const g = parseInt(safe.slice(3, 5), 16) / 255
  const b = parseInt(safe.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const v = max
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)]
}

export default function ColorPicker({ value, onChange, showHex = true }: Props) {
  const [h, s, v] = hexToHsv(value)
  const pickerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const updateFromPos = useCallback((clientX: number, clientY: number) => {
    if (!pickerRef.current) return
    const rect = pickerRef.current.getBoundingClientRect()
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    onChange(hsvToHex(h, Math.round(nx * 100), Math.round((1 - ny) * 100)))
  }, [h, onChange])

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) updateFromPos(e.clientX, e.clientY) }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [updateFromPos])

  const pureHue = `hsl(${h}, 100%, 50%)`
  const displayColor = /^#[0-9a-f]{6}$/i.test(value) ? value : '#607d8b'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', userSelect: 'none', flex: 1 }}>

      {/* 2D saturation / brightness area */}
      <div
        ref={pickerRef}
        onMouseDown={(e) => { e.stopPropagation(); dragging.current = true; updateFromPos(e.clientX, e.clientY) }}
        style={{ position: 'relative', height: '130px', borderRadius: '6px', background: pureHue, cursor: 'crosshair', overflow: 'hidden', flexShrink: 0 }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #fff, transparent)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, #000)' }} />
        {/* picker cursor */}
        <div style={{
          position: 'absolute',
          left: `${s}%`, top: `${100 - v}%`,
          width: '13px', height: '13px',
          borderRadius: '50%',
          border: '2px solid #fff',
          boxShadow: '0 0 3px rgba(0,0,0,0.5)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          background: displayColor,
        }} />
      </div>

      {/* Hue slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#888', width: '28px', flexShrink: 0 }}>Hue</span>
        <input
          type="range" min="0" max="360" value={h}
          onChange={(e) => onChange(hsvToHex(Number(e.target.value), s, v))}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1, height: '12px', borderRadius: '6px', cursor: 'pointer',
            background: 'linear-gradient(to right,hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),hsl(180,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%))',
            WebkitAppearance: 'none',
          } as React.CSSProperties}
        />
      </div>

      {/* R G B sliders */}
      {[
        { label: 'R', color: '#e53935', idx: 0 },
        { label: 'G', color: '#43a047', idx: 1 },
        { label: 'B', color: '#1e88e5', idx: 2 },
      ].map(({ label, color, idx }) => {
        const val = parseInt(displayColor.slice(1 + idx * 2, 3 + idx * 2), 16)
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color, width: '12px' }}>{label}</span>
            <input type="range" min="0" max="255" value={val}
              onChange={(e) => {
                const v2 = Number(e.target.value)
                const parts = [parseInt(displayColor.slice(1,3),16), parseInt(displayColor.slice(3,5),16), parseInt(displayColor.slice(5,7),16)]
                parts[idx] = v2
                onChange('#' + parts.map(x => x.toString(16).padStart(2,'0')).join(''))
              }}
              onClick={(e) => e.stopPropagation()}
              style={{ flex: 1, accentColor: color, cursor: 'pointer' }} />
            <input
              type="number" min="0" max="255" value={val}
              onChange={(e) => {
                const v2 = Math.min(255, Math.max(0, Number(e.target.value)))
                const parts = [parseInt(displayColor.slice(1,3),16), parseInt(displayColor.slice(3,5),16), parseInt(displayColor.slice(5,7),16)]
                parts[idx] = v2
                onChange('#' + parts.map(x => x.toString(16).padStart(2,'0')).join(''))
              }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '66px', padding: '5px 4px', border: '1.5px solid #c0c0c0', borderRadius: '5px', fontSize: '12px', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties}
            />
          </div>
        )
      })}

      {/* Hex + RGB row */}
      {showHex && <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {/* Hex input + color preview combined */}
        <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #c0c0c0', borderRadius: '6px', overflow: 'hidden', width: 'fit-content' }}>
          <div style={{ width: '28px', height: '28px', background: displayColor, flexShrink: 0 }} />
          <input
            type="text" value={value} maxLength={7}
            onChange={(e) => { if (/^#[0-9a-f]{0,6}$/i.test(e.target.value)) onChange(e.target.value) }}
            onClick={(e) => e.stopPropagation()}
            style={{ flex: 1, padding: '5px 8px', border: 'none', fontSize: '12px', fontFamily: 'monospace', outline: 'none', minWidth: 0 }}
          />
        </div>
        {['R','G','B'].map((ch, i) => {
          const val = parseInt(displayColor.slice(1 + i*2, 3 + i*2), 16)
          return (
            <div key={ch} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
              <input
                type="number" min="0" max="255" value={val}
                onChange={(e) => {
                  const v2 = Math.min(255, Math.max(0, Number(e.target.value)))
                  const parts = [parseInt(displayColor.slice(1,3),16), parseInt(displayColor.slice(3,5),16), parseInt(displayColor.slice(5,7),16)]
                  parts[i] = v2
                  onChange('#' + parts.map(x => x.toString(16).padStart(2,'0')).join(''))
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ width: '46px', padding: '4px 2px', border: '1.5px solid #c0c0c0', borderRadius: '5px', fontSize: '11px', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties}
              />
              <span style={{ fontSize: '10px', color: '#aaa' }}>{ch}</span>
            </div>
          )
        })}
      </div>}
    </div>
  )
}
