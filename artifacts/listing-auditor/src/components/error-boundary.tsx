import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChunkLoadError, reloadOnceForStaleChunk } from "@/lib/chunk-load-error";

interface ErrorBoundaryProps {
  children: ReactNode;
  title?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const staleChunk = isChunkLoadError(this.state.error);

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            {staleChunk
              ? "Update available"
              : (this.props.title ?? "Something went wrong")}
          </h2>
          <p className="text-sm text-slate-600 mb-4 break-words">
            {staleChunk
              ? "SellerLens was updated while this tab was open. Reload to load the latest version."
              : (this.state.error.message || "An unexpected error occurred while loading this page.")}
          </p>
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => {
              if (staleChunk) reloadOnceForStaleChunk();
              else window.location.reload();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {staleChunk ? "Reload now" : "Reload page"}
          </Button>
        </div>
      </div>
    );
  }
}
