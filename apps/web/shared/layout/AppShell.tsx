'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { 
  Activity, LayoutDashboard, Radio, ScrollText, Key, GitBranch,
  Bell, LineChart, CreditCard, Settings, Search, HelpCircle, LogOut, User
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useProjectStore } from '@/features/projects/state/project.store';
import { useDashboardStore, type DashboardTimeframe } from '@/features/dashboard/state/dashboard.store';
import { userService } from '@/features/settings/api/user.service';
import { apiClient } from '@/shared/api/apiClient';
import { useAppDispatch } from '@/lib/redux/hooks';
import { clearAuth } from '@/features/auth/state/auth.slice';

const NAV_LINKS = [
  { name: 'Overview', href: '/overview', icon: LayoutDashboard },
  { name: 'Live Traffic', href: '/live-traffic', icon: Radio },
  { name: 'Logs', href: '/logs', icon: ScrollText },
  { name: 'Traces', href: '/traces', icon: GitBranch },
  { name: 'Keys', href: '/keys', icon: Key },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Insights', href: '/ai-insights', icon: LineChart },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const projects = useProjectStore((state) => state.projects);
  const clearProjects = useProjectStore((state) => state.clearProjects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const setActiveProjectId = useProjectStore((state) => state.setActiveProjectId);
  const timeframe = useDashboardStore((state) => state.timeframe);
  const setTimeframe = useDashboardStore((state) => state.setTimeframe);

  const profileQuery = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => userService.getProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/api/v1/users/logout', {});
    },
    onSuccess: () => {
      dispatch(clearAuth());
      clearProjects();
      router.push('/login');
    },
    onError: () => {
      dispatch(clearAuth());
      clearProjects();
      router.push('/login');
    },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null;
  const userInitial = profileQuery.data?.name?.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="bg-app text-on-surface font-sans selection:bg-primary/20 min-h-screen">
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full flex flex-col bg-app w-[220px] border-r border-outline-variant z-50">
        <div className="p-4 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-on-primary">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-on-surface">PulseAPI</h1>
              <p className="text-[10px] uppercase tracking-widest text-secondary">Observability</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-2 py-3 space-y-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive 
                    ? 'bg-surface-container-high text-on-surface border-l-2 border-primary' 
                    : 'text-secondary hover:text-on-surface hover:bg-surface-variant'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="tracking-tight">{link.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-outline-variant">
          <div className="flex items-center gap-3 p-2 rounded-md bg-surface border border-outline-variant">
            <div className="w-7 h-7 rounded-full bg-surface-container-highest flex items-center justify-center text-xs font-bold text-white">
              AC
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-primary-foreground truncate">Alex Chen</p>
              <p className="text-[10px] text-secondary truncate">System Architect</p>
            </div>
          </div>
        </div>
      </aside>

      {/* TopNavBar */}
      <header className="flex items-center justify-between px-5 ml-[220px] max-w-[calc(100%-220px)] bg-surface w-full h-12 border-b border-outline-variant sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="text-xs font-medium uppercase tracking-widest text-secondary">Project:</div>
            <div className="flex items-center gap-2">
              <select
                value={activeProject?.id ?? ''}
                onChange={(event) => setActiveProjectId(event.target.value)}
                disabled={projects.length === 0}
                className="bg-surface-variant border border-outline-variant text-xs font-semibold text-white rounded-md px-3 py-1 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
                <span className="text-[10px] uppercase tracking-widest text-muted">
                  {activeProject.plan} / {activeProject.role}
                </span>
              ) : null}
            </div>
          </div>
          <div className="h-4 w-px bg-outline-variant"></div>
          <div className="hidden xl:flex items-center bg-surface-variant rounded-md px-3 py-1 border border-outline-variant focus-within:ring-1 focus-within:ring-primary/50 transition-all">
            <Search className="text-secondary w-4 h-4 mr-2" />
            <input 
              type="text" 
              placeholder="Search traffic logs..." 
              className="bg-transparent border-none focus:ring-0 text-xs text-primary-foreground w-56 placeholder:text-muted outline-none" 
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1 bg-surface-variant border border-outline-variant rounded-md p-1">
            {(['1h', '6h', '24h', '7d'] as DashboardTimeframe[]).map((time) => (
              <button 
                key={time} 
                onClick={() => setTimeframe(time)}
                className={`px-3 py-1 text-xs font-medium uppercase tracking-widest transition-colors ${
                  time === timeframe 
                    ? 'bg-surface-container-high text-on-surface border border-outline-variant' 
                    : 'text-secondary hover:text-primary-foreground'
                }`}
              >
                {time}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 ml-1">
            <button className="p-1.5 text-secondary hover:bg-surface-container-high rounded-md transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-1.5 text-secondary hover:bg-surface-container-high rounded-md transition-colors">
              <HelpCircle className="w-5 h-5" />
            </button>
            {/* User Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#ff8a6b] flex items-center justify-center text-xs font-bold text-white hover:ring-2 hover:ring-primary/50 transition-all"
              >
                {userInitial}
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-container-high border border-outline-variant rounded-md shadow-lg z-50">
                  <div className="p-3 border-b border-outline-variant">
                    <p className="text-xs font-bold text-on-surface">{profileQuery.data?.name || 'User'}</p>
                    <p className="text-[10px] text-secondary truncate">{profileQuery.data?.email || ''}</p>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-xs text-secondary hover:text-on-surface hover:bg-surface-variant transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span>Profile & Settings</span>
                  </Link>
                  <button
                    onClick={() => {
                      logoutMutation.mutate();
                      setIsDropdownOpen(false);
                    }}
                    disabled={logoutMutation.isPending}
                    className="w-full flex items-center gap-3 px-4 py-2 text-xs text-secondary hover:text-red-400 hover:bg-surface-variant transition-colors disabled:opacity-50"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{logoutMutation.isPending ? 'Signing out...' : 'Sign Out'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="ml-[220px] p-5 min-h-[calc(100vh-3rem)] relative bg-app">
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] grid-blueprint"></div>
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}