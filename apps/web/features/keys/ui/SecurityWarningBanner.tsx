import { AlertTriangle } from 'lucide-react';

export function SecurityWarningBanner() {
  return (
    <div className="bg-tertiary/10 border border-tertiary/20 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4 shadow-[0_0_30px_-5px_rgba(217,119,33,0.1)]">
      <div className="w-10 h-10 rounded-xl bg-tertiary-container flex items-center justify-center shrink-0">
        <AlertTriangle className="text-on-tertiary-container w-5 h-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-tertiary font-bold tracking-tight">Security Audit Required</h3>
        <p className="text-on-surface-variant text-sm mt-1">
          3 API keys have not been rotated in the last 90 days. We recommend revoking unused keys and regenerating production secrets to maintain infrastructure integrity.
        </p>
      </div>
      <button className="bg-tertiary text-on-tertiary px-4 py-2 rounded-lg text-sm font-bold hover:brightness-110 transition-all shrink-0 mt-2 md:mt-0">
        Rotate Keys
      </button>
    </div>
  );
}