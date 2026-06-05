import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0c0c0c] flex items-center justify-center px-4">
          <div className="text-center space-y-5">
            <div className="font-display font-bold text-3xl tracking-[0.3em] text-[#d97706]">
              PURSUIT
            </div>
            <p className="font-mono text-sm text-[#aaa]">Something went wrong.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 border border-[#1e1e1e] font-display text-[10px] tracking-[0.18em] text-[#888] hover:border-[#d97706] hover:text-[#d97706] transition-colors"
            >
              REFRESH
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
