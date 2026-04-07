'use client';

import { useState } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Clock, TrendingUp, AlertTriangle } from 'lucide-react';

const DUMMY_KEYS = [
  { id: '1', name: 'Main Pipeline Token', env: 'Production', prefix: 'pk_live_', suffix: 'x9r4', color: 'bg-secondary', text: 'text-secondary', bg: 'bg-secondary-container/20', border: 'border-secondary/20', created: '14d ago', usage: '4.2M Requests', warning: false },
  { id: '2', name: 'Dev_Internal_Test', env: 'Staging', prefix: 'sk_test_', suffix: 'a2z9', color: 'bg-tertiary', text: 'text-tertiary', bg: 'bg-tertiary-container/20', border: 'border-tertiary/20', created: '112d ago', usage: null, warning: true },
];

export function ApiKeysSection() {
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  const toggleReveal = (id: string) => {
    setRevealedKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">API Keys</h2>
          <p className="text-secondary text-sm">Manage your secret identifiers and environment tokens.</p>
        </div>
        <button className="bg-primary text-on-primary px-5 py-2.5 rounded-lg text-sm font-bold shadow-[0_0_20px_-5px_rgba(255,69,0,0.4)] hover:shadow-[0_0_25px_-5px_rgba(255,69,0,0.5)] hover:scale-[0.98] transition-all flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create New Key
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DUMMY_KEYS.map(key => (
          <div key={key.id} className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${key.color}`}></div>
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className={`${key.bg} ${key.text} text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${key.border}`}>
                  {key.env}
                </span>
                <h4 className="text-lg font-bold text-white mt-2">{key.name}</h4>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded-lg bg-surface-container-high text-secondary hover:text-white transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-lg bg-error-container/20 text-error hover:bg-error-container/40 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/5 flex items-center justify-between">
              <code className={`${key.text} font-mono text-sm tracking-wider`}>
                {key.prefix}{revealedKeys[key.id] ? '8f92a1b3' : '••••••••••••'}{key.suffix}
              </code>
              <button 
                onClick={() => toggleReveal(key.id)}
                className="text-primary hover:text-white flex items-center gap-1.5 text-xs font-bold transition-colors"
              >
                {revealedKeys[key.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {revealedKeys[key.id] ? 'HIDE' : 'REVEAL'}
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4 text-[10px] uppercase tracking-widest text-secondary font-semibold">
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Created {key.created}</span>
              {key.warning ? (
                <span className="flex items-center gap-1 text-tertiary"><AlertTriangle className="w-3.5 h-3.5" /> Needs Rotation</span>
              ) : (
                <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> {key.usage}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}