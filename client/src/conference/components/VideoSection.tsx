import { Video } from 'lucide-react'

export default function VideoSection() {
  return (
    <div className="video-section">
      <div className="video-grid">
        <div className="video-placeholder">
          <Video size={64} />
          <p>Video Stream Area</p>
        </div>
      </div>
    </div>
  )
}
