import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { captureError } from "@/lib/error-tracking";

interface Props {
  children: ReactNode;
  /** Label identifying which section failed (shown in logs + UI). */
  name?: string;
  /** Render a compact inline fallback instead of full-screen. */
  inline?: boolean;
  /** Optional custom fallback render. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}
interface State { hasError: boolean; error?: Error; info?: ErrorInfo }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const label = this.props.name ?? "ErrorBoundary";
    // Actionable structured log
    console.error(`[ErrorBoundary:${label}]`, {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    this.setState({ info: errorInfo });
    captureError(error, {
      level: "error",
      context: {
        boundary: label,
        componentStack: errorInfo.componentStack,
        source: "ErrorBoundary",
      },
    });
  }

  reset = () => this.setState({ hasError: false, error: undefined, info: undefined });

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);

      const { error, info } = this.state;
      const label = this.props.name;

      if (this.props.inline) {
        return (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium text-destructive mb-1">
              <AlertTriangle className="h-4 w-4" />
              {label ? `${label} failed to load` : "This section failed to load"}
            </div>
            <p className="text-muted-foreground break-words">{error.message}</p>
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Error details</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap">{error.stack}{info?.componentStack}</pre>
            </details>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={this.reset}>Retry</Button>
              <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>Refresh</Button>
            </div>
          </div>
        );
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="text-center max-w-lg w-full">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">
              {label ? `${label} crashed` : "Something went wrong"}
            </h2>
            <p className="text-sm text-muted-foreground mb-4 break-words">{error.message}</p>
            <details className="text-left text-xs text-muted-foreground bg-muted/40 rounded-md p-3 mb-4">
              <summary className="cursor-pointer font-medium">Error details</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap">{error.stack}{info?.componentStack}</pre>
            </details>
            <div className="flex gap-3 justify-center">
              <Button onClick={this.reset}>Try again</Button>
              <Button variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
              <Button variant="ghost" onClick={() => (window.location.href = "/")}>Go Home</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
