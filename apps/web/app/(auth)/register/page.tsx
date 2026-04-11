'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { authService } from '@/features/auth/api/auth.service';
import { useAppDispatch } from '@/lib/redux/hooks';
import { setTokens } from '@/features/auth/state/auth.slice';
import { projectsService } from '@/features/projects/api/projects.service';
import { useProjectStore } from '@/features/projects/state/project.store';
import { ROUTES } from '@/shared/routes/routes';

export default function RegisterPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const setProjects = useProjectStore((s) => s.setProjects);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const getErrorMessage = (value: unknown, fallback: string) => {
    if (typeof value === 'object' && value !== null && 'response' in value) {
      const response = value as { response?: { data?: { message?: string } } };
      return response.response?.data?.message || fallback;
    }

    return fallback;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { accessToken, refreshToken } = await authService.register({
        name: fullName,
        email,
        password,
        company: company || undefined,
        jobTitle: jobTitle || undefined,
        timezone: timezone || undefined,
      });
      dispatch(setTokens({ accessToken, refreshToken }));

      const projects = await projectsService.listMine();
      setProjects(projects);

      router.push(ROUTES.dashboard.overview);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to create account.'));
    } finally {
      setIsLoading(false);
    }
  };

  const startOAuth = (provider: 'google' | 'github') => {
    window.location.href = authService.oauthStartUrl(provider, 'register');
  };

  return (
    <main className="grow flex items-center justify-center p-6 relative z-10 w-full">
      <div className="w-full max-w-110 grow">
        
        <div className="flex flex-col items-center mb-10">
          <div className="w-12 h-12 bg-surface-container-highest rounded-xl flex items-center justify-center border border-outline-variant/30 drop-shadow-[0_0_8px_rgba(255,69,0,0.4)] mb-6">
            <Activity className="text-primary w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface mb-2">PulseAPI</h1>
          <p className="text-on-surface-variant text-sm font-medium tracking-wide">OBSERVATORY ACCESS</p>
        </div>

        <div className="bg-surface-container/70 backdrop-blur-xl border border-outline-variant/20 rounded-2xl p-8 md:p-10 shadow-2xl">
          
          {error && (
            <div className="mb-6 p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Full Name</label>
              <input 
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-3 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm" 
                placeholder="John Doe" 
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Work Email</label>
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-3 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm" 
                placeholder="name@company.com" 
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-3 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm pr-12" 
                  placeholder="••••••••" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant hover:text-on-surface transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-3 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm"
                placeholder="Acme Inc."
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-3 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm"
                placeholder="Engineering Manager"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-3 text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm"
                placeholder="Asia/Kolkata"
              />
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-linear-to-r from-primary-container to-primary hover:from-primary hover:to-primary-fixed text-on-primary font-bold py-3.5 rounded-lg transition-all duration-200 transform active:scale-[0.98] shadow-[0_0_20px_-5px_rgba(255,69,0,0.4)] flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
              >
                <span>{isLoading ? 'Creating...' : 'Create Account'}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

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

          <div className="mt-8 text-center">
            <p className="text-[12px] text-on-surface-variant leading-relaxed">
              By signing up, you agree to our{' '}
              <Link href={ROUTES.legal.terms} className="text-primary hover:underline font-medium transition-all">Terms of Service</Link>{' '}
              and{' '}
              <Link href={ROUTES.legal.privacy} className="text-primary hover:underline font-medium transition-all">Privacy Policy</Link>.
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-on-surface-variant">
            Already have an account?{' '}
            <Link href={ROUTES.auth.login} className="text-primary font-semibold hover:text-primary-container transition-colors ml-1">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}