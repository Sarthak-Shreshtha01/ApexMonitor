import Link from 'next/link';
import { Globe, Code, Terminal } from 'lucide-react'; // Replaced Material icons with Lucide as per architecture

export function Footer() {
  return (
    <footer className="bg-surface-container-lowest py-24 px-6 border-t border-outline-variant/10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-12">
        <div className="max-w-xs">
          <div className="text-2xl font-black text-white tracking-tighter mb-6">
            ApexMonitor
          </div>
          <p className="text-on-surface-variant text-sm leading-relaxed mb-8">
            Building the future of digital infrastructure observability. Made for engineers, by engineers.
          </p>
          <div className="flex gap-4">
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/15 hover:text-primary transition-all"
              aria-label="Website"
            >
              <Globe className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/15 hover:text-primary transition-all"
              aria-label="Code"
            >
              <Code className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/15 hover:text-primary transition-all"
              aria-label="Terminal"
            >
              <Terminal className="w-5 h-5" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
          <div>
            <h5 className="text-xs font-bold uppercase tracking-widest text-primary-foreground mb-6">Product</h5>
            <ul className="space-y-4">
              <li><Link href="#" className="text-on-surface-variant text-sm hover:text-primary transition-colors">Platform</Link></li>
              <li><Link href="#" className="text-on-surface-variant text-sm hover:text-primary transition-colors">Pricing</Link></li>
              <li><Link href="#" className="text-on-surface-variant text-sm hover:text-primary transition-colors">Changelog</Link></li>
              <li><Link href="#" className="text-on-surface-variant text-sm hover:text-primary transition-colors">Roadmap</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-bold uppercase tracking-widest text-primary-foreground mb-6">Resources</h5>
            <ul className="space-y-4">
              <li><Link href="#" className="text-on-surface-variant text-sm hover:text-primary transition-colors">Documentation</Link></li>
              <li><Link href="#" className="text-on-surface-variant text-sm hover:text-primary transition-colors">API Reference</Link></li>
              <li><Link href="#" className="text-on-surface-variant text-sm hover:text-primary transition-colors">Support</Link></li>
              <li><Link href="#" className="text-on-surface-variant text-sm hover:text-primary transition-colors">Status</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-bold uppercase tracking-widest text-primary-foreground mb-6">Company</h5>
            <ul className="space-y-4">
              <li><Link href="#" className="text-on-surface-variant text-sm hover:text-primary transition-colors">About</Link></li>
              <li><Link href="#" className="text-on-surface-variant text-sm hover:text-primary transition-colors">Blog</Link></li>
              <li><Link href="#" className="text-on-surface-variant text-sm hover:text-primary transition-colors">Careers</Link></li>
              <li><Link href="#" className="text-on-surface-variant text-sm hover:text-primary transition-colors">Privacy</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-24 pt-8 border-t border-outline-variant/10 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-on-surface-variant text-xs">
          © 2024 ApexMonitor Infrastructure Inc. All rights reserved.
        </p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-secondary"></span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
            All Systems Operational
          </span>
        </div>
      </div>
    </footer>
  );
}