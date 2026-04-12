"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/routes/routes';

export function PublicNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="w-full border-b border-outline-variant/20 sticky top-0 z-50 bg-surface/80 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-12 h-16">
        <div className="text-lg font-black text-white tracking-tighter">
          ApexMonitor
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
        <div className="hidden sm:flex items-center gap-4">
          <Link
            href={ROUTES.auth.login}
            className="text-xs font-medium uppercase tracking-widest text-on-surface hover:bg-surface-container-high px-4 py-2 rounded-lg transition-all"
          >
            Sign In
          </Link>
          <Link
            href={ROUTES.auth.register}
            className="bg-primary hover:shadow-[0_0_20px_-5px_rgba(255,69,0,0.5)] text-on-primary text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-lg transition-all duration-300"
          >
            Start Free
          </Link>
        </div>
        <button
          type="button"
          className="sm:hidden text-xs font-bold uppercase tracking-widest text-on-surface px-3 py-2 rounded-lg border border-outline-variant/20"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-expanded={isMenuOpen}
        >
          Menu
        </button>
      </div>

      {isMenuOpen ? (
        <div className="sm:hidden border-t border-outline-variant/20 px-4 py-4 bg-surface/95 backdrop-blur-xl flex flex-col gap-3">
          <Link href="#overview" className="text-xs font-medium uppercase tracking-widest text-primary" onClick={() => setIsMenuOpen(false)}>Overview</Link>
          <Link href="#pricing" className="text-xs font-medium uppercase tracking-widest text-on-surface-variant" onClick={() => setIsMenuOpen(false)}>Pricing</Link>
          <Link href="#docs" className="text-xs font-medium uppercase tracking-widest text-on-surface-variant" onClick={() => setIsMenuOpen(false)}>Docs</Link>
          <div className="pt-2 flex gap-3">
            <Link href={ROUTES.auth.login} className="flex-1 text-center text-xs font-medium uppercase tracking-widest text-on-surface hover:bg-surface-container-high px-4 py-2 rounded-lg transition-all" onClick={() => setIsMenuOpen(false)}>Sign In</Link>
            <Link href={ROUTES.auth.register} className="flex-1 text-center bg-primary text-on-primary text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-lg transition-all" onClick={() => setIsMenuOpen(false)}>Start Free</Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}