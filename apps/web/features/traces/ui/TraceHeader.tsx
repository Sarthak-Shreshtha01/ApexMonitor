import { ArrowLeftRight, Bell, HelpCircle } from 'lucide-react';

export function TraceHeader() {
  return (
    <header className="flex justify-between items-center w-full px-6 h-16 border-b border-outline-variant/20 bg-app/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-secondary">Trace ID:</span>
          <span className="font-mono text-sm text-primary font-medium tracking-tight">req_9a3f2e1</span>
        </div>
        <div className="h-4 w-[1px] bg-outline-variant/30"></div>
        <nav className="flex gap-4">
          <span className="text-primary border-b-2 border-primary pb-1 cursor-pointer font-sans tracking-tight text-sm font-medium">1h</span>
          <span className="text-secondary hover:text-primary-foreground cursor-pointer font-sans tracking-tight text-sm font-medium">24h</span>
          <span className="text-secondary hover:text-primary-foreground cursor-pointer font-sans tracking-tight text-sm font-medium">7d</span>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-high/50 hover:bg-surface-container-highest/50 border border-outline-variant/20 transition-all">
          <ArrowLeftRight className="w-4 h-4 text-secondary" />
          <span className="text-xs font-medium text-primary-foreground">Project Switcher</span>
        </button>
        <div className="flex items-center gap-2">
          <Bell className="w-8 h-8 text-secondary p-2 hover:bg-surface-container-high/50 rounded-full cursor-pointer transition-colors" />
          <HelpCircle className="w-8 h-8 text-secondary p-2 hover:bg-surface-container-high/50 rounded-full cursor-pointer transition-colors" />
        </div>
        <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/30 flex items-center justify-center overflow-hidden text-xs font-bold text-secondary">
          {/* Avatar Placeholder */}
          AC
        </div>
      </div>
    </header>
  );
}