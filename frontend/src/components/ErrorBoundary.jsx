import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: '#fff',
          minHeight: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}>
          <div style={{ fontSize: 36 }}>⚠️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
            This page encountered an error
          </div>
          <div style={{
            fontSize: 12,
            color: '#DC2626',
            fontFamily: 'monospace',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 6,
            padding: '10px 16px',
            maxWidth: 560,
            wordBreak: 'break-all',
            textAlign: 'left',
          }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            style={{
              marginTop: 8,
              padding: '7px 16px',
              borderRadius: 6,
              border: '1px solid #E5E7EB',
              background: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              color: '#374151',
            }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
