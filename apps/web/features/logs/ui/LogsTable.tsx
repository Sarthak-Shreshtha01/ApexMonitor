'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, ChevronUp, Copy } from 'lucide-react';

const DUMMY_LOGS = [
  { id: 'req_7f8a92b1c4', status: '200 OK', method: 'GET', path: '/v1/analytics/realtime', duration: '12.4ms', time: '14:02:45.312', type: 'success', ip: '192.168.1.45' },
  { id: 'req_8b9c10d2e5', status: '500 ERR', method: 'POST', path: '/v1/auth/token/refresh', duration: '842.1ms', time: '14:02:42.109', type: 'error', ip: '10.0.0.5' },
  { id: 'req_9c0d21e3f6', status: '201 OK', method: 'PUT', path: '/v1/user/settings/profile', duration: '156.4ms', time: '14:01:59.882', type: 'success', ip: '192.168.1.112' },
  { id: 'req_0d1e32f4a7', status: '200 OK', method: 'GET', path: '/v1/billing/invoices/latest', duration: '45.0ms', time: '14:01:45.001', type: 'success', ip: '172.16.0.4' },
  { id: 'req_1e2f43a5b8', status: '404 NOT', method: 'GET', path: '/v1/legacy/xml/export', duration: '2.1ms', time: '14:01:30.552', type: 'warning', ip: '192.168.1.88' },
];

export function LogsTable() {
  const [expandedRow, setExpandedRow] = useState<string | null>('req_7f8a92b1c4'); // Open first row by default for demo

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const getStatusBadge = (type: string, status: string) => {
    switch (type) {
      case 'success':
        return <span className="bg-secondary/10 text-secondary px-2 py-1 rounded text-[10px] font-bold border border-secondary/20">{status}</span>;
      case 'error':
        return <span className="bg-error/10 text-error px-2 py-1 rounded text-[10px] font-bold border border-error/20">{status}</span>;
      case 'warning':
        return <span className="bg-surface-container-highest text-slate-400 px-2 py-1 rounded text-[10px] font-bold border border-outline-variant/20">{status}</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant/10">
              {['Status', 'Method', 'Path', 'Duration', 'Timestamp', 'Action'].map((header) => (
                <th key={header} className={`px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-slate-500 ${header === 'Action' ? 'text-right' : ''}`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {DUMMY_LOGS.map((log) => (
              <Fragment key={log.id}>
                {/* Main Row */}
                <tr 
                  onClick={() => toggleRow(log.id)}
                  className="group hover:bg-surface-container-high/50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4">{getStatusBadge(log.type, log.status)}</td>
                  <td className="px-6 py-4 font-mono text-xs text-indigo-300">{log.method}</td>
                  <td className="px-6 py-4 font-mono text-xs text-on-surface truncate max-w-xs">{log.path}</td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-400">{log.duration}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{log.time}</td>
                  <td className="px-6 py-4 text-right">
                    {expandedRow === log.id ? (
                      <ChevronUp className="w-5 h-5 inline-block text-primary" />
                    ) : (
                      <ChevronDown className="w-5 h-5 inline-block text-slate-600 group-hover:text-primary transition-colors" />
                    )}
                  </td>
                </tr>

                {/* Expanded JSON View */}
                {expandedRow === log.id && (
                  <tr className="bg-surface-container-high/30">
                    <td colSpan={6} className="px-8 py-6">
                      <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/20 font-mono text-xs leading-relaxed overflow-x-auto">
                        <div className="flex justify-between items-start mb-4 border-b border-outline-variant/10 pb-4">
                          <div className="flex gap-8">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase text-slate-600 font-bold">Request ID</span>
                              <span className="text-indigo-200">{log.id}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase text-slate-600 font-bold">IP Address</span>
                              <span className="text-slate-400">{log.ip}</span>
                            </div>
                          </div>
                          <button className="text-indigo-400 hover:text-indigo-200 flex items-center gap-1.5 transition-colors focus:outline-none">
                            <Copy className="w-4 h-4" /> Copy JSON
                          </button>
                        </div>
                        <pre className="text-secondary/90">
{`{
  `}
<span className="text-tertiary">"header"</span>{`: {
    `}
<span className="text-tertiary">"user-agent"</span>{`: `}
<span className="text-primary">"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"</span>{`,
    `}
<span className="text-tertiary">"accept"</span>{`: `}
<span className="text-primary">"application/json"</span>{`
  },
  `}
<span className="text-tertiary">"query"</span>{`: {
    `}
<span className="text-tertiary">"stream"</span>{`: `}
<span className="text-primary">"true"</span>{`,
    `}
<span className="text-tertiary">"refresh"</span>{`: `}
<span className="text-primary">3000</span>{`
  },
  `}
<span className="text-tertiary">"response"</span>{`: {
    `}
<span className="text-tertiary">"status"</span>{`: `}
<span className="text-primary">{log.status.split(' ')[0]}</span>{`,
    `}
<span className="text-tertiary">"body"</span>{`: { `}
<span className="text-tertiary">"active_nodes"</span>{`: `}
<span className="text-primary">24</span>{`, `}
<span className="text-tertiary">"health"</span>{`: `}
<span className="text-primary">"stable"</span>{` }
  }
}`}
                        </pre>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-surface-container-low px-6 py-4 flex items-center justify-between border-t border-outline-variant/10">
        <p className="text-xs text-slate-500">Showing 50 of 4,209 logs</p>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-xs font-bold hover:bg-surface-container-high transition-colors focus:outline-none focus:ring-1 focus:ring-primary">Previous</button>
          <button className="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-xs font-bold hover:bg-surface-container-high transition-colors focus:outline-none focus:ring-1 focus:ring-primary">Next</button>
        </div>
      </div>
    </div>
  );
}