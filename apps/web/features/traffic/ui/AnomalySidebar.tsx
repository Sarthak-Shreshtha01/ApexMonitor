'use client';

import { AlertTriangle, ShieldAlert, Sparkles } from 'lucide-react';
import type { InsightItem } from '../api/insights.service';

interface AnomalySidebarProps {
  insights: InsightItem[];
  isLoading: boolean;
  isSocketConnected: boolean;
}

export function AnomalySidebar({ insights, isLoading, isSocketConnected }: AnomalySidebarProps) {
  const confidence = insights.length > 0 ? Math.min(99.9, 90 + insights.length * 1.1) : 94.2;

  return (
    <aside className="w-full md:w-80 flex flex-col bg-surface-container border-l border-outline-variant">
      <div className="p-4 border-b border-outline-variant flex items-center justify-between">
        <span className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          AI Anomaly Detection
        </span>
        <span className="text-[8px] bg-surface-container-high px-1.5 py-0.5 text-secondary rounded">CORE v2.4</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {isLoading ? <div className="text-secondary text-xs">Loading anomaly feed...</div> : null}

        {!isLoading && insights.length === 0 ? (
          <div className="bg-app border border-outline-variant p-3 rounded-sm text-[10px] text-secondary">
            No anomalies detected for this project yet.
          </div>
        ) : null}

        {insights.map((insight) => {
          const tone =
            insight.severity === 'critical'
              ? 'text-primary'
              : insight.severity === 'warning'
                ? 'text-tertiary'
                : 'text-secondary';

          return (
            <div key={`${insight.id}-${insight.createdAt}`} className="bg-app border border-outline-variant p-3 rounded-sm space-y-2">
              <div className={`flex items-center gap-2 ${tone}`}>
                {insight.severity === 'critical' ? (
                  <ShieldAlert className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-tight">{insight.type.replaceAll('_', ' ')}</span>
              </div>
              <p className="text-[10px] text-secondary leading-relaxed font-mono">{insight.message}</p>
              <div className="text-[9px] font-mono text-muted">
                {new Date(insight.createdAt).toLocaleString()} {insight.endpoint ? `· ${insight.endpoint}` : ''}
              </div>
            </div>
          );
        })}

        <div className="pt-4 border-t border-outline-variant">
          <span className="text-[9px] font-bold text-secondary uppercase block mb-3">Geographic Load Map</span>
          <div className="relative w-full aspect-video bg-app border border-outline-variant flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,69,0,0.25) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
            <span className="text-[8px] font-mono text-muted">GLOBAL_SCAN...</span>
            <div className="absolute top-[20%] left-[30%] w-1.5 h-1.5 bg-tertiary rounded-full animate-pulse"></div>
            <div className="absolute top-[60%] left-[80%] w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
            <div className="absolute top-[40%] left-[50%] w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-app border-t border-outline-variant">
        <div className="flex items-center justify-between text-[10px] text-secondary mb-2">
          <span>DETECTION CONFIDENCE</span>
          <span className="text-white">{confidence.toFixed(1)}%</span>
        </div>
        <div className="w-full h-1 bg-surface-container-high">
          <div className="h-full bg-primary" style={{ width: `${confidence}%` }}></div>
        </div>
        <div className="mt-2 text-[9px] font-mono text-muted">
          WebSocket: {isSocketConnected ? 'CONNECTED' : 'DISCONNECTED'}
        </div>
      </div>
    </aside>
  );
}
