import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8f9fb',
          fontFamily: "'Inter', system-ui, sans-serif",
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
            <AlertTriangle size={32} color="#ef4444" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '15px', color: '#6b7280', maxWidth: '400px', marginBottom: '24px', lineHeight: 1.5 }}>
            A critical error occurred while rendering this page. We've logged the issue.
          </p>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <div style={{ background: '#111827', color: '#e5e7eb', padding: '16px', borderRadius: '12px', fontSize: '12px', textAlign: 'left', maxWidth: '600px', overflowX: 'auto', marginBottom: '32px', fontFamily: "'JetBrains Mono', monospace" }}>
              <code>{this.state.error.toString()}</code>
            </div>
          )}
          <button 
            onClick={() => window.location.href = '/'}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
              background: '#2563eb', color: '#fff', border: 'none', borderRadius: '12px',
              fontSize: '15px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s'
            }}
          >
            <RefreshCcw size={18} />
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
