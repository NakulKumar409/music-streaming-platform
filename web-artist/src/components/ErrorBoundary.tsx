import React from "react";
import * as Sentry from "@sentry/react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  label?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: unknown;
};

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("[GLOBAL_ERROR_LOG]", {
      label: this.props.label ?? "(unlabeled)",
      error,
      info
    });
    Sentry.captureException(error, { extra: { ...info, label: this.props.label } });
  }

  private retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen w-full bg-[#4b1927] text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-[720px] items-center px-6">
          <div className="w-full rounded-[10px] border border-white/10 bg-surface/45 backdrop-blur px-6 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div className="text-[18px] font-light tracking-wide text-[#e6d6d2]">
              Something went wrong
            </div>
            <div className="mt-2 text-[13px] text-[#d8c7c3]">
              Please try again. If this keeps happening, check the terminal logs.
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={this.retry}
                className="rounded-[8px] border border-white/15 bg-white/10 px-4 py-2 text-[13px] text-white hover:bg-white/15"
              >
                Retry
              </button>
              <div className="text-[12px] text-[#a99792]">
                {this.props.label ? `Section: ${this.props.label}` : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
