import { Terminal, Send } from 'lucide-react';

export function AiAnalysisBot() {
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col h-[500px] shadow-lg overflow-hidden">
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-orange-600" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-200">AI Analysis Bot</h4>
        </div>
        <span className="text-[9px] font-mono text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded">v1.4-NEURAL</span>
      </div>
      
      <div className="flex-1 p-5 overflow-y-auto space-y-5 font-mono text-xs leading-relaxed custom-scrollbar bg-[#0a0a0a]">
        <div className="text-neutral-500">
          <span className="text-orange-600 font-bold">system_init:</span> Engine online. Analyzing telemetry...
        </div>
        
        <div className="bg-neutral-900/50 p-4 rounded-lg border-l-2 border-orange-600">
          <span className="text-orange-500 font-bold block mb-1">ai_bot:</span> 
          <span className="text-neutral-300">Hello developer. I've finished the deep-dive analysis on <code className="bg-neutral-800 text-orange-300 px-1.5 py-0.5 rounded">worker-prod-01</code>. I've identified three potential bottlenecks in the authentication flow. Shall I list them or perform an automated stress test on the shadow cluster?</span>
        </div>
        
        <div className="text-right flex flex-col items-end">
          <span className="text-neutral-500 font-bold mb-1">user:</span>
          <span className="text-neutral-300 bg-neutral-800/50 px-4 py-2 rounded-lg inline-block border border-neutral-700/50">list bottlenecks and suggest fix for the highest latency one.</span>
        </div>
        
        <div className="text-neutral-300 bg-neutral-900/40 p-4 rounded-lg border border-neutral-800 shadow-inner">
          <span className="text-orange-500 font-bold block mb-2">ai_bot:</span> 
          Analysis complete:<br/>
          1. Redis O(N) command on <code className="text-orange-400">KEYS *</code> call (High Latency)<br/>
          2. TLS handshake overhead (Moderate)<br/>
          3. Payload serialization (Low)<br/><br/>
          <span className="text-orange-400 font-bold">Recommended Fix:</span> Replace <code className="text-orange-400">SCAN</code> for <code className="text-orange-400">KEYS</code> in <code className="bg-neutral-800 px-1 rounded">cache_service.go:42</code>. Estimated latency reduction: 240ms.
        </div>
      </div>
      
      <div className="p-4 border-t border-neutral-800 bg-neutral-950">
        <div className="flex items-center gap-3 bg-neutral-900 px-4 py-3 border border-neutral-800 rounded-lg focus-within:border-orange-600/50 focus-within:ring-1 focus-within:ring-orange-600/50 transition-all">
          <span className="text-orange-600 font-mono text-sm animate-pulse">_</span>
          <input 
            type="text" 
            placeholder="Query the neural engine..." 
            className="bg-transparent border-none focus:ring-0 text-xs font-mono text-white w-full outline-none placeholder:text-neutral-600"
          />
          <button aria-label="Send Message" className="hover:bg-neutral-800 p-1.5 rounded transition-colors">
            <Send className="w-4 h-4 text-neutral-500 hover:text-orange-500 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}