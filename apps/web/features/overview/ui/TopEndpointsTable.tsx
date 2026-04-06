const ENDPOINTS_DATA = [
  { id: 1, method: 'GET', methodStyle: 'bg-secondary/10 text-secondary border-secondary/20', path: '/v1/auth/user/profile', reqs: '421.2k', latency: '12ms', status: '200 OK', statusColor: 'bg-secondary text-secondary' },
  { id: 2, method: 'POST', methodStyle: 'bg-primary-container/20 text-indigo-300 border-indigo-500/20', path: '/v1/billing/checkout/session', reqs: '89.4k', latency: '248ms', status: '201 Created', statusColor: 'bg-secondary text-secondary' },
  { id: 3, method: 'GET', methodStyle: 'bg-secondary/10 text-secondary border-secondary/20', path: '/v1/telemetry/stream', reqs: '56.2k', latency: '542ms', status: '429 Too Many', statusColor: 'bg-tertiary text-tertiary' },
  { id: 4, method: 'GET', methodStyle: 'bg-secondary/10 text-secondary border-secondary/20', path: '/v1/search/catalog', reqs: '32.1k', latency: '92ms', status: '200 OK', statusColor: 'bg-secondary text-secondary' },
  { id: 5, method: 'PUT', methodStyle: 'bg-primary-container/20 text-indigo-300 border-indigo-500/20', path: '/v1/config/override', reqs: '12.5k', latency: '112ms', status: '200 OK', statusColor: 'bg-secondary text-secondary' },
];

export function TopEndpointsTable() {
  return (
    <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-hidden">
      <div className="px-6 py-5 border-b border-outline-variant/10 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Top Performing Endpoints</h3>
        <button className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest hover:text-indigo-200 transition-colors focus:outline-none">
          View All Endpoints
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead>
            <tr className="bg-surface-container-high/30">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Method</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Endpoint</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Requests</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Avg Latency</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {ENDPOINTS_DATA.map((row) => (
              <tr key={row.id} className="hover:bg-indigo-500/5 transition-colors group cursor-pointer">
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${row.methodStyle}`}>
                    {row.method}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-on-surface">{row.path}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs text-slate-400">{row.reqs}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs text-slate-300">{row.latency}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${row.statusColor.split(' ')[1]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${row.statusColor.split(' ')[0]}`}></span> 
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}