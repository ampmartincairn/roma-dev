import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-destructive/5 rounded-lg border border-destructive/20 text-destructive">
          <h2 className="text-xl font-semibold mb-2">Произошла ошибка на странице</h2>
          <p className="text-sm mb-4">Пожалуйста, скопируйте сообщение ниже и сообщите разработчику.</p>
          <pre className="whitespace-pre-wrap text-xs bg-white/80 p-3 rounded border border-muted/20 overflow-x-auto">
            {String(this.state.error)}
          </pre>
          {this.state.errorInfo?.componentStack && (
            <pre className="whitespace-pre-wrap text-xs bg-white/80 p-3 rounded border border-muted/20 mt-3 overflow-x-auto">
              {this.state.errorInfo.componentStack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
