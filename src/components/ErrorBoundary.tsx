import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

/**
 * 捕获子组件树中的渲染错误，防止整页空白。
 * 出错时显示报错摘要，便于排查生产环境问题。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  static getDerivedStateFromProps(_props: ErrorBoundaryProps, state: ErrorBoundaryState): ErrorBoundaryState {
    // 只有在已有错误时才保留，避免在错误边界重置后覆盖错误状态
    return state;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] 捕获到渲染错误：', error, errorInfo);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '24px',
            border: '1px solid #fee2e2',
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            maxWidth: '720px',
            margin: '24px auto',
            borderRadius: '8px',
          }}
        >
          <h2 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>页面加载出错</h2>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.message ?? '未知错误'}
          </p>
          {this.state.errorInfo?.componentStack && (
            <div style={{ marginTop: '12px', fontSize: '12px', whiteSpace: 'pre-wrap', color: '#dc2626' }}>
              {this.state.errorInfo.componentStack}
            </div>
          )}
          <button
            onClick={this.reset}
            style={{
              marginTop: '12px',
              padding: '6px 12px',
              fontSize: '14px',
              cursor: 'pointer',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
