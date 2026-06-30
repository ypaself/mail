import React, { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertOctagon, RefreshCw } from 'lucide-react'

interface Props {
  children?: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
    this.setState({ errorInfo })
    
    this.captureAndReportError(error, errorInfo)
  }

  private async captureAndReportError(error: Error, errorInfo: ErrorInfo) {
    let screenshot = null;
    try {
      // Dynamically import html2canvas so it only loads when a crash occurs
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, { useCORS: true, logging: false });
      screenshot = canvas.toDataURL('image/png');
    } catch (e) {
      console.error('Failed to capture screenshot:', e);
    }

    // Example: Reporting to your custom backend endpoint
    fetch(`/api/log-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.toString(),
        stack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        screenshot
      })
    }).catch(err => console.error('Failed to send error report:', err))
  }

  public resetError = () => {
    this.props.onReset?.()
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            maxWidth: '600px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#e53935' }}>
              <AlertOctagon size={32} />
              <h2 style={{ margin: 0, fontSize: '20px' }}>Something went wrong</h2>
            </div>
            
            <p style={{ margin: 0, color: '#555', lineHeight: '1.5' }}>
              The application encountered an unexpected error. You can try reloading the page or check the technical details below.
            </p>

            <div style={{
              backgroundColor: '#fff0f0',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #ffcdd2',
              overflowX: 'auto',
              maxHeight: '250px',
              overflowY: 'auto'
            }}>
              <strong style={{ color: '#c62828', display: 'block', marginBottom: '8px' }}>
                {this.state.error && this.state.error.toString()}
              </strong>
              <pre style={{ margin: 0, fontSize: '12px', color: '#d32f2f', whiteSpace: 'pre-wrap' }}>
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                onClick={this.resetError}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#2196f3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', transition: 'background-color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1976d2'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2196f3'}
              ><RefreshCw size={16} />Try Again</button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}