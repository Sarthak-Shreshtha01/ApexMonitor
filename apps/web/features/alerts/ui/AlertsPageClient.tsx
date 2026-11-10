'use client';

import { useProjectStore } from '@/features/projects/state/project.store';
import { AlertRuleBuilder } from './AlertRuleBuilder';
import { AlertRulesList } from './AlertRulesList';
import { TriggerHistory } from './TriggerHistory';

export function AlertsPageClient() {
  const projectId = useProjectStore((state) => state.activeProjectId);
  const projectName = useProjectStore((state) => state.projects.find((p) => p.id === state.activeProjectId)?.name);

  if (!projectId) {
    return <p className="text-sm text-secondary">Select or create a project to manage its alerts.</p>;
  }

  return (
    <section className="w-full min-w-0 space-y-8">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Alerts</h1>
        <p className="text-sm text-secondary mt-1">Rules for {projectName ?? projectId}. Evaluated every minute.</p>
      </header>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)] gap-8 items-start">
        <div className="space-y-8 min-w-0">
          <AlertRulesList projectId={projectId} />
          <AlertRuleBuilder projectId={projectId} />
        </div>
        <TriggerHistory projectId={projectId} />
      </div>
    </section>
  );
}
