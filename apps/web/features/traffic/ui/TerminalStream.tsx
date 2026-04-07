'use client';

import type { LogItem } from '@/features/logs/api/logs.service';

interface TerminalStreamProps {
  logs: LogItem[];
  isLoading: boolean;
}

export function TerminalStream({ logs, isLoading }: TerminalStreamProps) {
  return (
    <section className="h-48 border-t border-outline-variant bg-app flex flex-col">
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
              <div key={log.reqId} className={`${rowTone} hover:bg-surface-container-high px-2 py-0.5 flex gap-4`}>
                <span className="w-20 text-muted">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                <span className="w-12">{log.method}</span>
                <span className="flex-1 truncate">{log.endpoint}</span>
                <span className="w-16 text-right">{log.statusCode}</span>
                <span className="w-12 text-right">{log.latencyMs}ms</span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
