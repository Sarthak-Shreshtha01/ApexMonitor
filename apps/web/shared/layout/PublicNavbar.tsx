import Link from 'next/link';

export function PublicNavbar() {
  return (
    <nav className="w-full h-16 border-b border-outline-variant/20 sticky top-0 z-50 bg-surface/80 backdrop-blur-xl flex items-center justify-between px-6 lg:px-12">
      <div className="flex items-center gap-8">
        <div className="text-lg font-black text-white tracking-tighter">
          PulseAPI
        </div>
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="#overview"
            className="text-xs font-medium uppercase tracking-widest text-primary border-b-2 border-primary py-5"
          >
            Overview
          </Link>
          <Link
            href="#pricing"
            className="text-xs font-medium uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="#docs"
            className="text-xs font-medium uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Docs
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Link
          href="/login"
          className="text-xs font-medium uppercase tracking-widest text-on-surface hover:bg-surface-container-high px-4 py-2 rounded-lg transition-all"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="bg-primary hover:shadow-[0_0_20px_-5px_rgba(192,193,255,0.5)] text-on-primary text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-lg transition-all duration-300"
        >
          Start Free
        </Link>
      </div>
    </nav>
  );
}