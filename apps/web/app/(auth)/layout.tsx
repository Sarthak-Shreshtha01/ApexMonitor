import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col overflow-hidden items-center justify-center relative bg-[#0b0f14] text-on-surface font-sans selection:bg-primary/30">
      {/* Background Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(70, 69, 84, 0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      ></div>
      
      {/* Ambient Glows */}
      <div className="absolute top-1/4 -left-20 w-64 h-64 bg-secondary/5 blur-[120px] rounded-full pointer-events-none hidden md:block"></div>
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-primary/5 blur-[150px] rounded-full pointer-events-none hidden md:block"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      {children}
      
      {/* Abstract Typographic Deco */}
      <div className="absolute bottom-0 left-0 p-12 pointer-events-none hidden md:block">
        <div className="text-[120px] font-black text-outline-variant/5 leading-none select-none">PULSE</div>
      </div>
    </div>
  );
}