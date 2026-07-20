import React, { type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * App-wide crash guard. A render error anywhere below this boundary shows a
 * branded dark recovery screen instead of a blank white page — one tap reloads.
 * The error itself still hits the console for debugging.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  // Ambient re-declares so the subclass sees the base instance members even
  // when a duplicate @types/react in the tree keeps them from flowing through.
  declare props: Readonly<Props>;
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-apex-950 p-6 text-slate-300">
        <div className="w-full max-w-sm rounded-2xl bg-apex-850 p-6 text-center ring-1 ring-white/10">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-apex-accent/10 text-2xl ring-1 ring-apex-accent/30">
            ⚠️
          </div>
          <h1 className="mt-4 text-base font-semibold text-slate-100">Something broke</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            The app hit an unexpected error. Your data is safe — reload to pick up
            where you left off.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 w-full rounded-xl bg-apex-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.99]"
          >
            Reload app
          </button>
          <div className="mt-3 truncate font-mono text-[10px] text-slate-600" title={this.state.error.message}>
            {this.state.error.message}
          </div>
        </div>
      </div>
    );
  }
}
