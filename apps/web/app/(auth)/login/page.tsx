'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, Mail, Unlock } from 'lucide-react';
import { authService } from '@/features/auth/api/auth.service';
import { useAppDispatch } from '@/lib/redux/hooks';
import { setTokens } from '@/features/auth/state/auth.slice';
import { projectsService } from '@/features/projects/api/projects.service';
import { useProjectStore } from '@/features/projects/state/project.store';
import { ROUTES } from '@/shared/routes/routes';

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const setProjects = useProjectStore((s) => s.setProjects);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const getErrorMessage = (value: unknown, fallback: string) => {
    if (typeof value === 'object' && value !== null && 'response' in value) {
      const response = value as { response?: { data?: { message?: string } } };
      return response.response?.data?.message || fallback;
    }

    return fallback;
  };

  const startOAuth = (provider: 'google' | 'github') => {
    window.location.href = authService.oauthStartUrl(provider, 'login');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { accessToken, refreshToken } = await authService.login({ email, password });
      dispatch(setTokens({ accessToken, refreshToken }));

      const projects = await projectsService.listMine();
      setProjects(projects);
      
      router.push(ROUTES.dashboard.overview);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Invalid email or password.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative z-10 w-full max-w-md px-6">
      <div className="flex flex-col items-center mb-10">
        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_15px_2px_rgba(255,69,0,0.3)] mb-6 group transition-all duration-300">
          <Activity className="text-on-primary w-6 h-6 font-bold" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tighter text-on-surface mb-2">ApexMonitor</h1>
        <p className="text-sm font-medium text-outline uppercase tracking-widest opacity-60">Kinetic Observatory</p>
      </div>

      <div className="bg-surface-container/70 backdrop-blur-xl border border-outline-variant/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/10 blur-3xl rounded-full"></div>
        
        <header className="mb-8">
          <h2 className="text-xl font-bold text-on-surface tracking-tight">Sign In</h2>
          <p className="text-sm text-outline-variant mt-1">Access your telemetry dashboard</p>
        </header>

        {error && (
          <div className="mb-6 p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold px-1">Email Address</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-outline-variant group-focus-within:text-primary transition-colors" />
              </div>
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-3 pl-10 pr-4 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm" 
                placeholder="dev@apexMonitor.tech" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold">Password</label>
              <Link href={ROUTES.auth.forgotPassword} className="text-[10px] uppercase tracking-wider text-primary hover:text-secondary transition-colors font-bold">
                Forgot password?
              </Link>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Unlock className="w-5 h-5 text-outline-variant group-focus-within:text-primary transition-colors" />
              </div>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-3 pl-10 pr-4 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm" 
                placeholder="••••••••" 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-4 bg-primary-container hover:bg-primary text-on-primary font-bold rounded-lg shadow-[0_0_30px_-5px_rgba(255,69,0,0.15)] hover:shadow-[0_0_40px_-5px_rgba(255,69,0,0.25)] hover:scale-[0.98] transition-all duration-200 text-sm uppercase tracking-widest disabled:opacity-70 disabled:hover:scale-100"
          >
            {isLoading ? 'Authenticating...' : 'Sign In'}
          </button>

          <div className="pt-2 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px bg-outline-variant/30 flex-1" />
              <span className="text-[10px] uppercase tracking-widest text-outline-variant">or continue with</span>
              <div className="h-px bg-outline-variant/30 flex-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => startOAuth('google')}
                className="py-3 px-4 border border-outline-variant/30 hover:border-primary/60 rounded-lg text-sm font-semibold text-on-surface transition-colors"
              >
                Google
              </button>
              <button
                type="button"
                onClick={() => startOAuth('github')}
                className="py-3 px-4 border border-outline-variant/30 hover:border-primary/60 rounded-lg text-sm font-semibold text-on-surface transition-colors"
              >
                GitHub
              </button>
            </div>
          </div>
        </form>

        <footer className="mt-8 text-center">
          <p className="text-sm text-outline-variant">
            Don&apos;t have an account?{' '}
            <Link href={ROUTES.auth.register} className="text-primary font-semibold hover:underline decoration-primary/30 underline-offset-4">
              Sign up
            </Link>
          </p>
        </footer>
      </div>

      {/* Terminal-style meta info */}
      <div className="mt-12 flex justify-between items-center opacity-40 px-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
            <span className="text-[10px] uppercase tracking-tighter text-on-surface">System Online</span>
          </div>
          <span className="text-[10px] uppercase tracking-tighter text-on-surface">V2.4.0-Stable</span>
        </div>
        <div className="text-[10px] uppercase tracking-tighter text-on-surface">SSL Secured: 256-bit</div>
      </div>
    </main>
  );
}