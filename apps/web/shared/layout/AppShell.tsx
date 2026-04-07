'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Activity, LayoutDashboard, Radio, ScrollText, Key, 
  Bell, LineChart, CreditCard, Settings, Search, HelpCircle 
} from 'lucide-react';
import { useProjectStore } from '@/features/projects/state/project.store';

const NAV_LINKS = [
  { name: 'Overview', href: '/overview', icon: LayoutDashboard },
  { name: 'Live Traffic', href: '/live-traffic', icon: Radio },
  { name: 'Logs', href: '/logs', icon: ScrollText },
  { name: 'Keys', href: '/keys', icon: Key },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Insights', href: '/insights', icon: LineChart },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const projects = useProjectStore((state) => state.projects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const setActiveProjectId = useProjectStore((state) => state.setActiveProjectId);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null;

  return (
    <div className="bg-background text-on-surface font-sans selection:bg-primary/30 min-h-screen">
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full flex flex-col bg-slate-950 w-64 border-r border-slate-800/50 shadow-[0_0_30px_-5px_rgba(99,102,241,0.15)] z-60">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tighter text-indigo-200">PulseAPI</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Observability</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-3 space-y-1 mt-4">
          {NAV_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-500/10 text-indigo-200 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)] border-r-2 border-indigo-400' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-sans text-sm tracking-tight">{link.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-800/50">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/40 border border-slate-800/30">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
              AC
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-200 truncate">Alex Chen</p>
              <p className="text-[10px] text-slate-500 truncate">System Architect</p>
            </div>
          </div>
        </div>
      </aside>

      {/* TopNavBar */}
      <header className="flex items-center justify-between px-6 ml-64 max-w-[calc(100%-16rem)] bg-slate-950/80 backdrop-blur-xl w-full h-16 border-b border-slate-800/50 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="text-xs font-medium uppercase tracking-widest text-slate-500">Project:</div>
            <div className="flex items-center gap-2">
              <select
                value={activeProject?.id ?? ''}
                onChange={(event) => setActiveProjectId(event.target.value)}
                disabled={projects.length === 0}
                className="bg-slate-900/70 border border-slate-800 text-sm font-bold text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {projects.length === 0 ? (
                  <option value="">No Projects</option>
                ) : (
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))
                )}
              </select>
              {activeProject ? (
                <span className="text-[10px] uppercase tracking-widest text-slate-500">
                  {activeProject.plan} / {activeProject.role}
                </span>
              ) : null}
            </div>
          </div>
          <div className="h-4 w-px bg-slate-800"></div>
          <div className="flex items-center bg-slate-900/60 rounded-full px-4 py-1.5 border border-slate-800 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
            <Search className="text-slate-500 w-4 h-4 mr-2" />
            <input 
              type="text" 
              placeholder="Search traffic logs..." 
              className="bg-transparent border-none focus:ring-0 text-xs text-slate-300 w-64 placeholder-slate-600 outline-none" 
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Time Filters - In a real app, these would update state/URL search params */}
          <nav className="flex items-center gap-1">
            {['1h', '6h', '24h', '7d'].map((time) => (
              <button 
                key={time} 
                className={`px-3 py-1 text-xs font-medium uppercase tracking-widest transition-colors ${
                  time === '24h' 
                    ? 'text-indigo-300 border-b-2 border-indigo-500' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {time}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 ml-4">
            <button className="p-2 text-slate-400 hover:bg-slate-800/40 rounded-full transition-all">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2 text-slate-400 hover:bg-slate-800/40 rounded-full transition-all">
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="ml-64 p-8 min-h-[calc(100vh-4rem)] relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#908fa0 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}