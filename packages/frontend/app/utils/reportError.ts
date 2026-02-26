type ErrorTelemetry = {
  timestamp: string;
  url: string;
  message: string;
  stackTrace: string;
};

export function reportError(error: unknown): void {
  try {
    const telemetry: ErrorTelemetry = {
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      message: error instanceof Error ? error.message : String(error),
      stackTrace: error instanceof Error ? (error.stack ?? '') : '',
    };

    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telemetry),
    }).catch(() => {
      // Fail silently — reporting failures must not cascade
    });
  } catch {
    // Fail silently
  }
}
