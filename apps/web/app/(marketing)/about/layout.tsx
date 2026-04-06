import { Footer } from '@/shared/layout/Footer';
import { PublicNavbar } from '@/shared/layout/PublicNavbar';
import { ReactNode } from 'react';


export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface font-sans selection:bg-primary/30">
      <PublicNavbar />
      <main className="flex-1 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute inset-0 grid-blueprint -z-10"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[120px] rounded-full -z-20"></div>
        {children}
      </main>
      <Footer />
    </div>
  );
}