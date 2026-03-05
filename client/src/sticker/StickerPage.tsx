import { useState } from 'react'
import { Plus } from 'lucide-react'
import './styles/StickerPage.css'

interface Sticker {
  id: number
  emoji: string
  title: string
  category: string
}

export default function StickerPage() {
  const [stickers] = useState<Sticker[]>([
    { id: 1, emoji: '😀', title: 'Happy', category: 'Smileys' },
    { id: 2, emoji: '😂', title: 'Laughing', category: 'Smileys' },
    { id: 3, emoji: '😍', title: 'Love', category: 'Smileys' },
    { id: 4, emoji: '🎉', title: 'Party', category: 'Celebration' },
    { id: 5, emoji: '🎈', title: 'Balloon', category: 'Celebration' },
    { id: 6, emoji: '🌟', title: 'Star', category: 'Nature' },
    { id: 7, emoji: '⭐', title: 'Sparkle', category: 'Nature' },
    { id: 8, emoji: '🚀', title: 'Rocket', category: 'Objects' },
    { id: 9, emoji: '💡', title: 'Lightbulb', category: 'Objects' },
    { id: 10, emoji: '🎨', title: 'Art', category: 'Objects' },
    { id: 11, emoji: '✅', title: 'Check', category: 'Symbols' },
    { id: 12, emoji: '❤️', title: 'Heart', category: 'Symbols' },
  ])
  const [selectedStickers, setSelectedStickers] = useState<number[]>([])

  const handleSelectSticker = (id: number) => {
    setSelectedStickers(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  return (
    <div className="sticker-container">
      <div className="sticker-header">
        <h2>Sticker Collection</h2>
        <button className="new-sticker-btn">
          <Plus size={20} />
          <span>Add Sticker</span>
        </button>
      </div>
      <div className="sticker-content">
        <div className="sticker-grid">
          {stickers.map((sticker) => (
            <div
              key={sticker.id}
              className={`sticker-item ${selectedStickers.includes(sticker.id) ? 'selected' : ''}`}
              onClick={() => handleSelectSticker(sticker.id)}
              title={sticker.title}
            >
              <div className="sticker-emoji">{sticker.emoji}</div>
              <p className="sticker-title">{sticker.title}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
