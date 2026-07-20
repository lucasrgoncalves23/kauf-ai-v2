"use client";

import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { logger } from "../lib/logger";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallbackLabel?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error("React component crash", {
      panel: this.props.fallbackLabel ?? "unknown",
      error: error.message,
      stack: error.stack?.slice(0, 500),
      componentStack: info.componentStack?.slice(0, 500),
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center h-full">
          <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-6 max-w-sm">
            <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
              {this.props.fallbackLabel ?? "Painel"} — erro inesperado
            </p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70 mb-4">
              {this.state.error?.message || "Erro desconhecido"}
            </p>
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/60 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
