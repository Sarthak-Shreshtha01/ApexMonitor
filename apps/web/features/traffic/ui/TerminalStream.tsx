import { Terminal } from 'lucide-react';

const DUMMY_LOGS = [
  { time: '14:28:44.021', status: '200 OK', method: 'GET', endpoint: '/api/v1/user/profile', latency: '42ms', ua: 'UA: Mozilla/5.0...', type: 'success' },
  { time: '14:28:44.118', status: '200 OK', method: 'POST', endpoint: '/api/v1/auth/refresh', latency: '112ms', ua: 'UA: Pulse-SDK-Go', type: 'success' },
  { time: '14:28:44.256', status: '401 UNAUTH', method: 'GET', endpoint: '/api/v1/admin/config', latency: '12ms', ua: 'IP: 192.168.1.1', type: 'warning' },
  { time: '14:28:44.382', status: '204 NO CONT', method: 'OPTIONS', endpoint: '/api/v1/upload', latency: '4ms', ua: 'CORS: Preflight', type: 'success' },
  { time: '14:28:44.501', status: '500 ERROR', method: 'PATCH', endpoint: '/api/v1/inventory/update', latency: '890ms', ua: 'Err: DB Timeout', type: 'error' },
  { time: '14:28:44.612', status: '200 OK', method: 'GET', endpoint: '/api/v1/metrics', latency: '22ms', ua: 'UA: Prometheus/2.3', type: 'success' },
  { time: '14:28:44.789', status: '200 OK', method: 'GET', endpoint: '/api/v1/user/profile', latency: '38ms', ua: 'UA: Mozilla/5.0...', type: 'success' },
  { time: '14:28:44.912', status: '200 OK', method: 'GET', endpoint: '/api/v1/search?q=query', latency: '156ms', ua: 'UA: Mozilla/5.0...', type: 'success' },
];

export function TerminalStream() {
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 flex flex-col h-[500px]">
      <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="text-primary w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary-foreground">Traffic Terminal</span>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-secondary"></div><span className="text-[10px] text-secondary">2xx</span></div>
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-tertiary"></div><span className="text-[10px] text-secondary">4xx</span></div>
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-error"></div><span className="text-[10px] text-secondary">5xx</span></div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar font-mono text-[11px]">
        {DUMMY_LOGS.map((log, i) => {
          const bgClass = log.type === 'warning' ? 'bg-tertiary/5' : log.type === 'error' ? 'bg-error/5' : '';
          const statusColor = log.type === 'warning' ? 'text-tertiary' : log.type === 'error' ? 'text-error' : 'text-secondary';
          
          return (
            <div key={i} className={`flex items-center gap-4 py-1.5 px-2 border-b border-white/[0.03] rounded ${bgClass}`}>
              <span className="text-muted w-20">{log.time}</span>
              <span className={`${statusColor} font-bold w-24 shrink-0`}>{log.status}</span>
              <span className="text-primary flex-1 truncate">{log.method} {log.endpoint}</span>
              <span className="text-secondary w-12 text-right">{log.latency}</span>
              <span className="text-muted w-32 ml-auto text-right truncate">{log.ua}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}