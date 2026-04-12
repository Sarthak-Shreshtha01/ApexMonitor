import type { LogItem } from '@/features/logs/api/logs.service';

interface TerminalStreamProps {
  logs: LogItem[];
  isLoading: boolean;
}

export function TerminalStream({ logs, isLoading }: TerminalStreamProps) {
  return (
    <section className="h-60 sm:h-56 md:h-48 border-t border-outline-variant bg-app flex flex-col min-h-0">
      <div className="px-4 py-2 border-b border-surface-container-low flex justify-between items-center bg-surface">
        <span className="text-[9px] font-bold text-tertiary uppercase tracking-widest">Critical Event Stream (4xx/5xx)</span>
        <span className="text-[9px] font-mono text-secondary">LIVE FEED</span>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-[10px] p-2 space-y-1 custom-scrollbar">
        {isLoading ? (
          <div className="text-secondary px-2 py-2">Loading critical stream...</div>
        ) : logs.length === 0 ? (
          <div className="text-secondary px-2 py-2">No 4xx/5xx events in the current window.</div>
        ) : (
          logs.map((log) => {
            const isServerError = log.statusCode >= 500;
            const rowTone = isServerError ? 'text-primary font-bold' : 'text-tertiary';

            return (
              <div key={log.reqId} className={`${rowTone} hover:bg-surface-container-high px-2 py-2 rounded md:rounded-none grid grid-cols-[72px_44px_minmax(0,1fr)] md:grid-cols-[72px_44px_minmax(0,1fr)_54px_54px] gap-x-3 gap-y-1 items-center`}>
                <span className="text-muted text-[9px] md:text-[10px]">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                <span className="text-[10px] md:w-12">{log.method}</span>
                <span className="min-w-0 truncate text-[10px] md:text-xs">{log.endpoint}</span>
                <span className="hidden md:block w-16 text-right text-[10px]">{log.statusCode}</span>
                <span className="hidden md:block w-12 text-right text-[10px]">{log.latencyMs}ms</span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
