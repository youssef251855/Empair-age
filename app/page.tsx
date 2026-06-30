"use client";

import dynamic from "next/dynamic";
import React, { ErrorInfo, ReactNode } from "react";

class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean, error: Error | null, errorInfo: ErrorInfo | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', backgroundColor: '#fff', height: '100vh', overflow: 'auto' }}>
          <h1>Something went wrong.</h1>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo?.componentStack}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = dynamic(() => import("../src/App").then(mod => ({ default: mod.default })), { 
  ssr: false,
  loading: () => <div style={{ color: 'white', padding: 20 }}>Loading Application Bundle...</div>
});

export default function Home() {
  return (
    <App />
  );
}

