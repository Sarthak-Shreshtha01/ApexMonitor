import { Filter } from 'lucide-react';

export function LogsFilterBar() {
  return (
    <div className="bg-surface-container rounded-2xl p-2 flex flex-wrap items-center gap-2 border border-outline-variant/5">
      
      <div className="flex items-center bg-surface-container-highest rounded-lg px-3 py-2 gap-2 text-xs font-medium border border-outline-variant/20">
        <span className="text-slate-500">Method:</span>
        <select className="bg-transparent border-none p-0 text-indigo-300 focus:ring-0 text-xs font-bold cursor-pointer outline-none">
          <option>ALL METHODS</option>
          <option>GET</option>
          <option>POST</option>
          <option>PUT</option>
          <option>DELETE</option>
        </select>
      </div>

      <div className="flex items-center bg-surface-container-highest rounded-lg px-3 py-2 gap-2 text-xs font-medium border border-outline-variant/20">
        <span className="text-slate-500">Status:</span>
        <select className="bg-transparent border-none p-0 text-secondary focus:ring-0 text-xs font-bold cursor-pointer outline-none">
          <option>ANY STATUS</option>
          <option>2xx Success</option>
          <option>4xx Client Error</option>
          <option>5xx Server Error</option>
        </select>
      </div>

      <div className="flex-1 min-w-[200px] flex items-center bg-surface-container-lowest rounded-lg px-3 py-2 border border-outline-variant/20">
        <Filter className="text-slate-500 w-4 h-4 mr-2" />
        <input 
          type="text" 
          className="bg-transparent border-none p-0 text-xs w-full focus:ring-0 text-on-surface outline-none placeholder:text-outline-variant" 
          placeholder="Path: /v1/users/*" 
        />
      </div>

      <button className="bg-primary text-on-primary font-bold px-4 py-2 rounded-lg text-xs hover:shadow-[0_0_20px_rgba(192,193,255,0.4)] transition-all">
        Apply Filters
      </button>
    </div>
  );
}